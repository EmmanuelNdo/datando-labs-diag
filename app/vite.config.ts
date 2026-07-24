import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// geolibre-wasm relies on `new URL('./geolibre-cli.wasm', import.meta.url)` /
// `new URL('geolibre_wasm_bg.wasm', import.meta.url)` to locate its wasm
// binaries at runtime. Vite's dependency pre-bundling would rewrite those
// references, so the package must be excluded from optimizeDeps (documented
// in the package's own README and confirmed during the technical spike).
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['geolibre-wasm', 'geolibre-wasm/tools'],
  },
  worker: {
    format: 'es',
  },
})
