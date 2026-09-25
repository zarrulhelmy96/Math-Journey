/* MathDay online-first PWA. Never cache accounts, quiz answers, auth or payments. */
'use strict';
// Replaced with a content hash by scripts/build-site.mjs on every deployment.
const VERSION = 'mathday-pwa-v1';
const BASE = new URL('./', self.location.href);
const PREFIX = 'mathday-pwa:' + BASE.pathname + ':';
const CACHE = PREFIX + VERSION;
const STATIC_FILES = ['offline.html', 'pwa-icons/icon-192.png', 'pwa-icons/icon-512.png', 'pwa-icons/maskable-512.png', 'pwa-icons/apple-touch-icon.png'];
const STATIC_URLS = new Set(STATIC_FILES.map(file => new URL(file, BASE).href));
const OFFLINE_URL = new URL('offline.html', BASE).href;

self.addEventListener('install', event => {
  // Leave an update waiting until the user accepts it or closes all old app windows.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC_FILES.map(file => new Request(new URL(file, BASE), {cache:'reload'})))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'MATHDAY_ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Non-GET, cross-origin Firebase/ToyyibPay, API, auth and callback requests are untouched.
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (url.pathname.includes('/.netlify/') || url.pathname.includes('/__/auth/') || request.headers.has('authorization')) return;
  const appNavigation = request.mode === 'navigate' && [BASE.pathname, BASE.pathname + 'index.html'].includes(url.pathname);
  if (appNavigation) {
    event.respondWith((async () => {
      try {
        // Preserve query strings such as payment_order; never substitute cached account HTML.
        return await fetch(request, {cache:'no-store'});
      } catch {
        return await caches.match(OFFLINE_URL, {cacheName:CACHE}) || new Response('Tiada sambungan internet. Sila cuba semula.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }
  if (!url.search && STATIC_URLS.has(url.href)) {
    event.respondWith(caches.match(request, {cacheName:CACHE}).then(cached => cached || fetch(request)));
  }
});
