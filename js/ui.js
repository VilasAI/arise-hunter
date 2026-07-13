/* ============ INTERFACE (painéis, modais, fluxos) ============
   Todos os ícones são desenhados em js/art.js (sem emojis).    */
'use strict';

const $ = s => document.querySelector(s);
let selFusao = [];
let painelAtual = null;
let ferreiroSub = 'mochila';   // sub-separador ativo do Ferreiro

/* ---------- helpers de arte ---------- */
function sombraImg(rank, px=40){
  const cv = ARTE.monstroTintado(SOMBRAS_BASE[rank].sprite, 'rgba(118,86,196,0.9)');
  return `<img class="ic" style="width:${px}px;height:${Math.round(px*0.875)}px" src="${cv.toDataURL()}" alt="">`;
}
function sec(icone, titulo){
  return `<div class="sec-cab">${ic(icone,17)}<span>${titulo}</span></div>`;
}

/* ---------- navegação de ecrãs ---------- */
function mostrarEcra(id){
  document.querySelectorAll('.ecra').forEach(e=>e.classList.remove('ativo'));
  document.getElementById(id).classList.add('ativo');
}

function toast(msg){
  const t = document.createElement('div');
  t.className='toast'; t.innerHTML=msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>t.remove(), 2700);
}

/* ---------- modal ---------- */
function abrirModal(html){
  $('#modal-caixa').innerHTML = html;
  $('#modal').hidden = false;
}
function fecharModal(){ $('#modal').hidden = true; }
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal') fecharModal(); });

/* ---------- topo do hub ---------- */
function atualizarTopo(){
  $('#hub-nome').textContent = G.nome;
  $('#hub-nivel').textContent = G.nivel;
  $('#hub-rank').textContent = rankCacador();
  $('#hub-despertar').textContent = G.despertar>0 ? ' '+'★'.repeat(G.despertar) : '';
  $('#hub-ouro').textContent = G.ouro;
  $('#hub-cristais').textContent = G.cristais;
  $('#hub-stamina').textContent = MODO_TESTE ? '∞ TESTE' : `${staminaAtual()}/${staminaMax()}`;
  $('#hub-xp').style.width = (G.xp / xpParaNivel(G.nivel) * 100) + '%';
  $('#hub-pontos-wrap').hidden = G.pontos <= 0;
  $('#hub-pontos').textContent = G.pontos;
}

function irParaHub(){
  atualizarTopo();
  mostrarEcra('ecra-hub');
  AUDIO.musica('calma');
  mudarTab('batalha');
}

/* ---------- escolha de classe (jogo novo) ---------- */
function modalEscolherClasse(aoConcluir){
  const cards = ORDEM_CLASSES.map(id=>{
    const cl = CLASSES[id];
    const pod = cl.poderes.map(pid=>PODERES[pid].nome).join(' · ');
    return `<button class="classe-cartao" data-classe="${id}" style="border-color:${cl.cor}">
      <div class="classe-icone" style="border-color:${cl.cor}">${ic(cl.icone,32)}</div>
      <div class="classe-info">
        <div class="classe-nome" style="color:${cl.cor}">${cl.nome}</div>
        <div class="classe-estilo">${cl.estilo}</div>
        <div class="classe-lema">«${cl.lema}»</div>
        <div class="classe-passiva"><b>${cl.passiva.nome}:</b> ${cl.passiva.desc}</div>
        <div class="classe-poderes">${ic('arma',11)} ${pod}</div>
        <div class="classe-poderes" style="color:${cl.cor}">${ic(cl.ult.icone,11)} Ultimate: ${cl.ult.nome}</div>
      </div>
    </button>`;
  }).join('');
  abrirModal(`<div class="modal-titulo">Escolhe a tua classe</div>
    <div class="modal-sub">Define o teu estilo e as tuas habilidades.</div>
    <div class="classe-lista">${cards}</div>`);
  document.querySelectorAll('[data-classe]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.classe;
      escolherClasse(id); fecharModal();
      toast(`Classe escolhida: ${CLASSES[id].nome}!`);
      if(aoConcluir) aoConcluir();
    });
  });
}

/* ---------- painéis dos edifícios ---------- */
const PAINEIS = {
  portais:{ icone:'portal', titulo:'Círculo de Portais' },
  ferreiro:{ icone:'forja', titulo:'Ferreiro' },
  loja:{ icone:'loja', titulo:'Mercador' },
  quadro:{ icone:'quadro', titulo:'Quadro de Missões' },
  base:{ icone:'base', titulo:'A Tua Base' },
  heroi:{ icone:'heroi', titulo:'O Watcher' },
  itens:{ icone:'mochila', titulo:'Inventário' },
};

function abrirPainel(id){
  if(id==='npc'){ modalNPC(); return; }
  AUDIO.sfx('ui');
  painelAtual = id;
  selFusao = [];
  const p = PAINEIS[id] || {icone:'ponto', titulo:id};
  $('#painel-titulo').innerHTML = `${ic(p.icone,22)} ${p.titulo}`;
  renderPainel();
  $('#painel').hidden = false;
}
function fecharPainel(){ $('#painel').hidden = true; painelAtual = null; }
$('#painel-fechar').addEventListener('click', fecharPainel);
$('#painel').addEventListener('click', e=>{ if(e.target.id==='painel') fecharPainel(); });

function renderPainel(){
  if(!painelAtual) return;
  const corpo = $('#painel-corpo');
  const html = {
    portais: htmlPortais, ferreiro: htmlFerreiro, loja: htmlLoja,
    quadro: htmlQuadro, base: htmlBase, heroi: htmlHeroi, itens: htmlInventario,
  }[painelAtual];
  corpo.innerHTML = html ? html() : '';
  ligarEventosPainel(painelAtual, corpo);
}

function refrescar(){
  atualizarTopo();
  if(painelAtual) renderPainel();
  if(tabAtual==='batalha') renderBatalha(); else renderTabConteudo();
  atualizarBadges();
}

/* ---------- separadores fixos (estilo Clash Royale) ---------- */
let tabAtual = 'batalha';
const TABS = {
  loja:    { html: ()=>htmlLoja(),                        eventos:['loja'] },
  ferreiro:{ html: ()=>htmlFerreiro(),                    eventos:['itens','ferreiro'] },
  vigia:   { html: ()=>htmlHeroi()+htmlBase(),            eventos:['heroi','base'] },
  missoes: { html: ()=>htmlQuadro(),                      eventos:['quadro'] },
};

function mudarTab(tab){
  AUDIO.sfx('ui');
  tabAtual = tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('ativo', b.dataset.tab===tab));
  const cont = $('#tab-conteudo'), bat = $('#batalha-overlay');
  if(tab==='batalha'){
    cont.hidden = true; bat.hidden = false;
    hubAtivar();                       // a vila volta a animar como fundo
    renderBatalha();
  } else {
    bat.hidden = true; cont.hidden = false;
    hubParar();                        // poupa bateria fora da vila
    renderTabConteudo();
    cont.scrollTop = 0;
  }
  atualizarBadges();
}

function renderTabConteudo(){
  if(tabAtual==='batalha') return;
  const cont = $('#tab-conteudo');
  const t = TABS[tabAtual];
  if(!t) return;
  cont.innerHTML = t.html();
  for(const ev of t.eventos) ligarEventosPainel(ev, cont);
}

document.querySelectorAll('.tab-btn').forEach(b=>{
  b.addEventListener('click', ()=> mudarTab(b.dataset.tab));
});
$('#btn-batalha').addEventListener('click', ()=> abrirPainel('portais'));

/* cartões rápidos do ecrã de batalha (diária, provação, Aldric) */
function renderBatalha(){
  const c = $('#cartoes-batalha');
  let h = '';
  if(!G.diario.feitoDiaria) h += `<button class="cartao-mini" data-acao="diaria">${ic('despertar',15)} Diária ×2</button>`;
  if(despertarDisponivel()) h += `<button class="cartao-mini brilho" data-acao="provacao">${ic('despertar',15)} Provação!</button>`;
  h += `<button class="cartao-mini" data-acao="npc">${ic('npc',15)} Aldric</button>`;
  c.innerHTML = h;
  c.querySelector('[data-acao="diaria"]')?.addEventListener('click', ()=> modalEntrarPortal(masmorraDiaria()));
  c.querySelector('[data-acao="provacao"]')?.addEventListener('click', ()=>{ hubParar(); iniciarCombate(masmorraDespertar()); });
  c.querySelector('[data-acao="npc"]')?.addEventListener('click', modalNPC);
}

/* os edifícios da vila abrem o separador correspondente */
function interagirLocal(id){
  const mapa = { ferreiro:'ferreiro', loja:'loja', quadro:'missoes', base:'vigia' };
  if(id==='npc') modalNPC();
  else if(id==='portais') abrirPainel('portais');
  else if(mapa[id]) mudarTab(mapa[id]);
}

