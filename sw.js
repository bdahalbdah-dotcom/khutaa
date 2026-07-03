// Service Worker: cache-first للعمل بدون إنترنت، مع تحديث بالإصدار

const VERSION = 'khutaa-v1';

const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'css/fonts.css',
  'js/app.js',
  'js/store.js',
  'js/engine.js',
  'js/dates.js',
  'js/ui.js',
  'js/views/today.js',
  'js/views/week.js',
  'js/views/goals.js',
  'js/views/stats.js',
  'js/views/reviews.js',
  'js/views/settings.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'fonts/cairo-arabic-400.woff2',
  'fonts/cairo-arabic-700.woff2',
  'fonts/cairo-latin-400.woff2',
  'fonts/cairo-latin-700.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((cache) =>
      // بعض الأصول (كالخطوط) اختيارية — لا نفشل التثبيت كله بسببها
      Promise.allSettled(ASSETS.map((a) => cache.add(a)))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
