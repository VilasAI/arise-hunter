/* Service worker â€” VigÃ­lia
   CÃ³digo (HTML/CSS/JS): network-first â†’ atualizaÃ§Ãµes aplicam-se logo.
   Assets 3D (glb/gltf/bin/png) e lib: cache-first â†’ offline rÃ¡pido. */
const CACHE = 'vigilia-v11';
const NUCLEO = [
  './', './index.html', './css/style.css',
  './js/balance.js', './js/data.js', './js/art.js', './js/powers.js',
  './js/game.js', './js/combat.js', './js/hub.js', './js/ui.js', './js/render3d.js',
  './lib/three.module.js',
  './lib/jsm/loaders/GLTFLoader.js',
  './lib/jsm/utils/SkeletonUtils.js',
  './lib/jsm/utils/BufferGeometryUtils.js',
  './manifest.json', './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(NUCLEO)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const ehAsset = url.pathname.includes('/assets/') ||
                  url.pathname.includes('/lib/') ||
                  /\.(glb|gltf|bin|png|jpg|svg)$/i.test(url.pathname);

  if(ehAsset){
    // cache-first (assets grandes e estÃ¡veis)
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(e.request);
        if(hit) return hit;
        const resp = await fetch(e.request);
        if(resp.ok) c.put(e.request, resp.clone());
        return resp;
      })
    );
  } else {
    // network-first (cÃ³digo e navegaÃ§Ã£o) com fallback Ã  cache offline
    e.respondWith(
      fetch(e.request).then(resp => {
        if(resp.ok) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  }
});