/* badges de notificação nos separadores */
function atualizarBadges(){
  const badges = {
    missoes: MISSOES.filter(m=>missaoCumprida(m) && !missaoReclamada(m)).length,
    vigia: (G.pontos>0?1:0) + (pontosHabDisponiveis()>0?1:0) + (despertarDisponivel()?1:0),
    batalha: G.diario.feitoDiaria ? 0 : 1,
    loja: 0, ferreiro: 0,
  };
  document.querySelectorAll('.tab-btn').forEach(b=>{
    const n = badges[b.dataset.tab]||0;
    const el = b.querySelector('.badge');
    if(!el) return;
    el.hidden = n<=0;
    el.textContent = n;
  });
}

/* ============ PORTAIS ============ */
function htmlPortais(){
  const diaria = masmorraDiaria();
  const st = staminaAtual(), stMax = staminaMax();
  let h = `<div class="pilula-fila">
    <span class="pilula">${ic('stamina',15)} ${st}/${stMax}${st<stMax?` · +1 em ${minutosProximaStamina()} min`:''}</span>
    <span class="pilula">${ic('portal',15)} custo ${BAL.stamina.custoPortal} · diária grátis</span>
  </div>`;
  if(BAL.beta.ativa) h += `<div class="cartao nota">🧪 <b>BETA</b> — a campanha vai até ao rank ${BAL.beta.rankMax}.
    Os ranks seguintes e a Fenda chegam na versão completa.</div>`;
  h += sec('despertar','Evento diário');
  h += cartaoPortal(diaria, G.diario.feitoDiaria, true);
  h += sec('portal','Portais ativos');
  for(const m of MASMORRAS) h += cartaoPortal(m, false, false);
  return h;
}

function cartaoPortal(m, feito, diaria){
  const bloqNivel = G.nivel < m.nivelReq;
  const bloqDespertar = !rankPermitido(m.rank);
  const bloqBeta = !rankNaBeta(m.rank);
  const bloq = bloqNivel || bloqDespertar || bloqBeta;
  const clears = G.clears[m.rank]||0;
  let info;
  if(bloqBeta) info = `Disponível na versão completa`;
  else if(bloqNivel) info = `Requer nível ${m.nivelReq}`;
  else if(bloqDespertar) info = `Requer Despertar ${BAL.despertar.rankExige[m.rank]} ★`;
  else info = `Monstros nv.${m.nivelMon} · ${m.salas} salas${clears?` · ${clears}×`:''}`;
  return `
  <div class="cartao portal-cartao cartao-toque linha ${bloq||feito?'btn-bloq':''}" data-portal="${m.rank}" data-diaria="${diaria?1:0}">
    <div class="portal-rank" style="color:${m.cor}">${bloq?'🔒':m.rank}</div>
    <div class="crescer">
      <div class="portal-nome">${m.nome}</div>
      <div class="portal-info">${info}</div>
      <div class="portal-rec">${ic('ouro',12)} ${m.ouro[0]}–${m.ouro[1]}${diaria?' ×2':''}</div>
    </div>
    ${diaria ? `<span class="etiqueta tempo">${feito?'FEITO':'24H'}</span>` : `<span class="etiqueta">${ic('stamina',11)}${BAL.stamina.custoPortal}</span>`}
  </div>`;
}

function modalEntrarPortal(m){
  const custo = m.diaria||m.despertar ? 0 : BAL.stamina.custoPortal;
  // 1.ª visita ao rank: o Aldric contextualiza o bioma (D008 — saltável, é só ler ou não)
  const fala = (!m.diaria && !m.despertar && !(G.clears[m.rank]) && NPC.porRank[m.rank])
    ? `<div class="npc-fala">${ic('npc',14)} «${NPC.porRank[m.rank]}»</div>` : '';
  abrirModal(`
    <div class="modal-titulo" style="color:${m.cor}">${ic('portal',20)} Portal Rank ${m.rank}</div>
    <div class="modal-sub">${m.nome} · ${m.salas} sala${m.salas>1?'s':''} · monstros nv.${m.nivelMon}${m.diaria?' · recompensas ×2':''}</div>
    ${m.tema?`<div class="nota" style="margin-bottom:8px">${m.tema}</div>`:''}
    ${fala}
    <div class="cartao">
      <div class="stat-linha"><span class="stat-nome">O teu poder</span><span class="stat-valor">${ic('ponto',14)} ${poderTotal()}</span></div>
      <div class="stat-linha"><span class="stat-nome">Dificuldade estimada</span><span class="stat-valor">${avaliarDificuldade(m)}</span></div>
      <div class="stat-linha"><span class="stat-nome">Custo de stamina</span><span class="stat-valor">${ic('stamina',14)} ${custo}</span></div>
    </div>
    <div class="modal-acoes">
      <button class="btn btn-sec" id="p-cancelar">Voltar</button>
      <button class="btn btn-primario" id="p-entrar">ENTRAR</button>
    </div>`);
  $('#p-cancelar').addEventListener('click', fecharModal);
  $('#p-entrar').addEventListener('click', ()=>{
    if(custo>0 && !gastarStamina(custo)){ toast(`Sem stamina — +1 em ${minutosProximaStamina()} min`); return; }
    fecharModal(); fecharPainel(); hubParar();
    iniciarCombate(m);
  });
}

function avaliarDificuldade(m){
  const dif = m.nivelMon - G.nivel;
  if(dif <= -6) return '<span style="color:#7da33c">Fácil</span>';
  if(dif <= 0) return '<span style="color:#e8c84a">Equilibrada</span>';
  if(dif <= 5) return '<span style="color:#e8843a">Difícil</span>';
  return '<span style="color:#d05c4e">Mortal</span>';
}

/* ============ INVENTÁRIO ============ */
function celulaItem(it, extraClasse=''){
  const eq = Object.values(G.equipado).includes(it.id);
  return `
  <div class="item-cel r-${it.raridade} ${extraClasse}" data-item="${it.id}">
    ${it.nivel>0?`<span class="item-nv">+${it.nivel}</span>`:''}
    ${ARTE.imgItem(it, 40)}
    <span class="item-tipo">${eq?'EQUIPADO':RARIDADES[IDX_RARIDADE[it.raridade]].nome}</span>
  </div>`;
}

function htmlInventario(){
  const t = statsTotais();
  let h = sec('armadura','Equipado') + `<div class="equipado-fila">`;
  for(const tipo of TIPOS_ITEM){
    const it = itemPorId(G.equipado[tipo.id]);
    h += it
      ? `<div class="slot-eq cheio r-${it.raridade}" data-item="${it.id}">${ARTE.imgItem(it,38)}<small>+${it.nivel} ${RARIDADES[IDX_RARIDADE[it.raridade]].nome}</small></div>`
      : `<div class="slot-eq">${ic(tipo.id,28)}<small>${tipo.nome}</small></div>`;
  }
  h += `</div>
  <div class="cartao">
    <div class="stats-fila">
      <span>${ic('arma',15)} <b>${Math.round(t.atq)}</b></span>
      <span>${ic('armadura',15)} <b>${t.def}</b></span>
      <span>${ic('hp',15)} <b>${t.hpMax}</b></span>
      <span>${ic('ponto',15)} <b class="t-lendario">${poderTotal()}</b></span>
    </div>
  </div>`;
  h += sec('mochila',`Mochila (${G.inventario.length})`);
  h += G.inventario.length
    ? `<div class="grelha-itens">${G.inventario.map(i=>celulaItem(i)).join('')}</div>`
    : `<div class="cartao vazio">Sem itens — explora os portais!</div>`;
  return h;
}

function modalItem(it){
  const eq = Object.values(G.equipado).includes(it.id);
  const r = RARIDADES[IDX_RARIDADE[it.raridade]];
  const statNome = {arma:'Ataque',armadura:'Defesa',anel:'Poder'}[it.tipo];
  abrirModal(`
    <div class="item-destaque r-${it.raridade}">${ARTE.imgItem(it, 76)}</div>
    <div class="modal-titulo t-${it.raridade}" style="text-align:center">${it.nome} ${it.nivel>0?`+${it.nivel}`:''}</div>
    <div class="modal-sub" style="text-align:center">${r.nome} · ${TIPOS_ITEM.find(x=>x.id===it.tipo).nome}</div>
    <div class="cartao">
      <div class="stat-linha"><span class="stat-nome">${statNome}</span><span class="stat-valor">${valorItem(it)}</span></div>
      ${it.encante?`<div class="stat-linha"><span class="stat-nome">Encantamento ${it.encante.nome}</span><span class="stat-valor t-epico">+${it.encante.valor}</span></div>`:''}
    </div>
    <div class="modal-acoes">
      ${eq
        ? `<button class="btn btn-sec" id="m-deseq">Desequipar</button>`
        : `<button class="btn btn-primario" id="m-eq">Equipar</button>`}
      <button class="btn btn-sec" id="m-vender">Vender ${ic('ouro',14)}</button>
    </div>`);
  $('#m-eq')?.addEventListener('click', ()=>{ equipar(it); fecharModal(); refrescar(); toast('Equipado!'); });
  $('#m-deseq')?.addEventListener('click', ()=>{ desequipar(it.tipo); fecharModal(); refrescar(); });
  $('#m-vender').addEventListener('click', ()=>{
    const ouro = venderItem(it); fecharModal(); refrescar(); toast(`Vendido por ${ic('ouro',13)} ${ouro}`);
  });
}

