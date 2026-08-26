import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5174,
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/uploads': { target: 'http://localhost:5050', changeOrigin: true },
      '/api': { target: 'http://localhost:5050', changeOrigin: true },
    },
  },
})
