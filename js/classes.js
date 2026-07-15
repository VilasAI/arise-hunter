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
    ult:{ nome:'Baluarte de Ferro', icone:'p_escudo', cor:'#c0664a',
          desc:'8 s: sofres -60% de dano, refletes 30% e os teus golpes atordoam.' },
  },
  mago: {
    nome:'Mago', icone:'p_brasas', cor:'#8a6fc8', tinta:'#7c6ad0',
    lema:'O saber arcano dispensa a força bruta.',
    estilo:'Feiticeiro à distância · frágil',
    basicas:{ for:4, vit:1, agi:1 },
    poderes:['corrente','brasas','gelo'], inicial:'corrente',
    passiva:{ nome:'Sabedoria Arcana', desc:'Ignora 20 de armadura, +60% mana, mas -18% vida.',
              pen:20, mp:1.6, hp:0.82, ataque:'distancia' },
    ult:{ nome:'Tempestade Arcana', icone:'p_corrente', cor:'#8a6fc8',
          desc:'5 s de meteoros arcanos a cair por toda a arena.' },
  },
  batedor: {
    nome:'Batedor', icone:'p_lamina', cor:'#5d9e4a', tinta:'#5fae5a',
    lema:'Atinge antes de seres visto. Foge antes de seres tocado.',
    estilo:'Caçador ágil · à distância',
    basicas:{ for:2, vit:1, agi:3 },
    poderes:['lamina','tiro','terror'], inicial:'lamina',
    passiva:{ nome:'Reflexos Felinos', desc:'+12% Crítico, esquiva mais rápida e mais movimento.',
              crit:12, dashMult:0.7, velMov:0.12, ataque:'distancia' },
    ult:{ nome:'Tempo de Caça', icone:'p_lamina', cor:'#5d9e4a',
          desc:'6 s de disparo automático multi-alvo com críticos garantidos.' },
  },
  assassino: {
    nome:'Assassino', icone:'p_passo', cor:'#6b4a8a', tinta:'#8a6fc8',
    lema:'Das sombras vem a morte certeira.',
    estilo:'Furtivo · crítico devastador',
    basicas:{ for:3, vit:1, agi:2 },
    poderes:['passo','execucao','sede'], inicial:'passo',
    passiva:{ nome:'Marca Mortal', desc:'+8% Crítico e +60% de Dano Crítico.',
              crit:8, critDano:60, ataque:'corpo' },
    ult:{ nome:'Chamada das Sombras', icone:'sombra', cor:'#6b4a8a',
          desc:'10 s: a tua coleção inteira de sombras luta ao teu lado.' },
  },
  paladino: {
    nome:'Paladino', icone:'p_escudo', cor:'#d8b34a', tinta:'#e8cf7a',
    lema:'A luz protege os que protegem os outros.',
    estilo:'Híbrido · vida e proteção',
    basicas:{ for:2, vit:3, agi:1 },
    poderes:['luz','martelo','bencao'], inicial:'luz',
    passiva:{ nome:'Bênção Eterna', desc:'+25% vida, +10% Defesa e regenera vida em combate.',
              hp:1.25, def:1.10, regenHp:0.012, ataque:'corpo' },
    ult:{ nome:'Aurora', icone:'p_furia', cor:'#d8b34a',
          desc:'Explosão de luz: cura forte, purga, dano sagrado e cega os inimigos.' },
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

/* ultimate da classe atual (D011); desbloqueia no 1.º Despertar (D012) */
function ultimateClasse(){
  return (typeof G!=='undefined' && G && G.classe && CLASSES[G.classe]) ? CLASSES[G.classe].ult : null;
}
function temUltimate(){ return G.despertar >= 1 && !!ultimateClasse(); }

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
  } else {
    // save pré-classe já progredido: recebe os stats iniciais da classe,
    // e os poderes de outras classes saem e devolvem os pontos investidos
    for(const k of Object.keys(cl.basicas||{})) G.basicas[k] = (G.basicas[k]||0) + cl.basicas[k];
    for(const pid of Object.keys(G.poderes)){
      if(cl.poderes.includes(pid)) continue;
      G.pontosHabUsados = Math.max(0, G.pontosHabUsados - pontosInvestidos(G.poderes[pid].tier));
      delete G.poderes[pid];
    }
    G.equipadosPoder = G.equipadosPoder.map(p => (p && G.poderes[p]) ? p : null);
    if(!poderAprendido(cl.inicial)) G.poderes[cl.inicial] = { tier:1, talento:null };
    if(PODERES[cl.inicial].tipo==='ativo' && !G.equipadosPoder.some(Boolean)) G.equipadosPoder[0] = cl.inicial;
    // sombras fora do Assassino saem (D010). Os níveis já foram reembolsados
    // na migração D032 (schema 4), por isso aqui fica só o valor simbólico.
    if(id !== 'assassino' && G.sombras.length){
      G.cristais += G.sombras.length * 4;
      G.sombras = [];
      G._sombrasMigradas = true;
    }
  }
  guardar();
  return true;
}

/* Troca segura do perfil ?teste: repõe sempre um kit completo e equivalente. */
function trocarClasseTeste(id, persistir=true){
  if(!CLASSES[id] || (!MODO_TESTE && persistir)) return false;
  const cl = CLASSES[id];
  G.classe = id;
  G.basicas = { for:80, vit:80, agi:80 };
  G.poderes = {};
  for(const pid of cl.poderes) G.poderes[pid] = { tier:5, talento:0 };
  G.equipadosPoder = cl.poderes.filter(pid=>PODERES[pid].tipo==='ativo').slice(0,3);
  while(G.equipadosPoder.length<3) G.equipadosPoder.push(null);
  G.pontosHabUsados = 0;
  G.arvore = { nos:{}, respecs:0 };
  G.sombras = id==='assassino' ? Object.keys(SOMBRAS_BASE).map(rank=>({
    rank, nome:SOMBRAS_BASE[rank].nome, sprite:SOMBRAS_BASE[rank].sprite,
    nivel:10, ativa:true,
  })) : [];
  if(persistir) guardar();
  return true;
}