/* ============ FERREIRO ============ */
const FERREIRO_SUBS = [
  { id:'mochila', icone:'mochila',  nome:'Mochila' },
  { id:'forja',   icone:'forja',    nome:'Forja'   },
  { id:'runas',   icone:'r_trovao', nome:'Runas'   },
  { id:'fusao',   icone:'cristal',  nome:'Fusão'   },
];

function htmlFerreiro(){
  const t = statsTotais();
  let h = `<div class="npc-fala">«Aço, runas e suor. Traz-me as tuas armas, Watcher.»</div>`;

  // ----- equipamento + atributos (contexto sempre visível) -----
  h += `<div class="equipado-fila">`;
  for(const tipo of TIPOS_ITEM){
    const it = itemPorId(G.equipado[tipo.id]);
    h += it
      ? `<div class="slot-eq cheio r-${it.raridade}" data-item="${it.id}">${ARTE.imgItem(it,34)}<small>+${it.nivel} ${RARIDADES[IDX_RARIDADE[it.raridade]].nome}</small></div>`
      : `<div class="slot-eq">${ic(tipo.id,26)}<small>${tipo.nome}</small></div>`;
  }
  h += `</div>
  <div class="cartao"><div class="stats-fila">
    <span>${ic('arma',15)} <b>${Math.round(t.atq)}</b></span>
    <span>${ic('armadura',15)} <b>${t.def}</b></span>
    <span>${ic('hp',15)} <b>${t.hpMax}</b></span>
    <span>${ic('ponto',15)} <b class="t-lendario">${poderTotal()}</b></span>
  </div></div>`;

  // ----- seletor de função -----
  h += `<div class="sub-tabs">${FERREIRO_SUBS.map(s=>
    `<button class="sub-tab ${ferreiroSub===s.id?'ativa':''}" data-ferreiro-sub="${s.id}">${ic(s.icone,18)}<span>${s.nome}</span></button>`
  ).join('')}</div>`;

  // ----- função ativa -----
  h += `<div class="ferreiro-painel">`;
  if(ferreiroSub==='mochila')    h += blocoMochila();
  else if(ferreiroSub==='forja') h += blocoForja();
  else if(ferreiroSub==='runas') h += blocoRunas();
  else                           h += blocoFusao();
  h += `</div>`;
  return h;
}

function blocoMochila(){
  let h = `<p class="ferreiro-desc">A tua mochila. Toca num item para o <b>equipar</b> ou <b>vender</b>.</p>`;
  h += G.inventario.length
    ? `<div class="grelha-itens">${G.inventario.map(i=>celulaItem(i)).join('')}</div>`
    : `<div class="cartao vazio">Sem itens — explora os portais!</div>`;
  return h;
}

function blocoForja(){
  let h = `<p class="ferreiro-desc">Toca num item para o <b>melhorar</b> (mais poder) ou <b>encantar</b> com um atributo.</p>`;
  h += G.inventario.length
    ? `<div class="grelha-itens" data-modo="forja">${G.inventario.map(i=>celulaItem(i)).join('')}</div>`
    : `<div class="cartao vazio">Sem itens para forjar.</div>`;
  return h;
}

function blocoRunas(){
  let h = `<p class="ferreiro-desc">Encaixa runas na arma para efeitos passivos. Tens <b>${slotsRuna()} slot${slotsRuna()>1?'s':''}</b>.</p>`;
  h += `<div class="linha" style="margin-bottom:10px">`;
  for(let i=0;i<2;i++){
    const id = i<slotsRuna() ? G.runasEq[i] : null;
    const runa = id ? RUNAS.find(r=>r.id===id) : null;
    h += i<slotsRuna()
      ? `<div class="runa-slot ${runa?'cheia':''}" data-runa-slot="${i}">${runa?ic(runa.icone,26):'+'}</div>`
      : `<div class="runa-slot" style="opacity:.35">🔒</div>`;
  }
  h += `</div>`;
  h += `<div class="nota" style="margin-bottom:10px">Toca num slot para encaixar/remover.${G.base.forja<BAL.runas.slot2ForjaNivel?` 2º slot: Forja da Base nv.${BAL.runas.slot2ForjaNivel}.`:''}</div>`;
  const possuidas = RUNAS.filter(r=>qtdRuna(r.id)>0);
  h += possuidas.length
    ? possuidas.map(r=>`<div class="runa-cel">${ic(r.icone,30)}<div class="crescer"><b>${r.nome}</b> ×${qtdRuna(r.id)}<div class="nota">${r.desc}</div></div></div>`).join('')
    : `<div class="cartao vazio nota">Sem runas — caem dos bosses de rank C ou superior.</div>`;
  return h;
}

function blocoFusao(){
  let h = `<p class="ferreiro-desc">Junta <b>${FUSAO_QTD} itens iguais</b> (mesmo tipo e raridade) para criar 1 de raridade acima.</p>`;
  // o 1º item selecionado fixa tipo+raridade; os incompatíveis ficam bloqueados
  const refFus = selFusao.length ? itemPorId(selFusao[0]) : null;
  const compatFus = i => !refFus || (i.tipo===refFus.tipo && i.raridade===refFus.raridade);
  // agrupa conjuntos fundíveis lado a lado (por tipo, depois raridade)
  const itensFus = [...G.inventario].sort((a,b)=>
    a.tipo.localeCompare(b.tipo) || IDX_RARIDADE[a.raridade]-IDX_RARIDADE[b.raridade]);
  // pistas: quantos conjuntos completos existem
  const grupos = {};
  for(const i of G.inventario){ if(IDX_RARIDADE[i.raridade]<RARIDADES.length-1){ const k=i.tipo+'|'+i.raridade; grupos[k]=(grupos[k]||0)+1; } }
  const prontos = Object.values(grupos).filter(n=>n>=FUSAO_QTD).length;
  h += `<div class="nota" style="margin-bottom:8px">${
    prontos ? `Tens ${prontos} conjunto${prontos>1?'s':''} pronto${prontos>1?'s':''} para fundir.`
            : `Ainda não tens ${FUSAO_QTD} itens iguais (abaixo da raridade máxima).`}</div>`;
  h += `<div class="grelha-itens" data-modo="fusao">${itensFus.map(i=>{
    const cls = (selFusao.includes(i.id)?'sel ':'') + (refFus && !compatFus(i)?'incompat':'');
    return celulaItem(i, cls);
  }).join('')}</div>
  <button class="btn btn-primario" id="btn-fundir" style="width:100%;margin-top:12px" ${selFusao.length!==FUSAO_QTD?'disabled':''}>Fundir (${selFusao.length}/${FUSAO_QTD})</button>`;
  return h;
}

function modalForja(it){
  abrirModal(`
    <div class="item-destaque r-${it.raridade}">${ARTE.imgItem(it, 64)}</div>
    <div class="modal-titulo t-${it.raridade}" style="text-align:center">${it.nome} ${it.nivel>0?`+${it.nivel}`:''}</div>
    <div class="modal-sub" style="text-align:center">Valor atual: ${valorItem(it)}${it.encante?` · ${it.encante.nome} +${it.encante.valor}`:''}</div>
    <div class="modal-acoes" style="flex-direction:column">
      <button class="btn btn-primario" id="f-melhorar">
        Melhorar para +${it.nivel+1} — ${ic('ouro',14)} ${custoForja(it)} (${Math.round(chanceForja(it)*100)}%)
      </button>
      <button class="btn btn-sec" id="f-encantar">Encantar — ${ic('cristal',14)} ${CUSTO_ENCANTE}</button>
    </div>`);
  $('#f-melhorar').addEventListener('click', ()=>{ const r = forjar(it); toast(r.msg); fecharModal(); refrescar(); });
  $('#f-encantar').addEventListener('click', ()=>{ const r = encantar(it); toast(r.msg); fecharModal(); refrescar(); });
}

function modalRunaSlot(slot){
  const atual = G.runasEq[slot];
  const possuidas = RUNAS.filter(r=>qtdRuna(r.id)>0 && (!G.runasEq.includes(r.id) || G.runasEq[slot]===r.id));
  abrirModal(`
    <div class="modal-titulo">Slot de runa ${slot+1}</div>
    <div class="modal-sub">${atual?'Runa encaixada: '+RUNAS.find(r=>r.id===atual).nome:'Vazio'}</div>
    ${possuidas.length
      ? possuidas.map(r=>`<button class="btn btn-sec" data-encaixa="${r.id}" style="width:100%;margin-bottom:8px;text-align:left">${ic(r.icone,20)} ${r.nome} — <span class="nota">${r.desc}</span></button>`).join('')
      : `<div class="cartao vazio nota">Não tens runas disponíveis para este slot.</div>`}
    <div class="modal-acoes">
      ${atual?`<button class="btn btn-sec" id="r-remover">Remover runa</button>`:''}
      <button class="btn btn-primario" id="r-fechar">Fechar</button>
    </div>`);
  document.querySelectorAll('[data-encaixa]').forEach(b=>{
    b.addEventListener('click', ()=>{ encaixarRuna(b.dataset.encaixa, slot); fecharModal(); refrescar(); toast('Runa encaixada!'); });
  });
  $('#r-remover')?.addEventListener('click', ()=>{ removerRuna(slot); fecharModal(); refrescar(); });
  $('#r-fechar').addEventListener('click', fecharModal);
}

