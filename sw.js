/* Service worker Gudang Teknik.
 *
 * PELAJARAN YANG SUDAH KENA:
 * 1. Jangan menyebut nama berkas halaman secara kaku di sini. Kalau di repo
 *    namanya berbeda (scanapp.html, scangudtek.html, dsb), penyimpanan gagal
 *    DIAM-DIAM dan mode offline mati tanpa pesan apa pun.
 *    Solusi: halaman disimpan saat pertama kali dibuka (runtime), bukan
 *    didaftarkan di muka. Nama apa pun otomatis tertangani.
 * 2. Nama cache HARUS berubah setiap scanner.html berubah, kalau tidak HP
 *    tetap disuguhi salinan lama. Nama cache di bawah mengikuti versi
 *    aplikasi — ubah keduanya bersamaan.
 *
 * Strategi:
 *   Halaman  -> JARINGAN DULU, tembolok hanya cadangan saat tidak ada sinyal.
 *   Aset     -> TEMBOLOK DULU, isinya tidak pernah berubah.
 */
var VERSI = 'v9';
var CACHE = 'gudang-teknik-' + VERSI;

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

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('script.google') > -1) return;   // API selalu langsung

  if (halaman(e.request)) {
    e.respondWith(
      fetch(e.request)
        .then(function (r) { return simpan(e.request, r); })
        .catch(function () {
          /* Tidak ada sinyal: pakai salinan halaman ini, apa pun namanya. */
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

  /* Aset statis: pakai tembolok, sambil menyegarkan di latar belakang. */
  e.respondWith(
    caches.match(e.request).then(function (t) {
      var net = fetch(e.request)
        .then(function (r) { return simpan(e.request, r); })
        .catch(function () { return t; });
      return t || net;
    })
  );
});
