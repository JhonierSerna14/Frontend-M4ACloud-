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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'M4A - Mis Materias, Mis Apuntes',
        short_name: 'M4A',
        description: 'Gestiona tus clases, apuntes y tareas académicas',
        theme_color: '#3b82f6',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
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
          proxy.on('error', (err, _req, _res) => {
            // Silenciar errores esperables (ECONNABORTED / ECONNRESET) para no llenar la consola
            if (err && (err as NodeJS.ErrnoException).code && ((err as NodeJS.ErrnoException).code === 'ECONNABORTED' || (err as NodeJS.ErrnoException).code === 'ECONNRESET')) return
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
