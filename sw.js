/* Stickman Fight 3D — service worker: rete prima, copia in cache per l'offline. */
const CACHE = 'stickman-fight-3d-v7';
const scope = self.registration.scope;
const url = (p) => new URL(p, scope).href;
const SHELL = [
  './', './index.html', './style.css',
  './data.js', './audio.js', './net.js', './engine.js', './editor.js', './ads-config.js', './ui.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;

  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          const key = req.mode === 'navigate' ? url('index.html') : req;
          caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((m) => {
          if (m) return m;
          // gli script hanno un ?v= che cambia a ogni aggiornamento: offline uso la copia senza query
          const bare = new URL(req.url);
          bare.search = '';
          return caches.match(bare.href).then((b) => {
            if (b) return b;
            if (req.mode === 'navigate') return caches.match(url('index.html')).then((h) => h || caches.match(url('./')));
            return undefined;
          });
        })
      )
  );
});
