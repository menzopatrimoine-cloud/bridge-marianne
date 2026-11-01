/* Service worker : l'application fonctionne sans internet une fois installée */
const CACHE = 'bridge-marianne-v2';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css?v=2',
  './js/core.js?v=2', './js/bidding.js?v=2', './js/dd.js?v=2', './js/play.js?v=2', './js/sound.js?v=2', './js/app.js?v=2',
  './fonts/AHN-500.ttf', './fonts/AHN-700.ttf', './fonts/AHN-800.ttf',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
    const copy = resp.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return resp;
  }).catch(() => caches.match('./index.html'))));
});
