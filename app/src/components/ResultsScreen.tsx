import { StepIndicator } from './StepIndicator'
import { LayerCard } from './LayerCard'
import type { DiagnosticResult, DiagnosticStatus } from '../lib/types'
import styles from './ResultsScreen.module.css'

const VERDICT_TITLE: Record<DiagnosticStatus, string> = {
  ok: 'Aucun problème détecté',
  warning: 'Points à vérifier',
  error: 'Problèmes détectés',
}

const VERDICT_TEXT: Record<DiagnosticStatus, string> = {
  ok: "Aucun problème n'a été détecté parmi les contrôles disponibles dans cette version.",
  warning: 'Le fichier peut être utilisé, mais certains éléments méritent une vérification.',
  error: 'Plusieurs anomalies ont été détectées. Il est recommandé de vérifier les couches concernées avant utilisation.',
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

interface Props {
  result: DiagnosticResult
  onReset: () => void
}

export function ResultsScreen({ result, onReset }: Props) {
  const { file, summary, layers } = result

  return (
    <div>
      <StepIndicator current={3} />
      <p className={styles.fileName}>{file.name}</p>
      <h1>Synthèse du diagnostic</h1>

      <div className={styles.verdict} data-status={file.status}>
        <h2>{VERDICT_TITLE[file.status]}</h2>
        <p>{VERDICT_TEXT[file.status]}</p>
      </div>

      <dl className={styles.summaryGrid}>
        <div>
          <dt>Couches détectées</dt>
          <dd>{summary.layerCount}</dd>
        </div>
        <div>
          <dt>Entités totales</dt>
          <dd>{summary.featureCount ?? '—'}</dd>
        </div>
        <div>
          <dt>Couches avec géométrie</dt>
          <dd>{summary.layersWithGeometry}</dd>
        </div>
        <div>
          <dt>Couches sans géométrie</dt>
          <dd>{summary.layersWithoutGeometry}</dd>
        </div>
        <div>
          <dt>Anomalies géométriques</dt>
          <dd>{summary.invalidGeometryCount}</dd>
        </div>
        <div>
          <dt>Taille du fichier</dt>
          <dd>{formatSize(file.sizeBytes)}</dd>
        </div>
        <div>
          <dt>Durée de l'analyse</dt>
          <dd>{formatDuration(file.analysisDurationMs)}</dd>
        </div>
      </dl>

      <h2 className={styles.sectionTitle}>Détail par couche</h2>
      {layers.map((layer) => (
        <LayerCard key={layer.name} layer={layer} />
      ))}

      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={onReset}>
          Analyser un autre fichier
        </button>
      </div>

      <div className={styles.cta}>
        <p>Vous souhaitez apprendre à contrôler et nettoyer vos données dans QGIS ?</p>
        <div className={styles.ctaButtons}>
          <a className="btn btn-secondary" href="https://datando.fr" target="_blank" rel="noreferrer">
            Découvrir les formations QGIS
          </a>
          <a
            className="btn btn-secondary"
            href="https://les-geomagiciens.circle.so/"
            target="_blank"
            rel="noreferrer"
          >
            Rejoindre Les Géomagiciens
          </a>
        </div>
      </div>
    </div>
  )
}
