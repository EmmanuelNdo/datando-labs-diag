import type { ReactNode } from 'react'
import styles from './Layout.module.css'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          Datando <span className="gradient-text">Labs</span>
        </div>
        <p className={styles.tagline}>Une expérimentation Datando Labs, propulsée par GeoLibre.</p>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <p>
          GeoPackage Diagnostic est un prédiagnostic rapide, pas un contrôle qualité complet ni une
          certification. Le fichier déposé est analysé localement dans votre navigateur et n'est
          conservé qu'en mémoire le temps de la session.
        </p>
      </footer>
    </div>
  )
}
