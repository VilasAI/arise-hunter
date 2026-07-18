/* ============ ESTADO E REGRAS DO JOGO ============ */
'use strict';

const SCHEMA_VERSAO = 4;   // versão da forma do save (migrações correm por comparação)

/* Modo de teste: abrir o link com ?teste (ou ?test) dá energia ilimitada,
   para poder jogar em contínuo à caça de bugs. Não afeta jogadores normais. */
const MODO_TESTE = /[?&](teste|test|debug)\b/i.test(location.search);
const LEGACY_SAVE_KEY = 'arise-hunter-save-v1';
const SAVE_KEY = MODO_TESTE ? 'arise-hunter-save-teste-v1' : LEGACY_SAVE_KEY;
const PROFILE_KEY = 'arise-hunter-profile-v1';
const PROFILE_SCHEMA = 1;
const MAX_PERSONAGENS = 3;

let G = null; // estado global do jogador
let PERFIL = null;
let SLOT_ATIVO = -1;
let cosmeticosSemPerfil = ['padrao']; // compatibilidade dos testes/exports antigos

function novoJogo(){
  return {
    schema:SCHEMA_VERSAO,
    personagemId:'',
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
    skinAtiva:'padrao',
    // runas / stamina / base
    runas:{}, runasEq:[null, null],
    stamina:{ v:BAL.stamina.max, ts:Date.now() },
    base:{ forja:0, altar:0, reservatorio:0 },
    // caça (D042/D043): troféus dos elites e catalisadores de fusão dos bosses
    marcas:0,
    catalisadores:{ nucleo:0, coracao:0 },
    // missões
    contadores:{ mortes:0, forjas:0, fusoes:0, sombras:0, poderes:0, despertar:0 },
    missoesFeitas:[],
    armaInicialDada:false,   // a Adaga do Watcher só se oferece uma vez (P2.13)
    criadoEm: Date.now(),
  };
}

/* Perfil isolado para testar todo o jogo sem alterar o progresso real. */
function novoJogoTeste(classe='guerreiro'){
  const g = novoJogo();
  g.nome = 'Watcher de Teste';
  g.nivel = 40; g.xp = 0; g.despertar = 2;
  g.ouro = 999999999; g.cristais = 999999999; g.pontos = 0;
  g.basicas = { for:80, vit:80, agi:80 };
  g.avancadas = { crit:20, critDano:40, sorte:20, roubo:10, pen:20, cdr:20 };
  g.clears = Object.fromEntries(MASMORRAS.map(m=>[m.rank, 1]));
  g.skinAtiva = 'padrao';
  g.runas = Object.fromEntries(RUNAS.map(r=>[r.id, 9]));
  g.runasEq = RUNAS.slice(0,2).map(r=>r.id);
  g.base = { forja:BAL.base.maxNivel, altar:BAL.base.maxNivel, reservatorio:BAL.base.maxNivel };
  g.stamina = { v:BAL.stamina.max, ts:Date.now() };
  g.marcas = 999;                                   // Bloco 7: loja e fusão testáveis
  g.catalisadores = { nucleo:99, coracao:99 };
  G = g;
  trocarClasseTeste(classe, false);
  return G;
}

function novoPerfil(){
  return {
    schema:PROFILE_SCHEMA,
    personagens:Array(MAX_PERSONAGENS).fill(null),
    ativo:-1,
    cosmeticos:['padrao'],
    compras:[],
    migracaoLegacy:null,
    criadoEm:Date.now(),
  };
}

function gerarIdPersonagem(){
  return 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}

