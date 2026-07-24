/// <reference lib="webworker" />
import { GeoPackageDiagnosticService } from '../lib/geopackageDiagnosticService'
import { toDiagnosticError, type DiagnosticError } from '../lib/errorMessages'
import type { AnalysisWorkerEvent, AnalysisWorkerRequest } from '../lib/types'

const service = new GeoPackageDiagnosticService()

function post(event: AnalysisWorkerEvent) {
  ;(self as unknown as Worker).postMessage(event)
}

self.onmessage = async (e: MessageEvent<AnalysisWorkerRequest>) => {
  const { data } = e
  if (data.type !== 'analyze') return

  try {
    const bytes = new Uint8Array(data.file)
    const result = await service.analyze(bytes, data.fileName, (step) => {
      post({ type: 'progress', step })
    })
    post({ type: 'done', result })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && 'technicalMessage' in err) {
      const diagErr = err as DiagnosticError
      post({ type: 'error', code: diagErr.code, technicalMessage: diagErr.technicalMessage })
    } else {
      const wrapped = toDiagnosticError('unknown', err instanceof Error ? err.message : String(err))
      post({ type: 'error', code: wrapped.code, technicalMessage: wrapped.technicalMessage })
    }
  }
}
