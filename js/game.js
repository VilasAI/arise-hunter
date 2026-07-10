/* ============ ESTADO E REGRAS DO JOGO ============ */
'use strict';

const SAVE_KEY = 'arise-hunter-save-v1';

/* Modo de teste: abrir o link com ?teste (ou ?test) dá energia ilimitada,
   para poder jogar em contínuo à caça de bugs. Não afeta jogadores normais. */
const MODO_TESTE = /[?&](teste|test|debug)\b/i.test(location.search);

let G = null; // estado global do jogador

function novoJogo(){
  return {
    nome:'Caçador', classe:null, nivel:1, xp:0, pontos:0,
    // básicas: 1 ponto = +1 · avançadas: pontos INVESTIDOS (2 = 1 unidade)
    basicas:{ for:0, vit:0, agi:0 },
    avancadas:{ crit:0, critDano:0, sorte:0, roubo:0, pen:0, cdr:0 },
    despertar:0,
    ouro:100, cristais:5,
    inventario:[], proxId:1,
    equipado:{ arma:null, armadura:null, anel:null },
    sombras:[],
    clears:{},                 // rank -> nº de vezes concluída
    auto:false,
    diario:{ data:'', feitoDiaria:false, loginDado:false },
    // poderes + árvore
    poderes:{ lamina:{ tier:1, talento:null } },
    equipadosPoder:['lamina', null, null],
    pontosHabUsados:0,
    arvore:{ nos:{}, respecs:0 },
    skins:['padrao'], skinAtiva:'padrao',
    // runas / stamina / base
    runas:{}, runasEq:[null, null],
    stamina:{ v:BAL.stamina.max, ts:Date.now() },
    base:{ forja:0, altar:0, reservatorio:0 },
    // missões
    contadores:{ mortes:0, forjas:0, fusoes:0, sombras:0, poderes:0, despertar:0 },
    missoesFeitas:[],
    criadoEm: Date.now(),
  };
}

/* ---------- Gravação (local + exportável) ---------- */
function guardar(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(G)); }catch(e){} }

/* Migra saves do sistema antigo (FOR/AGI/VIT/INT) para o novo:
   devolve todos os pontos ganhos por nível para redistribuição. */
function migrarSave(obj){
  if(obj.stats && obj.stats.for !== undefined && !obj.basicas){
    obj.basicas  = { for:0, vit:0, agi:0 };
    obj.avancadas= { crit:0, critDano:0, sorte:0, roubo:0, pen:0, cdr:0 };
    obj.pontos = Math.max(0, (obj.nivel-1) * BAL.jogador.pontosPorNivel);
    delete obj.stats;
    obj._migrado = true;
  }
  if(obj.despertar === undefined) obj.despertar = 0;
  if(obj.classe === undefined) obj.classe = null;
  for(const it of obj.inventario || []){
    if(it.encante && it.encante.stat === 'int') it.encante.stat = 'sorte';
  }
  // saves anteriores ao sistema de poderes/vila
  const novo = novoJogo();
  for(const k of ['poderes','equipadosPoder','runas','runasEq','stamina','base','contadores','missoesFeitas','arvore','skins','skinAtiva']){
    if(obj[k] === undefined) obj[k] = novo[k];
  }
  if(obj.pontosHabUsados === undefined) obj.pontosHabUsados = 0;
  // D010/D011: «Exército de Sombras» virou ultimate — devolve os pontos gastos
  if(obj.poderes && obj.poderes.sombras){
    let devolvidos = 0;
    for(let i=0;i<(obj.poderes.sombras.tier||1);i++) devolvidos += Math.max(1, BAL.tiersPoder[i].custoPts);
    obj.pontosHabUsados = Math.max(0, obj.pontosHabUsados - devolvidos);
    delete obj.poderes.sombras;
    obj._sombrasMigradas = true;
  }
  // D010: sombras exclusivas do Assassino — compensa as outras classes em cristais
  if(obj.classe && obj.classe !== 'assassino' && obj.sombras && obj.sombras.length){
    obj.cristais = (obj.cristais||0) + obj.sombras.reduce((a,s)=> a + 4 + (s.nivel-1)*4, 0);
    obj.sombras = [];
    obj._sombrasMigradas = true;
  }
  return obj;
}

