import { useCallback, useRef, useState } from 'react'
import { StepIndicator } from './StepIndicator'
import { validateFile, checkEngineAvailable } from '../lib/diagnosticClient'
import type { DiagnosticError } from '../lib/errorMessages'
import { RECOMMENDED_MAX_FILE_SIZE_BYTES } from '../lib/constants'
import { formatFileSize } from '../lib/format'
import styles from './UploadScreen.module.css'

interface Props {
  onFileReady: (file: File) => void
}

export function UploadScreen({ onFileReady }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<DiagnosticError | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((candidate: File | undefined) => {
    if (!candidate) return
    const engineError = checkEngineAvailable()
    if (engineError) {
      setError(engineError)
      setFile(null)
      return
    }
    const validationError = validateFile(candidate)
    if (validationError) {
      setError(validationError)
      setFile(null)
      return
    }
    setError(null)
    setFile(candidate)
  }, [])

  return (
    <div>
      <StepIndicator current={1} />
      <h1>Diagnostiquez votre GeoPackage</h1>
      <p className={styles.intro}>
        Déposez un fichier <code>.gpkg</code> pour obtenir un aperçu de ses couches, de ses
        propriétés principales et des éventuels problèmes géométriques détectés.
      </p>

      <div
        className={styles.dropzone}
        data-dragging={dragging}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files[0])
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gpkg"
          className={styles.hiddenInput}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <p className={styles.dropText}>Glissez votre GeoPackage ici</p>
        <p className={styles.or}>ou</p>
        <span className="btn btn-secondary">Sélectionner un fichier</span>
        {file && <p className={styles.selectedFile}>{file.name} — {formatFileSize(file.size)}</p>}
      </div>

      {error && <p className={styles.error} role="alert">{error.userMessage}</p>}

      <ul className={styles.infoList}>
        <li>Format accepté : <strong>.gpkg</strong></li>
        <li>Un seul fichier à la fois</li>
        <li>Taille maximale recommandée : {formatFileSize(RECOMMENDED_MAX_FILE_SIZE_BYTES)}</li>
        <li>Analyse réalisée localement dans votre navigateur, jamais envoyée à un serveur Datando</li>
      </ul>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!file}
        onClick={() => file && onFileReady(file)}
      >
        Analyser le fichier
      </button>
    </div>
  )
}
