/* ============ ÁRVORE DE PODERES (D019/D020/D021) ============
   Uma árvore por classe: 3 ramos de poder + ramo do Dom.
   Os TIERS e TALENTOS continuam no sistema existente (G.poderes) —
   a árvore é a camada de aquisição por cima: os nós de tier compram-se
   via evoluirPoder; aqui vivem os nós MENORES e as KEYSTONES.
   Custos (D020): menores 1 ponto · keystones 3 pontos · tiers pontos+ouro. */
'use strict';

/* efeitos dos nós menores (agregados em bonusArvore):
   atqPct/hpPct/defPct/mpPct/velMovPct — % às stats base
   critFlat/critDanoFlat/cdrFlat/sorteFlat/rouboFlat — soma às avançadas
   ultCargaPct — a ultimate carrega mais depressa
   efPoderPct — +% de efeito do poder DESTE ramo                    */
const ARVORES = {
  guerreiro: { ramos: [
    { poder:'investida', menores:[
        { id:'g_i1', nome:'Ímpeto',          req:2, ef:{velMovPct:5} },
        { id:'g_i2', nome:'Carga Pesada',    req:4, ef:{efPoderPct:12} },
      ], keystone:{ id:'g_ks_inv', nome:'Terramoto', desc:'A Investida atordoa os inimigos atravessados (0,8 s).' } },
    { poder:'escudo', menores:[
        { id:'g_e1', nome:'Pele Grossa',     req:2, ef:{defPct:8} },
        { id:'g_e2', nome:'Sangue de Ferro', req:3, ef:{hpPct:8} },
        { id:'g_e3', nome:'Runas Fundas',    req:4, ef:{efPoderPct:12} },
      ], keystone:{ id:'g_ks_esc', nome:'Muralha Viva', desc:'Com o Escudo Rúnico ativo, refletes 15% do dano sofrido.' } },
    { poder:'furia', menores:[
        { id:'g_f1', nome:'Sede de Guerra',  req:2, ef:{atqPct:5} },
        { id:'g_f2', nome:'Fúria Fria',      req:3, ef:{critDanoFlat:20} },
      ], keystone:{ id:'g_ks_fur', nome:'Ira Imortal', desc:'Durante a Fúria, +15% de roubo de vida.' } },
    { dom:true, menores:[
        { id:'g_d1', nome:'Dom Voraz',       ef:{ultCargaPct:12} },
        { id:'g_d2', nome:'Coração de Aço',  ef:{hpPct:6} },
      ], keystone:{ id:'g_ks_dom', nome:'Baluarte Eterno', desc:'O Baluarte de Ferro dura +3 s.' } },
  ]},
  mago: { ramos: [
    { poder:'corrente', menores:[
        { id:'m_c1', nome:'Condutor',        req:2, ef:{efPoderPct:12} },
        { id:'m_c2', nome:'Mente Veloz',     req:3, ef:{cdrFlat:4} },
      ], keystone:{ id:'m_ks_cor', nome:'Tempestade Perfeita', desc:'A Corrente Relâmpago não perde força ao saltar.' } },
    { poder:'brasas', menores:[
        { id:'m_b1', nome:'Cinza Quente',    req:2, ef:{efPoderPct:12} },
        { id:'m_b2', nome:'Fornalha',        req:4, ef:{atqPct:5} },
      ], keystone:{ id:'m_ks_bra', nome:'Pira', desc:'A queimadura das Brasas também abranda os inimigos (15%).' } },
    { poder:'gelo', menores:[
        { id:'m_g1', nome:'Casaco Gélido',   req:2, ef:{defPct:6} },
        { id:'m_g2', nome:'Poço de Mana',    req:3, ef:{mpPct:15} },
      ], keystone:{ id:'m_ks_gel', nome:'Zero Absoluto', desc:'O Manto de Gelo congela +0,6 s.' } },
    { dom:true, menores:[
        { id:'m_d1', nome:'Dom Voraz',       ef:{ultCargaPct:12} },
        { id:'m_d2', nome:'Foco Arcano',     ef:{critFlat:4} },
      ], keystone:{ id:'m_ks_dom', nome:'Olho da Tempestade', desc:'Os meteoros da Tempestade Arcana caem 20% mais depressa.' } },
  ]},
  batedor: { ramos: [
    { poder:'lamina', menores:[
        { id:'b_l1', nome:'Gume Leve',       req:2, ef:{efPoderPct:12} },
        { id:'b_l2', nome:'Pulso Firme',     req:3, ef:{critFlat:4} },
      ], keystone:{ id:'b_ks_lam', nome:'Lâminas Gémeas', desc:'A Lâmina Fantasma dispara +1 projétil.' } },
    { poder:'tiro', menores:[
        { id:'b_t1', nome:'Aljava Funda',    req:2, ef:{efPoderPct:12} },
        { id:'b_t2', nome:'Passo de Gato',   req:4, ef:{velMovPct:5} },
      ], keystone:{ id:'b_ks_tir', nome:'Chuva Negra', desc:'A Chuva de Flechas dispara +2 flechas.' } },
    { poder:'terror', menores:[
        { id:'b_r1', nome:'Presença Fria',   req:2, ef:{defPct:5} },
        { id:'b_r2', nome:'Olhar Certeiro',  req:3, ef:{critDanoFlat:20} },
      ], keystone:{ id:'b_ks_ter', nome:'Pânico', desc:'Inimigos dentro da Aura de Terror sofrem +10% de dano.' } },
    { dom:true, menores:[
        { id:'b_d1', nome:'Dom Voraz',       ef:{ultCargaPct:12} },
        { id:'b_d2', nome:'Instinto',        ef:{sorteFlat:6} },
      ], keystone:{ id:'b_ks_dom', nome:'Época de Caça', desc:'O Tempo de Caça atinge 4 alvos em simultâneo.' } },
  ]},
  assassino: { ramos: [
    { poder:'passo', menores:[
        { id:'a_p1', nome:'Sombra Ligeira',  req:2, ef:{velMovPct:5} },
        { id:'a_p2', nome:'Punhal Oculto',   req:3, ef:{efPoderPct:12} },
      ], keystone:{ id:'a_ks_pas', nome:'Golpe Fantasma', desc:'O Passo Sombrio fere duas vezes (2.º golpe a 60%).' } },
    { poder:'execucao', menores:[
        { id:'a_x1', nome:'Fio da Navalha',  req:2, ef:{critFlat:4} },
        { id:'a_x2', nome:'Mão Firme',       req:4, ef:{efPoderPct:12} },
      ], keystone:{ id:'a_ks_exe', nome:'Decapitar', desc:'Abater com a Execução repõe o cooldown dela.' } },
    { poder:'sede', menores:[
        { id:'a_s1', nome:'Gosto Ferroso',   req:2, ef:{rouboFlat:3} },
        { id:'a_s2', nome:'Vigor Roubado',   req:3, ef:{hpPct:6} },
      ], keystone:{ id:'a_ks_sed', nome:'Marca do Ceifeiro', desc:'Inimigos abaixo de 30% de vida sofrem +15% do teu dano.' } },
    { dom:true, menores:[
        { id:'a_d1', nome:'Dom Voraz',       ef:{ultCargaPct:12} },
        { id:'a_d2', nome:'Elo Sombrio',     ef:{critDanoFlat:20} },
      ], keystone:{ id:'a_ks_dom', nome:'Rei das Sombras', desc:'As tuas sombras têm +25% de stats.' } },
  ]},
  paladino: { ramos: [
    { poder:'luz', menores:[
        { id:'p_l1', nome:'Brilho Interior', req:2, ef:{efPoderPct:12} },
        { id:'p_l2', nome:'Vitalidade',      req:3, ef:{hpPct:8} },
      ], keystone:{ id:'p_ks_luz', nome:'Sol Nascente', desc:'A Luz Sagrada tem +50% de raio.' } },
    { poder:'martelo', menores:[
        { id:'p_m1', nome:'Braço Pesado',    req:2, ef:{atqPct:5} },
        { id:'p_m2', nome:'Eco Sagrado',     req:4, ef:{efPoderPct:12} },
      ], keystone:{ id:'p_ks_mar', nome:'Julgamento', desc:'O Martelo Sagrado atordoa +0,5 s.' } },
    { poder:'bencao', menores:[
        { id:'p_b1', nome:'Devoção',         req:2, ef:{defPct:6} },
        { id:'p_b2', nome:'Graça Serena',    req:3, ef:{cdrFlat:4} },
      ], keystone:{ id:'p_ks_ben', nome:'Aegis', desc:'Quando o teu escudo quebra, explode e fere os inimigos próximos.' } },
    { dom:true, menores:[
        { id:'p_d1', nome:'Dom Voraz',       ef:{ultCargaPct:12} },
        { id:'p_d2', nome:'Luz Constante',   ef:{hpPct:6} },
      ], keystone:{ id:'p_ks_dom', nome:'Alvorada', desc:'A Aurora concede 1,5 s de invulnerabilidade.' } },
  ]},
};

