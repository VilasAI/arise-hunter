/* ============ MOTOR DE COMBATE (canvas) ============
   Masmorras medievais · poderes com tiers · estados
   (queimadura, gelo, terror) · escudo · fúria · runas  */
'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let C = null;          // estado do combate atual
let rafId = 0, ultimoT = 0;

const tem3D = ()=> !!(window.R3 && window.R3.ok);

/* sprite (vetorial 2D) -> modelo 3D KayKit + tinta + escala.
   Os "monstros" passam a ser caçadores/cultistas corrompidos da Fenda. */
const MODELO3D = {
  goblin:    { modelo:'Rogue',     tinta:0x6fae3a, escala:0.85, hunch:true,  horns:0.7, olhos:0xffd23a, auraCor:0x4a8a2a },
  lobo:      { modelo:'Barbarian', tinta:0x9aa4b0, escala:0.82, hunch:true, horns:0.5, olhos:0xff5a3a, auraCor:0x5a5a66 },
  formiga:   { modelo:'Rogue',     tinta:0xb84a2a, escala:0.78, hunch:true,  horns:0.6, olhos:0xffaa33, auraCor:0x7a3a1a },
  aranha:    { modelo:'Mage',      tinta:0x4a3a5a, escala:0.8,  hunch:true,  horns:0.4, olhos:0xff3a3a, auraCor:0x2a1a3a },
  esqueleto: { modelo:'Knight',    tinta:0xd8d0bc, escala:0.95, hunch:false, horns:0,   olhos:0x88ddff, auraCor:0x4a5a6a },
  espectro:  { modelo:'Mage',      tinta:0xaecdf0, opacidade:0.55, escala:0.95, float:true, horns:0, olhos:0xbfe2ff, auraCor:0x5a7aa8 },
  orc:       { modelo:'Barbarian', tinta:0x5d8a3c, escala:1.1,  hunch:true,  horns:1.0, olhos:0xff7733, auraCor:0x3a5a22 },
  orcmago:   { modelo:'Mage',      tinta:0x7a5aa8, escala:0.95, hunch:true,  horns:0.8, olhos:0xc89aff, auraCor:0x4a2a7a },
  draconiano:{ modelo:'Barbarian', tinta:0x3c8a82, escala:1.12, hunch:true,  horns:1.2, olhos:0xffaa33, auraCor:0x1a5a52 },
  golem:     { modelo:'Knight',    tinta:0x9ecfe6, escala:1.3,  hunch:false, horns:0,   olhos:0x7af0ff, auraCor:0x2a6088 },
  cavaleiro: { modelo:'Knight',    tinta:0x3a3448, escala:1.05, hunch:false, horns:0.9, olhos:0xc89aff, auraCor:0x4a2a7a },
  sacerdote: { modelo:'Mage',      tinta:0x3a3346, escala:1.0,  hunch:true,  horns:0.6, olhos:0xff4a4a, auraCor:0x5a1a2a },
};
function modelo3dDe(sprite){ return MODELO3D[sprite] || MODELO3D.goblin; }

/* (re)constrói a cena 3D de combate + Vigia + sombras aliadas */
function montarCena3d(){
  if(!tem3D() || !C) return;
  const m = C.masmorra;
  R3.limpar();
  R3.cenaCombate({ W:C.W, H:C.H, chaoTopo:C.chaoTopo, chaoFundo:C.chaoFundo,
                   cor:m.cor, rank:m.rank, sala:C.sala });
  const j = C.jogador;
  j.ent3d = R3.addPersonagem({ modelo:'Knight', x:j.x, y:j.y, spawn:true });
  j.lock3d = 1.0;
  for(const a of C.aliados){
    const md = modelo3dDe(a.sprite);
    a.ent3d = R3.addPersonagem({ modelo:md.modelo, tinta:0x9a6fd0, opacidade:0.85,
                                 escala:0.92, x:a.x, y:a.y, spawn:true });
    a.lock3d = 1.0;
  }
}

function redimensionar(){
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w*dpr; canvas.height = h*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(C){ C.W=w; C.H=h; C.chaoTopo=h*0.36; C.chaoFundo=h*0.90; if(!C.modo3d) prerenderCenario(); }
}
window.addEventListener('resize', redimensionar);