/* ============ LOJA ============ */
function htmlLoja(){
  const stock = stockLoja();
  const comprados = G.diario.comprados || [];
  let h = `<div class="npc-fala">«Mercadoria fresca todos os dias, Watcher. Vê o que a caravana trouxe.»</div>`;
  h += sec('loja','Stock do dia');
  for(const it of stock){
    const preco = Math.round(valorItem(it)*BAL.economia.lojaMargem);
    const esgotado = comprados.includes(it.id);
    h += `<div class="cartao linha ${esgotado?'btn-bloq':''}">
      <div class="item-cel r-${it.raridade}" style="width:54px;flex:none;aspect-ratio:1">${ARTE.imgItem(it,36)}</div>
      <div class="crescer">
        <div class="portal-nome t-${it.raridade}">${it.nome}</div>
        <div class="portal-info">${RARIDADES[IDX_RARIDADE[it.raridade]].nome} · valor ${valorItem(it)}</div>
      </div>
      <button class="btn btn-sec" data-compra="${it.id}">${esgotado?'Esgotado':`${ic('ouro',13)} ${preco}`}</button>
    </div>`;
  }
  h += `<div class="cartao nota">Para vender, abre o ${ic('mochila',13)} Inventário e toca num item.</div>`;
  return h;
}

/* ============ QUADRO (missões + ranking) ============ */
function htmlQuadro(){
  let h = sec('missao','Missões da Ordem');
  for(const m of missoesVisiveis()){
    const prog = progressoMissao(m), feita = missaoCumprida(m), recl = missaoReclamada(m);
    const pct = Math.round(prog/m.alvo*100);
    h += `<div class="cartao ${recl?'btn-bloq':''}">
      <div class="linha">
        <div class="crescer">
          <div class="portal-nome">${m.nome}</div>
          <div class="portal-info">${m.desc}</div>
        </div>
        ${feita && !recl ? `<button class="btn btn-primario" data-reclamar="${m.id}">Reclamar</button>`
          : `<span class="nota" style="flex:none">${recl?'✓':prog+'/'+m.alvo}</span>`}
      </div>
      <div class="prog"><div class="prog-fill ${feita?'cheia':''}" style="width:${recl?100:pct}%"></div></div>
      <div class="nota">Recompensa: ${m.rec.ouro?`${ic('ouro',12)} ${m.rec.ouro} `:''}${m.rec.cristais?`${ic('cristal',12)} ${m.rec.cristais}`:''}</div>
    </div>`;
  }
  h += sec('trofeu','Ranking de Watchers') + `<div class="cartao">`;
  tabelaRanking().forEach((r,i)=>{
    h += `<div class="rank-linha ${r.eu?'rank-eu':''}">
      <div class="rank-pos ${i<3?'top':''}">${i+1}</div>
      <div class="crescer" style="font-weight:${r.eu?800:400}">${r.nome}</div>
      <div class="nota">${ic('ponto',12)} ${r.poder}</div>
    </div>`;
  });
  h += `</div>`;
  return h;
}

/* ============ BASE ============ */
function htmlBase(){
  let h = sec('base','Melhorias da base');
  const ICONES_BASE = { forja:'forja', altar: G.classe==='assassino'?'sombra':'despertar', reservatorio:'stamina' };
  for(const tipo of Object.keys(BASE_DEFS)){
    const d = BASE_DEFS[tipo], n = G.base[tipo], c = custoMelhoriaBase(tipo);
    h += `<div class="cartao linha">
      <div class="avatar">${ic(ICONES_BASE[tipo],24)}</div>
      <div class="crescer">
        <div class="portal-nome">${d.nome} <span class="nota">nv.${n}/${BAL.base.maxNivel}</span></div>
        <div class="portal-info">${d.desc(n)}${c?` → <b>${d.desc(n+1)}</b>`:''}</div>
      </div>
      ${c?`<button class="btn btn-sec" data-base-up="${tipo}" style="font-size:12px">${ic('ouro',11)}${c.ouro}<br>${ic('cristal',11)}${c.cristais}</button>`:`<span class="etiqueta">MÁX</span>`}
    </div>`;
  }

  // coleção de sombras: identidade exclusiva do Assassino (D010)
  if(G.classe === 'assassino'){
    const max = statsTotais().maxSombras, ativas = sombrasAtivas().length;
    h += sec('sombra',`Sombras (${ativas}/${max} ativas)`);
    if(!G.sombras.length){
      h += `<div class="cartao vazio">Ainda não tens sombras.<br>Derrota bosses para as extraíres.</div>`;
    }
    for(const s of G.sombras){
      const st = statsSombra(s);
      h += `
      <div class="cartao linha">
        <div class="avatar" style="overflow:hidden">${sombraImg(s.rank, 38)}</div>
        <div class="crescer">
          <div class="portal-nome">${s.nome} <span class="nota">Rank ${s.rank} · Nv.${s.nivel}</span></div>
          <div class="portal-info">${ic('arma',12)} ${st.atq} · ${ic('hp',12)} ${st.hp}</div>
        </div>
        <button class="btn btn-sec" data-sombra-toggle="${s.nome}" style="font-size:12px">${s.ativa?'Ativa ✓':'Inativa'}</button>
        <button class="btn-mais" data-sombra-up="${s.nome}" title="Subir nível — ${custoSombra(s)} cristais">+</button>
      </div>`;
    }
  }

  // skins do Watcher (D023 v2): aparências por sprite da classe; cristais ganhos a jogar
  h += sec('heroi','Skins do Watcher');
  for(const s of SKINS){
    if(s.classe && s.classe !== G.classe) continue;   // só as da tua classe
    const tem = G.skins.includes(s.id), ativa = G.skinAtiva===s.id;
    const sheet = 'heroi_' + (G.classe||'guerreiro') + (s.classe ? '2' : '');
    h += `<div class="cartao linha">
      <div class="avatar" style="overflow:hidden"><span style="display:inline-block;width:38px;height:38px;background:url(assets/2d/${sheet}_idle.png) 0 0/auto 38px no-repeat;image-rendering:pixelated"></span></div>
      <div class="crescer">
        <div class="portal-nome">${s.nome}</div>
        <div class="portal-info">${s.desc||''}</div>
      </div>
      ${ativa ? `<span class="etiqueta">ATIVA</span>`
        : tem ? `<button class="btn btn-sec" data-skin-usar="${s.id}">Vestir</button>`
        : `<button class="btn btn-sec" data-skin-comprar="${s.id}">${ic('cristal',13)} ${s.preco}</button>`}
    </div>`;
  }

  h += sec('quadro','Progresso') + `
  <div class="cartao">
    <div class="nota" style="margin-bottom:10px">
      O jogo guarda automaticamente neste dispositivo. Usa o código para levar o progresso contigo.
    </div>
    <div class="modal-acoes" style="margin-top:0">
      <button class="btn btn-sec" id="btn-exportar">Copiar código</button>
      <button class="btn btn-sec" id="btn-importar">Inserir código</button>
    </div>
  </div>`;
  return h;
}

/* ============ HERÓI ============ */
function htmlHeroi(){
  const t = statsTotais();
  let h = `<div class="cartao linha cartao-toque" id="h-stats">
    <div class="avatar">${ic('heroi',26)}</div>
    <div class="crescer">
      <div class="portal-nome">${G.nome} — Nv.${G.nivel} (Rank ${rankCacador()}${G.despertar?' '+'★'.repeat(G.despertar):''})</div>
      <div class="portal-info">${ic('arma',12)} ${Math.round(t.atq)} · ${ic('armadura',12)} ${t.def} · ${ic('hp',12)} ${t.hpMax} · ${ic('crit',12)} ${t.crit}%</div>
      ${G.pontos>0?`<div class="missao-prog missao-feita">${ic('ponto',12)} ${G.pontos} pontos por distribuir — toca aqui</div>`:''}
    </div>
    <span class="etiqueta">ATRIBUTOS</span>
  </div>`;

  if(despertarDisponivel()){
    h += `<div class="cartao" style="border-color:var(--bronze)">
      <div class="portal-nome" style="color:var(--bronze)">${ic('despertar',18)} Despertar ${G.despertar+1} disponível!</div>
      <div class="portal-info">Supera a Provação para desbloqueares tiers superiores${G.despertar===0?', a tua ultimate':''}${G.despertar===0?' e portais rank A':' e portais rank S'}.</div>
      <button class="btn btn-primario" id="h-despertar" style="width:100%;margin-top:10px">INICIAR PROVAÇÃO</button>
    </div>`;
  } else if(G.despertar < BAL.despertar.niveis.length){
    h += `<div class="cartao nota">${ic('despertar',14)} Próximo Despertar ao nível ${BAL.despertar.niveis[G.despertar]}.</div>`;
  }

  // ultimate da classe (D011/D012)
  const ult = ultimateClasse();
  if(ult){
    const bloq = G.despertar < 1;
    h += `<div class="cartao ${bloq?'btn-bloq':''}" style="border-color:${ult.cor}">
      <div class="portal-nome" style="color:${ult.cor}">${ic(ult.icone,18)} ${ult.nome} <span class="nota">ULTIMATE</span></div>
      <div class="portal-info">${ult.desc}</div>
      <div class="nota" style="margin-top:6px">${bloq
        ? '🔒 O dom manifesta-se no 1.º Despertar (nível '+BAL.despertar.niveis[0]+').'
        : 'Carrega em combate com dano e abates; o Altar do Dom fortalece-a.'}</div>
    </div>`;
  }

  h += htmlArvore();
  return h;
}

