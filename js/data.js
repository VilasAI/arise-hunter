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
  arma:     ['Adaga do Watcher','Lâmina Sombria','Espada do Eco','Foice Lunar','Katana do Vazio','Lança Astral','Gládio Rúnico','Machado do Abismo'],
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

/* Masmorras/biomas por rank (D017: um bioma por rank, servos das legiões).
   pesoLoot desloca a tabela de raridade para cima · luz = tinte ambiente do bioma. */
const MASMORRAS = [
  { rank:'E', nome:'Bosque Profanado',    nivelReq:1,  nivelMon:1,  salas:3, cor:'#9aa3ad', luz:'#4a6a3a', pesoLoot:0,   ouro:[20,45],
    tema:'Onde a primeira brecha se abriu. A mata apodrece e os diabretes escavam.' },
  { rank:'D', nome:'Túneis do Enxame',    nivelReq:5,  nivelMon:6,  salas:3, cor:'#22c55e', luz:'#6a5a2a', pesoLoot:.5,  ouro:[45,90],
    tema:'Galerias vivas roídas pelo Enxame — a legião rastejante da Fenda.' },
  { rank:'C', nome:'Cripta dos Renegados',nivelReq:10, nivelMon:12, salas:4, cor:'#3b82f6', luz:'#3a5a7a', pesoLoot:1,   ouro:[90,170],
    tema:'Os mortos erguidos pela Fenda guardam a cripta dos que a serviram primeiro.' },
  { rank:'B', nome:'Fortaleza da Legião', nivelReq:16, nivelMon:19, salas:4, cor:'#a855f7', luz:'#5a3a6a', pesoLoot:1.6, ouro:[170,300],
    tema:'O quartel dos brutos da Legião. Daqui partem as incursões ao mundo.' },
  { rank:'A', nome:'Garganta Gélida',     nivelReq:24, nivelMon:28, salas:5, cor:'#f59e0b', luz:'#3a5a6a', pesoLoot:2.3, ouro:[300,520],
    tema:'O frio antinatural que precede a Fenda. Os demónios puros começam aqui.' },
  { rank:'S', nome:'A Fenda',             nivelReq:34, nivelMon:40, salas:5, cor:'#ef4444', luz:'#6a2a3a', pesoLoot:3.2, ouro:[520,900],
    tema:'O portal-mãe. Entra, fecha-a — e que o mundo se lembre do teu nome.' },
];

/* mHp/mDano: multiplicadores sobre BAL.inimigosRank (balance.js)
   sprite: desenho vetorial em js/art.js */
/* servos das legiões demoníacas (D017) — sprites reaproveitados, identidade nova */
const MONSTROS = {
  E:[{nome:'Diabrete',sprite:'goblin',mHp:1.0,mDano:1.0,vel:55},{nome:'Cão da Fenda',sprite:'lobo',mHp:0.8,mDano:1.2,vel:75},{nome:'Diabrete Fundeiro',sprite:'goblin',mHp:0.7,mDano:0.9,vel:50,ranged:true}],
  D:[{nome:'Carraça do Enxame',sprite:'formiga',mHp:1.0,mDano:1.0,vel:65},{nome:'Tecelã Venenosa',sprite:'aranha',mHp:0.8,mDano:1.2,vel:80,ranged:true}],
  C:[{nome:'Renegado Erguido',sprite:'esqueleto',mHp:1.0,mDano:0.9,vel:60},{nome:'Alma Cativa',sprite:'espectro',mHp:0.75,mDano:1.1,vel:90},{nome:'Arqueiro Erguido',sprite:'esqueleto',mHp:0.75,mDano:1.0,vel:52,ranged:true}],
  B:[{nome:'Bruto da Legião',sprite:'orc',mHp:1.0,mDano:0.85,vel:65},{nome:'Feiticeiro da Legião',sprite:'orcmago',mHp:0.8,mDano:1.0,vel:55,ranged:true}],
  A:[{nome:'Dracónida',sprite:'draconiano',mHp:0.85,mDano:0.85,vel:70},{nome:'Golem do Degelo',sprite:'golem',mHp:1.2,mDano:0.7,vel:45},{nome:'Dracónida Cuspidor',sprite:'draconiano',mHp:0.8,mDano:1.0,vel:55,ranged:true}],
  S:[{nome:'Cavaleiro do Vazio',sprite:'cavaleiro',mHp:0.8,mDano:0.7,vel:75},{nome:'Sacerdote da Fenda',sprite:'sacerdote',mHp:0.65,mDano:0.85,vel:60,ranged:true}],
};

/* Bosses: stats de BAL.inimigosRank × BAL.inimigoClasse.boss
   adornos: camadas extra do art.js · hab: habilidade única
   invocar  — chama lacaios para a sala
   acido    — cospe poças de ácido que queimam o chão
   orbes    — dispara 3 orbes teleguiadas (esquivável)
   investida— carga em linha telegrafada
   sopro    — cone de gelo que congela o Watcher
   aneis    — anéis de destruição em série + teleporte      */
