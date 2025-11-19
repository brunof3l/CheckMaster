import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Base para deploy em GitHub Pages (project page)
  // Permite override via VITE_BASE_PATH quando usar domínio próprio
  base: process.env.VITE_BASE_PATH || '/CheckMaster/',
  server: {
    cors: {
      // Permite apenas origens do app durante desenvolvimento
      origin: (process.env.VITE_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174')
        .split(',')
        .map(o => o.trim())
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'CheckMaster',
        short_name: 'CheckMaster',
        start_url: '/',
        display: 'standalone',
        background_color: '#0B1324',
        theme_color: '#0B1324',
        lang: 'pt-BR',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /.*\.(?:png|jpg|jpeg|svg|gif)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ]
});