/* ============ ÁRVORE DE PODERES (D019/D021 — colunas por ramo) ============ */
let ramoAtual = 0;

function htmlArvore(){
  const arv = arvoreDaClasse();
  if(!arv) return '';
  if(ramoAtual >= arv.ramos.length) ramoAtual = 0;
  const pts = pontosHabDisponiveis();
  let h = sec('p_brasas',`Árvore de Poderes — ${pts} ponto${pts!==1?'s':''}`);
  h += `<div class="cartao nota">1 ponto a cada ${BAL.poderes.nivelPorPonto} níveis. Tiers custam pontos + ouro;
    nós menores ${BAL.arvore.custoMenor} ponto; keystones ${BAL.arvore.custoKeystone} pontos (exigem Despertar 2).</div>`;
  h += `<div class="sub-tabs">` + arv.ramos.map((r,i)=>{
    const icone = r.dom ? ultimateClasse().icone : PODERES[r.poder].icone;
    const nome  = r.dom ? 'Dom' : PODERES[r.poder].nome.split(' ')[0];
    return `<button class="sub-tab ${ramoAtual===i?'ativa':''}" data-ramo="${i}">${ic(icone,18)}<span>${nome}</span></button>`;
  }).join('') + `</div>`;
  const ramo = arv.ramos[ramoAtual];
  h += `<div class="ferreiro-painel">${ramo.dom ? ramoDomHtml(ramo) : ramoPoderHtml(ramo)}</div>`;
  const cr = custoRespec();
  h += `<div class="cartao linha">
    <div class="crescer nota">Recomeçar a árvore devolve todos os pontos (o ouro gasto não volta).</div>
    <button class="btn btn-sec" id="btn-respec" style="font-size:12px">${cr===0?'Respec<br>grátis':`Respec<br>${ic('ouro',11)}${cr}`}</button>
  </div>`;
  return h;
}

/* nó menor / keystone: cartão compacto com estado e botão de compra */
function linhaNo(ramoIdx, tipo, idx, comprado, disp, nome, desc, custo){
  const attr = tipo==='ks' ? `data-ks="${ramoIdx}"` : `data-no="${ramoIdx}:${idx}"`;
  const marca = tipo==='ks' ? '◆' : '○';
  return `<div class="cartao linha no-arvore ${comprado?'no-on':''}" style="${comprado?'':disp.ok?'':'opacity:.55'}">
    <div class="crescer">
      <div class="portal-nome">${marca} ${nome} ${comprado?'<span class="etiqueta">✓</span>':''}</div>
      <div class="portal-info">${desc}</div>
      ${!comprado && !disp.ok ? `<div class="nota">🔒 ${disp.msg}</div>` : ''}
    </div>
    ${!comprado && disp.ok ? `<button class="btn btn-sec" ${attr} style="font-size:11px">${ic('ponto',11)}${custo}</button>` : ''}
  </div>`;
}

function ramoPoderHtml(ramo){
  const id = ramo.poder, p = PODERES[id], tier = poderTier(id);
  const eqIdx = G.equipadosPoder.indexOf(id);
  const ramoIdx = arvoreDaClasse().ramos.indexOf(ramo);
  let h = `<div class="cartao poder-cartao">
    <div class="poder-icone ${eqIdx>=0?'eq':''}" style="border-color:${tier>0?p.cor:'var(--borda)'}">${ic(p.icone,30)}</div>
    <div class="crescer">
      <div class="portal-nome">${p.nome} <span class="nota">${p.tipo==='ativo'?`ATIVO · ${p.cd}s · ${p.mp}mp`:'PASSIVO'}</span></div>
      <div class="portal-info">${p.desc}${tier>0?` · efeito ×${efeitoPoder(id).toFixed(2)}`:''}</div>
      ${tier>0 && p.tipo==='ativo' ? `<button class="btn btn-sec" data-poder-eq="${id}" style="font-size:11px;margin-top:8px">${eqIdx>=0?`No slot ${eqIdx+1} — mudar`:'Equipar num slot'}</button>`:''}
    </div>
  </div>`;
  const c = custoPoder(id);
  for(let t2=1; t2<=5; t2++){
    const comprado = t2 <= tier, proximo = c && t2 === c.tier;
    const gate = BAL.tiersPoder[t2-1].despertar;
    h += `<div class="cartao linha no-arvore ${comprado?'no-on':''}" style="${comprado||proximo?'':'opacity:.55'}">
      <div class="crescer">
        <div class="portal-nome">● Tier ${t2} ${comprado?'<span class="etiqueta">✓</span>':''}</div>
        <div class="portal-info">Efeito ×${BAL.tiersPoder[t2-1].efeito.toFixed(2)} · cooldown ×${BAL.tiersPoder[t2-1].cd.toFixed(2)}</div>
        ${gate>0 && G.despertar<gate ? `<div class="nota">🔒 Exige Despertar ${gate}</div>`:''}
      </div>
      ${proximo && G.despertar>=gate ? `<button class="btn btn-sec" data-poder-up="${id}" style="font-size:11px">${tier>0?'Evoluir':'Aprender'}<br>${ic('ponto',10)}${c.pontos} ${ic('ouro',10)}${c.ouro}</button>` : ''}
    </div>`;
    // bifurcação de talento no tier 3
    if(t2===BAL.poderes.tierTalento && tier>=BAL.poderes.tierTalento){
      const escolhido = G.poderes[id].talento;
      h += `<div class="talento-opcoes">` + p.talentos.map((t,i)=>
        `<div class="talento ${escolhido===i?'escolhido':''}" data-talento="${id}:${i}"><b>${t.nome}</b><br>${t.desc}</div>`
      ).join('') + `</div>`;
    }
    // nós menores pendurados neste tier
    for(const no of ramo.menores){
      if(no.req !== t2) continue;
      h += linhaNo(ramoIdx, 'no', ramo.menores.indexOf(no), noComprado(no.id), noDisponivel(ramo,no), no.nome, descEfeito(no.ef), BAL.arvore.custoMenor);
    }
  }
  h += linhaNo(ramoIdx, 'ks', 0, noComprado(ramo.keystone.id), keystoneDisponivel(ramo), ramo.keystone.nome+' (keystone)', ramo.keystone.desc, BAL.arvore.custoKeystone);
  return h;
}

function ramoDomHtml(ramo){
  const ult = ultimateClasse();
  const ramoIdx = arvoreDaClasse().ramos.indexOf(ramo);
  const bloq = G.despertar < 1;
  let h = `<div class="cartao" style="border-color:${ult.cor}">
    <div class="portal-nome" style="color:${ult.cor}">${ic(ult.icone,18)} ${ult.nome} <span class="nota">ULTIMATE</span></div>
    <div class="portal-info">${ult.desc}</div>
    ${bloq?`<div class="nota" style="margin-top:6px">🔒 O ramo do Dom abre no 1.º Despertar (nível ${BAL.despertar.niveis[0]}).</div>`:''}
  </div>`;
  for(const no of ramo.menores){
    h += linhaNo(ramoIdx, 'no', ramo.menores.indexOf(no), noComprado(no.id), noDisponivel(ramo,no), no.nome, descEfeito(no.ef), BAL.arvore.custoMenor);
  }
  h += linhaNo(ramoIdx, 'ks', 0, noComprado(ramo.keystone.id), keystoneDisponivel(ramo), ramo.keystone.nome+' (keystone do Dom)', ramo.keystone.desc, BAL.arvore.custoKeystone);
  return h;
}

/* descrição legível do efeito de um nó menor */
function descEfeito(ef){
  const nomes = { atqPct:'% ataque', hpPct:'% vida', defPct:'% defesa', mpPct:'% mana',
                  velMovPct:'% movimento', critFlat:'% crítico', critDanoFlat:'% dano crítico',
                  cdrFlat:'% vel. cooldown', sorteFlat:' Sorte', rouboFlat:'% roubo de vida',
                  ultCargaPct:'% carga da ultimate', efPoderPct:'% efeito deste poder' };
  return Object.keys(ef).map(k=>`+${ef[k]}${nomes[k]||''}`).join(' · ');
}

