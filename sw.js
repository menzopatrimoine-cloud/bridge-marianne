/* Service worker : l'application fonctionne sans internet une fois installée */
const CACHE = 'bridge-marianne-v33';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css?v=33',
  './js/core.js?v=33', './js/bidding.js?v=33', './js/fiches-compl.js?v=33', './js/dd.js?v=33', './js/play.js?v=33', './js/sound.js?v=33', './js/persos.js?v=33', './js/analyse.js?v=33', './js/missions.js?v=33', './js/lecons-data.js?v=33', './js/lecons.js?v=33', './js/app.js?v=33',
  './fonts/AHN-500.ttf', './fonts/AHN-700.ttf', './fonts/AHN-800.ttf',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  // les fiches du cours (images), pour les ouvrir sans internet
  './fiches/f01-1.jpg?v=4', './fiches/f01-2.jpg?v=4', './fiches/f01-3.jpg?v=4', './fiches/f02-1.jpg?v=4', './fiches/f03-1.jpg?v=4',
  './fiches/f04-1.jpg?v=4', './fiches/f04-2.jpg?v=4', './fiches/f05-1.jpg?v=5', './fiches/f05-2.jpg?v=5', './fiches/f06-1.jpg?v=4', './fiches/f06-2.jpg?v=4',
  './fiches/f07-1.jpg?v=4', './fiches/f07-2.jpg?v=4', './fiches/f07-3.jpg?v=4', './fiches/f08-1.jpg?v=4', './fiches/f08-2.jpg?v=4',
  './fiches/f09-1.jpg?v=4', './fiches/f09-2.jpg?v=4', './fiches/f10-1.jpg?v=4', './fiches/f10-2.jpg?v=4', './fiches/f11-1.jpg?v=6',
  './fiches/f12-1.jpg?v=4', './fiches/f12-2.jpg?v=4', './fiches/f13-1.jpg?v=6', './fiches/f14-1.jpg?v=7', './fiches/f15-1.jpg?v=4', './fiches/f16-1.jpg?v=4', './fiches/f17-1.jpg?v=4',
  './fiches/fC1-1.jpg?v=5', './fiches/fC2-1.jpg?v=4', './fiches/fC3-1.jpg?v=4', './fiches/fC4-1.jpg?v=4', './fiches/fC5-1.jpg?v=4',
  // les mêmes fiches en PDF, à imprimer
  './fiches/pdf/cours-complet.pdf?v=6', './fiches/pdf/fiche-01.pdf?v=6', './fiches/pdf/fiche-02.pdf?v=6', './fiches/pdf/fiche-03.pdf?v=6', './fiches/pdf/fiche-04.pdf?v=6', './fiches/pdf/fiche-05.pdf?v=6', './fiches/pdf/fiche-06.pdf?v=6', './fiches/pdf/fiche-07.pdf?v=6', './fiches/pdf/fiche-08.pdf?v=6', './fiches/pdf/fiche-09.pdf?v=6', './fiches/pdf/fiche-10.pdf?v=6', './fiches/pdf/fiche-11.pdf?v=6', './fiches/pdf/fiche-12.pdf?v=6', './fiches/pdf/fiche-13.pdf?v=6', './fiches/pdf/fiche-14.pdf?v=6', './fiches/pdf/fiche-15.pdf?v=6', './fiches/pdf/fiche-16.pdf?v=6', './fiches/pdf/fiche-17.pdf?v=6',
  './fiches/pdf/fiches-complementaires.pdf?v=6', './fiches/pdf/fiche-C1.pdf?v=6', './fiches/pdf/fiche-C2.pdf?v=6', './fiches/pdf/fiche-C3.pdf?v=6', './fiches/pdf/fiche-C4.pdf?v=6', './fiches/pdf/fiche-C5.pdf?v=6',
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
  }).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));   // la page d'accueil seulement pour une page, jamais à la place d'un PDF ou d'une image
});
