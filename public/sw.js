// Service worker : rend le site installable et jouable hors ligne (mode contre les bots).
// Les appels à Supabase (jeu en ligne, vocal) ne passent jamais par le cache.
const CACHE = 'belote-v1';
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "favicon.svg",
  "icons/icone-192.png",
  "icons/icone-512.png",
  "icons/apple-touch-icon.png",
  "cartes/7-pique.webp",
  "cartes/7-coeur.webp",
  "cartes/7-carreau.webp",
  "cartes/7-trefle.webp",
  "cartes/8-pique.webp",
  "cartes/8-coeur.webp",
  "cartes/8-carreau.webp",
  "cartes/8-trefle.webp",
  "cartes/9-pique.webp",
  "cartes/9-coeur.webp",
  "cartes/9-carreau.webp",
  "cartes/9-trefle.webp",
  "cartes/10-pique.webp",
  "cartes/10-coeur.webp",
  "cartes/10-carreau.webp",
  "cartes/10-trefle.webp",
  "cartes/V-pique.webp",
  "cartes/V-coeur.webp",
  "cartes/V-carreau.webp",
  "cartes/V-trefle.webp",
  "cartes/D-pique.webp",
  "cartes/D-coeur.webp",
  "cartes/D-carreau.webp",
  "cartes/D-trefle.webp",
  "cartes/R-pique.webp",
  "cartes/R-coeur.webp",
  "cartes/R-carreau.webp",
  "cartes/R-trefle.webp",
  "cartes/A-pique.webp",
  "cartes/A-coeur.webp",
  "cartes/A-carreau.webp",
  "cartes/A-trefle.webp",
  "cartes/dos.webp"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages : le réseau d'abord (toujours la dernière version), le cache si hors ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('index.html', copy));
          return response;
        })
        .catch(() => caches.match('index.html')),
    );
    return;
  }

  // Fichiers du site (noms uniques à chaque version) et cartes : le cache d'abord.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
