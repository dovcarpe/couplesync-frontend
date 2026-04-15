import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://couplesync-backend-production.up.railway.app',
      '/ws': { target: 'wss://couplesync-backend-production.up.railway.app', ws: true }
    }
  }
})
