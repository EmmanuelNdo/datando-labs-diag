import styles from './StepIndicator.module.css'

const STEPS = ['Déposer le fichier', 'Analyser', 'Consulter le diagnostic']

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className={styles.list} aria-label="Étapes">
      {STEPS.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3
        const state = step < current ? 'done' : step === current ? 'active' : 'pending'
        return (
          <li key={label} className={styles.item} data-state={state}>
            <span className={styles.bullet}>{step}</span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
