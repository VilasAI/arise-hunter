/* ============ PODERES DO VIGIA ============
   11 poderes (ativos e passivos), 5 tiers cada (BAL.tiersPoder)
   e 2 talentos de escolha por poder (a partir do tier 3).      */
'use strict';

/* mod dos talentos: efeito → multiplica a força do poder · cd → multiplica o cooldown */
const PODERES = {
  sombras: {
    nome:'Exército de Sombras', icone:'p_sombras', cor:'#8a6fc8', tipo:'passivo',
    desc:'As tuas sombras lutam contigo. Cada tier torna-as mais fortes.',
    base:{ bonus:0.25 },  // +25% stats das sombras × efeito do tier
    talentos:[
      { nome:'Legião',   desc:'+1 sombra ativa',            mod:{sombrasExtra:1} },
      { nome:'Voracidade', desc:'Sombras +35% mais fortes',  mod:{efeito:1.35} },
    ],
  },
  lamina: {
    nome:'Lâmina Fantasma', icone:'p_lamina', cor:'#8a6fc8', tipo:'ativo', cd:2.5, mp:8,
    desc:'Dispara uma lâmina espectral contra o inimigo mais próximo.',
    base:{ dano:1.5 },
    talentos:[
      { nome:'Lâmina Dupla', desc:'Dispara 2 lâminas',       mod:{projeteis:2} },
      { nome:'Gume Afiado',  desc:'+30% dano',               mod:{efeito:1.3} },
    ],
  },
  investida: {
    nome:'Investida Espectral', icone:'p_investida', cor:'#b8a8e0', tipo:'ativo', cd:7, mp:15,
    desc:'Avanço veloz que atravessa e fere todos os inimigos no caminho.',
    base:{ dano:1.6 },
    talentos:[
      { nome:'Rastro Cortante', desc:'+30% dano',            mod:{efeito:1.3} },
      { nome:'Passo Leve',      desc:'-25% cooldown',        mod:{cd:0.75} },
    ],
  },
  terror: {
    nome:'Aura de Terror', icone:'p_terror', cor:'#6b5a8a', tipo:'passivo',
    desc:'Inimigos próximos ficam mais lentos e causam menos dano.',
    base:{ raio:140, lentidao:0.15, fraqueza:0.12 },
    talentos:[
      { nome:'Pavor',       desc:'Aura 40% maior',           mod:{raio:1.4} },
      { nome:'Desespero',   desc:'Enfraquece +50%',          mod:{efeito:1.5} },
    ],
  },
  sede: {
    nome:'Sede de Sangue', icone:'p_sede', cor:'#c04438', tipo:'passivo',
    desc:'Recuperas vida ao atacar e ao abater inimigos.',
    base:{ roubo:4, curaKill:0.03 },  // +4% roubo · cura 3% HP máx ao matar
    talentos:[
      { nome:'Hemorragia', desc:'+50% do efeito',            mod:{efeito:1.5} },
      { nome:'Festim',     desc:'Cura ao matar a dobrar',    mod:{kill:2} },
    ],
  },
  escudo: {
    nome:'Escudo Rúnico', icone:'p_escudo', cor:'#c9a55a', tipo:'ativo', cd:14, mp:25,
    desc:'Barreira de runas que absorve dano até quebrar.',
    base:{ absorve:0.30 },  // 30% do HP máx × efeito
    talentos:[
      { nome:'Muralha',  desc:'Escudo +40% maior',           mod:{efeito:1.4} },
      { nome:'Vigilante',desc:'-30% cooldown',               mod:{cd:0.7} },
    ],
  },
  corrente: {
    nome:'Corrente Relâmpago', icone:'p_corrente', cor:'#e8c84a', tipo:'ativo', cd:8, mp:20,
    desc:'Um raio que salta entre inimigos, perdendo força a cada salto.',
    base:{ dano:1.2, saltos:3, decai:0.75 },
    talentos:[
      { nome:'Tempestade', desc:'+2 saltos',                 mod:{saltosExtra:2} },
      { nome:'Alta Tensão',desc:'+30% dano',                 mod:{efeito:1.3} },
    ],
  },
  brasas: {
    nome:'Explosão de Brasas', icone:'p_brasas', cor:'#e2762d', tipo:'ativo', cd:9, mp:22,
    desc:'Explosão ardente em área que deixa os inimigos a arder.',
    base:{ dano:1.3, raio:150, queima:0.30, dur:3 },  // queima 30% atq/s
    talentos:[
      { nome:'Incêndio',  desc:'Queimadura dura o dobro',    mod:{dur:2} },
      { nome:'Detonação', desc:'+30% dano direto',           mod:{efeito:1.3} },
    ],
  },
  gelo: {
    nome:'Manto de Gelo', icone:'p_gelo', cor:'#6db5d8', tipo:'ativo', cd:12, mp:20,
    desc:'Congela os inimigos próximos e endurece a tua defesa.',
    base:{ raio:160, congela:1.0, lentidao:0.5, dur:4, defBonus:0.3 },
    talentos:[
      { nome:'Inverno',     desc:'Congelamento +0,8 s',      mod:{congelaExtra:0.8} },
      { nome:'Pele de Gelo',desc:'Defesa bónus a dobrar',    mod:{def:2} },
    ],
  },
  furia: {
    nome:'Fúria do Caçador', icone:'p_furia', cor:'#d8973c', tipo:'ativo', cd:16, mp:25,
    desc:'Liberta o instinto: mais dano e velocidade por alguns segundos.',
    base:{ dano:0.30, vel:0.25, dur:5 },
    talentos:[
      { nome:'Frenesi',    desc:'Dura +3 s',                 mod:{durExtra:3} },
      { nome:'Predador',   desc:'+50% do bónus de dano',     mod:{efeito:1.5} },
    ],
  },
  passo: {
    nome:'Passo Sombrio', icone:'p_passo', cor:'#8a6fc8', tipo:'ativo', cd:6, mp:10,
    desc:'Teletransporte curto para trás do inimigo, com golpe surpresa.',
    base:{ dano:0.9, invul:0.3 },
    talentos:[
      { nome:'Emboscada', desc:'Golpe surpresa crítico garantido', mod:{critGarantido:1} },
      { nome:'Évasão',    desc:'-30% cooldown',              mod:{cd:0.7} },
    ],
  },
};

