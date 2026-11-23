const CACHE = 'tracker-v16';
const ASSETS = ['./', './index.html', './app.js', './substances-db.js', './interactions.js', './i18n.js', './i18n/keys.js', './privacy-en.html', './support-en.html', './i18n/en.js', './i18n/es.js', './i18n/fr.js', './i18n/it.js', './i18n/pt.js', './i18n/nl.js', './i18n/pl.js', './i18n/tr.js', './i18n/ru.js', './i18n/uk.js', './i18n/ar.js', './i18n/zh.js', './i18n/ja.js', './i18n/ko.js', './privacy.html', './support.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-512.png', './vendor/pdf.min.js', './vendor/pdf.worker.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Network first, fall back to cache so updates arrive but the app works offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
