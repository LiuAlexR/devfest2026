import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // This disables host header checking
    // OR if you want to be specific:
    // allowedHosts: ['mysite.com', 'dev.local']
  }
})
