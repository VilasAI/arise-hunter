#!/usr/bin/env node
/* Testes de save, migração e combate (sem browser):  node tests/saves.js
   Carrega os módulos do jogo num contexto com DOM mínimo e verifica as
   reproduções da auditoria de 2026-07-11: migração antiga, validação
   profunda, importação hostil, migração de classe e morte idempotente. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

/* ---------- contexto: DOM/armazenamento falsos ---------- */
function fakeEl(){
  return new Proxy(function(){}, {
    get(alvo, k){
      if(typeof k === 'symbol') return undefined;
      if(!(k in alvo)) alvo[k] = fakeEl();
      return alvo[k];
    },
    set(alvo, k, v){ alvo[k] = v; return true; },
    apply(){ return fakeEl(); },
  });
}
function fakeStorage(){
  const m = new Map();
  return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k,v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
  };
}
const sandbox = {
  console,
  document: fakeEl(),
  window: fakeEl(),
  location: { search:'' },
  navigator: {},
  localStorage: fakeStorage(),
  AUDIO: { sfx(){}, musica(){}, init(){} },
  btoa: s => Buffer.from(s,'binary').toString('base64'),
  atob: s => Buffer.from(s,'base64').toString('binary'),
  requestAnimationFrame: () => 0,
  cancelAnimationFrame(){},
  performance: { now: () => 0 },
};
vm.createContext(sandbox);

/* ---------- carrega o jogo (um único script: partilham o scope) ---------- */
const RAIZ = path.join(__dirname, '..');
const FICHEIROS = ['js/balance.js','js/data.js','js/powers.js','js/classes.js','js/arvore.js','js/game.js','js/combat.js'];
const codigo = FICHEIROS.map(f => fs.readFileSync(path.join(RAIZ,f),'utf8')).join('\n;\n') + `
;globalThis.jogo = {
  get G(){ return G; }, set G(v){ G = v; },
  get C(){ return C; }, set C(v){ C = v; },
  novoJogo, migrarSave, normalizarSave, prepararSave, carregar, importarSave, exportarSave,
  guardar, escolherClasse, staminaMax, multAltarUlt, ferirInimigo, pontosInvestidos,
  comprarSkin, baseHeroi,
  encantar, fundir, subirSombra, custoSombra, statsSombra, compensacaoSombra,
  rankCacador, despertarDisponivel, tabelaRanking, hojeStr,
  BAL, PODERES, CLASSES, SOMBRAS_BASE, SAVE_KEY,
};`;
vm.runInContext(codigo, sandbox, { filename:'jogo-concatenado.js' });
const jogo = sandbox.jogo;

/* ---------- testes ---------- */
let passaram = 0;
function t(nome, fn){ fn(); console.log('  ✔ ' + nome); passaram++; }

t('jogo novo: valores base sãos', () => {
  jogo.G = jogo.novoJogo();
  assert.equal(jogo.G.nivel, 1);
  assert.equal(jogo.staminaMax(), jogo.BAL.stamina.max);
  assert.ok(isFinite(jogo.multAltarUlt()));
});

t('P1.1: save antigo (stats) recebe os pontos de volta', () => {
  jogo.G = jogo.prepararSave({ nivel:10, stats:{ for:9, agi:3, vit:2, int:1 } });
  assert.equal(jogo.G.pontos, 9 * jogo.BAL.jogador.pontosPorNivel);
  assert.equal(jogo.G._migrado, true);
  assert.equal(jogo.G.stats, undefined);
});

t('P1.2: save parcial não produz NaN nem perde defaults', () => {
  jogo.G = jogo.prepararSave({ nivel:5, base:{ forja:2 }, basicas:null, stamina:{ v:2 }, arvore:{} });
  assert.ok(isFinite(jogo.staminaMax()));
  assert.ok(isFinite(jogo.multAltarUlt()));
  assert.equal(jogo.G.base.forja, 2);
  assert.equal(jogo.G.base.altar, 0);
  assert.equal(jogo.G.basicas.for, 0);
  assert.ok(jogo.G.stamina.ts > 0);
});

t('P1.3: importação hostil fica sem HTML', () => {
  const mau = { nivel:3, nome:'<img src=x onerror=alert(1)>',
    inventario:[{ id:1, tipo:'arma', nome:'<script>x</script>', raridade:'comum', base:6, nivel:0, encante:null }],
    sombras:[{ rank:'E', nome:'<b>xss</b>', nivel:1, ativa:true }] };
  const cod = Buffer.from(unescape(encodeURIComponent(JSON.stringify(mau))),'binary').toString('base64');
  assert.equal(jogo.importarSave(cod), true);
  assert.ok(!/[<>]/.test(jogo.G.nome));
  assert.ok(!/[<>]/.test(jogo.G.inventario[0].nome));
  assert.equal(jogo.G.sombras[0].nome, jogo.SOMBRAS_BASE.E.nome);
});

