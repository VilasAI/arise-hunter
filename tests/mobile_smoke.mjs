#!/usr/bin/env node
/* Smoke test visual do jogo real através do Chrome DevTools Protocol.
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

await avaliar(`(()=>{ G=novoJogo(); G.nome='Watcher Teste'; escolherClasse('guerreiro'); entrarNoJogo(); return true; })()`);
await esperar(1400); await captura('mobile-vila.png');
await avaliar(`mudarTab('vigia')`); await esperar(500); await captura('mobile-vigia-resumo.png');
await avaliar(`vigiaSub='poderes'; renderTabConteudo()`); await esperar(350); await captura('mobile-vigia-poderes.png');
await avaliar(`modalEntrarPortal(MASMORRAS[0])`); await esperar(250); await captura('mobile-risco-portal.png');

const layout=await avaliar(`(()=>{
  const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  const botoes=[...document.querySelectorAll('button')].filter(vis).map(e=>({id:e.id||e.textContent.trim().slice(0,24),w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}));
  return {largura:innerWidth,scroll:document.documentElement.scrollWidth,pequenos:botoes.filter(b=>b.w<44||b.h<44)};
})()`);
if(layout.scroll>layout.largura) throw new Error(`overflow horizontal: ${layout.scroll}>${layout.largura}`);
if(layout.pequenos.length) throw new Error('alvos tácteis abaixo de 44px: '+JSON.stringify(layout.pequenos));
await cmd('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenWidth:844,screenHeight:390});
await avaliar(`fecharModal(); mudarTab('batalha')`); await esperar(400); await captura('mobile-landscape-vila.png');
await avaliar(`iniciarCombate(MASMORRAS[0],2)`); await esperar(900); await captura('mobile-landscape-combate.png');
const landscape=await avaliar(`(()=>{
  const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  const botoes=[...document.querySelectorAll('button')].filter(vis).map(e=>({id:e.id||e.textContent.trim().slice(0,24),w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}));
  return {largura:innerWidth,scroll:document.documentElement.scrollWidth,pequenos:botoes.filter(b=>b.w<44||b.h<44)};
})()`);
if(landscape.scroll>landscape.largura || landscape.pequenos.length)
  throw new Error('falha em landscape: '+JSON.stringify(landscape));
console.log('MOBILE PASS',JSON.stringify({portrait:layout,landscape}));
ws.close();