function carregar(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){ G = migrarSave(Object.assign(novoJogo(), JSON.parse(raw))); guardar(); return true; }
  }catch(e){}
  G = novoJogo();
  return false;
}
function apagarSave(){ localStorage.removeItem(SAVE_KEY); G = novoJogo(); }
function exportarSave(){ return btoa(unescape(encodeURIComponent(JSON.stringify(G)))); }
function importarSave(codigo){
  try{
    const obj = JSON.parse(decodeURIComponent(escape(atob(codigo.trim()))));
    if(typeof obj.nivel !== 'number') return false;
    G = migrarSave(Object.assign(novoJogo(), obj));
    guardar();
    return true;
  }catch(e){ return false; }
}

/* ---------- Utilidades ---------- */
const rnd = (a,b)=> a + Math.random()*(b-a);
const rndInt = (a,b)=> Math.floor(rnd(a,b+1));
const escolher = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (v,a,b)=> Math.max(a,Math.min(b,v));

/* ---------- Stats derivados (fórmulas em js/balance.js) ---------- */
function bonusEquipamento(){
  // for/vit/agi: pontos básicos extra · crit/sorte: UNIDADES avançadas extra
  const b = { atq:0, def:0, for:0, vit:0, agi:0, crit:0, sorte:0 };
  for(const slot of Object.keys(G.equipado)){
    const it = itemPorId(G.equipado[slot]);
    if(!it) continue;
    const v = valorItem(it);
    if(it.tipo==='arma') b.atq += v;
    else if(it.tipo==='armadura') b.def += Math.round(v * BAL.jogador.defPorArmadura);
    else { b.atq += Math.round(v*0.5); b.sorte += Math.round(v*0.2); } // anel
    if(it.encante) b[it.encante.stat] = (b[it.encante.stat]||0) + it.encante.valor;
  }
  return b;
}

function statsTotais(){
  const J = BAL.jogador, b = bonusEquipamento();
  const arv = (typeof bonusArvore==='function') ? bonusArvore() : { atqPct:0,hpPct:0,defPct:0,mpPct:0,velMovPct:0,critFlat:0,critDanoFlat:0,cdrFlat:0,sorteFlat:0,rouboFlat:0,ultCargaPct:0,efPoder:{} };
  const forca = G.basicas.for + b.for;
  const vit   = G.basicas.vit + b.vit;
  const agi   = G.basicas.agi + b.agi;
  const atq   = Math.round((J.danoBase + forca * BAL.basicas.forca.danoPorPonto + b.atq) * (1 + arv.atqPct/100));
  const pas = (typeof passivaClasse==='function') ? passivaClasse()
            : { def:1, pen:0, mp:1, hp:1, crit:0, critDano:0, velMov:0 };
  return {
    forca, vit, agi, atq,
    hpMax:  Math.round((J.hpBase + vit * BAL.basicas.vitalidade.hpPorPonto) * pas.hp * (1 + arv.hpPct/100)),
    mpMax:  Math.round((J.mpBase + (G.nivel-1) * J.mpPorNivel) * pas.mp * (1 + arv.mpPct/100)),
    def:    Math.round((vit * J.defPorVit + b.def) * pas.def * (1 + arv.defPct/100)),
    velAtq: J.velAtqBase * (1 + agi * BAL.basicas.agilidade.velAtqPorPonto),
    velMov: J.velMovBase * (1 + agi * BAL.basicas.agilidade.velMovPorPonto) * (1 + pas.velMov + arv.velMovPct/100),
    // avançadas (valor final, caps aplicados; equipamento + passiva + árvore)
    crit:     Math.min(60, valorAvancada('crit', G.avancadas.crit, b.crit) + pas.crit + arv.critFlat),
    critDano: Math.min(350, valorAvancada('critDano', G.avancadas.critDano) + pas.critDano + arv.critDanoFlat),
    sorte:    valorAvancada('sorte',    G.avancadas.sorte,    b.sorte) + arv.sorteFlat
              + (runaEquipada('fortuna') ? BAL.runas.fortunaSorte : 0),
    roubo:    valorAvancada('roubo',    G.avancadas.roubo) + arv.rouboFlat
              + (poderTier('sede') ? PODERES.sede.base.roubo * efeitoPoder('sede') : 0)
              + (runaEquipada('sangue') ? BAL.runas.sangueRoubo : 0),
    pen:      Math.min(50, valorAvancada('pen', G.avancadas.pen) + pas.pen),
    cdr:      valorAvancada('cdr',      G.avancadas.cdr) + arv.cdrFlat,
    danoSkill: atq * BAL.skill.multDano,
    cargaUltMult: 1 + arv.ultCargaPct/100,
    maxSombras: clamp(BAL.sombras.maxBase + Math.floor(G.nivel / BAL.sombras.nivelPorSombra) + G.despertar,
                      1, BAL.sombras.maxAbsoluto),
  };
}

