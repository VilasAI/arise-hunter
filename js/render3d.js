/* ============ MOTOR 3D (three.js + KayKit) ============
   Renderiza a vila e o combate em 3D low-poly com animações
   esqueléticas. A lógica do jogo continua em px 2D; este módulo
   converte (x,y) de jogo ↔ mundo 3D e projeta de volta para o
   ecrã (R3.proj) para o overlay 2D (números, barras, mira).    */
import * as THREE from 'three';
import { GLTFLoader } from '../lib/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkel } from '../lib/jsm/utils/SkeletonUtils.js';

const R3 = {
  ok:false, erro:null,
  cena:null, camera:null,
};
window.R3 = R3;

const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));   // local ao módulo

/* Deteta telemóvel/tablet (ponteiro grosso ou UA móvel). Em mobile baixamos
   o pixel-ratio, desligamos o antialias por MSAA e usamos sombras mais leves
   — é o ganho de GPU mais importante para correr fluido no telemóvel. */
const EH_MOVEL = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches)
              || /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent);
R3.movel = EH_MOVEL;
const DPR_MAX = EH_MOVEL ? 1.5 : 2;          // teto de resolução
const SHADOW_PX = EH_MOVEL ? 1024 : 2048;    // resolução do mapa de sombras

/* ---------- renderer ---------- */
const canvas3d = document.getElementById('canvas3d');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas:canvas3d,
    antialias: !EH_MOVEL,            // MSAA só no desktop; em mobile o DPR trata da nitidez
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = EH_MOVEL ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
} catch(e){
  console.warn('WebGL indisponível — fallback 2D', e);
  R3.erro = e;
}
function dimensionar(){
  if(!renderer) return;
  const dpr = Math.min(window.devicePixelRatio||1, DPR_MAX);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if(R3.camera){
    R3.camera.aspect = window.innerWidth/window.innerHeight;
    R3.camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', dimensionar);
dimensionar();

/* ---------- assets ---------- */
const loader = new GLTFLoader();
const PERSONAGENS = ['Knight','Barbarian','Mage','Ranger','Rogue','Rogue_Hooded'];
const CHAR_T = {};       // nome -> cena template (skinned)
const CLIPS = {};        // nome do clip -> AnimationClip
const TEMPL = {};        // peça de cenário -> template
const TAM = {};          // peça -> Vector3 (bounding box)

const PECAS_DUNGEON = ['floor_tile_large','floor_tile_small','floor_tile_small_broken_A',
  'floor_tile_small_weeds_A','wall','wall_corner','wall_doorway','wall_arched','wall_broken',
  'pillar','torch_mounted','banner_red','banner_blue','banner_green','banner_yellow','banner_white',
  'barrel_large','box_small','crates_stacked','chest','rubble_large'];
const PECAS_HEX = ['hex_grass','hex_water','hex_road_A','hex_road_B','hex_road_C',
  'building_blacksmith_red','building_market_red','building_tavern_red','building_home_A_red',
  'building_home_B_red','building_church_red','building_tower_A_red','building_tower_B_red',
  'building_barracks_red','building_well_red','building_windmill_red',
  'tree_single_A','tree_single_B','trees_A_medium','trees_B_medium','tree_single_A_cut',
  'rock_single_B','cloud_big','cloud_small','target','weaponrack','barrel',
  'fence_wood_straight','fence_wood_straight_gate','crate_A_big','crate_A_small','crate_B_big',
  'sack','wheelbarrow','flag_red','tent','bucket_water','bucket_empty',
  'resource_lumber','resource_stone','pallet','ladder','waterlily_A'];

function prepararSombras(obj, chao=false){
  obj.traverse(n=>{
    if(n.isMesh){ n.castShadow = !chao; n.receiveShadow = true; }
  });
}

async function carregarTudo(){
  // Carregamento PARALELO: o browser limita ligações simultâneas por host
  // (~6), por isso isto satura a rede em vez de esperar 1 ficheiro de cada
  // vez. Crucial para o primeiro arranque online (GitHub Pages) no telemóvel.

  // personagens + bibliotecas de animação (Rig_Medium partilhado)
  await Promise.all([
    ...PERSONAGENS.map(async n=>{
      const g = await loader.loadAsync(`assets/chars/${n}.glb`);
      CHAR_T[n] = g.scene;
      prepararSombras(g.scene);
    }),
    ...['Rig_Medium_General','Rig_Medium_MovementBasic'].map(async lib=>{
      const g = await loader.loadAsync(`assets/chars/${lib}.glb`);
      for(const c of g.animations) CLIPS[c.name] = c;
    }),
  ]);

  // cenário (dungeon + hex) também em paralelo
  const pacotes = [['dungeon',PECAS_DUNGEON],['hex',PECAS_HEX]];
  await Promise.all(pacotes.flatMap(([pasta,lista]) => lista.map(async n=>{
    try{
      const g = await loader.loadAsync(`assets/${pasta}/${n}.gltf`);
      TEMPL[n] = g.scene;
      prepararSombras(g.scene, n.startsWith('floor')||n.startsWith('hex'));
      TAM[n] = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
    }catch(e){ console.warn('Falhou peça', n, e); }
  })));
}

/* ---------- mapeamento jogo(px) ↔ mundo ---------- */
let MAPA = { esc:52, cx:0, cy:0 };
function gw(gx,gy){ return [ (gx-MAPA.cx)/MAPA.esc, (gy-MAPA.cy)/MAPA.esc ]; }

R3.proj = function(gx, gy, altPx=0){
  if(!R3.camera) return { x:gx, y:gy, esc:1 };
  const [wx,wz] = gw(gx,gy);
  const v = new THREE.Vector3(wx, altPx/MAPA.esc, wz).project(R3.camera);
  const W = window.innerWidth, H = window.innerHeight;
  const v2 = new THREE.Vector3(wx+1, altPx/MAPA.esc, wz).project(R3.camera);
  return {
    x:(v.x*0.5+0.5)*W, y:(-v.y*0.5+0.5)*H,
    esc: Math.abs(v2.x-v.x)*0.5*W / MAPA.esc,   // px de ecrã por px de jogo
  };
};

/* projeta uma posição já em coordenadas de MUNDO (wx,wz) + altura (unid. mundo) */
R3.projWorld = function(wx, wz, altMundo=0){
  if(!R3.camera) return { x:0, y:0 };
  const v = new THREE.Vector3(wx, altMundo, wz).project(R3.camera);
  return { x:(v.x*0.5+0.5)*window.innerWidth, y:(-v.y*0.5+0.5)*window.innerHeight };
};

const _ray = new THREE.Raycaster();
const _chao = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
R3.apontarChao = function(sx, sy){
  if(!R3.camera) return null;
  const ndc = new THREE.Vector2(sx/window.innerWidth*2-1, -(sy/window.innerHeight*2-1));
  _ray.setFromCamera(ndc, R3.camera);
  const p = new THREE.Vector3();
  if(!_ray.ray.intersectPlane(_chao, p)) return null;
  return { x: p.x*MAPA.esc + MAPA.cx, y: p.z*MAPA.esc + MAPA.cy };
};

/* ---------- entidades animadas ---------- */
const ents = new Set();
let luzes = [];          // luzes que tremeluzem {luz, base}
let nuvens = [];         // nuvens à deriva
let aDesvanecer = [];    // entidades em animação de morte
let vilaNPCs = [];       // aldeões a passear pela vila

const ESC_PERS = 0.62;    // escala global dos personagens (menor = mais pequenos)
R3.addPersonagem = function(opts){
  const base = CHAR_T[opts.modelo||'Knight'];
  if(!base || !R3.cena) return null;
  const obj = cloneSkel(base);
  const esc = (opts.escala||1) * ESC_PERS;
  obj.scale.setScalar(esc);
  const ehMonstro = !!opts.monstro;
  if(opts.tinta || opts.opacidade!==undefined || ehMonstro){
    const cor = opts.tinta ? new THREE.Color(opts.tinta) : null;
    obj.traverse(n=>{
      if(n.isMesh){
        n.material = n.material.clone();
        if(cor) n.material.color.multiply(cor);
        if(opts.opacidade!==undefined){ n.material.transparent=true; n.material.opacity=opts.opacidade; }
        if(ehMonstro){ n.material.emissive = new THREE.Color(opts.tinta||0x402030).multiplyScalar(0.3); }
      }
    });
  }
  if(ehMonstro) monstrificar(obj, opts);
  R3.cena.add(obj);
  const mixer = new THREE.AnimationMixer(obj);
  const ent = { obj, mixer, atual:null, acaoAtual:null, base:'Idle_A', escala:esc,
                offsetY: opts.float ? 0.45*esc : 0 };
  mixer.addEventListener('finished', ()=>{ R3.anim(ent, ent.base, {fade:0.18}); });
  ents.add(ent);
  if(opts.x!==undefined) R3.pos(ent, opts.x, opts.y);
  R3.anim(ent, opts.spawn ? 'Spawn_Ground' : 'Idle_A', opts.spawn?{uma:true}:{});
  return ent;
};

/* dá aspeto monstruoso a um modelo humanóide:
   postura curvada, chifres, garras, aura sombria, olhos a brilhar */
function monstrificar(obj, o){
  if(o.hunch){ obj.scale.x *= 1.2; obj.scale.z *= 1.22; obj.scale.y *= 0.86; obj.rotation.x = 0.12; }
  const escudoCor = new THREE.MeshStandardMaterial({ color:0x140f0c, roughness:0.7 });
  // chifres na cabeça (ao nível ~1.55 em unidades locais do modelo)
  const nh = o.horns||0;
  if(nh>0){
    for(const lado of [-1,1]){
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.07*nh, 0.34*nh, 6), escudoCor);
      h.position.set(0.11*lado, 1.55, 0.02);
      h.rotation.z = -lado*0.5; h.rotation.x = -0.3;
      obj.add(h);
    }
  }
  // olhos a brilhar
  const olhoMat = new THREE.MeshStandardMaterial({ color:0xffdd66, emissive:o.olhos||0xff7733, emissiveIntensity:2.2 });
  for(const lado of [-1,1]){
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045,8,8), olhoMat);
    e.position.set(0.07*lado, 1.5, 0.2);
    obj.add(e);
  }
  // aura sombria a girar no chão
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.55, 20),
    new THREE.MeshBasicMaterial({ color:o.auraCor||0x6a3fa8, transparent:true, opacity:0.4, side:THREE.DoubleSide })
  );
  aura.rotation.x = -Math.PI/2; aura.position.y = 0.03;
  obj.add(aura);
  obj.userData.aura = aura;
}

