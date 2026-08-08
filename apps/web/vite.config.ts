import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/friends': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/chats': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/messages': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
