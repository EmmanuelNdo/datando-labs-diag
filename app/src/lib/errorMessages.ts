export interface DiagnosticError {
  code: string
  userMessage: string
  technicalMessage: string
}

/**
 * Correspondance entre erreurs techniques (GeoLibre, sql.js, contrôles de
 * dépôt) et messages lisibles. Les erreurs GeoLibre brutes ne doivent
 * jamais atteindre l'utilisateur (§17 du cahier des charges).
 */
export function toDiagnosticError(codeHint: string, technicalMessage: string): DiagnosticError {
  const known = KNOWN_ERRORS[codeHint]
  if (known) {
    return { code: codeHint, userMessage: known, technicalMessage }
  }

  const lower = technicalMessage.toLowerCase()
  if (lower.includes('not a valid geopackage') || lower.includes('not a sqlite')) {
    return {
      code: 'invalid_geopackage',
      userMessage: "Le fichier ne semble pas être un GeoPackage valide.",
      technicalMessage,
    }
  }
  if (lower.includes('no layer') || lower.includes('gpkg_contents')) {
    return {
      code: 'no_layers',
      userMessage: "Aucune couche exploitable n'a été trouvée dans ce fichier.",
      technicalMessage,
    }
  }
  if (lower.includes('memory') || lower.includes('out of bounds') || lower.includes('allocation')) {
    return {
      code: 'out_of_memory',
      userMessage: "L'analyse a été interrompue faute de mémoire disponible.",
      technicalMessage,
    }
  }
  if (lower.includes('unsupported') || lower.includes('not supported') || lower.includes('unimplemented')) {
    return {
      code: 'unsupported_geometry',
      userMessage: "Cette couche utilise un format de géométrie qui n'est pas encore pris en charge.",
      technicalMessage,
    }
  }

  return {
    code: 'unknown',
    userMessage: "Une erreur inattendue est survenue pendant l'analyse de ce fichier.",
    technicalMessage,
  }
}

export const KNOWN_ERRORS: Record<string, string> = {
  invalid_extension: 'Ce format de fichier n\'est pas accepté. Seuls les fichiers .gpkg sont pris en charge.',
  empty_file: 'Le fichier sélectionné est vide.',
  file_too_large:
    'Ce fichier est trop volumineux pour être analysé correctement dans ce navigateur (limite recommandée : 50 Mo).',
  engine_unavailable:
    "Le moteur d'analyse n'a pas pu être initialisé dans ce navigateur. Réessayez ou utilisez un navigateur récent (Chrome, Edge, Firefox ou Safari).",
  invalid_geopackage: 'Le fichier ne semble pas être un GeoPackage valide.',
  no_layers: "Aucune couche exploitable n'a été trouvée dans ce fichier.",
  out_of_memory: "L'analyse a été interrompue faute de mémoire disponible.",
  unsupported_geometry: "Cette couche utilise un format de géométrie qui n'est pas encore pris en charge.",
}
