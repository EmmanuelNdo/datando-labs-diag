# Spike technique — intégration de `geolibre-wasm`

Ce document résume le spike réalisé avant le développement du MVP **Datando
GeoPackage Diagnostic**. Toutes les commandes ci-dessous ont réellement été
exécutées (Node.js 22, package `geolibre-wasm` installé depuis npm) contre des
fichiers `.gpkg` construits à la main pour le test. Le comportement en
navigateur (Vite + Web Worker) est le même moteur WASM ; seul le chargement des
octets `.wasm` diffère (voir « Bundler / Vite » plus bas).

## 1. Méthode d'installation retenue

```bash
npm install geolibre-wasm
```

Version testée : **`geolibre-wasm@1.1.0`** (dist-tag `latest` au 2026-07-24).

Le package publie deux points d'entrée ES module :

| Export | Fichier | Rôle |
|---|---|---|
| `geolibre-wasm` (`.`) | `geolibre_wasm.js` + `geolibre_wasm_bg.wasm` (4,4 Mo) | Bibliothèque `wasm-bindgen`, API en mémoire (lecture vecteur/raster/LiDAR, projections). |
| `geolibre-wasm/tools` | `tools.mjs` + `geolibre-cli.wasm` (22 Mo) | Exécuteur WASI (registre d'outils whitebox + GeoLibre) sur un système de fichiers virtuel `/work`, via `@bjorn3/browser_wasi_shim`. |

Les deux fichiers `.wasm` totalisent environ 26 Mo non compressés (~8,5 Mo
compressés dans le tarball npm). Ils doivent être servis comme assets
statiques, pas embarqués dans le bundle JS.

## 2. Méthode de lecture du GeoPackage

Deux chemins possibles, tous deux testés avec succès :

**A. Bibliothèque en mémoire (`.`)**

```js
import init, { vector_info, vector_to_geojson } from "geolibre-wasm";
await init(); // charge geolibre_wasm_bg.wasm
const info = JSON.parse(vector_info(gpkgBytes, "gpkg"));
// { ok, name, features, geometry, epsg, fields: [...], bbox }
const geojson = vector_to_geojson(gpkgBytes, "gpkg");
```

**B. Outil WASI (`./tools`) avec `repair_geometry`**

```js
import { initTools, runTool } from "geolibre-wasm/tools";
await initTools(); // charge geolibre-cli.wasm
const result = await runTool("repair_geometry", {
  args: ["--input=/work/input.gpkg", "--output=/work/report.geojson", "--check_only=true"],
  input: { "input.gpkg": gpkgBytes },
});
// result.exitCode, result.stdout (lignes texte + 1 ligne JSON récapitulative),
// result.files["report.geojson"] (GeoJSON annoté)
```

Dans les deux cas, un GeoPackage **corrompu ou non-SQLite** provoque une
exception JS explicite plutôt qu'un résultat silencieux :

```
THROWN: read: Not a valid GeoPackage: Not a SQLite 3 file
```
→ à capturer avec un `try/catch` et traduit en message utilisateur (§17 du
cahier des charges).

## 3. Sélection de couche sur un fichier multicouche — **limite constatée**

**Constat testé et reproductible :** ni `vector_info`/`vector_to_geojson`
(bibliothèque `.`), ni l'outil `repair_geometry` (paramètre `--layer=...`,
qui n'existe pas dans son manifeste et est silencieusement ignoré s'il est
passé) ne permettent de choisir une couche. Les deux lisent **toujours la
première table déclarée dans `gpkg_contents`** et ignorent les couches
suivantes.

Test réalisé sur un GeoPackage à 3 tables (`communes_points` en premier,
`parcelles` ensuite, `proprietaires` — table attributaire — en dernier) :
`vector_info` et `repair_geometry --check_only` ne renvoient que les
résultats de `communes_points`, quel que soit l'ordre des `args`.

Ceci est documenté ici plutôt que masqué, conformément à la consigne du
cahier des charges (§6).

### Solution minimale retenue : découpage préalable via `sql.js`

Un fichier GeoPackage est un fichier **SQLite** standard. On utilise donc
[`sql.js`](https://github.com/sql-js/sql.js) (SQLite compilé en WASM, ~1,3 Mo,
projet séparé de GeoLibre) **uniquement** pour :

