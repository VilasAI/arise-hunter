/* ============ MOTOR DE SPRITES 2D (pixel art) ============
   Carrega sheets de assets/2d, desenha frames com nearest-neighbor,
   espelha e tinge (com cache). Fallback silencioso: se uma imagem não
   carregar, o desenho devolve false e o código volta ao vetorial.      */
'use strict';

const SPR = (function(){
  const BASE = 'assets/2d/';
  const reg = {};            // nome -> {img, ok, w, h}
  const tintCache = {};      // "nome|cor" -> canvas tingido

  /* nº de frames por sheet (layout horizontal) */
  const META = {
    soldier_idle:6, soldier_walk:8, soldier_attack:6, soldier_hurt:4, soldier_death:4,
    orc_idle:6, orc_walk:8, orc_attack:6, orc_hurt:4, orc_death:4,
    enemy_skeleton1_idle:6, enemy_skeleton1_walk:10, enemy_skeleton1_attack:9, enemy_skeleton1_death:17, enemy_skeleton1_take_damage:5,
    enemy_skeleton2_idle:6, enemy_skeleton2_walk:10, enemy_skeleton2_attack:15, enemy_skeleton2_death:15, enemy_skeleton2_take_damage:5,
    enemy_vampire_idle:6, enemy_vampire_walk:8, enemy_vampire_attack:16, enemy_vampire_death:14, enemy_vampire_take_damage:5,
    torch_1:1, torch_2:1, torch_3:1, torch_4:1,
  };

  function carregar(nome, ficheiro){
    const o = { img:new Image(), ok:false, w:0, h:0 };
    o.img.onload = ()=>{ o.ok=true; o.w=o.img.naturalWidth; o.h=o.img.naturalHeight; };
    o.img.onerror = ()=>{ o.ok=false; };
    o.img.src = BASE + ficheiro;
    reg[nome] = o;
  }

  const ok  = nome => { const o=reg[nome]; return !!(o && o.ok); };
  const n   = nome => META[nome] || 1;

  /* baga uma cópia tingida do sheet inteiro (mantém o sombreado pixel) */
  function tingir(nome, cor){
    const k = nome+'|'+cor; if(tintCache[k]) return tintCache[k];
    const o = reg[nome]; if(!o || !o.ok) return null;
    const cv = document.createElement('canvas'); cv.width=o.w; cv.height=o.h;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled=false;
    x.drawImage(o.img,0,0);
    x.globalCompositeOperation='source-atop';
    x.globalAlpha=0.42; x.fillStyle=cor; x.fillRect(0,0,o.w,o.h);
    tintCache[k]=cv; return cv;
  }

  /* desenha o frame i (de n) de um sheet horizontal.
     ctx já transladado para o ponto do CHÃO (pé do sprite).
     altDest = altura total do frame em px · flip = espelhar ·
     cor = tinta opcional · ancoraY = fração da altura que assenta no chão. */
  function frameH(ctx, nome, i, total, altDest, flip, cor, ancoraY){
    const o = reg[nome]; if(!o || !o.ok) return false;
    const nn = total || META[nome] || 1;
    const fw = o.w/nn, fh = o.h;
    const esc = altDest/fh, dw = fw*esc, dh = altDest;
    const ay = (ancoraY==null ? 0.92 : ancoraY);
    const fonte = cor ? (tingir(nome,cor)||o.img) : o.img;
    const idx = ((i%nn)+nn)%nn;
    ctx.save(); ctx.imageSmoothingEnabled=false;
    if(flip) ctx.scale(-1,1);
    ctx.drawImage(fonte, idx*fw, 0, fw, fh, -dw/2, -ay*dh, dw, dh);
    ctx.restore();
    return true;
  }

  /* desenha uma célula [lin,col] de um tileset de células quadradas (tcell)
     para (dx,dy) com tamanho dsize (canto superior-esquerdo, ctx atual). */
  function tile(ctx, nome, lin, col, tcell, dx, dy, dsize){
    const o = reg[nome]; if(!o || !o.ok) return false;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(o.img, col*tcell, lin*tcell, tcell, tcell, dx, dy, dsize, dsize);
    return true;
  }

  /* desenha uma imagem inteira (ou recorte) centrada no ponto do chão */
  function imagem(ctx, nome, altDest, flip, ancoraY){
    const o = reg[nome]; if(!o || !o.ok) return false;
    const esc = altDest/o.h, dw=o.w*esc, dh=altDest, ay=(ancoraY==null?0.95:ancoraY);
    ctx.save(); ctx.imageSmoothingEnabled=false;
    if(flip) ctx.scale(-1,1);
    ctx.drawImage(o.img, -dw/2, -ay*dh, dw, dh);
    ctx.restore();
    return true;
  }

  /* ---------- pré-carregamento ---------- */
  // personagens
  for(const m of ['idle','walk','attack','hurt','death']){ carregar('soldier_'+m,'soldier_'+m+'.png'); carregar('orc_'+m,'orc_'+m+'.png'); }
  // inimigos pixel (32x32)
  for(const e of ['skeleton1','skeleton2','vampire']) for(const a of ['idle','walk','attack','death','take_damage']) carregar('enemy_'+e+'_'+a,'enemy_'+e+'_'+a+'.png');
  // dungeon
  carregar('dungeon_tileset','dungeon_tileset.png');
  for(let i=1;i<=4;i++) carregar('torch_'+i,'torch_'+i+'.png');
  // vila (Cute Fantasy)
  for(const t of ['grass','water','path','water_tile','path_tile','cliff_tile','house','tree','tree_small','decor','chest','fences','bridge']) carregar('cf_'+t,'cf_'+t+'.png');

  return { carregar, ok, n, tingir, frameH, tile, imagem, reg };
})();