function modalEquiparPoder(id){
  const p = PODERES[id];
  abrirModal(`
    <div class="modal-titulo">${ic(p.icone,22)} ${p.nome}</div>
    <div class="modal-sub">Escolhe o slot (o slot 1 dispara com o gesto de segurar)</div>
    <div class="modal-acoes">
      ${[0,1,2].map(i=>{
        const atual = G.equipadosPoder[i];
        return `<button class="btn btn-sec" data-slot-eq="${i}">Slot ${i+1}<br>${atual?ic(PODERES[atual].icone,22):'<span style="font-size:16px">—</span>'}</button>`;
      }).join('')}
    </div>`);
  document.querySelectorAll('[data-slot-eq]').forEach(b=>{
    b.addEventListener('click', ()=>{
      equiparPoder(id, +b.dataset.slotEq);
      fecharModal(); refrescar(); toast(`${p.nome} no slot ${+b.dataset.slotEq+1}`);
    });
  });
}

/* ============ NPC ============ */
function modalNPC(){
  const pendente = missoesVisiveis().find(m=>!missaoReclamada(m) && !missaoCumprida(m));
  const reclamavel = missoesVisiveis().find(m=>missaoCumprida(m) && !missaoReclamada(m));
  abrirModal(`
    <div class="modal-titulo">${ic('npc',22)} ${NPC.nome}</div>
    <div class="npc-fala">«${escolher(NPC.saudacoes)}»</div>
    ${reclamavel?`<div class="cartao"><b>${ic('missao',14)} Tens recompensas à espera no Quadro de Missões!</b></div>`:''}
    ${pendente?`<div class="cartao">
      <div class="portal-nome">${pendente.nome}</div>
      <div class="portal-info">${pendente.desc}</div>
      ${pendente.tut?`<div class="npc-fala" style="margin:8px 0 0">«${pendente.tut}»</div>`:''}
    </div>`:`<div class="cartao vazio">«Cumpriste tudo o que a Ordem pediu. Descansa, Watcher.»</div>`}
    <div class="modal-acoes">
      <button class="btn btn-sec" id="npc-quadro">Ver Quadro</button>
      <button class="btn btn-primario" id="npc-fechar">Até já</button>
    </div>`);
  $('#npc-quadro').addEventListener('click', ()=>{ fecharModal(); abrirPainel('quadro'); });
  $('#npc-fechar').addEventListener('click', fecharModal);
}

/* ============ eventos dos painéis ============ */
function ligarEventosPainel(tab, corpo){
  if(tab==='portais'){
    corpo.querySelectorAll('[data-portal]').forEach(c=>{
      c.addEventListener('click', ()=>{
        const m = c.dataset.diaria==='1' ? masmorraDiaria() : MASMORRAS.find(x=>x.rank===c.dataset.portal);
        modalEntrarPortal(m);
      });
    });
  }
  if(tab==='itens'){
    // só as células fora dos modos forja/fusão (evita duplo handler no separador Ferreiro)
    corpo.querySelectorAll('.equipado-fila [data-item], .grelha-itens:not([data-modo]) [data-item]').forEach(c=>{
      c.addEventListener('click', ()=> modalItem(itemPorId(+c.dataset.item)));
    });
  }
  if(tab==='ferreiro'){
    corpo.querySelectorAll('[data-ferreiro-sub]').forEach(b=>{
      b.addEventListener('click', ()=>{
        ferreiroSub = b.dataset.ferreiroSub;
        if(ferreiroSub!=='fusao') selFusao = [];   // não arrasta seleção entre funções
        refrescar();
      });
    });
    corpo.querySelector('[data-modo="forja"]')?.querySelectorAll('[data-item]').forEach(c=>{
      c.addEventListener('click', ()=> modalForja(itemPorId(+c.dataset.item)));
    });
    corpo.querySelectorAll('[data-runa-slot]').forEach(c=>{
      c.addEventListener('click', ()=> modalRunaSlot(+c.dataset.runaSlot));
    });
    corpo.querySelector('[data-modo="fusao"]')?.querySelectorAll('[data-item]').forEach(c=>{
      c.addEventListener('click', ()=>{
        const id = +c.dataset.item;
        if(selFusao.includes(id)){ selFusao = selFusao.filter(x=>x!==id); }
        else {
          const it = itemPorId(id), ref = selFusao.length ? itemPorId(selFusao[0]) : null;
          if(IDX_RARIDADE[it.raridade] >= RARIDADES.length-1){ toast('Raridade máxima — não dá para fundir.'); return; }
          if(ref && (it.tipo!==ref.tipo || it.raridade!==ref.raridade)){ toast('Só itens do mesmo tipo e raridade.'); return; }
          if(selFusao.length < FUSAO_QTD) selFusao.push(id);
        }
        refrescar();
      });
    });
    corpo.querySelector('#btn-fundir')?.addEventListener('click', ()=>{
      const r = fundir(selFusao);
      selFusao = [];
      if(r.ok){ toast('Fusão concluída!'); refrescar(); modalItem(r.item); }
      else { toast(r.msg); refrescar(); }
    });
  }
  if(tab==='loja'){
    corpo.querySelectorAll('[data-compra]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const it = stockLoja().find(x=>x.id===b.dataset.compra);
        const r = comprarItem(it);
        toast(r.ok?`Compraste ${it.nome}!`:r.msg);
        refrescar();
      });
    });
  }
  if(tab==='quadro'){
    corpo.querySelectorAll('[data-reclamar]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const m = MISSOES.find(x=>x.id===b.dataset.reclamar);
        if(reclamarMissao(m)){ toast(`${m.nome}: recompensa recebida!`); refrescar(); }
      });
    });
  }
  if(tab==='base'){
    corpo.querySelectorAll('[data-base-up]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const r = melhorarBase(b.dataset.baseUp);
        toast(r.ok?'Base melhorada!':r.msg);
        refrescar();
      });
    });
    corpo.querySelectorAll('[data-sombra-toggle]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const s = G.sombras.find(x=>x.nome===b.dataset.sombraToggle);
        if(!s.ativa && sombrasAtivas().length >= statsTotais().maxSombras){ toast('Limite de sombras ativas atingido.'); return; }
        s.ativa = !s.ativa; guardar(); refrescar();
      });
    });
    corpo.querySelectorAll('[data-sombra-up]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const s = G.sombras.find(x=>x.nome===b.dataset.sombraUp);
        const r = subirSombra(s);
        toast(r.ok ? `${s.nome} subiu para Nv.${s.nivel}!` : r.msg);
        refrescar();
      });
    });
    corpo.querySelectorAll('[data-skin-comprar]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const r = comprarSkin(b.dataset.skinComprar);
        toast(r.ok ? `${r.skin.nome} é tua — já está vestida!` : r.msg);
        refrescar();
      });
    });
    corpo.querySelectorAll('[data-skin-usar]').forEach(b=>{
      b.addEventListener('click', ()=>{
        if(ativarSkin(b.dataset.skinUsar)){ toast('Skin vestida!'); refrescar(); }
      });
    });
    corpo.querySelector('#btn-exportar')?.addEventListener('click', async ()=>{
      const cod = exportarSave();
      try{ await navigator.clipboard.writeText(cod); toast('Código copiado!'); }
      catch(e){ prompt('Copia o teu código de progresso:', cod); }
    });
    corpo.querySelector('#btn-importar')?.addEventListener('click', ()=>{
      const cod = prompt('Cola aqui o código de progresso:');
      if(cod && importarSave(cod)){ toast('Progresso restaurado!'); refrescar(); }
      else if(cod) toast('Código inválido.');
    });
  }
  if(tab==='heroi'){
    corpo.querySelector('#h-stats')?.addEventListener('click', modalStats);
    corpo.querySelector('#h-despertar')?.addEventListener('click', ()=>{
      const m = masmorraDespertar();
      fecharPainel(); hubParar();
      iniciarCombate(m);
    });
    corpo.querySelectorAll('[data-poder-up]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const r = evoluirPoder(b.dataset.poderUp);
        toast(r.ok?`${PODERES[b.dataset.poderUp].nome} → Tier ${r.tier}!`:r.msg);
        refrescar();
      });
    });
    corpo.querySelectorAll('[data-poder-eq]').forEach(b=>{
      b.addEventListener('click', ()=> modalEquiparPoder(b.dataset.poderEq));
    });
    corpo.querySelectorAll('[data-talento]').forEach(d=>{
      d.addEventListener('click', ()=>{
        const [id, idx] = d.dataset.talento.split(':');
        if(escolherTalento(id, +idx)){ toast(`Talento: ${PODERES[id].talentos[+idx].nome}`); refrescar(); }
        else toast(`Talentos desbloqueiam no tier ${BAL.poderes.tierTalento}.`);
      });
    });
    // árvore de poderes: ramos, nós menores, keystones, respec
    corpo.querySelectorAll('[data-ramo]').forEach(b=>{
      b.addEventListener('click', ()=>{ ramoAtual = +b.dataset.ramo; refrescar(); });
    });
    corpo.querySelectorAll('[data-no]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const [ri, ni] = b.dataset.no.split(':').map(Number);
        const ramo = arvoreDaClasse().ramos[ri];
        const r = comprarNo(ramo, ramo.menores[ni], false);
        toast(r.ok ? `${ramo.menores[ni].nome} adquirido!` : r.msg);
        refrescar();
      });
    });
    corpo.querySelectorAll('[data-ks]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const ramo = arvoreDaClasse().ramos[+b.dataset.ks];
        const r = comprarNo(ramo, null, true);
        toast(r.ok ? `✦ Keystone: ${ramo.keystone.nome}!` : r.msg);
        refrescar();
      });
    });
    corpo.querySelector('#btn-respec')?.addEventListener('click', ()=>{
      const custo = custoRespec();
      if(!confirm(`Recomeçar a árvore${custo?` por ${custo} de ouro`:' (grátis)'}? Todos os pontos são devolvidos.`)) return;
      const r = resetArvore();
      toast(r.ok ? 'Árvore recomeçada — pontos devolvidos.' : r.msg);
      refrescar();
    });
  }
}