/* ---------- estado ---------- */
function arvoreDaClasse(){
  return (G && G.classe && ARVORES[G.classe]) ? ARVORES[G.classe] : null;
}
function noComprado(id){ return !!(G && G.arvore && G.arvore.nos[id]); }
const arvKeystone = noComprado;   // alias semântico para os hooks no motor

/* um nó menor está disponível? (tier do poder do ramo ≥ req; Dom exige Despertar 1) */
function noDisponivel(ramo, no){
  if(noComprado(no.id)) return {ok:false, msg:'Já comprado.'};
  if(ramo.dom && G.despertar < 1) return {ok:false, msg:'Exige o 1.º Despertar.'};
  if(!ramo.dom && poderTier(ramo.poder) < no.req) return {ok:false, msg:`Exige ${PODERES[ramo.poder].nome} tier ${no.req}.`};
  if(pontosHabDisponiveis() < BAL.arvore.custoMenor) return {ok:false, msg:'Pontos insuficientes.'};
  return {ok:true};
}
function keystoneDisponivel(ramo){
  const ks = ramo.keystone;
  if(noComprado(ks.id)) return {ok:false, msg:'Já comprada.'};
  if(G.despertar < 2) return {ok:false, msg:'Exige o 2.º Despertar.'};
  if(!ramo.dom && poderTier(ramo.poder) < 5) return {ok:false, msg:`Exige ${PODERES[ramo.poder].nome} no tier 5.`};
  if(pontosHabDisponiveis() < BAL.arvore.custoKeystone) return {ok:false, msg:'Pontos insuficientes.'};
  return {ok:true};
}
function comprarNo(ramo, no, keystone){
  const r = keystone ? keystoneDisponivel(ramo) : noDisponivel(ramo, no);
  if(!r.ok) return r;
  G.pontosHabUsados += keystone ? BAL.arvore.custoKeystone : BAL.arvore.custoMenor;
  G.arvore.nos[(keystone ? ramo.keystone : no).id] = true;
  guardar();
  return {ok:true};
}

