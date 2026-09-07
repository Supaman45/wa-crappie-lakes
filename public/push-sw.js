/* Push handling for WA Fish Finder. Pulled into the generated service worker with importScripts. */
self.addEventListener('push', (event) => {
  let data = { title: 'WA Fish Finder', body: 'Something changed on the coast.', url: '/#plan', tag: 'wff' };
  try { data = Object.assign(data, event.data ? event.data.json() : {}); } catch (e) { try { data.body = event.data.text(); } catch (e2) { /* ignore */ } }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag,
    renotify: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/#plan' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/#plan', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
