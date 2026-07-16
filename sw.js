/* Service worker — Vigília
   Código (HTML/CSS/JS): network-first → atualizações aplicam-se logo.
   Assets (spritesheets, ícones): cache-first → offline rápido. */
const CACHE = 'vigilia-v34';
const PREFIXO = 'vigilia-';   // só limpamos as NOSSAS caches antigas
const NUCLEO = [
  './', './index.html', './css/style.css',
  './js/balance.js', './js/audio.js', './js/data.js', './js/art.js', './js/sprites.js', './js/powers.js',
  './js/classes.js', './js/arvore.js', './js/game.js', './js/combat.js', './js/hub.js', './js/ui.js',
  './manifest.json', './icon.svg',
  './assets/2d/sprites-meta.json',
  './assets/2d/tex_01.jpg', './assets/2d/tex_02.jpg', './assets/2d/tex_03.jpg', './assets/2d/tex_04.jpg',
  './assets/2d/tex_05.jpg', './assets/2d/tex_06.jpg', './assets/2d/tex_07.jpg', './assets/2d/tex_08.jpg',
  './assets/2d/tex_09.jpg', './assets/2d/tex_10.jpg', './assets/2d/tex_11.jpg', './assets/2d/tex_12.jpg',
  './assets/2d/tex_13.jpg', './assets/2d/tex_14.jpg', './assets/2d/tex_15.jpg', './assets/2d/tex_16.jpg',
  './assets/2d/hig_parede.jpg', './assets/2d/hig_chao_pedra.jpg', './assets/2d/hig_chao_madeira.jpg',
  './assets/2d/hig_barril.png', './assets/2d/hig_tocha.png',
];

for(const r of ['e','d','c','b','a','s']){
  for(const p of ['parede','chao','transicao']) NUCLEO.push(`./assets/2d/bio_${r}_${p}.png`);
  if(r!=='e') for(let i=1;i<=4;i++) NUCLEO.push(`./assets/2d/bio_${r}_acento_${i}.png`);
}
for(const nome of ['portal','ferreiro','mercador','base','quadro','aldrico','ponte',
  'arvore_1','arvore_2','arvore_morta','relva','caminho','praca','agua']){
  NUCLEO.push(`./assets/2d/hub_${nome}.png`);
}

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
