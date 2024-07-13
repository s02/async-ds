import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./lib/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {},
  },
  target: 'esnext',
  plugins: [dts({ exclude: '**/*.test.ts' })],
})