const ORDEM_PODERES = ['lamina','sombras','investida','sede','escudo','brasas','corrente','gelo','terror','furia','passo'];

/* ---------- estado / progressão ---------- */
function poderAprendido(id){ return G.poderes[id] || null; }
function poderTier(id){ const p = G.poderes[id]; return p ? p.tier : 0; }

function pontosHabTotais(){ return Math.floor(G.nivel / BAL.poderes.nivelPorPonto); }
function pontosHabDisponiveis(){ return pontosHabTotais() - G.pontosHabUsados; }

/* dados do talento escolhido (ou null) */
function talentoDe(id){
  const p = G.poderes[id];
  if(!p || p.talento===null || p.talento===undefined) return null;
  return PODERES[id].talentos[p.talento];
}

/* multiplicador de efeito do poder (tier × talento) */
function efeitoPoder(id){
  const tier = poderTier(id);
  if(!tier) return 0;
  let ef = BAL.tiersPoder[tier-1].efeito;
  const t = talentoDe(id);
  if(t && t.mod.efeito) ef *= t.mod.efeito;
  return ef;
}

/* cooldown final do poder (tier × talento × stat Vel. de Cooldown) */
function cooldownPoder(id, cdrPct){
  const def = PODERES[id];
  const tier = poderTier(id) || 1;
  let cd = (def.cd||0) * BAL.tiersPoder[tier-1].cd;
  const t = talentoDe(id);
  if(t && t.mod.cd) cd *= t.mod.cd;
  return cd * (1 - (cdrPct||0)/100);
}

/* custo de aprender (tier 1) ou evoluir para o tier seguinte */
function custoPoder(id){
  const alvo = poderTier(id) + 1;            // tier que se vai obter
  if(alvo > BAL.tiersPoder.length) return null;
  const t = BAL.tiersPoder[alvo-1];
  return {
    tier: alvo,
    pontos: Math.max(1, t.custoPts),
    ouro: BAL.poderes.custoOuroTier * alvo,
    cristais: BAL.poderes.custoCristaisTier * alvo,
    despertar: t.despertar,
  };
}

function podeEvoluirPoder(id){
  const c = custoPoder(id);
  if(!c) return {ok:false, msg:'Tier máximo atingido.'};
  if(G.despertar < c.despertar) return {ok:false, msg:`Exige Despertar ${c.despertar}.`};
  if(pontosHabDisponiveis() < c.pontos) return {ok:false, msg:'Pontos de habilidade insuficientes.'};
  if(G.ouro < c.ouro) return {ok:false, msg:'Ouro insuficiente.'};
  if(G.cristais < c.cristais) return {ok:false, msg:'Cristais insuficientes.'};
  return {ok:true, custo:c};
}

function evoluirPoder(id){
  const r = podeEvoluirPoder(id);
  if(!r.ok) return r;
  const c = r.custo;
  G.pontosHabUsados += c.pontos;
  G.ouro -= c.ouro;
  G.cristais -= c.cristais;
  if(G.poderes[id]) G.poderes[id].tier = c.tier;
  else G.poderes[id] = { tier:1, talento:null };
  G.contadores.poderes++;
  guardar();
  return {ok:true, tier:c.tier};
}

function escolherTalento(id, idx){
  const p = G.poderes[id];
  if(!p || p.tier < BAL.poderes.tierTalento) return false;
  p.talento = idx;
  guardar();
  return true;
}

/* equipar poder ativo num dos slots de combate */
function equiparPoder(id, slot){
  if(PODERES[id].tipo!=='ativo' || !poderAprendido(id)) return false;
  // remove de outros slots
  G.equipadosPoder = G.equipadosPoder.map(x=> x===id ? null : x);
  G.equipadosPoder[slot] = id;
  guardar();
  return true;
}

function poderesPassivosAtivos(){
  return ORDEM_PODERES.filter(id => PODERES[id].tipo==='passivo' && poderTier(id)>0);
}
