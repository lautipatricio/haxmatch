// Build de demostración: un solo JS y un solo CSS, sin fuentes locales,
// para armar la página de vista previa (scripts/make-preview.mjs).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist-demo',
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.preview.tsx',
      output: {
        format: 'iife',
        entryFileNames: 'app.js',
        assetFileNames: 'app[extname]',
        inlineDynamicImports: true,
      },
    },
  },
})