function poderTotal(){
  const t = statsTotais();
  return Math.round(
    t.atq * 2 * (1 + t.crit/100 * (t.critDano-100)/100)  // dano médio por golpe
    + t.hpMax * 0.15 + t.def * 2 + G.nivel * 5
  );
}

/* ---------- XP / nível ---------- */
function xpParaNivel(n){ return Math.round(BAL.xp.base + Math.pow(n, BAL.xp.expoente) * BAL.xp.mult); }

function darXP(qtd){
  G.xp += qtd;
  let subiu = 0;
  while(G.xp >= xpParaNivel(G.nivel)){
    G.xp -= xpParaNivel(G.nivel);
    G.nivel++;
    G.pontos += PONTOS_POR_NIVEL;
    subiu++;
  }
  return subiu;
}

function rankCacador(){
  const n = G.nivel;
  return n>=34?'S' : n>=24?'A' : n>=16?'B' : n>=10?'C' : n>=5?'D' : 'E';
}

/* ---------- Itens ---------- */
function itemPorId(id){ return G.inventario.find(i=>i.id===id) || null; }

function valorItem(it){
  const r = RARIDADES[IDX_RARIDADE[it.raridade]];
  return Math.round(it.base * r.mult * (1 + it.nivel*0.18));
}

function gerarItem(pesoLoot, nivelMon){
  // tabela de raridade deslocada pelo pesoLoot da masmorra:
  // ranks altos sobem o peso das raridades altas e despromovem as baixas
  const pesos = RARIDADES.map((r,i)=>
    r.peso
    * Math.pow(2.1, Math.max(0, pesoLoot - (4-i)*0.4))
    * Math.pow(0.45, Math.max(0, pesoLoot - i))
    * (i<=pesoLoot+1.5 ? 1 : 0.15));
  let total = pesos.reduce((a,b)=>a+b,0), tiro = Math.random()*total, idx = 0;
  for(let i=0;i<pesos.length;i++){ tiro -= pesos[i]; if(tiro<=0){ idx=i; break; } }
  const tipo = escolher(TIPOS_ITEM);
  return {
    id: G.proxId++,
    tipo: tipo.id,
    nome: escolher(NOMES_ITEM[tipo.id]),
    raridade: RARIDADES[idx].id,
    base: Math.round(6 + nivelMon*2.4 + rnd(0,4)),
    nivel: 0,
    encante: null,
  };
}

function equipar(it){
  G.equipado[it.tipo] = it.id;
  guardar();
}
function desequipar(slot){ G.equipado[slot]=null; guardar(); }

function venderItem(it){
  const r = IDX_RARIDADE[it.raridade];
  const ouro = Math.round(valorItem(it) * (1.5 + r));
  G.inventario = G.inventario.filter(x=>x.id!==it.id);
  for(const s of Object.keys(G.equipado)) if(G.equipado[s]===it.id) G.equipado[s]=null;
  G.ouro += ouro;
  guardar();
  return ouro;
}

