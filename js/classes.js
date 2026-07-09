/* ============ CLASSES DO WATCHER ============
   5 classes (inspiradas no Shakes & Fidgets). Cada uma tem stats
   iniciais, poderes EXCLUSIVOS e uma passiva. A passiva é lida em
   statsTotais (game.js) e no combate (combat.js).                 */
'use strict';

const CLASSES = {
  guerreiro: {
    nome:'Guerreiro', icone:'arma', cor:'#c0664a', tinta:'#9fb0c4',
    lema:'Muralha de aço. Resiste a tudo e parte ao meio.',
    estilo:'Tanque · corpo-a-corpo',
    basicas:{ for:2, vit:4, agi:0 },
    poderes:['investida','escudo','furia'], inicial:'investida',
    passiva:{ nome:'Pele de Ferro', desc:'+30% Defesa e sofre menos dano físico.',
              def:1.30, danoMult:0.86, ataque:'corpo' },
  },
  mago: {
    nome:'Mago', icone:'p_brasas', cor:'#8a6fc8', tinta:'#7c6ad0',
    lema:'O saber arcano dispensa a força bruta.',
    estilo:'Feiticeiro à distância · frágil',
    basicas:{ for:4, vit:1, agi:1 },
    poderes:['corrente','brasas','gelo'], inicial:'corrente',
    passiva:{ nome:'Sabedoria Arcana', desc:'Ignora 20 de armadura, +60% mana, mas -18% vida.',
              pen:20, mp:1.6, hp:0.82, ataque:'distancia' },
  },
  batedor: {
    nome:'Batedor', icone:'p_lamina', cor:'#5d9e4a', tinta:'#5fae5a',
    lema:'Atinge antes de seres visto. Foge antes de seres tocado.',
    estilo:'Caçador ágil · à distância',
    basicas:{ for:2, vit:1, agi:3 },
    poderes:['lamina','tiro','terror'], inicial:'lamina',
    passiva:{ nome:'Reflexos Felinos', desc:'+12% Crítico, esquiva mais rápida e mais movimento.',
              crit:12, dashMult:0.7, velMov:0.12, ataque:'distancia' },
  },
  assassino: {
    nome:'Assassino', icone:'p_passo', cor:'#6b4a8a', tinta:'#8a6fc8',
    lema:'Das sombras vem a morte certeira.',
    estilo:'Furtivo · crítico devastador',
    basicas:{ for:3, vit:1, agi:2 },
    poderes:['passo','sede','sombras'], inicial:'passo',
    passiva:{ nome:'Marca Mortal', desc:'+8% Crítico e +60% de Dano Crítico.',
              crit:8, critDano:60, ataque:'corpo' },
  },
  paladino: {
    nome:'Paladino', icone:'p_escudo', cor:'#d8b34a', tinta:'#e8cf7a',
    lema:'A luz protege os que protegem os outros.',
    estilo:'Híbrido · vida e proteção',
    basicas:{ for:2, vit:3, agi:1 },
    poderes:['luz','martelo','bencao'], inicial:'luz',
    passiva:{ nome:'Bênção Eterna', desc:'+25% vida, +10% Defesa e regenera vida em combate.',
              hp:1.25, def:1.10, regenHp:0.012, ataque:'corpo' },
  },
};
const ORDEM_CLASSES = ['guerreiro','mago','batedor','assassino','paladino'];

/* passiva (com valores neutros por omissão) da classe atual */
function passivaClasse(){
  const base = { def:1, danoMult:1, pen:0, mp:1, hp:1, crit:0, critDano:0, regenHp:0, dashMult:1, velMov:0, ataque:'corpo' };
  if(typeof G!=='undefined' && G && G.classe && CLASSES[G.classe]) return Object.assign(base, CLASSES[G.classe].passiva);
  return base;
}
/* a classe ataca à distância? (Mago / Batedor) */
function classeDistancia(){ return passivaClasse().ataque === 'distancia'; }

/* poderes que a classe atual pode aprender/ver (exclusivos) */
function poderesDaClasse(){
  if(typeof G!=='undefined' && G && G.classe && CLASSES[G.classe]) return CLASSES[G.classe].poderes;
  return ORDEM_PODERES;   // sem classe: mostra todos
}

/* aplica a classe ao jogador. Em jogo novo dá os stats e o kit iniciais;
   em saves já começados, só garante a classe e o poder inicial. */
function escolherClasse(id){
  const cl = CLASSES[id]; if(!cl) return false;
  G.classe = id;
  const novo = (G.nivel===1 && G.xp===0);
  if(novo){
    G.basicas = Object.assign({ for:0, vit:0, agi:0 }, cl.basicas||{});
    G.poderes = {}; G.poderes[cl.inicial] = { tier:1, talento:null };
    G.equipadosPoder = [ (PODERES[cl.inicial].tipo==='ativo' ? cl.inicial : null), null, null ];
    G.pontosHabUsados = 0;
  } else if(!poderAprendido(cl.inicial)){
    G.poderes[cl.inicial] = { tier:1, talento:null };
    if(PODERES[cl.inicial].tipo==='ativo' && !G.equipadosPoder.some(Boolean)) G.equipadosPoder[0] = cl.inicial;
  }
  guardar();
  return true;
}
