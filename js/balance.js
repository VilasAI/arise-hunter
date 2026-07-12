/* ============================================================
   BALANCEAMENTO CENTRAL
   ------------------------------------------------------------
   TODOS os números que afetam o equilíbrio do jogo vivem aqui.
   Ajusta valores neste ficheiro sem tocar no resto do código.
   ============================================================ */
'use strict';

const BAL = {

  /* ---------- Valores base do jogador (nível 1, sem pontos) ---------- */
  jogador: {
    hpBase: 100,        // vida máxima inicial
    danoBase: 10,       // dano de ataque inicial (antes de Força e arma)
    velAtqBase: 1.0,    // ataques por segundo (multiplicador base)
    velMovBase: 1.0,    // 100% velocidade de movimento
    mpBase: 50,         // mana inicial
    mpPorNivel: 4,      // mana extra por nível de personagem
    regenMp: 4,         // mana regenerada por segundo em combate
    pontosPorNivel: 3,  // pontos de atributo ganhos por nível
    defPorVit: 0.5,     // defesa ganha por cada ponto de Vitalidade
    defPorArmadura: 0.35, // fração do valor da armadura convertida em defesa
                          // (a 1.0 o jogador fica invulnerável nos ranks altos)
  },

  /* ---------- Stats BÁSICAS: 1 ponto investido = +1 unidade ---------- */
  basicas: {
    forca:      { danoPorPonto: 2 },     // +2 dano de ataque por ponto
    vitalidade: { hpPorPonto: 12 },      // +12 HP máximo por ponto
    agilidade:  { velAtqPorPonto: 0.01,  // +1% velocidade de ataque por ponto
                  velMovPorPonto: 0.005 }, // +0,5% velocidade de movimento
  },

  /* ---------- Stats AVANÇADAS: 2 pontos investidos = +1 unidade ----------
     valor final = min(base + unidades * porUnidade, cap)
     unidades = floor(pontosInvestidos / 2); ponto ímpar fica guardado (½). */
  avancadas: {
    crit:     { base: 5,   porUnidade: 1,   cap: 60,  nome: 'Ataque Crítico',     sufixo: '%' },
    critDano: { base: 150, porUnidade: 8,   cap: 350, nome: 'Dano Crítico',       sufixo: '%' },
    sorte:    { base: 0,   porUnidade: 1,   cap: 100, nome: 'Sorte',              sufixo: '' },
    roubo:    { base: 0,   porUnidade: 0.5, cap: 25,  nome: 'Roubo de Vida',      sufixo: '%' },
    pen:      { base: 0,   porUnidade: 1,   cap: 50,  nome: 'Penetração de Armadura', sufixo: '%' },
    cdr:      { base: 0,   porUnidade: 1,   cap: 40,  nome: 'Vel. de Cooldown',   sufixo: '%' },
  },

  /* ---------- Efeitos da Sorte (por unidade de valor final) ---------- */
  sorte: {
    raridadePorPonto: 0.02,  // cada ponto de Sorte sobe 0,02 o "peso de loot" da masmorra
    dropExtraPorPonto: 0.01, // cada ponto de Sorte dá +1% de chance de item extra
  },

  /* ---------- Habilidade principal (gesto de segurar) ---------- */
  skill: {
    multDano: 2.2,   // dano = ataque do jogador × este multiplicador
    custoMp: 25,     // mana gasta
    raio: 170,       // raio do efeito em píxeis
    cooldown: 5.0,   // segundos (reduzido pela Vel. de Cooldown)
  },
  /* esquiva: ver BAL.combate (dashDist/dashCd/dashInvul) */

  /* ---------- Combate (movimento, esquiva, inimigos) ---------- */
  combate: {
    velJogador: 265,     // px/s de movimento livre (multiplicado pela Agilidade)
    alcanceAtaque: 95,   // raio do golpe básico (auto-mira dentro deste alcance)
    dashDist: 155,       // distância da esquiva
    dashVel: 950,        // px/s durante a esquiva
    dashCd: 0.9,         // cooldown da esquiva (reduzido pela Vel. de Cooldown)
    dashInvul: 0.45,     // i-frames da esquiva
    recuperar: 0.55,     // pausa do inimigo depois de cada golpe
    separacao: 34,       // distância mínima entre inimigos (não se empilham)
    alcanceRanged: 270,  // distância de disparo dos inimigos à distância
    velProjInimigo: 240, // px/s dos projéteis inimigos
    // agressividade: visão total (sem leash), recargas curtas, habilidades e fúria
    cdAtq: [0.75, 1.4],  // recarga entre ações de cada inimigo (min, max)
    habPorSeg: 1.5,      // tentativas de habilidade por segundo, independente dos FPS (cd pronto e à distância)
    habPorSegBoss: 3.0,  // idem para bosses
    alcanceHab: 320,     // distância máxima para usar habilidade (tremor exige ~140)
    furia: { hp:0.35, vel:1.3, dano:1.25 }, // corpo-a-corpo enfurece abaixo de 35% de vida
  },

  /* ---------- Game feel (D025 — combate suave) ---------- */
  feel: {
    bufferAtq: 0.15,     // janela (s): toque de ataque durante a recarga fica guardado
    dashCancel: 0.12,    // o dash corta a recarga do ataque para este máximo (s)
    acelMov: 0.08,       // constante de tempo (s) da aceleração/travagem do movimento
    hitstop: 0.02,       // micro-pausa (s) em qualquer golpe que conecta
    hitstopCrit: 0.06,   // micro-pausa nos críticos
    squash: 0.25,        // intensidade do squash & stretch no sprite atingido
    kbVel: 320,          // velocidade inicial (px/s) do knockback (decai até parar)
    kbTravao: 9,         // decaimento exponencial do knockback (por segundo)
  },

  /* ---------- Ritmo das animações (D028 — frames reais por ação) ----------
     Durações (s) da ação completa e fps dos loops; o número de frames vem do
     sheet (META), por isso trocar a arte não obriga a mexer aqui. */
  anim: {
    heroi:   { idleFps:6, walkFps:12, ataque:0.18, dano:0.24, skill:0.72, morte:0.60 },
    inimigo: { idleFps:6, walkFps:11, golpe:0.55, disparo:0.60, dano:0.12, morte:0.60, caido:0.70 },
    projetil:{ altHeroi:22, altInimigo:28, fps:10 },   // sprites *_proj em voo
  },

  /* ---------- Curva de XP ---------- */
  xp: {
    base: 40, expoente: 1.9, mult: 22,  // xpParaNivel(n) = base + n^expoente * mult
  },

  /* ---------- Inimigos por rank (Anexo A) ----------
     Cada monstro em data.js usa multiplicadores (mHp/mDano) sobre estes valores. */
  inimigosRank: {
    E: { hp: 60,   dano: 5,   def: 0  },
    D: { hp: 140,  dano: 10,  def: 2  },
    C: { hp: 320,  dano: 20,  def: 5  },
    B: { hp: 700,  dano: 38,  def: 10 },
    A: { hp: 1500, dano: 70,  def: 18 },
    S: { hp: 3200, dano: 130, def: 30 },
  },
  inimigoClasse: {                       // multiplicadores por classe de inimigo
    normal: { hp: 1.0, dano: 1.0 },
    elite:  { hp: 3.2, dano: 1.5 },
    boss:   { hp: 5.5, dano: 1.6 },
  },
  escalaPorSala: 0.12,   // inimigos ficam +12% mais fortes por cada sala avançada
  defesaInimigaReduz: 1, // cada ponto de defesa inimiga corta 1 de dano (antes da Penetração)

  /* ---------- Escalonamento de poderes (5 tiers — Anexo A) ----------
     Usado pelo sistema de poderes (Bloco 4). */
  tiersPoder: [
    { efeito: 1.00, cd: 1.00, custoPts: 0, despertar: 0 }, // Tier 1 — inicial
    { efeito: 1.30, cd: 0.92, custoPts: 1, despertar: 0 }, // Tier 2 — 1 pt + materiais
    { efeito: 1.65, cd: 0.85, custoPts: 2, despertar: 0 }, // Tier 3 — 2 pts + materiais raros
    { efeito: 2.10, cd: 0.78, custoPts: 3, despertar: 1 }, // Tier 4 — exige Despertar 1
    { efeito: 2.70, cd: 0.70, custoPts: 4, despertar: 2 }, // Tier 5 — exige Despertar 2
  ],

  /* ---------- Ultimates (D011/D018 — desbloqueiam no 1.º Despertar) ----------
     A barra carrega com o dano causado (relativo ao ataque) e com abates. */
  ultimates: {
    cargaMax: 100,        // pontos para encher a barra
    cargaPorGolpe: 1.6,   // carga = (dano do golpe ÷ ataque do jogador) × isto
    cargaPorAbate: 6,     // bónus por inimigo abatido
    guerreiro: { dur:8,  reducaoDano:0.60, reflete:0.30, stunGolpe:1.0 },
    mago:      { dur:5,  ritmo:0.22, dano:1.2 },   // 1 meteoro a cada X s, dano × ataque
    batedor:   { dur:6,  ritmo:0.28, dano:0.75 },  // disparo auto multi-alvo, crítico garantido
    assassino: { dur:10 },                         // a coleção inteira de sombras luta contigo
    paladino:  { cura:0.45, dano:1.6, raio:220, cegar:2.5 }, // explosão instantânea
  },

  /* ---------- Sombras ---------- */
  sombras: {
    maxBase: 1,          // sombras ativas no início
    nivelPorSombra: 12,  // +1 sombra ativa por cada X níveis de personagem
    maxAbsoluto: 5,
    chanceExtracao: 0.45,    // chance base de extrair sombra ao derrotar boss
    chancePorSorte: 0.003,   // cada ponto de Sorte soma isto à chance
    crescimentoPorNivel: 0.22, // stats da sombra por nível dela
  },

  /* ---------- Economia ---------- */
  economia: {
    forjaBase: 60,       // ouro por nível de melhoria (escala com nível e raridade)
    encanteCristais: 3,  // custo de um encantamento
    fusaoQtd: 3,         // itens iguais necessários para fundir
    lojaMargem: 8,       // preço de compra = valor do item × esta margem
  },

  /* ---------- Poderes ---------- */
  poderes: {
    nivelPorPonto: 2,    // 1 ponto de habilidade a cada X níveis
    custoOuroTier: 150,  // ouro por tier (× tier alvo) — cristais fora (D020)
    tierTalento: 3,      // tier a partir do qual se escolhe o talento
    slotsAtivos: 3,      // poderes ativos equipáveis em combate
  },

  /* ---------- Árvore de poderes (D019/D020) ---------- */
  arvore: {
    custoMenor: 1,          // pontos por nó menor
    custoKeystone: 3,       // pontos por keystone
    respecOuroBase: 250,    // 2.º respec em diante: base + nível × porNivel
    respecOuroPorNivel: 30, // (o 1.º respec é grátis)
  },

  /* ---------- Stamina de masmorra ---------- */
  stamina: {
    max: 20,             // stamina máxima base (Reservatório da base aumenta)
    custoPortal: 3,      // custo de entrar num portal normal
    custoDiaria: 0,      // a masmorra diária é grátis
    minutosPorPonto: 6,  // regenera 1 ponto a cada X minutos reais
  },

  /* ---------- Beta (D007): a campanha corta no rank C ---------- */
  beta: { ativa: true, rankMax: 'C' },

  /* ---------- Despertar (rank E→S do caçador) ---------- */
  despertar: {
    niveis: [15, 30],    // níveis em que cada Despertar fica disponível
    rankExige: { A:1, S:2 }, // portais que exigem nível de Despertar
  },

  /* ---------- Base do jogador (melhorias) ---------- */
  base: {
    maxNivel: 5,
    custoOuro: n => 300 * Math.pow(2, n),   // custo do nível n→n+1
    custoCristais: n => 5 * (n+1),
    forjaDescontoPorNivel: 0.06,   // -6% custo de forja por nível
    altarBonusPorNivel: 0.10,      // Altar do Dom: +10% stats das sombras/nível (Assassino)
    altarUltPorNivel: 0.08,        // Altar do Dom: +8% efeito da ultimate/nível (outras classes)
    reservatorioPorNivel: 2,       // +2 stamina máxima por nível
  },

  /* ---------- Runas ---------- */
  runas: {
    slotsBase: 1,            // slots de runa na arma (2º slot: forja da base nv.2)
    slot2ForjaNivel: 2,
    chanceDropBoss: 0.30,    // chance de runa ao derrotar boss (rank C+)
    queimaDano: 0.25,        // dano/s da queimadura = 25% do ataque do jogador
    queimaDur: 3,            // segundos de queimadura
    geloLentidao: 0.15,      // 15% mais lentos
    geloDur: 2.5,
    sangueRoubo: 5,          // +5% roubo de vida
    trovaoChance: 0.15,      // 15% de chance de cadeia no ataque básico
    trovaoDano: 0.6,         // 60% do ataque, salta até 2 inimigos
    fortunaSorte: 10,        // +10 Sorte
  },
};

