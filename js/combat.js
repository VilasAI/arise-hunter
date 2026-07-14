/* ============ MOTOR DE COMBATE (canvas) ============
   Masmorras medievais · poderes com tiers · estados
   (queimadura, gelo, terror) · escudo · fúria · runas  */
'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let C = null;          // estado do combate atual
let rafId = 0, ultimoT = 0, resizePendente = 0;

/* zonas no chão são elipses achatadas — a colisão usa a mesma forma do desenho (IA.4) */
function dentroElipse(px, py, cx, cy, rx, ry){
  const nx=(px-cx)/rx, ny=(py-cy)/ry;
  return nx*nx + ny*ny < 1;
}

function redimensionar(){
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w*dpr; canvas.height = h*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(C){
    const Wo=C.W, Ho=C.H;
    C.W=w; C.H=h; C.chaoTopo=h*0.36; C.chaoFundo=h*0.90;
    // rodar/redimensionar mantém o Watcher em cena, na mesma posição relativa (P2.20)
    const j=C.jogador;
    if(Wo && Ho){ j.x = j.x/Wo*w; j.y = j.y/Ho*h; }
    j.x = clamp(j.x, 24, w-24); j.y = clamp(j.y, C.chaoTopo, C.chaoFundo);
    j.alvoX = null;   // um dash a meio aponta para coordenadas do ecrã antigo
    prerenderCenario();
  }
}
window.addEventListener('resize', ()=>{
  if(resizePendente) return;
  resizePendente=requestAnimationFrame(()=>{ resizePendente=0; redimensionar(); });
});

/* ---------- arranque ---------- */
function iniciarCombate(masmorra){
  const t = statsTotais();
  redimensionar();
  const w = window.innerWidth, h = window.innerHeight;
  C = {
    masmorra, sala:1, totalSalas:masmorra.salas, seedCenario:0,
    W:w, H:h, chaoTopo:h*0.36, chaoFundo:h*0.90,
    fase:'luta', tempoFase:0, shake:0, tempo:0,
    jogador:{
      x:w*0.25, y:h*0.65, hp:t.hpMax, mp:t.mpMax,
      cdAtq:0, cdEsq:0, invul:0, atacando:0, hurt:0, skill:0, skillDur:0, morteInicio:null, dirAtq:1,
      alvoX:null, alvoY:null, andando:false,
      vx:0, vy:0, movia:false, atqBuf:false,  // peso do movimento · ataque em buffer
    },
    joy:null,                         // joystick flutuante {id,bx,by,dx,dy,mag}
    stats:t,
    escudo:0, escudoMax:0,
    buffFuria:0, buffGelo:0, lentoJog:null,
    cdPoder:{},                       // id -> segundos restantes
    inimigos:[], caidos:[], aliados:[], projeteis:[], particulas:[], numeros:[],
    pocas:[], orbes:[], aneisBoss:[],  // efeitos das habilidades dos bosses
    rastos:[], tiros:[],               // rasto da esquiva · projéteis inimigos
    hitstop:0, danoFlash:0,            // micro-pausa nos críticos · flash ao levar dano
    ult:{ carga:0, t:0, tick:0 },      // ultimate: carga, tempo ativo, ritmo interno
    mortes:0, lootPend:[],
    auto:G.auto,
    regenClasse: (typeof passivaClasse==='function' ? passivaClasse().regenHp : 0),
    buffBencao: null,
  };
  criarAliados();
  povoarSala();
  montarSlotsPoder();
  document.getElementById('btn-auto').classList.toggle('ligado', C.auto);
  document.getElementById('btn-ult').hidden = !temUltimate();
  document.getElementById('hud-boss').hidden = true;
  document.getElementById('hud-escudo').hidden = true;
  mostrarEcra('ecra-combate');
  AUDIO.musica('combate', masmorra.rank);
  ultimoT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function criarAliados(){
  for(const s of sombrasAtivas()){
    C.aliados.push({   // incorpóreas: sem HP (D033)
      tipo:'sombra', nome:s.nome, sprite:SOMBRAS_BASE[s.rank].sprite,
      x:C.jogador.x - rnd(40,90), y:C.jogador.y + rnd(-50,50),
      atq:statsSombra(s).atq, vel:90, cd:0, raio:16,
    });
  }
}

function povoarSala(){
  C.inimigos.length = 0;
  prerenderCenario();                       // cada sala tem variação própria
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
    ranged: !!base.ranged, recupera:0, entrou:false, furia:false,
    x: lado>0 ? C.W + 40 + i*30 : -40 - i*30,
    y: rnd(C.chaoTopo+30, C.chaoFundo-10),
    hp:st.hp, hpMax:st.hp, atq:st.dano, def:st.def,
    vel: base.vel * (classe==='boss'?0.85:1),
    cd: rnd(0.3,1.0), windup:0, habAtiva:null, investe:null,
    raio: classe==='boss'?34 : classe==='elite'?24 : 16,
    flash:0, kbvx:0, kbvy:0,
    strafe: Math.random()<0.5?-1:1,   // sentido do passo lateral (arqueiros)
    flank: rnd(-0.42,0.42),           // ângulo de cerco (corpo-a-corpo)
    queimar:null,          // {t, dps}
    lento:null,            // {t, fator}
    congelado:0,           // segundos
  };
  return e;
}

/* ---------- slots de poderes (HUD) ----------
   Direcionais (lâmina/investida/corrente): segurar o botão e arrastar
   mostra a mira; largar dispara nessa direção; toque = alvo mais próximo.
   Instantâneos: disparam logo no pointerdown.                          */
const PODERES_DIRECIONAIS = { lamina:300, investida:280, corrente:240, tiro:300 }; // alcance da mira
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
    def += t.def * g.base.defBonus * ((tal && tal.mod.def)||1) * efeitoPoder('gelo');   // tiers contam (P2.10)
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
  if(j.cdAtq>0){
    // toque perto do fim da recarga fica guardado e dispara sozinho (buffer)
    if(j.cdAtq <= BAL.feel.bufferAtq) j.atqBuf = true;
    return;
  }
  j.atqBuf = false;
  j.cdAtq = 0.55 / velAtqAtual();
  j.atacando = BAL.anim.heroi.ataque;
  const alvo = inimigoMaisProximo();
  if(alvo) j.dirAtq = alvo.x>=j.x?1:-1;              // vira-se para o alvo

  // classes à distância (Mago/Batedor): tiro básico em projétil
  if(typeof classeDistancia==='function' && classeDistancia()){
    let dx, dy;
    if(alvo){ dx=alvo.x-j.x; dy=(alvo.y-20)-(j.y-26); } else { dx=j.dirAtq; dy=0; }
    const d=Math.hypot(dx,dy)||1, cor=(typeof corClasse==='function' && corClasse())||'#cfe0a0';
    const sprTiro = baseHeroi()+'_proj';    // frames verdadeiros do projétil (D028) — só o Mago os tem
    C.projeteis.push({ tipo:'lamina', x:j.x+j.dirAtq*10, y:j.y-26, vx:dx/d*640, vy:dy/d*640, t:1.0, dano: atqAtual(), cor,
                       spr: SPR.ok(sprTiro)?sprTiro:null, nasceu:C.tempo });
    for(let i=0;i<3;i++) particula(j.x+j.dirAtq*20, j.y-26, cor, 2.2, 0.2);
    return;
  }

  if(alvo){
    const d = Math.hypot(alvo.x-j.x, alvo.y-j.y);
    if(d <= BAL.combate.alcanceAtaque + alvo.raio){
      golpeConecta(alvo);
      return;
    }
  }
  // golpe no ar (falhou o alcance)
  for(let i=0;i<4;i++) particula(j.x + j.dirAtq*42, j.y-26, '#d8c9a8', 2.5, 0.22);
}

/* Roubo de Vida (stat + Sede de Sangue + Runa Sangrenta + Ira Imortal) */
function aplicarRoubo(dano){
  const j=C.jogador, t=C.stats;
  let roubo = t.roubo;
  if(C.buffFuria>0 && arvKeystone('g_ks_fur')) roubo += 15;   // Ira Imortal
  if(roubo<=0) return;
  const cura = dano * roubo/100;
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
  // Baluarte de Ferro: os golpes atordoam
  if(C.ult.t>0 && G.classe==='guerreiro') alvo.congelado = Math.max(alvo.congelado, BAL.ultimates.guerreiro.stunGolpe);
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
  j.cdEsq = B.dashCd * (1 - t.cdr/100) * passivaClasse().dashMult;   // Batedor esquiva mais depressa (P2.4)
  j.invul = B.dashInvul;
  j.atacando = 0;
  j.cdAtq = Math.min(j.cdAtq, BAL.feel.dashCancel);   // o dash cancela o recovery do golpe
  AUDIO.sfx('dash');
  j.alvoX = clamp(j.x + nx*B.dashDist, 30, C.W-30);
  j.alvoY = clamp(j.y + ny*B.dashDist, C.chaoTopo, C.chaoFundo);
  if(Math.abs(nx) > 0.2) j.dirAtq = nx>=0?1:-1;
  C.shake = Math.max(C.shake, 2.5);
  for(let i=0;i<8;i++) particula(j.x, j.y, '#a3937a', 3, 0.4);
}

