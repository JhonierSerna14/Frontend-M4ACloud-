import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'M4A - Mis Materias, Mis Apuntes',
        short_name: 'M4A',
        description: 'Gestiona tus clases, apuntes y tareas académicas',
        lang: 'es',
        theme_color: '#3b82f6',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'audio',
                accept: ['audio/*', '.m4a', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
              }
            ]
          }
        },
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2,webmanifest}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
        // Evitar trazas ruidosas cuando el socket se aborta o el backend cierra la conexión
        configure: (proxy, _options) => {
          let lastConnRefusedLogAt = 0
          proxy.on('error', (err, _req, _res) => {
            const code = err && (err as NodeJS.ErrnoException).code
            // Silenciar errores esperables (ECONNABORTED / ECONNRESET) para no llenar la consola
            if (code && (code === 'ECONNABORTED' || code === 'ECONNRESET')) return
            // Throttle de ECONNREFUSED: mostrar una vez cada 10s en lugar de spamear por request/ws
            if (code === 'ECONNREFUSED') {
              const now = Date.now()
              if (now - lastConnRefusedLogAt < 10000) return
              lastConnRefusedLogAt = now
            }
            // Loguear el resto para facilitar depuración
            // eslint-disable-next-line no-console
            console.error('vite proxy error:', err && err.stack ? err.stack : err)
          })
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            // Evitar que errores en el socket del proxy provoquen una excepción global
            socket.on('error', () => {})
          })
        },
        rewrite: (path) => path.replace(/^\/api/, '/api/v1')
      }
    }
  }
})
