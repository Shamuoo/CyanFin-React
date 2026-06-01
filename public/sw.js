// CyanFin Service Worker v0.19.4
const CACHE = 'cyanfin-v1';

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE)));
self.addEventListener('activate', e => { self.clients.claim(); });

// Push notifications
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'CyanFin', body: e.data.text() }; }
  const opts = {
    body:    data.body || '',
    icon:    '/favicon.svg',
    badge:   '/favicon.svg',
    tag:     data.tag || 'cyanfin',
    data:    data.url ? { url: data.url } : {},
    actions: data.url ? [{ action: 'open', title: 'View' }] : [],
  };
  e.waitUntil(self.registration.showNotification(data.title || 'CyanFin', opts));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.openWindow(url));
});
