/* Service worker : l'application fonctionne sans internet une fois installée */
const CACHE = 'bridge-marianne-v20';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css?v=20',
  './js/core.js?v=20', './js/bidding.js?v=20', './js/dd.js?v=20', './js/play.js?v=20', './js/sound.js?v=20', './js/persos.js?v=20', './js/analyse.js?v=20', './js/missions.js?v=20', './js/lecons-data.js?v=20', './js/lecons.js?v=20', './js/app.js?v=20',
  './fonts/AHN-500.ttf', './fonts/AHN-700.ttf', './fonts/AHN-800.ttf',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  // les fiches du cours (images), pour les ouvrir sans internet
  './fiches/f01-1.jpg?v=4', './fiches/f01-2.jpg?v=4', './fiches/f01-3.jpg?v=4', './fiches/f02-1.jpg?v=4', './fiches/f03-1.jpg?v=4',
  './fiches/f04-1.jpg?v=4', './fiches/f04-2.jpg?v=4', './fiches/f05-1.jpg?v=5', './fiches/f05-2.jpg?v=5', './fiches/f06-1.jpg?v=4', './fiches/f06-2.jpg?v=4',
  './fiches/f07-1.jpg?v=4', './fiches/f07-2.jpg?v=4', './fiches/f07-3.jpg?v=4', './fiches/f08-1.jpg?v=4', './fiches/f08-2.jpg?v=4',
  './fiches/f09-1.jpg?v=4', './fiches/f09-2.jpg?v=4', './fiches/f10-1.jpg?v=4', './fiches/f10-2.jpg?v=4', './fiches/f11-1.jpg?v=5',
  './fiches/f11-2.jpg?v=5', './fiches/f12-1.jpg?v=4', './fiches/f12-2.jpg?v=4', './fiches/f13-1.jpg?v=5', './fiches/f13-2.jpg?v=5', './fiches/f14-1.jpg?v=6', './fiches/f14-2.jpg?v=6', './fiches/f14-3.jpg?v=6', './fiches/f15-1.jpg?v=4', './fiches/f16-1.jpg?v=4', './fiches/f17-1.jpg?v=4',
  // les mêmes fiches en PDF, à imprimer
  './fiches/pdf/cours-complet.pdf?v=4', './fiches/pdf/fiche-01.pdf?v=4', './fiches/pdf/fiche-02.pdf?v=4', './fiches/pdf/fiche-03.pdf?v=4', './fiches/pdf/fiche-04.pdf?v=4', './fiches/pdf/fiche-05.pdf?v=4', './fiches/pdf/fiche-06.pdf?v=4', './fiches/pdf/fiche-07.pdf?v=4', './fiches/pdf/fiche-08.pdf?v=4', './fiches/pdf/fiche-09.pdf?v=4', './fiches/pdf/fiche-10.pdf?v=4', './fiches/pdf/fiche-11.pdf?v=4', './fiches/pdf/fiche-12.pdf?v=4', './fiches/pdf/fiche-13.pdf?v=4', './fiches/pdf/fiche-14.pdf?v=4', './fiches/pdf/fiche-15.pdf?v=4', './fiches/pdf/fiche-16.pdf?v=4', './fiches/pdf/fiche-17.pdf?v=4',
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
