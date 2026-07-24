/** Statut pédagogique attribué à un fichier ou à une couche. */
export type DiagnosticStatus = 'ok' | 'warning' | 'error'

export interface GeometryIssue {
  layer: string
  featureId: number | string | null
  /** Code brut renvoyé par repair_geometry --check_only (ex: "self_intersection"). */
  code: string
  /** Traduction pédagogique connue pour ce code, sinon absente. */
  label?: string
  description?: string
}

export interface LayerDiagnostic {
  name: string
  kind: 'vector' | 'attributes'
  geometryType: string | null
  featureCount: number | null
  fieldCount: number | null
  crs: string | null
  extent: [number, number, number, number] | null
  emptyGeometryCount: number | null
  invalidGeometryCount: number | null
  status: DiagnosticStatus
  /** true si repair_geometry --check_only a pu être exécuté sur cette couche. */
  geometryCheckAvailable: boolean
  issues: GeometryIssue[]
  geojson?: string
}

export interface DiagnosticSummary {
  layerCount: number
  featureCount: number | null
  layersWithGeometry: number
  layersWithoutGeometry: number
  invalidGeometryCount: number
}

export interface DiagnosticFileInfo {
  name: string
  sizeBytes: number
  analysisDurationMs: number
  status: DiagnosticStatus
}

export interface DiagnosticResult {
  file: DiagnosticFileInfo
  summary: DiagnosticSummary
  layers: LayerDiagnostic[]
  engineVersion: string
}

export type AnalysisStep =
  | 'opening'
  | 'inventory'
  | 'geometry'
  | 'preparing'

export interface AnalysisProgressEvent {
  type: 'progress'
  step: AnalysisStep
}

export interface AnalysisDoneEvent {
  type: 'done'
  result: DiagnosticResult
}

export interface AnalysisErrorEvent {
  type: 'error'
  code: string
  technicalMessage: string
}

export type AnalysisWorkerEvent = AnalysisProgressEvent | AnalysisDoneEvent | AnalysisErrorEvent

export interface AnalysisWorkerRequest {
  type: 'analyze'
  file: ArrayBuffer
  fileName: string
}
