// Crappie Lakes offline worker. Caches the app shell and map tiles you have viewed.
var CACHE = 'crappie-v1';
var TILE_HOSTS = ['tile.openstreetmap.org','basemaps.cartocdn.com','server.arcgisonline.com','tile.opentopomap.org'];
var SHELL = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(SHELL.map(function(u){ return c.add(u).catch(function(){}); }));
  }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isTile(url){ return TILE_HOSTS.some(function(h){ return url.hostname.endsWith(h); }); }

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  // Map tiles: cache-first, store as you pan so areas you have seen work offline.
  if(isTile(url)){
    e.respondWith(caches.open(CACHE).then(function(c){
      return c.match(e.request).then(function(hit){
        if(hit) return hit;
        return fetch(e.request).then(function(res){
          if(res && (res.ok || res.type==='opaque')) c.put(e.request, res.clone());
          return res;
        }).catch(function(){ return hit; });
      });
    }));
    return;
  }

  // App shell and same-origin: cache-first, fall back to network.
  if(url.origin === self.location.origin || SHELL.indexOf(e.request.url) !== -1){
    e.respondWith(caches.match(e.request).then(function(hit){
      return hit || fetch(e.request).then(function(res){
        if(res && res.ok && (url.origin===self.location.origin)){
          var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      });
    }));
  }
  // Everything else (Supabase API, ArcGIS launches, Open-Meteo, geocoders): network only.
});