R3.pos = function(ent, gx, gy){
  if(!ent) return;
  const [wx,wz] = gw(gx,gy);
  ent.obj.position.set(wx, ent.offsetY||0, wz);
};

R3.virar = function(ent, dx, dz){
  if(!ent || (dx===0 && dz===0)) return;
  ent.obj.rotation.y = Math.atan2(dx, dz);
};

R3.anim = function(ent, nome, o={}){
  if(!ent || !CLIPS[nome]) return;
  if(ent.atual===nome && !o.uma) return;
  const acao = ent.mixer.clipAction(CLIPS[nome]);
  acao.reset();
  acao.timeScale = o.ts||1;
  if(o.uma){ acao.setLoop(THREE.LoopOnce); acao.clampWhenFinished = true; }
  else acao.setLoop(THREE.LoopRepeat);
  if(ent.acaoAtual && ent.acaoAtual!==acao) ent.acaoAtual.fadeOut(o.fade??0.15);
  acao.fadeIn(o.fade??0.15).play();
  ent.acaoAtual = acao; ent.atual = nome;
};

R3.remover = function(ent, morte=false){
  if(!ent) return;
  ents.delete(ent);
  if(morte && CLIPS['Death_A']){
    ent.mixer.removeEventListener?.('finished', ()=>{});
    R3.anim(ent, 'Death_A', {uma:true, ts:1.4});
    aDesvanecer.push({ ent, t:1.2 });
  } else if(R3.cena) R3.cena.remove(ent.obj);
};

