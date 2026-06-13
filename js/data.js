/* ============ DADOS DO JOGO ============ */
'use strict';

const RARIDADES = [
  { id:'comum',    nome:'Comum',    cor:'#9aa3ad', mult:1.0, peso:100 },
  { id:'raro',     nome:'Raro',     cor:'#3b82f6', mult:1.6, peso:40  },
  { id:'epico',    nome:'Épico',    cor:'#a855f7', mult:2.4, peso:12  },
  { id:'lendario', nome:'Lendário', cor:'#f59e0b', mult:3.6, peso:3   },
  { id:'mitico',   nome:'Mítico',   cor:'#ef4444', mult:5.2, peso:0.6 },
];
const IDX_RARIDADE = Object.fromEntries(RARIDADES.map((r,i)=>[r.id,i]));

const TIPOS_ITEM = [
  { id:'arma',     nome:'Arma',     icone:'⚔️', statBase:'atq' },
  { id:'armadura', nome:'Armadura', icone:'🛡️', statBase:'def' },
  { id:'anel',     nome:'Anel',     icone:'💍', statBase:'pdr' }, // poder (atq+int)
];

const NOMES_ITEM = {
  arma:     ['Adaga do Vigia','Lâmina Sombria','Espada do Eco','Foice Lunar','Katana do Vazio','Lança Astral','Gládio Rúnico','Machado do Abismo'],
  armadura: ['Casaco Reforçado','Cota de Malha Élfica','Manto do Crepúsculo','Couraça Dracónica','Armadura Espectral','Véu do Monarca'],
  anel:     ['Anel de Ferro','Anel do Caçador','Selo Arcano','Aliança do Eclipse','Anel do Soberano','Olho da Tempestade'],
};

const ENCANTAMENTOS = [
  { id:'for',   nome:'da Força',      stat:'for' },
  { id:'agi',   nome:'da Agilidade',  stat:'agi' },
  { id:'vit',   nome:'da Vitalidade', stat:'vit' },
  { id:'sorte', nome:'da Fortuna',    stat:'sorte' },
  { id:'crit',  nome:'do Crítico',    stat:'crit' },
];

/* Masmorras por rank. pesoLoot desloca a tabela de raridade para cima. */
const MASMORRAS = [
  { rank:'E', nome:'Caverna dos Goblins',   nivelReq:1,  nivelMon:1,  salas:3, cor:'#9aa3ad', pesoLoot:0,   ouro:[20,45] },
  { rank:'D', nome:'Túneis do Formigueiro', nivelReq:5,  nivelMon:6,  salas:3, cor:'#22c55e', pesoLoot:.5,  ouro:[45,90] },
  { rank:'C', nome:'Cripta dos Esqueletos', nivelReq:10, nivelMon:12, salas:4, cor:'#3b82f6', pesoLoot:1,   ouro:[90,170] },
  { rank:'B', nome:'Fortaleza Orc',         nivelReq:16, nivelMon:19, salas:4, cor:'#a855f7', pesoLoot:1.6, ouro:[170,300] },
  { rank:'A', nome:'Covil do Dragão Gélido',nivelReq:24, nivelMon:28, salas:5, cor:'#f59e0b', pesoLoot:2.3, ouro:[300,520] },
  { rank:'S', nome:'Templo do Monarca',     nivelReq:34, nivelMon:40, salas:5, cor:'#ef4444', pesoLoot:3.2, ouro:[520,900] },
];

/* mHp/mDano: multiplicadores sobre BAL.inimigosRank (balance.js)
   sprite: desenho vetorial em js/art.js */
const MONSTROS = {
  E:[{nome:'Goblin',sprite:'goblin',mHp:1.0,mDano:1.0,vel:55},{nome:'Lobo Cinzento',sprite:'lobo',mHp:0.8,mDano:1.2,vel:75}],
  D:[{nome:'Formiga Soldado',sprite:'formiga',mHp:1.0,mDano:1.0,vel:65},{nome:'Aranha Venenosa',sprite:'aranha',mHp:0.8,mDano:1.2,vel:80,ranged:true}],
  C:[{nome:'Esqueleto Guerreiro',sprite:'esqueleto',mHp:1.0,mDano:0.9,vel:60},{nome:'Espectro',sprite:'espectro',mHp:0.75,mDano:1.1,vel:90}],
  B:[{nome:'Orc Berserker',sprite:'orc',mHp:1.0,mDano:0.85,vel:65},{nome:'Mago Orc',sprite:'orcmago',mHp:0.8,mDano:1.0,vel:55,ranged:true}],
  A:[{nome:'Draconiano',sprite:'draconiano',mHp:0.85,mDano:0.85,vel:70},{nome:'Golem de Gelo',sprite:'golem',mHp:1.2,mDano:0.7,vel:45}],
  S:[{nome:'Cavaleiro do Vazio',sprite:'cavaleiro',mHp:0.8,mDano:0.7,vel:75},{nome:'Sacerdote Sombrio',sprite:'sacerdote',mHp:0.65,mDano:0.85,vel:60,ranged:true}],
};

/* Bosses: stats de BAL.inimigosRank × BAL.inimigoClasse.boss
   adornos: camadas extra do art.js · hab: habilidade única
   invocar  — chama lacaios para a sala
   acido    — cospe poças de ácido que queimam o chão
   orbes    — dispara 3 orbes teleguiadas (esquivável)
   investida— carga em linha telegrafada
   sopro    — cone de gelo que congela o Vigia
   aneis    — anéis de destruição em série + teleporte      */
