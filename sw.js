const CACHE = 'coach-sandra-v2';
const ASSETS = [
  './coach_sandra.html',
  './manifest.json',
  './icon-192.png?v=2',
  './icon-512.png?v=2',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Ne jamais cacher les appels Firestore/Auth (temps réel)
  if (url.includes('firestore.googleapis.com') || url.includes('identitytoolkit') || url.includes('googleapis.com')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copy = resp.clone();
      if (e.request.method === 'GET') caches.open(CACHE).then(c => c.put(e.request, copy).catch(()=>{}));
      return resp;
    }).catch(()=>r))
  );
});
