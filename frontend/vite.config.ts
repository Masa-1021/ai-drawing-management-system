import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // すべてのネットワークインターフェースで接続を受け付ける
    port: 5175,
    allowedHosts: ['localhost', 'cad-frontend-dev'], // テスト用にDockerホスト名を許可
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true
      },
      '/storage': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true
      },
      '/ws': {
        target: process.env.VITE_WS_PROXY_TARGET || 'ws://localhost:8000',
        ws: true
      }
    }
  }
})
