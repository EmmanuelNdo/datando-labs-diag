/**
 * Instrumentation anonyme minimale (§14 du cahier des charges).
 * Ne doit JAMAIS recevoir : le fichier, ses attributs, ses géométries, les
 * noms de couches, les noms de champs, ou le nom du fichier.
 *
 * Aucun outil analytique tiers n'est branché dans ce MVP : les événements
 * sont simplement journalisés en console pendant la bêta. Le point
 * d'intégration est isolé ici pour rester le seul endroit à modifier si un
 * outil anonyme est ajouté plus tard.
 */
export type AnalyticsEvent =
  | { name: 'tool_opened' }
  | { name: 'analysis_started' }
  | { name: 'analysis_succeeded'; durationMs: number; layerCount: number; sizeBucket: SizeBucket }
  | { name: 'analysis_failed'; durationMs: number; sizeBucket: SizeBucket; errorCode: string }

export type SizeBucket = '<5MB' | '5-20MB' | '20-50MB' | '>50MB'

export function sizeBucketFor(sizeBytes: number): SizeBucket {
  const mb = sizeBytes / (1024 * 1024)
  if (mb < 5) return '<5MB'
  if (mb < 20) return '5-20MB'
  if (mb <= 50) return '20-50MB'
  return '>50MB'
}

export function track(event: AnalyticsEvent): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event)
  }
}
