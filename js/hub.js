/* ============ VILA DE PEDRAVELHA — hub navegável ============
   Mapa ilustrado top-down: água turquesa, ilha com falésias,
   relva texturizada, casas de telhado quente, fumo, espuma.
   O cenário estático é PRÉ-RENDERIZADO (offscreen) por
   performance; só a animação é desenhada a cada frame.        */
'use strict';

const hubCanvas = document.getElementById('hub-canvas');
const hctx = hubCanvas.getContext('2d');

/* locais da vila (posições relativas ao ecrã) */
const LOCAIS = [
  { id:'portais',  nome:'Círculo de Portais', verbo:'Entrar',  icone:'portal', x:.50, y:.27, tipo:'arco'  },
  { id:'ferreiro', nome:'Ferreiro',           verbo:'Entrar',  icone:'forja',  x:.17, y:.44, tipo:'casa'  },
  { id:'loja',     nome:'Mercador',           verbo:'Entrar',  icone:'loja',   x:.83, y:.40, tipo:'casa'  },
  { id:'quadro',   nome:'Quadro de Missões',  verbo:'Ler',     icone:'quadro', x:.78, y:.74, tipo:'quadro'},
  { id:'base',     nome:'A Tua Base',         verbo:'Entrar',  icone:'base',   x:.18, y:.78, tipo:'casa'  },
  { id:'npc',      nome:NPC.nome,             verbo:'Falar',   icone:'npc',    x:.58, y:.58, tipo:'npc' },
];

const HUB = {
  ativo:false, W:0, H:0, tempo:0,
  pressao:null,   // local sob o dedo (feedback de toque)
};
let hubRaf = 0, hubUltimoT = 0;
let mapaCache = null;        // cenário pré-renderizado
let costaPts = [];           // contorno da ilha (para espuma)
let chamines = [];           // bocas de fumo
let fumos = [];              // partículas de fumo

/* PRNG determinístico para detalhe do mapa (igual em todos os frames) */
function criarRnd(seed){ let s=seed; return ()=>{ s=(s*9301+49297)%233280; return s/233280; }; }

let mapaDim = '';   // evita re-pintar o mapa se o ecrã não mudou
function hubRedimensionar(){
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  HUB.W = window.innerWidth; HUB.H = window.innerHeight;
  const dim = HUB.W+'x'+HUB.H+'x'+dpr;
  if(dim === mapaDim && mapaCache) return;
  mapaDim = dim;
  hubCanvas.width = HUB.W*dpr; hubCanvas.height = HUB.H*dpr;
  hctx.setTransform(dpr,0,0,dpr,0,0);
  prerenderMapa();
}
window.addEventListener('resize', ()=>{ if(HUB.ativo) hubRedimensionar(); });

function hubAtivar(){
  hubRedimensionar();
  HUB.ativo = true;
  hubUltimoT = performance.now();
  cancelAnimationFrame(hubRaf);
  hubRaf = requestAnimationFrame(hubLoop);
}
function hubParar(){ HUB.ativo = false; cancelAnimationFrame(hubRaf); }

/* ---------- controlo: tocar no sítio = entrar (sem boneco a andar) ---------- */
function localEm(sx, sy){
  let melhor = null, md = 9999;
  for(const l of LOCAIS){
    const lx = l.x*HUB.W, ly = l.y*HUB.H - 24;   // centro visual (corpo do edifício)
    const d = Math.hypot(lx - sx, ly - sy);
    if(d < 82 && d < md){ md = d; melhor = l; }
  }
  return melhor;
}
hubCanvas.addEventListener('pointerdown', e=>{ HUB.pressao = localEm(e.clientX, e.clientY); });
hubCanvas.addEventListener('pointerup', e=>{
  const l = localEm(e.clientX, e.clientY);
  if(l && l === HUB.pressao) interagirLocal(l.id);
  HUB.pressao = null;
});
hubCanvas.addEventListener('pointercancel', ()=>{ HUB.pressao = null; });

/* ---------- ciclo ---------- */
function hubLoop(t){
  if(!HUB.ativo) return;
  hubRaf = requestAnimationFrame(hubLoop);
  const dt = Math.min((t-hubUltimoT)/1000, 0.05);
  hubUltimoT = t;
  HUB.tempo += dt;
  hubDesenhar(dt);
}

/* ============================================================
   PRÉ-RENDERIZAÇÃO DO MAPA
   ============================================================ */