R3.limpar = function(){
  for(const ent of [...ents]) R3.cena?.remove(ent.obj);
  ents.clear();
  for(const d of aDesvanecer) R3.cena?.remove(d.ent.obj);
  aDesvanecer = [];
};

/* ---------- helpers de cenário ---------- */
function por(nome, wx, wz, rotY=0, esc=1){
  const t = TEMPL[nome];
  if(!t) return null;
  const o = t.clone(true);
  o.position.set(wx, 0, wz);
  o.rotation.y = rotY;
  if(esc!==1) o.scale.setScalar(esc);
  R3.cena.add(o);
  return o;
}
function rndDe(seed){ let s=seed; return ()=>{ s=(s*9301+49297)%233280; return s/233280; }; }

/* ---------- cena: MASMORRA ---------- */
R3.cenaCombate = function({W,H,chaoTopo,chaoFundo,cor,rank,sala}){
  const cena = new THREE.Scene();
  R3.cena = cena;
  cena.background = new THREE.Color(0x0e0a08);
  cena.fog = new THREE.Fog(0x0e0a08, 14, 30);
  luzes = []; nuvens = []; vilaNPCs = [];

  MAPA = { esc:52, cx:W/2, cy:(chaoTopo+chaoFundo)/2 };
  const meiaW = (W/MAPA.esc)/2 + 2;
  const topoZ = (chaoTopo-MAPA.cy)/MAPA.esc;
  const fundoZ = (chaoFundo-MAPA.cy)/MAPA.esc;

  // câmara: vista de ação inclinada
  const cam = new THREE.PerspectiveCamera(46, window.innerWidth/window.innerHeight, 0.1, 80);
  const dist = Math.max(9.5, meiaW*1.15);
  cam.position.set(0, dist*0.95, fundoZ + dist*0.62);
  cam.lookAt(0, 0, (topoZ+fundoZ)/2 + 0.4);
  R3.camera = cam;
  cam.aspect = window.innerWidth/window.innerHeight; cam.updateProjectionMatrix();

  // luz
  cena.add(new THREE.HemisphereLight(0x8a7a66, 0x241a10, 0.55));
  const sol = new THREE.DirectionalLight(0xffd9a8, 1.1);
  sol.position.set(4, 9, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(SHADOW_PX, SHADOW_PX);
  sol.shadow.camera.left=-12; sol.shadow.camera.right=12;
  sol.shadow.camera.top=12; sol.shadow.camera.bottom=-12;
  cena.add(sol);

  const rnd = rndDe(sala*977 + (rank?.charCodeAt(0)||69)*131 + 7);

  // chão de lajes
  const tile = TAM['floor_tile_small'] ? TAM['floor_tile_small'].x : 2;
  for(let x=-meiaW; x<meiaW; x+=tile){
    for(let z=topoZ-1.2; z<fundoZ+2.5; z+=tile){
      const r = rnd();
      const nome = r<0.08 ? 'floor_tile_small_broken_A' : r<0.15 ? 'floor_tile_small_weeds_A' : 'floor_tile_small';
      por(nome, x+tile/2, z+tile/2, Math.floor(rnd()*4)*Math.PI/2);
    }
  }
  // parede ao fundo com variações, tochas e estandartes
  const wallW = TAM['wall'] ? TAM['wall'].x : 4;
  const corBanner = { E:'banner_white', D:'banner_green', C:'banner_blue', B:'banner_red', A:'banner_yellow', S:'banner_red' }[rank] || 'banner_white';
  let i=0;
  for(let x=-meiaW; x<meiaW; x+=wallW, i++){
    const r = rnd();
    const nome = r<0.14 ? 'wall_arched' : r<0.24 ? 'wall_broken' : r<0.34 ? 'wall_doorway' : 'wall';
    por(nome, x+wallW/2, topoZ-1.4, 0);
    if(i%2===1){
      por(corBanner, x+wallW/2, topoZ-1.25, 0);
    } else {
      const t = por('torch_mounted', x+wallW/2, topoZ-1.2, 0);
      if(t){
        const luz = new THREE.PointLight(0xe2762d, 4.5, 7, 1.6);
        luz.position.set(x+wallW/2, 1.7, topoZ-0.9);
        cena.add(luz);
        luzes.push({ luz, base:4.5, fase:rnd()*6 });
      }
    }
  }
  // pilares e adereços laterais
  por('pillar', -meiaW+0.8, topoZ-0.6);
  por('pillar',  meiaW-0.8, topoZ-0.6);
  const props = ['barrel_large','crates_stacked','box_small','rubble_large','chest'];
  for(let k=0;k<5;k++){
    por(props[Math.floor(rnd()*props.length)],
        (rnd()<0.5?-1:1)*(meiaW-0.6-rnd()*0.8),
        topoZ + 0.4 + rnd()*(fundoZ-topoZ),
        rnd()*Math.PI*2);
  }
  R3.ok3d = true;
};

/* ---------- cena: VILA ---------- */
R3.cenaVila = function({W,H}){
  const cena = new THREE.Scene();
  R3.cena = cena;
  cena.background = new THREE.Color(0x6fa8c8);
  luzes = []; nuvens = []; vilaNPCs = [];

  // Escala adaptativa: comprime a vila a um tamanho de mundo FIXO,
  // independente do ecrã (em telemóvel alto, os edifícios não se afastam).
  MAPA = { esc: Math.max(52, H*0.072), cx:W/2, cy:H*0.60 };

  // Enquadramento adaptativo: distância para caber a vila inteira na largura.
  const aspect = window.innerWidth/window.innerHeight;
  const fovV = 52 * Math.PI/180;
  const fovH = 2*Math.atan(Math.tan(fovV/2)*aspect);
  const larguraVila = 22;                    // unidades a enquadrar na horizontal
  let dist = (larguraVila/2) / Math.tan(fovH/2);
  dist = clamp(dist, 13, 52);
  const cam = new THREE.PerspectiveCamera(52, aspect, 0.1, 160);
  cam.position.set(0, dist*0.78, dist*0.72);  // alta e recuada = vê-se tudo
  cam.lookAt(0, -0.3, -0.6);
  R3.camera = cam;
  cam.updateProjectionMatrix();
  cena.fog = new THREE.Fog(0x6fa8c8, dist*0.95, dist*2.2);

  cena.add(new THREE.HemisphereLight(0xcde8ff, 0x4a5a3a, 0.75));
  const sol = new THREE.DirectionalLight(0xfff0d0, 1.25);
  sol.position.set(10, 18, 8);
  sol.castShadow = true;
  sol.shadow.mapSize.set(SHADOW_PX, SHADOW_PX);
  sol.shadow.camera.left=-22; sol.shadow.camera.right=22;
  sol.shadow.camera.top=22; sol.shadow.camera.bottom=-22;
  sol.shadow.camera.far=60;
  cena.add(sol);

  // mar
  const mar = new THREE.Mesh(
    new THREE.PlaneGeometry(120,120),
    new THREE.MeshStandardMaterial({ color:0x2e8ca8, roughness:0.4, metalness:0.1 })
  );
  mar.rotation.x = -Math.PI/2; mar.position.y = -0.22;
  mar.receiveShadow = true;
  cena.add(mar);

  // ilha hexagonal
  const hexT = TAM['hex_grass'] || new THREE.Vector3(2,0.5,1.73);
  const hw = hexT.x, hd = hexT.z;
  const rnd = rndDe(4242);
  const RAIO = 4;        // ilha mais compacta para caber toda no ecrã
  for(let q=-RAIO;q<=RAIO;q++){
    for(let r=Math.max(-RAIO,-q-RAIO); r<=Math.min(RAIO,-q+RAIO); r++){
      const wx = (q + r/2) * hw * 1.0;
      const wz = r * hd * 0.75;
      const borda = Math.max(Math.abs(q),Math.abs(r),Math.abs(-q-r))===RAIO;
      por(borda && rnd()<0.7 ? 'hex_water' : 'hex_grass', wx, wz, 0);
    }
  }

  // ---- ESTRADA em cruz (chão de terra batida) ----
  const matEstrada = new THREE.MeshStandardMaterial({ color:0x9c7a4a, roughness:1 });
  function estrada(x,z,larg,comp){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(larg,comp), matEstrada);
    m.rotation.x = -Math.PI/2; m.position.set(x,0.05,z); m.receiveShadow = true; cena.add(m);
  }
  estrada(0, 0.6, 12, 2.0);      // rua principal (horizontal)
  estrada(0, -1.8, 2.0, 7.5);    // ramo até ao portal (em profundidade)

  // ---- EDIFÍCIOS interativos em posições FIXAS e juntas ----
  // (proximidade passa a ser medida no mundo 3D — ver R3.locaisVila)
  R3.locaisVila = [];
  function marcarLocal(id, wx, wz){ R3.locaisVila.push({ id, wx, wz }); }

  // Portal (foco, ao fundo do ramo) com luz e anel a girar
  por('building_well_red', 0, -3.8, Math.PI);
  marcarLocal('portais', 0, -3.8);
  const luzP = new THREE.PointLight(0x9a7ae8, 6, 8, 1.6);
  luzP.position.set(0, 1.4, -3.8); cena.add(luzP);
  luzes.push({ luz:luzP, base:6, fase:1 });
  const anel = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.07, 10, 32),
    new THREE.MeshStandardMaterial({ color:0x9a7ae8, emissive:0x6a4fc8, emissiveIntensity:1.6 })
  );
  anel.position.set(0, 1.1, -3.8); cena.add(anel);
  nuvens.push({ obj:anel, vel:0, rod:1.2 });

  por('building_blacksmith_red', -3.3, -0.9, Math.PI*0.55); marcarLocal('ferreiro', -3.3, -0.9);
  por('building_market_red',      3.3, -0.9, -Math.PI*0.55); marcarLocal('loja', 3.3, -0.9);
  por('building_home_A_red',     -3.3,  2.1, Math.PI*0.5);  marcarLocal('base', -3.3, 2.1);
  por('target',                   3.0,  2.0, -0.5);
  por('weaponrack',               3.7,  2.2, 0.4);          marcarLocal('quadro', 3.3, 2.1);
  por('flag_red',                 0.0,  2.4, 0);            marcarLocal('npc', 0.0, 2.4);

  // ---- EDIFÍCIOS decorativos (cluster compacto) ----
  por('building_church_red',   0,   -5.0, Math.PI);
  por('building_tavern_red',  -5.0, -2.2, Math.PI*1.2);
  por('building_windmill_red', 5.0, -2.4, Math.PI*0.8);
  por('building_home_B_red',  -5.2,  1.2, Math.PI*0.5);
  por('building_home_A_red',   5.2,  1.0, -Math.PI*0.5);
  por('building_tower_A_red', -2.4,  3.6, Math.PI*0.4);
  por('building_tower_B_red',  2.4,  3.6, -Math.PI*0.4);
  por('building_well_red',    -1.4,  0.9, 0);

  // ---- poucos adereços, junto às casas ----
  por('barrel', -2.0, -0.1, 0); por('crate_A_big', 2.0, -0.1, 1);
  por('sack', -4.2, 1.4, 0.5);  por('wheelbarrow', 4.2, 1.6, -0.5);
  por('resource_lumber', -5.6, -0.6, 0); por('crate_B_big', 5.6, -0.4, 1);

  // ---- árvores no anel exterior (poucas, a emoldurar) ----
  const arv = [[-6.2,2.6],[6.2,2.6],[-6.6,-0.6],[6.6,-0.8],[-4.4,-4.2],[4.4,-4.2],[0,4.6],[-6.4,1.0]];
  for(const [x,z] of arv) por(rnd()<0.5?'tree_single_A':'trees_A_medium', x, z, rnd()*Math.PI*2, 0.9+rnd()*0.4);
  por('rock_single_B', -5.8, 2.8, 1); por('rock_single_B', 5.8, -2.0, 3);
  // nenúfares no mar
  for(let k=0;k<4;k++) por('waterlily_A', (rnd()*2-1)*9, (rnd()*2-1)*7, rnd()*6, 1);

  // nuvens à deriva (mais densas)
  for(let k=0;k<8;k++){
    const n = por(k%2?'cloud_big':'cloud_small', (rnd()*2-1)*16, 0, rnd()*Math.PI, 1+rnd()*0.6);
    if(n){ n.position.y = 6+rnd()*3; nuvens.push({ obj:n, vel:0.2+rnd()*0.35, rod:0 }); }
  }

  // ALDEÕES a passear (dão vida à vila)
  const modelosAldeao = ['Mage','Ranger','Rogue','Barbarian','Knight','Mage'];
  const limite = (RAIO-1.6)*hw*0.7;
  for(let k=0;k<6;k++){
    const md = modelosAldeao[k % modelosAldeao.length];
    const ang = rnd()*Math.PI*2, rr = rnd()*limite;
    const ent = R3.addPersonagem({ modelo:md, escala:0.42, tinta:0xeeeeee });
    if(!ent) continue;
    ent.obj.position.set(Math.cos(ang)*rr, 0, Math.sin(ang)*rr*0.75);
    R3.anim(ent, 'Walking_A', {fade:0});
    vilaNPCs.push({ ent, tx:0, tz:0, vel:0.7+rnd()*0.6, limite, pausa:0 });
    novoDestinoAldeao(vilaNPCs[vilaNPCs.length-1], rnd);
  }
  R3.ok3d = true;
};

