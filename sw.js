/* Menyimpan halaman & pembaca QR di HP supaya aplikasi tetap terbuka
   walau sinyal hilang total. Panggilan ke server TIDAK PERNAH di-cache. */
var CACHE = 'gudang-teknik-v2';
var ISI = ['./', './scanner.html', './html5-qrcode.min.js', './manifest.json'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ISI.map(function (u) {
      return c.add(u).catch(function () {});
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (n) { return n !== CACHE; })
                        .map(function (n) { return caches.delete(n); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('script.google') > -1) return;   // API selalu langsung

  e.respondWith(
    caches.match(e.request).then(function (tembolok) {
      var jaringan = fetch(e.request).then(function (r) {
        if (r && r.status === 200) {
          var salin = r.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, salin); });
        }
        return r;
      }).catch(function () { return tembolok; });
      return tembolok || jaringan;
    })
  );
});
