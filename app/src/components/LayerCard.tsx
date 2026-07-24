import { useState } from 'react'
import type { LayerDiagnostic } from '../lib/types'
import { describeIssueCode } from '../lib/issueLabels'
import styles from './LayerCard.module.css'

const STATUS_LABEL: Record<LayerDiagnostic['status'], string> = {
  ok: 'Aucun problème détecté',
  warning: 'Points à vérifier',
  error: 'Problèmes détectés',
}

function formatExtent(extent: LayerDiagnostic['extent']): string {
  if (!extent) return 'non disponible'
  return `[${extent.map((n) => n.toFixed(2)).join(', ')}]`
}

export function LayerCard({ layer }: { layer: LayerDiagnostic }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.card} data-status={layer.status}>
      <div className={styles.headRow}>
        <h3>{layer.name}</h3>
        <span className={styles.badge} data-status={layer.status}>
          {STATUS_LABEL[layer.status]}
        </span>
      </div>

      <dl className={styles.grid}>
        <div>
          <dt>Type</dt>
          <dd>{layer.kind === 'vector' ? 'couche vectorielle' : 'table attributaire (sans géométrie)'}</dd>
        </div>
        {layer.kind === 'vector' && (
          <div>
            <dt>Géométrie</dt>
            <dd>{layer.geometryType ?? 'inconnue'}</dd>
          </div>
        )}
        <div>
          <dt>Entités</dt>
          <dd>{layer.featureCount ?? '—'}</dd>
        </div>
        {layer.kind === 'vector' && (
          <div>
            <dt>CRS</dt>
            <dd>{layer.crs ?? 'non déclaré'}</dd>
          </div>
        )}
        <div>
          <dt>Champs</dt>
          <dd>{layer.fieldCount ?? '—'}</dd>
        </div>
        {layer.kind === 'vector' && (
          <div>
            <dt>Emprise</dt>
            <dd>{layer.extent ? 'disponible' : 'non disponible'}</dd>
          </div>
        )}
        {layer.geometryCheckAvailable && (
          <>
            <div>
              <dt>Géométries nulles / vides</dt>
              <dd>{layer.emptyGeometryCount}</dd>
            </div>
            <div>
              <dt>Géométries invalides</dt>
              <dd>{layer.invalidGeometryCount}</dd>
            </div>
          </>
        )}
      </dl>

      {!layer.geometryCheckAvailable && layer.kind === 'vector' && (
        <p className={styles.note}>Le contrôle de validité géométrique n'a pas pu être exécuté sur cette couche.</p>
      )}

      {layer.issues.length > 0 && (
        <div className={styles.details}>
          <button type="button" className="btn-ghost" onClick={() => setOpen((v) => !v)}>
            {open ? 'Masquer les détails' : 'Voir les détails'} ({layer.issues.length})
          </button>
          {open && (
            <ul className={styles.issueList}>
              {layer.issues.map((issue, index) => {
                const { label, description } = describeIssueCode(issue.code)
                return (
                  <li key={index}>
                    <div className={styles.issueHead}>
                      <span>Entité {issue.featureId}</span>
                      <span className={styles.issueLabel}>{label}</span>
                    </div>
                    {description && <p className={styles.issueDesc}>{description}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <p className={styles.extentValue}>{layer.extent && `Emprise : ${formatExtent(layer.extent)}`}</p>
    </div>
  )
}
