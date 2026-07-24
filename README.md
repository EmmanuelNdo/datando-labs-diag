# datando-labs-diag

**Datando GeoPackage Diagnostic** — MVP Datando Labs. Déposez un GeoPackage,
obtenez en quelques secondes un premier état des lieux de son contenu et de
sa qualité, entièrement dans le navigateur.

- [`app/`](app) — application (Vite + React + TypeScript + `geolibre-wasm`).
- [`docs/SPIKE.md`](docs/SPIKE.md) — spike technique : intégration de
  `geolibre-wasm`, limite constatée sur les GeoPackage multicouches et
  solution retenue, mesures de performance.

```bash
cd app
npm install
npm run dev
```