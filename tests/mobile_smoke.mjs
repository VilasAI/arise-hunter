#!/usr/bin/env node
/* Smoke test visual do jogo real através do Chrome DevTools Protocol.
   Cobre a conta de teste isolada (?teste), a loja com Marcas de Caça,
   a fusão com catalisadores até ao Divino (Bloco 7, D037–D044) e o
   layout em portrait/landscape.
   Uso: node tests/mobile_smoke.mjs http://127.0.0.1:8765 9222 */
import fs from 'node:fs/promises';
import path from 'node:path';

const base=process.argv[2]||'http://127.0.0.1:8765';
const porta=+(process.argv[3]||9222);
const raiz=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/,'$1')),'..');
const saida=path.join(raiz,'tests','screenshots');
await fs.mkdir(saida,{recursive:true});

const alvo=await fetch(`http://127.0.0.1:${porta}/json/new?${encodeURIComponent(base+'/index.html?teste')}`,{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((ok,erro)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',erro,{once:true});});
let seq=0; const pendentes=new Map();
ws.addEventListener('message',e=>{
  const m=JSON.parse(e.data);
  if(!m.id) return;
  const p=pendentes.get(m.id); if(!p) return;
  pendentes.delete(m.id); m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);
});
function cmd(method,params={}){
  const id=++seq; ws.send(JSON.stringify({id,method,params}));
  return new Promise((resolve,reject)=>pendentes.set(id,{resolve,reject}));
}
const esperar=ms=>new Promise(r=>setTimeout(r,ms));
async function avaliar(expression){
  const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
}
async function captura(nome){
  const r=await cmd('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
  await fs.writeFile(path.join(saida,nome),Buffer.from(r.data,'base64'));
}
async function verificarLayout(rotulo){
  const l=await avaliar(`(()=>{
    const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
    const botoes=[...document.querySelectorAll('button')].filter(vis).map(e=>({id:e.id||e.textContent.trim().slice(0,24),w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}));
    return {largura:innerWidth,scroll:document.documentElement.scrollWidth,pequenos:botoes.filter(b=>b.w<44||b.h<44)};
  })()`);
  if(l.scroll>l.largura) throw new Error(`${rotulo}: overflow horizontal ${l.scroll}>${l.largura}`);
  if(l.pequenos.length) throw new Error(`${rotulo}: alvos tácteis abaixo de 44px: `+JSON.stringify(l.pequenos));
  return l;
}

await cmd('Page.enable'); await cmd('Runtime.enable');
await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
await cmd('Page.navigate',{url:base+'/index.html?teste'});
let pronto=false;
for(let i=0;i<80;i++){
  await esperar(125);
  if(await avaliar(`typeof entrarNoJogo==='function'`)){ pronto=true; break; }
}
if(!pronto) throw new Error('o jogo não terminou o carregamento em 10 segundos');
await esperar(350);
await captura('mobile-titulo.png');

/* ---- conta de teste isolada, já com os recursos do Bloco 7 ---- */
const conta=await avaliar(`({
  modo:MODO_TESTE, save:SAVE_KEY, nome:G.nome, nivel:G.nivel, despertar:G.despertar,
  marcas:G.marcas, nucleos:G.catalisadores.nucleo, coracoes:G.catalisadores.coracao
})`);
if(!conta.modo || conta.save!=='arise-hunter-save-teste-v1') throw new Error('a conta de teste não está isolada: '+JSON.stringify(conta));
if(conta.nome!=='Watcher de Teste' || conta.nivel!==40 || conta.despertar!==2)
  throw new Error('perfil de teste incompleto: '+JSON.stringify(conta));
if(!(conta.marcas>0) || !(conta.nucleos>0) || !(conta.coracoes>0))
  throw new Error('recursos do Bloco 7 em falta na conta de teste: '+JSON.stringify(conta));

await avaliar(`entrarNoJogo()`);
await esperar(1400); await captura('mobile-vila.png');
const stamina=await avaliar(`document.querySelector('#hub-stamina')?.textContent||''`);
if(!stamina.includes('∞')) throw new Error('energia da conta de teste sem ∞: '+stamina);

/* ---- troca de classe de teste repõe o kit ---- */
const troca=await avaliar(`(()=>{
  trocarClasseTeste('mago');
  const ok=CLASSES.mago.poderes.every(id=>G.poderes[id]);
  trocarClasseTeste('guerreiro');
  return { ok, classe:G.classe };
})()`);
if(!troca.ok || troca.classe!=='guerreiro') throw new Error('troca de classe de teste falhou: '+JSON.stringify(troca));

/* ---- loja: Marcas visíveis, teto Épico a ouro, dia especial só Lendário ---- */
await avaliar(`mudarTab('loja')`); await esperar(400); await captura('mobile-loja.png');
const loja=await avaliar(`(()=>{
  const s=stockLoja();
  return {
    n:s.length,
    acimaDoTeto:s.filter(i=>!i.precoMarcas && IDX_RARIDADE[i.raridade]>IDX_RARIDADE.epico).length,
    especial:s.find(i=>i.precoMarcas)?.raridade||null,
    marcasNoEcra:(document.querySelector('#tab-conteudo')?.textContent||'').includes('Marcas de Caça'),
  };
})()`);
if(loja.n<4 || loja.n>5 || loja.acimaDoTeto>0) throw new Error('loja fora das regras: '+JSON.stringify(loja));
if(loja.especial && loja.especial!=='lendario') throw new Error('dia especial não-lendário: '+JSON.stringify(loja));
if(!loja.marcasNoEcra) throw new Error('saldo de Marcas não aparece na loja');
await verificarLayout('loja');

/* ---- fusão: 6 míticos + ouro + Coração → Divino, de ponta a ponta ---- */
await avaliar(`mudarTab('ferreiro')`); await esperar(300);
const fusao=await avaliar(`(()=>{
  ferreiroSub='fusao';
  const ids=[];
  for(let i=0;i<6;i++){ const id=G.proxId++; G.inventario.push({id,tipo:'arma',nome:'Lâmina do Monarca',raridade:'mitico',base:25,nivel:0,encante:null}); ids.push(id); }
  selFusao=ids;
  refrescar();
  const btn=document.querySelector('#btn-fundir');
  return { texto:btn?.textContent.trim()||'', ativo:!!btn && !btn.disabled };
})()`);
await captura('mobile-fusao.png');
if(!fusao.ativo || !fusao.texto.includes('6/6') || !fusao.texto.includes('Coração'))
  throw new Error('botão de fusão sem os requisitos do Divino: '+JSON.stringify(fusao));
await verificarLayout('fusão');
const divino=await avaliar(`(()=>{
  const antes=G.catalisadores.coracao;
  const r=fundir(selFusao); selFusao=[]; refrescar();
  return { ok:r.ok, raridade:r.item?.raridade, nome:r.item?.nome, antes };
})()`);
if(!divino.ok || divino.raridade!=='divino') throw new Error('fusão do Divino falhou: '+JSON.stringify(divino));
await avaliar(`modalItem(G.inventario.find(i=>i.raridade==='divino'))`);
await esperar(300); await captura('mobile-divino.png');
await avaliar(`fecharModal()`);

/* ---- portais: todos abertos no modo de teste ---- */
await avaliar(`abrirPainel('portais')`); await esperar(350);
const portais=await avaliar(`({
  esperado:MASMORRAS.length,
  total:document.querySelectorAll('[data-portal]:not([data-diaria="1"])').length,
  bloqueados:document.querySelectorAll('[data-portal].btn-bloq').length,
})`);
if(portais.total!==portais.esperado || portais.bloqueados!==0)
  throw new Error('portais de teste incompletos: '+JSON.stringify(portais));
await avaliar(`modalEntrarPortal(MASMORRAS.at(-1))`); await esperar(250); await captura('mobile-risco-portal.png');
const portrait=await verificarLayout('portrait');

/* ---- landscape + combate ---- */
await cmd('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenWidth:844,screenHeight:390});
await avaliar(`fecharModal(); mudarTab('batalha')`); await esperar(400); await captura('mobile-landscape-vila.png');
await avaliar(`iniciarCombate(MASMORRAS.at(-1),0)`); await esperar(900); await captura('mobile-landscape-combate.png');
const landscape=await verificarLayout('landscape');

console.log('MOBILE PASS',JSON.stringify({conta,loja,fusao,divino,portais,portrait,landscape}));
ws.close();
