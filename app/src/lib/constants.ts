/**
 * Limite indicative définie à l'issue du spike technique (docs/SPIKE.md §7).
 * Le spike n'a pu tester que jusqu'à ~2,6 Mo / 50 000 entités faute de jeux
 * de données volumineux disponibles dans l'environnement de test ; cette
 * valeur reste donc prudente et non définitive, à confirmer avant la bêta
 * avec de vrais fichiers de 20-50 Mo et ~100 Mo.
 */
export const RECOMMENDED_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 Mo

/** Nombre maximal d'entités affichées lors d'une prévisualisation cartographique. */
export const PREVIEW_MAX_FEATURES = 5000