/* ---------- Forja ---------- */
function custoForja(it){
  const desconto = 1 - G.base.forja * BAL.base.forjaDescontoPorNivel; // Forja da base
  return Math.round(CUSTO_FORJA_BASE * (it.nivel+1) * (1 + IDX_RARIDADE[it.raridade]*0.6) * desconto);
}
function chanceForja(it){ return clamp(0.95 - it.nivel*0.07, 0.35, 0.95); }

function forjar(it){
  const custo = custoForja(it);
  if(G.ouro < custo) return {ok:false, msg:'Ouro insuficiente'};
  G.ouro -= custo;
  if(Math.random() < chanceForja(it)){
    it.nivel++;
    G.contadores.forjas++;
    guardar();
    return {ok:true, msg:`Melhoria para +${it.nivel}!`};
  }
  guardar();
  return {ok:false, msg:'A forja falhou… o item resistiu.'};
}

function encantar(it){
  if(G.cristais < CUSTO_ENCANTE) return {ok:false, msg:'Cristais insuficientes'};
  G.cristais -= CUSTO_ENCANTE;
  const e = escolher(ENCANTAMENTOS);
  const r = IDX_RARIDADE[it.raridade];
  it.encante = { stat:e.stat, nome:e.nome, valor: rndInt(2,5) + r*2 };
  guardar();
  return {ok:true, msg:`Encantado: ${it.nome} ${e.nome} (+${it.encante.valor})`};
}

function fundir(ids){
  const itens = ids.map(itemPorId).filter(Boolean);
  if(itens.length !== FUSAO_QTD) return {ok:false, msg:`Escolhe ${FUSAO_QTD} itens.`};
  const r = itens[0].raridade, tipo = itens[0].tipo;
  if(!itens.every(i=>i.raridade===r && i.tipo===tipo)) return {ok:false, msg:'Têm de ser do mesmo tipo e raridade.'};
  const ri = IDX_RARIDADE[r];
  if(ri >= RARIDADES.length-1) return {ok:false, msg:'Raridade máxima — não dá para fundir.'};
  const base = Math.max(...itens.map(i=>i.base));
  G.inventario = G.inventario.filter(i=>!ids.includes(i.id));
  for(const s of Object.keys(G.equipado)) if(ids.includes(G.equipado[s])) G.equipado[s]=null;
  const novo = {
    id:G.proxId++, tipo, nome:escolher(NOMES_ITEM[tipo]),
    raridade:RARIDADES[ri+1].id, base:Math.round(base*1.15), nivel:0, encante:null,
  };
  G.inventario.push(novo);
  G.contadores.fusoes++;
  guardar();
  return {ok:true, item:novo};
}

/* ---------- Sombras (exclusivas do Assassino — D010) ---------- */
function tentarExtrairSombra(rank){
  if(G.classe !== 'assassino') return null;                // só o Assassino extrai
  if(G.sombras.some(s=>s.rank===rank)) return null;        // já tem esta sombra
  const t = statsTotais();
  const chance = clamp(BAL.sombras.chanceExtracao + t.sorte * BAL.sombras.chancePorSorte, 0, 0.95);
  if(Math.random() > chance) return null;
  const base = SOMBRAS_BASE[rank];
  const sombra = { rank, nome:base.nome, sprite:base.sprite, nivel:1, ativa:G.sombras.length < t.maxSombras };
  G.sombras.push(sombra);
  G.contadores.sombras++;
  guardar();
  return sombra;
}

function statsSombra(s){
  const base = SOMBRAS_BASE[s.rank], c = BAL.sombras.crescimentoPorNivel;
  const mult = (1 + G.base.altar * BAL.base.altarBonusPorNivel)              // Altar do Dom
             * ((typeof arvKeystone==='function' && arvKeystone('a_ks_dom')) ? 1.25 : 1); // Rei das Sombras
  return {
    atq: Math.round(base.atq*(1+s.nivel*c)*mult),
    hp:  Math.round(base.hp *(1+s.nivel*c)*mult),
  };
}

