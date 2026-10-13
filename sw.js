// フォトログ Service Worker（オフライン用）
// アプリを更新したら、VERSION の数字を上げてください。
const VERSION = 'v1';
const CACHE = 'photolog-' + VERSION;
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/jspdf.umd.min.js',
  'vendor/tesseract.min.js',
  'vendor/worker.min.js',
  'vendor/core/tesseract-core-lstm.wasm.js',
  'vendor/core/tesseract-core-simd-lstm.wasm.js',
  'vendor/lang/eng.traineddata.gz'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('photolog-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // 住所検索などの外部通信はそのまま通す

  // ページ本体は「保存済みを先に返し、裏で最新を取得」。次回の起動で更新が反映されます。
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match('index.html') || await cache.match('./');
        const fresh = fetch(req).then(r => { if (r && r.ok) cache.put('index.html', r.clone()); return r; }).catch(() => null);
        return cached || (await fresh) || Response.error();
      })
    );
    return;
  }

  // 部品・アイコンは、保存済みを優先
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
      if (r && r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
      return r;
    }))
  );
});
