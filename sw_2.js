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
 * 3. Halaman sudah diambil browser SEBELUM service worker mengambil alih,
 *    jadi tidak ikut tersimpan sendiri. Tanpa penanganan khusus, setiap naik
 *    versi petugas melihat "BELUM siap" sekali dan mengira sistem rusak.
 *    Solusi: halaman mengirim pesan {simpan:...}, dijawab {tersimpan:true}.
 * 4. Sinyal LEMAH lebih berbahaya daripada sinyal MATI — fetch menggantung
 *    tanpa gagal. Solusi: batas 3 detik, lalu pakai salinan lokal.
 *
 * Strategi:
 *   Halaman  -> JARINGAN DULU (maks 3 detik), tembolok sebagai cadangan.
 *   Aset     -> TEMBOLOK DULU, isinya tidak pernah berubah.
 */
var VERSI = 'v29';
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

/* Halaman meminta dirinya disimpan tepat setelah service worker aktif.
   Tanpa ini, halaman baru tersimpan pada pembukaan BERIKUTNYA, sehingga
   setiap naik versi petugas melihat "Mode offline: BELUM siap" sekali. */
self.addEventListener('message', function (e) {
  if (!e.data || !e.data.simpan) return;
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.add(e.data.simpan); })
      .then(function () { if (e.source) e.source.postMessage({ tersimpan: true }); })
      .catch(function () {})
  );
});

/* Sinyal LEMAH lebih berbahaya daripada sinyal MATI: fetch tidak gagal,
   hanya menggantung, dan petugas menatap layar kosong padahal salinan
   offline ada di HP-nya. Batas 3 detik, setelah itu pakai salinan lokal.
   Versi baru tetap terambil begitu sinyal membaik. */
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
  if (e.request.url.indexOf('script.google') > -1) return;   // API selalu langsung

  if (halaman(e.request)) {
    e.respondWith(
      ambilHalaman(e.request)
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