t('P1.4: escolher classe limpa poderes de outras classes', () => {
  jogo.G = jogo.prepararSave({ nivel:12, poderes:{ lamina:{ tier:2, talento:null } },
                               equipadosPoder:['lamina',null,null], pontosHabUsados:2 });
  assert.equal(jogo.escolherClasse('guerreiro'), true);
  assert.equal(jogo.G.poderes.lamina, undefined);
  assert.ok(jogo.G.poderes.investida);
  assert.equal(jogo.G.equipadosPoder[0], 'investida');
  assert.equal(jogo.G.pontosHabUsados, 0);
  assert.equal(jogo.G.basicas.vit, jogo.CLASSES.guerreiro.basicas.vit);
});

t('P1.4/P2.11: sombras compensadas ao escolher classe não-Assassino', () => {
  jogo.G = jogo.prepararSave({ nivel:8, cristais:0, sombras:[{ rank:'E', nivel:4, ativa:true }] });
  // a migração D032 reembolsa os níveis comprados (E: 4+8+12 = 24)…
  assert.equal(jogo.G.cristais, 24);
  jogo.escolherClasse('mago');
  assert.equal(jogo.G.sombras.length, 0);
  // …e a troca de classe soma o valor simbólico da sombra (4)
  assert.equal(jogo.G.cristais, 24 + 4);
});

t('P1.5: a mesma morte não conta duas vezes', () => {
  jogo.G = jogo.novoJogo();
  const e = { hp:5, hpMax:5, def:0, x:50, y:50, raio:12, classe:'normal', flash:0, congelado:0 };
  jogo.C = { jogador:{ x:0, y:0, hp:100 }, stats:{ hpMax:100 }, inimigos:[e], aliados:[],
             mortes:0, tempo:3, caidos:[], lootPend:[], hitstop:0, shake:0, ult:{ t:0, carga:0 },
             particulas:[], numeros:[], projeteis:[], tiros:[] };
  jogo.ferirInimigo(e, 10, false, '#fff');
  jogo.ferirInimigo(e, 10, false, '#fff');   // proc em cadeia sobre o mesmo alvo
  assert.equal(jogo.C.mortes, 1);
  assert.equal(jogo.G.contadores.mortes, 1);
  assert.equal(e.morteInicio, 3);
  assert.deepEqual(jogo.C.caidos, [e]);       // fica no palco para a animação death
});

t('P1.2: proxId fica acima dos ids importados', () => {
  jogo.G = jogo.prepararSave({ nivel:2, proxId:1,
    inventario:[{ id:7, tipo:'arma', nome:'Adaga do Watcher', raridade:'comum', base:6, nivel:0 }] });
  assert.ok(jogo.G.proxId >= 8);
});

t('P1.2: save ilegível vai para quarentena', () => {
  sandbox.localStorage.setItem(jogo.SAVE_KEY, '{corrompido');
  assert.equal(jogo.carregar(), false);
  assert.ok(sandbox.localStorage.getItem(jogo.SAVE_KEY + '-quarentena'));
});

t('P2.12: falha de gravação não crasha o jogo', () => {
  jogo.G = jogo.novoJogo();
  const setOK = sandbox.localStorage.setItem;
  sandbox.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  jogo.guardar();
  sandbox.localStorage.setItem = setOK;
});

t('schema 3: paletas antigas reembolsadas em cristais', () => {
  jogo.G = jogo.prepararSave({ nivel:6, cristais:10, skins:['padrao','carmesim','gelo'], skinAtiva:'carmesim' });
  assert.equal(jogo.G.cristais, 10 + 120 + 150);
  assert.deepEqual(jogo.G.skins, ['padrao']);
  assert.equal(jogo.G.skinAtiva, 'padrao');
});

t('skins v2: comprar exige a classe certa', () => {
  jogo.G = jogo.prepararSave({ nivel:6, cristais:999 });
  jogo.escolherClasse('mago');
  assert.equal(jogo.comprarSkin('guerreiro2').ok, false);
  assert.equal(jogo.comprarSkin('mago2').ok, true);
  assert.equal(jogo.G.skinAtiva, 'mago2');
  assert.equal(jogo.baseHeroi(), 'soldier');   // sem SPR no teste, cai no fallback
});

t('exportar → importar preserva o essencial', () => {
  jogo.G = jogo.novoJogo(); jogo.G.nivel = 7; jogo.G.ouro = 1234;
  const cod = jogo.exportarSave();
  jogo.G = jogo.novoJogo();
  assert.equal(jogo.importarSave(cod), true);
  assert.equal(jogo.G.nivel, 7);
  assert.equal(jogo.G.ouro, 1234);
});