function custoSombra(s){ return s.nivel * 4 + IDX_RARIDADE_RANK(s.rank)*3; }
function IDX_RARIDADE_RANK(rank){ return ['E','D','C','B','A','S'].indexOf(rank); }

function subirSombra(s){
  const custo = custoSombra(s);
  if(G.cristais < custo) return {ok:false, msg:'Cristais insuficientes'};
  G.cristais -= custo; s.nivel++;
  guardar();
  return {ok:true};
}

function sombrasAtivas(){
  if(G.classe !== 'assassino') return [];
  const max = statsTotais().maxSombras;
  return G.sombras.filter(s=>s.ativa).slice(0, max);
}

/* multiplicador do Altar do Dom sobre a ultimate (classes sem sombras) */
function multAltarUlt(){
  return G.classe === 'assassino' ? 1 : 1 + G.base.altar * BAL.base.altarUltPorNivel;
}

/* ---------- Skins por paleta (D023) ---------- */
function comprarSkin(id){
  const s = SKINS.find(x=>x.id===id);
  if(!s || G.skins.includes(id)) return {ok:false, msg:'Já tens esta skin.'};
  if(G.cristais < s.preco) return {ok:false, msg:'Cristais insuficientes.'};
  G.cristais -= s.preco;
  G.skins.push(id);
  G.skinAtiva = id;
  guardar();
  return {ok:true, skin:s};
}
function ativarSkin(id){
  if(!G.skins.includes(id)) return false;
  G.skinAtiva = id; guardar(); return true;
}
/* tinta do sprite do Watcher: skin ativa, senão a cor da classe */
function corHeroi(){
  const s = SKINS.find(x=>x.id===G.skinAtiva);
  return (s && s.cor) ? s.cor : (typeof corClasse==='function' ? corClasse() : null);
}

/* ---------- Diário / eventos ---------- */
function hojeStr(){ return new Date().toISOString().slice(0,10); }

function verificarDiario(){
  const hoje = hojeStr();
  if(G.diario.data !== hoje){
    G.diario = { data:hoje, feitoDiaria:false, loginDado:false };
  }
  if(!G.diario.loginDado){
    G.diario.loginDado = true;
    G.ouro += 50 + G.nivel*5;
    G.cristais += 2;
    guardar();
    return true; // houve prémio de login
  }
  return false;
}

/* Masmorra diária: rank baseado no nível, recompensas x2 (1x por dia) */
function masmorraDiaria(){
  const elegiveis = MASMORRAS.filter(m=> m.nivelReq <= G.nivel && rankNaBeta(m.rank));
  const m = elegiveis[elegiveis.length-1] || MASMORRAS[0];
  // seed simples pelo dia para variar o nome
  const dia = parseInt(hojeStr().replace(/-/g,''),10);
  const nomes = ['Fenda Instável','Portal Vermelho','Brecha Dimensional','Portal do Eclipse'];
  return { ...m, nome:nomes[dia % nomes.length], diaria:true };
}

/* ---------- Stamina de masmorra ---------- */
function staminaMax(){ return BAL.stamina.max + G.base.reservatorio * BAL.base.reservatorioPorNivel; }

function staminaAtual(){
  if(MODO_TESTE) return staminaMax();         // teste: energia sempre cheia
  // regenera 1 ponto a cada X minutos reais desde a última atualização
  const max = staminaMax();
  const passou = Math.floor((Date.now() - G.stamina.ts) / (BAL.stamina.minutosPorPonto*60000));
  if(passou > 0 && G.stamina.v < max){
    G.stamina.v = Math.min(max, G.stamina.v + passou);
    G.stamina.ts += passou * BAL.stamina.minutosPorPonto * 60000;
    if(G.stamina.v >= max) G.stamina.ts = Date.now();
    guardar();
  }
  return Math.min(G.stamina.v, max);
}