/* ---------- bónus agregados dos nós menores ---------- */
function bonusArvore(){
  const b = { atqPct:0, hpPct:0, defPct:0, mpPct:0, velMovPct:0,
              critFlat:0, critDanoFlat:0, cdrFlat:0, sorteFlat:0, rouboFlat:0,
              ultCargaPct:0, efPoder:{} };
  const arv = arvoreDaClasse();
  if(!arv || !G.arvore) return b;
  for(const ramo of arv.ramos){
    for(const no of ramo.menores){
      if(!G.arvore.nos[no.id]) continue;
      for(const k of Object.keys(no.ef)){
        if(k==='efPoderPct') b.efPoder[ramo.poder] = (b.efPoder[ramo.poder]||0) + no.ef[k];
        else b[k] += no.ef[k];
      }
    }
  }
  return b;
}

/* ---------- respec (D019: 1.º grátis, depois ouro a crescer com o nível) ---------- */
function custoRespec(){
  return G.arvore.respecs === 0 ? 0
       : BAL.arvore.respecOuroBase + G.nivel * BAL.arvore.respecOuroPorNivel;
}
function resetArvore(){
  const custo = custoRespec();
  if(G.ouro < custo) return {ok:false, msg:'Ouro insuficiente.'};
  G.ouro -= custo;
  G.arvore.nos = {};
  G.arvore.respecs++;
  const inicial = CLASSES[G.classe].inicial;
  G.poderes = {}; G.poderes[inicial] = { tier:1, talento:null };
  G.equipadosPoder = [ PODERES[inicial].tipo==='ativo' ? inicial : null, null, null ];
  G.pontosHabUsados = 0;
  guardar();
  return {ok:true, custo};
}