/* ---------- Bloco 4 (auditoria): beta, economia D032, sombras, ranking ---------- */

t('D032: cristais gastos em poder reembolsados na migração', () => {
  jogo.G = jogo.prepararSave({ nivel:20, classe:'assassino', cristais:0,
    inventario:[{ id:1, tipo:'arma', nome:'Espada do Eco', raridade:'raro', base:10, nivel:0,
                  encante:{ stat:'sorte', nome:'da Fortuna', valor:3 } }],
    sombras:[{ rank:'C', nivel:4, ativa:true }],
    base:{ forja:0, altar:2, reservatorio:0 } });
  // 3 (encante) + 42 (níveis da sombra C: 10+14+18) + 15 (altar nv.2: 5+10)
  assert.equal(jogo.G.cristais, 3 + 42 + 15);
  assert.equal(jogo.G._d032, 60);
  assert.equal(jogo.G.sombras[0].nivel, 4);    // os níveis mantêm-se
  // um save já no schema novo não volta a ser reembolsado
  const cod = jogo.exportarSave();
  jogo.importarSave(cod);
  assert.equal(jogo.G.cristais, 60);
});

t('D032: encantar custa ouro, não cristais', () => {
  jogo.G = jogo.novoJogo(); jogo.G.ouro = 1000; jogo.G.cristais = 0;
  jogo.G.inventario.push({ id:1, tipo:'arma', nome:'X', raridade:'comum', base:6, nivel:0, encante:null });
  assert.equal(jogo.encantar(jogo.G.inventario[0]).ok, true);
  assert.equal(jogo.G.ouro, 1000 - jogo.BAL.economia.encanteOuro);
  assert.equal(jogo.G.cristais, 0);
});

t('D032: subir sombra custa ouro', () => {
  jogo.G = jogo.prepararSave({ nivel:12, classe:'assassino', ouro:5000, cristais:0,
    sombras:[{ rank:'E', nivel:1, ativa:true }] });
  const s = jogo.G.sombras[0];
  assert.equal(jogo.subirSombra(s).ok, true);
  assert.equal(s.nivel, 2);
  assert.equal(jogo.G.ouro, 5000 - jogo.custoSombra({ rank:'E', nivel:1 }));
  assert.equal(jogo.G.cristais, 0);
});

t('D033: sombras incorpóreas — só ataque, sem HP', () => {
  jogo.G = jogo.prepararSave({ nivel:8, classe:'assassino', sombras:[{ rank:'E', nivel:2, ativa:true }] });
  const st = jogo.statsSombra(jogo.G.sombras[0]);
  assert.ok(st.atq > 0);
  assert.equal(st.hp, undefined);
});

t('P2.1: na beta, o rank do caçador e a 2.ª Provação cortam', () => {
  jogo.G = jogo.prepararSave({ nivel:34 });
  assert.equal(jogo.rankCacador(), jogo.BAL.beta.rankMax);
  jogo.G = jogo.prepararSave({ nivel:30, despertar:1 });
  assert.equal(jogo.despertarDisponivel(), false);   // a Provação A fica para a versão completa
  jogo.G = jogo.prepararSave({ nivel:15 });
  assert.equal(jogo.despertarDisponivel(), true);    // a 1.ª (rank C) continua na beta
});

t('P2.7: o ranking é vencível com poder suficiente', () => {
  jogo.G = jogo.novoJogo();
  jogo.G.basicas.for = 200000;                       // poder de fim de jogo
  const tab = jogo.tabelaRanking();
  assert.equal(tab[0].eu, true);
  jogo.G.basicas.for = 0;                            // no arranque fica atrás dos NPC
  assert.equal(jogo.tabelaRanking()[0].eu, false);
});

t('P2.8: o dia do diário é o dia local', () => {
  const d = new Date();
  const esperado = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  assert.equal(jogo.hojeStr(), esperado);
});

t('P2.13: a arma inicial só se oferece uma vez', () => {
  jogo.G = jogo.prepararSave({ nivel:1,
    inventario:[{ id:3, tipo:'arma', nome:'Adaga do Watcher', raridade:'comum', base:8, nivel:0 }] });
  assert.equal(jogo.G.armaInicialDada, true);        // quem tem itens já a recebeu
  jogo.G = jogo.prepararSave({ nivel:1 });
  assert.equal(jogo.G.armaInicialDada, false);       // save virgem ainda recebe a primeira
});

t('P3: fundir rejeita o mesmo item repetido', () => {
  jogo.G = jogo.novoJogo();
  jogo.G.inventario.push({ id:1, tipo:'arma', nome:'X', raridade:'comum', base:6, nivel:0, encante:null });
  assert.equal(jogo.fundir([1,1,1]).ok, false);
});

console.log('\nPASS — ' + passaram + ' testes verdes');
