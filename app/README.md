# Datando GeoPackage Diagnostic

MVP Datando Labs : déposez un fichier GeoPackage et obtenez en quelques
secondes un premier état des lieux de son contenu et de sa qualité — sans
QGIS, sans envoyer le fichier sur un serveur.

Prédiagnostic rapide, pas un contrôle qualité complet ni une certification.

Voir [`docs/SPIKE.md`](../docs/SPIKE.md) à la racine du dépôt pour le détail
du spike technique (installation de `geolibre-wasm`, limite constatée sur les
GeoPackage multicouches, solution retenue, mesures de performance).

## Stack

- Vite + React + TypeScript
- [`geolibre-wasm`](https://www.npmjs.com/package/geolibre-wasm) — lecture
  vecteur (`vector_info`, `vector_to_geojson`) et contrôle géométrique
  (`repair_geometry --check_only`), exécutés dans un Web Worker.
- [`sql.js`](https://github.com/sql-js/sql.js) — inventaire des couches d'un
  GeoPackage (lecture directe des tables système `gpkg_contents` /
  `gpkg_geometry_columns`) et découpage en GeoPackage mono-couche avant
  passage à GeoLibre (voir `docs/SPIKE.md` §3).

## Structure

```
src/
  lib/
    geopackageDiagnosticService.ts  # seule couche qui appelle GeoLibre/sql.js
    diagnosticClient.ts             # côté thread principal : possède le Worker
    types.ts                        # schéma normalisé du diagnostic
    errorMessages.ts                # correspondance erreurs techniques → messages lisibles
    issueLabels.ts                  # traduction pédagogique des codes d'anomalie
  worker/
    diagnostic.worker.ts            # exécute GeoPackageDiagnosticService hors du thread principal
  components/                       # écrans (dépôt, analyse, synthèse) et fiches par couche
```

## Développement

```bash
npm install
npm run dev
```

En développement comme en production, `geolibre-wasm` doit rester exclu du
pre-bundling Vite (`optimizeDeps.exclude`, voir `vite.config.ts`) pour que ses
références internes vers `geolibre-cli.wasm` / `geolibre_wasm_bg.wasm`
restent valides. Les binaires `sql-wasm*.wasm` de `sql.js` sont copiés dans
`public/` pour la même raison (résolution d'URL à l'exécution).

```bash
npm run build    # tsc -b && vite build
npm run preview  # sert le build de production
```

## Hors périmètre de ce MVP

Pas de compte utilisateur, pas de stockage permanent, pas de réparation
automatique, pas d'export PDF, pas de comparaison de fichiers, pas de
traitement raster. Voir le cahier des charges pour le détail.