/* ---------- ultimate da classe (D011/D018 — desbloqueia no 1.º Despertar) ---------- */
function usarUltimate(){
  if(!C || C.fase!=='luta' || !temUltimate()) return;
  const U = BAL.ultimates, u = C.ult;
  if(u.t>0 || u.carga < U.cargaMax) return;
  const j=C.jogador, t=C.stats, cfg=U[G.classe], mult=multAltarUlt();
  j.skill = j.skillDur = BAL.anim.heroi.skill;  // toca uma vez; não fica em loop durante o buff
  u.carga = 0;
  AUDIO.sfx('ultimate');
  C.shake = Math.max(C.shake, 10);
  numero(j.x, j.y-92, ultimateClasse().nome+'!', ultimateClasse().cor, 20);
  switch(G.classe){
    case 'guerreiro':                       // Baluarte: efeitos lidos em ferirJogador/golpeConecta
    case 'mago':                            // Tempestade: meteoros no atualizar
    case 'batedor':                         // Tempo de Caça: disparos no atualizar
      u.t = (cfg.dur + (G.classe==='guerreiro' && arvKeystone('g_ks_dom') ? 3 : 0)) * mult;  // Baluarte Eterno
      u.tick = 0;
      break;
    case 'assassino': {                     // Chamada: a coleção inteira entra em campo
      u.t = cfg.dur;                        // (o Altar já reforça as sombras)
      const emCampo = new Set(C.aliados.map(a=>a.nome));
      for(const s of G.sombras){
        if(emCampo.has(s.nome)) continue;   // as já ativas não se duplicam (P2.5)
        C.aliados.push({                    // incorpóreas: sem HP (D033)
          tipo:'sombra', nome:s.nome, sprite:SOMBRAS_BASE[s.rank].sprite,
          x:clamp(j.x+rnd(-80,80), 24, C.W-24), y:clamp(j.y+rnd(-60,60), C.chaoTopo, C.chaoFundo),
          atq:statsSombra(s).atq, vel:110, cd:0, raio:16, temp:u.t,
        });
      }
      for(let i=0;i<24;i++) particula(j.x+rnd(-60,60), j.y-10+rnd(-40,10), '#8a6fc8', 4.5, 0.6);
      break;
    }
    case 'paladino': {                      // Aurora: explosão instantânea
      const cura = t.hpMax * cfg.cura * mult;
      j.hp = Math.min(t.hpMax, j.hp + cura);
      numero(j.x, j.y-74, '+'+Math.round(cura), '#f0d272', 18);
      C.lentoJog = null;                    // purga
      for(const e of [...C.inimigos]){
        if(Math.hypot(e.x-j.x, e.y-j.y) <= cfg.raio + e.raio){
          const g = calcularGolpe(atqAtual()*cfg.dano*mult, t.crit, t.critDano, t.pen, e.def);
          ferirInimigo(e, g.dano, g.crit, '#f0d272');
          e.congelado = Math.max(e.congelado, cfg.cegar);   // cegos
        }
      }
      if(arvKeystone('p_ks_dom')) j.invul = Math.max(j.invul, 1.5);   // Alvorada
      C.anelSkill = { x:j.x, y:j.y, t:0.6, cor:'#f0e0a0' };
      for(let i=0;i<30;i++){ const a=(i/30)*Math.PI*2; particula(j.x+Math.cos(a)*36, j.y-18+Math.sin(a)*20, '#f0e0a0', 5, 0.6, Math.cos(a)*240, Math.sin(a)*150); }
      break;
    }
  }
}
document.getElementById('btn-ult').addEventListener('pointerdown', e=>{
  e.preventDefault();
  if(C && !C.auto) usarUltimate();
});

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
  AUDIO.sfx('poder');

  switch(id){
    case 'lamina': {
      const n = ((tal && tal.mod.projeteis) || 1) + (arvKeystone('b_ks_lam') ? 1 : 0);  // Lâminas Gémeas
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
          if(arvKeystone('g_ks_inv')) e.congelado = Math.max(e.congelado, 0.8);  // Terramoto
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
      const decai = arvKeystone('m_ks_cor') ? 1 : p.base.decai;     // Tempestade Perfeita
      cadeiaRelampago(primeiro, atqAtual()*p.base.dano*ef, saltos, decai);
      break;
    }
    case 'brasas': {
      for(const e of [...C.inimigos]){
        if(Math.hypot(e.x-j.x,e.y-j.y) <= p.base.raio + e.raio){
          const g = calcularGolpe(atqAtual()*p.base.dano*ef, t.crit, t.critDano, t.pen, e.def);
          ferirInimigo(e, g.dano, g.crit, PODERES.brasas.cor);
          aplicarQueimadura(e, atqAtual()*p.base.queima*ef, p.base.dur);
          if(arvKeystone('m_ks_bra')) aplicarLentidao(e, 0.15, p.base.dur);   // Pira
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
      // os tiers ampliam o efeito real: congelamento e lentidão escalam com ef (P2.10)
      const congela = (p.base.congela + ((tal && tal.mod.congelaExtra)||0)
                    + (arvKeystone('m_ks_gel') ? 0.6 : 0)) * ef;   // Zero Absoluto
      for(const e of C.inimigos){
        if(Math.hypot(e.x-j.x,e.y-j.y) <= p.base.raio + e.raio){
          e.congelado = Math.max(e.congelado, congela);
          aplicarLentidao(e, Math.min(0.8, p.base.lentidao*ef), p.base.dur);
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
    case 'execucao': {
      // golpe brutal no inimigo enfraquecido mais próximo (abaixo do limiar de vida)
      const limiar = (tal && tal.mod.limiar) || p.base.limiar;
      let fraco = null, md = 170;
      for(const e of C.inimigos){
        if(e.hp/e.hpMax > limiar) continue;
        const d = Math.hypot(e.x-j.x, e.y-j.y);
        if(d < md){ md = d; fraco = e; }
      }
      if(!fraco){ j.mp += p.mp||0; C.cdPoder[id] = 0; numero(j.x, j.y-50, 'Ninguém enfraquecido', '#a3937a', 13); return; }
      j.dirAtq = fraco.x>=j.x ? 1 : -1;
      const g = calcularGolpe(atqAtual()*p.base.dano*ef, t.crit, t.critDano, t.pen, fraco.def);
      ferirInimigo(fraco, g.dano, g.crit, p.cor);
      aplicarRoubo(g.dano);
      if(arvKeystone('a_ks_exe') && fraco.hp<=0) C.cdPoder[id] = 0;   // Decapitar
      C.shake = Math.max(C.shake, 8);
      for(let i=0;i<14;i++) particula(fraco.x, fraco.y-16, p.cor, 4.5, 0.5);
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
      if(arvKeystone('a_ks_pas') && alvo.hp>0){                  // Golpe Fantasma
        const g2 = calcularGolpe(atqAtual()*p.base.dano*ef*0.6, critP, t.critDano, t.pen, alvo.def);
        ferirInimigo(alvo, g2.dano, g2.crit, p.cor);
        aplicarRoubo(g2.dano);
      }
      for(let i=0;i<8;i++) particula(j.x, j.y-20, p.cor, 3.5, 0.4);
      break;
    }
    case 'tiro': {
      const nf = p.base.flechas + ((tal&&tal.mod.flechasExtra)||0) + (arvKeystone('b_ks_tir') ? 2 : 0);  // Chuva Negra
      let bx, by;
      if(dir){ bx=dir.x; by=dir.y; }
      else if(alvo){ bx=alvo.x-j.x; by=(alvo.y-20)-(j.y-26); }
      else { bx=j.dirAtq; by=0; }
      const baseAng = Math.atan2(by,bx);
      for(let k=0;k<nf;k++){
        const ang = baseAng + (k-(nf-1)/2)*0.14;
        C.projeteis.push({ tipo:'lamina', x:j.x, y:j.y-26, vx:Math.cos(ang)*600, vy:Math.sin(ang)*600, t:0.9,
                           dano: atqAtual()*p.base.dano*ef, cor:p.cor });
      }
      for(let i=0;i<6;i++) particula(j.x+j.dirAtq*16, j.y-26, p.cor, 3, 0.3);
      break;
    }
    case 'luz': {
      const cura = t.hpMax * p.base.cura * ef;                 // a Graça (mod.efeito) conta na cura…
      j.hp = Math.min(t.hpMax, j.hp + cura);
      numero(j.x, j.y-74, '+'+Math.round(cura), '#f0d272', 16);
      const efDano = ef / ((tal && tal.mod.efeito)||1);        // …mas não no dano sagrado (P2.10)
      const danoMul = (tal&&tal.mod.dano)||1;
      const raioLuz = p.base.raio * (arvKeystone('p_ks_luz') ? 1.5 : 1);   // Sol Nascente
      for(const e of [...C.inimigos]){
        if(Math.hypot(e.x-j.x,e.y-j.y) <= raioLuz + e.raio){
          const g = calcularGolpe(atqAtual()*p.base.dano*danoMul*efDano, t.crit, t.critDano, t.pen, e.def);
          ferirInimigo(e, g.dano, g.crit, p.cor);
        }
      }
      for(let i=0;i<22;i++){ const a=(i/22)*Math.PI*2; particula(j.x+Math.cos(a)*30, j.y-20+Math.sin(a)*18, '#f0e0a0', 4, 0.5, Math.cos(a)*120, Math.sin(a)*80); }
      C.anelSkill = { x:j.x, y:j.y, t:0.45, cor:'#f0d272' };
      break;
    }
    case 'martelo': {
      const raio = p.base.raio * ((tal&&tal.mod.raio)||1);
      const stun = p.base.stun + ((tal&&tal.mod.stunExtra)||0) + (arvKeystone('p_ks_mar') ? 0.5 : 0);  // Julgamento
      for(const e of C.inimigos){
        if(Math.hypot(e.x-j.x,e.y-j.y) <= raio + e.raio){
          const g = calcularGolpe(atqAtual()*p.base.dano*ef, t.crit, t.critDano, t.pen, e.def);
          ferirInimigo(e, g.dano, g.crit, p.cor);
          e.congelado = Math.max(e.congelado, stun);
        }
      }
      C.shake = Math.max(C.shake, 10);
      C.anelSkill = { x:j.x, y:j.y, t:0.5, cor:p.cor };
      for(let i=0;i<20;i++){ const a=(i/20)*Math.PI*2; particula(j.x+Math.cos(a)*40, j.y+Math.sin(a)*22, p.cor, 5, 0.5, Math.cos(a)*200, Math.sin(a)*120); }
      break;
    }
    case 'bencao': {
      C.escudoMax = Math.round(t.hpMax * p.base.absorve * ef);
      C.escudo = C.escudoMax;
      document.getElementById('hud-escudo').hidden = false;
      C.buffBencao = { t: p.base.dur, regen: p.base.regen * ((tal&&tal.mod.regen)||1) };
      numero(j.x, j.y-78, 'BÊNÇÃO', '#f0d272', 16);
      for(let i=0;i<14;i++) particula(j.x, j.y-30, '#f0e0a0', 4, 0.6);
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
  if(e.morto) return;   // abate já processado — procs em cadeia não contam a morte duas vezes
  // keystones: Pânico (na Aura de Terror) · Marca do Ceifeiro (alvos enfraquecidos)
  if(arvKeystone('b_ks_ter') && poderTier('terror')){
    const talT = talentoDe('terror');   // o Pavor alarga a aura — o Pânico acompanha (P2.10)
    if(Math.hypot(e.x-C.jogador.x, e.y-C.jogador.y) < PODERES.terror.base.raio * ((talT && talT.mod.raio)||1))
      dano = Math.round(dano*1.10);
  }
  if(arvKeystone('a_ks_sed') && e.hp/e.hpMax < 0.30) dano = Math.round(dano*1.15);
  e.hp -= dano; e.flash = BAL.anim.inimigo.dano;
  // knockback com decaimento: impulso para longe do Watcher que trava suave (bosses quase imunes)
  const j2 = C.jogador;
  const kdx = e.x-j2.x, kdy = e.y-j2.y, kd = Math.hypot(kdx,kdy)||1;
  const kb = BAL.feel.kbVel * (e.classe==='boss' ? 0.25 : e.classe==='elite' ? 0.5 : 1);
  e.kbvx = kdx/kd*kb; e.kbvy = kdy/kd*kb;
  // hit-stop universal leve; nos críticos, dramático
  C.hitstop = Math.max(C.hitstop, crit ? BAL.feel.hitstopCrit : BAL.feel.hitstop);
  AUDIO.sfx(crit ? 'crit' : 'golpe');
  // carga da ultimate: proporcional ao dano causado (relativo ao ataque)
  if(temUltimate() && C.ult.t<=0){
    C.ult.carga = Math.min(BAL.ultimates.cargaMax,
      C.ult.carga + (dano/atqAtual()*BAL.ultimates.cargaPorGolpe + (e.hp<=0 ? BAL.ultimates.cargaPorAbate : 0))
                    * (C.stats.cargaUltMult||1));
  }
  numero(e.x, e.y - e.raio - 14, crit ? dano+'!' : dano, crit?'#e8c84a':cor, crit?24:15);
  if(e.hp<=0){
    e.morto = true;
    e.morteInicio = C.tempo;
    C.caidos ||= [];
    C.caidos.push(e);       // fica visível tempo suficiente para tocar a animação death
    C.mortes++;
    G.contadores.mortes++;
    // Sede de Sangue: cura ao abater
    if(poderTier('sede')){
      const tal = talentoDe('sede');
      const cura = C.stats.hpMax * PODERES.sede.base.curaKill * efeitoPoder('sede') * ((tal && tal.mod.kill)||1);
      C.jogador.hp = Math.min(C.stats.hpMax, C.jogador.hp + cura);
    }
    for(let i=0;i<16;i++) particula(e.x,e.y,'#8a6fc8',4,0.6);
    C.inimigos = C.inimigos.filter(x=>x!==e);
    if(e.classe==='elite'){ C.lootPend.push('elite'); }
  }
}

/* ---------- auto-combate ---------- */
/* direção normalizada a afastar-se de um ponto (no próprio ponto: para o lado) */
function fugirDe(x, y){
  const j=C.jogador, dx=j.x-x, dy=j.y-y, d=Math.hypot(dx,dy);
  return d<1 ? { x:1, y:0 } : { x:dx/d, y:dy/d };
}

/* perigo iminente para o auto-combate: golpes, habilidades, projéteis e
   zonas no chão (IA.2). Devolve a direção de fuga, ou null. */
function perigoAuto(){
  const j=C.jogador, B=BAL.combate;
  for(const e of C.inimigos){
    // carga já em voo na nossa direção: sai da linha
    if(e.investe && !e.investe.feriu){
      const vm=Math.hypot(e.investe.vx,e.investe.vy)||1, d=Math.hypot(j.x-e.x,j.y-e.y)||1;
      if(((j.x-e.x)*e.investe.vx+(j.y-e.y)*e.investe.vy)/(vm*d) > 0.7)
        return { x:-e.investe.vy/vm, y:e.investe.vx/vm };
    }
    if(e.windup<=0 || e.windup>0.35) continue;   // só quando está quase a resolver
    const d=Math.hypot(e.x-j.x,e.y-j.y), h=e.habAtiva && e.habAtiva.tipo;
    if(h==='investida' && d<B.alcanceHab+40){
      const a=e.habAtiva.ang;
      return { x:-Math.sin(a), y:Math.cos(a) };  // perpendicular à carga
    }
    if(h==='tremor' && d<140) return fugirDe(e.x, e.y);
    if(h==='poca' && Math.hypot(e.habAtiva.alvoX-j.x, e.habAtiva.alvoY-j.y)<70)
      return fugirDe(e.habAtiva.alvoX, e.habAtiva.alvoY);
    if(!h && !e.ranged && d<70) return fugirDe(e.x, e.y);   // golpe corpo-a-corpo
  }
  // projétil ou orbe em rota de colisão
  for(const tr of C.tiros){
    const dx=j.x-tr.x, dy=(j.y-26)-tr.y, d=Math.hypot(dx,dy)||1, vm=Math.hypot(tr.vx,tr.vy)||1;
    if(d<100 && (dx*tr.vx+dy*tr.vy)/(d*vm) > 0.85) return { x:-tr.vy/vm, y:tr.vx/vm };
  }
  for(const o of C.orbes) if(Math.hypot(o.x-j.x, o.y-(j.y-30))<80) return fugirDe(o.x, o.y);
  // está dentro de uma zona de perigo no chão: sai dela
  for(const p of C.pocas) if(dentroElipse(j.x, j.y, p.x, p.y, p.r, p.r*0.45)) return fugirDe(p.x, p.y);
  for(const a of C.aneisBoss) if(dentroElipse(j.x, j.y, a.x, a.y, a.r+20, (a.r+20)*0.5)) return fugirDe(a.x, a.y);
  return null;
}

function autoIA(dt){
  const j=C.jogador;
  const alvo = inimigoMaisProximo();
  if(!alvo) return;
  const d = Math.hypot(alvo.x-j.x, alvo.y-j.y);
  const fuga = perigoAuto();
  if(fuga){
    if(j.cdEsq<=0){ esquivar(fuga.x, fuga.y); return; }
    // sem dash pronto: afasta-se a andar
    const v = BAL.combate.velJogador * C.stats.velMov * dt;
    j.x = clamp(j.x + fuga.x*v, 24, C.W-24);
    j.y = clamp(j.y + fuga.y*v, C.chaoTopo, C.chaoFundo);
    j.andando = true;
    return;
  }
  // ultimate carregada dispara logo
  if(temUltimate() && C.ult.t<=0 && C.ult.carga>=BAL.ultimates.cargaMax) usarUltimate();
  // usa poderes prontos com critério simples
  for(let i=0;i<G.equipadosPoder.length;i++){
    const id = G.equipadosPoder[i];
    if(!id || (C.cdPoder[id]||0)>0) continue;
    const p = PODERES[id];
    if(j.mp < (p.mp||0)) continue;
    if((id==='escudo'||id==='bencao') && j.hp > C.stats.hpMax*0.55) continue;
    if(id==='luz' && j.hp > C.stats.hpMax*0.7 && C.inimigos.length<2) continue;
    if(id==='furia' && !C.inimigos.some(e=>e.classe!=='normal')) continue;
    if(['brasas','gelo','martelo'].includes(id) && C.inimigos.length<3) continue;
    if(d<200 || ['lamina','corrente','tiro'].includes(id)){ usarPoder(i); return; }
  }
  // classes à distância atacam de longe; corpo-a-corpo aproxima-se
  const dist = (typeof classeDistancia==='function' && classeDistancia());
  const alc = dist ? 320 : BAL.combate.alcanceAtaque + alvo.raio;
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
  desenhar();
}


function atualizar(dt){
  const j = C.jogador, t = C.stats;
  j.hurt = Math.max(0, (j.hurt||0)-dt);
  j.skill = Math.max(0, (j.skill||0)-dt);
  C.caidos = (C.caidos||[]).filter(e=> C.tempo-(e.morteInicio||0) < BAL.anim.inimigo.caido);

  if(C.fase==='porta'){
    C.tempoFase += dt;
    j.x += (C.W*0.85 - j.x)*dt*2.2;
    j.y += (C.H*0.63 - j.y)*dt*2.2;
    if(C.tempoFase > 1.15){
      C.sala++;
      j.x = C.W*0.2; j.y = C.H*0.65;
      C.fase='luta';
      povoarSala();
    }
  }
  if(C.fase==='fim') return;

  // cooldowns / regen / buffs
  j.cdAtq=Math.max(0,j.cdAtq-dt); j.cdEsq=Math.max(0,j.cdEsq-dt);
  j.invul=Math.max(0,j.invul-dt);
  if(j.atqBuf && j.cdAtq<=0 && C.fase==='luta') atacar();   // dispara o toque guardado
  for(const k of Object.keys(C.cdPoder)) C.cdPoder[k] = Math.max(0, C.cdPoder[k]-dt);
  C.buffFuria = Math.max(0, C.buffFuria-dt);
  C.buffGelo = Math.max(0, C.buffGelo-dt);
  j.mp = clamp(j.mp + BAL.jogador.regenMp*dt, 0, t.mpMax);
  // regeneração: Bênção (Paladino) + passiva de classe
  if(C.buffBencao){ j.hp = Math.min(t.hpMax, j.hp + t.hpMax*C.buffBencao.regen*dt); C.buffBencao.t -= dt; if(C.buffBencao.t<=0) C.buffBencao=null; }
  if(C.regenClasse>0 && j.hp>0) j.hp = Math.min(t.hpMax, j.hp + t.hpMax*C.regenClasse*dt);

  // ultimate ativa: temporizador + efeitos periódicos (Tempestade / Tempo de Caça)
  if(C.ult.t > 0){
    C.ult.t = Math.max(0, C.ult.t - dt);
    const U = BAL.ultimates, mult = multAltarUlt();
    C.ult.tick -= dt;
    if(G.classe==='mago' && C.ult.tick<=0 && C.inimigos.length){
      C.ult.tick = U.mago.ritmo * (arvKeystone('m_ks_dom') ? 0.8 : 1);   // Olho da Tempestade
      const e = escolher(C.inimigos);
      const g = calcularGolpe(atqAtual()*U.mago.dano*mult, t.crit, t.critDano, t.pen, e.def);
      ferirInimigo(e, g.dano, g.crit, '#b89ae8');
      for(let i=0;i<10;i++) particula(e.x+rnd(-14,14), e.y-40-rnd(0,30), '#b89ae8', 4, 0.4, rnd(-30,30), 220);
      C.shake = Math.max(C.shake, 3);
    } else if(G.classe==='batedor' && C.ult.tick<=0 && C.inimigos.length){
      C.ult.tick = U.batedor.ritmo;
      const alvos = [...C.inimigos]
        .sort((a,b)=> Math.hypot(a.x-j.x,a.y-j.y) - Math.hypot(b.x-j.x,b.y-j.y))
        .slice(0, arvKeystone('b_ks_dom') ? 4 : 3);   // Época de Caça
      for(const e of alvos){
        C.projeteis.push({ tipo:'lamina', x:j.x, y:j.y-26, alvo:e, critG:true,
                           dano: atqAtual()*U.batedor.dano*mult, vel:700, cor:'#cfe0a0' });
      }
    }
  }

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

  // MOVIMENTO LIVRE pelo joystick — analógico e com peso: a velocidade real
  // persegue a do joystick com a constante de tempo BAL.feel.acelMov
  let tvx = 0, tvy = 0;
  if(C.joy && C.joy.mag>0.08 && j.alvoX===null && C.fase==='luta' && !C.auto){
    const lento = C.lentoJog ? 1-C.lentoJog.fator : 1;
    const vMax = BAL.combate.velJogador * t.velMov * lento * C.joy.mag;
    const m = Math.hypot(C.joy.dx, C.joy.dy)||1;
    tvx = C.joy.dx/m*vMax; tvy = C.joy.dy/m*vMax;
    if(Math.abs(C.joy.dx) > JOY_RAIO*0.12) j.dirAtq = C.joy.dx>=0 ? 1 : -1;
  }
  const kAcel = Math.min(1, dt/BAL.feel.acelMov);
  j.vx += (tvx-j.vx)*kAcel; j.vy += (tvy-j.vy)*kAcel;
  const vAbs = Math.hypot(j.vx, j.vy);
  if(vAbs > 8){
    j.x = clamp(j.x + j.vx*dt, 24, C.W-24);
    j.y = clamp(j.y + j.vy*dt, C.chaoTopo, C.chaoFundo);
  }
  j.andando = vAbs > 20;
  // poeira no arranque e na travagem
  const querMover = !!(tvx || tvy);
  if(querMover !== j.movia && (querMover || vAbs > 80)){
    for(let i=0;i<5;i++) particula(j.x+rnd(-8,8), j.y-2, '#a3937a', 2.2, 0.3, rnd(-40,40), rnd(-60,-10));
  }
  j.movia = querMover;
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
  // sombras temporárias da Chamada das Sombras dissipam-se no fim
  for(const a of C.aliados) if(a.temp!==undefined) a.temp -= dt;
  C.aliados = C.aliados.filter(a=> a.temp===undefined || a.temp>0);

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
    // knockback em curso: impulso que decai até parar (nada de saltos secos)
    if(e.kbvx || e.kbvy){
      e.x += e.kbvx*dt;
      e.y += e.kbvy*dt;
      const trav = Math.exp(-BAL.feel.kbTravao*dt);
      e.kbvx *= trav; e.kbvy *= trav;
      if(Math.abs(e.kbvx)+Math.abs(e.kbvy) < 6) e.kbvx = e.kbvy = 0;
    }
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
    // fúria: corpo-a-corpo ferido a fundo enfurece (uma vez): mais rápido e mais forte
    const FU = BAL.combate.furia;
    if(!e.furia && !e.ranged && e.classe!=='boss' && e.hp < e.hpMax*FU.hp){
      e.furia = true; e.vel *= FU.vel; e.atq = Math.round(e.atq*FU.dano);
      numero(e.x, e.y-46, 'FÚRIA!', '#e2762d', 13);
      for(let k=0;k<8;k++) particula(e.x, e.y-18, '#d05c4e', 3.5, 0.5);
    }
    if(e.furia && Math.random()<dt*5) particula(e.x+rnd(-8,8), e.y-26, '#d05c4e', 2.6, 0.35, rnd(-10,10), -40);

    const dx=j.x-e.x, dy=j.y-e.y, d=Math.hypot(dx,dy);
    const noTerror = terrorOn && d < terrorRaio;
    let velMult = 1;
    if(e.lento) velMult *= 1-e.lento.fator;
    if(noTerror) velMult *= 1-terrorLent;
    if(e.congelado>0) velMult = 0;

    if(e.investe){
      // carga em linha em curso (bosses e monstros com hab 'investida');
      // congelado trava-a por completo, lentidão/terror abrandam-na (IA.6)
      if(velMult>0){
        e.investe.t -= dt*velMult;
        e.x += e.investe.vx*velMult*dt;
        e.y += e.investe.vy*velMult*dt;
        if(!e.investe.feriu && Math.hypot(j.x-e.x,j.y-e.y) < e.raio+36 && j.invul<=0){
          e.investe.feriu = true; ferirJogador(e.investe.dano, e);   // dano fixado no windup (IA.7)
        }
        if(Math.random()<dt*30) particula(e.x, e.y-12, '#d05c4e', 4, 0.3);
        if(e.investe.t<=0){ e.investe=null; e.cd=rnd(1.0,1.6); }
      }
    }
    else if(e.windup>0){
      if(e.congelado<=0) e.windup -= dt;
      if(e.windup<=0){
        let dano = e.atq;
        if(noTerror) dano *= 1-terrorFraq;
        if(e.habAtiva){ resolverHab(e, dano); e.habAtiva=null; }
        else if(e.ranged){
          // dispara um projétil em linha reta (esquivável)
          tiroInimigo(e, Math.atan2((j.y-26)-(e.y-24), j.x-e.x), dano, BAL.combate.velProjInimigo);
        }
        else if(d < e.raio+52 && j.invul<=0) ferirJogador(dano, e);
        e.cd = rnd(BAL.combate.cdAtq[0], BAL.combate.cdAtq[1]);
        e.recupera = BAL.combate.recuperar;   // pausa pós-golpe: não cola
      }
    } else {
      e.cd -= dt*(e.congelado>0?0:1);
      e.recupera = Math.max(0, e.recupera-dt);
      const B = BAL.combate;
      const alcance = e.ranged ? B.alcanceRanged : e.raio+46;
      if(!e.entrou){
        // ainda a entrar na sala: caminha direto ao Watcher até pisar o ecrã
        if(e.x>24 && e.x<C.W-24) e.entrou = true;
        else { e.x += dx/d*e.vel*velMult*dt; e.y += dy/d*e.vel*velMult*dt; }
      } else if(e.hab && e.cd<=0 && d < (e.hab==='tremor' ? 140 : B.alcanceHab)
                && Math.random() < 1-Math.exp(-(e.classe==='boss' ? B.habPorSegBoss : B.habPorSeg)*dt)){
        prepararHab(e);
      } else if(e.recupera > 0){
        // recua ligeiramente depois de atacar
        e.x -= dx/d*e.vel*0.35*velMult*dt; e.y -= dy/d*e.vel*0.35*velMult*dt;
      } else if(e.ranged){
        // arqueiro/feiticeiro: mantém-se recuado e dispara (kiting + strafe)
        const perto = alcance*0.70, longe = alcance*0.98;
        if(d < perto){
          // demasiado perto — recua sem virar costas ao Watcher
          e.x -= dx/d*e.vel*0.95*velMult*dt;
          e.y -= dy/d*e.vel*0.95*velMult*dt;
        } else if(d > longe){
          // fora de alcance — aproxima-se até poder disparar
          e.x += dx/d*e.vel*0.75*velMult*dt; e.y += dy/d*e.vel*0.75*velMult*dt;
        } else {
          // distância ideal — passo lateral (perpendicular) para ser alvo difícil
          const perpx = -dy/d, perpy = dx/d, spd = e.vel*0.5*velMult*dt;
          e.x += perpx*e.strafe*spd;
          e.y += perpy*e.strafe*spd;
          if(e.y <= C.chaoTopo+8 || e.y >= C.chaoFundo-8) e.strafe *= -1;
        }
        if(e.cd<=0 && d < alcance*1.05) e.windup = BAL.anim.inimigo.disparo;   // dispara assim que recarrega
      } else if(d > alcance){
        // corpo-a-corpo: persegue o Watcher cercando-o por um ângulo de flanco
        const ang = Math.atan2(dy,dx) + e.flank;
        e.x += Math.cos(ang)*e.vel*velMult*dt; e.y += Math.sin(ang)*e.vel*velMult*dt;
      } else if(e.cd<=0){
        e.windup = BAL.anim.inimigo.golpe;
      }
    }

    // barreira do ecrã: depois de entrar, nenhum movimento (IA, carga, knockback) o tira de cena
    if(e.entrou){
      e.x = clamp(e.x, 24, C.W-24);
      e.y = clamp(e.y, C.chaoTopo, C.chaoFundo);
    }
  }

  // separação entre inimigos (não se empilham) — só depois de pisarem o ecrã (IA.5)
  for(let a=0;a<C.inimigos.length;a++){
    for(let b2=a+1;b2<C.inimigos.length;b2++){
      const A=C.inimigos[a], B2=C.inimigos[b2];
      if(!A.entrou || !B2.entrou) continue;
      const sdx=B2.x-A.x, sdy=B2.y-A.y, sd=Math.hypot(sdx,sdy)||1;
      const minD = BAL.combate.separacao + (A.raio+B2.raio)*0.35;
      if(sd < minD){
        const push = (minD-sd)/2;   // margens iguais à barreira do ecrã
        A.x = clamp(A.x - sdx/sd*push, 24, C.W-24); A.y = clamp(A.y - sdy/sd*push, C.chaoTopo, C.chaoFundo);
        B2.x = clamp(B2.x + sdx/sd*push, 24, C.W-24); B2.y = clamp(B2.y + sdy/sd*push, C.chaoTopo, C.chaoFundo);
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
    if(p.tick<=0 && dentroElipse(j.x, j.y, p.x, p.y, p.r, p.r*0.45) && j.invul<=0){
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
      if(dentroElipse(j.x, j.y, a.x, a.y, a.r, a.r*0.5) && j.invul<=0) ferirJogador(a.dano);
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
      if(p.critG && !g.crit){ g.dano = Math.round(g.dano * t2.critDano/100); g.crit = true; }  // Tempo de Caça
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
  const cdMaxE = BAL.combate.dashCd * (1 - t.cdr/100) * passivaClasse().dashMult;   // (P2.4)
  beq.querySelector('.cd-sweep').style.setProperty('--cd', Math.round(clamp(j.cdEsq/cdMaxE,0,1)*100));
  beq.classList.toggle('pronto', j.cdEsq<=0);
  // botão da ultimate: barra de carga + estados
  const bu = document.getElementById('btn-ult');
  if(!bu.hidden){
    bu.querySelector('.ult-carga-fill').style.width =
      (C.ult.t>0 ? 100 : Math.round(C.ult.carga/BAL.ultimates.cargaMax*100)) + '%';
    bu.classList.toggle('pronto', C.ult.t<=0 && C.ult.carga>=BAL.ultimates.cargaMax);
    bu.classList.toggle('ativa', C.ult.t>0);
  }
  atualizarSlotsPoder();

  // sala limpa?
  if(C.fase==='luta' && C.inimigos.length===0){
    if(C.sala >= C.totalSalas){ terminarCombate(true); }
    else { C.fase='porta'; C.tempoFase=0; toast('Sala limpa! ➜'); }
  }
}

/* ---------- habilidades dos monstros (bosses e monstros com `hab` no data.js) ---------- */
/* projétil inimigo: sprite real da prancha quando existe (D028), vetorial senão */
function tiroInimigo(e, ang, dano, vp){
  const m2t = modelo2dDe(e.sprite), sprTiro = anim2d(m2t,'proj');
  C.tiros.push({
    x:e.x, y:e.y-24, vx:Math.cos(ang)*vp, vy:Math.sin(ang)*vp,
    dano, t:3, spr: SPR.ok(sprTiro)?sprTiro:null, tint: m2t.cor||null, nasceu: C.tempo,
    cor: e.sprite==='orcmago' ? '#b89ae8' : e.sprite==='sacerdote' ? '#d05c4e'
       : e.sprite==='draconiano' ? '#e2762d' : e.sprite==='aranha' ? '#9ad06a' : '#d8c38a',
  });
}

function prepararHab(e){
  const j = C.jogador;
  const dur = { invocar:0.9, acido:0.9, orbes:0.8, investida:0.9, sopro:1.0, aneis:1.1,
                rajada:0.7, poca:0.8, tremor:1.0 }[e.hab] || 0.9;
  e.habAtiva = { tipo:e.hab, alvoX:j.x, alvoY:j.y,
                 ang:Math.atan2(j.y-e.y, j.x-e.x), dur };
  e.windup = dur;
}

function resolverHab(e, dano){
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
          r: 52, t: 5.5, dano: Math.round(dano*0.35), tick: 0.35,   // (IA.3)
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
    case 'investida': {    // carga em linha (boss a 640 px/s; monstros comuns a 520)
      const v = e.classe==='boss' ? 640 : 520;
      e.investe = { t:0.55, vx:Math.cos(h.ang)*v, vy:Math.sin(h.ang)*v, feriu:false,
                    dano: Math.round(dano*1.5) };   // dano já com a fraqueza do Terror (IA.7)
      break;
    }
    case 'rajada': {       // leque de 3 projéteis (esquivável entre eles)
      for(let i=-1;i<=1;i++)
        tiroInimigo(e, h.ang + i*0.22, Math.round(dano*0.8), BAL.combate.velProjInimigo*1.05);
      break;
    }
    case 'poca': {         // cospe uma poça venenosa onde o Watcher estava
      C.pocas.push({
        x: clamp(h.alvoX, 30, C.W-30),
        y: clamp(h.alvoY, C.chaoTopo, C.chaoFundo),
        r: 44, t: 4, dano: Math.round(dano*0.3), tick: 0.35,   // tolerância: a poça avisa antes de morder (IA.3)
      });
      break;
    }
    case 'tremor': {       // pancada no chão: anel de choque à volta de si
      C.aneisBoss.push({ x:e.x, y:e.y, r:105, t:0.7, dano:Math.round(dano*1.1), feito:false });
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
      // teleporta para flanquear o Watcher
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

function ferirJogador(bruto, atacante){
  const j=C.jogador;
  const dm = (typeof passivaClasse==='function') ? passivaClasse().danoMult : 1;
  let dano = Math.max(1, Math.round(bruto*dm - defAtual()*0.6));
  // Baluarte de Ferro: -60% dano sofrido e reflete 30% (corpo-a-corpo)
  if(C.ult.t>0 && G.classe==='guerreiro'){
    const cfg = BAL.ultimates.guerreiro;
    dano = Math.max(1, Math.round(dano * (1-cfg.reducaoDano)));
    if(atacante && atacante.hp>0){
      ferirInimigo(atacante, Math.max(1, Math.round(bruto*cfg.reflete)), false, '#c0664a');
    }
  }
  // Escudo Rúnico absorve primeiro
  if(C.escudo>0){
    const abs = Math.min(C.escudo, dano);
    C.escudo -= abs; dano -= abs;
    numero(j.x, j.y-66, '🛡'+abs, '#b8a8e0', 13);
    // Muralha Viva: com escudo ativo, reflete 15% do dano bruto
    if(arvKeystone('g_ks_esc') && atacante && atacante.hp>0){
      ferirInimigo(atacante, Math.max(1, Math.round(bruto*0.15)), false, '#c9a55a');
    }
    if(C.escudo<=0){
      toast('O escudo quebrou!');
      // Aegis: o escudo quebra numa explosão sagrada
      if(arvKeystone('p_ks_ben')){
        for(const e of [...C.inimigos]){
          if(Math.hypot(e.x-j.x, e.y-j.y) <= 160 + e.raio){
            ferirInimigo(e, Math.max(1, Math.round(atqAtual()*1.2)), false, '#f0d272');
          }
        }
        C.anelSkill = { x:j.x, y:j.y, t:0.5, cor:'#f0d272' };
      }
    }
    if(dano<=0){ C.shake=Math.max(C.shake,3); return; }
  }
  j.hp -= dano;
  j.hurt = BAL.anim.heroi.dano;
  AUDIO.sfx('dano');
  numero(j.x, j.y-60, dano, '#d05c4e', 16);
  C.shake = Math.max(C.shake, 6);
  C.danoFlash = 0.3;
  if(j.hp<=0){ j.hp=0; j.morteInicio=C.tempo; terminarCombate(false); }
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
    if(SPR.ok(ARTE_CENARIO.pocaVenenosa)){
      ctx.save(); ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r,p.r*0.45,0,0,Math.PI*2); ctx.clip();
      ctx.globalCompositeOperation='screen'; ctx.globalAlpha=0.68;
      ctx.drawImage(SPR.reg[ARTE_CENARIO.pocaVenenosa].img,p.x-p.r,p.y-p.r*0.52,p.r*2,p.r*1.04);
      ctx.restore();
    } else {
      ctx.fillStyle='rgba(110,160,40,0.40)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r*0.45, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='rgba(160,210,60,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r*(0.62+borb), p.r*0.30, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(160,210,60,0.6)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r*0.45, 0, 0, Math.PI*2); ctx.stroke();
  }

  // telégrafos das habilidades dos monstros
  for(const e of C.inimigos){
    if(!e.habAtiva || e.windup<=0) continue;
    const h = e.habAtiva, prog = 1 - e.windup/(h.dur||1);
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
    } else if(h.tipo==='poca'){
      // marca a zona alvo no chão antes de a poça nascer (IA.3)
      const tx = clamp(h.alvoX, 30, C.W-30), ty = clamp(h.alvoY, C.chaoTopo, C.chaoFundo);
      ctx.strokeStyle='rgba(160,210,60,0.8)'; ctx.fillStyle=`rgba(110,160,40,${0.10+0.20*prog})`;
      ctx.beginPath(); ctx.ellipse(tx, ty, 44, 44*0.45, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    } else if(h.tipo==='tremor'){
      // anel de choque à volta do monstro (IA.3)
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 105, 105*0.5, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
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
    if(tr.spr && SPR.ok(tr.spr)){
      // sprite do projétil em voo (aponta para +x na prancha): roda para a direção
      const A=BAL.anim.projetil, nf=SPR.n(tr.spr);
      ctx.save(); ctx.globalCompositeOperation='source-over';
      ctx.translate(tr.x,tr.y); ctx.rotate(Math.atan2(tr.vy,tr.vx));
      SPR.frameH(ctx, tr.spr, Math.floor((C.tempo-(tr.nasceu||0))*A.fps), nf, A.altInimigo, false, tr.tint, 0.5);
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(tr.x,tr.y,1, tr.x,tr.y,12);
      g.addColorStop(0,'rgba(255,255,255,0.85)'); g.addColorStop(0.35,tr.cor); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(tr.x,tr.y,12,0,Math.PI*2); ctx.fill();
    }
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
    ...(C.caidos||[]).map(e=>({y:e.y, draw:()=>desenharInimigo(e)})),
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
    } else if(p.spr && SPR.ok(p.spr)){
      // tiro básico do Mago: sprite verdadeiro da prancha em vez do círculo
      const A=BAL.anim.projetil;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.vy||0,p.vx||0));
      SPR.frameH(ctx, p.spr, Math.floor((C.tempo-(p.nasceu||0))*A.fps), SPR.n(p.spr), A.altHeroi, false, null, 0.5);
      ctx.restore();
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
let cenarioPedido = false;

function hashCenario(txt){
  let h=2166136261;
  for(let i=0;i<txt.length;i++){ h^=txt.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function seedSala(camada, col=0, lin=0, extra=0){
  const m=C.masmorra;
  return hashCenario(`${m.rank}|${m.nome}|${C.sala}|${C.seedCenario||0}|${m.despertar?1:0}|${camada}|${col}|${lin}|${extra}`);
}
function rndSala(camada, col=0, lin=0, extra=0){ return seedSala(camada,col,lin,extra)/4294967296; }

// Se o primeiro combate arrancar antes das imagens, o fallback aparece só
// temporariamente: assim que a textura relevante termina, o cache é refeito.
if(typeof SPR!=='undefined' && SPR.aoCarregar){
  SPR.aoCarregar((nome, sucesso)=>{
    if(!sucesso || !C || !C.masmorra) return;
    const tx = C.masmorra.tex || {};
    const relevantes = [tx.parede, tx.chao, 'hig_parede', 'hig_chao_pedra',
      'hig_chao_madeira', 'hig_barril', 'dungeon_tileset', ARTE_CENARIO.varianteParede,
      ARTE_CENARIO.varianteChao];
    if(['D','B'].includes(C.masmorra.rank)) relevantes.push(ARTE_CENARIO.grelha);
    if(C.masmorra.despertar) relevantes.push(ARTE_CENARIO.portalProvacao);
    if(relevantes.includes(nome) && !cenarioPedido){
      cenarioPedido=true;
      requestAnimationFrame(()=>{ cenarioPedido=false; if(C) prerenderCenario(); });
    }
  });
}

function prerenderCenario(){
  if(!C) return;
  const {W,H} = C;
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  cenarioCache = document.createElement('canvas');
  cenarioCache.width = Math.ceil(W*dpr); cenarioCache.height = Math.ceil(H*dpr);
  const c = cenarioCache.getContext('2d');
  c.setTransform(dpr,0,0,dpr,0,0);
  const rng = (function(seed){ let s2=seed; return ()=>{ s2=(s2*9301+49297)%233280; return s2/233280; }; })(seedSala('fallback'));

  // ---- 1.º: textura própria do bioma/Hig; 2.º: tiles; por fim, vetorial. ----
  const tx = C.masmorra.tex || {};
  const temParede = (tx.parede && SPR.ok(tx.parede)) || SPR.ok('hig_parede');
  const temChao = (C.masmorra.piso==='madeira' && SPR.ok('hig_chao_madeira')) ||
                  (tx.chao && SPR.ok(tx.chao)) || SPR.ok('hig_chao_pedra');
  if(temParede && temChao){ prerenderCenarioHig(c); return; }
  if(SPR.ok('dungeon_tileset')){ prerenderDungeonTiles(c, rng); return; }

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
  // Rodapé simplificado também no fallback vetorial.
  const rb=18;
  c.fillStyle='#2a2118'; c.fillRect(0,C.chaoTopo-rb*0.55,W,rb);
  c.strokeStyle='rgba(225,205,170,0.12)'; c.lineWidth=1;
  for(let x=0;x<W;x+=54){ c.strokeRect(x,C.chaoTopo-rb*0.55,52,rb); }
  const oc=c.createLinearGradient(0,C.chaoTopo,0,C.chaoTopo+48);
  oc.addColorStop(0,'rgba(0,0,0,0.42)'); oc.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=oc; c.fillRect(0,C.chaoTopo,W,48);

  rematarCenario(c);
}

/* cenário das masmorras com TILES do Dungeon_Tileset (16px → 48px) */
function prerenderDungeonTiles(c, rng){
  const {W,H} = C, TS=16, TD=48, topo=C.chaoTopo;
  const FLOORS = [[7,1],[7,2],[7,3],[6,1],[6,2]];       // lajes lisas
  const WALLB  = [[2,2],[2,3],[1,2],[1,3],[3,2],[3,3]]; // corpo de parede
  const WTOP   = [0,2];                                 // remate de topo
  const WBASE  = [4,2];                                 // rodapé (parede→chão)
  c.fillStyle='#1a1018'; c.fillRect(0,0,W,H);
  for(let y=0; y<topo; y+=TD)
    for(let x=0; x<W; x+=TD){ const w=WALLB[Math.floor(rng()*WALLB.length)]; SPR.tile(c,'dungeon_tileset',w[0],w[1],TS,x,y,TD); }
  for(let x=0; x<W; x+=TD) SPR.tile(c,'dungeon_tileset',WTOP[0],WTOP[1],TS,x,0,TD);
  for(let x=0; x<W; x+=TD) SPR.tile(c,'dungeon_tileset',WBASE[0],WBASE[1],TS,x,topo-TD,TD);
  for(let y=Math.floor(topo); y<H; y+=TD)
    for(let x=0; x<W; x+=TD){ const f=FLOORS[Math.floor(rng()*FLOORS.length)]; SPR.tile(c,'dungeon_tileset',f[0],f[1],TS,x,y,TD); }
  const sg = c.createLinearGradient(0,topo-TD,0,topo+TD*1.4);
  sg.addColorStop(0,'rgba(0,0,0,0.45)'); sg.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=sg; c.fillRect(0,topo-TD,W,TD*2.4);
  rematarCenario(c);
}

const MOTIVOS_INTEIROS = new Set(['tex_07','tex_08','tex_09']);

function desenharTileVariado(c, nome, variante, dx,dy,tam, flipX,flipY,tom){
  const o=SPR.reg[nome], img=o.img;
  let sx=0,sy=0,sw=img.naturalWidth||o.w,sh=img.naturalHeight||o.h;
  const podeRecortar = !MOTIVOS_INTEIROS.has(nome) && /^tex_\d\d$/.test(nome);
  if(podeRecortar){
    const col=variante%3, lin=Math.floor(variante/3), iw=sw, ih=sh;
    sx=Math.floor(col*iw/3); sy=Math.floor(lin*ih/3);
    sw=Math.floor((col+1)*iw/3)-sx; sh=Math.floor((lin+1)*ih/3)-sy;
  }
  c.save(); c.imageSmoothingEnabled=false;
  c.translate(dx+tam/2,dy+tam/2); c.scale(flipX?-1:1,flipY?-1:1);
  c.drawImage(img,sx,sy,sw,sh,-tam/2,-tam/2,tam+1,tam+1);
  c.restore();
  if(Math.abs(tom)>0.003){
    c.save(); c.beginPath(); c.rect(dx,dy,tam+1,tam+1); c.clip();
    c.globalCompositeOperation=tom>0?'screen':'multiply';
    c.fillStyle=tom>0?`rgba(255,245,225,${Math.abs(tom)})`:`rgba(20,12,8,${Math.abs(tom)})`;
    c.fillRect(dx,dy,tam+1,tam+1); c.restore();
  }
}

function preencherTextura(c, nomeBase, nomeAlt, x0,y0,w,h,tam,camada, flipVertical=false){
  const cols=Math.ceil(w/tam), lins=Math.ceil(h/tam);
  const nomeSala=nomeAlt && rndSala(camada+'-pool')<ARTE_CENARIO.pesoVariante ? nomeAlt : nomeBase;
  for(let lin=0;lin<lins;lin++) for(let col=0;col<cols;col++){
    const variante=Math.floor(rndSala(camada,col,lin,2)*9);
    const fx=rndSala(camada,col,lin,3)<0.5;
    const fy=flipVertical && rndSala(camada,col,lin,4)<0.5;
    const tom=(rndSala(camada,col,lin,5)-0.5)*0.08; // ±4%
    desenharTileVariado(c,nomeSala,variante,x0+col*tam,y0+lin*tam,tam,fx,fy,tom);
  }
}

function desenharTransicaoParedeChao(c,tam,nomeParede){
  const {W}=C, topo=Math.round(C.chaoTopo), banda=clamp(Math.round(tam*0.24),12,34);
  const img=SPR.reg[nomeParede].img, sw=img.naturalWidth||SPR.reg[nomeParede].w;
  const sh=img.naturalHeight||SPR.reg[nomeParede].h, bloco=Math.round(tam*0.72);
  c.fillStyle='rgba(16,11,8,0.78)'; c.fillRect(0,topo-banda*0.55,W,banda*1.1);
  for(let i=0,x=-bloco/3;x<W;i++,x+=bloco){
    const col=Math.floor(rndSala('rodape',i,0)*3), ehTex=/^tex_\d\d$/.test(nomeParede);
    const sx=ehTex?Math.floor(col*sw/3):0, sy=ehTex?Math.floor(2*sh/3):Math.floor(sh*0.72);
    const cw=ehTex?Math.floor((col+1)*sw/3)-sx:sw, ch=ehTex?sh-sy:sh-sy;
    c.save(); c.imageSmoothingEnabled=false;
    if(rndSala('rodape',i,1)<0.5){ c.translate(x+bloco,0); c.scale(-1,1); c.translate(-x,0); }
    c.drawImage(img,sx,sy,cw,ch,x,topo-banda*0.55,bloco+1,banda);
    c.restore();
  }
  c.fillStyle='rgba(15,10,7,0.24)'; c.fillRect(0,topo-banda*0.55,W,banda);
  c.fillStyle='rgba(255,235,190,0.10)'; c.fillRect(0,topo-banda*0.55,W,1);
  c.fillStyle='rgba(0,0,0,0.52)'; c.fillRect(0,topo+banda*0.45,W,2);
  const sombra=c.createLinearGradient(0,topo+banda*0.35,0,topo+tam*0.38);
  sombra.addColorStop(0,'rgba(0,0,0,0.48)'); sombra.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=sombra; c.fillRect(0,topo+banda*0.30,W,tam*0.42);

  const qtd=Math.max(7,Math.round(W/tam*1.2));
  for(let i=0;i<qtd;i++){
    const x=rndSala('entulho',i,0)*W, y=topo+banda*0.35+rndSala('entulho',i,1)*tam*0.20;
    const rx=2+rndSala('entulho',i,2)*7, ry=1.5+rndSala('entulho',i,3)*3;
    c.fillStyle=rndSala('entulho',i,4)<0.22?'rgba(205,195,170,0.48)':'rgba(35,25,18,0.72)';
    c.beginPath(); c.ellipse(x,y,rx,ry,rndSala('entulho',i,5)*Math.PI,0,Math.PI*2); c.fill();
  }
}

function desenharMotivosCenario(c,tam){
  const {W}=C, topo=Math.round(C.chaoTopo), rank=C.masmorra.rank;
  if(['D','B'].includes(rank) && SPR.ok(ARTE_CENARIO.grelha)){
    const qtd=rank==='B'?2:1;
    for(let i=0;i<qtd;i++){
      const s=tam*(0.72+rndSala('grelha',i,0)*0.22);
      const x=W*(0.12+(i+1)/(qtd+1)*0.70), y=Math.max(20,topo-s*1.22);
      c.fillStyle='rgba(0,0,0,0.55)'; c.fillRect(x-s/2-4,y-4,s+8,s+8);
      c.drawImage(SPR.reg[ARTE_CENARIO.grelha].img,x-s/2,y,s,s);
      c.strokeStyle='rgba(20,12,8,0.75)'; c.lineWidth=3; c.strokeRect(x-s/2,y,s,s);
    }
  }
  if(C.masmorra.despertar && SPR.ok(ARTE_CENARIO.portalProvacao)){
    const img=SPR.reg[ARTE_CENARIO.portalProvacao].img, w=clamp(W*0.42,160,360), h=w*0.42;
    const x=W/2, y=topo+tam*1.25;
    c.save(); c.beginPath(); c.ellipse(x,y,w/2,h/2,0,0,Math.PI*2); c.clip();
    c.globalCompositeOperation='screen'; c.globalAlpha=0.78;
    c.drawImage(img,x-w/2,y-h/2,w,h); c.restore();
  }
}

/* Cenário pintado v2: cerca de oito tiles por largura, nove recortes por
   textura, variação determinística por sala e uma junção física parede/chão. */
function prerenderCenarioHig(c){
  const {W,H}=C, topo=Math.round(C.chaoTopo), tx=C.masmorra.tex||{};
  c.imageSmoothingEnabled=false;
  const paredeNome=(tx.parede&&SPR.ok(tx.parede))?tx.parede:'hig_parede';
  const chaoNome=(C.masmorra.piso==='madeira'&&SPR.ok('hig_chao_madeira'))?'hig_chao_madeira'
    :(tx.chao&&SPR.ok(tx.chao))?tx.chao:'hig_chao_pedra';
  const altParede=SPR.ok(ARTE_CENARIO.varianteParede)?ARTE_CENARIO.varianteParede:null;
  const altChao=SPR.ok(ARTE_CENARIO.varianteChao)?ARTE_CENARIO.varianteChao:null;
  const tam=clamp(Math.round(W/8),48,192);
  c.fillStyle='#17120f'; c.fillRect(0,0,W,H);
  preencherTextura(c,paredeNome,altParede,0,0,W,topo,tam,'parede',false);
  preencherTextura(c,chaoNome,altChao,0,topo,W,H-topo,tam,'chao',true);
  desenharTransicaoParedeChao(c,tam,paredeNome);
  desenharMotivosCenario(c,tam);

  if(SPR.ok('hig_barril')){
    const b=SPR.reg.hig_barril, nB=1+Math.floor(rndSala('barris-count')*2);
    const zonas=[[0.06,0.20],[0.42,0.56],[0.78,0.88]], z0=Math.floor(rndSala('barris-zona')*3);
    for(let i=0;i<nB;i++){
      const z=zonas[(z0+i)%3], r0=rndSala('barris',i,0), r1=rndSala('barris',i,1);
      const alt=46+r0*18, lB=alt*b.w/b.h;
      const bx=W*(z[0]+r1*(z[1]-z[0])), by=topo+28+rndSala('barris',i,2)*24;
      c.fillStyle='rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(bx,by+2,lB*0.52,lB*0.18,0,0,Math.PI*2); c.fill();
      c.drawImage(b.img,bx-lB/2,by-alt+4,lB,alt);
    }
  }
  rematarCenario(c);
}

/* remate comum dos cenários: estandartes do rank, tinta do rank, sombra do topo */
function rematarCenario(c){
  const {W,H} = C;
  for(const bx of [W*0.22, W*0.78]){
    c.fillStyle='#2a1d10'; c.fillRect(bx-20, 8, 40, 5);
    c.fillStyle = C.masmorra.cor; c.globalAlpha = 0.6;
    c.beginPath(); c.moveTo(bx-16,13); c.lineTo(bx+16,13); c.lineTo(bx+16,86); c.lineTo(bx,72); c.lineTo(bx-16,86); c.closePath(); c.fill();
    c.globalAlpha=1;
    c.fillStyle='rgba(0,0,0,0.3)'; c.beginPath(); c.moveTo(bx+6,13); c.lineTo(bx+16,13); c.lineTo(bx+16,86); c.lineTo(bx+6,76); c.closePath(); c.fill();
    c.fillStyle='rgba(232,220,195,0.9)'; c.font='bold 17px Georgia,serif'; c.textAlign='center'; c.fillText(C.masmorra.rank, bx, 48);
  }
  c.fillStyle = C.masmorra.cor; c.globalAlpha = 0.05; c.fillRect(0,0,W,H); c.globalAlpha = 1;
  const tg = c.createLinearGradient(0,0,0,70);
  tg.addColorStop(0,'rgba(0,0,0,0.5)'); tg.addColorStop(1,'transparent');
  c.fillStyle=tg; c.fillRect(0,0,W,70);
}

/* desenho do cenário por frame: cache + tochas vivas + luz */
function desenharCenario(){
  const {W,H}=C, t=C.tempo;
  if(cenarioCache) ctx.drawImage(cenarioCache, 0, 0, W, H);

  // tinte ambiente do bioma (D017): dá identidade a cada rank sem arte nova
  if(C.masmorra.luz){
    ctx.save();
    ctx.globalCompositeOperation='soft-light';
    ctx.globalAlpha=0.18;                // identidade sem esmagar o detalhe da textura
    ctx.fillStyle=C.masmorra.luz;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  const tochaHig = SPR.ok('hig_tocha'), tochaSprite = SPR.ok('torch_1');
  for(let i=0;i<2;i++){
    const tx = W*(0.32+i*0.36), ty = C.chaoTopo-92;
    const fl = 0.7+Math.sin(t*9+i*2.4)*0.3;
    if(tochaHig){
      // tocha pintada (pack Hig), espelhada à direita; o pulso é subtil — a vida vem da luz e das faúlhas
      const o = SPR.reg.hig_tocha, alt = 92*(1+0.025*Math.sin(t*9+i*2.4)), lT = alt*o.w/o.h;
      ctx.save(); ctx.translate(tx, ty);
      if(i===1) ctx.scale(-1,1);
      ctx.drawImage(o.img, -lT/2, -alt*0.35, lT, alt);
      ctx.restore();
    } else if(tochaSprite){
      // tocha pixel animada (4 frames)
      const fr = 1 + (Math.floor(t*10+i*2)%4);
      ctx.save(); ctx.translate(tx, ty+6); ctx.imageSmoothingEnabled=false;
      SPR.imagem(ctx, 'torch_'+fr, 56, false, 0.5);
      ctx.restore();
    } else {
      // chama vetorial (fallback)
      ctx.fillStyle=`rgba(200,70,30,${0.85*fl})`;
      ctx.beginPath(); ctx.ellipse(tx, ty-7, 6, 11+fl*3, Math.sin(t*11+i)*0.15, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(226,118,45,${0.9*fl})`;
      ctx.beginPath(); ctx.ellipse(tx, ty-6, 4.5, 8+fl*2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(240,200,110,${0.9*fl})`;
      ctx.beginPath(); ctx.ellipse(tx, ty-4, 2.2, 4.5, 0, 0, Math.PI*2); ctx.fill();
    }
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

/* cor de tinta do sprite conforme a classe escolhida (ou null) */
function corClasse(){
  if(typeof CLASSES!=='undefined' && G && G.classe && CLASSES[G.classe]) return CLASSES[G.classe].tinta || null;
  return null;
}
/* sprite (vetorial) -> base de animação 2D pixel + tamanho/tinta
   kind: novo (pack do dono, base 92%) · big/pix (sheets antigos, fallback) */
const MODELO2D = {
  goblin:    { base:'en_goblin',    kind:'novo', esc:0.85 },
  lobo:      { base:'en_stalker',   kind:'novo', cor:'#9aa4b0', esc:0.85 },
  formiga:   { base:'en_venom',     kind:'novo', cor:'#c87a3a', esc:0.85 },
  aranha:    { base:'en_plague',    kind:'novo', cor:'#6a5a8a', esc:0.90 },
  esqueleto: { base:'en_bone',      kind:'novo', esc:1.0  },
  espectro:  { base:'en_stalker',   kind:'novo', esc:0.95, alpha:0.75 },
  orc:       { base:'en_orcbrute',  kind:'novo', esc:1.10 },
  orcmago:   { base:'en_warlock',   kind:'novo', esc:1.0  },
  draconiano:{ base:'en_templar',   kind:'novo', cor:'#3fa89a', esc:1.10 },
  golem:     { base:'en_templar',   kind:'novo', cor:'#9ecfe6', esc:1.20 },
  cavaleiro: { base:'en_corrupted', kind:'novo', esc:1.05 },
  sacerdote: { base:'en_necro',     kind:'novo', esc:1.0  },
};
/* fallback para os sheets antigos quando os novos não carregam */
const MODELO2D_ANTIGO = {
  goblin:    { base:'orc',             kind:'big', cor:'#8fbf5a', esc:0.82 },
  lobo:      { base:'orc',             kind:'big', cor:'#9aa4b0', esc:0.80 },
  formiga:   { base:'enemy_skeleton1', kind:'pix', cor:'#c87a3a', esc:1.0  },
  aranha:    { base:'enemy_vampire',   kind:'pix', cor:'#6a5a8a', esc:0.95 },
  esqueleto: { base:'enemy_skeleton1', kind:'pix', cor:null,      esc:1.05 },
  espectro:  { base:'enemy_vampire',   kind:'pix', cor:'#aecdf0', esc:1.0, alpha:0.7 },
  orc:       { base:'orc',             kind:'big', cor:null,      esc:1.08 },
  orcmago:   { base:'orc',             kind:'big', cor:'#9a6fd0', esc:0.92 },
  draconiano:{ base:'orc',             kind:'big', cor:'#3fa89a', esc:1.12 },
  golem:     { base:'enemy_skeleton2', kind:'pix', cor:'#9ecfe6', esc:1.25 },
  cavaleiro: { base:'soldier',         kind:'big', cor:'#5a4a78', esc:1.06 },
  sacerdote: { base:'enemy_vampire',   kind:'pix', cor:'#c0504e', esc:1.0  },
};
function modelo2dDe(sprite){
  const m = MODELO2D[sprite] || MODELO2D.goblin;
  if(SPR.ok(m.base+'_idle')) return m;
  return MODELO2D_ANTIGO[sprite] || MODELO2D_ANTIGO.goblin;
}
/* resolve o nome do sheet para o estado pedido (pix usa take_damage como hurt) */
function anim2d(m, estado){
  if(estado==='hurt' && m.kind==='pix') return m.base+'_take_damage';
  return m.base+'_'+estado;
}

function desenharJogador(){
  const j=C.jogador, s=escalaProf(j.y);
  sombraChao(j.x, j.y, 16*s);

  // aura de fúria (brilho aditivo)
  if(C.buffFuria>0){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const g = ctx.createRadialGradient(j.x,j.y-26*s,4, j.x,j.y-26*s,46*s);
    g.addColorStop(0,'rgba(216,130,40,0.30)'); g.addColorStop(1,'rgba(216,130,40,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(j.x,j.y-26*s,46*s,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  const bh = baseHeroi();          // sprite da classe/skin vestida, ou 'soldier' antigo
  if(SPR.ok(bh+'_idle')){
    const novo = bh !== 'soldier';
    let estado, nome, idx;
    if(j.hp<=0 && j.morteInicio!==null) estado='death';
    else if(j.hurt>0) estado='hurt';
    else if(j.skill>0) estado='skill';
    else if(j.atacando>0) estado='attack';
    else if(j.andando || j.alvoX!==null) estado='walk';
    else estado='idle';
    nome=bh+'_'+estado;
    if(!SPR.ok(nome)){
      estado = estado==='skill' && SPR.ok(bh+'_attack') ? 'attack' : 'idle';
      nome=bh+'_'+estado;
    }
    const nf=SPR.n(nome), A=BAL.anim.heroi;
    if(estado==='death')     idx=Math.floor(clamp((C.tempo-j.morteInicio)/A.morte,0,0.999)*nf);
    else if(estado==='hurt') idx=Math.floor(clamp(1-j.hurt/A.dano,0,0.999)*nf);
    else if(estado==='skill') idx=Math.floor(clamp(1-j.skill/(j.skillDur||A.skill),0,0.999)*nf);
    else if(estado==='attack') idx=Math.floor((1-(j.atacando/A.ataque))*nf);
    else                    idx=Math.floor(C.tempo*(estado==='walk'?A.walkFps:A.idleFps));
    ctx.save(); ctx.translate(j.x, j.y);
    if(j.invul>0 && Math.floor(C.tempo*20)%2) ctx.globalAlpha=0.45;
    // sheets novos: já coloridos (sem tinta), corpo até 92% da altura do frame
    const altHeroi = novo ? ALTURAS_SPRITE.basePx*ALTURAS_SPRITE.heroi : 210;
    SPR.frameH(ctx, nome, idx, SPR.n(nome), altHeroi*s, (j.dirAtq||1)<0, null,
               novo?ALTURAS_SPRITE.ancoraY:0.74);
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(j.x,j.y); ctx.scale(s*1.5, s*1.5);
    spriteHeroi(ctx, {
      dir: j.dirAtq||1,
      passo: (j.andando || j.alvoX!==null) ? Math.sin(C.tempo*16)*3 : 0,
      golpe: j.atacando>0 ? (BAL.anim.heroi.ataque-j.atacando)/BAL.anim.heroi.ataque : null,
      invul: j.invul>0, t: C.tempo,
    });
    ctx.restore();
  }

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
  ctx.drawImage(cv, a.x-60*s, a.y-97*s, 120*s, 105*s);
  // brasas violetas a soltar-se
  if(Math.random()<0.1){
    ctx.globalAlpha=0.5;
    ctx.fillStyle='#b89ae8';
    ctx.beginPath(); ctx.arc(a.x+rnd(-10,10)*s, a.y-rnd(10,40)*s, 1.6, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function desenharInimigo(e){
  const papel = e.classe==='boss' ? 'boss' : e.classe==='elite' ? 'elite' : 'inimigo';
  const fatorPapel = ALTURAS_SPRITE[papel];
  const prof = escalaProf(e.y);
  // Mantém o sistema vetorial/aura compatível; a arte v2 usa a altura direta abaixo.
  const s=prof*0.85*(fatorPapel/ALTURAS_SPRITE.inimigo);
  sombraChao(e.x,e.y,e.raio*s*1.1);
  ctx.save(); ctx.translate(e.x,e.y);

  // vira-se para o Watcher (os desenhos olham para a esquerda)
  const dir = C.jogador.x <= e.x ? 1 : -1;

  // elite/boss: aura subtil do rank por baixo
  if(!e.morto && e.classe!=='normal'){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const g = ctx.createRadialGradient(0,-14*s,2, 0,-14*s,30*s);
    g.addColorStop(0, C.masmorra.cor+'44'); g.addColorStop(1, C.masmorra.cor+'00');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(0,-14*s,30*s,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  const m2 = modelo2dDe(e.sprite);
  if(SPR.ok(m2.base+'_idle')){
    let est, idx, nome;
    if(e.morto) est='death';
    else if(e.flash>0) est='hurt';
    else if(e.habAtiva && e.windup>0) est='skill';
    else if(e.windup>0) est='attack';
    else { const mov = (Math.abs(e.x-(e._dpx??e.x))+Math.abs(e.y-(e._dpy??e.y)))>0.4; est = mov?'walk':'idle'; }
    e._dpx=e.x; e._dpy=e.y;
    nome = anim2d(m2, est);
    if(!SPR.ok(nome)){
      est = est==='skill' && SPR.ok(anim2d(m2,'attack')) ? 'attack' : 'idle';
      nome=anim2d(m2, est);
    }
    const nf = SPR.n(nome), A = BAL.anim.inimigo;
    if(est==='death')     idx = Math.floor(clamp((C.tempo-e.morteInicio)/A.morte,0,0.999)*nf);
    else if(est==='skill') idx = Math.floor(clamp(1-e.windup/(e.habAtiva?.dur||1),0,0.999)*nf);
    else if(est==='attack') idx = Math.floor(clamp(1 - e.windup/(e.ranged?A.disparo:A.golpe),0,1)*nf);
    else if(est==='hurt') idx = Math.floor(clamp(1 - e.flash/A.dano,0,1)*nf);
    else                  idx = Math.floor(C.tempo*(est==='walk'?A.walkFps:A.idleFps) + e.x*0.05);
    const alt = (m2.kind==='novo' ? ALTURAS_SPRITE.basePx*fatorPapel*prof
                                  : (m2.kind==='big'?200:112)*s) * (m2.esc||1);
    ctx.save();
    if(!e.morto && e.windup>0) ctx.translate(rnd(-1.6,1.6), rnd(-1.6,1.6));
    if(e.flash>0){ const q=BAL.feel.squash*(e.flash/BAL.anim.inimigo.dano); ctx.scale(1+q, 1-q); }  // squash & stretch
    if(m2.alpha) ctx.globalAlpha=m2.alpha;
    if(e.flash>0) ctx.filter='brightness(2.4)';
    else if(e.congelado>0) ctx.filter='saturate(0.4) brightness(1.35) hue-rotate(150deg)';
    SPR.frameH(ctx, nome, idx, nf, alt, C.jogador.x < e.x, e.furia ? '#d05c4e' : m2.cor,
               m2.kind==='novo'?ALTURAS_SPRITE.ancoraY:m2.kind==='big'?0.74:0.86);
    ctx.filter='none'; ctx.globalAlpha=1;
    ctx.restore();
  } else {
    ctx.save();
    if(e.morto){
      const f=clamp((C.tempo-e.morteInicio)/BAL.anim.inimigo.morte,0,1);
      ctx.globalAlpha=1-f; ctx.rotate(f*0.8*dir);
    }
    if(e.windup>0) ctx.translate(rnd(-1.6,1.6), rnd(-1.6,1.6));   // tremor de telégrafo
    ctx.scale(dir*s*1.5, s*1.5);
    if(e.flash>0){ const q=BAL.feel.squash*(e.flash/BAL.anim.inimigo.dano); ctx.scale(1+q, 1-q); }  // squash & stretch
    if(e.flash>0) ctx.filter='brightness(2.4)';
    else if(e.congelado>0) ctx.filter='saturate(0.4) brightness(1.35) hue-rotate(150deg)';
    if(e.windup>0){ ctx.shadowColor='#c04438'; ctx.shadowBlur=16; }
    else if(e.furia){ ctx.shadowColor='#d05c4e'; ctx.shadowBlur=10; }
    ctx.lineJoin='round'; ctx.lineCap='round';
    ARTE.monstro(ctx, e.sprite, e.adornos);
    ctx.filter='none'; ctx.shadowBlur=0;
    ctx.restore();
  }

  if(e.morto){ ctx.restore(); return; }

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
    // só a campanha conta clears — a diária e a Provação não consomem o 1.º clear narrativo (P2.2)
    if(!m.diaria && !m.despertar) G.clears[m.rank] = (G.clears[m.rank]||0)+1;
    resultado.primeiroClear = !m.diaria && !m.despertar && G.clears[m.rank]===1;  // fala do Aldric (D008)
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

  setTimeout(()=>{
    cancelAnimationFrame(rafId);
    C = null;
    fimCombateUI(resultado);
  }, fuga?50:650);
}
