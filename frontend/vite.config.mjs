import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwind()],
  base: './',
  server: {
    proxy: {
      // change this target to your backend dev URL
      '/api': {
        target: 'http://localhost:3001', 
        changeOrigin: true,
        // optional if your backend lives at /api already:
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
