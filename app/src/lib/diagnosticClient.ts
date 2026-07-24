import { toDiagnosticError, type DiagnosticError } from './errorMessages'
import { RECOMMENDED_MAX_FILE_SIZE_BYTES } from './constants'
import type { AnalysisStep, AnalysisWorkerEvent, DiagnosticResult } from './types'

export function checkEngineAvailable(): DiagnosticError | null {
  if (typeof WebAssembly === 'undefined' || typeof Worker === 'undefined') {
    return toDiagnosticError('engine_unavailable', 'WebAssembly or Worker API unavailable in this browser')
  }
  return null
}

export function validateFile(file: File): DiagnosticError | null {
  if (!file.name.toLowerCase().endsWith('.gpkg')) {
    return toDiagnosticError('invalid_extension', `unsupported extension for file "${file.name}"`)
  }
  if (file.size === 0) {
    return toDiagnosticError('empty_file', 'file is 0 bytes')
  }
  if (file.size > RECOMMENDED_MAX_FILE_SIZE_BYTES) {
    return toDiagnosticError('file_too_large', `file size ${file.size} exceeds recommended limit`)
  }
  return null
}

/**
 * Point d'entrée unique côté thread principal : possède le Web Worker et
 * traduit ses événements en promesse + callback de progression. Aucun appel
 * WASM direct n'a lieu ici (voir GeoPackageDiagnosticService, exécuté dans
 * le worker).
 */
export class DiagnosticClient {
  private worker: Worker | null = null

  analyze(file: File, onProgress: (step: AnalysisStep) => void): Promise<DiagnosticResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../worker/diagnostic.worker.ts', import.meta.url), {
        type: 'module',
      })
      this.worker = worker

      worker.onmessage = (e: MessageEvent<AnalysisWorkerEvent>) => {
        const event = e.data
        if (event.type === 'progress') {
          onProgress(event.step)
        } else if (event.type === 'done') {
          resolve(event.result)
          this.terminate()
        } else if (event.type === 'error') {
          reject(toDiagnosticError(event.code, event.technicalMessage))
          this.terminate()
        }
      }
      worker.onerror = (e) => {
        reject(toDiagnosticError('unknown', e.message))
        this.terminate()
      }

      file.arrayBuffer().then((buffer) => {
        worker.postMessage({ type: 'analyze', file: buffer, fileName: file.name }, [buffer])
      })
    })
  }

  /** Interrompt l'analyse en cours et libère les ressources du worker. */
  cancel(): void {
    this.terminate()
  }

  private terminate(): void {
    this.worker?.terminate()
    this.worker = null
  }
}
