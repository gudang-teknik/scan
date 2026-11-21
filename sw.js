/* 1. VERSI */
var VERSI = 'v76';
var CACHE = 'gudang-teknik-' + VERSI;

/* 2. PASANG DAN AKTIFKAN */
self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (n) { return n !== CACHE; })
                        .map(function (n) { return caches.delete(n); }));
  }));
  self.clients.claim();
});

/* 3. SIMPAN HALAMAN DI HP */
function halaman(req) {
  return req.mode === 'navigate' ||
         req.destination === 'document' ||
         req.url.indexOf('.html') > -1;
}

function simpan(req, res) {
  if (!res || res.status !== 200 || res.type === 'opaque') return res;
  var salin = res.clone();
  caches.open(CACHE).then(function (c) { c.put(req, salin); });
  return res;
}

self.addEventListener('message', function (e) {
  if (!e.data || !e.data.simpan) return;
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.add(e.data.simpan); })
      .then(function () { if (e.source) e.source.postMessage({ tersimpan: true }); })
      .catch(function () {})
  );
});

/* 4. AMBIL HALAMAN DAN ASET */
var BATAS_MS = 3000;

function ambilHalaman(req) {
  return new Promise(function (selesai, gagal) {
    var lewat = setTimeout(function () { gagal(new Error('lambat')); }, BATAS_MS);
    fetch(req).then(
      function (r)  { clearTimeout(lewat); selesai(simpan(req, r)); },
      function (er) { clearTimeout(lewat); gagal(er); }
    );
  });
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('script.google') > -1) return;
  if (e.request.url.indexOf('docs.google.com') > -1) return;

  if (halaman(e.request)) {
    e.respondWith(
      ambilHalaman(e.request)
        .catch(function () {
          return caches.match(e.request).then(function (t) {
            if (t) return t;
            return caches.open(CACHE).then(function (c) {
              return c.keys().then(function (kunci) {
                for (var i = 0; i < kunci.length; i++) {
                  if (kunci[i].url.indexOf('.html') > -1) return c.match(kunci[i]);
                }
                return new Response(
                  '<meta charset="utf-8"><div style="font-family:Arial;padding:24px">' +
                  '<h2>Belum bisa dipakai offline</h2><p>Buka halaman ini sekali ' +
                  'saat ada sinyal, setelah itu mode offline aktif.</p></div>',
                  { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
              });
            });
          });
        })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (t) {
      var net = fetch(e.request)
        .then(function (r) { return simpan(e.request, r); })
        .catch(function () { return t; });
      return t || net;
    })
  );
});