function escaparHtml(v){
  return String(v??'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function cortarPontosCodigo(v,max){ return [...String(v??'')].slice(0,max).join(''); }
function nomeArmazenavel(v,def='Caçador'){
  if(typeof v!=='string') return def;
  const n=cortarPontosCodigo(v.trim(),16);
  return n || def;
}

function normalizarNomeComparacao(v){
  return String(v??'').trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-PT').replace(/\s+/gu,' ');
}

const NOMES_IMPROPRIOS = new Set([
  'puta','puto','caralho','merda','porra','foder','foda','fodase','cona','piroca','pila','cu',
  'paneleiro','cabrao','corno','vadia','boiola','racista','nazista','porno',
  'fuck','fucker','fucking','shit','bitch','cunt','asshole','dick','pussy','porn','nazi','hitler',
]);
const NOMES_IMPROPRIOS_COMPACTOS = ['nigger','nigga','faggot','retard','motherfucker'];
function normalizarImproprio(v){
  return normalizarNomeComparacao(v).normalize('NFKD')
    .replace(/[0]/g,'o').replace(/[1!|]/g,'i').replace(/[3]/g,'e').replace(/[4@]/g,'a')
    .replace(/[5$]/g,'s').replace(/[7]/g,'t').replace(/[8]/g,'b').replace(/[9]/g,'g');
}
function nomeImproprio(v){
  const n=normalizarImproprio(v).replace(/([a-z])\1{2,}/g,'$1'), tokens=n.match(/[\p{L}\p{N}]+/gu)||[];
  if(tokens.some(t=>NOMES_IMPROPRIOS.has(t))) return true;
  const compacto=tokens.join('');
  if(tokens.length>1 && NOMES_IMPROPRIOS.has(compacto)) return true;
  return NOMES_IMPROPRIOS_COMPACTOS.some(p=>compacto.includes(p));
}

function validarNomePersonagem(v,ignorarSlot=-1){
  if(typeof v!=='string') return {ok:false,msg:'Escreve um nome.'};
  const nome=v.trim();
  if(!nome || !/[^\p{Z}\s]/u.test(nome)) return {ok:false,msg:'Escreve um nome.'};
  if([...nome].length>16) return {ok:false,msg:'O nome pode ter no máximo 16 caracteres.'};
  if(/[\p{Cc}\p{Cf}]/u.test(nome)) return {ok:false,msg:'O nome contém caracteres invisíveis.'};
  if(nomeImproprio(nome)) return {ok:false,msg:'Este nome não é permitido.'};
  const chave=normalizarNomeComparacao(nome);
  if(PERFIL?.personagens?.some((p,i)=>i!==ignorarSlot && p && normalizarNomeComparacao(p.nome)===chave))
    return {ok:false,msg:'Já tens uma personagem com esse nome.'};
  return {ok:true,nome};
}

function cosmeticosDoPerfil(){
  if(MODO_TESTE) return SKINS.map(s=>s.id);
  return PERFIL?.cosmeticos || cosmeticosSemPerfil;
}
function temCosmetico(id){ return cosmeticosDoPerfil().includes(id); }

/* ---------- Gravação (local + exportável) ---------- */
let avisoGuardarTs = 0;
function gravarLocal(chave,valor){
  try{ localStorage.setItem(chave, JSON.stringify(valor)); return true; }
  catch(e){
    // sem quota/armazenamento: avisa (no máx. 1×/min) em vez de fingir que guardou
    if(Date.now() - avisoGuardarTs > 60000){
      avisoGuardarTs = Date.now();
      if(typeof toast === 'function') toast('⚠️ Não deu para guardar o progresso — liberta armazenamento do site.');
    }
    return false;
  }
}
function guardar(){
  if(MODO_TESTE) return gravarLocal(SAVE_KEY,G);
  if(PERFIL){
    if(SLOT_ATIVO>=0 && SLOT_ATIVO<MAX_PERSONAGENS && G){
      PERFIL.personagens[SLOT_ATIVO]=G;
      PERFIL.ativo=SLOT_ATIVO;
    }
    return gravarLocal(PROFILE_KEY,PERFIL);
  }
  // Mantém o contrato dos saves avulsos e dos testes antigos.
  return gravarLocal(SAVE_KEY,G);
}

/* Migra saves de sistemas antigos. Corre sobre o objeto BRUTO do JSON,
   antes de qualquer default — com defaults já aplicados, as verificações
   de «campo em falta» nunca disparavam e a migração era saltada. */
function migrarSave(obj){
  // sistema antigo FOR/AGI/VIT/INT → devolve os pontos para redistribuição
  if(obj.stats && obj.stats.for !== undefined && !obj.basicas){
    obj.basicas  = { for:0, vit:0, agi:0 };
    obj.avancadas= { crit:0, critDano:0, sorte:0, roubo:0, pen:0, cdr:0 };
    obj.pontos = Math.max(0, (obj.nivel-1) * BAL.jogador.pontosPorNivel);
    delete obj.stats;
    obj._migrado = true;
  }
  if(typeof obj.pontosHabUsados !== 'number') obj.pontosHabUsados = 0;
  for(const it of (Array.isArray(obj.inventario) ? obj.inventario : [])){
    if(it && it.encante && it.encante.stat === 'int') it.encante.stat = 'sorte';
  }
  // D010/D011: «Exército de Sombras» virou ultimate — devolve os pontos gastos
  if(obj.poderes && obj.poderes.sombras){
    obj.pontosHabUsados = Math.max(0, obj.pontosHabUsados - pontosInvestidos(obj.poderes.sombras.tier));
    delete obj.poderes.sombras;
    obj._sombrasMigradas = true;
  }
  // D010: sombras exclusivas do Assassino — compensa as outras classes em cristais
  // (reembolso integral dos níveis comprados na era dos cristais — P2.11)
  if(obj.classe && obj.classe !== 'assassino' && Array.isArray(obj.sombras) && obj.sombras.length){
    obj.cristais = (obj.cristais||0) + obj.sombras.reduce((a,s)=> a + compensacaoSombra(s.nivel, s.rank), 0);
    obj.sombras = [];
    obj._sombrasMigradas = true;
  }
  // schema 3 (D023 v2): as skins por paleta deram lugar às aparências por sprite — reembolsa
  if((obj.schema||1) < 3 && Array.isArray(obj.skins)){
    const PALETAS = { carmesim:120, abissal:120, esmeralda:120, aurora:150, gelo:150 };
    for(const id of obj.skins) if(PALETAS[id]) obj.cristais = (obj.cristais||0) + PALETAS[id];
    obj.skins = obj.skins.filter(id => !PALETAS[id]);
  }
  // schema 4 (D032): cristais deixam de comprar poder — reembolsa o que foi gasto neles:
  // encantamentos, níveis de sombras (que se mantêm) e a componente em cristais da base
  if((obj.schema||1) < 4){
    let devolver = 0;
    for(const it of (Array.isArray(obj.inventario) ? obj.inventario : []))
      if(it && it.encante) devolver += 3;                       // encanteCristais da era anterior
    for(const s of (Array.isArray(obj.sombras) ? obj.sombras : [])){
      const n = Math.max(1, s && s.nivel || 1), idx = Math.max(0, IDX_RARIDADE_RANK(s && s.rank));
      devolver += 2*n*(n-1) + 3*idx*(n-1);                      // Σ custos de nível (4l + 3·idx)
    }
    if(ehObjeto(obj.base)) for(const tipo of ['forja','altar','reservatorio']){
      const nv = Math.min(BAL.base.maxNivel, Math.max(0, Math.floor(obj.base[tipo]||0)));
      for(let i=0;i<nv;i++) devolver += 5*(i+1);                // custoCristais da era anterior
    }
    if(devolver > 0){
      obj.cristais = (obj.cristais||0) + devolver;
      obj._d032 = devolver;
    }
  }
  return obj;
}

/* cristais investidos numa sombra na era dos cristais: 4 de base
   + reembolso integral dos níveis comprados, Σ(4·l + 3·idx) (P2.11) */
function compensacaoSombra(nivel, rank){
  const n = Math.max(1, nivel||1);
  const idx = Math.max(0, IDX_RARIDADE_RANK(rank));
  return 4 + 2*n*(n-1) + 3*idx*(n-1);
}

/* ---------- Validação profunda do save ----------
   Reconstrói o estado campo a campo sobre o modelo de novoJogo():
   tipos errados voltam ao default, referências (itens, poderes, runas,
   skins…) têm de existir no jogo. O nome preserva os caracteres visíveis
   escolhidos pelo jogador e é sempre escapado pela UI. */
function ehObjeto(v){ return !!v && typeof v==='object' && !Array.isArray(v); }
function vNum(v, def, min, max){
  if(typeof v!=='number' || !isFinite(v)) v = def;
  if(min!==undefined) v = Math.max(min, v);
  if(max!==undefined) v = Math.min(max, v);
  return v;
}
function vInt(v, def, min, max){ return Math.round(vNum(v, def, min, max)); }
function vTexto(v, def, max){
  if(typeof v!=='string') return def;
  return v.replace(/[<>&"']/g,'').slice(0, max||60) || def;
}
function vNums(v, def){   // objeto de números com as chaves fixas do modelo
  const o = {};
  for(const k of Object.keys(def)) o[k] = vNum(ehObjeto(v) ? v[k] : undefined, def[k], 0);
  return o;
}
const ID_SIMPLES = /^[a-z0-9_]{1,32}$/;

function normalizarSave(o){
  const g = novoJogo();
  g.personagemId = (typeof o.personagemId==='string' && /^[a-z0-9_\-]{4,80}$/i.test(o.personagemId)) ? o.personagemId : '';
  g.nome      = nomeArmazenavel(o.nome, g.nome);
  g.classe    = (typeof o.classe==='string' && CLASSES[o.classe]) ? o.classe : null;
  g.nivel     = vInt(o.nivel, 1, 1, 999);
  g.xp        = vNum(o.xp, 0, 0);
  g.pontos    = vInt(o.pontos, 0, 0);
  g.despertar = vInt(o.despertar, 0, 0, BAL.despertar.niveis.length);
  g.ouro      = vNum(o.ouro, g.ouro, 0);
  g.cristais  = vNum(o.cristais, g.cristais, 0);
  g.basicas    = vNums(o.basicas, g.basicas);
  g.avancadas  = vNums(o.avancadas, g.avancadas);
  g.base       = vNums(o.base, g.base);
  g.contadores = vNums(o.contadores, g.contadores);
  g.marcas       = vInt(o.marcas, 0, 0);
  g.catalisadores= vNums(o.catalisadores, g.catalisadores);
  g.auto = !!o.auto;

  // inventário: só itens com tipo e raridade reconhecidos
  for(const it of (Array.isArray(o.inventario) ? o.inventario : [])){
    if(!ehObjeto(it) || !NOMES_ITEM[it.tipo] || IDX_RARIDADE[it.raridade]===undefined) continue;
    g.inventario.push({
      id: vInt(it.id, 0, 0),
      tipo: it.tipo,
      nome: vTexto(it.nome, NOMES_ITEM[it.tipo][it.raridade][0], 40),
      raridade: it.raridade,
      base: vNum(it.base, 6, 1, 9999),
      nivel: vInt(it.nivel, 0, 0, 99),
      encante: ehObjeto(it.encante) ? {
        stat: vTexto(it.encante.stat, 'sorte', 12),
        nome: vTexto(it.encante.nome, '', 30),
        valor: vNum(it.encante.valor, 0, 0, 999),
      } : null,
    });
  }
  g.proxId = Math.max(vInt(o.proxId, 1, 1), ...g.inventario.map(i=>i.id+1));
  for(const slot of Object.keys(g.equipado)){
    const id = ehObjeto(o.equipado) ? o.equipado[slot] : null;
    const it = g.inventario.find(i=>i.id===id);
    g.equipado[slot] = (it && it.tipo===slot) ? id : null;
  }

  // sombras: uma por rank, nome e sprite sempre os canónicos
  for(const s of (Array.isArray(o.sombras) ? o.sombras : [])){
    if(!ehObjeto(s) || !SOMBRAS_BASE[s.rank] || g.sombras.some(x=>x.rank===s.rank)) continue;
    g.sombras.push({ rank:s.rank, nome:SOMBRAS_BASE[s.rank].nome, sprite:SOMBRAS_BASE[s.rank].sprite,
                     nivel:vInt(s.nivel, 1, 1, 99), ativa:!!s.ativa });
  }

  if(ehObjeto(o.clears)) for(const r of Object.keys(o.clears)){
    if(IDX_RARIDADE_RANK(r) >= 0) g.clears[r] = vInt(o.clears[r], 0, 0);
  }

  const dia = ehObjeto(o.diario) ? o.diario : {};
  g.diario = { data:vTexto(dia.data, '', 10), feitoDiaria:!!dia.feitoDiaria, loginDado:!!dia.loginDado };
  if(Array.isArray(dia.comprados)) g.diario.comprados = dia.comprados.filter(x=>typeof x==='string' && ID_SIMPLES.test(x));

  // poderes: só os que existem, tier e talento dentro dos limites
  g.poderes = {};
  if(ehObjeto(o.poderes)) for(const id of Object.keys(o.poderes)){
    const p = o.poderes[id];
    if(!PODERES[id] || !ehObjeto(p)) continue;
    g.poderes[id] = {
      tier: vInt(p.tier, 1, 1, BAL.tiersPoder.length),
      talento: (Number.isInteger(p.talento) && PODERES[id].talentos && PODERES[id].talentos[p.talento]) ? p.talento : null,
    };
  }
  if(!Object.keys(g.poderes).length){
    const ini = g.classe ? CLASSES[g.classe].inicial : 'lamina';
    g.poderes[ini] = { tier:1, talento:null };
  }
  g.equipadosPoder = [null, null, null];
  const eq = Array.isArray(o.equipadosPoder) ? o.equipadosPoder : [];
  for(let i=0;i<3;i++){
    const id = eq[i];
    if(typeof id==='string' && g.poderes[id] && PODERES[id].tipo==='ativo' && !g.equipadosPoder.includes(id)) g.equipadosPoder[i] = id;
  }
  g.pontosHabUsados = vInt(o.pontosHabUsados, 0, 0, Math.floor(g.nivel / BAL.poderes.nivelPorPonto));

  if(ehObjeto(o.arvore) && ehObjeto(o.arvore.nos)) for(const k of Object.keys(o.arvore.nos)){
    if(ID_SIMPLES.test(k) && o.arvore.nos[k]) g.arvore.nos[k] = true;
  }
  g.arvore.respecs = vInt(ehObjeto(o.arvore) ? o.arvore.respecs : 0, 0, 0);

  const skin=SKINS.find(s=>s.id===o.skinAtiva);
  g.skinAtiva = (skin && (!skin.classe || skin.classe===g.classe)) ? skin.id : 'padrao';

  if(ehObjeto(o.runas)) for(const r of RUNAS){
    if(o.runas[r.id] !== undefined) g.runas[r.id] = vInt(o.runas[r.id], 0, 0, 999);
  }
  g.runasEq = [null, null];
  const rEq = Array.isArray(o.runasEq) ? o.runasEq : [];
  for(let i=0;i<2;i++){
    const id = rEq[i];
    if(typeof id==='string' && (g.runas[id]||0) > 0 && !g.runasEq.includes(id)) g.runasEq[i] = id;
  }

  const st = ehObjeto(o.stamina) ? o.stamina : {};
  g.stamina = { v: vNum(st.v, g.stamina.v, 0, 999), ts: vNum(st.ts, Date.now(), 0) };

  g.missoesFeitas = (Array.isArray(o.missoesFeitas) ? o.missoesFeitas : []).filter(id => MISSOES.some(m=>m.id===id));
  // saves anteriores à flag: quem já tem itens ou nível já recebeu a arma inicial (P2.13)
  g.armaInicialDada = !!o.armaInicialDada || g.inventario.length > 0 || g.nivel > 1;
  g.criadoEm = vNum(o.criadoEm, Date.now(), 0);

  // avisos de migração pendentes (a UI mostra-os e apaga-os)
  if(o._migrado) g._migrado = true;
  if(o._sombrasMigradas) g._sombrasMigradas = true;
  if(o._d032) g._d032 = vInt(o._d032, 0, 0);
  if(o._precisaNome) g._precisaNome = true;
  return g;
}

/* migra o objeto bruto e valida em profundidade; lança se não for um save */
function prepararSave(obj){
  if(!ehObjeto(obj) || typeof obj.nivel !== 'number' || !isFinite(obj.nivel)) throw new Error('save inválido');
  return normalizarSave(migrarSave(obj));
}

/* save ilegível: guarda uma cópia intacta em vez de o perder em silêncio */
function quarentenarSave(raw,chave=SAVE_KEY){
  try{ localStorage.setItem(chave+'-quarentena', raw); }catch(e){}
}

function extrairCosmeticosLegados(obj){
  const ids=['padrao'];
  for(const id of (Array.isArray(obj?.skins)?obj.skins:[]))
    if(SKINS.some(s=>s.id===id) && !ids.includes(id)) ids.push(id);
  if(typeof obj?.skinAtiva==='string' && SKINS.some(s=>s.id===obj.skinAtiva) && !ids.includes(obj.skinAtiva)) ids.push(obj.skinAtiva);
  return ids;
}

function normalizarPerfil(obj){
  const p=novoPerfil();
  if(!ehObjeto(obj)) return p;
  p.criadoEm=vNum(obj.criadoEm,p.criadoEm,0);
  p.compras=(Array.isArray(obj.compras)?obj.compras:[]).filter(x=>typeof x==='string' && x.length<=80);
  for(const id of (Array.isArray(obj.cosmeticos)?obj.cosmeticos:[]))
    if(SKINS.some(s=>s.id===id) && !p.cosmeticos.includes(id)) p.cosmeticos.push(id);
  const slots=Array.isArray(obj.personagens)?obj.personagens:[];
  for(let i=0;i<MAX_PERSONAGENS;i++){
    const bruto=slots[i]; if(!ehObjeto(bruto)) continue;
    try{
      for(const id of extrairCosmeticosLegados(bruto)) if(!p.cosmeticos.includes(id)) p.cosmeticos.push(id);
      const g=prepararSave(bruto);
      if(!g.personagemId) g.personagemId=gerarIdPersonagem();
      if(bruto._precisaNome) g._precisaNome=true;
      p.personagens[i]=g;
    }catch(e){}
  }
  for(const g of p.personagens){
    if(!g) continue;
    if(!p.cosmeticos.includes(g.skinAtiva)) g.skinAtiva='padrao';
  }
  p.ativo=vInt(obj.ativo,-1,-1,MAX_PERSONAGENS-1);
  if(!p.personagens[p.ativo]) p.ativo=p.personagens.findIndex(Boolean);
  p.migracaoLegacy=ehObjeto(obj.migracaoLegacy) ? {
    estado:vTexto(obj.migracaoLegacy.estado,'pendente',16),
    backupKey:vTexto(obj.migracaoLegacy.backupKey,LEGACY_SAVE_KEY+'-backup-migracao-perfil',80),
  } : null;
  return p;
}

function migrarLegacyParaPerfil(p){
  let raw=null;
  try{ raw=localStorage.getItem(LEGACY_SAVE_KEY); }catch(e){}
  if(!raw) return false;
  try{
    const bruto=JSON.parse(raw), migrado=migrarSave(bruto);
    for(const id of extrairCosmeticosLegados(migrado)) if(!p.cosmeticos.includes(id)) p.cosmeticos.push(id);
    const g=normalizarSave(migrado);
    if(!g.personagemId) g.personagemId=gerarIdPersonagem();
    const original=typeof bruto.nome==='string'?bruto.nome.trim():'';
    if(!original || original==='Caçador' || nomeImproprio(original) || /[\p{Cc}\p{Cf}]/u.test(original)) g._precisaNome=true;
    if(!p.cosmeticos.includes(g.skinAtiva)) g.skinAtiva='padrao';
    p.personagens[0]=g; p.ativo=0;
    const backupKey=LEGACY_SAVE_KEY+'-backup-migracao-perfil';
    try{ if(!localStorage.getItem(backupKey)) localStorage.setItem(backupKey,raw); }catch(e){}
    p.migracaoLegacy={estado:'pendente',backupKey};
    return true;
  }catch(e){ quarentenarSave(raw,LEGACY_SAVE_KEY); return false; }
}

function carregar(){
  if(MODO_TESTE){
    let raw=null; try{ raw=localStorage.getItem(SAVE_KEY); }catch(e){}
    if(raw){
      try{ G=prepararSave(JSON.parse(raw)); guardar(); return true; }
      catch(e){ quarentenarSave(raw); }
    }
    G=novoJogo(); return false;
  }
  let rawPerfil=null;
  try{ rawPerfil=localStorage.getItem(PROFILE_KEY); }catch(e){}
  if(rawPerfil){
    try{ PERFIL=normalizarPerfil(JSON.parse(rawPerfil)); }
    catch(e){ quarentenarSave(rawPerfil,PROFILE_KEY); PERFIL=novoPerfil(); }
  } else {
    PERFIL=novoPerfil();
    migrarLegacyParaPerfil(PERFIL);
  }
  SLOT_ATIVO=PERFIL.ativo;
  G=SLOT_ATIVO>=0 && PERFIL.personagens[SLOT_ATIVO] ? PERFIL.personagens[SLOT_ATIVO] : novoJogo();
  guardar();
  return SLOT_ATIVO>=0;
}

function listarPersonagens(){
  if(MODO_TESTE) return [G,null,null];
  return PERFIL?.personagens || Array(MAX_PERSONAGENS).fill(null);
}

function selecionarPersonagem(indice){
  if(MODO_TESTE) return {ok:true,personagem:G};
  const g=PERFIL?.personagens?.[indice];
  if(!g) return {ok:false,msg:'Esta posição está vazia.'};
  if(g._precisaNome) return {ok:false,precisaNome:true,personagem:g};
  SLOT_ATIVO=indice; PERFIL.ativo=indice; G=g;
  if(PERFIL.migracaoLegacy?.estado==='pendente') PERFIL.migracaoLegacy.estado='validada';
  guardar();
  return {ok:true,personagem:G};
}

function criarPersonagem(indice,nome,classe,skinAtiva='padrao'){
  if(MODO_TESTE || !Number.isInteger(indice) || indice<0 || indice>=MAX_PERSONAGENS) return {ok:false,msg:'Posição inválida.'};
  if(!PERFIL) PERFIL=novoPerfil();
  if(PERFIL.personagens[indice]) return {ok:false,msg:'Esta posição já está ocupada.'};
  const vn=validarNomePersonagem(nome);
  if(!vn.ok) return vn;
  if(!CLASSES[classe]) return {ok:false,msg:'Escolhe uma classe.'};
  const skin=SKINS.find(s=>s.id===skinAtiva);
  if(!skin || !temCosmetico(skin.id) || (skin.classe && skin.classe!==classe)) skinAtiva='padrao';
  G=novoJogo(); G.personagemId=gerarIdPersonagem(); G.nome=vn.nome;
  SLOT_ATIVO=indice; PERFIL.ativo=indice; PERFIL.personagens[indice]=G;
  escolherClasse(classe);
  G.skinAtiva=skinAtiva;
  guardar();
  return {ok:true,personagem:G};
}

function definirNomeMigrado(indice,nome){
  const g=PERFIL?.personagens?.[indice];
  if(!g?._precisaNome) return {ok:false,msg:'Este nome já é permanente.'};
  const vn=validarNomePersonagem(nome,indice); if(!vn.ok) return vn;
  g.nome=vn.nome; delete g._precisaNome;
  SLOT_ATIVO=indice; PERFIL.ativo=indice; G=g;
  if(PERFIL.migracaoLegacy) PERFIL.migracaoLegacy.estado='validada';
  guardar();
  return {ok:true,personagem:g};
}

function eliminarPersonagem(indice,confirmacao){
  if(MODO_TESTE) return {ok:false,msg:'A conta de teste não pertence ao perfil.'};
  const g=PERFIL?.personagens?.[indice];
  if(!g) return {ok:false,msg:'Esta posição já está vazia.'};
  const nomeConfirmacao=g._precisaNome?'Nome por escolher':g.nome;
  if(confirmacao!==nomeConfirmacao) return {ok:false,msg:'Escreve o nome exatamente como aparece.'};
  const id=g.personagemId;
  PERFIL.personagens[indice]=null;
  if(SLOT_ATIVO===indice){ SLOT_ATIVO=-1; PERFIL.ativo=-1; G=novoJogo(); }
  else if(PERFIL.ativo===indice) PERFIL.ativo=-1;
  guardar();
  if(typeof Cloud!=='undefined' && Cloud.apagarPersonagem) Cloud.apagarPersonagem(id).catch(()=>{});
  return {ok:true};
}

async function validarNomeServidor(nome,ignorarSlot=-1){
  const local=validarNomePersonagem(nome,ignorarSlot); if(!local.ok) return local;
  if(typeof Cloud!=='undefined' && Cloud.validarNome){
    try{ const remoto=await Cloud.validarNome(local.nome); if(remoto && !remoto.ok) return remoto; }catch(e){}
  }
  return local;
}

function apagarSave(){
  if(MODO_TESTE){ localStorage.removeItem(SAVE_KEY); G=novoJogo(); return; }
  if(SLOT_ATIVO>=0 && PERFIL?.personagens?.[SLOT_ATIVO]){
    const i=SLOT_ATIVO; PERFIL.personagens[i]=null; SLOT_ATIVO=-1; PERFIL.ativo=-1; G=novoJogo(); guardar();
  }
}

function exportarSave(){
  const pacote={formato:'vigilia-personagem-v1',personagem:G,cosmeticos:cosmeticosDoPerfil()};
  return btoa(unescape(encodeURIComponent(JSON.stringify(pacote))));
}
function importarSave(codigo){
  try{
    const bruto=JSON.parse(decodeURIComponent(escape(atob(codigo.trim()))));
    const pacote=bruto?.formato==='vigilia-personagem-v1' ? bruto : {personagem:bruto,cosmeticos:extrairCosmeticosLegados(bruto)};
    const importado=prepararSave(pacote.personagem);
    if(!MODO_TESTE && PERFIL && SLOT_ATIVO>=0){
      if(G.classe && importado.classe!==G.classe) return false;
      importado.personagemId=G.personagemId;
      importado.nome=G.nome;
    }
    G=importado;
    if(!MODO_TESTE && PERFIL) for(const id of (Array.isArray(pacote.cosmeticos)?pacote.cosmeticos:[]))
      if(SKINS.some(s=>s.id===id) && !PERFIL.cosmeticos.includes(id)) PERFIL.cosmeticos.push(id);
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
  const r = n>=34?'S' : n>=24?'A' : n>=16?'B' : n>=10?'C' : n>=5?'D' : 'E';
  return rankNaBeta(r) ? r : BAL.beta.rankMax;   // na beta, o rank do caçador também corta (P2.1)
}

/* ---------- Itens ---------- */
function itemPorId(id){ return G.inventario.find(i=>i.id===id) || null; }

function valorItem(it){
  const r = RARIDADES[IDX_RARIDADE[it.raridade]];
  return Math.round(it.base * r.mult * (1 + it.nivel*0.18));
}

function gerarItem(pesoLoot, nivelMon, teto){
  // tabela inclinada pelo pesoLoot (D039) e cortada no teto do rank (D041)
  const iTeto = IDX_RARIDADE[teto] !== undefined ? IDX_RARIDADE[teto] : RARIDADES.length-1;
  const topo = RARIDADES.length-1;
  const pesos = RARIDADES.map((r,i)=>
    i > iTeto ? 0 : r.peso * Math.pow(BAL.loot.crescimento, pesoLoot * i/topo));
  let total = pesos.reduce((a,b)=>a+b,0), tiro = Math.random()*total, idx = 0;
  for(let i=0;i<pesos.length;i++){ tiro -= pesos[i]; if(tiro<=0){ idx=i; break; } }
  const tipo = escolher(TIPOS_ITEM);
  const raridade = RARIDADES[idx].id;
  return {
    id: G.proxId++,
    tipo: tipo.id,
    nome: escolher(NOMES_ITEM[tipo.id][raridade]),
    raridade,
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
  if(G.ouro < CUSTO_ENCANTE) return {ok:false, msg:'Ouro insuficiente'};   // D032: poder compra-se com ouro
  G.ouro -= CUSTO_ENCANTE;
  const e = escolher(ENCANTAMENTOS);
  const r = IDX_RARIDADE[it.raridade];
  it.encante = { stat:e.stat, nome:e.nome, valor: rndInt(2,5) + r*2 };
  guardar();
  return {ok:true, msg:`Encantado: ${it.nome} ${e.nome} (+${it.encante.valor})`};
}

/* Regras para fundir A PARTIR de uma raridade (D042): quantidade, ouro e
   catalisador dependem da raridade-alvo. Devolve null no topo da escada. */
function regrasFusao(raridade){
  const ri = IDX_RARIDADE[raridade];
  if(ri === undefined || ri >= RARIDADES.length-1) return null;
  const alvo = RARIDADES[ri+1].id;
  return { alvo, ...BAL.economia.fusao[alvo] };
}

function fundir(ids){
  const itens = [...new Set(ids)].map(itemPorId).filter(Boolean);
  if(!itens.length) return {ok:false, msg:'Escolhe itens para fundir.'};
  const r = itens[0].raridade, tipo = itens[0].tipo;
  if(!itens.every(i=>i.raridade===r && i.tipo===tipo)) return {ok:false, msg:'Têm de ser do mesmo tipo e raridade.'};
  const regra = regrasFusao(r);
  if(!regra) return {ok:false, msg:'Raridade máxima — não dá para fundir.'};
  if(itens.length !== regra.qtd) return {ok:false, msg:`Escolhe ${regra.qtd} itens iguais.`};
  if(G.ouro < regra.ouro) return {ok:false, msg:'Ouro insuficiente.'};
  if(regra.catalisador && (G.catalisadores[regra.catalisador]||0) < 1)
    return {ok:false, msg:`Falta 1 ${CATALISADORES[regra.catalisador].nome}.`};
  const usados = itens.map(i=>i.id);
  const base = Math.max(...itens.map(i=>i.base));
  G.ouro -= regra.ouro;
  if(regra.catalisador) G.catalisadores[regra.catalisador]--;
  G.inventario = G.inventario.filter(i=>!usados.includes(i.id));
  for(const s of Object.keys(G.equipado)) if(usados.includes(G.equipado[s])) G.equipado[s]=null;
  const novo = {
    id:G.proxId++, tipo, nome:escolher(NOMES_ITEM[tipo][regra.alvo]),
    raridade:regra.alvo, base:Math.round(base*1.15), nivel:0, encante:null,
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
  const sombra = { rank, nome:base.nome, sprite:base.sprite, nivel:1,
                   ativa: G.sombras.filter(x=>x.ativa).length < t.maxSombras };   // conta as ATIVAS (P3)
  G.sombras.push(sombra);
  G.contadores.sombras++;
  guardar();
  return sombra;
}

/* sombras são incorpóreas (D033): só têm ataque, nunca HP */
function statsSombra(s){
  const base = SOMBRAS_BASE[s.rank], c = BAL.sombras.crescimentoPorNivel;
  const mult = (1 + G.base.altar * BAL.base.altarBonusPorNivel)              // Altar do Dom
             * ((typeof arvKeystone==='function' && arvKeystone('a_ks_dom')) ? 1.25 : 1); // Rei das Sombras
  return { atq: Math.round(base.atq*(1+s.nivel*c)*mult) };
}

/* D032: subir de nível custa OURO (cristais nunca compram poder) */
function custoSombra(s){ return (s.nivel * 4 + IDX_RARIDADE_RANK(s.rank)*3) * 50; }
function IDX_RARIDADE_RANK(rank){ return ['E','D','C','B','A','S'].indexOf(rank); }

function subirSombra(s){
  const custo = custoSombra(s);
  if(G.ouro < custo) return {ok:false, msg:'Ouro insuficiente'};
  G.ouro -= custo; s.nivel++;
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

/* ---------- Skins do Watcher (D023 v2: sprites por classe) ---------- */
function comprarSkin(id){
  const s = SKINS.find(x=>x.id===id);
  if(!s || temCosmetico(id)) return {ok:false, msg:'Já tens esta skin.'};
  if(s.classe && s.classe !== G.classe) return {ok:false, msg:'Essa aparência é de outra classe.'};
  if(G.cristais < s.preco) return {ok:false, msg:'Cristais insuficientes.'};
  G.cristais -= s.preco;
  const colecao=cosmeticosDoPerfil();
  if(!colecao.includes(id)) colecao.push(id);
  G.skinAtiva = id;
  guardar();
  return {ok:true, skin:s};
}
function ativarSkin(id){
  const s=SKINS.find(x=>x.id===id);
  if(!s || !temCosmetico(id) || (s.classe && s.classe!==G.classe)) return false;
  G.skinAtiva = id; guardar(); return true;
}
/* spritesheet do Watcher em combate: classe + aparência vestida (fallback: antigo) */
function baseHeroi(){
  const cl = G.classe || 'guerreiro';
  const nome = (G.skinAtiva === cl+'2') ? 'heroi_'+cl+'2' : 'heroi_'+cl;
  return (typeof SPR !== 'undefined' && SPR.ok(nome+'_idle')) ? nome : 'soldier';
}

/* ---------- Diário / eventos ---------- */
/* dia LOCAL do jogador — com UTC, em Portugal no verão o dia virava à 01:00 (P2.8) */
function hojeStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

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

/* Masmorra diária: rank mais alto realmente desbloqueado. A seed local fixa a
   composição durante todas as tentativas do mesmo dia. */
function masmorraDiaria(){
  const elegiveis = MASMORRAS.filter(m=>
    m.nivelReq <= G.nivel && rankNaBeta(m.rank) && rankPermitido(m.rank));
  const m = elegiveis[elegiveis.length-1] || MASMORRAS[0];
  const dia = parseInt(hojeStr().replace(/-/g,''),10);
  const nomes = ['Fenda Instável','Portal Vermelho','Brecha Dimensional','Portal do Eclipse'];
  return { ...m, nome:nomes[dia % nomes.length], diaria:true,
           seedDiaria:dia, recompensaMultiplicador:3 };
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

function custoStaminaMasmorra(m){
  if(!m || m.diaria || m.despertar) return 0;
  return BAL.stamina.custoPorRank[m.rank] ?? BAL.stamina.custoPorRank.S;
}

function devolverStamina(n){
  if(MODO_TESTE || n<=0) return;
  G.stamina.v = Math.min(staminaMax(), staminaAtual()+n);
  if(G.stamina.v >= staminaMax()) G.stamina.ts = Date.now();
  guardar();
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
  return { ouro: BAL.base.custoOuro(n) };   // D032: a base melhora-se só com ouro
}

function melhorarBase(tipo){
  const c = custoMelhoriaBase(tipo);
  if(!c) return {ok:false, msg:'Nível máximo.'};
  if(G.ouro < c.ouro) return {ok:false, msg:'Ouro insuficiente.'};
  G.ouro -= c.ouro;
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
  // a Provação decorre numa masmorra C (1.º) ou A (2.º) — fora da beta não abre (P2.1)
  if(!rankNaBeta(alvo === 0 ? 'C' : 'A')) return false;
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

/* ---------- Loja (stock diário, semeado pelo dia) ----------
   Teto a ouro: Épico (D043). Em dias especiais da seed aparece um Lendário
   pago só em Marcas de Caça. O parâmetro dia existe para os testes. */
function stockLoja(dia = parseInt(hojeStr().replace(/-/g,''),10)){
  let semente = dia * 9301 + 49297;                 // PRNG determinístico do dia
  const rndS = ()=>{ semente = (semente*9301+49297) % 233280; return semente/233280; };
  const elegiveis = MASMORRAS.filter(m=> m.nivelReq <= G.nivel+4 && rankNaBeta(m.rank));   // (P2.1)
  const m = elegiveis[elegiveis.length-1] || MASMORRAS[0];
  const itemLoja = (id, ri)=>{
    const tipo = TIPOS_ITEM[Math.floor(rndS()*TIPOS_ITEM.length)];
    const nomes = NOMES_ITEM[tipo.id][RARIDADES[ri].id];
    return {
      id, tipo:tipo.id,
      nome:nomes[Math.floor(rndS()*nomes.length)],
      raridade:RARIDADES[ri].id,
      base:Math.round(6 + m.nivelMon*2.4 + rndS()*4),
      nivel:0, encante:null,
    };
  };
  const stock = [];
  for(let i=0;i<4;i++){
    const ri = Math.min(IDX_RARIDADE.epico, IDX_RARIDADE[m.teto],
                        Math.floor(rndS()*rndS()*3) + (m.pesoLoot>1.5?1:0));
    stock.push(itemLoja('loja'+dia+'_'+i, ri));
  }
  if(rndS() < BAL.loot.lojaDiaEspecial && IDX_RARIDADE[m.teto] >= IDX_RARIDADE.lendario){
    const it = itemLoja('loja'+dia+'_m', IDX_RARIDADE.lendario);
    it.precoMarcas = BAL.loot.lojaLendarioMarcas;
    stock.push(it);
  }
  return stock;
}

function comprarItem(item){
  if(G.diario.comprados && G.diario.comprados.includes(item.id)) return {ok:false, msg:'Esgotado por hoje.'};
  if(item.precoMarcas){          // o Lendário do dia especial paga-se em Marcas (D043)
    if(G.marcas < item.precoMarcas) return {ok:false, msg:'Marcas de Caça insuficientes.'};
    G.marcas -= item.precoMarcas;
  } else {
    const preco = Math.round(valorItem(item) * BAL.economia.lojaMargem);
    if(G.ouro < preco) return {ok:false, msg:'Ouro insuficiente.'};
    G.ouro -= preco;
  }
  const novo = { ...item, id:G.proxId++ };
  delete novo.precoMarcas;
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
  async validarNome(){ /* Firebase: repetir aqui a validação antes de aceitar a criação */ return {ok:true}; },
  async apagarPersonagem(){ /* Firebase: apagar o documento completo pelo personagemId */ return false; },
};

/* ---------- Ranking ---------- */
function tabelaRanking(){
  const meu = poderTotal();
  // cada NPC cresce SEMPRE mais devagar que o jogador (fator/120 < 1),
  // por isso todos são ultrapassáveis com progresso suficiente (P2.7)
  const npcs = NPC_RANKING.map(([nome,fator])=>({
    nome, poder: Math.round(fator*25 + meu*fator/120), eu:false
  }));
  npcs.push({ nome:`${G.nome} (tu)`, classe:CLASSES[G.classe]?.nome||'', poder:meu, eu:true });
  npcs.sort((a,b)=>b.poder-a.poder);
  return npcs;
}
