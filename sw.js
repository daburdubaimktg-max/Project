/* NEE service worker: caches every app file so the app opens with no signal.
   Bump CACHE_VERSION on every release (keep it in step with APP_VERSION in app.js). */
const CACHE_VERSION = 'nee-1.4.1';

const FILES = [
  './', 'index.html', 'styles.css', 'db.js', 'export.js', 'app.js',
  'manifest.webmanifest', 'vendor/jszip.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE_VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

// The page asks the waiting worker to take over when the user taps "Update available".
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const hit = req.mode === 'navigate' ? await cache.match('index.html') : await cache.match(req, { ignoreSearch: true });
    return hit || fetch(req);
  })());
});
