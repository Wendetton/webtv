// Service Worker para a página /tv — cache offline
// Garante que a TV continue funcionando mesmo com internet instável

const CACHE_NAME = 'webtv-v1';

// Assets essenciais para o funcionamento offline
const PRECACHE_URLS = [
  '/tv',
  '/tv-ducking.js',
  '/logo.png',
];

// Install: cacheia assets essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first para HTML/JS, cache-first para imagens/assets estáticos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não interceptar requests para Firebase, YouTube ou APIs externas
  if (url.origin !== self.location.origin) return;

  // Para a página /tv e seus assets JS: network-first com fallback para cache
  if (url.pathname === '/tv' || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Salva cópia no cache para uso offline
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: retorna do cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Para imagens e outros assets: cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});
