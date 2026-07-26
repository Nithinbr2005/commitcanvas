import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://commit-canvas-api.onrender.com',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // Ensure SPA routing works in production builds
  build: {
    outDir: 'dist',
  }
})