/* preenche uma área com um tile repetido (pixel art, nearest-neighbor) */
function tileFill(c, nome, x0, y0, x1, y1, dsize){
  const o = SPR.reg[nome]; if(!o || !o.ok) return false;
  c.imageSmoothingEnabled = false;
  for(let y=y0; y<y1; y+=dsize) for(let x=x0; x<x1; x+=dsize) c.drawImage(o.img, x, y, dsize, dsize);
  return true;
}
function prerenderMapa(){
  const {W,H} = HUB;
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  mapaCache = document.createElement('canvas');
  mapaCache.width = W*dpr; mapaCache.height = H*dpr;
  const mc = mapaCache.getContext('2d');
  mc.setTransform(dpr,0,0,dpr,0,0);

  /* PIXEL-ART: o cenário vetorial (água, relva, caminhos, praça, falésias,
     doca, barris…) é pintado numa tela de BAIXA resolução e depois ampliado
     com nearest-neighbor, ficando com arestas "aos quadrados" no mesmo
     espírito dos sprites pixel-art das casas e árvores — em vez do aspeto
     liso/pintado que destoava. PX = tamanho de cada pixel grande (px ecrã);
     2 ≈ o tamanho do pixel dos próprios sprites num ecrã retina. */
  const PX = 2;
  const lw = Math.max(1, Math.ceil(W/PX)), lh = Math.max(1, Math.ceil(H/PX));
  const BW = lw*PX, BH = lh*PX;   // extensão exata do buffer (≥ W,H) — evita costura na borda
  const loCv = document.createElement('canvas');
  loCv.width = lw; loCv.height = lh;
  const c = loCv.getContext('2d');
  c.setTransform(1/PX, 0, 0, 1/PX, 0, 0);
  c.imageSmoothingEnabled = false;
  const crisp = [];   // sprites a redesenhar nítidos por cima (sem reamostragem dupla)

  const rndM = criarRnd(7331);
  const s = Math.min(W,H)/420;

  /* --- água --- */
  const agua = c.createLinearGradient(0,0,0,H);
  agua.addColorStop(0,'#1c6a74'); agua.addColorStop(.5,'#1a5f6e'); agua.addColorStop(1,'#123f4e');
  c.fillStyle = agua; c.fillRect(0,0,BW,BH);
  if(SPR.ok('cf_water')) tileFill(c,'cf_water',0,0,W,H,24);
  // manchas de profundidade
  for(let i=0;i<10;i++){
    c.fillStyle = `rgba(10,40,52,${0.12+rndM()*0.12})`;
    c.beginPath();
    c.ellipse(rndM()*W, rndM()*H, 40+rndM()*120, 24+rndM()*60, rndM()*3, 0, Math.PI*2);
    c.fill();
  }

  /* --- contorno da ilha --- */
  const cx=W*0.55, cy=H*0.62, rx=W*0.52, ry=H*0.46;
  costaPts = [];
  for(let i=0;i<72;i++){
    const a = i/72*Math.PI*2;
    const wob = 1 + 0.07*Math.sin(3*a+1) + 0.05*Math.sin(7*a+4);
    costaPts.push([cx+Math.cos(a)*rx*wob, cy+Math.sin(a)*ry*wob]);
  }
  const tracarIlha = (ctx2, esc=1, dy=0)=>{
    ctx2.beginPath();
    costaPts.forEach(([x,y],i)=>{
      const px = cx+(x-cx)*esc, py = cy+(y-cy)*esc+dy;
      i? ctx2.lineTo(px,py) : ctx2.moveTo(px,py);
    });
    ctx2.closePath();
  };

  // ondulação suave à volta (anéis)
  for(let k=0;k<3;k++){
    c.strokeStyle = `rgba(180,230,230,${0.10-k*0.03})`;
    c.lineWidth = 2;
    tracarIlha(c, 1.05+k*0.05); c.stroke();
  }
  // falésia (lado de baixo da ilha)
  c.fillStyle = '#4a3826'; tracarIlha(c, 1, 14*s); c.fill();
  c.fillStyle = '#5d4a30'; tracarIlha(c, 1, 8*s); c.fill();
  // areia
  c.fillStyle = '#c9a86a'; tracarIlha(c, 1); c.fill();
  // relva
  const relva = c.createLinearGradient(0,0,0,H);
  relva.addColorStop(0,'#5d7a34'); relva.addColorStop(1,'#41602a');
  c.fillStyle = relva; tracarIlha(c, 0.962); c.fill();
  if(SPR.ok('cf_grass')){ c.save(); tracarIlha(c,0.962); c.clip(); tileFill(c,'cf_grass',0,0,W,H,24); c.restore(); }
  // textura da relva (salpicos)
  c.save(); tracarIlha(c, 0.962); c.clip();
  for(let i=0;i<700;i++){
    const x = rndM()*W, y = rndM()*H;
    c.fillStyle = rndM()<0.5 ? 'rgba(120,160,70,0.18)' : 'rgba(30,50,20,0.15)';
    c.fillRect(x, y, 2+rndM()*2, 1.5);
  }
  // clareiras mais claras
  for(let i=0;i<6;i++){
    c.fillStyle = 'rgba(150,180,90,0.10)';
    c.beginPath();
    c.ellipse(rndM()*W, rndM()*H, 50+rndM()*90, 30+rndM()*50, rndM()*3, 0, Math.PI*2);
    c.fill();
  }
  c.restore();

  /* --- praça e caminhos --- */
  const npcL = LOCAIS.find(l=>l.id==='npc');
  const px0 = npcL.x*W, py0 = npcL.y*H;
  c.save(); tracarIlha(c, 0.962); c.clip();
  // caminhos de terra (com rebordo escuro)
  for(const l of LOCAIS){
    if(l.id==='npc') continue;
    const tx=l.x*W, ty=l.y*H+10*s;
    const mx=(px0+tx)/2 + (rndM()-0.5)*40*s, my=(py0+ty)/2 + (rndM()-0.5)*24*s;
    for(const [cor,lw] of [['#6b5232',17*s],['#a8854f',12*s],['#c2a26a',5*s]]){
      c.strokeStyle=cor; c.lineWidth=lw; c.lineCap='round';
      c.beginPath(); c.moveTo(px0,py0); c.quadraticCurveTo(mx,my,tx,ty); c.stroke();
    }
  }
  // praça de pedra
  c.fillStyle='#8a7a5a';
  c.beginPath(); c.ellipse(px0,py0+4*s, 64*s, 30*s, 0, 0, Math.PI*2); c.fill();
  c.fillStyle='#9c8c6a';
  c.beginPath(); c.ellipse(px0,py0+2*s, 56*s, 25*s, 0, 0, Math.PI*2); c.fill();
  for(let i=0;i<26;i++){
    const a=rndM()*Math.PI*2, r=rndM()*0.85;
    c.fillStyle=`rgba(70,60,40,${0.15+rndM()*0.15})`;
    c.beginPath();
    c.ellipse(px0+Math.cos(a)*52*s*r, py0+2*s+Math.sin(a)*22*s*r, 5*s+rndM()*4*s, 3*s+rndM()*2*s, rndM()*3, 0, Math.PI*2);
    c.fill();
  }
  c.restore();

  /* --- árvores (copas sombreadas) --- */
  const arvores = [
    [.30,.30],[.40,.24],[.63,.22],[.72,.27],[.90,.30],[.94,.50],
    [.07,.58],[.10,.34],[.30,.86],[.42,.90],[.60,.90],[.70,.86],
    [.93,.66],[.34,.52],[.68,.46],[.26,.64],
  ];
  for(const [ax,ay] of arvores){
    if(SPR.ok('cf_tree')){
      const o=SPR.reg.cf_tree, h=70*s*(0.85+rndM()*0.4), w=h*(o.w/o.h);
      crisp.push({ img:o.img, x:ax*W-w/2, y:ay*H-h*0.88, w, h });
    } else desenharArvore(c, ax*W, ay*H, s*(0.8+rndM()*0.5), rndM);
  }

  /* --- doca e barco (água, lado esquerdo) --- */
  desenharDoca(c, W*0.045, H*0.70, s);

  /* --- edifícios e adereços --- */
  chamines = [];
  for(const l of [...LOCAIS].sort((a,b)=>a.y-b.y)){
    desenharLocalCache(c, l, s, rndM, crisp);
  }
  // barris e caixas junto ao mercador
  const lj = LOCAIS.find(l=>l.id==='loja');
  desenharBarril(c, lj.x*W-58*s, lj.y*H+6*s, s);
  desenharBarril(c, lj.x*W-46*s, lj.y*H+12*s, s*0.85);
  // bigorna junto ao ferreiro
  const fe = LOCAIS.find(l=>l.id==='ferreiro');
  c.fillStyle='#3a3a40';
  c.fillRect(fe.x*W+34*s, fe.y*H-2*s, 16*s, 7*s);
  c.fillRect(fe.x*W+38*s, fe.y*H+5*s, 8*s, 6*s);

  /* ampliar o cenário pixelado para o cache e pôr os sprites nítidos por cima */
  mc.imageSmoothingEnabled = false;
  mc.drawImage(loCv, 0, 0, lw, lh, 0, 0, BW, BH);
  for(const sp of crisp) mc.drawImage(sp.img, sp.x, sp.y, sp.w, sp.h);

  /* --- luz quente global + vinheta (sobre tudo; é iluminação, fica suave) --- */
  const luz = mc.createRadialGradient(W*0.5, H*0.40, Math.min(W,H)*0.18, W*0.5, H*0.55, Math.max(W,H)*0.75);
  luz.addColorStop(0,'rgba(255,220,150,0.10)');
  luz.addColorStop(0.55,'rgba(0,0,0,0)');
  luz.addColorStop(1,'rgba(8,6,16,0.42)');
  mc.fillStyle=luz; mc.fillRect(0,0,W,H);
}

