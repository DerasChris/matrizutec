import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const esOnPremise = mode === 'onpremise'

  return {
    plugins: [react()],
    base: esOnPremise ? '/laboratorios/' : '/',
    build: {
      outDir: esOnPremise ? 'dist-onpremise' : 'dist',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      open: true,
    },
  }
})