/* Aliases para retro-compatibilidade com o resto do código */
const PONTOS_POR_NIVEL  = BAL.jogador.pontosPorNivel;
const CUSTO_FORJA_BASE  = BAL.economia.forjaBase;
const CUSTO_ENCANTE     = BAL.economia.encanteCristais;
const FUSAO_QTD         = BAL.economia.fusaoQtd;

/* ============================================================
   FÓRMULAS CENTRAIS
   ============================================================ */

/* 2 pontos investidos = 1 unidade; o ponto ímpar fica guardado (½) */
function unidadesAvancada(pontos){ return Math.floor((pontos||0) / 2); }
function meioPonto(pontos){ return (pontos||0) % 2 === 1; }

/* Valor final de uma stat avançada, já com cap aplicado.
   bonusUnidades: unidades extra vindas de equipamento/encantamentos. */
function valorAvancada(id, pontos, bonusUnidades=0){
  const a = BAL.avancadas[id];
  return Math.min(a.base + (unidadesAvancada(pontos) + bonusUnidades) * a.porUnidade, a.cap);
}
function avancadaNoCap(id, pontos, bonusUnidades=0){
  return valorAvancada(id, pontos, bonusUnidades) >= BAL.avancadas[id].cap;
}

/* Dano de um golpe do jogador contra um inimigo.
   danoTotal  : dano já com Força e arma somados
   critPct    : chance de crítico em % (ex.: 23)
   critDanoPct: multiplicador de crítico em % (ex.: 180)
   penPct     : % de defesa inimiga ignorada
   defInimigo : defesa do inimigo
   Devolve { dano, crit }. */
function calcularGolpe(danoTotal, critPct, critDanoPct, penPct, defInimigo){
  const crit = Math.random() < critPct / 100;
  let dano = danoTotal * (crit ? critDanoPct / 100 : 1);
  const defEfetiva = (defInimigo||0) * (1 - (penPct||0)/100) * BAL.defesaInimigaReduz;
  dano = Math.max(1, dano - defEfetiva);
  dano *= 0.92 + Math.random() * 0.16;   // pequena variação ±8%
  return { dano: Math.round(dano), crit };
}

/* Stats de um inimigo concreto.
   rank: 'E'..'S' · classe: normal/elite/boss · mHp/mDano: multiplicadores
   do monstro (data.js) · sala: nº da sala atual (escala progressiva). */
function statsInimigo(rank, classe, mHp, mDano, sala){
  const base = BAL.inimigosRank[rank];
  const cls = BAL.inimigoClasse[classe] || BAL.inimigoClasse.normal;
  const esc = 1 + (sala-1) * BAL.escalaPorSala;
  return {
    hp:   Math.round(base.hp   * cls.hp   * (mHp||1)   * esc),
    dano: Math.round(base.dano * cls.dano * (mDano||1) * esc),
    def:  base.def,
  };
}