function desenharArvore(c, x, y, s, rndM){
  c.fillStyle='rgba(0,0,0,0.30)';
  c.beginPath(); c.ellipse(x+4*s, y+8*s, 26*s, 9*s, 0, 0, Math.PI*2); c.fill();
  // tronco
  c.fillStyle='#4a3520';
  c.fillRect(x-3*s, y-10*s, 6*s, 16*s);
  // copa em 3 tons
  const blobs = [[0,-26,24],[-14,-16,17],[15,-18,16]];
  for(const [bx,by,br] of blobs){
    c.fillStyle='#243d1c';
    c.beginPath(); c.arc(x+bx*s, y+by*s, br*s, 0, Math.PI*2); c.fill();
  }
  for(const [bx,by,br] of blobs){
    c.fillStyle='#35562a';
    c.beginPath(); c.arc(x+bx*s-2*s, y+by*s-3*s, br*s*0.82, 0, Math.PI*2); c.fill();
  }
  for(const [bx,by,br] of blobs){
    c.fillStyle='#4d7237';
    c.beginPath(); c.arc(x+bx*s-4*s, y+by*s-6*s, br*s*0.5, 0, Math.PI*2); c.fill();
  }
  // pontinhos de luz
  for(let i=0;i<5;i++){
    c.fillStyle='rgba(140,180,90,0.7)';
    c.beginPath(); c.arc(x+(rndM()-0.6)*30*s, y-(8+rndM()*24)*s, 1.6*s, 0, Math.PI*2); c.fill();
  }
}

