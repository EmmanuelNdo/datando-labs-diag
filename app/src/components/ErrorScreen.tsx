import { useState } from 'react'
import type { DiagnosticError } from '../lib/errorMessages'
import styles from './ErrorScreen.module.css'

interface Props {
  error: DiagnosticError
  onRetry: () => void
}

export function ErrorScreen({ error, onRetry }: Props) {
  const [showTechnical, setShowTechnical] = useState(false)

  return (
    <div>
      <h1>Analyse impossible</h1>
      <p className={styles.message}>{error.userMessage}</p>

      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Analyser un autre fichier
      </button>

      <div className={styles.technical}>
        <button type="button" className="btn-ghost" onClick={() => setShowTechnical((v) => !v)}>
          {showTechnical ? 'Masquer les détails techniques' : 'Détails techniques'}
        </button>
        {showTechnical && (
          <pre className={styles.technicalBlock}>
            {error.code}: {error.technicalMessage}
          </pre>
        )}
      </div>
    </div>
  )
}
