/* Granja Ercilia — service worker
   Objetivo: que la app abra rápido y sin internet, pero SIN quedarse pegada
   en una versión vieja.
   - El HTML (index.html) siempre se pide primero a internet.
   - Las imágenes/íconos se guardan y se refrescan solos.
   - Al activarse una versión nueva, borra las cachés viejas y recarga la app. */

const VERSION = 'granja-ercilia-v4-2026-11-25';
const CACHE = VERSION;
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(ARCHIVOS.map((url) => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    const habiaViejas = claves.some((k) => k !== CACHE);
    await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    /* Si veníamos de una caché vieja, recargamos una vez para mostrar la versión nueva. */
    if (habiaViejas) {
      const ventanas = await self.clients.matchAll({ type: 'window' });
      ventanas.forEach((w) => { try { w.navigate(w.url); } catch (e) {} });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  /* Firebase, fuentes y librerías externas: siempre directo a internet. */
  if (url.origin !== self.location.origin) return;

  const esHTML = req.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (esHTML) {
    /* Primero la red (sin caché del navegador); si no hay internet, la copia guardada. */
    event.respondWith((async () => {
      try {
        const fresco = await fetch(req, { cache: 'no-store' });
        const copia = fresco.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copia)).catch(() => null);
        return fresco;
      } catch (e) {
        const guardado = await caches.match(req) || await caches.match('./index.html');
        return guardado || Response.error();
      }
    })());
    return;
  }

  /* Íconos, manifest, etc.: se responde de la caché y se actualiza de fondo. */
  event.respondWith((async () => {
    const guardado = await caches.match(req);
    const red = fetch(req).then((r) => {
      if (r && r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone())).catch(() => null);
      return r;
    }).catch(() => null);
    return guardado || (await red) || Response.error();
  })());
});
