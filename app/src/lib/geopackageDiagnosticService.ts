import initGeolibre, { vector_info, version as geolibreVersion } from 'geolibre-wasm'
import { initTools, runTool } from 'geolibre-wasm/tools'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { toDiagnosticError } from './errorMessages'
import type {
  AnalysisStep,
  DiagnosticResult,
  DiagnosticStatus,
  DiagnosticSummary,
  GeometryIssue,
  LayerDiagnostic,
} from './types'

interface GpkgContentsRow {
  table_name: string
  data_type: string
  srs_id: number | null
  geometry_type_name: string | null
}

interface VectorInfo {
  ok: boolean
  name: string
  features: number
  geometry: string | null
  epsg: number | null
  fields: { name: string; type: string }[]
  bbox: [number, number, number, number] | null
}

interface RepairGeometrySummary {
  feature_count: number
  invalid_count: number
  null_empty_count: number
  self_intersection_count: number
  ring_orientation_count: number
  duplicate_vertex_count: number
}

/**
 * Couche d'abstraction unique pour tout ce qui touche GeoLibre / sql.js.
 * Toute l'application passe par cette classe : c'est le seul endroit qui
 * appelle directement le moteur WASM (§15 du cahier des charges).
 *
 * Conçue pour tourner dans un Web Worker : ne touche jamais au DOM.
 */
export class GeoPackageDiagnosticService {
  private static sqlJsPromise: Promise<SqlJsStatic> | null = null
  private static geolibreReadyPromise: Promise<void> | null = null
  private static toolsReadyPromise: Promise<void> | null = null

  private static getSqlJs(): Promise<SqlJsStatic> {
    if (!this.sqlJsPromise) {
      this.sqlJsPromise = initSqlJs({
        // import.meta.env.BASE_URL (always trailing-slash-terminated) rather
        // than a hardcoded "/": on a project site (e.g. GitHub Pages) the
        // app is served under a subpath, and a root-absolute path 404s.
        locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`,
      })
    }
    return this.sqlJsPromise
  }

  private static ensureGeolibreReady(): Promise<void> {
    if (!this.geolibreReadyPromise) {
      this.geolibreReadyPromise = initGeolibre().then(() => undefined)
    }
    return this.geolibreReadyPromise
  }

  private static ensureToolsReady(): Promise<void> {
    if (!this.toolsReadyPromise) {
      this.toolsReadyPromise = initTools().then(() => undefined)
    }
    return this.toolsReadyPromise
  }

  async analyze(
    bytes: Uint8Array,
    fileName: string,
    onProgress: (step: AnalysisStep) => void,
  ): Promise<DiagnosticResult> {
    const startedAt = Date.now()

    onProgress('opening')
    const [SQL] = await Promise.all([
      GeoPackageDiagnosticService.getSqlJs(),
      GeoPackageDiagnosticService.ensureGeolibreReady(),
      GeoPackageDiagnosticService.ensureToolsReady(),
    ])

    let db: Database
    try {
      db = new SQL.Database(bytes)
      // valider qu'il s'agit bien d'un GeoPackage (présence de gpkg_contents)
      db.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name='gpkg_contents'")
    } catch (err) {
      throw toDiagnosticError('invalid_geopackage', String(err))
    }

    onProgress('inventory')
    const contentsRows = this.readGpkgContents(db)
    const spatialRows = contentsRows.filter((r) => r.data_type === 'features')
    const attributeRows = contentsRows.filter((r) => r.data_type === 'attributes')
    const relevantRows = [...spatialRows, ...attributeRows]

    if (relevantRows.length === 0) {
      db.close()
      throw toDiagnosticError('no_layers', 'gpkg_contents is empty or contains only unsupported layer types')
    }

    onProgress('geometry')
    const layers: LayerDiagnostic[] = []
    for (const row of relevantRows) {
      layers.push(await this.analyzeLayer(SQL, db, row))
    }

    onProgress('preparing')
    db.close()

    const summary = this.computeSummary(layers)
    const fileStatus = this.worstStatus(layers.map((l) => l.status))

    return {
      file: {
        name: fileName,
        sizeBytes: bytes.byteLength,
        analysisDurationMs: Date.now() - startedAt,
        status: fileStatus,
      },
      summary,
      layers,
      engineVersion: geolibreVersion(),
    }
  }

  private readGpkgContents(db: Database): GpkgContentsRow[] {
    const stmt = db.prepare(
      `SELECT c.table_name AS table_name, c.data_type AS data_type,
              c.srs_id AS srs_id, g.geometry_type_name AS geometry_type_name
       FROM gpkg_contents c
       LEFT JOIN gpkg_geometry_columns g ON g.table_name = c.table_name
       ORDER BY c.table_name`,
    )
    const rows: GpkgContentsRow[] = []
    while (stmt.step()) {
      const r = stmt.getAsObject() as unknown as GpkgContentsRow
      rows.push(r)
    }
    stmt.free()
    return rows
  }

  /**
   * GeoLibre ne sait lire que la première couche d'un GeoPackage multicouche
   * (constat du spike, docs/SPIKE.md §3). On isole donc chaque couche dans un
   * GeoPackage mono-couche en mémoire avant de la passer à GeoLibre.
   */
  private splitSingleLayer(SQL: SqlJsStatic, db: Database, row: GpkgContentsRow, otherTables: string[]): Uint8Array {
    const clone = new SQL.Database(db.export())
    for (const table of otherTables) {
      if (table === row.table_name) continue
      clone.run(`DROP TABLE IF EXISTS "${table.replace(/"/g, '""')}"`)
    }
    clone.run('DELETE FROM gpkg_contents WHERE table_name != ?', [row.table_name])
    clone.run('DELETE FROM gpkg_geometry_columns WHERE table_name != ?', [row.table_name])
    const bytes = clone.export()
    clone.close()
    return bytes
  }

