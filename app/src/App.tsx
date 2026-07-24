import { useEffect, useRef, useState } from 'react'
import { Layout } from './components/Layout'
import { UploadScreen } from './components/UploadScreen'
import { AnalyzingScreen } from './components/AnalyzingScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { ErrorScreen } from './components/ErrorScreen'
import { DiagnosticClient } from './lib/diagnosticClient'
import { track, sizeBucketFor } from './lib/analytics'
import type { DiagnosticError } from './lib/errorMessages'
import type { AnalysisStep, DiagnosticResult } from './lib/types'

type ViewState =
  | { name: 'upload' }
  | { name: 'analyzing'; fileName: string; step: AnalysisStep }
  | { name: 'done'; result: DiagnosticResult }
  | { name: 'error'; error: DiagnosticError }

function MobileNotice() {
  const [dismissed, setDismissed] = useState(false)
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768
  if (!isNarrow || dismissed) return null
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '0.85rem 1rem',
        marginBottom: '1.5rem',
        fontSize: '0.85rem',
        color: 'var(--muted)',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      <span>Cet outil est actuellement optimisé pour une utilisation sur ordinateur.</span>
      <button type="button" className="btn-ghost" onClick={() => setDismissed(true)} aria-label="Fermer">
        ✕
      </button>
    </div>
  )
}

function App() {
  const [view, setView] = useState<ViewState>({ name: 'upload' })
  const clientRef = useRef<DiagnosticClient | null>(null)
  const startedAtRef = useRef<number>(0)

  useEffect(() => {
    track({ name: 'tool_opened' })
  }, [])

  function reset() {
    clientRef.current?.cancel()
    clientRef.current = null
    setView({ name: 'upload' })
  }

  async function startAnalysis(file: File) {
    track({ name: 'analysis_started' })
    startedAtRef.current = Date.now()
    setView({ name: 'analyzing', fileName: file.name, step: 'opening' })

    const client = new DiagnosticClient()
    clientRef.current = client

    try {
      const result = await client.analyze(file, (step) => {
        setView((prev) => (prev.name === 'analyzing' ? { ...prev, step } : prev))
      })
      track({
        name: 'analysis_succeeded',
        durationMs: Date.now() - startedAtRef.current,
        layerCount: result.summary.layerCount,
        sizeBucket: sizeBucketFor(file.size),
      })
      setView({ name: 'done', result })
    } catch (err) {
      const diagError = err as DiagnosticError
      track({
        name: 'analysis_failed',
        durationMs: Date.now() - startedAtRef.current,
        sizeBucket: sizeBucketFor(file.size),
        errorCode: diagError.code ?? 'unknown',
      })
      setView({ name: 'error', error: diagError })
    } finally {
      clientRef.current = null
    }
  }

  return (
    <Layout>
      <MobileNotice />
      {view.name === 'upload' && <UploadScreen onFileReady={startAnalysis} />}
      {view.name === 'analyzing' && (
        <AnalyzingScreen fileName={view.fileName} currentStep={view.step} onCancel={reset} />
      )}
      {view.name === 'done' && <ResultsScreen result={view.result} onReset={reset} />}
      {view.name === 'error' && <ErrorScreen error={view.error} onRetry={reset} />}
    </Layout>
  )
}

export default App