/* ============ fim de combate ============ */
function fimCombateUI(r){
  irParaHub();
  if(r.fuga){ toast('Saíste do portal.'); return; }
  if(r.vitoria) AUDIO.sfx('loot');
  if(r.subiu) AUDIO.sfx('nivel');
  let h;
  if(r.vitoria && r.despertou){
    h = `<div class="recompensa-grande">
      <span class="emoji">${ic('despertar',56)}</span>
      <div class="modal-titulo">DESPERTASTE!</div>
      <div class="modal-sub">Despertar ${G.despertar} — sentes o teu dom crescer.</div>
    </div>
    <div class="lista-loot">
      <div class="loot-linha">${ic('ponto',16)} +${r.xp} XP${r.subiu?' · subiste de nível!':''}</div>
      <div class="loot-linha">${ic('cristal',16)} +${r.cristais} cristais</div>
      <div class="loot-linha">${ic('despertar',16)} Tiers superiores${G.despertar===1?' e portais rank A':' e portais rank S'} desbloqueados!</div>
      ${G.despertar===1 && ultimateClasse() ? `<div class="loot-linha" style="border-color:${ultimateClasse().cor}">${ic(ultimateClasse().icone,18)} O teu dom manifesta-se: <b>${ultimateClasse().nome}</b> desbloqueada!</div>` : ''}
      ${G.despertar===2 ? `<div class="loot-linha">${ic('forja',16)} O teu equipamento é reforjado pelo dom: <b>aspeto lendário</b> desbloqueado!</div>` : ''}
    </div>
    <div class="modal-acoes"><button class="btn btn-primario" id="r-ok">Continuar</button></div>`;
  } else if(r.vitoria){
    h = `<div class="recompensa-grande">
      <span class="emoji">${ic('trofeu',56)}</span>
      <div class="modal-titulo">Portal encerrado!</div>
      <div class="modal-sub">${r.masmorra.nome} — Rank ${r.masmorra.rank}</div>
    </div>
    <div class="lista-loot">
      <div class="loot-linha">${ic('ponto',16)} <b>+${r.xp} XP</b>${r.subiu?` <span class="t-epico">· SUBISTE ${r.subiu} NÍVEL${r.subiu>1?'EIS':''}! (+${r.subiu*PONTOS_POR_NIVEL} pts)</span>`:''}</div>
      <div class="loot-linha">${ic('ouro',16)} +${r.ouro} &nbsp; ${ic('cristal',16)} +${r.cristais}</div>
      ${r.itens.map(it=>`<div class="loot-linha t-${it.raridade}">${ARTE.imgItem(it,26)} <b>${it.nome}</b> · ${RARIDADES[IDX_RARIDADE[it.raridade]].nome}</div>`).join('')}
      ${r.sorteExtra?`<div class="loot-linha" style="color:var(--ouro)">${ic('sorte',16)} A tua <b>Sorte</b> rendeu um item extra!</div>`:''}
      ${r.runa?`<div class="loot-linha">${ic(r.runa.icone,18)} Runa obtida: <b>${r.runa.nome}</b>!</div>`:''}
      ${r.sombra?`<div class="loot-linha" style="border-color:var(--sombra-cor)">${sombraImg(r.sombra.rank,26)} <b>«LEVANTA-TE!»</b> — extraíste a sombra <b>${r.sombra.nome}</b>!</div>`:''}
    </div>
    ${r.primeiroClear && NPC.aposRank[r.masmorra.rank] ? `<div class="npc-fala">${ic('npc',14)} «${NPC.aposRank[r.masmorra.rank]}»</div>` : ''}
    <div class="modal-acoes"><button class="btn btn-primario" id="r-ok">Continuar</button></div>`;
  } else {
    h = `<div class="recompensa-grande">
      <span class="emoji">${ic('p_terror',56)}</span>
      <div class="modal-titulo">Foste derrotado…</div>
      <div class="modal-sub">Mas cada queda torna-te mais forte.</div>
    </div>
    <div class="lista-loot"><div class="loot-linha">${ic('ponto',16)} +${r.xp} XP de consolação${r.subiu?' · subiste de nível!':''}</div></div>
    <div class="modal-acoes">
      <button class="btn btn-sec" id="r-ok">Voltar à vila</button>
      ${r.masmorra.despertar?'':`<button class="btn btn-primario" id="r-retry">Tentar de novo</button>`}
    </div>`;
  }
  abrirModal(h);
  $('#r-ok').addEventListener('click', ()=>{ fecharModal(); atualizarTopo(); if(G.pontos>0) modalStats(); });
  $('#r-retry')?.addEventListener('click', ()=>{
    const m = r.masmorra;
    const custo = m.diaria||m.despertar ? 0 : BAL.stamina.custoPortal;
    if(custo>0 && !gastarStamina(custo)){ toast('Sem stamina para repetir já.'); fecharModal(); return; }
    fecharModal(); hubParar(); iniciarCombate(m);
  });
}

/* ============ atributos (modal) ============ */
function modalStats(){
  const t = statsTotais();

  const linhaBasica = (chave,icone,nome,desc)=>`
    <div class="stat-linha">
      <div><div class="stat-nome" style="color:var(--texto)">${ic(icone,15)} ${nome} <b>${G.basicas[chave]}</b></div>
      <div class="nota">${desc}</div></div>
      ${G.pontos>0?`<button class="btn-mais" data-basica="${chave}">+</button>`:''}
    </div>`;

  const linhaAvancada = (chave,icone,desc)=>{
    const a = BAL.avancadas[chave];
    const pts = G.avancadas[chave];
    const valor = valorAvancada(chave, pts);
    const noCap = avancadaNoCap(chave, pts);
    const meio = meioPonto(pts) ? ` <span style="color:var(--bronze)">+½</span>` : '';
    return `
    <div class="stat-linha">
      <div><div class="stat-nome" style="color:var(--texto)">${ic(icone,15)} ${a.nome} <b>${valor}${a.sufixo}</b>${meio}</div>
      <div class="nota">${desc} · ${unidadesAvancada(pts)} unid. (${pts} pts)${noCap?'':` · máx ${a.cap}${a.sufixo}`}</div></div>
      ${noCap ? `<span style="font-size:11px;font-weight:800;color:var(--ouro)">MÁX.</span>`
              : (G.pontos>0?`<button class="btn-mais" data-avancada="${chave}">+</button>`:'')}
    </div>`;
  };

  abrirModal(`
    <div class="modal-titulo">${ic('heroi',20)} ${G.nome} — Nv.${G.nivel} (Rank ${rankCacador()})</div>
    <div class="modal-sub">${G.pontos>0?`${ic('ponto',13)} <b>${G.pontos} pontos</b> por distribuir`:'Sem pontos por distribuir'}</div>
    ${sec('forca','Básicas — 1 ponto = +1')}
    <div class="cartao">
      ${linhaBasica('for','forca','Força',`+${BAL.basicas.forca.danoPorPonto} dano por ponto`)}
      ${linhaBasica('vit','hp','Vitalidade',`+${BAL.basicas.vitalidade.hpPorPonto} HP por ponto`)}
      ${linhaBasica('agi','agi','Agilidade','+1% vel. ataque, +0,5% vel. movimento')}
    </div>
    ${sec('crit','Avançadas — 2 pontos = +1 unidade')}
    <div class="cartao">
      ${linhaAvancada('crit','crit','chance de acerto crítico')}
      ${linhaAvancada('critDano','critDano','multiplicador do dano crítico')}
      ${linhaAvancada('sorte','sorte','melhor raridade e drops extra')}
      ${linhaAvancada('roubo','roubo','dano convertido em vida')}
      ${linhaAvancada('pen','pen','ignora defesa inimiga')}
      ${linhaAvancada('cdr','cdr','recarga mais rápida dos poderes')}
    </div>
    <div class="cartao nota">
      ${ic('arma',12)} ${Math.round(t.atq)} · ${ic('armadura',12)} ${t.def} · ${ic('hp',12)} ${t.hpMax} · ${ic('mana',12)} ${t.mpMax} ·
      ${ic('crit',12)} ${t.crit}% × ${t.critDano}% · ${ic('agi',12)} ${Math.round((t.velAtq-1)*100)}%${G.classe==='assassino'?` · ${ic('sombra',12)} ${t.maxSombras}`:''}
    </div>
    <div class="modal-acoes"><button class="btn btn-primario" id="s-fechar">Fechar</button></div>`);
  $('#s-fechar').addEventListener('click', ()=>{ fecharModal(); refrescar(); });
  document.querySelectorAll('[data-basica]').forEach(b=>{
    b.addEventListener('click', ()=>{
      if(G.pontos<=0) return;
      G.basicas[b.dataset.basica]++;
      G.pontos--;
      guardar();
      modalStats();
    });
  });
  document.querySelectorAll('[data-avancada]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const chave = b.dataset.avancada;
      if(G.pontos<=0 || avancadaNoCap(chave, G.avancadas[chave])) return;
      G.avancadas[chave]++;
      G.pontos--;
      guardar();
      modalStats();
    });
  });
}
$('#abrir-stats').addEventListener('click', modalStats);