function novoDestinoAldeao(a, rnd){
  rnd = rnd || Math.random;
  const ang = rnd()*Math.PI*2, rr = rnd()*a.limite;
  a.tx = Math.cos(ang)*rr;
  a.tz = Math.sin(ang)*rr*0.75;
}

/* ---------- shake da câmara ---------- */
let shakeV = 0;
R3.shake = v => { shakeV = Math.max(shakeV, v); };

/* ---------- tick ---------- */
R3.tick = function(dt){
  if(!R3.cena || !R3.camera) return;
  for(const ent of ents){
    ent.mixer.update(dt);
    if(ent.obj.userData.aura) ent.obj.userData.aura.rotation.z += dt*1.5;
  }
  for(const d of [...aDesvanecer]){
    d.ent.mixer.update(dt);
    d.t -= dt;
    if(d.t<=0){ R3.cena.remove(d.ent.obj); aDesvanecer.splice(aDesvanecer.indexOf(d),1); }
  }
  const t = performance.now()/1000;
  for(const f of luzes) f.luz.intensity = f.base * (0.78 + Math.sin(t*9+f.fase)*0.22);
  for(const n of nuvens){
    if(n.vel){ n.obj.position.x += n.vel*dt; if(n.obj.position.x>16) n.obj.position.x=-16; }
    if(n.rod) n.obj.rotation.z += n.rod*dt;
  }
  // aldeões: andam entre destinos, com pausas
  for(const a of vilaNPCs){
    const o = a.ent.obj;
    if(a.pausa>0){ a.pausa-=dt; if(a.pausa<=0){ novoDestinoAldeao(a); R3.anim(a.ent,'Walking_A',{fade:0.2}); } continue; }
    const dx=a.tx-o.position.x, dz=a.tz-o.position.z, d=Math.hypot(dx,dz);
    if(d<0.3){ a.pausa=1+Math.random()*2.5; R3.anim(a.ent,'Idle_A',{fade:0.2}); continue; }
    o.position.x += dx/d*a.vel*dt;
    o.position.z += dz/d*a.vel*dt;
    o.rotation.y = Math.atan2(dx, dz);
  }
  if(shakeV>0){
    R3.camera.position.x += (Math.random()-0.5)*shakeV*0.02;
    R3.camera.position.y += (Math.random()-0.5)*shakeV*0.015;
    shakeV = Math.max(0, shakeV - dt*36);
  }
  renderer.render(R3.cena, R3.camera);
};

/* ---------- arranque ---------- */
if(renderer){
  carregarTudo()
    .then(()=>{
      R3.ok = true;
      document.body.classList.add('r3');
      console.log('R3 pronto (3D ativo)');
      window.dispatchEvent(new Event('r3-pronto'));
    })
    .catch(e=>{ R3.erro = e; console.warn('3D indisponível — fallback 2D', e); });
}
