import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'WA Fish Finder',
        short_name: 'Fish Finder',
        description: 'Washington lakes, creeks, and surf: where fish are, when to go, and what your crew caught.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0d1614',
        theme_color: '#0d1614',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: `wff-${pkg.version}`,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /(^|\.)(tile\.openstreetmap\.org|server\.arcgisonline\.com|tile\.opentopomap\.org)$/.test(url.hostname),
            handler: 'CacheFirst',
            options: { cacheName: 'tiles-v1', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts-v1', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') || /(supabase\.co|open-meteo\.com|wdfw\.wa\.gov|usgs\.gov|noaa\.gov|zippopotam\.us|openstreetmap\.org\/search)/.test(url.href) && !/tile\.openstreetmap\.org/.test(url.hostname),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', sourcemap: false },
});