function gastarStamina(n){
  if(MODO_TESTE) return true;                 // teste: não gasta energia
  if(staminaAtual() < n) return false;
  if(G.stamina.v >= staminaMax()) G.stamina.ts = Date.now(); // começa a contar regen
  G.stamina.v -= n;
  guardar();
  return true;
}

function minutosProximaStamina(){
  if(staminaAtual() >= staminaMax()) return 0;
  const decorrido = (Date.now() - G.stamina.ts) % (BAL.stamina.minutosPorPonto*60000);
  return Math.ceil((BAL.stamina.minutosPorPonto*60000 - decorrido) / 60000);
}

/* ---------- Base do jogador ---------- */
const BASE_DEFS = {
  forja:        { nome:'Forja da Base', emoji:'⚒️', desc:n=>`-${Math.round(n*BAL.base.forjaDescontoPorNivel*100)}% custo de forja` },
  altar:        { nome:'Altar do Dom',  emoji:'🕯️', desc:n=> G.classe==='assassino'
                    ? `+${Math.round(n*BAL.base.altarBonusPorNivel*100)}% stats das sombras`
                    : `+${Math.round(n*BAL.base.altarUltPorNivel*100)}% efeito da ultimate` },
  reservatorio: { nome:'Reservatório',  emoji:'⚡', desc:n=>`+${n*BAL.base.reservatorioPorNivel} stamina máxima` },
};

function custoMelhoriaBase(tipo){
  const n = G.base[tipo];
  if(n >= BAL.base.maxNivel) return null;
  return { ouro: BAL.base.custoOuro(n), cristais: BAL.base.custoCristais(n) };
}

function melhorarBase(tipo){
  const c = custoMelhoriaBase(tipo);
  if(!c) return {ok:false, msg:'Nível máximo.'};
  if(G.ouro < c.ouro) return {ok:false, msg:'Ouro insuficiente.'};
  if(G.cristais < c.cristais) return {ok:false, msg:'Cristais insuficientes.'};
  G.ouro -= c.ouro; G.cristais -= c.cristais;
  G.base[tipo]++;
  guardar();
  return {ok:true};
}

/* ---------- Runas ---------- */
function slotsRuna(){ return BAL.runas.slotsBase + (G.base.forja >= BAL.runas.slot2ForjaNivel ? 1 : 0); }
function runaEquipada(id){ return G.runasEq.slice(0, slotsRuna()).includes(id); }
function qtdRuna(id){ return G.runas[id] || 0; }

function ganharRuna(){
  const r = escolher(RUNAS);
  G.runas[r.id] = (G.runas[r.id]||0) + 1;
  guardar();
  return r;
}

function encaixarRuna(id, slot){
  if(slot >= slotsRuna() || qtdRuna(id) <= 0) return false;
  // a mesma runa não pode ocupar dois slots
  if(G.runasEq.includes(id) && G.runasEq[slot] !== id) return false;
  G.runasEq[slot] = id;
  guardar();
  return true;
}
function removerRuna(slot){ G.runasEq[slot] = null; guardar(); }

/* ---------- Despertar ---------- */
function despertarDisponivel(){
  const alvo = G.despertar;                       // próximo despertar (0→1, 1→2)
  if(alvo >= BAL.despertar.niveis.length) return false;
  return G.nivel >= BAL.despertar.niveis[alvo];
}

function masmorraDespertar(){
  // Provação: sala única contra um boss reforçado do rank adequado
  const rank = G.despertar === 0 ? 'C' : 'A';
  const m = MASMORRAS.find(x=>x.rank===rank);
  return { ...m, nome:`Provação do Despertar ${G.despertar+1}`, salas:1, despertar:true, ouro:[0,0] };
}

function rankPermitido(rank){
  const req = BAL.despertar.rankExige[rank];
  return !req || G.despertar >= req;
}

