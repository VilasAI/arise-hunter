/* ============ ARTE PROCEDURAL ============
   Estilo cartoon das referências: contorno grosso escuro,
   cores vivas, brilho no canto superior. Três sistemas:
   1) Ícones (ic) — substituem todos os emojis da UI
   2) Sprites de itens — arma/armadura/anel por raridade
   3) Monstros vetoriais — uma espécie, um desenho          */
'use strict';

const ARTE = (function(){
  const TINTA = '#1d1410';            // cor do contorno
  const cacheIc = {}, cacheItem = {};

  /* ---------- helpers ---------- */
  function novo(tam){
    const cv = document.createElement('canvas');
    cv.width = tam*2; cv.height = tam*2;          // 2x para nitidez
    const c = cv.getContext('2d');
    c.scale(tam/24*2, tam/24*2);                  // unidades 0..24
    c.lineJoin='round'; c.lineCap='round';
    return [cv,c];
  }
  function tracar(c, lw=2.2){ c.strokeStyle=TINTA; c.lineWidth=lw; c.stroke(); }
  function brilho(c,x,y,rx,ry,a=0.45,rot=-0.5){
    c.fillStyle=`rgba(255,255,255,${a})`;
    c.beginPath(); c.ellipse(x,y,rx,ry,rot,0,Math.PI*2); c.fill();
  }
  function circulo(c,x,y,r,cor){ c.fillStyle=cor; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); tracar(c); }

  /* ============================================================
     1) ÍCONES — cada função desenha em unidades 0..24
     ============================================================ */
  const ICONES = {
    /* --- recursos --- */
    ouro(c){ // moeda dourada
      circulo(c,12,12,8.5,'#e8b33a');
      c.fillStyle='#f5d76a'; c.beginPath(); c.arc(11,11,6,0,Math.PI*2); c.fill();
      c.strokeStyle='#a8762a'; c.lineWidth=1.6;
      c.beginPath(); c.arc(12,12,5.6,0,Math.PI*2); c.stroke();
      c.fillStyle='#a8762a'; c.font='bold 8px Georgia'; c.textAlign='center'; c.fillText('V',12,15);
      brilho(c,9,8,2.4,1.4);
    },
    cristal(c){ // gema azul lapidada
      c.fillStyle='#3aa0d8';
      c.beginPath(); c.moveTo(12,3); c.lineTo(19,9); c.lineTo(16,20); c.lineTo(8,20); c.lineTo(5,9); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#7accf0';
      c.beginPath(); c.moveTo(12,3); c.lineTo(15,9.5); c.lineTo(9,9.5); c.closePath(); c.fill();
      c.strokeStyle='rgba(255,255,255,0.5)'; c.lineWidth=1;
      c.beginPath(); c.moveTo(8,20); c.lineTo(12,9.5); c.lineTo(16,20); c.stroke();
      brilho(c,9,6,1.6,1);
    },
    stamina(c){ // relâmpago amarelo
      c.fillStyle='#f0c83a';
      c.beginPath(); c.moveTo(14,2); c.lineTo(6,13); c.lineTo(11,13.5); c.lineTo(9,22); c.lineTo(18,10); c.lineTo(13,9.5); c.closePath(); c.fill(); tracar(c);
      brilho(c,12,7,1.6,1);
    },
    ponto(c){ // estrela de atributo
      estrela(c,12,12,8,4,'#f0c052'); brilho(c,10,8,1.8,1.1);
    },
    despertar(c){ estrela(c,12,12,9,4.5,'#e8843a'); c.fillStyle='#ffd9a0'; estrela(c,12,12,4.5,2.2,'#ffd9a0',false); },
    hp(c){ // coração
      c.fillStyle='#d8503c';
      c.beginPath(); c.moveTo(12,21);
      c.bezierCurveTo(2,13,3,5,9,5); c.bezierCurveTo(11,5,12,7,12,8);
      c.bezierCurveTo(12,7,13,5,15,5); c.bezierCurveTo(21,5,22,13,12,21);
      c.closePath(); c.fill(); tracar(c); brilho(c,8.5,8.5,2.2,1.4);
    },
    mana(c){ // gota azul
      c.fillStyle='#4a8fd0';
      c.beginPath(); c.moveTo(12,2.5);
      c.bezierCurveTo(18,10,19,14,16.5,18.5); c.bezierCurveTo(14,22.5,10,22.5,7.5,18.5);
      c.bezierCurveTo(5,14,6,10,12,2.5); c.closePath(); c.fill(); tracar(c);
      brilho(c,9.5,12,2,3,0.4,0.3);
    },
    /* --- equipamento / inventário --- */
    arma(c){ espadaIcone(c,'#b8c4cc','#e8f0f4'); },
    armadura(c){
      c.fillStyle='#8a96a0';
      c.beginPath(); c.moveTo(5,6); c.lineTo(9,4); c.lineTo(12,6); c.lineTo(15,4); c.lineTo(19,6);
      c.lineTo(19,12); c.bezierCurveTo(19,18,16,20,12,21); c.bezierCurveTo(8,20,5,18,5,12); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#b8c4cc';
      c.beginPath(); c.moveTo(5,6); c.lineTo(9,4); c.lineTo(12,6); c.lineTo(12,21); c.bezierCurveTo(8,20,5,18,5,12); c.closePath(); c.fill();
      c.strokeStyle='#4a5258'; c.lineWidth=1.4;
      c.beginPath(); c.moveTo(8,10); c.lineTo(16,10); c.stroke();
      c.fillStyle='#e8b33a'; c.beginPath(); c.arc(12,13.5,1.6,0,Math.PI*2); c.fill();
      brilho(c,8,7,1.8,1.1);
    },
    anel(c){
      c.strokeStyle='#e8b33a'; c.lineWidth=3.4;
      c.beginPath(); c.arc(12,14,6,0,Math.PI*2); c.stroke();
      c.strokeStyle=TINTA; c.lineWidth=1.4;
      c.beginPath(); c.arc(12,14,7.8,0,Math.PI*2); c.stroke();
      c.beginPath(); c.arc(12,14,4.2,0,Math.PI*2); c.stroke();
      c.fillStyle='#c04a8a';
      c.beginPath(); c.moveTo(12,2.5); c.lineTo(16,6.5); c.lineTo(12,10.5); c.lineTo(8,6.5); c.closePath(); c.fill(); tracar(c);
      brilho(c,10.5,5,1.4,0.9);
    },
    mochila(c){
      c.fillStyle='#8a6234';
      c.beginPath(); c.roundRect(4.5,7,15,13,3); c.fill(); tracar(c);
      c.fillStyle='#a87c44';
      c.beginPath(); c.roundRect(4.5,7,15,5.5,3); c.fill(); tracar(c,1.6);
      c.strokeStyle=TINTA; c.lineWidth=2;
      c.beginPath(); c.moveTo(8,7); c.bezierCurveTo(8,3,16,3,16,7); c.stroke();
      c.fillStyle='#e8b33a'; c.beginPath(); c.roundRect(10.4,11,3.2,4,1); c.fill(); tracar(c,1.4);
      brilho(c,8,9,1.8,1);
    },
    heroi(c){ // elmo do Watcher
      c.fillStyle='#2e4632';
      c.beginPath(); c.arc(12,12,8.5,Math.PI*0.9,Math.PI*2.1); c.lineTo(19,18); c.lineTo(5,18); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#e8c49a'; c.beginPath(); c.roundRect(8,11,8,6,2); c.fill(); tracar(c,1.6);
      c.fillStyle=TINTA; c.beginPath(); c.arc(10.5,13.5,1,0,Math.PI*2); c.arc(14.5,13.5,1,0,Math.PI*2); c.fill();
      c.fillStyle='#d4742c'; c.beginPath(); c.roundRect(6,17,12,3.4,1.6); c.fill(); tracar(c,1.6);
      brilho(c,9,7.5,2,1.2);
    },
    sombra(c){ // máscara espectral roxa
      c.fillStyle='#6a4fa8';
      c.beginPath(); c.moveTo(12,3); c.bezierCurveTo(19,3,20,10,19,15);
      c.bezierCurveTo(18.5,19,16,20,15,22); c.lineTo(13,19.5); c.lineTo(12,22); c.lineTo(11,19.5); c.lineTo(9,22);
      c.bezierCurveTo(8,20,5.5,19,5,15); c.bezierCurveTo(4,10,5,3,12,3); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#b89ae8';
      c.beginPath(); c.ellipse(9,11,2.2,3,0.3,0,Math.PI*2); c.fill();
      c.beginPath(); c.ellipse(15,11,2.2,3,-0.3,0,Math.PI*2); c.fill();
      brilho(c,9,5.5,2.2,1.2,0.3);
    },
    /* --- edifícios --- */
    forja(c){ // martelo de ferreiro
      c.save(); c.translate(12,12); c.rotate(-0.7);
      c.fillStyle='#8a6234'; c.beginPath(); c.roundRect(-1.6,-2,3.2,13,1.4); c.fill(); tracar(c,1.8);
      c.fillStyle='#7a8690'; c.beginPath(); c.roundRect(-7,-9,14,7.5,2); c.fill(); tracar(c);
      c.fillStyle='#a8b4bc'; c.beginPath(); c.roundRect(-7,-9,14,3.4,2); c.fill();
      c.restore(); brilho(c,8,6,1.8,1.1);
    },
    loja(c){ // saco de moedas
      c.fillStyle='#a87c44';
      c.beginPath(); c.moveTo(9,6.5); c.bezierCurveTo(3,10,3.5,20,12,20.5);
      c.bezierCurveTo(20.5,20,21,10,15,6.5); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#8a6234'; c.beginPath(); c.roundRect(8.4,4,7.2,3.4,1.6); c.fill(); tracar(c,1.8);
      c.fillStyle='#e8b33a'; c.font='bold 9px Georgia'; c.textAlign='center'; c.fillText('$',12,16.5);
      brilho(c,8.5,11,2,2.8,0.25,0.3);
    },
    portal(c){ // véu arcano em arco
      c.fillStyle='#7a6a55';
      c.beginPath(); c.moveTo(4,21); c.lineTo(4,10); c.arc(12,10,8,Math.PI,0); c.lineTo(20,21);
      c.lineTo(16.5,21); c.lineTo(16.5,10.5); c.arc(12,10.5,4.5,0,Math.PI,true); c.lineTo(7.5,21); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#8a6fc8'; c.beginPath(); c.ellipse(12,14.5,4,6.5,0,0,Math.PI*2); c.fill();
      c.fillStyle='#b89ae8'; c.beginPath(); c.ellipse(11,13,1.8,3.4,0.3,0,Math.PI*2); c.fill();
    },
    base(c){ // casa
      c.fillStyle='#cbb89a'; c.beginPath(); c.roundRect(5,10,14,10.5,1.5); c.fill(); tracar(c);
      c.fillStyle='#9c5e32';
      c.beginPath(); c.moveTo(3,11); c.lineTo(12,3); c.lineTo(21,11); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#3a2616'; c.beginPath(); c.roundRect(10,14,4,6.5,1.4); c.fill(); tracar(c,1.6);
      c.fillStyle='#f0b450'; c.beginPath(); c.roundRect(6.6,12.5,3,3,0.6); c.fill(); tracar(c,1.3);
      brilho(c,8,6.5,2,1.1,0.3);
    },
    quadro(c){ // pergaminho
      c.fillStyle='#e8dcc3';
      c.beginPath(); c.moveTo(6,5); c.lineTo(18,5); c.lineTo(18,19); c.lineTo(6,19); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#c9a86a';
      c.beginPath(); c.roundRect(4.5,3,15,3.4,1.6); c.fill(); tracar(c,1.6);
      c.beginPath(); c.roundRect(4.5,17.8,15,3.4,1.6); c.fill(); tracar(c,1.6);
      c.strokeStyle='#8a6a40'; c.lineWidth=1.2;
      for(let i=0;i<3;i++){ c.beginPath(); c.moveTo(8,9+i*3); c.lineTo(16,9+i*3); c.stroke(); }
    },
    npc(c){ // chapéu de mago
      c.fillStyle='#4a3b5a';
      c.beginPath(); c.ellipse(12,17,9.5,3.4,0,0,Math.PI*2); c.fill(); tracar(c);
      c.beginPath(); c.moveTo(7,16.5); c.bezierCurveTo(8,8,10,4,14.5,2.5);
      c.bezierCurveTo(13.5,7,16,9,16.8,16); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#d4742c'; c.beginPath(); c.roundRect(7,14.4,10,2.6,1.2); c.fill(); tracar(c,1.4);
      estrela(c,14,7,2,1,'#f0c052',false);
    },
    trofeu(c){
      c.fillStyle='#e8b33a';
      c.beginPath(); c.moveTo(7,4); c.lineTo(17,4); c.lineTo(16,11); c.bezierCurveTo(15.5,14,13.5,15,12,15);
      c.bezierCurveTo(10.5,15,8.5,14,8,11); c.closePath(); c.fill(); tracar(c);
      c.strokeStyle=TINTA; c.lineWidth=2;
      c.beginPath(); c.arc(5.5,7,2.6,Math.PI*1.5,Math.PI*0.6); c.stroke();
      c.beginPath(); c.arc(18.5,7,2.6,Math.PI*0.4,Math.PI*1.5); c.stroke();
      c.fillStyle='#e8b33a'; c.beginPath(); c.roundRect(10.6,15,2.8,3,0.8); c.fill(); tracar(c,1.5);
      c.beginPath(); c.roundRect(7.5,18,9,2.8,1.2); c.fill(); tracar(c,1.5);
      brilho(c,9.5,6.5,1.8,1.1);
    },
    missao(c){ // alvo com seta? — selo de missão
      circulo(c,12,12,8.5,'#b05540');
      circulo(c,12,12,5.4,'#e8dcc3');
      circulo(c,12,12,2.2,'#b05540');
      brilho(c,9,8,2,1.2,0.3);
    },
    fugir(c){
      c.strokeStyle='#d8d3c8'; c.lineWidth=3.4;
      c.beginPath(); c.moveTo(6,6); c.lineTo(18,18); c.moveTo(18,6); c.lineTo(6,18); c.stroke();
      c.strokeStyle=TINTA; c.lineWidth=1.2;
    },
    /* --- stats básicas / avançadas --- */
    forca(c){ // punho
      c.fillStyle='#e8c49a';
      c.beginPath(); c.roundRect(5,8,14,11,4); c.fill(); tracar(c);
      c.strokeStyle=TINTA; c.lineWidth=1.6;
      for(let i=0;i<3;i++){ c.beginPath(); c.moveTo(9+i*3.4,8.5); c.lineTo(9+i*3.4,12.5); c.stroke(); }
      c.fillStyle='#d8a87a'; c.beginPath(); c.roundRect(4,11.5,4.4,7,2); c.fill(); tracar(c,1.8);
      brilho(c,8.5,10,1.8,1);
    },
    vit(c){ ICONES.hp(c); },
    agi(c){ // bota alada
      c.fillStyle='#8a6234';
      c.beginPath(); c.moveTo(8,4); c.lineTo(13,4); c.lineTo(13,13); c.lineTo(19,15.5); c.lineTo(19,19) ; c.lineTo(8,19); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#a87c44'; c.beginPath(); c.roundRect(8,4,5,4,1.4); c.fill(); tracar(c,1.5);
      c.fillStyle='#e8f0f4';
      c.beginPath(); c.moveTo(7.5,8); c.lineTo(2.5,7); c.lineTo(7.5,10.5); c.lineTo(3.5,10.5); c.lineTo(7.5,13); c.closePath(); c.fill(); tracar(c,1.4);
    },
    crit(c){ // mira
      c.strokeStyle='#e8843a'; c.lineWidth=2.6;
      c.beginPath(); c.arc(12,12,6.5,0,Math.PI*2); c.stroke();
      c.strokeStyle=TINTA; c.lineWidth=1.2;
      c.beginPath(); c.arc(12,12,7.9,0,Math.PI*2); c.stroke();
      c.beginPath(); c.arc(12,12,5.1,0,Math.PI*2); c.stroke();
      c.strokeStyle='#e8843a'; c.lineWidth=2.2;
      for(const [a,b,d,e] of [[12,1.5,12,6],[12,18,12,22.5],[1.5,12,6,12],[18,12,22.5,12]]){
        c.beginPath(); c.moveTo(a,b); c.lineTo(d,e); c.stroke();
      }
      circulo(c,12,12,1.8,'#e8843a');
    },
    critDano(c){ // explosão estrelada
      estrela(c,12,12,9.5,4,'#e8843a');
      estrela(c,12,12,5,2.2,'#f5d76a',false);
    },
    sorte(c){ // trevo
      c.fillStyle='#5da03c';
      for(const [x,y] of [[8.5,8.5],[15.5,8.5],[8.5,15],[15.5,15]]){
        c.beginPath(); c.arc(x,y,4.2,0,Math.PI*2); c.fill();
      }
      c.beginPath(); c.arc(12,12,3,0,Math.PI*2); c.fill();
      tracarTrevo(c);
      c.strokeStyle='#3a6824'; c.lineWidth=1.8;
      c.beginPath(); c.moveTo(12,14); c.bezierCurveTo(12,18,14,20,16,21); c.stroke();
      brilho(c,8,7,1.6,1);
    },
    roubo(c){ // gota de sangue
      c.fillStyle='#c03a30';
      c.beginPath(); c.moveTo(12,2.5);
      c.bezierCurveTo(18,10,19,14,16.5,18.5); c.bezierCurveTo(14,22.5,10,22.5,7.5,18.5);
      c.bezierCurveTo(5,14,6,10,12,2.5); c.closePath(); c.fill(); tracar(c);
      brilho(c,9.5,12,1.8,2.6,0.35,0.3);
    },
    pen(c){ // ponta de seta a perfurar escudo
      c.fillStyle='#7a8690';
      c.beginPath(); c.moveTo(12,4); c.lineTo(20,7); c.lineTo(19,15); c.bezierCurveTo(18,19,14,21,12,21.5);
      c.bezierCurveTo(10,21,6,19,5,15); c.lineTo(4,7); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#e8843a';
      c.beginPath(); c.moveTo(3,3); c.lineTo(15,12); c.lineTo(9.5,12.5); c.lineTo(7,18) ; c.lineTo(5.5,9.5); c.closePath(); c.fill(); tracar(c,1.8);
    },
    cdr(c){ // ampulheta
      c.fillStyle='#8a6234';
      c.beginPath(); c.roundRect(6,3,12,3,1.4); c.fill(); tracar(c,1.7);
      c.beginPath(); c.roundRect(6,18,12,3,1.4); c.fill(); tracar(c,1.7);
      c.fillStyle='rgba(160,210,230,0.5)';
      c.beginPath(); c.moveTo(8,6); c.lineTo(16,6); c.lineTo(12.8,12) ; c.lineTo(16,18); c.lineTo(8,18); c.lineTo(11.2,12); c.closePath(); c.fill(); tracar(c,1.7);
      c.fillStyle='#f0c83a';
      c.beginPath(); c.moveTo(9.6,6.5); c.lineTo(14.4,6.5); c.lineTo(12,11); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(12,15); c.lineTo(14.6,17.5); c.lineTo(9.4,17.5); c.closePath(); c.fill();
    },
    /* --- poderes --- */
    p_sombras(c){ ICONES.sombra(c); },
    p_lamina(c){ espadaIcone(c,'#8a6fc8','#c4aef0'); },
    p_investida(c){ // rajada de vento
      c.strokeStyle='#b8a8e0'; c.lineWidth=3;
      for(let i=0;i<3;i++){
        c.beginPath(); c.moveTo(3,7+i*5);
        c.bezierCurveTo(10,5.5+i*5,14,8.5+i*5,21,7+i*5);
        c.stroke();
      }
      c.strokeStyle=TINTA; c.lineWidth=1.1;
      for(let i=0;i<3;i++){
        c.beginPath(); c.moveTo(3,7+i*5);
        c.bezierCurveTo(10,5.5+i*5,14,8.5+i*5,21,7+i*5);
        c.stroke();
      }
    },
    p_terror(c){ // caveira gritante
      c.fillStyle='#d8d3c8';
      c.beginPath(); c.arc(12,10.5,7.5,Math.PI*0.95,Math.PI*2.05); c.lineTo(17,17); c.lineTo(7,17); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#6b5a8a';
      c.beginPath(); c.ellipse(9,10,2.2,2.8,0.2,0,Math.PI*2); c.fill();
      c.beginPath(); c.ellipse(15,10,2.2,2.8,-0.2,0,Math.PI*2); c.fill();
      c.fillStyle=TINTA; c.beginPath(); c.ellipse(12,17.5,2.6,3.4,0,0,Math.PI*2); c.fill();
      c.fillStyle='#d8d3c8'; c.fillRect(10.2,15.5,1.2,3); c.fillRect(12.6,15.5,1.2,3);
      brilho(c,9,6,1.8,1,0.35);
    },
    p_sede(c){ ICONES.roubo(c); c.fillStyle='#f5d76a'; },
    p_escudo(c){
      c.fillStyle='#c9a55a';
      c.beginPath(); c.moveTo(12,2.5); c.lineTo(20,5.5); c.lineTo(19,14); c.bezierCurveTo(18,19,14,21.5,12,22);
      c.bezierCurveTo(10,21.5,6,19,5,14); c.lineTo(4,5.5); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#e8cf8a';
      c.beginPath(); c.moveTo(12,2.5); c.lineTo(4,5.5); c.lineTo(5,14); c.bezierCurveTo(6,19,10,21.5,12,22); c.closePath(); c.fill();
      c.fillStyle='#8a6fc8'; estrela(c,12,11,3.4,1.6,'#8a6fc8',false);
      brilho(c,8.5,6,1.6,1);
    },
    p_corrente(c){ ICONES.stamina(c); },
    p_brasas(c){ // chama
      c.fillStyle='#e2762d';
      c.beginPath(); c.moveTo(12,2.5);
      c.bezierCurveTo(16,7,18.5,9,18.5,14); c.bezierCurveTo(18.5,18.5,15.5,21.5,12,21.5);
      c.bezierCurveTo(8.5,21.5,5.5,18.5,5.5,14); c.bezierCurveTo(5.5,10.5,8,8,9,5.5);
      c.bezierCurveTo(10,7.5,11,8,12,2.5); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#f5c245';
      c.beginPath(); c.moveTo(12,9); c.bezierCurveTo(14.5,12,15.5,13.5,15.5,16);
      c.bezierCurveTo(15.5,19,13.8,20.5,12,20.5); c.bezierCurveTo(10.2,20.5,8.5,19,8.5,16);
      c.bezierCurveTo(8.5,13.5,10,12,12,9); c.closePath(); c.fill();
      brilho(c,10,12,1.4,0.9,0.4);
    },
    p_gelo(c){ // floco
      c.strokeStyle='#9ad8f0'; c.lineWidth=2.4;
      for(let i=0;i<3;i++){
        const a=i*Math.PI/3;
        c.beginPath();
        c.moveTo(12-Math.cos(a)*9,12-Math.sin(a)*9);
        c.lineTo(12+Math.cos(a)*9,12+Math.sin(a)*9);
        c.stroke();
        for(const d of [-1,1]){
          c.beginPath();
          c.moveTo(12+Math.cos(a)*5*d,12+Math.sin(a)*5*d);
          c.lineTo(12+Math.cos(a+0.5)*8*d,12+Math.sin(a+0.5)*8*d);
          c.stroke();
        }
      }
      circulo(c,12,12,2.2,'#d8f2fa');
    },
    p_furia(c){ // garra
      c.fillStyle='#d8973c';
      for(let i=0;i<3;i++){
        const x=6+i*5.5;
        c.beginPath(); c.moveTo(x,4+i*1.5);
        c.bezierCurveTo(x+4,9,x+4,15,x+1.5,20.5);
        c.bezierCurveTo(x+0.5,15,x-2,9,x,4+i*1.5);
        c.closePath(); c.fill(); tracar(c,1.8);
      }
    },
    p_passo(c){ // bota com fumo sombrio
      c.fillStyle='#3a3046';
      c.beginPath(); c.moveTo(9,3.5); c.lineTo(14,3.5); c.lineTo(14,12); c.lineTo(20,14.5); c.lineTo(20,18.5); c.lineTo(9,18.5); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#8a6fc8';
      for(const [x,y,r] of [[6,20,2.2],[10,21.5,1.8],[15,21,2]]){
        c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
      }
      brilho(c,11,6,1.6,1,0.25);
    },
    /* --- runas --- */
    r_brasa(c){ runaPedra(c,'#e2762d'); ICONES._mini(c, ()=>{ c.fillStyle='#f5c245'; chamaMini(c,12,12.5,4.4); }); },
    r_gelo(c){ runaPedra(c,'#6db5d8'); c.strokeStyle='#d8f2fa'; c.lineWidth=1.8;
      for(let i=0;i<3;i++){ const a=i*Math.PI/3;
        c.beginPath(); c.moveTo(12-Math.cos(a)*4.4,12-Math.sin(a)*4.4); c.lineTo(12+Math.cos(a)*4.4,12+Math.sin(a)*4.4); c.stroke(); } },
    r_sangue(c){ runaPedra(c,'#c03a30'); c.fillStyle='#f08a80';
      c.beginPath(); c.moveTo(12,7.5); c.bezierCurveTo(15.5,12,15.5,14.5,14,16); c.bezierCurveTo(12.8,17.4,11.2,17.4,10,16); c.bezierCurveTo(8.5,14.5,8.5,12,12,7.5); c.closePath(); c.fill(); },
    r_trovao(c){ runaPedra(c,'#e8c84a'); c.fillStyle='#f5e08a';
      c.beginPath(); c.moveTo(13.5,6.5); c.lineTo(9,13); c.lineTo(11.8,13.2); c.lineTo(10.5,17.5); c.lineTo(15,11.5); c.lineTo(12.4,11.2); c.closePath(); c.fill(); },
    r_fortuna(c){ runaPedra(c,'#5da03c'); c.fillStyle='#9ad06a';
      for(const [x,y] of [[10.4,10.4],[13.6,10.4],[10.4,13.4],[13.6,13.4]]){ c.beginPath(); c.arc(x,y,2,0,Math.PI*2); c.fill(); } },
    _mini(c,f){ f(); },
  };

  function estrela(c,x,y,R,r,cor,contorno=true){
    c.fillStyle=cor; c.beginPath();
    for(let i=0;i<10;i++){
      const a=-Math.PI/2 + i*Math.PI/5, rad=i%2?r:R;
      c.lineTo(x+Math.cos(a)*rad, y+Math.sin(a)*rad);
    }
    c.closePath(); c.fill();
    if(contorno) tracar(c,2);
  }
  function tracarTrevo(c){
    c.strokeStyle=TINTA; c.lineWidth=2;
    for(const [x,y] of [[8.5,8.5],[15.5,8.5],[8.5,15],[15.5,15]]){
      c.beginPath(); c.arc(x,y,4.2,0,Math.PI*2); c.stroke();
    }
  }
  function chamaMini(c,x,y,r){
    c.beginPath(); c.moveTo(x,y-r);
    c.bezierCurveTo(x+r,y-r*0.2,x+r*0.9,y+r*0.5,x,y+r);
    c.bezierCurveTo(x-r*0.9,y+r*0.5,x-r,y-r*0.2,x,y-r);
    c.closePath(); c.fill();
  }
  function runaPedra(c,cor){
    c.fillStyle='#5a5048';
    c.beginPath(); c.moveTo(12,2.5); c.lineTo(19.5,7) ; c.lineTo(19.5,17); c.lineTo(12,21.5); c.lineTo(4.5,17); c.lineTo(4.5,7); c.closePath(); c.fill(); tracar(c);
    c.fillStyle='#6e645a';
    c.beginPath(); c.moveTo(12,2.5); c.lineTo(4.5,7); c.lineTo(4.5,17); c.lineTo(12,21.5); c.closePath(); c.fill();
    c.strokeStyle=cor; c.lineWidth=1.6;
    c.beginPath(); c.moveTo(12,4.5); c.lineTo(17.8,8); c.lineTo(17.8,16); c.lineTo(12,19.5); c.lineTo(6.2,16); c.lineTo(6.2,8); c.closePath(); c.stroke();
  }
  function espadaIcone(c,corLamina,corGume){
    c.save(); c.translate(12,12); c.rotate(Math.PI/4);
    c.fillStyle=corLamina; c.beginPath();
    c.moveTo(-2.2,3); c.lineTo(-2.2,-9.5); c.lineTo(0,-13); c.lineTo(2.2,-9.5); c.lineTo(2.2,3); c.closePath(); c.fill(); tracar(c);
    c.fillStyle=corGume; c.beginPath();
    c.moveTo(-2.2,3); c.lineTo(-2.2,-9.5); c.lineTo(0,-13); c.lineTo(0,3); c.closePath(); c.fill();
    c.fillStyle='#e8b33a'; c.beginPath(); c.roundRect(-5,3,10,2.6,1.2); c.fill(); tracar(c,1.7);
    c.fillStyle='#8a6234'; c.beginPath(); c.roundRect(-1.3,5.6,2.6,5,1.2); c.fill(); tracar(c,1.6);
    c.fillStyle='#e8b33a'; c.beginPath(); c.arc(0,11.6,1.8,0,Math.PI*2); c.fill(); tracar(c,1.5);
    c.restore();
  }

  function dataURL(nome, tam=24){
    const k = nome+'_'+tam;
    if(cacheIc[k]) return cacheIc[k];
    const [cv,c] = novo(tam);
    (ICONES[nome] || ICONES.ponto)(c);
    cacheIc[k] = cv.toDataURL();
    return cacheIc[k];
  }
  function ic(nome, px=18){
    return `<img class="ic" style="width:${px}px;height:${px}px" src="${dataURL(nome, Math.min(48, Math.ceil(px/8)*8+8))}" alt="">`;
  }

  /* ============================================================
     2) SPRITES DE ITENS — estilo das referências: lâminas com
     formas e cores por raridade, contorno grosso, gume claro
     ============================================================ */
  const CORES_RARIDADE = {
    comum:    ['#9aa3a8','#cdd5d8','#5d6468'],
    raro:     ['#4a90c8','#9ed2f0','#2e5f88'],
    epico:    ['#9a6fd0','#d0b4f0','#5e3f8a'],
    lendario: ['#e8a83a','#f7d98a','#a06a1e'],
    mitico:   ['#d84a3a','#f59a80','#8a2a20'],
  };

  function itemSprite(tipo, raridade, variante=0){
    const k = tipo+'_'+raridade+'_'+(variante%3);
    if(cacheItem[k]) return cacheItem[k];
    const [cv,c] = novo(32);
    const [cor, clara, escura] = CORES_RARIDADE[raridade] || CORES_RARIDADE.comum;
    if(tipo==='arma') spriteArma(c, variante%3, cor, clara, escura);
    else if(tipo==='armadura') spriteArmadura(c, variante%3, cor, clara, escura);
    else spriteAnel(c, variante%3, cor, clara, escura);
    cacheItem[k] = cv.toDataURL();
    return cacheItem[k];
  }

  function spriteArma(c, v, cor, clara, escura){
    c.save(); c.translate(12,13); c.rotate(Math.PI/4);
    if(v===0){            // espada reta
      c.fillStyle=cor; c.beginPath();
      c.moveTo(-2.4,3); c.lineTo(-2.4,-10); c.lineTo(0,-14); c.lineTo(2.4,-10); c.lineTo(2.4,3); c.closePath(); c.fill(); tracar(c);
      c.fillStyle=clara; c.beginPath();
      c.moveTo(-2.4,3); c.lineTo(-2.4,-10); c.lineTo(0,-14); c.lineTo(0,3); c.closePath(); c.fill();
      c.strokeStyle=escura; c.lineWidth=1; c.beginPath(); c.moveTo(0,2); c.lineTo(0,-11); c.stroke();
    } else if(v===1){     // lâmina curva (cimitarra)
      c.fillStyle=cor; c.beginPath();
      c.moveTo(-1.5,3); c.bezierCurveTo(-5.5,-4,-4.5,-10,1.5,-14.5);
      c.bezierCurveTo(0.5,-9.5,1.8,-5,2.6,3); c.closePath(); c.fill(); tracar(c);
      c.fillStyle=clara; c.beginPath();
      c.moveTo(-1.5,3); c.bezierCurveTo(-5.5,-4,-4.5,-10,1.5,-14.5);
      c.bezierCurveTo(-1.5,-9.5,-1.5,-4,0.4,3); c.closePath(); c.fill();
    } else {              // machado largo
      c.fillStyle='#8a6234'; c.beginPath(); c.roundRect(-1.4,-12,2.8,16,1.2); c.fill(); tracar(c,1.8);
      c.fillStyle=cor; c.beginPath();
      c.moveTo(1,-11.5); c.bezierCurveTo(8,-10.5,9,-3.5,5,0);
      c.bezierCurveTo(4.5,-4.5,3,-7.5,1,-8); c.closePath(); c.fill(); tracar(c);
      c.fillStyle=clara; c.beginPath();
      c.moveTo(1,-11.5); c.bezierCurveTo(6.5,-10.5,7.6,-5.5,5.8,-2.2);
      c.bezierCurveTo(5.2,-6,3,-8.5,1,-9); c.closePath(); c.fill();
      c.save(); c.scale(-1,1);
      c.fillStyle=cor; c.beginPath();
      c.moveTo(1,-11.5); c.bezierCurveTo(8,-10.5,9,-3.5,5,0);
      c.bezierCurveTo(4.5,-4.5,3,-7.5,1,-8); c.closePath(); c.fill(); tracar(c);
      c.restore();
    }
    if(v!==2){            // guarda + punho
      c.fillStyle='#e8b33a'; c.beginPath(); c.roundRect(-5,3,10,2.6,1.2); c.fill(); tracar(c,1.8);
      c.fillStyle='#8a6234'; c.beginPath(); c.roundRect(-1.4,5.6,2.8,5.5,1.2); c.fill(); tracar(c,1.7);
      c.fillStyle='#e8b33a'; c.beginPath(); c.arc(0,12.2,1.9,0,Math.PI*2); c.fill(); tracar(c,1.6);
    }
    // brilho mágico nas raridades altas
    if(cor!=='#9aa3a8'){
      c.fillStyle='rgba(255,255,255,0.85)';
      estrelinha(c,-1,-8,1.6); estrelinha(c,1.4,-4,1);
    }
    c.restore();
  }
  function estrelinha(c,x,y,r){
    c.beginPath();
    c.moveTo(x,y-r); c.lineTo(x+r*0.3,y-r*0.3); c.lineTo(x+r,y); c.lineTo(x+r*0.3,y+r*0.3);
    c.lineTo(x,y+r); c.lineTo(x-r*0.3,y+r*0.3); c.lineTo(x-r,y); c.lineTo(x-r*0.3,y-r*0.3);
    c.closePath(); c.fill();
  }

  function spriteArmadura(c, v, cor, clara, escura){
    c.fillStyle=cor;
    c.beginPath(); c.moveTo(4.5,7); c.lineTo(8.5,4.5); c.lineTo(12,6.5); c.lineTo(15.5,4.5); c.lineTo(19.5,7);
    c.lineTo(19.5,13); c.bezierCurveTo(19.5,18.5,16,20.5,12,21.5); c.bezierCurveTo(8,20.5,4.5,18.5,4.5,13);
    c.closePath(); c.fill(); tracar(c);
    c.fillStyle=clara;
    c.beginPath(); c.moveTo(4.5,7); c.lineTo(8.5,4.5); c.lineTo(12,6.5); c.lineTo(12,21.5);
    c.bezierCurveTo(8,20.5,4.5,18.5,4.5,13); c.closePath(); c.fill();
    // ombreiras
    c.fillStyle=escura;
    c.beginPath(); c.ellipse(5.4,7.5,2.6,3.2,0.4,0,Math.PI*2); c.fill(); tracar(c,1.7);
    c.beginPath(); c.ellipse(18.6,7.5,2.6,3.2,-0.4,0,Math.PI*2); c.fill(); tracar(c,1.7);
    if(v===0){ c.strokeStyle=escura; c.lineWidth=1.5; c.beginPath(); c.moveTo(7,11.5); c.lineTo(17,11.5); c.moveTo(7.5,15); c.lineTo(16.5,15); c.stroke(); }
    if(v===1){ c.fillStyle='#e8b33a'; estrelinha(c,12,12,2.6); }
    if(v===2){ c.fillStyle=escura; c.beginPath(); c.moveTo(12,9); c.lineTo(15,13); c.lineTo(12,17); c.lineTo(9,13); c.closePath(); c.fill(); tracar(c,1.5); }
    brilho(c,8,8.5,1.8,1.1,0.4);
  }

  function spriteAnel(c, v, cor, clara, escura){
    c.strokeStyle='#e8b33a'; c.lineWidth=3.6;
    c.beginPath(); c.arc(12,14.5,5.8,0,Math.PI*2); c.stroke();
    c.strokeStyle=TINTA; c.lineWidth=1.5;
    c.beginPath(); c.arc(12,14.5,7.7,0,Math.PI*2); c.stroke();
    c.beginPath(); c.arc(12,14.5,4,0,Math.PI*2); c.stroke();
    c.fillStyle=cor;
    if(v===0){ c.beginPath(); c.moveTo(12,2); c.lineTo(16.5,6.5); c.lineTo(12,11); c.lineTo(7.5,6.5); c.closePath(); c.fill(); tracar(c); c.fillStyle=clara; c.beginPath(); c.moveTo(12,2); c.lineTo(7.5,6.5); c.lineTo(12,11); c.closePath(); c.fill(); }
    if(v===1){ circulo(c,12,6.5,4.2,cor); c.fillStyle=clara; c.beginPath(); c.arc(10.8,5.4,2,0,Math.PI*2); c.fill(); }
    if(v===2){ c.beginPath(); c.moveTo(8,9); c.lineTo(9.5,3.5); c.lineTo(14.5,3.5); c.lineTo(16,9); c.closePath(); c.fill(); tracar(c); c.fillStyle=clara; c.fillRect(9.5,4.2,2.2,4.2); }
    c.fillStyle='rgba(255,255,255,0.9)'; estrelinha(c,15.5,4.5,1.5);
  }

  /* arma/armadura com classe escolhida: imagem do pack do dono
     (a skin 2 dos ícones acompanha a aparência vestida do Watcher) */
  const ARMA_CLASSE = { guerreiro:'espada', mago:'cajado', batedor:'arco', assassino:'adaga', paladino:'espada' };
  function imgItem(it, px=44){
    if(typeof G!=='undefined' && G && G.classe && (it.tipo==='arma' || it.tipo==='armadura')){
      const cat = it.tipo==='arma' ? ARMA_CLASSE[G.classe] : 'armadura';
      const skin = G.skinAtiva === G.classe+'2' ? 2 : 1;
      return `<img class="ic" style="width:${px}px;height:${px}px;image-rendering:pixelated" src="assets/2d/icon_${G.classe}_${cat}${skin}.png" alt="">`;
    }
    const variante = (it.nome||'').length % 3;
    return `<img class="ic" style="width:${px}px;height:${px}px" src="${itemSprite(it.tipo, it.raridade, variante)}" alt="">`;
  }

  /* ============================================================
     3) MONSTROS VETORIAIS — desenhados à volta da origem
     (pés em 0,0; ~44 de altura; virados para a esquerda)
     Estilo: contorno grosso, dois tons, olhos brilhantes
     ============================================================ */
  function olho(c,x,y,r,corIris='#f0c040'){
    c.fillStyle='#fff'; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); tracar(c,1.4);
    c.fillStyle=corIris; c.beginPath(); c.arc(x-r*0.25,y,r*0.55,0,Math.PI*2); c.fill();
    c.fillStyle=TINTA; c.beginPath(); c.arc(x-r*0.3,y,r*0.26,0,Math.PI*2); c.fill();
  }

  const MONSTRO_DESENHOS = {
    goblin(c){
      c.fillStyle='#6aa03c';                                 // corpo pera
      c.beginPath(); c.ellipse(0,-13,11,13,0,0,Math.PI*2); c.fill(); tracar(c);
      c.fillStyle='#83b855';
      c.beginPath(); c.ellipse(-3,-15,7,9,0,0,Math.PI*2); c.fill();
      // orelhas grandes
      for(const d of [-1,1]){
        c.fillStyle='#6aa03c';
        c.beginPath(); c.moveTo(d*9,-22); c.lineTo(d*19,-27); c.lineTo(d*9,-17); c.closePath(); c.fill(); tracar(c,2);
      }
      c.fillStyle='#b0452e';                                 // tanga
      c.beginPath(); c.moveTo(-8,-4); c.lineTo(8,-4); c.lineTo(5,2); c.lineTo(-5,2); c.closePath(); c.fill(); tracar(c,1.8);
      olho(c,-5,-19,3.2); olho(c,3,-19,2.8);
      c.fillStyle=TINTA;                                     // sorriso com dente
      c.beginPath(); c.ellipse(-2,-11,4,2.2,0.2,0,Math.PI); c.fill();
      c.fillStyle='#fff'; c.beginPath(); c.moveTo(-5,-11); c.lineTo(-3.6,-8.6); c.lineTo(-2.4,-11); c.closePath(); c.fill();
      // adaga
      c.save(); c.translate(-12,-8); c.rotate(-0.5);
      c.fillStyle='#b8c4cc'; c.fillRect(-1.2,-9,2.4,9); c.fillStyle='#8a6234'; c.fillRect(-1.6,0,3.2,3.6);
      c.restore();
    },
    lobo(c){
      c.fillStyle='#7a828c';                                 // corpo
      c.beginPath(); c.ellipse(2,-10,14,8.5,0.06,0,Math.PI*2); c.fill(); tracar(c);
      c.fillStyle='#9aa4ae';
      c.beginPath(); c.ellipse(3,-7.5,11,4.5,0.06,0,Math.PI*2); c.fill();
      // cabeça + focinho
      c.fillStyle='#7a828c';
      c.beginPath(); c.ellipse(-11,-15,7,6,0,0,Math.PI*2); c.fill(); tracar(c);
      c.beginPath(); c.moveTo(-15,-14); c.lineTo(-22,-12); c.lineTo(-15,-10.5); c.closePath(); c.fill(); tracar(c,1.8);
      // orelhas
      c.beginPath(); c.moveTo(-13,-20); c.lineTo(-15,-26); c.lineTo(-9.5,-21.5); c.closePath(); c.fill(); tracar(c,1.8);
      c.beginPath(); c.moveTo(-8,-21); c.lineTo(-8,-26.5); c.lineTo(-4,-20.5); c.closePath(); c.fill(); tracar(c,1.8);
      // cauda + patas
      c.beginPath(); c.moveTo(15,-12); c.bezierCurveTo(22,-16,23,-21,20,-24); c.bezierCurveTo(20.5,-19,18,-15,13.5,-13.5); c.closePath(); c.fill(); tracar(c,1.8);
      c.strokeStyle=TINTA; c.lineWidth=2; c.fillStyle='#5d646c';
      for(const x of [-7,-2,6,11]){ c.beginPath(); c.roundRect(x,-4.5,3.4,5,1.4); c.fill(); c.stroke(); }
      olho(c,-12,-16.5,2.2,'#d84a3a');
      c.fillStyle='#fff';                                    // presas
      c.beginPath(); c.moveTo(-17,-11.5); c.lineTo(-16,-9.5); c.lineTo(-15,-11.2); c.closePath(); c.fill();
    },
    formiga(c){
      c.fillStyle='#a8432e';                                 // 3 segmentos
      c.beginPath(); c.ellipse(9,-9,8,6.5,0,0,Math.PI*2); c.fill(); tracar(c);
      c.beginPath(); c.ellipse(-1,-11,5.5,5,0,0,Math.PI*2); c.fill(); tracar(c);
      c.beginPath(); c.ellipse(-9,-13,5.8,5,0,0,Math.PI*2); c.fill(); tracar(c);
      c.fillStyle='#c8654a';
      c.beginPath(); c.ellipse(7,-11,5,3.4,0,0,Math.PI*2); c.fill();
      // patas
      c.strokeStyle=TINTA; c.lineWidth=2.2;
      for(const [x1,x2] of [[4,1],[8,7],[12,14]]){
        c.beginPath(); c.moveTo(x1,-8); c.lineTo(x2-3,-3); c.lineTo(x2-4,0); c.stroke();
      }
      // mandíbulas + antenas
      c.beginPath(); c.moveTo(-13,-11); c.bezierCurveTo(-18,-10,-19,-7,-16,-6); c.stroke();
      c.beginPath(); c.moveTo(-13,-15); c.bezierCurveTo(-18,-16,-19,-19,-16,-20); c.stroke();
      c.beginPath(); c.moveTo(-10,-17.5); c.bezierCurveTo(-12,-23,-9,-25,-7,-24); c.stroke();
      olho(c,-11,-14,2,'#f0c040');
    },
    aranha(c){
      // patas (4 de cada lado)
      c.strokeStyle=TINTA; c.lineWidth=2.6;
      for(let i=0;i<4;i++){
        for(const d of [-1,1]){
          c.beginPath(); c.moveTo(d*4,-12);
          c.lineTo(d*(11+i*2.4), -19+i*4.4);
          c.lineTo(d*(15+i*2.6), -14+i*4.4);
          c.stroke();
        }
      }
      c.fillStyle='#3a3240';                                 // abdómen
      c.beginPath(); c.ellipse(4,-12,9.5,8,0,0,Math.PI*2); c.fill(); tracar(c);
      c.fillStyle='#4f4458';
      c.beginPath(); c.ellipse(2,-14,6,4.4,0,0,Math.PI*2); c.fill();
      c.fillStyle='#c03a30';                                 // marca
      c.beginPath(); c.moveTo(4,-16); c.lineTo(7,-11.5); c.lineTo(4,-7); c.lineTo(1,-11.5); c.closePath(); c.fill();
      c.fillStyle='#3a3240';                                 // cabeça
      c.beginPath(); c.ellipse(-7,-10.5,5,4.4,0,0,Math.PI*2); c.fill(); tracar(c);
      for(const [x,y,r] of [[-9.5,-12,1.7],[-6,-12.6,1.3],[-10.5,-9.4,1.1],[-7.2,-9.8,0.9]]){
        c.fillStyle='#d84a3a'; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
        c.fillStyle='rgba(255,255,255,0.8)'; c.beginPath(); c.arc(x-r*0.3,y-r*0.3,r*0.35,0,Math.PI*2); c.fill();
      }
    },
    esqueleto(c){
      c.strokeStyle=TINTA; c.lineWidth=2.2; c.fillStyle='#ddd6c8';
      // pernas
      for(const d of [-1,1]){ c.beginPath(); c.moveTo(d*3.4,-8); c.lineTo(d*4,0); c.stroke(); }
      // caixa torácica
      c.beginPath(); c.ellipse(0,-15,7,8,0,0,Math.PI*2); c.fill(); tracar(c);
      c.strokeStyle='#9a937f'; c.lineWidth=1.6;
      for(let i=0;i<3;i++){ c.beginPath(); c.ellipse(0,-17+i*3.4,5.6-i*0.7,1.7,0,0,Math.PI); c.stroke(); }
      // crânio
      c.fillStyle='#eee8da';
      c.beginPath(); c.arc(0,-28,7,0,Math.PI*2); c.fill(); tracar(c);
      c.fillStyle='#eee8da'; c.beginPath(); c.roundRect(-4,-24.5,8,4.4,1.6); c.fill(); tracar(c,1.7);
      c.fillStyle=TINTA;
      c.beginPath(); c.ellipse(-3,-29,2.2,2.7,0.15,0,Math.PI*2); c.fill();
      c.beginPath(); c.ellipse(3,-29,2.2,2.7,-0.15,0,Math.PI*2); c.fill();
      c.fillStyle='#f0c040'; c.beginPath(); c.arc(-3.4,-29.4,0.9,0,Math.PI*2); c.arc(2.6,-29.4,0.9,0,Math.PI*2); c.fill();
      c.strokeStyle=TINTA; c.lineWidth=1.4;
      for(let i=0;i<3;i++){ c.beginPath(); c.moveTo(-2.6+i*2.6,-24.5); c.lineTo(-2.6+i*2.6,-20.4); c.stroke(); }
      // espada enferrujada
      c.save(); c.translate(-10,-14); c.rotate(-0.65);
      c.fillStyle='#8a7a5c'; c.fillRect(-1.4,-13,2.8,13); tracar(c,1.6);
      c.fillStyle='#6e5a3a'; c.fillRect(-3.4,0,6.8,2.6);
      c.restore();
    },
    espectro(c){
      c.fillStyle='rgba(168,196,230,0.92)';
      c.beginPath(); c.moveTo(0,-30);
      c.bezierCurveTo(10,-30,12,-20,12,-12);
      c.bezierCurveTo(12,-7,10,-7,9,-3); c.lineTo(6,-7); c.lineTo(3,-2);
      c.lineTo(0,-7); c.lineTo(-3,-2); c.lineTo(-6,-7); c.lineTo(-9,-3);
      c.bezierCurveTo(-10,-7,-12,-7,-12,-12);
      c.bezierCurveTo(-12,-20,-10,-30,0,-30);
      c.closePath(); c.fill(); tracar(c);
      c.fillStyle='rgba(220,236,250,0.9)';
      c.beginPath(); c.ellipse(-3,-22,5,7,0.2,0,Math.PI*2); c.fill();
      c.fillStyle='#2a3450';
      c.beginPath(); c.ellipse(-4,-22,2.4,3.2,0.2,0,Math.PI*2); c.fill();
      c.beginPath(); c.ellipse(3,-22,2.4,3.2,-0.2,0,Math.PI*2); c.fill();
      c.beginPath(); c.ellipse(-0.5,-15,3,4,0,0,Math.PI*2); c.fill();
      c.fillStyle='#e8843a'; c.beginPath(); c.arc(-4.6,-23,1,0,Math.PI*2); c.arc(2.4,-23,1,0,Math.PI*2); c.fill();
    },
    orc(c){
      c.fillStyle='#5d8a3c';                                 // tronco maciço
      c.beginPath(); c.moveTo(-12,-4); c.bezierCurveTo(-15,-20,-8,-26,0,-26);
      c.bezierCurveTo(9,-26,15,-19,12,-4); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#76a554';
      c.beginPath(); c.ellipse(-4,-18,7,9,0.1,0,Math.PI*2); c.fill();
      // pernas
      c.fillStyle='#4a3826';
      for(const d of [-1,1]){ c.beginPath(); c.roundRect(d*7-3.4,-6,6.8,6.5,2); c.fill(); tracar(c,2); }
      // ombreira de ferro
      c.fillStyle='#7a8690'; c.beginPath(); c.ellipse(9,-24,6,4.4,-0.3,0,Math.PI*2); c.fill(); tracar(c,2);
      c.fillStyle='#a8b4bc'; c.beginPath(); c.ellipse(8,-25,3.4,2.2,-0.3,0,Math.PI*2); c.fill();
      // cabeça baixa com presas
      c.fillStyle='#5d8a3c'; c.beginPath(); c.arc(-6,-29,7.5,0,Math.PI*2); c.fill(); tracar(c);
      olho(c,-9,-30.5,2.4,'#e8843a');
      c.fillStyle=TINTA; c.beginPath(); c.ellipse(-8,-25,3.4,1.7,0.15,0,Math.PI); c.fill();
      c.fillStyle='#fff';
      c.beginPath(); c.moveTo(-11.4,-24.6); c.lineTo(-10.4,-27.6); c.lineTo(-9.4,-24.8); c.closePath(); c.fill(); tracar(c,1.1);
      c.beginPath(); c.moveTo(-6.4,-24.4); c.lineTo(-5.4,-27.2); c.lineTo(-4.6,-24.6); c.closePath(); c.fill(); tracar(c,1.1);
      // machado às costas
      c.save(); c.translate(13,-16); c.rotate(0.5);
      c.fillStyle='#8a6234'; c.fillRect(-1.5,-12,3,18); tracar(c,1.7);
      c.fillStyle='#9aa4ae';
      c.beginPath(); c.moveTo(0,-12); c.bezierCurveTo(8,-11,9,-4,4,-1.5); c.bezierCurveTo(4,-6,2,-9,0,-9.5); c.closePath(); c.fill(); tracar(c,1.8);
      c.restore();
    },
    orcmago(c){
      c.fillStyle='#5a3f7a';                                 // túnica roxa
      c.beginPath(); c.moveTo(-10,0); c.bezierCurveTo(-12,-18,-6,-26,0,-26);
      c.bezierCurveTo(7,-26,12,-17,10,0); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#7a5a9c';
      c.beginPath(); c.moveTo(-8,-2); c.bezierCurveTo(-10,-17,-5,-24,0,-24); c.lineTo(0,-2); c.closePath(); c.fill();
      c.fillStyle='#5d8a3c';                                 // cabeça verde encapuzada
      c.beginPath(); c.arc(-4,-28,6.5,0,Math.PI*2); c.fill(); tracar(c);
      c.fillStyle='#5a3f7a';
      c.beginPath(); c.moveTo(-12,-28); c.bezierCurveTo(-10,-38,4,-38,5,-28);
      c.bezierCurveTo(0,-32,-7,-32,-12,-28); c.closePath(); c.fill(); tracar(c);
      olho(c,-6.5,-29,2.2,'#b89ae8');
      c.fillStyle='#fff'; c.beginPath(); c.moveTo(-8.5,-24.5); c.lineTo(-7.5,-26.8); c.lineTo(-6.6,-24.6); c.closePath(); c.fill();
      // cajado com orbe
      c.strokeStyle='#5d4a30'; c.lineWidth=2.6;
      c.beginPath(); c.moveTo(-13,0); c.lineTo(-14,-32); c.stroke();
      circulo(c,-14.3,-34.5,3.4,'#b89ae8');
      brilho(c,-15.4,-35.6,1.1,0.7,0.8);
    },
    draconiano(c){
      c.fillStyle='#3c8a82';                                 // corpo
      c.beginPath(); c.moveTo(-9,0); c.bezierCurveTo(-12,-16,-6,-24,1,-24);
      c.bezierCurveTo(9,-24,13,-16,10,0); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#5aa89e';
      c.beginPath(); c.ellipse(-2,-13,5.5,9,0.1,0,Math.PI*2); c.fill();
      // barriga com escamas
      c.strokeStyle='#2a6058'; c.lineWidth=1.5;
      for(let i=0;i<4;i++){ c.beginPath(); c.ellipse(-2,-6-i*4,4.4-i*0.5,1.8,0,0,Math.PI); c.stroke(); }
      // cauda
      c.fillStyle='#3c8a82';
      c.beginPath(); c.moveTo(9,-6); c.bezierCurveTo(18,-6,21,-12,19,-17);
      c.bezierCurveTo(18,-12,14,-9.5,8,-9.5); c.closePath(); c.fill(); tracar(c,1.9);
      // cabeça com focinho
      c.beginPath(); c.ellipse(-6,-27,6.5,5.4,0.1,0,Math.PI*2); c.fill(); tracar(c);
      c.beginPath(); c.moveTo(-11,-27); c.lineTo(-18,-25.5); c.lineTo(-11,-23.5); c.closePath(); c.fill(); tracar(c,1.8);
      // cristas
      c.fillStyle='#e8843a';
      for(let i=0;i<3;i++){
        c.beginPath(); c.moveTo(-4+i*4,-31-(i===1?2:0));
        c.lineTo(-2+i*4,-36-(i===1?2.5:0)); c.lineTo(0+i*4,-30.5-(i===1?2:0)); c.closePath(); c.fill(); tracar(c,1.5);
      }
      olho(c,-8,-28.5,2.2,'#f0c040');
      c.fillStyle='#fff'; c.beginPath(); c.moveTo(-13.5,-24.6); c.lineTo(-12.6,-26.4); c.lineTo(-11.8,-24.7); c.closePath(); c.fill();
    },
    golem(c){
      c.fillStyle='#9ecfe6';                                 // blocos de gelo
      c.beginPath(); c.roundRect(-12,-22,24,20,4); c.fill(); tracar(c);
      c.fillStyle='#c8e8f5';
      c.beginPath(); c.moveTo(-12,-22); c.lineTo(0,-22); c.lineTo(-4,-2) ; c.lineTo(-12,-2); c.closePath(); c.fill();
      c.fillStyle='#9ecfe6';                                 // cabeça-bloco
      c.beginPath(); c.roundRect(-9,-32,15,11,3); c.fill(); tracar(c);
      c.fillStyle='#c8e8f5'; c.beginPath(); c.roundRect(-9,-32,7,11,3); c.fill();
      // braços
      for(const d of [-1,1]){
        c.fillStyle='#86bcd8';
        c.beginPath(); c.roundRect(d*12-(d>0?0:8),-20,8,15,3); c.fill(); tracar(c,2);
      }
      // fissuras + olhos gelados
      c.strokeStyle='rgba(40,90,120,0.6)'; c.lineWidth=1.4;
      c.beginPath(); c.moveTo(-6,-16); c.lineTo(-2,-12); c.lineTo(-4,-8); c.stroke();
      c.beginPath(); c.moveTo(5,-20); c.lineTo(8,-15); c.stroke();
      c.fillStyle='#2a6088';
      c.beginPath(); c.roundRect(-6.5,-29,4,3,1); c.fill();
      c.beginPath(); c.roundRect(0.5,-29,4,3,1); c.fill();
      c.fillStyle='#7af0ff'; c.fillRect(-5.6,-28.4,2,1.6); c.fillRect(1.4,-28.4,2,1.6);
      brilho(c,-6,-27,4,2,0.18,-0.3);
    },
    cavaleiro(c){
      c.fillStyle='#2e2a3a';                                 // armadura sombria
      c.beginPath(); c.moveTo(-10,-2); c.bezierCurveTo(-12,-18,-7,-25,0,-25);
      c.bezierCurveTo(8,-25,12,-17,10,-2); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#454058';
      c.beginPath(); c.moveTo(-8,-4); c.bezierCurveTo(-10,-17,-5,-23,0,-23); c.lineTo(0,-4); c.closePath(); c.fill();
      // pernas blindadas
      for(const d of [-1,1]){ c.fillStyle='#2e2a3a'; c.beginPath(); c.roundRect(d*5-3,-5,6,5.6,2); c.fill(); tracar(c,1.9); }
      // elmo com chifres
      c.fillStyle='#2e2a3a'; c.beginPath(); c.arc(-2,-29,7,0,Math.PI*2); c.fill(); tracar(c);
      c.fillStyle='#454058'; c.beginPath(); c.arc(-4,-30,4.4,0,Math.PI*2); c.fill();
      c.strokeStyle=TINTA; c.lineWidth=2;
      for(const d of [-1,1]){
        c.fillStyle='#5d5570';
        c.beginPath(); c.moveTo(d*6-2,-33); c.bezierCurveTo(d*11-2,-37,d*12-2,-42,d*9-2,-44);
        c.bezierCurveTo(d*10-2,-40,d*8-2,-36,d*4-2,-34.5); c.closePath(); c.fill(); c.stroke();
      }
      // visor flamejante
      c.fillStyle='#8a6fc8'; c.beginPath(); c.roundRect(-8.4,-30.5,9,3,1.5); c.fill();
      c.fillStyle='#d0baff'; c.fillRect(-7.4,-30,3,2);
      // montante
      c.save(); c.translate(11,-14); c.rotate(0.25);
      c.fillStyle='#6e6884'; c.beginPath();
      c.moveTo(-2,-20); c.lineTo(0,-24); c.lineTo(2,-20); c.lineTo(2,4); c.lineTo(-2,4); c.closePath(); c.fill(); tracar(c,1.9);
      c.fillStyle='#9a93b4'; c.beginPath(); c.moveTo(-2,-20); c.lineTo(0,-24); c.lineTo(0,4); c.lineTo(-2,4); c.closePath(); c.fill();
      c.fillStyle='#8a6fc8'; c.fillRect(-4.4,4,8.8,2.6);
      c.restore();
    },
    sacerdote(c){
      c.fillStyle='#262030';                                 // manto negro
      c.beginPath(); c.moveTo(-11,0); c.bezierCurveTo(-13,-18,-7,-28,0,-28);
      c.bezierCurveTo(8,-28,13,-17,11,0); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#37304a';
      c.beginPath(); c.moveTo(-9,-2); c.bezierCurveTo(-11,-17,-5,-26,0,-26); c.lineTo(0,-2); c.closePath(); c.fill();
      // capuz com vazio dentro
      c.fillStyle='#262030';
      c.beginPath(); c.moveTo(-10,-26); c.bezierCurveTo(-9,-38,7,-38,8,-26);
      c.bezierCurveTo(3,-30,-5,-30,-10,-26); c.closePath(); c.fill(); tracar(c);
      c.fillStyle='#0a0810';
      c.beginPath(); c.ellipse(-1.5,-29,5,4,0,0,Math.PI*2); c.fill();
      c.fillStyle='#d84a3a';
      c.beginPath(); c.arc(-3.6,-29.5,1.2,0,Math.PI*2); c.arc(0.8,-29.5,1.2,0,Math.PI*2); c.fill();
      // debrum rúnico
      c.strokeStyle='#8a6fc8'; c.lineWidth=1.6;
      c.beginPath(); c.moveTo(-8,-6); c.bezierCurveTo(-3,-9,3,-9,8,-6); c.stroke();
      // foice lunar
      c.strokeStyle='#5d4a30'; c.lineWidth=2.4;
      c.beginPath(); c.moveTo(-13,0); c.lineTo(-14,-30); c.stroke();
      c.fillStyle='#b8c4cc';
      c.beginPath(); c.moveTo(-14,-30); c.bezierCurveTo(-22,-32,-24,-38,-20,-41);
      c.bezierCurveTo(-21,-37,-18,-33,-13,-32.6); c.closePath(); c.fill(); tracar(c,1.8);
    },
  };

  /* adornos de boss por cima do desenho-base */
  const ADORNOS = {
    coroa(c){
      c.fillStyle='#e8b33a';
      c.beginPath(); c.moveTo(-8,-36); c.lineTo(-8,-42); c.lineTo(-4.5,-38.5); c.lineTo(-1,-44);
      c.lineTo(2.5,-38.5); c.lineTo(6,-42); c.lineTo(6,-36); c.closePath(); c.fill(); tracar(c,2);
      c.fillStyle='#d84a3a'; c.beginPath(); c.arc(-1,-39,1.4,0,Math.PI*2); c.fill();
    },
    asas(c){
      for(const d of [-1,1]){
        c.fillStyle='rgba(200,180,230,0.55)';
        c.beginPath(); c.moveTo(d*8,-18);
        c.bezierCurveTo(d*26,-30,d*30,-16,d*14,-10);
        c.closePath(); c.fill(); tracar(c,1.8);
        c.strokeStyle=TINTA; c.lineWidth=1.2;
        c.beginPath(); c.moveTo(d*10,-17); c.lineTo(d*24,-21); c.stroke();
      }
    },
    capa(c){
      c.fillStyle='#8a2a20';
      c.beginPath(); c.moveTo(-2,-26); c.bezierCurveTo(14,-24,18,-8,15,2);
      c.lineTo(8,-2); c.bezierCurveTo(10,-12,7,-22,-2,-24); c.closePath(); c.fill(); tracar(c,2);
    },
    aura(c){
      c.strokeStyle='rgba(138,111,200,0.65)'; c.lineWidth=2.2;
      c.beginPath(); c.ellipse(0,-16,17,22,0,0,Math.PI*2); c.stroke();
      c.strokeStyle='rgba(138,111,200,0.3)'; c.lineWidth=5;
      c.beginPath(); c.ellipse(0,-16,19,24,0,0,Math.PI*2); c.stroke();
    },
  };

  /* desenhar um monstro num contexto de combate (pés na origem) */
  function monstro(ctx, sprite, adornos, tinta){
    const fn = MONSTRO_DESENHOS[sprite] || MONSTRO_DESENHOS.goblin;
    fn(ctx);
    if(adornos) for(const a of adornos){ (ADORNOS[a]||(()=>{}))(ctx); }
    if(tinta){                       // recolorir (sombras aliadas)
      ctx.save();
      ctx.globalCompositeOperation='source-atop';
      ctx.fillStyle=tinta;
      ctx.fillRect(-40,-60,80,70);
      ctx.restore();
    }
  }

  /* sprite de monstro tintado e em cache (para sombras aliadas) */
  const cacheTinta = {};
  function monstroTintado(sprite, tinta){
    const k = sprite+'_'+tinta;
    if(cacheTinta[k]) return cacheTinta[k];
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 140;
    const c = cv.getContext('2d');
    c.setTransform(2,0,0,2,80,130);     // pés em (80,130), escala 2x
    c.lineJoin='round'; c.lineCap='round';
    (MONSTRO_DESENHOS[sprite] || MONSTRO_DESENHOS.goblin)(c);
    c.setTransform(1,0,0,1,0,0);
    c.globalCompositeOperation='source-atop';
    c.fillStyle=tinta; c.fillRect(0,0,160,140);
    cacheTinta[k] = cv;
    return cv;
  }

  /* desenhar um ícone diretamente noutro canvas (tabuletas da vila) */
  function desenharIcone(c2, nome, x, y, px){
    c2.save();
    c2.translate(x - px/2, y - px/2);
    c2.scale(px/24, px/24);
    c2.lineJoin='round'; c2.lineCap='round';
    (ICONES[nome] || ICONES.ponto)(c2);
    c2.restore();
  }

  return { ic, dataURL, imgItem, itemSprite, monstro, monstroTintado, desenharIcone, CORES_RARIDADE };
})();

const ic = ARTE.ic;