function desenharDoca(c, x, y, s){
  c.fillStyle='#5d4a30';
  c.fillRect(x, y, 64*s, 10*s);
  c.fillStyle='rgba(0,0,0,0.25)';
  for(let i=0;i<5;i++) c.fillRect(x+6*s+i*12*s, y, 2*s, 10*s);
  c.fillStyle='#4a3826';
  c.fillRect(x+6*s, y+10*s, 4*s, 8*s); c.fillRect(x+52*s, y+10*s, 4*s, 8*s);
  // barco
  c.fillStyle='#6b4f2e';
  c.beginPath();
  c.moveTo(x+10*s, y+30*s);
  c.quadraticCurveTo(x+34*s, y+44*s, x+58*s, y+30*s);
  c.lineTo(x+50*s, y+24*s); c.lineTo(x+18*s, y+24*s);
  c.closePath(); c.fill();
  c.fillStyle='#8a6a40';
  c.fillRect(x+18*s, y+24*s, 32*s, 3*s);
}

function desenharBarril(c, x, y, s){
  c.fillStyle='rgba(0,0,0,0.3)';
  c.beginPath(); c.ellipse(x, y+9*s, 9*s, 3.5*s, 0, 0, Math.PI*2); c.fill();
  c.fillStyle='#6b4f2e';
  c.beginPath(); c.ellipse(x, y, 8*s, 10*s, 0, 0, Math.PI*2); c.fill();
  c.fillStyle='#8a6a40';
  c.beginPath(); c.ellipse(x-2*s, y-2*s, 5*s, 7*s, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle='#3a2d1d'; c.lineWidth=1.5*s;
  c.beginPath(); c.moveTo(x-8*s,y-3*s); c.lineTo(x+8*s,y-3*s); c.stroke();
  c.beginPath(); c.moveTo(x-8*s,y+3*s); c.lineTo(x+8*s,y+3*s); c.stroke();
}

/* edifícios detalhados (parte estática, vai para o cache) */
function desenharLocalCache(c, l, s, rndM, crisp){
  const x = l.x*HUB.W, y = l.y*HUB.H;
  c.save(); c.translate(x,y);
  c.fillStyle='rgba(0,0,0,.35)';
  c.beginPath(); c.ellipse(2*s, 10*s, 52*s, 14*s, 0, 0, Math.PI*2); c.fill();

  if(l.tipo==='casa' && SPR.ok('cf_house')){
    const o=SPR.reg.cf_house, h=108*s, w=h*(o.w/o.h);
    // sprite nítido por cima do cenário pixelado (preserva a textura original)
    crisp.push({ img:o.img, x:x - w/2, y:y + 8*s - h, w, h });
    // placa com o ícone do edifício (para distinguir loja/ferreiro/base)
    const py = 8*s - h + 6*s;
    c.fillStyle='#3a2d1d'; c.fillRect(-16*s, py-16*s, 32*s, 19*s);
    c.fillStyle='#8a6a40'; c.fillRect(-14*s, py-14*s, 28*s, 15*s);
    ARTE.desenharIcone(c, l.icone, 0, py-6*s, 13*s);
    c.restore();
    return;
  }
  if(l.tipo==='casa'){
    const corTelhado = l.id==='ferreiro' ? ['#7a4a28','#9c5e32','#5d3820']
                     : l.id==='loja'     ? ['#8a3f2e','#b05540','#6b3022']
                     :                     ['#6b5a2e','#8a763c','#524422'];
    // paredes: reboco + vigas de madeira
    c.fillStyle='#cbb89a';
    c.fillRect(-42*s,-52*s,84*s,56*s);
    c.fillStyle='rgba(120,95,60,0.35)';
    c.fillRect(-42*s,-12*s,84*s,16*s);                    // sombra junto ao chão
    c.strokeStyle='#5d4a30'; c.lineWidth=3*s;
    c.strokeRect(-42*s,-52*s,84*s,56*s);
    c.beginPath();
    c.moveTo(-42*s,-30*s); c.lineTo(42*s,-30*s);
    c.moveTo(-14*s,-52*s); c.lineTo(-14*s,4*s);
    c.moveTo(16*s,-52*s); c.lineTo(16*s,4*s);
    c.stroke();
    // telhado em dois tons com beiral
    c.fillStyle=corTelhado[2];
    c.beginPath(); c.moveTo(-52*s,-48*s); c.lineTo(0,-92*s); c.lineTo(52*s,-48*s); c.lineTo(46*s,-44*s); c.lineTo(0,-84*s); c.lineTo(-46*s,-44*s); c.closePath(); c.fill();
    c.fillStyle=corTelhado[0];
    c.beginPath(); c.moveTo(-46*s,-46*s); c.lineTo(0,-88*s); c.lineTo(46*s,-46*s); c.closePath(); c.fill();
    c.fillStyle=corTelhado[1];
    c.beginPath(); c.moveTo(-46*s,-46*s); c.lineTo(0,-88*s); c.lineTo(0,-66*s); c.closePath(); c.fill();
    // ripas do telhado
    c.strokeStyle='rgba(0,0,0,0.22)'; c.lineWidth=1.5*s;
    for(let i=1;i<4;i++){
      c.beginPath();
      c.moveTo(-46*s+i*10*s, -46*s-i*8*s); c.lineTo(46*s-i*10*s, -46*s-i*8*s);
      c.stroke();
    }
    // chaminé + registo para fumo
    c.fillStyle='#7a6a55';
    c.fillRect(20*s,-86*s,11*s,22*s);
    c.fillStyle='#5d4a30';
    c.fillRect(18*s,-88*s,15*s,5*s);
    chamines.push([x+26*s, y-88*s]);
    // porta em arco
    c.fillStyle='#3a2616';
    c.beginPath();
    c.moveTo(-11*s,4*s); c.lineTo(-11*s,-22*s);
    c.arc(0,-22*s,11*s,Math.PI,0);
    c.lineTo(11*s,4*s); c.closePath(); c.fill();
    c.strokeStyle='#8a6a40'; c.lineWidth=2*s; c.stroke();
    c.fillStyle='#c9a55a';
    c.beginPath(); c.arc(6*s,-10*s,1.8*s,0,Math.PI*2); c.fill();
    // janela iluminada
    c.fillStyle='#f0b450';
    c.fillRect(24*s,-44*s,12*s,12*s);
    c.strokeStyle='#5d4a30'; c.lineWidth=2*s; c.strokeRect(24*s,-44*s,12*s,12*s);
    c.beginPath(); c.moveTo(30*s,-44*s); c.lineTo(30*s,-32*s); c.moveTo(24*s,-38*s); c.lineTo(36*s,-38*s); c.stroke();
    // tabuleta pendurada com o ícone pintado
    c.strokeStyle='#3a2d1d'; c.lineWidth=2*s;
    c.beginPath(); c.moveTo(-30*s,-52*s); c.lineTo(-30*s,-62*s); c.stroke();
    c.fillStyle='#5d4a30';
    c.fillRect(-42*s,-78*s,24*s,18*s);
    c.fillStyle='#8a6a40';
    c.fillRect(-40*s,-76*s,20*s,14*s);
    ARTE.desenharIcone(c, l.icone, -30*s, -69*s, 13*s);
  }
  else if(l.tipo==='arco'){
    // círculo de pedras erguidas
    for(let i=0;i<5;i++){
      const a = Math.PI*0.15 + i/4*Math.PI*0.7;
      const sx = -Math.cos(a)*56*s, sy = Math.sin(a)*16*s;
      c.fillStyle = i%2 ? '#6b5a45' : '#7a6a55';
      c.save(); c.translate(sx, sy);
      c.fillRect(-6*s, -34*s - (i===2?14*s:0), 12*s, 38*s + (i===2?14*s:0));
      c.fillStyle='rgba(255,235,190,0.12)';
      c.fillRect(-6*s, -34*s - (i===2?14*s:0), 4*s, 38*s + (i===2?14*s:0));
      c.restore();
    }
    // arco principal
    c.strokeStyle='#7a6a55'; c.lineWidth=11*s;
    c.beginPath(); c.arc(0,-22*s,40*s,Math.PI,0); c.stroke();
    c.strokeStyle='rgba(255,235,190,0.15)'; c.lineWidth=4*s;
    c.beginPath(); c.arc(0,-24*s,40*s,Math.PI*1.1,Math.PI*1.6); c.stroke();
    // runas gravadas
    c.fillStyle='rgba(138,111,200,0.8)';
    for(let i=0;i<4;i++){
      const a = Math.PI + i/3*Math.PI;
      c.fillRect(Math.cos(a)*40*s-1.5*s, -22*s+Math.sin(a)*40*s-3*s, 3*s, 6*s);
    }
  }
  else if(l.tipo==='quadro'){
    c.fillStyle='#3a2d1d';
    c.fillRect(-32*s,-14*s,7*s,22*s); c.fillRect(25*s,-14*s,7*s,22*s);
    c.fillStyle='#5d4a30';
    c.fillRect(-36*s,-62*s,72*s,50*s);
    c.fillStyle='#6b5a3a';
    c.fillRect(-32*s,-58*s,64*s,42*s);
    // telhadinho
    c.fillStyle='#7a4a28';
    c.beginPath(); c.moveTo(-42*s,-60*s); c.lineTo(0,-76*s); c.lineTo(42*s,-60*s); c.closePath(); c.fill();
    // pergaminhos pregados
    const rng = criarRnd(42);
    for(let i=0;i<4;i++){
      const pxp = -26*s + i*14*s + rng()*4*s, pyp = -54*s + rng()*14*s;
      c.fillStyle = i%2 ? '#e8dcc3' : '#d8c8a8';
      c.fillRect(pxp, pyp, 12*s, 16*s);
      c.fillStyle='rgba(0,0,0,0.35)';
      for(let k2=1;k2<4;k2++) c.fillRect(pxp+2*s, pyp+k2*3.5*s, 8*s, 1);
      c.fillStyle='#8a2e2e';
      c.beginPath(); c.arc(pxp+6*s, pyp+1.5*s, 1.5*s, 0, Math.PI*2); c.fill();
    }
  }
  c.restore();
}
/* nota: tabuletas usam ARTE.desenharIcone — sem emojis no mapa */

/* ============================================================
   DESENHO POR FRAME (animação por cima do cache)
   ============================================================ */
function hubDesenhar(dt){
  const {W,H} = HUB, t = HUB.tempo;
  const s = Math.min(W,H)/420;
  hctx.clearRect(0,0,W,H);
  if(mapaCache) hctx.drawImage(mapaCache, 0, 0, W, H);

  /* espuma animada na costa */
  hctx.save();
  hctx.lineCap='round';
  for(let k=0;k<2;k++){
    hctx.strokeStyle = `rgba(220,245,245,${0.30-k*0.13})`;
    hctx.lineWidth = 2.5-k;
    hctx.setLineDash([26, 34]);
    hctx.lineDashOffset = -t*22*(k?-1:1);
    hctx.beginPath();
    const esc = 1.03+k*0.05;
    const cx=W*0.55, cy=H*0.62;
    costaPts.forEach(([x,y],i)=>{
      const px = cx+(x-cx)*esc, py = cy+(y-cy)*esc + Math.sin(t*1.6+i*0.4)*2;
      i? hctx.lineTo(px,py) : hctx.moveTo(px,py);
    });
    hctx.closePath(); hctx.stroke();
  }
  hctx.setLineDash([]);
  hctx.restore();

  /* cintilação na água */
  for(let i=0;i<22;i++){
    const a = Math.sin(t*1.8 + i*1.73);
    if(a<=0.3) continue;
    const sx = ((i*97+31)%100)/100*W, sy = ((i*53+17)%100)/100*H;
    // só fora da ilha (aproximação por elipse)
    const nx=(sx-W*0.55)/(W*0.52), ny=(sy-H*0.62)/(H*0.46);
    if(nx*nx+ny*ny < 1.1) continue;
    hctx.fillStyle = `rgba(230,250,250,${(a-0.3)*0.5})`;
    hctx.fillRect(sx, sy, 3, 1.4);
  }

  /* fumo das chaminés */
  if(Math.random() < dt*5 && chamines.length){
    const [fx,fy] = chamines[Math.floor(Math.random()*chamines.length)];
    fumos.push({ x:fx, y:fy, r:3*s, t:0, max:2.6+Math.random() });
  }
  for(const f of fumos){
    f.t += dt; f.y -= 14*s*dt; f.x += Math.sin(t*2+f.y*0.05)*6*dt; f.r += 4*s*dt;
    const al = (1-f.t/f.max)*0.30;
    if(al>0){
      hctx.fillStyle = `rgba(225,220,205,${al})`;
      hctx.beginPath(); hctx.arc(f.x, f.y, f.r, 0, Math.PI*2); hctx.fill();
    }
  }
  fumos = fumos.filter(f=>f.t<f.max);

  /* brilho do portal (animado) */
  const pl = LOCAIS.find(l=>l.id==='portais');
  const pxp = pl.x*W, pyp = pl.y*H;
  const fl = 0.6+Math.sin(t*2.2)*0.25;
  hctx.save();
  hctx.globalCompositeOperation = 'lighter';
  const halo = hctx.createRadialGradient(pxp, pyp-24*s, 2, pxp, pyp-24*s, 52*s);
  halo.addColorStop(0, `rgba(150,120,220,${0.30*fl})`);
  halo.addColorStop(1, 'rgba(150,120,220,0)');
  hctx.fillStyle=halo;
  hctx.beginPath(); hctx.arc(pxp, pyp-24*s, 52*s, 0, Math.PI*2); hctx.fill();
  hctx.restore();
  hctx.fillStyle=`rgba(150,120,220,${0.30*fl})`;
  hctx.beginPath(); hctx.ellipse(pxp, pyp-22*s, 26*s, 34*s, 0, 0, Math.PI*2); hctx.fill();
  hctx.strokeStyle=`rgba(190,165,255,${0.65*fl})`; hctx.lineWidth=2.5;
  hctx.beginPath(); hctx.ellipse(pxp, pyp-22*s, 22*s, 30*s, Math.sin(t*1.3)*0.1, 0, Math.PI*2); hctx.stroke();

  /* NPC animado */
  const npcL = LOCAIS.find(l=>l.id==='npc');
  desenharAldric(npcL.x*W, npcL.y*H, s, t);

  /* exclamação de missões */
  if(haMissaoPorReclamar()){
    for(const lid of ['quadro','npc']){
      const l = LOCAIS.find(x=>x.id===lid);
      hctx.font = `bold ${20*s}px Georgia,serif`;
      hctx.textAlign='center';
      hctx.fillStyle='#1a1208';
      hctx.fillText('!', l.x*W+1.5, l.y*H-96*s+1.5 - Math.abs(Math.sin(t*3))*6*s);
      hctx.fillStyle='#f0c052';
      hctx.fillText('!', l.x*W, l.y*H-96*s - Math.abs(Math.sin(t*3))*6*s);
    }
  }

  /* realce dos sítios tocáveis (sem boneco — toca para entrar) */
  for(const l of LOCAIS){
    const lx = l.x*W, ly = l.y*H + 6*s;
    const pressed = HUB.pressao === l;
    const pulso = 0.5 + Math.sin(t*3 + l.x*9)*0.5;
    hctx.strokeStyle = pressed ? 'rgba(255,225,150,.95)'
                               : `rgba(240,200,110,${0.28+pulso*0.30})`;
    hctx.lineWidth = pressed ? 3 : 2;
    hctx.beginPath();
    hctx.ellipse(lx, ly, (30+pulso*4)*s, (11+pulso*1.5)*s, 0, 0, Math.PI*2);
    hctx.stroke();
  }
}

function haMissaoPorReclamar(){
  return missoesVisiveis().some(m => missaoCumprida(m) && !missaoReclamada(m));   // (P2.3)
}

/* ---------- Mestre Aldric (painterly) ---------- */
function desenharAldric(x, y, s, t){
  const bob = Math.sin(t*2)*2*s;
  hctx.save(); hctx.translate(x,y);
  hctx.fillStyle='rgba(0,0,0,.4)';
  hctx.beginPath(); hctx.ellipse(0,4*s,15*s,5*s,0,0,Math.PI*2); hctx.fill();
  // manto verde-escuro com debrum laranja
  hctx.fillStyle='#2e4632';
  hctx.beginPath();
  hctx.moveTo(-15*s, 4*s); hctx.quadraticCurveTo(-17*s,-40*s+bob, 0,-47*s+bob);
  hctx.quadraticCurveTo(17*s,-40*s+bob, 15*s, 4*s); hctx.closePath(); hctx.fill();
  hctx.strokeStyle='#d4742c'; hctx.lineWidth=2*s;
  hctx.beginPath(); hctx.moveTo(-13*s, 2*s); hctx.quadraticCurveTo(-15*s,-36*s+bob, 0,-43*s+bob); hctx.stroke();
  // sombra interna do manto
  hctx.fillStyle='rgba(0,0,0,0.25)';
  hctx.beginPath(); hctx.ellipse(4*s,-16*s+bob, 9*s, 20*s, 0.2, 0, Math.PI*2); hctx.fill();
  // capuz + rosto
  hctx.fillStyle='#22351f';
  hctx.beginPath(); hctx.arc(0,-46*s+bob,11.5*s,0,Math.PI*2); hctx.fill();
  hctx.fillStyle='#e8c49a';
  hctx.beginPath(); hctx.arc(1.5*s,-44*s+bob,6*s,0,Math.PI*2); hctx.fill();
  // barba branca
  hctx.fillStyle='#d8d3c8';
  hctx.beginPath();
  hctx.moveTo(-4*s,-42*s+bob); hctx.quadraticCurveTo(1*s,-30*s+bob, 6*s,-42*s+bob);
  hctx.closePath(); hctx.fill();
  // cajado com lanterna
  hctx.strokeStyle='#5d4a30'; hctx.lineWidth=3*s;
  hctx.beginPath(); hctx.moveTo(18*s,6*s); hctx.lineTo(20*s,-58*s+bob); hctx.stroke();
  const lf = 0.7+Math.sin(t*7)*0.3;
  hctx.fillStyle=`rgba(240,180,80,${0.9*lf})`;
  hctx.beginPath(); hctx.arc(20*s,-60*s+bob,4.5*s,0,Math.PI*2); hctx.fill();
  hctx.save();
  hctx.globalCompositeOperation='lighter';
  const lg = hctx.createRadialGradient(20*s,-60*s+bob,1, 20*s,-60*s+bob,22*s);
  lg.addColorStop(0,`rgba(240,180,80,${0.35*lf})`); lg.addColorStop(1,'rgba(240,180,80,0)');
  hctx.fillStyle=lg;
  hctx.beginPath(); hctx.arc(20*s,-60*s+bob,22*s,0,Math.PI*2); hctx.fill();
  hctx.restore();
  hctx.restore();
}

/* ============================================================
   SPRITE DO HERÓI (partilhado: vila e combate)
   c: contexto já transladado/escalado · opts:
   dir (±1) · passo (oscilação ao andar) · golpe (0..1 do arco
   de ataque) · invul (bool) · t (tempo, para detalhes)
   ============================================================ */
function spriteHeroi(c, opts){
  const dir = opts.dir||1, passo = opts.passo||0, golpe = opts.golpe;
  c.save();
  c.scale(dir,1);
  if(opts.invul) c.globalAlpha = 0.55;

  // sombra
  c.fillStyle='rgba(0,0,0,.42)';
  c.beginPath(); c.ellipse(0,4,16,5.5,0,0,Math.PI*2); c.fill();

  // pernas (botas de couro)
  c.strokeStyle='#3a2a1a'; c.lineWidth=4.5; c.lineCap='round';
  c.beginPath(); c.moveTo(-3.5,-8); c.lineTo(-3.5+passo,2); c.stroke();
  c.beginPath(); c.moveTo(3.5,-8); c.lineTo(3.5-passo,2); c.stroke();
  c.fillStyle='#2a1d10';
  c.fillRect(-6.5+passo,0,6,3.5); c.fillRect(0.5-passo,0,6,3.5);

  // capa verde-escura a ondular
  c.fillStyle='#22351f';
  c.beginPath();
  c.moveTo(-11,-40);
  c.quadraticCurveTo(-20,-14,-13+passo*0.8,2);
  c.lineTo(-2,-4);
  c.quadraticCurveTo(-6,-22,-4,-40);
  c.closePath(); c.fill();
  // corpo: gibão de couro com peitoral
  c.fillStyle='#4a3826';
  c.beginPath(); c.roundRect ? (c.roundRect(-9,-42,18,36,6), c.fill()) : c.fillRect(-9,-42,18,36);
  c.fillStyle='#5d4a30';
  c.beginPath(); c.roundRect ? (c.roundRect(-9,-42,9,36,6), c.fill()) : c.fillRect(-9,-42,9,36);
  // cinto + fivela
  c.fillStyle='#2a1d10'; c.fillRect(-9,-16,18,4);
  c.fillStyle='#c9a55a'; c.fillRect(-2,-16,4,4);
  // écharpe laranja (referência visual)
  c.fillStyle='#d4742c';
  c.beginPath();
  c.moveTo(-8,-40); c.quadraticCurveTo(0,-34,8,-40);
  c.lineTo(8,-35); c.quadraticCurveTo(0,-29,-8,-35);
  c.closePath(); c.fill();
  c.fillStyle='#b05a1e';
  c.beginPath(); c.moveTo(-6,-36); c.lineTo(-3,-24); c.lineTo(1,-25); c.lineTo(-2,-36); c.closePath(); c.fill();

  // cabeça: capuz aberto, cabelo prateado, rosto
  c.fillStyle='#2e4632';
  c.beginPath(); c.arc(0,-50,11,Math.PI*0.75,Math.PI*2.35); c.fill();
  c.fillStyle='#e8c49a';
  c.beginPath(); c.arc(2,-49,7,0,Math.PI*2); c.fill();
  c.fillStyle='#d8d3c8';                                  // cabelo
  c.beginPath();
  c.moveTo(-6,-54); c.quadraticCurveTo(0,-60,7,-54);
  c.quadraticCurveTo(8,-50,6,-49);
  c.quadraticCurveTo(0,-55,-4,-50);
  c.closePath(); c.fill();
  c.fillStyle='#2a1d10';                                  // olho
  c.beginPath(); c.arc(5,-49,1.2,0,Math.PI*2); c.fill();

  // braço da espada + espada de aço
  const emGolpe = golpe!==undefined && golpe!==null;
  c.save();
  c.translate(10,-30);
  c.rotate(emGolpe ? -1.1 + golpe*2.2 : 0.5);
  c.strokeStyle='#4a3826'; c.lineWidth=4.5;
  c.beginPath(); c.moveTo(-2,0); c.lineTo(2,8); c.stroke();
  // lâmina com gume claro
  c.fillStyle='#8a8f96'; c.fillRect(-2,-36,4,38);
  c.fillStyle='#c8ccd0'; c.fillRect(-2,-36,1.6,38);
  c.fillStyle='#e8eef2'; c.fillRect(-2,-36,4,3);          // ponta
  // guarda e punho
  c.fillStyle='#c9a55a'; c.fillRect(-6,0,12,3.5);
  c.fillStyle='#5d3820'; c.fillRect(-1.6,3.5,3.2,7);
  c.fillStyle='#c9a55a';
  c.beginPath(); c.arc(0,12,2.4,0,Math.PI*2); c.fill();
  c.restore();

  // arco do golpe
  if(emGolpe){
    c.strokeStyle=`rgba(240,235,220,${0.85*(1-golpe)})`; c.lineWidth=4;
    c.beginPath(); c.arc(8,-26,34,-1.5,-1.5+golpe*2.4); c.stroke();
    c.strokeStyle=`rgba(240,235,220,${0.35*(1-golpe)})`; c.lineWidth=8;
    c.beginPath(); c.arc(8,-26,30,-1.5,-1.5+golpe*2.4); c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
}
