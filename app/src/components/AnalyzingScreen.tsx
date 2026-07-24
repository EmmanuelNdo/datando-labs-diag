import { StepIndicator } from './StepIndicator'
import type { AnalysisStep } from '../lib/types'
import styles from './AnalyzingScreen.module.css'

const STEP_LABELS: Record<AnalysisStep, string> = {
  opening: 'Ouverture du GeoPackage…',
  inventory: 'Inventaire des couches…',
  geometry: 'Analyse des géométries…',
  preparing: 'Préparation du diagnostic…',
}

const STEP_ORDER: AnalysisStep[] = ['opening', 'inventory', 'geometry', 'preparing']

interface Props {
  fileName: string
  currentStep: AnalysisStep
  onCancel: () => void
}

export function AnalyzingScreen({ fileName, currentStep, onCancel }: Props) {
  const currentIndex = STEP_ORDER.indexOf(currentStep)

  return (
    <div>
      <StepIndicator current={2} />
      <h1>Analyse en cours</h1>
      <p className={styles.fileName}>{fileName}</p>

      <ul className={styles.steps}>
        {STEP_ORDER.map((step, index) => (
          <li key={step} data-state={index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending'}>
            <span className={styles.dot} aria-hidden="true" />
            {STEP_LABELS[step]}
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Annuler
      </button>
    </div>
  )
}
