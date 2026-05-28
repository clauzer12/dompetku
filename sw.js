const CACHE_NAME = 'dompetku-v26';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/index.css',
  './css/components.css',
  './css/pages.css',
  './js/utils.js',
  './js/db.js',
  './js/wallet.js',
  './js/category.js',
  './js/transaction.js',
  './js/budget.js',
  './js/dashboard.js',
  './js/report.js',
  './js/app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found, else fetch from network
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
});
