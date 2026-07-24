/**
 * Traduction pédagogique des codes de problème renvoyés par
 * repair_geometry --check_only (champ "problem_code" du GeoJSON annoté).
 * Codes vérifiés lors du spike technique (docs/SPIKE.md §5). Si un code
 * inconnu apparaît, on affiche le code d'origine avec un libellé générique
 * (voir §13 du cahier des charges : ne jamais inventer de traduction).
 */
export const ISSUE_LABELS: Record<string, { label: string; description: string }> = {
  ok: {
    label: 'Aucun problème',
    description: 'Aucune anomalie détectée sur cette géométrie.',
  },
  null_empty: {
    label: 'Géométrie nulle ou vide',
    description: "Cette entité n'a pas de géométrie exploitable (champ vide ou géométrie sans coordonnées).",
  },
  self_intersection: {
    label: 'Auto-intersection',
    description: 'Une partie du polygone croise une autre partie de sa propre géométrie.',
  },
  ring_orientation: {
    label: 'Orientation des anneaux incorrecte',
    description:
      "L'ordre des sommets d'un anneau (contour extérieur ou trou) ne respecte pas la convention attendue.",
  },
  duplicate_vertex: {
    label: 'Sommets dupliqués',
    description: 'La géométrie contient des points consécutifs identiques.',
  },
}

export function describeIssueCode(code: string): { label: string; description?: string } {
  const known = ISSUE_LABELS[code]
  if (known) return known
  return { label: code }
}
