/* WA Crappie Lakes service worker */
const VERSION = 'crappie-v2.1.0';
const SHELL_CACHE = 'shell-' + VERSION;
const RUNTIME_CACHE = 'runtime-' + VERSION;
const TILE_CACHE = 'tiles-v1';
const TILE_MAX = 450;

const SHELL = ['/', 'manifest.json', 'icon-192.png', 'icon-512.png'];

const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const TILE_HOSTS = ['tile.openstreetmap.org', 'basemaps.cartocdn.com', 'server.arcgisonline.com', 'tile.opentopomap.org'];
// Live data that must never be served stale: Supabase, weather, WDFW launches, geocoders.
const BYPASS_HOSTS = ['supabase.co', 'supabase.in', 'api.open-meteo.com', 'geodataservices.wdfw.wa.gov', 'api.zippopotam.us', 'nominatim.openstreetmap.org'];

function hostMatch(hostname, list) {
  return list.some(h => hostname === h || hostname.endsWith('.' + h));
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (hostMatch(url.hostname, BYPASS_HOSTS)) return; // always live

  // App shell: network first so deploys land immediately, cache fallback for offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put('/', copy));
        return res;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  // Map tiles: cache first with a hard cap, so panned areas keep working offline.
  if (hostMatch(url.hostname, TILE_HOSTS)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(TILE_CACHE).then(c => c.put(req, copy)).then(() => trimCache(TILE_CACHE, TILE_MAX));
        }
        return res;
      }))
    );
    return;
  }

  // CDN libraries and fonts: cache first, refresh in the background.
  if (hostMatch(url.hostname, CDN_HOSTS) || url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