  private countFeatures(db: Database, table: string): number {
    const stmt = db.prepare(`SELECT COUNT(*) AS n FROM "${table.replace(/"/g, '""')}"`)
    stmt.step()
    const n = (stmt.getAsObject() as { n: number }).n
    stmt.free()
    return n
  }

  private countFields(db: Database, table: string, geometryColumn: string | null): number {
    const stmt = db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`)
    let count = 0
    while (stmt.step()) {
      const col = stmt.getAsObject() as { name: string; pk: number }
      if (col.pk === 1) continue // clé primaire (fid)
      if (geometryColumn && col.name === geometryColumn) continue
      count++
    }
    stmt.free()
    return count
  }

  private async analyzeLayer(SQL: SqlJsStatic, db: Database, row: GpkgContentsRow): Promise<LayerDiagnostic> {
    const allTables = this.readGpkgContents(db).map((r) => r.table_name)

    if (row.data_type === 'attributes') {
      const featureCount = this.countFeatures(db, row.table_name)
      const fieldCount = this.countFields(db, row.table_name, null)
      return {
        name: row.table_name,
        kind: 'attributes',
        geometryType: null,
        featureCount,
        fieldCount,
        crs: null,
        extent: null,
        emptyGeometryCount: null,
        invalidGeometryCount: null,
        status: 'ok',
        geometryCheckAvailable: false,
        issues: [],
      }
    }

    const singleLayerBytes = this.splitSingleLayer(SQL, db, row, allTables)

    let info: VectorInfo | null = null
    try {
      info = JSON.parse(vector_info(singleLayerBytes, 'gpkg')) as VectorInfo
    } catch {
      info = null
    }

    let emptyGeometryCount: number | null = null
    let invalidGeometryCount: number | null = null
    let geometryCheckAvailable = false
    const issues: GeometryIssue[] = []

    try {
      const result = await runTool('repair_geometry', {
        args: ['--input=/work/layer.gpkg', '--output=/work/report.geojson', '--check_only=true'],
        input: { 'layer.gpkg': singleLayerBytes },
      })
      const summaryLine = result.stdout.find((line) => line.trim().startsWith('{'))
      if (result.exitCode === 0 && summaryLine) {
        const parsed = JSON.parse(summaryLine) as RepairGeometrySummary
        emptyGeometryCount = parsed.null_empty_count
        invalidGeometryCount = parsed.invalid_count - parsed.null_empty_count
        geometryCheckAvailable = true

        const reportBytes = result.files['report.geojson']
        if (reportBytes) {
          const reportText = new TextDecoder().decode(reportBytes)
          const fc = JSON.parse(reportText) as {
            features: { properties?: Record<string, unknown> }[]
          }
          fc.features.forEach((feature, index) => {
            const code = feature.properties?.problem_code
            if (typeof code === 'string' && code !== 'ok') {
              issues.push({ layer: row.table_name, featureId: index + 1, code })
            }
          })
        }
      }
    } catch {
      // le contrôle de validité géométrique n'a pas pu être exécuté sur
      // cette couche : on continue avec les informations disponibles et on
      // signale son indisponibilité (geometryCheckAvailable reste false).
    }

    const featureCount = info?.features ?? this.countFeatures(db, row.table_name)
    const fieldCount = info?.fields?.length ?? this.countFields(db, row.table_name, 'geom')
    const crs = info?.epsg ? `EPSG:${info.epsg}` : row.srs_id ? `EPSG:${row.srs_id}` : null
    const geometryType = info?.geometry ?? row.geometry_type_name

    const status: DiagnosticStatus = !geometryCheckAvailable
      ? 'ok'
      : (invalidGeometryCount ?? 0) > 0
        ? 'error'
        : (emptyGeometryCount ?? 0) > 0
          ? 'warning'
          : 'ok'

    return {
      name: row.table_name,
      kind: 'vector',
      geometryType,
      featureCount,
      fieldCount,
      crs,
      extent: info?.bbox ?? null,
      emptyGeometryCount,
      invalidGeometryCount,
      status,
      geometryCheckAvailable,
      issues,
      geojson: undefined,
    }
  }

  private computeSummary(layers: LayerDiagnostic[]): DiagnosticSummary {
    const withGeometry = layers.filter((l) => l.kind === 'vector')
    const featureCounts = layers.map((l) => l.featureCount).filter((n): n is number => n !== null)
    return {
      layerCount: layers.length,
      featureCount: featureCounts.length > 0 ? featureCounts.reduce((a, b) => a + b, 0) : null,
      layersWithGeometry: withGeometry.length,
      layersWithoutGeometry: layers.length - withGeometry.length,
      invalidGeometryCount: layers.reduce((sum, l) => sum + (l.invalidGeometryCount ?? 0), 0),
    }
  }

  private worstStatus(statuses: DiagnosticStatus[]): DiagnosticStatus {
    if (statuses.includes('error')) return 'error'
    if (statuses.includes('warning')) return 'warning'
    return 'ok'
  }
}