/* ---------- arranque ---------- */
function iniciarCombate(masmorra){
  const t = statsTotais();
  redimensionar();
  const w = window.innerWidth, h = window.innerHeight;
  C = {
    masmorra, sala:1, totalSalas:masmorra.salas,
    W:w, H:h, chaoTopo:h*0.36, chaoFundo:h*0.90,
    fase:'luta', tempoFase:0, shake:0, tempo:0,
    jogador:{
      x:w*0.25, y:h*0.65, hp:t.hpMax, mp:t.mpMax,
      cdAtq:0, cdEsq:0, invul:0, atacando:0, dirAtq:1,
      alvoX:null, alvoY:null, andando:false,
    },
    joy:null,                         // joystick flutuante {id,bx,by,dx,dy,mag}
    stats:t,
    escudo:0, escudoMax:0,
    buffFuria:0, buffGelo:0, lentoJog:null,
    cdPoder:{},                       // id -> segundos restantes
    inimigos:[], aliados:[], projeteis:[], particulas:[], numeros:[],
    pocas:[], orbes:[], aneisBoss:[],  // efeitos das habilidades dos bosses
    rastos:[], tiros:[],               // rasto da esquiva · projéteis inimigos
    hitstop:0, danoFlash:0,            // micro-pausa nos críticos · flash ao levar dano
    mortes:0, lootPend:[],
    auto:G.auto,
    modo3d: tem3D(),
  };
  criarAliados();
  if(C.modo3d) montarCena3d(); else prerenderCenario();
  povoarSala();
  montarSlotsPoder();
  document.getElementById('btn-auto').classList.toggle('ligado', C.auto);
  document.getElementById('hud-boss').hidden = true;
  document.getElementById('hud-escudo').hidden = true;
  mostrarEcra('ecra-combate');
  ultimoT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function criarAliados(){
  for(const s of sombrasAtivas()){
    const st = statsSombra(s);
    C.aliados.push({
      tipo:'sombra', nome:s.nome, sprite:SOMBRAS_BASE[s.rank].sprite,
      x:C.jogador.x - rnd(40,90), y:C.jogador.y + rnd(-50,50),
      hp:st.hp, hpMax:st.hp, atq:st.atq, vel:90, cd:0, raio:16,
    });
  }
}

function povoarSala(){
  C.inimigos.length = 0;
  if(!C.modo3d) prerenderCenario();         // cada sala tem variação própria
  const m = C.masmorra, rank = m.rank;
  const ultima = C.sala === C.totalSalas;
  const meio = C.sala === Math.ceil(C.totalSalas/2) && !ultima;

  if(ultima){
    const b = BOSSES[rank];
    const boss = criarInimigo(b, rank, 'boss');
    if(m.despertar){ boss.hp = Math.round(boss.hp*1.3); boss.hpMax = boss.hp; boss.nome = 'Guardião da Provação'; }
    C.inimigos.push(boss);
    document.getElementById('hud-boss').hidden = false;
    document.getElementById('boss-nome').textContent = boss.nome;
  } else {
    const qtd = 3 + Math.floor(C.sala*0.7);
    for(let i=0;i<qtd;i++){
      C.inimigos.push(criarInimigo(escolher(MONSTROS[rank]), rank, 'normal', i));
    }
    if(meio){
      const elite = {...escolher(MONSTROS[rank])};
      elite.nome = elite.nome + ' Alfa';
      C.inimigos.push(criarInimigo(elite, rank, 'elite'));
    }
    document.getElementById('hud-boss').hidden = true;
  }
  document.getElementById('hud-sala').textContent =
    ultima ? `SALA ${C.sala}/${C.totalSalas} — BOSS` : `Sala ${C.sala}/${C.totalSalas}`;
}

function criarInimigo(base, rank, classe, i=0){
  const st = statsInimigo(rank, classe, base.mHp, base.mDano, C.sala);
  const lado = Math.random()<0.8 ? 1 : -1;
  const e = {
    tipo:'inimigo', classe, nome:base.nome,
    sprite: base.sprite, adornos: base.adornos||null, hab: base.hab||null,
    ranged: !!base.ranged, recupera:0, homeX:undefined, homeY:undefined,
    x: lado>0 ? C.W + 40 + i*30 : -40 - i*30,
    y: rnd(C.chaoTopo+30, C.chaoFundo-10),
    hp:st.hp, hpMax:st.hp, atq:st.dano, def:st.def,
    vel: base.vel * (classe==='boss'?0.85:1),
    cd: rnd(0.5,1.5), windup:0, habAtiva:null, investe:null,
    raio: classe==='boss'?34 : classe==='elite'?24 : 16,
    flash:0,
    queimar:null,          // {t, dps}
    lento:null,            // {t, fator}
    congelado:0,           // segundos
    ent3d:null, lock3d:0, anim3d:'',
  };
  if(C.modo3d){
    const md = modelo3dDe(base.sprite);
    const escClasse = classe==='boss'?1.7 : classe==='elite'?1.25 : 1;
    e.ent3d = R3.addPersonagem({
      modelo:md.modelo, tinta:md.tinta, opacidade:md.opacidade,
      escala:(md.escala||1)*escClasse, x:e.x, y:e.y, spawn:true,
      monstro:true, horns:(md.horns||0)*(classe==='boss'?1.5:1),
      hunch:md.hunch, float:md.float, olhos:md.olhos, auraCor:md.auraCor,
    });
    e.lock3d = 0.9;
  }
  return e;
}

/* ---------- slots de poderes (HUD) ----------
   Direcionais (lâmina/investida/corrente): segurar o botão e arrastar
   mostra a mira; largar dispara nessa direção; toque = alvo mais próximo.
   Instantâneos: disparam logo no pointerdown.                          */
const PODERES_DIRECIONAIS = { lamina:300, investida:280, corrente:240 }; // alcance da mira
let mira = null;   // {pid, slot, id, sx, sy, dx, dy, drag}

function montarSlotsPoder(){
  const cont = document.getElementById('slots-poder');
  cont.innerHTML = '';
  G.equipadosPoder.forEach((id, i)=>{
    if(!id || !poderAprendido(id)) return;
    const p = PODERES[id];
    const b = document.createElement('button');
    b.className = 'slot-poder';
    b.dataset.slot = i;
    b.innerHTML = `${ic(p.icone,28)}<div class="cd-sweep" style="--cd:0"></div><small>T${poderTier(id)}</small>`;
    b.addEventListener('pointerdown', e=>{
      e.preventDefault();
      if(!C || C.fase!=='luta' || C.auto) return;
      if(PODERES_DIRECIONAIS[id] && (C.cdPoder[id]||0)<=0 && C.jogador.mp >= (p.mp||0)){
        // começa a mira por arrasto
        mira = { pid:e.pointerId, slot:i, id, sx:e.clientX, sy:e.clientY,
                 dx:C.jogador.dirAtq||1, dy:0, drag:false };
      } else {
        usarPoder(i);
      }
    });
    cont.appendChild(b);
  });
}

window.addEventListener('pointermove', e=>{
  if(!mira || e.pointerId!==mira.pid) return;
  const dx = e.clientX-mira.sx, dy = e.clientY-mira.sy;
  const d = Math.hypot(dx,dy);
  if(d > 18){ mira.drag = true; mira.dx = dx/d; mira.dy = dy/d; }
});
function fimMira(e){
  if(!mira || e.pointerId!==mira.pid) return;
  const m = mira; mira = null;
  if(!C || C.fase!=='luta') return;
  if(m.drag) usarPoder(m.slot, {x:m.dx, y:m.dy});
  else usarPoder(m.slot);
}
window.addEventListener('pointerup', fimMira);
window.addEventListener('pointercancel', fimMira);

function atualizarSlotsPoder(){
  document.querySelectorAll('.slot-poder').forEach(b=>{
    const id = G.equipadosPoder[+b.dataset.slot];
    if(!id) return;
    const cdMax = cooldownPoder(id, C.stats.cdr) || 0.01;
    const resta = C.cdPoder[id] || 0;
    b.querySelector('.cd-sweep').style.setProperty('--cd', Math.round(resta/cdMax*100));
    const semMana = C.jogador.mp < (PODERES[id].mp||0);
    b.classList.toggle('pronto', resta<=0 && !semMana);
    b.classList.toggle('sem-mana', semMana);
    // número de cooldown vs tier
    const lbl = b.querySelector('small');
    if(resta>0){
      lbl.textContent = resta<9.95 ? resta.toFixed(1) : String(Math.ceil(resta));
      lbl.classList.add('cd-num');
    } else {
      lbl.textContent = 'T'+poderTier(id);
      lbl.classList.remove('cd-num');
    }
  });
}

/* ---------- controlos táteis ----------
   Metade ESQUERDA: joystick flutuante analógico (movimento livre).
   Metade DIREITA do canvas: toque = ataque · deslize = esquiva.
   Botões HTML (ataque/poderes) respondem no pointerdown.        */
const JOY_RAIO = 56;     // alcance máximo do manípulo
let toqueDir = null;     // toque na zona direita (tap vs swipe)

canvas.addEventListener('pointerdown', e=>{
  if(!C || C.fase==='fim' || C.auto) return;
  if(e.clientX < C.W*0.45){
    // joystick flutuante: nasce onde o dedo toca
    if(!C.joy) C.joy = { id:e.pointerId, bx:e.clientX, by:e.clientY, dx:0, dy:0, mag:0 };
  } else {
    toqueDir = { id:e.pointerId, x:e.clientX, y:e.clientY, t:performance.now() };
  }
});
canvas.addEventListener('pointermove', e=>{
  if(!C) return;
  if(C.joy && e.pointerId===C.joy.id){
    let dx = e.clientX - C.joy.bx, dy = e.clientY - C.joy.by;
    const d = Math.hypot(dx,dy);
    if(d > JOY_RAIO){ dx = dx/d*JOY_RAIO; dy = dy/d*JOY_RAIO; }
    C.joy.dx = dx; C.joy.dy = dy;
    C.joy.mag = Math.min(1, d/JOY_RAIO);
  }
});
function soltarPointer(e){
  if(!C) return;
  if(C.joy && e.pointerId===C.joy.id){ C.joy = null; return; }
  if(toqueDir && e.pointerId===toqueDir.id){
    const dx = e.clientX-toqueDir.x, dy = e.clientY-toqueDir.y;
    const dist = Math.hypot(dx,dy);
    const dur = performance.now()-toqueDir.t;
    if(dist > 34 && dur < 400) esquivar(dx/dist, dy/dist);   // deslize rápido
    else if(dist <= 34 && C.fase==='luta') atacar();          // toque simples
    toqueDir = null;
  }
}
canvas.addEventListener('pointerup', soltarPointer);
canvas.addEventListener('pointercancel', soltarPointer);

/* botão grande de ataque: resposta imediata no pointerdown */
document.getElementById('btn-atacar').addEventListener('pointerdown', e=>{
  e.preventDefault();
  if(C && C.fase==='luta' && !C.auto) atacar();
});
/* botão de esquiva: rola na direção do joystick (ou do olhar) */
document.getElementById('btn-esquiva').addEventListener('pointerdown', e=>{
  e.preventDefault();
  if(C && C.fase==='luta' && !C.auto) esquivar();
});

document.getElementById('btn-auto').addEventListener('click', ()=>{
  if(!C) return;
  C.auto = !C.auto; G.auto = C.auto; guardar();
  if(C.auto){ C.joy = null; mira = null; }
  document.getElementById('btn-auto').classList.toggle('ligado', C.auto);
  toast(C.auto ? 'Auto-combate LIGADO' : 'Auto-combate desligado');
});
document.getElementById('btn-fugir').addEventListener('click', ()=>{
  if(!C) return;
  terminarCombate(false, true);
});

/* ---------- dano do jogador (com Fúria) ---------- */
function atqAtual(){
  const t=C.stats;
  let mult = 1;
  if(C.buffFuria>0){
    const f = PODERES.furia, ef = efeitoPoder('furia');
    mult += f.base.dano * ef;
  }
  return t.atq * mult;
}
function velAtqAtual(){
  const t=C.stats;
  let mult = t.velAtq;
  if(C.buffFuria>0) mult *= 1 + PODERES.furia.base.vel;
  return mult;
}
function defAtual(){
  const t=C.stats;
  let def = t.def;
  if(C.buffGelo>0){
    const g = PODERES.gelo, tal = talentoDe('gelo');
    def += t.def * g.base.defBonus * ((tal && tal.mod.def)||1);
  }
  return def;
}

/* ---------- ações do jogador ---------- */
function inimigoMaisProximo(px,py){
  const ox = px!==undefined?px:C.jogador.x, oy = py!==undefined?py:C.jogador.y;
  let melhor=null, md=1e9;
  for(const e of C.inimigos){
    const d = Math.hypot(e.x-ox, e.y-oy);
    if(d<md){ md=d; melhor=e; }
  }
  return melhor;
}

/* golpe no lugar: auto-mira no inimigo ao alcance, NUNCA arrasta o jogador */
function atacar(){
  const j = C.jogador;
  if(j.cdAtq>0) return;
  j.cdAtq = 0.55 / velAtqAtual();
  j.atacando = 0.18;
  if(j.ent3d){ R3.anim(j.ent3d, 'Throw', {uma:true, ts:1.7}); j.lock3d = 0.3; }
  const alvo = inimigoMaisProximo();
  if(alvo){
    j.dirAtq = alvo.x>=j.x?1:-1;                     // vira-se para o alvo
    const d = Math.hypot(alvo.x-j.x, alvo.y-j.y);
    if(d <= BAL.combate.alcanceAtaque + alvo.raio){
      golpeConecta(alvo);
      return;
    }
  }
  // golpe no ar (falhou o alcance)
  for(let i=0;i<4;i++) particula(j.x + j.dirAtq*42, j.y-26, '#d8c9a8', 2.5, 0.22);
}

/* Roubo de Vida (stat + Sede de Sangue + Runa Sangrenta) */
function aplicarRoubo(dano){
  const j=C.jogador, t=C.stats;
  if(t.roubo<=0) return;
  const cura = dano * t.roubo/100;
  if(cura < 0.5 || j.hp >= t.hpMax) return;
  j.hp = Math.min(t.hpMax, j.hp + cura);
  if(cura >= 1) numero(j.x, j.y-74, '+'+Math.round(cura), '#94bd52', 12);
}

function golpeConecta(alvo){
  const t=C.stats;
  const g = calcularGolpe(atqAtual(), t.crit, t.critDano, t.pen, alvo.def);
  ferirInimigo(alvo, g.dano, g.crit, '#d8c9a8');
  aplicarRoubo(g.dano);
  // runas da arma no ataque básico
  if(runaEquipada('brasa')) aplicarQueimadura(alvo, atqAtual()*BAL.runas.queimaDano, BAL.runas.queimaDur);
  if(runaEquipada('gelo')) aplicarLentidao(alvo, BAL.runas.geloLentidao, BAL.runas.geloDur);
  if(runaEquipada('trovao') && Math.random() < BAL.runas.trovaoChance){
    cadeiaRelampago(alvo, atqAtual()*BAL.runas.trovaoDano, 2, 0.7);
  }
  for(let i=0;i<10;i++) particula(alvo.x, alvo.y, '#d8c9a8', 3.5, 0.35);
  C.shake = Math.max(C.shake, g.crit?8:4);
}

function esquivar(nx,ny){
  const j=C.jogador, t=C.stats, B=BAL.combate;
  if(j.cdEsq>0) return;
  // sem direção explícita: usa o joystick, senão a direção do olhar
  if(nx===undefined){
    if(C.joy && C.joy.mag>0.08){
      const m = Math.hypot(C.joy.dx,C.joy.dy)||1;
      nx = C.joy.dx/m; ny = C.joy.dy/m;
    } else { nx = j.dirAtq||1; ny = 0; }
  }
  j.cdEsq = B.dashCd * (1 - t.cdr/100);
  j.invul = B.dashInvul;
  j.alvoX = clamp(j.x + nx*B.dashDist, 30, C.W-30);
  j.alvoY = clamp(j.y + ny*B.dashDist, C.chaoTopo, C.chaoFundo);
  if(Math.abs(nx) > 0.2) j.dirAtq = nx>=0?1:-1;
  if(j.ent3d){ R3.anim(j.ent3d, 'Jump_Full_Short', {uma:true, ts:1.6}); j.lock3d = 0.4; R3.virar(j.ent3d, nx, ny); }
  C.shake = Math.max(C.shake, 2.5);
  for(let i=0;i<8;i++) particula(j.x, j.y, '#a3937a', 3, 0.4);
}

/* ---------- estados nos inimigos ---------- */
function aplicarQueimadura(e, dps, dur){
  const tal = talentoDe('brasas');
  e.queimar = { t: dur * ((tal && tal.mod.dur)||1), dps };
}
function aplicarLentidao(e, fator, dur){
  if(!e.lento || fator >= e.lento.fator) e.lento = { t:dur, fator };
}
function cadeiaRelampago(origem, dano, saltos, decai){
  let atual = origem, feitos = new Set([origem]);
  let d = dano;
  for(let i=0;i<=saltos;i++){
    const g = calcularGolpe(d, C.stats.crit, C.stats.critDano, C.stats.pen, atual.def);
    ferirInimigo(atual, g.dano, g.crit, '#e8c84a');
    raioVisual(i===0?C.jogador:[...feitos][feitos.size-2]||C.jogador, atual);
    // próximo alvo
    let prox=null, md=220;
    for(const e of C.inimigos){
      if(feitos.has(e)) continue;
      const dist = Math.hypot(e.x-atual.x, e.y-atual.y);
      if(dist<md){ md=dist; prox=e; }
    }
    if(!prox) break;
    feitos.add(prox); atual = prox; d *= decai;
  }
}
function raioVisual(a,b){
  C.projeteis.push({ tipo:'raio', x1:a.x, y1:a.y-30, x2:b.x, y2:b.y-20, t:0.18 });
}

/* ---------- usar poderes ----------
   dir (opcional): {x,y} normalizado vindo da mira por arrasto. */
function usarPoder(slot, dir){
  const id = G.equipadosPoder[slot];
  if(!id || !poderAprendido(id)) return;
  const j=C.jogador, t=C.stats, p=PODERES[id], ef=efeitoPoder(id), tal=talentoDe(id);
  if((C.cdPoder[id]||0) > 0){ numero(j.x, j.y-50, 'Recarga…', '#a3937a', 13); return; }
  if(j.mp < (p.mp||0)){ numero(j.x, j.y-50, 'Sem mana', '#74a6d4', 13); return; }

  const alvo = inimigoMaisProximo();
  // sem direção dada, os direcionais precisam de um alvo; o passo precisa sempre
  if((id==='passo' || (!dir && ['lamina','investida','corrente'].includes(id))) && !alvo) return;
  if(dir && Math.abs(dir.x) > 0.2) j.dirAtq = dir.x>=0 ? 1 : -1;

  j.mp -= p.mp||0;
  C.cdPoder[id] = cooldownPoder(id, t.cdr);

  switch(id){
    case 'lamina': {
      const n = (tal && tal.mod.projeteis) || 1;
      for(let k=0;k<n;k++){
        if(dir){
          // disparo em linha reta na direção da mira
          C.projeteis.push({
            tipo:'lamina', x:j.x, y:j.y-30+k*12,
            vx:dir.x*560, vy:dir.y*560, t:0.9,
            dano: atqAtual()*p.base.dano*ef, cor:p.cor,
          });
        } else {
          C.projeteis.push({
            tipo:'lamina', x:j.x, y:j.y-30+k*14, alvo,
            dano: atqAtual()*p.base.dano*ef, vel:560, cor:p.cor,
          });
        }
      }
      break;
    }
    case 'investida': {
      const vx = dir ? dir.x : alvo.x-j.x, vy = dir ? dir.y : alvo.y-j.y;
      const d = Math.hypot(vx,vy)||1;
      const fimX = clamp(j.x+vx/d*280, 30, C.W-30);
      const fimY = clamp(j.y+vy/d*280, C.chaoTopo, C.chaoFundo);
      const dx = vx, dy = vy;
      // fere todos os inimigos perto da linha
      for(const e of [...C.inimigos]){
        const dist = distSegmento(e.x,e.y, j.x,j.y, fimX,fimY);
        if(dist < 52){
          const g = calcularGolpe(atqAtual()*p.base.dano*ef, t.crit, t.critDano, t.pen, e.def);
          ferirInimigo(e, g.dano, g.crit, p.cor);
          aplicarRoubo(g.dano);
        }
      }
      for(let i=0;i<14;i++) particula(j.x+dx/d*i*20, j.y+dy/d*i*20, p.cor, 4, 0.4);
      j.x = fimX; j.y = fimY; j.invul = Math.max(j.invul, 0.25);
      j.alvoX = null;
      break;
    }
    case 'escudo': {
      C.escudoMax = Math.round(t.hpMax * p.base.absorve * ef);
      C.escudo = C.escudoMax;
      document.getElementById('hud-escudo').hidden = false;
      for(let i=0;i<14;i++) particula(j.x, j.y-30, p.cor, 4, 0.5);
      break;
    }
    case 'corrente': {
      // com mira: primeiro alvo é o inimigo mais próximo do feixe apontado
      let primeiro = alvo;
      if(dir){
        let melhor = 1e9;
        for(const e2 of C.inimigos){
          const ex=e2.x-j.x, ey=e2.y-j.y;
          const ao_longo = ex*dir.x + ey*dir.y;          // projeção na direção
          if(ao_longo < 0 || ao_longo > 320) continue;
          const perp = Math.abs(ex*dir.y - ey*dir.x);    // distância ao feixe
          if(perp < 70 && ao_longo < melhor){ melhor = ao_longo; primeiro = e2; }
        }
      }
      if(!primeiro){ j.mp += p.mp||0; C.cdPoder[id] = 0; return; }  // sem alvo: devolve
      const saltos = p.base.saltos + ((tal && tal.mod.saltosExtra)||0);
      cadeiaRelampago(primeiro, atqAtual()*p.base.dano*ef, saltos, p.base.decai);
      break;
    }
    case 'brasas': {
      for(const e of [...C.inimigos]){
        if(Math.hypot(e.x-j.x,e.y-j.y) <= p.base.raio + e.raio){
          const g = calcularGolpe(atqAtual()*p.base.dano*ef, t.crit, t.critDano, t.pen, e.def);
          ferirInimigo(e, g.dano, g.crit, PODERES.brasas.cor);
          aplicarQueimadura(e, atqAtual()*p.base.queima*ef, p.base.dur);
        }
      }
      for(let i=0;i<26;i++){
        const a = (i/26)*Math.PI*2;
        particula(j.x+Math.cos(a)*40, j.y+Math.sin(a)*24, p.cor, 5, 0.55, Math.cos(a)*220, Math.sin(a)*130);
      }
      C.shake = Math.max(C.shake, 9);
      C.anelSkill = { x:j.x, y:j.y, t:0.45, cor:p.cor };
      break;
    }
    case 'gelo': {
      const congela = p.base.congela + ((tal && tal.mod.congelaExtra)||0);
      for(const e of C.inimigos){
        if(Math.hypot(e.x-j.x,e.y-j.y) <= p.base.raio + e.raio){
          e.congelado = Math.max(e.congelado, congela);
          aplicarLentidao(e, p.base.lentidao, p.base.dur);
          for(let i=0;i<6;i++) particula(e.x, e.y-16, p.cor, 3.5, 0.5);
        }
      }
      C.buffGelo = p.base.dur;
      C.anelSkill = { x:j.x, y:j.y, t:0.45, cor:p.cor };
      break;
    }
    case 'furia': {
      C.buffFuria = p.base.dur + ((tal && tal.mod.durExtra)||0);
      for(let i=0;i<16;i++) particula(j.x, j.y-30, p.cor, 4, 0.6);
      numero(j.x, j.y-80, 'FÚRIA!', p.cor, 18);
      break;
    }
    case 'passo': {
      const atras = alvo.x + (alvo.x>=j.x?1:-1)*(alvo.raio+30);
      for(let i=0;i<8;i++) particula(j.x, j.y-20, p.cor, 3.5, 0.4);
      j.x = clamp(atras, 30, C.W-30); j.y = alvo.y;
      j.invul = Math.max(j.invul, p.base.invul);
      j.alvoX = null;
      const critP = (tal && tal.mod.critGarantido) ? 100 : t.crit;
      const g = calcularGolpe(atqAtual()*p.base.dano*ef, critP, t.critDano, t.pen, alvo.def);
      ferirInimigo(alvo, g.dano, g.crit, p.cor);
      aplicarRoubo(g.dano);
      for(let i=0;i<8;i++) particula(j.x, j.y-20, p.cor, 3.5, 0.4);
      break;
    }
  }
}

/* distância de um ponto a um segmento (para a Investida) */
function distSegmento(px,py, ax,ay, bx,by){
  const dx=bx-ax, dy=by-ay, l2=dx*dx+dy*dy;
  if(!l2) return Math.hypot(px-ax,py-ay);
  let u = ((px-ax)*dx+(py-ay)*dy)/l2;
  u = clamp(u,0,1);
  return Math.hypot(px-(ax+u*dx), py-(ay+u*dy));
}

function ferirInimigo(e, dano, crit, cor){
  e.hp -= dano; e.flash = 0.12;
  // knockback: empurra o inimigo para longe do Vigia (bosses quase imunes)
  const j2 = C.jogador;
  const kdx = e.x-j2.x, kdy = e.y-j2.y, kd = Math.hypot(kdx,kdy)||1;
  const kb = BAL.combate.knockback * (e.classe==='boss' ? 0.25 : e.classe==='elite' ? 0.5 : 1);
  e.x = clamp(e.x + kdx/kd*kb, 20, C.W-20);
  e.y = clamp(e.y + kdy/kd*kb, C.chaoTopo, C.chaoFundo);
  // crítico: micro hit-stop dramático
  if(crit) C.hitstop = Math.max(C.hitstop, 0.06);
  if(e.ent3d && e.hp>0){ R3.anim(e.ent3d, crit?'Hit_B':'Hit_A', {uma:true}); e.lock3d = 0.35; }
  numero(e.x, e.y - e.raio - 14, crit ? dano+'!' : dano, crit?'#e8c84a':cor, crit?24:15);
  if(e.hp<=0){
    C.mortes++;
    G.contadores.mortes++;
    // Sede de Sangue: cura ao abater
    if(poderTier('sede')){
      const tal = talentoDe('sede');
      const cura = C.stats.hpMax * PODERES.sede.base.curaKill * efeitoPoder('sede') * ((tal && tal.mod.kill)||1);
      C.jogador.hp = Math.min(C.stats.hpMax, C.jogador.hp + cura);
    }
    for(let i=0;i<16;i++) particula(e.x,e.y,'#8a6fc8',4,0.6);
    if(e.ent3d) R3.remover(e.ent3d, true);
    C.inimigos = C.inimigos.filter(x=>x!==e);
    if(e.classe==='elite'){ C.lootPend.push('elite'); }
  }
}

/* ---------- auto-combate ---------- */
function autoIA(dt){
  const j=C.jogador;
  const alvo = inimigoMaisProximo();
  if(!alvo) return;
  const d = Math.hypot(alvo.x-j.x, alvo.y-j.y);
  const perigo = C.inimigos.find(e=> e.windup>0 && e.windup<0.3 && Math.hypot(e.x-j.x,e.y-j.y)<70);
  if(perigo && j.cdEsq<=0){ const a=rnd(0,Math.PI*2); esquivar(Math.cos(a),Math.sin(a)); return; }
  // usa poderes prontos com critério simples
  for(let i=0;i<G.equipadosPoder.length;i++){
    const id = G.equipadosPoder[i];
    if(!id || (C.cdPoder[id]||0)>0) continue;
    const p = PODERES[id];
    if(j.mp < (p.mp||0)) continue;
    if(id==='escudo' && j.hp > C.stats.hpMax*0.55) continue;
    if(id==='furia' && !C.inimigos.some(e=>e.classe!=='normal')) continue;
    if(['brasas','gelo'].includes(id) && C.inimigos.length<3) continue;
    if(d<200 || ['lamina','corrente'].includes(id)){ usarPoder(i); return; }
  }
  // aproxima-se a andar (sem teleporte) e ataca quando está ao alcance
  const alc = BAL.combate.alcanceAtaque + alvo.raio;
  if(d > alc - 12){
    const v = BAL.combate.velJogador * C.stats.velMov * dt;
    j.x = clamp(j.x + (alvo.x-j.x)/d*v, 24, C.W-24);
    j.y = clamp(j.y + (alvo.y-j.y)/d*v, C.chaoTopo, C.chaoFundo);
    j.dirAtq = alvo.x>=j.x ? 1 : -1;
    j.andando = true;
  } else if(j.cdAtq<=0) atacar();
}

/* ---------- ciclo principal ---------- */
function loop(t){
  rafId = requestAnimationFrame(loop);
  let dt = Math.min((t-ultimoT)/1000, 0.05);
  ultimoT = t;
  if(!C) return;
  if(C.hitstop>0){ C.hitstop -= dt; dt *= 0.15; }   // micro-pausa dramática
  C.tempo += dt;
  atualizar(dt);
  if(C.modo3d){
    sincronizar3d(dt);
    R3.tick(dt);
    desenharOverlay3d();
  } else {
    desenhar();
  }
}

/* ---------- sincronização das entidades 3D ---------- */
function movimentoEnt(ent3dHost, dt){
  const dx = ent3dHost.x - (ent3dHost._px ?? ent3dHost.x);
  const dy = ent3dHost.y - (ent3dHost._py ?? ent3dHost.y);
  ent3dHost._px = ent3dHost.x; ent3dHost._py = ent3dHost.y;
  return Math.hypot(dx,dy) > 0.5;
}

function sincronizar3d(dt){
  const j = C.jogador;
  // Vigia
  if(j.ent3d){
    R3.pos(j.ent3d, j.x, j.y);
    if(C.joy && C.joy.mag>0.08) R3.virar(j.ent3d, C.joy.dx, C.joy.dy);
    else R3.virar(j.ent3d, j.dirAtq, 0.001);
    j.lock3d = Math.max(0, (j.lock3d||0)-dt);
    if(j.lock3d<=0 && C.fase!=='fim'){
      const loco = (j.alvoX!==null) ? 'Running_A' : (j.andando ? 'Walking_A' : 'Idle_A');
      R3.anim(j.ent3d, loco, {fade:0.2});
    }
  }
  // sombras aliadas
  for(const a of C.aliados){
    if(!a.ent3d) continue;
    R3.pos(a.ent3d, a.x, a.y);
    const alvo = inimigoMaisProximoDe(a);
    if(alvo) R3.virar(a.ent3d, alvo.x-a.x, alvo.y-a.y);
    a.lock3d = Math.max(0,(a.lock3d||0)-dt);
    const mov = movimentoEnt(a, dt);
    if(a.lock3d<=0) R3.anim(a.ent3d, mov?'Walking_A':'Idle_A', {fade:0.2});
  }
  // inimigos
  for(const e of C.inimigos){
    if(!e.ent3d) continue;
    R3.pos(e.ent3d, e.x, e.y);
    R3.virar(e.ent3d, j.x-e.x, j.y-e.y);
    e.lock3d = Math.max(0,(e.lock3d||0)-dt);
    const mov = movimentoEnt(e, dt);
    if(e.windup>0 && e.anim3d!=='atk'){
      e.anim3d='atk';
      R3.anim(e.ent3d, e.ranged?'Throw':'Hit_B', {uma:true, ts:1.3});
      e.lock3d = Math.max(e.lock3d, e.windup);
    } else if(e.windup<=0 && e.anim3d==='atk'){ e.anim3d=''; }
    if(e.lock3d<=0 && e.windup<=0){
      R3.anim(e.ent3d, e.investe?'Running_A':(mov?'Walking_A':'Idle_A'), {fade:0.2});
    }
  }
  R3.shake(C.shake*0.5);
}

/* ---------- overlay 2D projetado sobre o 3D ---------- */
function pj(x,y,alt){ return R3.proj(x,y,alt||0); }

function desenharOverlay3d(){
  const {W,H}=C, t=C.tempo;
  ctx.clearRect(0,0,W,H);

  // telégrafos no chão (poças, anéis, sopro/aoe dos bosses)
  for(const p of C.pocas){
    const a=pj(p.x,p.y), r=p.r*a.esc;
    ctx.fillStyle='rgba(110,160,40,0.40)';
    ctx.beginPath(); ctx.ellipse(a.x,a.y,r,r*0.45,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(160,210,60,0.6)'; ctx.lineWidth=2; ctx.stroke();
  }
  for(const an of C.aneisBoss){
    const a=pj(an.x,an.y), f=clamp(an.t/1.3,0,1), r=an.r*a.esc;
    ctx.strokeStyle='rgba(216,92,78,0.9)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(a.x,a.y,r,r*0.5,0,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=`rgba(216,92,78,${0.30*(1-f)})`;
    ctx.beginPath(); ctx.ellipse(a.x,a.y,r*(1-f*0.7),r*0.5*(1-f*0.7),0,0,Math.PI*2); ctx.fill();
  }
  for(const e of C.inimigos){
    if(!e.habAtiva || e.windup<=0) continue;
    const h=e.habAtiva, a=pj(e.x,e.y), prog=1-e.windup/1.1;
    ctx.strokeStyle='rgba(192,68,56,0.85)'; ctx.lineWidth=3;
    ctx.fillStyle=`rgba(192,68,56,${0.10+0.18*prog})`;
    if(h.tipo==='sopro'){
      const al=pj(j_().x,j_().y), ang=Math.atan2(al.y-a.y,al.x-a.x);
      ctx.save(); ctx.translate(a.x,a.y);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,200*a.esc,ang-0.5,ang+0.5); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    } else {
      ctx.beginPath(); ctx.ellipse(a.x,a.y,(40*prog+12)*a.esc,(40*prog+12)*a.esc*0.5,0,0,Math.PI*2);
      ctx.fill(); ctx.stroke();
    }
  }

  // mira por arrasto
  if(mira && C.fase==='luta'){
    const o=pj(C.jogador.x,C.jogador.y,60), len=PODERES_DIRECIONAIS[mira.id]*o.esc, cor=PODERES[mira.id].cor;
    const ax=o.x+mira.dx*len, ay=o.y+mira.dy*len;
    ctx.save(); ctx.globalAlpha=mira.drag?0.9:0.45;
    ctx.strokeStyle=cor; ctx.lineWidth=3; ctx.setLineDash([10,8]);
    ctx.beginPath(); ctx.moveTo(o.x,o.y); ctx.lineTo(ax,ay); ctx.stroke(); ctx.setLineDash([]);
    const ang=Math.atan2(mira.dy,mira.dx); ctx.fillStyle=cor;
    ctx.beginPath(); ctx.moveTo(ax,ay);
    ctx.lineTo(ax-Math.cos(ang-0.42)*16,ay-Math.sin(ang-0.42)*16);
    ctx.lineTo(ax-Math.cos(ang+0.42)*16,ay-Math.sin(ang+0.42)*16);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // projéteis (lâmina), tiros inimigos e orbes
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(const p of C.projeteis){
    if(p.tipo!=='lamina') continue;
    const a=pj(p.x,p.y,26);
    const g=ctx.createRadialGradient(a.x,a.y,1,a.x,a.y,13);
    g.addColorStop(0,'#fff'); g.addColorStop(0.4,p.cor); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(a.x,a.y,13,0,Math.PI*2); ctx.fill();
  }
  for(const o of C.orbes){
    const a=pj(o.x,o.y,30);
    const g=ctx.createRadialGradient(a.x,a.y,1,a.x,a.y,16);
    g.addColorStop(0,'rgba(220,200,255,0.9)'); g.addColorStop(0.4,'rgba(150,110,220,0.6)'); g.addColorStop(1,'rgba(150,110,220,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(a.x,a.y,16,0,Math.PI*2); ctx.fill();
  }
  for(const tr of C.tiros){
    const a=pj(tr.x,tr.y,26);
    const g=ctx.createRadialGradient(a.x,a.y,1,a.x,a.y,12);
    g.addColorStop(0,'rgba(255,255,255,0.85)'); g.addColorStop(0.35,tr.cor); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(a.x,a.y,12,0,Math.PI*2); ctx.fill();
  }
  // partículas
  for(const p of C.particulas){
    const a=pj(p.x,p.y,24), vida=clamp(p.t/p.tMax,0,1);
    ctx.globalAlpha=vida*0.9; ctx.fillStyle=p.cor;
    ctx.beginPath(); ctx.arc(a.x,a.y,p.tam*vida*a.esc,0,Math.PI*2); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha=1;

  // escudo rúnico à volta do Vigia
  if(C.escudo>0){
    const a=pj(C.jogador.x,C.jogador.y,30);
    ctx.strokeStyle='rgba(184,168,224,0.6)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.ellipse(a.x,a.y,32*a.esc,40*a.esc,0,0,Math.PI*2); ctx.stroke();
  }

  // números de dano
  ctx.textAlign='center';
  for(const n of C.numeros){
    const a=pj(n.x,n.y,50);
    ctx.globalAlpha=clamp(n.t/0.4,0,1);
    ctx.font=`900 ${n.tam}px Georgia,serif`;
    ctx.fillStyle='#000'; ctx.fillText(n.txt,a.x+1.5,a.y+1.5);
    ctx.fillStyle=n.cor; ctx.fillText(n.txt,a.x,a.y);
  }
  ctx.globalAlpha=1;

  // flash de dano + vinheta
  if(C.danoFlash>0){
    const dv=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.32,W/2,H/2,Math.max(W,H)*0.7);
    dv.addColorStop(0,'rgba(192,68,56,0)'); dv.addColorStop(1,`rgba(192,68,56,${0.4*C.danoFlash/0.3})`);
    ctx.fillStyle=dv; ctx.fillRect(0,0,W,H);
  }
  // joystick
  if(C.joy && !C.auto){
    ctx.fillStyle='rgba(20,16,12,0.35)';
    ctx.beginPath(); ctx.arc(C.joy.bx,C.joy.by,JOY_RAIO,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(201,165,90,0.4)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(C.joy.bx,C.joy.by,JOY_RAIO,0,Math.PI*2); ctx.stroke();
    const kx=C.joy.bx+C.joy.dx, ky=C.joy.by+C.joy.dy;
    ctx.fillStyle='rgba(201,165,90,0.55)';
    ctx.beginPath(); ctx.arc(kx,ky,24,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,235,190,0.65)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(kx,ky,24,0,Math.PI*2); ctx.stroke();
  }
}
function j_(){ return C.jogador; }

function atualizar(dt){
  const j = C.jogador, t = C.stats;

  if(C.fase==='porta'){
    C.tempoFase += dt;
    j.x += (C.W*0.85 - j.x)*dt*2.2;
    j.y += (C.H*0.63 - j.y)*dt*2.2;
    if(C.tempoFase > 1.15){
      C.sala++;
      j.x = C.W*0.2; j.y = C.H*0.65;
      C.fase='luta';
      if(C.modo3d) montarCena3d();      // nova sala = nova cena 3D + Vigia/sombras
      povoarSala();
    }
  }
  if(C.fase==='fim') return;

  // cooldowns / regen / buffs
  j.cdAtq=Math.max(0,j.cdAtq-dt); j.cdEsq=Math.max(0,j.cdEsq-dt);
  j.invul=Math.max(0,j.invul-dt);
  for(const k of Object.keys(C.cdPoder)) C.cdPoder[k] = Math.max(0, C.cdPoder[k]-dt);
  C.buffFuria = Math.max(0, C.buffFuria-dt);
  C.buffGelo = Math.max(0, C.buffGelo-dt);
  j.mp = clamp(j.mp + BAL.jogador.regenMp*dt, 0, t.mpMax);

  // esquiva em curso (dash curto até ao ponto, com rasto fantasma)
  if(j.alvoX!==null){
    const dx=j.alvoX-j.x, dy=j.alvoY-j.y, d=Math.hypot(dx,dy);
    if(d<8){ j.alvoX=null; }
    else {
      const v = BAL.combate.dashVel*dt;
      j.x += dx/d*Math.min(v,d); j.y += dy/d*Math.min(v,d);
      C.rastos.push({ x:j.x, y:j.y, dir:j.dirAtq, t:0.22 });
    }
  }
  for(const r of C.rastos) r.t -= dt;
  C.rastos = C.rastos.filter(r=>r.t>0);

  // MOVIMENTO LIVRE pelo joystick (analógico: velocidade segue a inclinação)
  j.andando = false;
  if(C.joy && C.joy.mag>0.08 && j.alvoX===null && C.fase==='luta' && !C.auto){
    const lento = C.lentoJog ? 1-C.lentoJog.fator : 1;
    const v = BAL.combate.velJogador * t.velMov * lento * C.joy.mag * dt;
    const m = Math.hypot(C.joy.dx, C.joy.dy)||1;
    j.x = clamp(j.x + C.joy.dx/m*v, 24, C.W-24);
    j.y = clamp(j.y + C.joy.dy/m*v, C.chaoTopo, C.chaoFundo);
    if(Math.abs(C.joy.dx) > JOY_RAIO*0.12) j.dirAtq = C.joy.dx>=0 ? 1 : -1;
    j.andando = true;
  }
  j.atacando = Math.max(0, j.atacando-dt);

  if(C.auto && C.fase==='luta') autoIA(dt);

  // aliados (sombras)
  for(const a of C.aliados){
    a.cd = Math.max(0, a.cd-dt);
    const alvo = inimigoMaisProximoDe(a);
    if(alvo){
      const dx=alvo.x-a.x, dy=alvo.y-a.y, d=Math.hypot(dx,dy);
      if(d > alvo.raio+30){ a.x+=dx/d*a.vel*dt; a.y+=dy/d*a.vel*dt; }
      else if(a.cd<=0){
        a.cd = 1.1;
        ferirInimigo(alvo, Math.round(a.atq*rnd(0.85,1.15)), false, '#8a6fc8');
      }
    } else {
      const dx=j.x-60-a.x, dy=j.y-a.y, d=Math.hypot(dx,dy);
      if(d>70){ a.x+=dx/d*a.vel*dt; a.y+=dy/d*a.vel*dt; }
    }
  }

  // Aura de Terror (passiva): calcula efeitos por frame
  const terrorOn = poderTier('terror')>0;
  let terrorRaio=0, terrorLent=0, terrorFraq=0;
  if(terrorOn){
    const p=PODERES.terror, ef=efeitoPoder('terror'), tal=talentoDe('terror');
    terrorRaio = p.base.raio * ((tal && tal.mod.raio)||1);
    terrorLent = p.base.lentidao * ef;
    terrorFraq = p.base.fraqueza * ef;
  }

  // inimigos
  for(const e of C.inimigos){
    e.flash = Math.max(0, e.flash-dt);
    // estados
    if(e.queimar){
      e.queimar.t -= dt;
      e.hp -= e.queimar.dps*dt;
      if(Math.random()<dt*8) particula(e.x+rnd(-10,10), e.y-20, '#e2762d', 3, 0.4, rnd(-20,20), -60);
      if(e.queimar.t<=0) e.queimar=null;
      if(e.hp<=0){ e.hp=1; ferirInimigo(e, 1, false, '#e2762d'); continue; }
    }
    if(e.lento){ e.lento.t -= dt; if(e.lento.t<=0) e.lento=null; }
    e.congelado = Math.max(0, e.congelado-dt);

    const dx=j.x-e.x, dy=j.y-e.y, d=Math.hypot(dx,dy);
    const noTerror = terrorOn && d < terrorRaio;
    let velMult = 1;
    if(e.lento) velMult *= 1-e.lento.fator;
    if(noTerror) velMult *= 1-terrorLent;
    if(e.congelado>0) velMult = 0;

    if(e.investe){
      // carga do Senhor da Guerra em curso
      e.investe.t -= dt;
      e.x = clamp(e.x + e.investe.vx*dt, 20, C.W-20);
      e.y = clamp(e.y + e.investe.vy*dt, C.chaoTopo, C.chaoFundo);
      if(!e.investe.feriu && Math.hypot(j.x-e.x,j.y-e.y) < e.raio+36 && j.invul<=0){
        e.investe.feriu = true; ferirJogador(e.atq*1.5);
      }
      if(Math.random()<dt*30) particula(e.x, e.y-12, '#d05c4e', 4, 0.3);
      if(e.investe.t<=0){ e.investe=null; e.cd=rnd(1.2,2.0); }
    }
    else if(e.windup>0){
      if(e.congelado<=0) e.windup -= dt;
      if(e.windup<=0){
        let dano = e.atq;
        if(noTerror) dano *= 1-terrorFraq;
        if(e.habAtiva){ resolverHabBoss(e, dano); e.habAtiva=null; }
        else if(e.ranged){
          // dispara um projétil em linha reta (esquivável)
          const ang = Math.atan2((j.y-26)-(e.y-24), j.x-e.x);
          const vp = BAL.combate.velProjInimigo;
          C.tiros.push({
            x:e.x, y:e.y-24, vx:Math.cos(ang)*vp, vy:Math.sin(ang)*vp,
            dano, t:3,
            cor: e.sprite==='orcmago' ? '#b89ae8' : e.sprite==='sacerdote' ? '#d05c4e' : '#9ad06a',
          });
        }
        else if(d < e.raio+52 && j.invul<=0) ferirJogador(dano);
        e.cd = rnd(1.0,1.9);
        e.recupera = BAL.combate.recuperar;   // pausa pós-golpe: não cola
      }
    } else {
      e.cd -= dt*(e.congelado>0?0:1);
      e.recupera = Math.max(0, e.recupera-dt);
      if(e.homeX===undefined && e.x>30 && e.x<C.W-30){ e.homeX=e.x; e.homeY=e.y; }
      const B = BAL.combate;
      const alcance = e.ranged ? B.alcanceRanged : e.raio+46;
      if(e.classe==='boss' && e.hab && e.cd<=0 && Math.random()<0.45){
        prepararHabBoss(e);
      } else if(d > B.leash && e.classe!=='boss'){
        // o Vigia fugiu: desinteressa-se e volta ao seu posto
        const hx = e.homeX ?? C.W*0.7, hy = e.homeY ?? (C.chaoTopo+C.chaoFundo)/2;
        const hd = Math.hypot(hx-e.x, hy-e.y);
        if(hd > 24){ e.x += (hx-e.x)/hd*e.vel*0.4*dt; e.y += (hy-e.y)/hd*e.vel*0.4*dt; }
      } else if(e.recupera > 0){
        // recua ligeiramente depois de atacar
        e.x -= dx/d*e.vel*0.35*velMult*dt; e.y -= dy/d*e.vel*0.35*velMult*dt;
      } else if(e.ranged && d < alcance*0.55){
        // mantém a distância (kiting)
        e.x = clamp(e.x - dx/d*e.vel*0.8*velMult*dt, 20, C.W-20);
        e.y = clamp(e.y - dy/d*e.vel*0.8*velMult*dt, C.chaoTopo, C.chaoFundo);
        if(e.cd<=0) e.windup = 0.6;
      } else if(d > alcance){
        e.x += dx/d*e.vel*velMult*dt; e.y += dy/d*e.vel*velMult*dt;
      } else if(e.cd<=0){
        e.windup = e.ranged ? 0.6 : 0.55;
      }
    }
  }

  // separação entre inimigos (não se empilham)
  for(let a=0;a<C.inimigos.length;a++){
    for(let b2=a+1;b2<C.inimigos.length;b2++){
      const A=C.inimigos[a], B2=C.inimigos[b2];
      const sdx=B2.x-A.x, sdy=B2.y-A.y, sd=Math.hypot(sdx,sdy)||1;
      const minD = BAL.combate.separacao + (A.raio+B2.raio)*0.35;
      if(sd < minD){
        const push = (minD-sd)/2;
        A.x = clamp(A.x - sdx/sd*push, 20, C.W-20); A.y = clamp(A.y - sdy/sd*push, C.chaoTopo, C.chaoFundo);
        B2.x = clamp(B2.x + sdx/sd*push, 20, C.W-20); B2.y = clamp(B2.y + sdy/sd*push, C.chaoTopo, C.chaoFundo);
      }
    }
  }

  // projéteis inimigos (esquiváveis com o dash)
  for(const tr of C.tiros){
    tr.t -= dt;
    tr.x += tr.vx*dt; tr.y += tr.vy*dt;
    if(Math.hypot(j.x-tr.x, (j.y-26)-tr.y) < 24){
      if(j.invul<=0) ferirJogador(tr.dano);
      tr.t = -1;
    }
  }
  C.tiros = C.tiros.filter(tr=>tr.t>0);

  // efeitos das habilidades dos bosses
  if(C.lentoJog){ C.lentoJog.t-=dt; if(C.lentoJog.t<=0) C.lentoJog=null; }
  for(const p of C.pocas){
    p.t -= dt; p.tick = (p.tick||0) - dt;
    if(p.tick<=0 && Math.hypot(j.x-p.x, j.y-p.y) < p.r && j.invul<=0){
      p.tick = 0.5;
      ferirJogador(p.dano);
    }
  }
  C.pocas = C.pocas.filter(p=>p.t>0);
  for(const o of C.orbes){
    o.t -= dt;
    const odx=j.x-o.x, ody=(j.y-30)-o.y, od=Math.hypot(odx,ody)||1;
    o.x += odx/od*o.vel*dt; o.y += ody/od*o.vel*dt;
    if(od<28){ if(j.invul<=0) ferirJogador(o.dano); o.t=-1; }
    else if(Math.random()<dt*14) particula(o.x, o.y, '#b89ae8', 2.5, 0.3, 0, 0);
  }
  C.orbes = C.orbes.filter(o=>o.t>0);
  for(const a of C.aneisBoss){
    a.t -= dt;
    if(!a.feito && a.t<=0){
      a.feito = true;
      for(let i=0;i<24;i++) particula(a.x, a.y, '#d05c4e', 5, 0.5);
      C.shake = Math.max(C.shake, 9);
      if(Math.hypot(j.x-a.x, j.y-a.y) < a.r && j.invul<=0) ferirJogador(a.dano);
    }
  }
  C.aneisBoss = C.aneisBoss.filter(a=>!a.feito);

  // projéteis
  for(const p of C.projeteis){
    if(p.tipo==='raio'){ p.t-=dt; continue; }
    if(p.vx!==undefined){
      // lâmina em linha reta (disparo com mira)
      p.t-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
      for(const e2 of C.inimigos){
        if(Math.hypot(e2.x-p.x, (e2.y-16)-p.y) < e2.raio+12){
          const t2=C.stats;
          const g=calcularGolpe(p.dano, t2.crit, t2.critDano, t2.pen, e2.def);
          ferirInimigo(e2, g.dano, g.crit, p.cor);
          aplicarRoubo(g.dano);
          for(let i2=0;i2<8;i2++) particula(p.x, p.y, p.cor, 3.5, 0.35);
          p.t=-1; break;
        }
      }
      if(Math.random()<dt*20) particula(p.x, p.y, p.cor, 2.5, 0.25, 0, 0);
      if(p.x<-30||p.x>C.W+30||p.y<-30||p.y>C.H+30) p.t=-1;
      continue;
    }
    if(!C.inimigos.includes(p.alvo)){ p.t=-1; continue; }
    const dx=p.alvo.x-p.x, dy=(p.alvo.y-20)-p.y, d=Math.hypot(dx,dy);
    if(d < p.alvo.raio+10){
      const t2=C.stats;
      const g = calcularGolpe(p.dano, t2.crit, t2.critDano, t2.pen, p.alvo.def);
      ferirInimigo(p.alvo, g.dano, g.crit, p.cor);
      aplicarRoubo(g.dano);
      for(let i=0;i<8;i++) particula(p.x,p.y,p.cor,3.5,0.35);
      p.t=-1;
    } else {
      p.x += dx/d*p.vel*dt; p.y += dy/d*p.vel*dt;
      if(Math.random()<dt*20) particula(p.x,p.y,p.cor,2.5,0.25,0,0);
    }
  }
  C.projeteis = C.projeteis.filter(p=> p.t===undefined || p.t>0);

  // partículas / números
  for(const p of C.particulas){ p.t-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=160*dt; }
  C.particulas = C.particulas.filter(p=>p.t>0);
  for(const n of C.numeros){ n.t-=dt; n.y-=46*dt; }
  C.numeros = C.numeros.filter(n=>n.t>0);
  if(C.anelSkill){ C.anelSkill.t-=dt; if(C.anelSkill.t<=0) C.anelSkill=null; }
  C.shake = Math.max(0, C.shake - dt*36);
  C.danoFlash = Math.max(0, C.danoFlash - dt);

  // HUD
  document.getElementById('hud-hp').style.width = (j.hp/t.hpMax*100)+'%';
  document.getElementById('hud-hp-txt').textContent = `${Math.ceil(j.hp)} / ${t.hpMax}`;
  document.getElementById('hud-mp').style.width = (j.mp/t.mpMax*100)+'%';
  const be = document.getElementById('hud-escudo');
  if(C.escudo>0){
    be.hidden=false;
    be.querySelector('.barra-fill').style.width = (C.escudo/C.escudoMax*100)+'%';
  } else be.hidden=true;
  const boss = C.inimigos.find(e=>e.classe==='boss');
  if(boss) document.getElementById('boss-hp').style.width = (boss.hp/boss.hpMax*100)+'%';
  // botão de esquiva: recarga visível
  const beq = document.getElementById('btn-esquiva');
  const cdMaxE = BAL.combate.dashCd * (1 - t.cdr/100);
  beq.querySelector('.cd-sweep').style.setProperty('--cd', Math.round(clamp(j.cdEsq/cdMaxE,0,1)*100));
  beq.classList.toggle('pronto', j.cdEsq<=0);
  atualizarSlotsPoder();

  // sala limpa?
  if(C.fase==='luta' && C.inimigos.length===0){
    if(C.sala >= C.totalSalas){ terminarCombate(true); }
    else { C.fase='porta'; C.tempoFase=0; toast('Sala limpa! ➜'); }
  }
}

/* ---------- habilidades únicas dos bosses ---------- */
function prepararHabBoss(e){
  const j = C.jogador;
  const dur = { invocar:0.9, acido:0.9, orbes:0.8, investida:0.9, sopro:1.0, aneis:1.1 }[e.hab] || 0.9;
  e.habAtiva = { tipo:e.hab, alvoX:j.x, alvoY:j.y, ang:Math.atan2(j.y-e.y, j.x-e.x) };
  e.windup = dur;
}

function resolverHabBoss(e, dano){
  const j = C.jogador, h = e.habAtiva, rank = C.masmorra.rank;
  switch(h.tipo){
    case 'invocar': {      // Rei Goblin chama lacaios
      const n = Math.min(2, 8 - C.inimigos.length);
      for(let i=0;i<n;i++){
        const m = criarInimigo(escolher(MONSTROS[rank]), rank, 'normal', i);
        m.x = clamp(e.x + rnd(-90,90), 30, C.W-30);
        m.y = clamp(e.y + rnd(-50,50), C.chaoTopo, C.chaoFundo);
        m.hp = Math.round(m.hp*0.7); m.hpMax = m.hp;
        C.inimigos.push(m);
        for(let k=0;k<10;k++) particula(m.x, m.y-14, '#6aa03c', 4, 0.5);
      }
      break;
    }
    case 'acido': {        // Rainha cospe poças
      for(let i=0;i<3;i++){
        C.pocas.push({
          x: clamp(h.alvoX + (i-1)*70 + rnd(-16,16), 30, C.W-30),
          y: clamp(h.alvoY + rnd(-26,26), C.chaoTopo, C.chaoFundo),
          r: 52, t: 5.5, dano: Math.round(dano*0.35), tick: 0,
        });
      }
      break;
    }
    case 'orbes': {        // Lich dispara orbes teleguiadas
      for(let i=0;i<3;i++){
        C.orbes.push({ x:e.x+rnd(-14,14), y:e.y-34-i*12, vel:215, t:6, dano:Math.round(dano*0.8) });
      }
      break;
    }
    case 'investida': {    // Senhor da Guerra carrega em linha
      const vx = Math.cos(h.ang)*640, vy = Math.sin(h.ang)*640;
      e.investe = { t:0.55, vx, vy, feriu:false };
      break;
    }
    case 'sopro': {        // Dragão sopra gelo em cone
      const aJog = Math.atan2(j.y-e.y, j.x-e.x);
      const dist = Math.hypot(j.x-e.x, j.y-e.y);
      let dif = Math.abs(aJog - h.ang);
      if(dif > Math.PI) dif = Math.PI*2 - dif;
      if(dist < 270 && dif < 0.55 && j.invul<=0){
        ferirJogador(dano*1.2);
        C.lentoJog = { t:2.5, fator:0.5 };
        numero(j.x, j.y-78, 'CONGELADO!', '#9ad8f0', 15);
      }
      for(let i=0;i<22;i++){
        const a2 = h.ang + rnd(-0.5,0.5), dd = rnd(40,250);
        particula(e.x+Math.cos(a2)*dd, e.y+Math.sin(a2)*dd*0.55, '#9ad8f0', 4, 0.5);
      }
      break;
    }
    case 'aneis': {        // Monarca: anéis em série + teleporte
      for(let i=0;i<3;i++){
        C.aneisBoss.push({
          x: clamp(h.alvoX + (i-1)*60, 30, C.W-30),
          y: clamp(h.alvoY + (i%2?-36:36)*(i?1:0), C.chaoTopo, C.chaoFundo),
          r: 95, t: 0.85 + i*0.45, dano: Math.round(dano*1.3), feito:false,
        });
      }
      // teleporta para flanquear o Vigia
      for(let k=0;k<14;k++) particula(e.x, e.y-20, '#8a6fc8', 4, 0.5);
      e.x = clamp(j.x + (Math.random()<0.5?-1:1)*150, 30, C.W-30);
      e.y = clamp(j.y + rnd(-60,60), C.chaoTopo, C.chaoFundo);
      for(let k=0;k<14;k++) particula(e.x, e.y-20, '#8a6fc8', 4, 0.5);
      break;
    }
  }
}

function inimigoMaisProximoDe(ent){
  let melhor=null, md=1e9;
  for(const e of C.inimigos){
    const d=Math.hypot(e.x-ent.x,e.y-ent.y);
    if(d<md){md=d;melhor=e;}
  }
  return melhor;
}

function ferirJogador(bruto){
  const j=C.jogador;
  let dano = Math.max(1, Math.round(bruto - defAtual()*0.6));
  // Escudo Rúnico absorve primeiro
  if(C.escudo>0){
    const abs = Math.min(C.escudo, dano);
    C.escudo -= abs; dano -= abs;
    numero(j.x, j.y-66, '🛡'+abs, '#b8a8e0', 13);
    if(C.escudo<=0) toast('O escudo quebrou!');
    if(dano<=0){ C.shake=Math.max(C.shake,3); return; }
  }
  j.hp -= dano;
  numero(j.x, j.y-60, dano, '#d05c4e', 16);
  C.shake = Math.max(C.shake, 6);
  if(C.modo3d) R3.shake(8);
  C.danoFlash = 0.3;
  if(j.ent3d && j.hp>0){ R3.anim(j.ent3d, 'Hit_A', {uma:true}); j.lock3d = 0.3; }
  if(j.hp<=0){ j.hp=0; if(j.ent3d) R3.anim(j.ent3d,'Death_A',{uma:true}); terminarCombate(false); }
}

/* ---------- efeitos ---------- */
function particula(x,y,cor,tam,dur,vx,vy){
  C.particulas.push({
    x,y,cor,tam,t:dur,tMax:dur,
    vx: vx!==undefined?vx:rnd(-160,160),
    vy: vy!==undefined?vy:rnd(-200,40),
  });
}
function numero(x,y,txt,cor,tam){ C.numeros.push({x,y,txt,cor,tam,t:0.9}); }

/* ---------- desenho ---------- */
function desenhar(){
  const {W,H}=C;
  ctx.clearRect(0,0,W,H);

  let ox=0, oy=0;
  if(C.shake>0){ ox=rnd(-C.shake,C.shake); oy=rnd(-C.shake,C.shake); }
  ctx.save(); ctx.translate(ox,oy);

  desenharCenario();

  // poças de ácido
  for(const p of C.pocas){
    const borb = Math.sin(C.tempo*6 + p.x)*0.12;
    ctx.fillStyle='rgba(110,160,40,0.40)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r*0.45, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(160,210,60,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r*(0.62+borb), p.r*0.30, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(160,210,60,0.6)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r*0.45, 0, 0, Math.PI*2); ctx.stroke();
  }

  // telégrafos das habilidades dos bosses
  for(const e of C.inimigos){
    if(!e.habAtiva || e.windup<=0) continue;
    const h = e.habAtiva, prog = 1 - e.windup/1.1;
    ctx.strokeStyle='rgba(192,68,56,0.85)'; ctx.lineWidth=3;
    ctx.fillStyle=`rgba(192,68,56,${0.10+0.18*prog})`;
    if(h.tipo==='acido' || h.tipo==='aneis'){
      for(let i=0;i<3;i++){
        const tx = clamp(h.alvoX+(i-1)*(h.tipo==='acido'?70:60), 30, C.W-30);
        const ty = h.tipo==='acido' ? h.alvoY : clamp(h.alvoY+(i%2?-36:36)*(i?1:0), C.chaoTopo, C.chaoFundo);
        ctx.beginPath(); ctx.ellipse(tx, ty, 60, 30, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
    } else if(h.tipo==='investida'){
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(h.ang);
      ctx.fillRect(0, -26, 380, 52);
      ctx.strokeRect(0, -26, 380, 52);
      ctx.restore();
    } else if(h.tipo==='sopro'){
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.fillStyle=`rgba(120,190,230,${0.12+0.2*prog})`;
      ctx.strokeStyle='rgba(154,216,240,0.8)';
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.arc(0, 0, 270, h.ang-0.55, h.ang+0.55);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else {
      // invocar / orbes: brilho a crescer no boss
      ctx.strokeStyle = h.tipo==='orbes' ? 'rgba(184,154,232,0.8)' : 'rgba(106,160,60,0.8)';
      ctx.beginPath(); ctx.ellipse(e.x, e.y-20, 40*prog+10, 50*prog+12, 0, 0, Math.PI*2); ctx.stroke();
    }
  }

  // anéis de destruição (telégrafo a encolher)
  for(const a of C.aneisBoss){
    const f = clamp(a.t/1.3, 0, 1);
    ctx.strokeStyle='rgba(216,92,78,0.9)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r, a.r*0.5, 0, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle=`rgba(216,92,78,${0.30*(1-f)})`;
    ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r*(1-f*0.7), a.r*0.5*(1-f*0.7), 0, 0, Math.PI*2); ctx.fill();
  }

  // orbes do Lich + projéteis inimigos
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(const o of C.orbes){
    const g = ctx.createRadialGradient(o.x,o.y,1, o.x,o.y,16);
    g.addColorStop(0,'rgba(220,200,255,0.9)'); g.addColorStop(0.4,'rgba(150,110,220,0.6)'); g.addColorStop(1,'rgba(150,110,220,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(o.x,o.y,16,0,Math.PI*2); ctx.fill();
  }
  for(const tr of C.tiros){
    const g = ctx.createRadialGradient(tr.x,tr.y,1, tr.x,tr.y,12);
    g.addColorStop(0,'rgba(255,255,255,0.85)'); g.addColorStop(0.35,tr.cor); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(tr.x,tr.y,12,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // anel de poder em área
  if(C.anelSkill){
    const a=C.anelSkill, prog=1-a.t/0.45;
    ctx.strokeStyle=a.cor||'#e2762d'; ctx.globalAlpha=1-prog; ctx.lineWidth=5;
    ctx.beginPath(); ctx.ellipse(a.x,a.y,170*prog,85*prog,0,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=1;
  }

  // aura de terror (subtil)
  if(poderTier('terror')>0 && C.fase==='luta'){
    const tal=talentoDe('terror');
    const r=PODERES.terror.base.raio*((tal && tal.mod.raio)||1);
    ctx.strokeStyle='rgba(107,90,138,0.25)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(C.jogador.x,C.jogador.y,r,r*0.5,0,0,Math.PI*2); ctx.stroke();
  }

  // mira por arrasto dos poderes direcionais
  if(mira && C.fase==='luta'){
    const jx=C.jogador.x, jy=C.jogador.y-26;
    const len = PODERES_DIRECIONAIS[mira.id];
    const cor = PODERES[mira.id].cor;
    const ax = jx+mira.dx*len, ay = jy+mira.dy*len;
    ctx.save();
    ctx.globalAlpha = mira.drag ? 0.9 : 0.45;
    ctx.strokeStyle=cor; ctx.lineWidth=3; ctx.setLineDash([10,8]);
    ctx.beginPath(); ctx.moveTo(jx,jy); ctx.lineTo(ax,ay); ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(mira.dy, mira.dx);
    ctx.fillStyle=cor;
    ctx.beginPath();
    ctx.moveTo(ax,ay);
    ctx.lineTo(ax-Math.cos(ang-0.42)*16, ay-Math.sin(ang-0.42)*16);
    ctx.lineTo(ax-Math.cos(ang+0.42)*16, ay-Math.sin(ang+0.42)*16);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // portal de saída
  if(C.fase==='porta') desenharPortal(C.W*0.87, C.H*0.6);

  // rasto fantasma da esquiva
  for(const r of C.rastos){
    const s2 = escalaProf(r.y);
    ctx.save();
    ctx.globalAlpha = r.t/0.22*0.35;
    ctx.translate(r.x, r.y); ctx.scale(s2, s2);
    spriteHeroi(ctx, { dir:r.dir });
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // entidades ordenadas por profundidade
  const ents = [
    {y:C.jogador.y, draw:()=>desenharJogador()},
    ...C.aliados.map(a=>({y:a.y, draw:()=>desenharAliado(a)})),
    ...C.inimigos.map(e=>({y:e.y, draw:()=>desenharInimigo(e)})),
  ].sort((a,b)=>a.y-b.y);
  for(const e of ents) e.draw();

  // projéteis
  for(const p of C.projeteis){
    if(p.tipo==='raio'){
      ctx.strokeStyle='#e8c84a'; ctx.lineWidth=2.5; ctx.globalAlpha=clamp(p.t/0.18,0,1);
      ctx.beginPath(); ctx.moveTo(p.x1,p.y1);
      const mx=(p.x1+p.x2)/2+rnd(-14,14), my=(p.y1+p.y2)/2+rnd(-10,10);
      ctx.lineTo(mx,my); ctx.lineTo(p.x2,p.y2); ctx.stroke();
      ctx.globalAlpha=1;
    } else {
      ctx.fillStyle=p.cor;
      ctx.shadowColor=p.cor; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }
  }

  // partículas com brilho aditivo (magia/fogo realça)
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(const p of C.particulas){
    const vida = clamp(p.t/p.tMax,0,1);
    ctx.globalAlpha = vida*0.9;
    ctx.fillStyle=p.cor;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.tam*vida,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = vida*0.25;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.tam*vida*2.6,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha=1;

  // números de dano
  ctx.textAlign='center';
  for(const n of C.numeros){
    ctx.globalAlpha=clamp(n.t/0.4,0,1);
    ctx.font=`900 ${n.tam}px Georgia,serif`;
    ctx.fillStyle='#000'; ctx.fillText(n.txt, n.x+1.5, n.y+1.5);
    ctx.fillStyle=n.cor; ctx.fillText(n.txt, n.x, n.y);
  }
  ctx.globalAlpha=1;

  ctx.restore();

  // vinheta (fora do shake, sempre estável)
  const vin = ctx.createRadialGradient(W/2, H*0.45, Math.min(W,H)*0.35, W/2, H*0.55, Math.max(W,H)*0.75);
  vin.addColorStop(0,'rgba(0,0,0,0)');
  vin.addColorStop(1,'rgba(5,3,8,0.45)');
  ctx.fillStyle=vin; ctx.fillRect(0,0,W,H);

  // flash vermelho nas margens ao levar dano
  if(C.danoFlash>0){
    const dv = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.32, W/2,H/2,Math.max(W,H)*0.7);
    dv.addColorStop(0,'rgba(192,68,56,0)');
    dv.addColorStop(1,`rgba(192,68,56,${0.4*C.danoFlash/0.3})`);
    ctx.fillStyle=dv; ctx.fillRect(0,0,W,H);
  }

  // joystick flutuante (por cima de tudo, sem ser afetado pelo shake)
  if(C.joy && !C.auto){
    ctx.fillStyle='rgba(20,16,12,0.35)';
    ctx.beginPath(); ctx.arc(C.joy.bx, C.joy.by, JOY_RAIO, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(201,165,90,0.4)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(C.joy.bx, C.joy.by, JOY_RAIO, 0, Math.PI*2); ctx.stroke();
    const kx = C.joy.bx + C.joy.dx, ky = C.joy.by + C.joy.dy;
    ctx.fillStyle='rgba(201,165,90,0.55)';
    ctx.beginPath(); ctx.arc(kx, ky, 24, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,235,190,0.65)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(kx, ky, 24, 0, Math.PI*2); ctx.stroke();
  }
}

/* ---------- cenário pré-renderizado (pedra, pilares, estandartes) ---------- */
let cenarioCache = null;

function prerenderCenario(){
  if(!C) return;
  const {W,H} = C;
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  cenarioCache = document.createElement('canvas');
  cenarioCache.width = W*dpr; cenarioCache.height = H*dpr;
  const c = cenarioCache.getContext('2d');
  c.setTransform(dpr,0,0,dpr,0,0);
  const rng = (function(seed){ let s2=seed; return ()=>{ s2=(s2*9301+49297)%233280; return s2/233280; }; })(C.sala*977+IDX_RARIDADE_RANK(C.masmorra.rank)*131+7);

  // parede de pedra com tijolos de tom variado
  const parede = c.createLinearGradient(0,0,0,C.chaoTopo);
  parede.addColorStop(0,'#15100b'); parede.addColorStop(0.7,'#2c241a'); parede.addColorStop(1,'#3a2f20');
  c.fillStyle=parede; c.fillRect(0,0,W,C.chaoTopo+4);
  const bH=24, bW=52;
  for(let y=0; y<C.chaoTopo; y+=bH){
    const off = (y/bH)%2 ? bW/2 : 0;
    for(let x=-bW; x<W; x+=bW){
      const tom = 0.04 + rng()*0.10;
      const luzY = y/C.chaoTopo;                          // mais claro perto do chão
      c.fillStyle = `rgba(${120+luzY*40},${100+luzY*30},${70+luzY*20},${tom})`;
      c.fillRect(x+off+1, y+1, bW-2, bH-2);
      if(rng()<0.06){                                      // tijolo rachado
        c.strokeStyle='rgba(0,0,0,0.4)'; c.lineWidth=1;
        c.beginPath();
        c.moveTo(x+off+8, y+4);
        c.lineTo(x+off+18+rng()*10, y+12+rng()*8);
        c.stroke();
      }
    }
  }
  c.strokeStyle='rgba(0,0,0,0.35)'; c.lineWidth=1.5;
  for(let y=0; y<C.chaoTopo; y+=bH){ c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }

  // arcos escuros ao fundo com brilho ténue do rank
  for(let i=0;i<3;i++){
    const ax = W*(0.2+i*0.3);
    c.fillStyle='rgba(0,0,0,0.55)';
    c.beginPath();
    c.moveTo(ax-36, C.chaoTopo);
    c.lineTo(ax-36, C.chaoTopo-62);
    c.arc(ax, C.chaoTopo-62, 36, Math.PI, 0);
    c.lineTo(ax+36, C.chaoTopo);
    c.closePath(); c.fill();
    const g2 = c.createRadialGradient(ax, C.chaoTopo-30, 4, ax, C.chaoTopo-30, 44);
    g2.addColorStop(0, C.masmorra.cor+'33'); g2.addColorStop(1,'transparent');
    c.fillStyle=g2;
    c.beginPath(); c.arc(ax, C.chaoTopo-30, 44, 0, Math.PI*2); c.fill();
    // contorno de pedra do arco
    c.strokeStyle='#4a3b29'; c.lineWidth=4;
    c.beginPath(); c.arc(ax, C.chaoTopo-62, 36, Math.PI, 0); c.stroke();
  }

  // pilares laterais com capitel
  for(const pxp of [W*0.07, W*0.93]){
    c.fillStyle='#3a2f20';
    c.fillRect(pxp-14, 0, 28, C.chaoTopo);
    c.fillStyle='rgba(255,235,190,0.07)';
    c.fillRect(pxp-14, 0, 9, C.chaoTopo);
    c.fillStyle='rgba(0,0,0,0.35)';
    c.fillRect(pxp+6, 0, 8, C.chaoTopo);
    c.fillStyle='#4a3b29';
    c.fillRect(pxp-18, C.chaoTopo-16, 36, 16);
    for(let y2=18; y2<C.chaoTopo-20; y2+=34){
      c.strokeStyle='rgba(0,0,0,0.3)';
      c.beginPath(); c.moveTo(pxp-14,y2); c.lineTo(pxp+14,y2); c.stroke();
    }
  }

  // estandartes do rank pendurados
  for(const bx of [W*0.22, W*0.78]){
    c.fillStyle='#2a1d10'; c.fillRect(bx-20, 8, 40, 5);
    c.fillStyle = C.masmorra.cor;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(bx-16, 13); c.lineTo(bx+16, 13);
    c.lineTo(bx+16, 86); c.lineTo(bx, 72); c.lineTo(bx-16, 86);
    c.closePath(); c.fill();
    c.globalAlpha = 1;
    c.fillStyle='rgba(0,0,0,0.3)';
    c.beginPath(); c.moveTo(bx+6,13); c.lineTo(bx+16,13); c.lineTo(bx+16,86); c.lineTo(bx+6,76); c.closePath(); c.fill();
    c.fillStyle='rgba(232,220,195,0.85)';
    c.font='bold 17px Georgia,serif'; c.textAlign='center';
    c.fillText(C.masmorra.rank, bx, 48);
  }

  // suportes das tochas (a chama é animada por frame)
  for(const tx of [W*0.32, W*0.68]){
    c.fillStyle='#2a1d10'; c.fillRect(tx-3, C.chaoTopo-86, 6, 24);
    c.fillStyle='#4a3b29';
    c.beginPath(); c.moveTo(tx-7,C.chaoTopo-86); c.lineTo(tx+7,C.chaoTopo-86); c.lineTo(tx+4,C.chaoTopo-92); c.lineTo(tx-4,C.chaoTopo-92); c.closePath(); c.fill();
  }

  // chão de lajes com variação por pedra
  const chao = c.createLinearGradient(0,C.chaoTopo,0,H);
  chao.addColorStop(0,'#3b3022'); chao.addColorStop(0.5,'#2c241a'); chao.addColorStop(1,'#16110b');
  c.fillStyle=chao;
  c.fillRect(0,C.chaoTopo,W,H-C.chaoTopo);
  const linhas = 7;
  let yAnt = C.chaoTopo;
  for(let i=1;i<=linhas;i++){
    const y = C.chaoTopo + (C.chaoFundo-C.chaoTopo)*Math.pow(i/linhas,1.55);
    const cols = 5+i;
    for(let k2=0;k2<cols;k2++){
      const x1 = (k2/cols)*W + (rng()-0.5)*16;
      const w1 = W/cols - 4;
      c.fillStyle = `rgba(${150+rng()*40},${130+rng()*30},${95+rng()*25},${0.05+rng()*0.07})`;
      c.fillRect(x1, yAnt+2, w1, y-yAnt-3);
    }
    c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=1;
    c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke();
    yAnt = y;
  }
  // entulho e ossadas junto à parede
  for(let i=0;i<8;i++){
    const ex = rng()*W, ey = C.chaoTopo + 6 + rng()*22;
    c.fillStyle = rng()<0.4 ? 'rgba(216,211,200,0.5)' : 'rgba(20,14,9,0.6)';
    c.beginPath(); c.ellipse(ex, ey, 4+rng()*7, 2+rng()*3, rng()*3, 0, Math.PI*2); c.fill();
  }

  // tinta do rank + escurecer topo
  c.fillStyle = C.masmorra.cor; c.globalAlpha = 0.05; c.fillRect(0,0,W,H); c.globalAlpha = 1;
  const topo = c.createLinearGradient(0,0,0,70);
  topo.addColorStop(0,'rgba(0,0,0,0.55)'); topo.addColorStop(1,'transparent');
  c.fillStyle=topo; c.fillRect(0,0,W,70);
}

/* desenho do cenário por frame: cache + tochas vivas + luz */
function desenharCenario(){
  const {W,H}=C, t=C.tempo;
  if(cenarioCache) ctx.drawImage(cenarioCache, 0, 0, W, H);

  for(let i=0;i<2;i++){
    const tx = W*(0.32+i*0.36), ty = C.chaoTopo-92;
    const fl = 0.7+Math.sin(t*9+i*2.4)*0.3;
    // chama em camadas
    ctx.fillStyle=`rgba(200,70,30,${0.85*fl})`;
    ctx.beginPath(); ctx.ellipse(tx, ty-7, 6, 11+fl*3, Math.sin(t*11+i)*0.15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle=`rgba(226,118,45,${0.9*fl})`;
    ctx.beginPath(); ctx.ellipse(tx, ty-6, 4.5, 8+fl*2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle=`rgba(240,200,110,${0.9*fl})`;
    ctx.beginPath(); ctx.ellipse(tx, ty-4, 2.2, 4.5, 0, 0, Math.PI*2); ctx.fill();
    // poça de luz aditiva
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const luz = ctx.createRadialGradient(tx,ty-6,6, tx,ty-6,120);
    luz.addColorStop(0,`rgba(226,140,60,${0.16*fl})`); luz.addColorStop(1,'transparent');
    ctx.fillStyle=luz;
    ctx.beginPath(); ctx.arc(tx,ty-6,120,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // faúlhas
    if(Math.sin(t*5+i*7)>0.92){
      particula(tx+rnd(-3,3), ty-10, '#f0c052', 1.8, 0.6, rnd(-12,12), -50);
    }
  }
}

function escalaProf(y){ return 0.75 + 0.45*((y-C.chaoTopo)/(C.chaoFundo-C.chaoTopo)); }

function sombraChao(x,y,r){
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x,y+6,r,r*0.32,0,0,Math.PI*2); ctx.fill();
}

function desenharJogador(){
  const j=C.jogador, s=escalaProf(j.y);
  ctx.save(); ctx.translate(j.x,j.y); ctx.scale(s, s);

  // aura de fúria (brilho aditivo)
  if(C.buffFuria>0){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const g = ctx.createRadialGradient(0,-26,4, 0,-26,42);
    g.addColorStop(0,'rgba(216,130,40,0.30)'); g.addColorStop(1,'rgba(216,130,40,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(0,-26,42,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  spriteHeroi(ctx, {
    dir: j.dirAtq||1,
    passo: (j.andando || j.alvoX!==null) ? Math.sin(C.tempo*16)*3 : 0,
    golpe: j.atacando>0 ? (0.18-j.atacando)/0.18 : null,
    invul: j.invul>0,
    t: C.tempo,
  });
  ctx.restore();

  // escudo rúnico visível
  if(C.escudo>0){
    ctx.strokeStyle='rgba(184,168,224,0.6)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.ellipse(j.x, j.y-34*s, 30*s, 42*s, 0, 0, Math.PI*2); ctx.stroke();
  }
}

function desenharAliado(a){
  const s=escalaProf(a.y)*0.8;
  sombraChao(a.x,a.y,16*s);
  // sprite da espécie tintado de violeta (sombra do exército)
  const cv = ARTE.monstroTintado(a.sprite, 'rgba(118,86,196,0.88)');
  ctx.save();
  ctx.globalAlpha=0.92;
  ctx.drawImage(cv, a.x-40*s, a.y-65*s, 80*s, 70*s);
  // brasas violetas a soltar-se
  if(Math.random()<0.1){
    ctx.globalAlpha=0.5;
    ctx.fillStyle='#b89ae8';
    ctx.beginPath(); ctx.arc(a.x+rnd(-10,10)*s, a.y-rnd(10,40)*s, 1.6, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function desenharInimigo(e){
  const s=escalaProf(e.y)*0.85*(e.classe==='boss'?1.8:e.classe==='elite'?1.3:1);
  sombraChao(e.x,e.y,e.raio*s*1.1);
  ctx.save(); ctx.translate(e.x,e.y);

  // vira-se para o Vigia (os desenhos olham para a esquerda)
  const dir = C.jogador.x <= e.x ? 1 : -1;

  // elite/boss: aura subtil do rank por baixo
  if(e.classe!=='normal'){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const g = ctx.createRadialGradient(0,-14*s,2, 0,-14*s,30*s);
    g.addColorStop(0, C.masmorra.cor+'44'); g.addColorStop(1, C.masmorra.cor+'00');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(0,-14*s,30*s,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  ctx.save();
  if(e.windup>0) ctx.translate(rnd(-1.6,1.6), rnd(-1.6,1.6));   // tremor de telégrafo
  ctx.scale(dir*s, s);
  if(e.flash>0) ctx.filter='brightness(2.4)';
  else if(e.congelado>0) ctx.filter='saturate(0.4) brightness(1.35) hue-rotate(150deg)';
  if(e.windup>0){ ctx.shadowColor='#c04438'; ctx.shadowBlur=16; }
  ctx.lineJoin='round'; ctx.lineCap='round';
  ARTE.monstro(ctx, e.sprite, e.adornos);
  ctx.filter='none'; ctx.shadowBlur=0;
  ctx.restore();

  // indicadores de estado (desenhados, sem emoji)
  let ix = e.queimar && (e.congelado>0||e.lento) ? -7*s : 0;
  if(e.queimar){
    ctx.fillStyle='#e2762d';
    ctx.beginPath();
    ctx.moveTo(ix,-58*s);
    ctx.bezierCurveTo(ix+5*s,-54*s,ix+4*s,-50*s,ix,-48*s);
    ctx.bezierCurveTo(ix-4*s,-50*s,ix-5*s,-54*s,ix,-58*s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#f5c245';
    ctx.beginPath(); ctx.arc(ix,-51*s,1.8*s,0,Math.PI*2); ctx.fill();
    ix += 14*s;
  }
  if(e.congelado>0 || e.lento){
    ctx.strokeStyle='#9ad8f0'; ctx.lineWidth=1.8;
    for(let k=0;k<3;k++){
      const a2=k*Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(ix-Math.cos(a2)*4.5*s, -53*s-Math.sin(a2)*4.5*s);
      ctx.lineTo(ix+Math.cos(a2)*4.5*s, -53*s+Math.sin(a2)*4.5*s);
      ctx.stroke();
    }
  }

  // barra de vida com moldura
  const bw = 42*s;
  ctx.fillStyle='rgba(0,0,0,0.7)';
  ctx.fillRect(-bw/2-1, -47*s-1, bw+2, 7);
  ctx.fillStyle='#2c241a';
  ctx.fillRect(-bw/2, -47*s, bw, 5);
  const frac = clamp(e.hp/e.hpMax,0,1);
  ctx.fillStyle = e.classe==='normal' ? '#7da33c' : '#d05c4e';
  ctx.fillRect(-bw/2, -47*s, bw*frac, 5);
  ctx.fillStyle='rgba(255,255,255,0.25)';
  ctx.fillRect(-bw/2, -47*s, bw*frac, 2);
  ctx.restore();
}

function desenharPortal(x,y){
  const t=C.tempo;
  ctx.save(); ctx.translate(x,y);
  // arco de pedra
  ctx.strokeStyle='#6b5a45'; ctx.lineWidth=9;
  ctx.beginPath(); ctx.arc(0,-30,44,Math.PI,0); ctx.stroke();
  ctx.fillStyle='#6b5a45';
  ctx.fillRect(-52,-34,11,40); ctx.fillRect(41,-34,11,40);
  // véu do portal
  const fl = 0.6+Math.sin(t*2.4)*0.25;
  ctx.fillStyle=`rgba(138,111,200,${0.30*fl})`;
  ctx.beginPath(); ctx.ellipse(0,-24,32,44,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=`rgba(138,111,200,${0.7*fl})`; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.ellipse(0,-24,27,38,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

/* ---------- fim do combate ---------- */
function terminarCombate(vitoria, fuga=false){
  if(!C || C.fase==='fim') return;
  C.fase='fim';
  const m = C.masmorra;
  const resultado = { vitoria, fuga, masmorra:m, itens:[], ouro:0, xp:0, cristais:0,
                      sombra:null, runa:null, subiu:0, despertou:false };

  if(vitoria && m.despertar){
    // Provação do Despertar: sem loot normal, dá o Despertar + cristais
    G.despertar++;
    G.contadores.despertar++;
    resultado.despertou = true;
    resultado.cristais = 12;
    resultado.xp = Math.round(m.nivelMon*30);
    G.cristais += resultado.cristais;
    resultado.subiu = darXP(resultado.xp);
  } else if(vitoria){
    const t = statsTotais();
    const multDiaria = m.diaria ? 2 : 1;
    resultado.ouro = rndInt(m.ouro[0], m.ouro[1]) * multDiaria;
    resultado.xp = Math.round((20 + m.nivelMon*9) * m.salas * 0.9) * multDiaria;
    resultado.cristais = rndInt(1,3) * multDiaria;
    const pesoLoot = m.pesoLoot + (m.diaria?0.5:0) + t.sorte * BAL.sorte.raridadePorPonto;
    let nItens = rndInt(1,2) + (C.lootPend.length?1:0);
    if(Math.random() < t.sorte * BAL.sorte.dropExtraPorPonto){
      nItens++;
      resultado.sorteExtra = true;
    }
    for(let i=0;i<nItens;i++) resultado.itens.push(gerarItem(pesoLoot, m.nivelMon));
    G.ouro += resultado.ouro;
    G.cristais += resultado.cristais;
    G.inventario.push(...resultado.itens);
    resultado.subiu = darXP(resultado.xp);
    G.clears[m.rank] = (G.clears[m.rank]||0)+1;
    if(m.diaria) G.diario.feitoDiaria = true;
    resultado.sombra = tentarExtrairSombra(m.rank);
    // runa: drop dos bosses de rank C+
    if(IDX_RARIDADE_RANK(m.rank) >= 2 && Math.random() < BAL.runas.chanceDropBoss){
      resultado.runa = ganharRuna();
    }
  } else if(!fuga){
    resultado.xp = Math.round(C.mortes * (4 + m.nivelMon));
    resultado.subiu = darXP(resultado.xp);
  }
  guardar();

  const era3d = C.modo3d;
  setTimeout(()=>{
    cancelAnimationFrame(rafId);
    if(era3d && window.R3) R3.limpar();
    C = null;
    fimCombateUI(resultado);
  }, fuga?50:650);
}