const BOSSES = {
  E:{nome:'Rei Goblin',           sprite:'goblin',     adornos:['coroa'],        hab:'invocar',   vel:50},
  D:{nome:'Rainha do Formigueiro',sprite:'formiga',    adornos:['asas','coroa'], hab:'acido',     vel:55},
  C:{nome:'Lich Menor',           sprite:'esqueleto',  adornos:['coroa','aura'], hab:'orbes',     vel:60},
  B:{nome:'Senhor da Guerra Orc', sprite:'orc',        adornos:['capa'],         hab:'investida', vel:62},
  A:{nome:'Dragão Gélido',        sprite:'draconiano', adornos:['asas'],         hab:'sopro',     vel:58},
  S:{nome:'Monarca da Destruição',sprite:'cavaleiro',  adornos:['capa','aura'],  hab:'aneis',     vel:70},
};

/* Sombras extraíveis (derrotar o boss dá hipótese de extração)
   sprite: espécie do boss de origem, tintada de violeta em combate */
const SOMBRAS_BASE = {
  E:{nome:'Brasa',   sprite:'goblin',     atq:8,   hp:60},
  D:{nome:'Ferrão',  sprite:'formiga',    atq:14,  hp:130},
  C:{nome:'Ossada',  sprite:'esqueleto',  atq:24,  hp:240},
  B:{nome:'Colosso', sprite:'orc',        atq:40,  hp:420},
  A:{nome:'Escama',  sprite:'draconiano', atq:66,  hp:760},
  S:{nome:'Véu',     sprite:'cavaleiro',  atq:105, hp:1300},
};

/* Caçadores NPC do ranking */
const NPC_RANKING = [
  ['Gon Ferreira',98],['Cha Hae-Mi',91],['Baek Storm',85],['Diana Vale',78],
  ['Kaito Lemos',70],['Rui Tavares',61],['Sofia Brandão',52],['Min-Jun K.',44],
  ['André Pires',35],['Lia Monteiro',27],['Tomás Reis',19],['Inês Costa',12],
];

/* Custos e pontos por nível: ver js/balance.js (BAL.economia / BAL.jogador) */

/* ---------- Runas (encaixam na arma, no Ferreiro) ---------- */
const RUNAS = [
  { id:'brasa',   nome:'Runa de Brasas',  icone:'r_brasa',   desc:'Os ataques aplicam queimadura contínua.' },
  { id:'gelo',    nome:'Runa Glacial',    icone:'r_gelo',    desc:'Os ataques atrasam os inimigos.' },
  { id:'sangue',  nome:'Runa Sangrenta',  icone:'r_sangue',  desc:'+5% de roubo de vida.' },
  { id:'trovao',  nome:'Runa do Trovão',  icone:'r_trovao',  desc:'15% de chance de relâmpago em cadeia.' },
  { id:'fortuna', nome:'Runa da Fortuna', icone:'r_fortuna', desc:'+10 de Sorte.' },
];

/* ---------- Missões do Quadro (NPC: Mestre Aldric) ---------- */
const MISSOES = [
  { id:'m_tut1',  nome:'Primeiros Passos',    desc:'Derrota 10 monstros nos portais.',      tipo:'mortes',  alvo:10,  rec:{ouro:120},             tut:'Toca para atacar, mantém premido para o poder, desliza para esquivar.' },
  { id:'m_tut2',  nome:'Aço do Vigia',        desc:'Melhora um item no Ferreiro.',          tipo:'forjas',  alvo:1,   rec:{ouro:150,cristais:3},  tut:'O Ferreiro fica na praça — leva ouro.' },
  { id:'m_clear_d',nome:'Selar a Brecha',     desc:'Encerra um portal de rank D.',          tipo:'clearRank', rank:'D', alvo:1, rec:{ouro:250,cristais:4} },
  { id:'m_sombra',nome:'A Primeira Vigília',  desc:'Extrai a tua primeira sombra.',         tipo:'sombras', alvo:1,   rec:{cristais:8},           tut:'Sombras extraem-se ao derrotar bosses — a Sorte ajuda.' },
  { id:'m_poder', nome:'Eco do Dom',          desc:'Aprende ou evolui 2 poderes.',          tipo:'poderes', alvo:2,   rec:{ouro:300,cristais:5} },
  { id:'m_fusao', nome:'Três em Um',          desc:'Faz uma fusão de itens.',               tipo:'fusoes',  alvo:1,   rec:{ouro:200,cristais:4} },
  { id:'m_clear_b',nome:'Mais Fundo na Fenda',desc:'Encerra um portal de rank B.',          tipo:'clearRank', rank:'B', alvo:1, rec:{ouro:600,cristais:8} },
  { id:'m_mortes2',nome:'Centurião',          desc:'Derrota 100 monstros.',                 tipo:'mortes',  alvo:100, rec:{ouro:800,cristais:10} },
  { id:'m_despertar',nome:'O Primeiro Despertar', desc:'Completa a Provação do Despertar.', tipo:'despertar', alvo:1, rec:{ouro:1000,cristais:15} },
];

/* ---------- NPC: Mestre Aldric ---------- */
const NPC = {
  nome:'Mestre Aldric', emoji:'🧙', icone:'npc',
  saudacoes:[
    'A Fenda não descansa, Vigia. Tu também não devias.',
    'Cada portal selado é uma aldeia que dorme em paz.',
    'O teu dom é raro — as sombras respondem-te. Usa-o bem.',
    'Há rumores de um portal S a formar-se a norte. Prepara-te.',
  ],
};