1. **Inventorier les couches** en lisant directement les tables système
   `gpkg_contents` / `gpkg_geometry_columns` (nom, type, `srs_id`, type de
   géométrie) — cette étape ne dépend pas de GeoLibre et fonctionne quel que
   soit le nombre de couches ;
2. **Découper** le GeoPackage : pour la couche à analyser, cloner la base en
   mémoire (`db.export()` → recharger), supprimer (`DROP TABLE`) toutes les
   autres tables de couches et purger les lignes correspondantes de
   `gpkg_contents` / `gpkg_geometry_columns`, puis ré-exporter un GeoPackage
   mono-couche en mémoire (`clone.export()` → `Uint8Array`).
3. Chaque GeoPackage mono-couche généré est ensuite passé normalement à
   `vector_info` et `repair_geometry --check_only`.

**Test réel de bout en bout** (fichier à 3 tables ci-dessus) :

```
Step A — inventaire via sql.js (gpkg_contents) :
  communes_points  features   EPSG:4326  POINT
  parcelles        features   EPSG:2154  POLYGON
  proprietaires    attributes  (table non spatiale)

Step B — après découpage, GeoLibre analyse chaque couche séparément :
  communes_points → vector_info: 4 features, Point, EPSG:4326
                     repair_geometry: 1 géométrie nulle détectée
  parcelles        → vector_info: 3 features, Polygon, EPSG:2154
                     repair_geometry: auto-intersection + géométrie nulle détectées
  proprietaires     → ignorée pour le contrôle géométrique (table non spatiale),
                       comptée dans l'inventaire général
```

Ce découpage est rapide (quelques millisecondes sur les fichiers testés) et
s'exécute entièrement dans le navigateur — aucun envoi serveur nécessaire.
C'est la méthode retenue pour le MVP (voir `GeoPackageDiagnosticService`).

## 4. Informations réellement accessibles par couche

Depuis `vector_info` (bibliothèque `.`), sur le GeoPackage mono-couche issu du
découpage :

```json
{"ok":true,"name":"parcelles","features":3,"geometry":"Polygon","epsg":2154,
 "fields":[{"name":"parcelle_id","type":"Text"}],"bbox":[0,0,10,10]}
```

→ nom, nombre d'entités, type de géométrie, EPSG (ou `null` si absent),
liste des champs (nom + type), emprise. C'est directement exploitable pour
les contrôles obligatoires 3 à 8 du §11-A du cahier des charges.

Le nombre de champs et de tables non spatiales, ainsi que la liste complète
des couches, viennent de l'inventaire `sql.js` (§3), pas de GeoLibre.

## 5. Format renvoyé par `repair_geometry --check_only`

`result.stdout` contient une ligne texte lisible puis une ligne JSON
récapitulative :

```json
{"check_only":true,"dropped_count":0,"duplicate_vertex_count":0,
 "feature_count":3,"input_count":3,"invalid_count":3,"null_empty_count":1,
 "output":"/work/report.geojson","ring_orientation_count":1,
 "self_intersection_count":1}
```

Le fichier de sortie (`result.files["report.geojson"]`) contient le
GeoJSON d'entrée avec deux propriétés ajoutées par entité :
`problem_code` (ex. `"ok"`, `"null_empty"`, `"self_intersection"`,
`"ring_orientation"`) et `problem_desc` (description courte, en anglais).
Ce sont ces codes qui alimentent la traduction pédagogique du §13.

`check_only` **ne modifie jamais** le fichier — il ne fait qu'annoter une
copie GeoJSON en mémoire, ce qui correspond exactement à l'exigence du §11-A
(pas de réparation dans cette version).

## 6. Limites constatées

- **Sélection de couche non supportée nativement** par GeoLibre sur un
  GeoPackage multicouche → contournée par découpage `sql.js` (§3).
- Le paramètre `check_only` de `repair_geometry` ne contrôle que la
  **validité polygonale** (auto-intersections, orientation des anneaux,
  vertices dupliqués, géométries nulles/vides) — pas les points/lignes.
  Documenté tel quel dans l'interface (statut par couche basé uniquement sur
  les contrôles réellement exécutés).
