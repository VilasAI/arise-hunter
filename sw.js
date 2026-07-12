/* Service worker — Vigília
   Código (HTML/CSS/JS): network-first → atualizações aplicam-se logo.
   Assets (spritesheets, ícones): cache-first → offline rápido. */
const CACHE = 'vigilia-v22';
const PREFIXO = 'vigilia-';   // só limpamos as NOSSAS caches antigas
const NUCLEO = [
  './', './index.html', './css/style.css',
  './js/balance.js', './js/audio.js', './js/data.js', './js/art.js', './js/sprites.js', './js/powers.js',
  './js/classes.js', './js/arvore.js', './js/game.js', './js/combat.js', './js/hub.js', './js/ui.js',
  './manifest.json', './icon.svg',
];

self.addEventListener('install', e => {
  // transacional: se um único ficheiro falhar, esta versão NÃO instala
  // e a versão anterior (funcional) continua a servir o offline
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(
      ks.filter(k => k.startsWith(PREFIXO) && k !== CACHE).map(k => caches.delete(k))
    )).then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const ehAsset = url.pathname.includes('/assets/') ||
                  /\.(png|jpg|svg)$/i.test(url.pathname);

  if(ehAsset){
    // cache-first (assets grandes e estáveis)
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(e.request);
        if(hit) return hit;
        const resp = await fetch(e.request);
        // waitUntil: a escrita termina mesmo que o worker vá dormir entretanto
        if(resp.ok) e.waitUntil(c.put(e.request, resp.clone()));
        return resp;
      })
    );
  } else {
    // network-first (código e navegação) com fallback à cache offline
    e.respondWith(
      fetch(e.request).then(resp => {
        if(resp.ok) e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, resp.clone())));
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  }
});