/* ============ ecrã de título (cena pintada) ============ */
function pintarTitulo(){
  const cv = document.getElementById('titulo-canvas');
  if(!cv) return;
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W*dpr; cv.height = H*dpr;
  const c = cv.getContext('2d');
  c.setTransform(dpr,0,0,dpr,0,0);
  const rng = (function(seed){ let s=seed; return ()=>{ s=(s*9301+49297)%233280; return s/233280; }; })(77);

  const ceu = c.createLinearGradient(0,0,0,H*0.75);
  ceu.addColorStop(0,'#1d1426');
  ceu.addColorStop(0.45,'#4a2630');
  ceu.addColorStop(0.78,'#9c4a2e');
  ceu.addColorStop(1,'#d8853c');
  c.fillStyle=ceu; c.fillRect(0,0,W,H*0.75);
  for(let i=0;i<60;i++){
    c.fillStyle=`rgba(232,220,195,${0.2+rng()*0.5})`;
    c.fillRect(rng()*W, rng()*H*0.4, 1.6, 1.6);
  }
  const sx=W*0.30, sy=H*0.62;
  const sol = c.createRadialGradient(sx,sy,4, sx,sy,W*0.30);
  sol.addColorStop(0,'rgba(255,220,150,0.85)');
  sol.addColorStop(0.12,'rgba(255,190,110,0.45)');
  sol.addColorStop(1,'rgba(255,190,110,0)');
  c.fillStyle=sol; c.beginPath(); c.arc(sx,sy,W*0.30,0,Math.PI*2); c.fill();
  c.fillStyle='#f5d8a0';
  c.beginPath(); c.arc(sx,sy,26,0,Math.PI*2); c.fill();

  c.fillStyle='#3a2330';
  c.beginPath(); c.moveTo(0,H*0.58);
  for(let x=0;x<=W;x+=W/7) c.lineTo(x, H*(0.40+rng()*0.13));
  c.lineTo(W,H*0.75); c.lineTo(0,H*0.75); c.closePath(); c.fill();
  c.fillStyle='#241522';
  c.beginPath(); c.moveTo(0,H*0.66);
  for(let x=0;x<=W;x+=W/5) c.lineTo(x, H*(0.52+rng()*0.12));
  c.lineTo(W,H*0.75); c.lineTo(0,H*0.75); c.closePath(); c.fill();

  c.fillStyle='#140d14';
  c.beginPath();
  c.moveTo(0,H*0.75);
  c.quadraticCurveTo(W*0.30,H*0.66, W*0.55,H*0.70);
  c.quadraticCurveTo(W*0.80,H*0.73, W,H*0.69);
  c.lineTo(W,H); c.lineTo(0,H); c.closePath(); c.fill();
  for(let i=0;i<7;i++){
    const hx = W*(0.08+i*0.115), hy = H*(0.705 - Math.abs(i-3)*0.008);
    const hw = 18+rng()*14, hh = 16+rng()*10;
    c.fillStyle='#140d14';
    c.fillRect(hx-hw/2, hy-hh, hw, hh);
    c.beginPath(); c.moveTo(hx-hw/2-4,hy-hh); c.lineTo(hx,hy-hh-12-rng()*6); c.lineTo(hx+hw/2+4,hy-hh); c.closePath(); c.fill();
    if(rng()<0.8){
      c.fillStyle='rgba(240,180,80,0.9)';
      c.fillRect(hx-3, hy-hh+5, 5, 6);
    }
  }
  const px=W*0.84, py=H*0.665;
  c.strokeStyle='#0d0810'; c.lineWidth=9;
  c.beginPath(); c.arc(px,py-16,30,Math.PI,0); c.stroke();
  c.fillStyle='#0d0810';
  c.fillRect(px-36,py-20,9,24); c.fillRect(px+27,py-20,9,24);
  const pg = c.createRadialGradient(px,py-14,2, px,py-14,56);
  pg.addColorStop(0,'rgba(170,140,240,0.75)');
  pg.addColorStop(0.4,'rgba(138,111,200,0.35)');
  pg.addColorStop(1,'rgba(138,111,200,0)');
  c.fillStyle=pg; c.beginPath(); c.arc(px,py-14,56,0,Math.PI*2); c.fill();
  c.fillStyle='rgba(190,165,255,0.65)';
  c.beginPath(); c.ellipse(px,py-14,20,26,0,0,Math.PI*2); c.fill();

  c.strokeStyle='rgba(20,13,20,0.85)'; c.lineWidth=1.6;
  for(let i=0;i<5;i++){
    const bx=W*(0.45+rng()*0.25), by=H*(0.30+rng()*0.12), bs=4+rng()*4;
    c.beginPath();
    c.moveTo(bx-bs,by); c.quadraticCurveTo(bx-bs/2,by-bs*0.8,bx,by);
    c.quadraticCurveTo(bx+bs/2,by-bs*0.8,bx+bs,by);
    c.stroke();
  }
  const vin = c.createRadialGradient(W/2,H*0.5,Math.min(W,H)*0.3, W/2,H*0.5,Math.max(W,H)*0.8);
  vin.addColorStop(0,'rgba(0,0,0,0)'); vin.addColorStop(1,'rgba(8,5,10,0.55)');
  c.fillStyle=vin; c.fillRect(0,0,W,H);
}
pintarTitulo();
window.addEventListener('resize', ()=>{
  if(document.getElementById('ecra-titulo').classList.contains('ativo')) pintarTitulo();
});

/* ============ arranque ============ */
/* preencher os placeholders de ícones do HTML estático */
document.querySelectorAll('[data-ic]').forEach(el=>{
  el.outerHTML = ic(el.dataset.ic, +(el.dataset.px||16));
});

function entrarNoJogo(){
  const premio = verificarDiario();
  irParaHub();
  if(premio) toast(`Prémio diário: +${50+G.nivel*5} ${ic('ouro',13)}, +2 ${ic('cristal',13)}!`);
  if(G._sombrasMigradas){
    delete G._sombrasMigradas; guardar();
    toast('As sombras agora respondem só ao Assassino — foste compensado. O dom de cada classe é a sua ultimate.');
  }
  if(G._migrado){
    delete G._migrado; guardar();
    toast('Sistema de atributos renovado — pontos devolvidos!');
    setTimeout(modalStats, 800);
  }
  if(G.nivel===1 && !G.inventario.length){
    G.inventario.push({ id:G.proxId++, tipo:'arma', nome:'Adaga do Watcher', raridade:'comum', base:8, nivel:0, encante:null });
    equipar(G.inventario[0]);
    atualizarTopo();
    setTimeout(()=>toast(`${ic('arma',14)} Recebeste a tua primeira arma! Fala com o Mestre Aldric.`), 600);
  }
}
$('#btn-comecar').addEventListener('click', ()=>{
  if(!G.classe){ modalEscolherClasse(entrarNoJogo); return; }
  entrarNoJogo();
});

$('#btn-apagar-save').addEventListener('click', ()=>{
  if(confirm('Apagar TODO o progresso? Esta ação não pode ser anulada.')){
    apagarSave(); guardar();
    toast('Progresso apagado.');
  }
});

/* botões de som (título + combate) */
function atualizarBotoesSom(){
  $('#btn-som').textContent = AUDIO.mudo ? 'Som: desligado' : 'Som: ligado';
  $('#btn-som-c').classList.toggle('mudo', AUDIO.mudo);
}
$('#btn-som').addEventListener('click', ()=>{ AUDIO.alternarMudo(); atualizarBotoesSom(); });
$('#btn-som-c').addEventListener('click', ()=>{ AUDIO.alternarMudo(); atualizarBotoesSom(); });
atualizarBotoesSom();
AUDIO.musica('calma');   // tema do título/vila — começa a tocar no 1.º toque

carregar();