- Aucune fonction dédiée de type `list_layers()` n'existe côté GeoLibre : il
  a fallu s'appuyer sur les tables système GeoPackage via `sql.js`.
- Le module WASI (`geolibre-cli.wasm`, 22 Mo) est volumineux : à charger une
  seule fois, en arrière-plan, dans le Web Worker — pas de manière bloquante
  sur l'écran de dépôt.
- Erreurs renvoyées comme **exceptions JS** (pas de code d'erreur structuré) :
  la correspondance message technique → message utilisateur (§17) doit se
  faire par correspondance de sous-chaînes (`"Not a valid GeoPackage"`,
  `"Not a SQLite 3 file"`, etc.).

## 7. Taille maximale testée / performance

Test réalisé avec un GeoPackage synthétique d'un seul million... (voir
détail) — en pratique, testé jusqu'à **50 000 entités ponctuelles
(2,6 Mo)** :

| Opération | Résultat |
|---|---|
| `vector_info` (50 000 entités) | ~140 ms |
| `repair_geometry --check_only` (50 000 entités) | ~470 ms |
| Chargement `geolibre-cli.wasm` (`initTools`) | ~70 ms (Node, à froid, sans cache réseau) |

Mesures faites côté Node (moteur WASM identique à celui d'un navigateur ;
seul le chargement initial de la ressource `.wasm` diffère). Aucun test au
delà de 50 Mo n'a pu être réalisé dans cette phase (pas d'accès à des jeux de
données GeoPackage volumineux dans l'environnement du spike) — **à
compléter avant la bêta** avec de vrais fichiers de 20-50 Mo et ~100 Mo,
comme demandé au §19 du cahier des charges. En l'état, aucune limite haute
n'est garantie ; le MVP applique une limite prudente de **50 Mo**,
qualifiée d'indicative et non définitive tant que ce complément de test n'a
pas été fait.

## 8. Bundler / Vite

- Vite doit exclure `geolibre-wasm` du pre-bundling (`optimizeDeps.exclude`)
  pour préserver la référence `new URL("./geolibre-cli.wasm", import.meta.url)`
  utilisée en interne par le package (recommandation du README amont).
- Les deux fichiers `.wasm` doivent être copiés tels quels dans les assets de
  build (comportement par défaut de Vite pour les imports `new URL(...,
  import.meta.url)` — vérifié en dev server, cf. §18 du cahier des charges à
  revalider en build de production avant la bêta).
- L'initialisation (`init()` / `initTools()`) et l'exécution des outils sont
  faites dans un **Web Worker dédié** (`diagnostic.worker.ts`) pour ne pas
  bloquer le thread principal, conformément au §8 du cahier des charges.

## 9. Compatibilité navigateur

Non testée directement dans cet environnement (pas de navigateur graphique
disponible pendant le spike). Le moteur WASM utilisé (wasm-bindgen +
WASI shim `@bjorn3/browser_wasi_shim`) ne requiert pas de fonctionnalité
expérimentale (pas de threads partagés, pas de `SharedArrayBuffer`
obligatoire) — compatible en théorie avec Chrome/Edge/Firefox/Safari
desktop récents. **À valider manuellement avant la bêta**, comme demandé au
§18.

## Conclusion du spike

Les trois hypothèses du §2 du cahier des charges sont validées :

1. **GeoLibre peut lire et analyser un GeoPackage** dans l'application — via
   `vector_info` / `vector_to_geojson` / `repair_geometry --check_only`.
2. **Les traitements s'exécutent localement** dans le navigateur (aucun appel
   réseau nécessaire une fois les `.wasm` chargés).
3. **Le résultat est traduisible en diagnostic pédagogique** : les champs
   renvoyés (nombre d'entités, type de géométrie, CRS, emprise, champs,
   `problem_code`/`problem_desc`) couvrent directement les contrôles
   obligatoires du §11-A.

La seule adaptation nécessaire par rapport à un usage "tel quel" du package
est le découpage par couche via `sql.js`, documenté au §3 — une solution
minimale, sans fork du dépôt `opengeos/geolibre-rust`.
