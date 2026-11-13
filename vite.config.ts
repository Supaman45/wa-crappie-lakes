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
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'push-sw.js'],
      manifest: {
        name: 'PNW Fish Camp',
        short_name: 'Fish Camp',
        description: 'Washington and Oregon lakes, creeks, surf and camps: where fish are, where to camp, when to go.',
        start_url: '/#lakes',
        id: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#eaf1f5',
        theme_color: '#0e5f82',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: `wff-${pkg.version}`,
        importScripts: ['push-sw.js'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /(^|\.)(tile\.openstreetmap\.org|server\.arcgisonline\.com|tile\.opentopomap\.org|basemap\.nationalmap\.gov)$/.test(url.hostname),
            handler: 'CacheFirst',
            options: { cacheName: 'tiles-v1', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts-v1', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') || /(overpass|fs\.usda\.gov)/.test(url.hostname) || /(supabase\.co|open-meteo\.com|wdfw\.wa\.gov|usgs\.gov|noaa\.gov|zippopotam\.us|openstreetmap\.org\/search)/.test(url.href) && !/tile\.openstreetmap\.org/.test(url.hostname),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Libraries change rarely, so they get their own long-cached chunks
        // and a deploy only re-downloads the app code that changed.
        manualChunks(id: string) {
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (id.includes('@supabase')) return 'supabase';
          if (/node_modules[\\/](leaflet|leaflet\.markercluster)[\\/]/.test(id)) return 'map';
          if (/node_modules[\\/](dexie|zustand)[\\/]/.test(id)) return 'storage';
          // Lake lists change on their own schedule (Oregon refreshes monthly); keep them out of the app chunk.
          if (/src[\\/]data[\\/]lakes(-or)?\.json/.test(id)) return 'lakes';
          return undefined;
        },
      },
    },
  },
});