const BOSSES = {
  E:{nome:'Rei dos Diabretes',    sprite:'goblin',     adornos:['coroa'],        hab:'invocar',   vel:50},
  D:{nome:'Rainha do Enxame',     sprite:'formiga',    adornos:['asas','coroa'], hab:'acido',     vel:55},
  C:{nome:'Lich Renegado',        sprite:'esqueleto',  adornos:['coroa','aura'], hab:'orbes',     vel:60},
  B:{nome:'Senhor da Guerra',     sprite:'orc',        adornos:['capa'],         hab:'investida', vel:62},
  A:{nome:'Dragão Gélido',        sprite:'draconiano', adornos:['asas'],         hab:'sopro',     vel:58},
  S:{nome:'Senhor da Fenda',      sprite:'cavaleiro',  adornos:['capa','aura'],  hab:'aneis',     vel:70},
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
  { id:'m_tut2',  nome:'Aço do Watcher',      desc:'Melhora um item no Ferreiro.',          tipo:'forjas',  alvo:1,   rec:{ouro:150,cristais:3},  tut:'O Ferreiro fica na praça — leva ouro.' },
  { id:'m_clear_d',nome:'Selar a Brecha',     desc:'Encerra um portal de rank D.',          tipo:'clearRank', rank:'D', alvo:1, rec:{ouro:250,cristais:4} },
  { id:'m_sombra',nome:'A Primeira Vigília',  desc:'Extrai a tua primeira sombra.',         tipo:'sombras', alvo:1,   rec:{cristais:8},           tut:'Sombras extraem-se ao derrotar bosses — a Sorte ajuda.' },
  { id:'m_poder', nome:'Eco do Dom',          desc:'Aprende ou evolui 2 poderes.',          tipo:'poderes', alvo:2,   rec:{ouro:300,cristais:5} },
  { id:'m_fusao', nome:'Três em Um',          desc:'Faz uma fusão de itens.',               tipo:'fusoes',  alvo:1,   rec:{ouro:200,cristais:4} },
  { id:'m_clear_c',nome:'Selar a Cripta',     desc:'Encerra um portal de rank C.',          tipo:'clearRank', rank:'C', alvo:1, rec:{ouro:400,cristais:6} },
  { id:'m_clear_b',nome:'Mais Fundo na Fenda',desc:'Encerra um portal de rank B.',          tipo:'clearRank', rank:'B', alvo:1, rec:{ouro:600,cristais:8} },
  { id:'m_mortes2',nome:'Centurião',          desc:'Derrota 100 monstros.',                 tipo:'mortes',  alvo:100, rec:{ouro:800,cristais:10} },
  { id:'m_despertar',nome:'O Primeiro Despertar', desc:'Completa a Provação do Despertar.', tipo:'despertar', alvo:1, rec:{ouro:1000,cristais:15} },
];

/* ---------- NPC: Mestre Aldric (D008 — diálogos por rank, sempre saltáveis) ---------- */
const NPC = {
  nome:'Mestre Aldric', emoji:'🧙', icone:'npc',
  saudacoes:[
    'A Fenda não descansa, Watcher. Tu também não devias.',
    'Cada portal selado é uma aldeia que dorme em paz.',
    'O dom escolhe poucos. A ti, escolheu-te inteiro.',
    'As legiões testam-nos primeiro com os servos. Os demónios vêm depois.',
  ],
  porRank: {   // fala à entrada do 1.º portal de cada rank
    E:'O Bosque foi o primeiro a cair quando a Fenda abriu. Os diabretes parecem pouco — mas foi por subestimarmos o pouco que perdemos tanto. Vai, e volta inteiro.',
    D:'Debaixo dos nossos pés, o Enxame escava há doze anos. Se as galerias chegarem à cidade, não haverá muralha que nos valha. Corta o mal pela raiz.',
    C:'Esta cripta guarda os primeiros que se venderam à Fenda. O Lich ergue os mortos mais depressa do que os enterramos. Sela a cripta — e cuidado com as almas: já foram gente.',
    B:'A Fortaleza é onde a Legião se organiza. Cada incursão que sofremos partiu daqui. Derruba o Senhor da Guerra e ganhamos meses.',
    A:'Sentes o frio? Não é inverno — é a Fenda a respirar. A partir daqui já não enfrentas servos. Enfrentas demónios.',
    S:'É agora, Watcher. Entra na Fenda e fecha-a. Se falhares, ninguém se lembrará de nós. Se venceres… que o mundo se lembre de ti.',
  },
  aposRank: {  // fala após o 1.º selo de cada rank
    E:'Selaste a brecha do Bosque. A mata vai levar anos a sarar — mas vai sarar. Há esperança em ti.',
    D:'O Enxame recuou. Ouve-me: a Rainha não era a cabeça, era um dedo. O corpo está mais fundo.',
    C:'O Lich caiu e os mortos dormem de novo. O que vem a seguir já não é obra de servos, Watcher. Prepara-te a sério.',
    B:'Sem o Senhor da Guerra, a Legião é um animal sem cabeça. Aproveita — a Fenda vai tentar substituí-lo.',
    A:'Atravessaste o frio e voltaste. Resta um portal. O último. O primeiro.',
  },
};