/* o rank está dentro do corte da beta? (D007) */
function rankNaBeta(rank){
  return !BAL.beta.ativa || IDX_RARIDADE_RANK(rank) <= IDX_RARIDADE_RANK(BAL.beta.rankMax);
}

/* ---------- Missões ---------- */
/* missões visíveis: sombras só para o Assassino (D010); ranks fora da beta escondem-se (D007) */
function missoesVisiveis(){
  return MISSOES.filter(m=>
    (m.tipo!=='sombras' || G.classe==='assassino') &&
    (m.tipo!=='clearRank' || rankNaBeta(m.rank)));
}
function progressoMissao(m){
  if(m.tipo === 'clearRank') return Math.min(G.clears[m.rank]||0, m.alvo);
  return Math.min(G.contadores[m.tipo]||0, m.alvo);
}
function missaoCumprida(m){ return progressoMissao(m) >= m.alvo; }
function missaoReclamada(m){ return G.missoesFeitas.includes(m.id); }

function reclamarMissao(m){
  if(!missaoCumprida(m) || missaoReclamada(m)) return false;
  G.missoesFeitas.push(m.id);
  if(m.rec.ouro) G.ouro += m.rec.ouro;
  if(m.rec.cristais) G.cristais += m.rec.cristais;
  guardar();
  return true;
}

/* ---------- Loja (stock diário, semeado pelo dia) ---------- */
function stockLoja(){
  const dia = parseInt(hojeStr().replace(/-/g,''),10);
  let semente = dia * 9301 + 49297;                 // PRNG determinístico do dia
  const rndS = ()=>{ semente = (semente*9301+49297) % 233280; return semente/233280; };
  const elegiveis = MASMORRAS.filter(m=>m.nivelReq <= G.nivel+4);
  const m = elegiveis[elegiveis.length-1] || MASMORRAS[0];
  const stock = [];
  for(let i=0;i<4;i++){
    const tipo = TIPOS_ITEM[Math.floor(rndS()*TIPOS_ITEM.length)];
    const ri = Math.min(RARIDADES.length-1, Math.floor(rndS()*rndS()*3) + (m.pesoLoot>1.5?1:0));
    const it = {
      id:'loja'+dia+'_'+i, tipo:tipo.id,
      nome:NOMES_ITEM[tipo.id][Math.floor(rndS()*NOMES_ITEM[tipo.id].length)],
      raridade:RARIDADES[ri].id,
      base:Math.round(6 + m.nivelMon*2.4 + rndS()*4),
      nivel:0, encante:null,
    };
    stock.push(it);
  }
  return stock;
}

function comprarItem(item){
  const preco = Math.round(valorItem(item) * BAL.economia.lojaMargem);
  if(G.ouro < preco) return {ok:false, msg:'Ouro insuficiente.'};
  if(G.diario.comprados && G.diario.comprados.includes(item.id)) return {ok:false, msg:'Esgotado por hoje.'};
  G.ouro -= preco;
  const novo = { ...item, id:G.proxId++ };
  G.inventario.push(novo);
  (G.diario.comprados = G.diario.comprados || []).push(item.id);
  guardar();
  return {ok:true, item:novo};
}

/* ---------- Camada de sincronização ----------
   Local por omissão. Para cloud real, substitui cloudGuardar/
   cloudCarregar por chamadas ao teu backend (ex.: Firebase). */
const Cloud = {
  async guardar(){ /* ponto de ligação: enviar exportarSave() para o backend */ return false; },
  async carregar(){ /* ponto de ligação: obter código do backend e importarSave() */ return null; },
};

/* ---------- Ranking ---------- */
function tabelaRanking(){
  const meu = poderTotal();
  const npcs = NPC_RANKING.map(([nome,fator])=>({
    nome, poder: Math.round(fator * (20 + meu*0.022) ), eu:false
  }));
  npcs.push({ nome:`${G.nome} (tu)`, poder:meu, eu:true });
  npcs.sort((a,b)=>b.poder-a.poder);
  return npcs;
}
