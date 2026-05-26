// ============================================================
// SERVICE WORKER — Le Plan de la Baraka PWA
// Stratégie : Cache-First pour les assets locaux,
//             Network-First pour les CDN externes
// ============================================================

const CACHE_NAME = 'baraka-pwa-v2';
const CACHE_CDN = 'baraka-cdn-v1';

// Assets locaux à mettre en cache immédiatement
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// URLs CDN à mettre en cache après premier chargement
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Nunito:wght@300;400;600;700;800&display=swap',
];

// ---- INSTALL : mise en cache des assets locaux ----
self.addEventListener('install', event => {
  console.log('[SW] Install — mise en cache des assets locaux');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(LOCAL_ASSETS);
    }).then(() => {
      console.log('[SW] Assets locaux mis en cache');
      return self.skipWaiting(); // Activer immédiatement
    })
  );
});

// ---- ACTIVATE : nettoyage des anciens caches ----
self.addEventListener('activate', event => {
  console.log('[SW] Activate — nettoyage anciens caches');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== CACHE_CDN)
          .map(key => {
            console.log('[SW] Suppression cache obsolète :', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ---- FETCH : stratégie de cache intelligente ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer les extensions Chrome internes
  if (url.protocol === 'chrome-extension:') return;

  // Stratégie pour les fonts Google (Cache-First)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event.request, CACHE_CDN));
    return;
  }

  // Stratégie pour CDN (Cache-First après premier chargement)
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(event.request, CACHE_CDN));
    return;
  }

  // Stratégie pour les assets locaux (Cache-First avec fallback réseau)
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // Tout le reste : Network-First
  event.respondWith(networkFirst(event.request));
});

// ---- Cache-First : retourne le cache, sinon réseau + mise en cache ----
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Hors ligne et pas en cache — retourner la page principale
    if (request.destination === 'document') {
      return caches.match('./index.html');
    }
    throw err;
  }
}

// ---- Network-First : réseau d'abord, cache en fallback ----
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

// ---- Message : forcer la mise à jour ----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
