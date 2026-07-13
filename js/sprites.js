/* ============ MOTOR DE SPRITES 2D (pixel art) ============
   Carrega sheets de assets/2d, desenha frames com nearest-neighbor,
   espelha e tinge (com cache). Fallback silencioso: se uma imagem não
   carregar, o desenho devolve false e o código volta ao vetorial.      */
'use strict';

const SPR = (function(){
  const BASE = 'assets/2d/';
  const reg = {};            // nome -> {img, ok, w, h, erro}
  const tintCache = {};      // "nome|cor" -> canvas tingido
  const ouvintes = new Set();// callbacks de assets concluídos (cenário pode repintar)

  /* nº de frames por sheet (layout horizontal) */
  const META = {
    soldier_idle:6, soldier_walk:8, soldier_attack:6, soldier_hurt:4, soldier_death:4,
    orc_idle:6, orc_walk:8, orc_attack:6, orc_hurt:4, orc_death:4,
    enemy_skeleton1_idle:6, enemy_skeleton1_walk:10, enemy_skeleton1_attack:9, enemy_skeleton1_death:17, enemy_skeleton1_take_damage:5,
    enemy_skeleton2_idle:6, enemy_skeleton2_walk:10, enemy_skeleton2_attack:15, enemy_skeleton2_death:15, enemy_skeleton2_take_damage:5,
    enemy_vampire_idle:6, enemy_vampire_walk:8, enemy_vampire_attack:16, enemy_vampire_death:14, enemy_vampire_take_damage:5,
    torch_1:1, torch_2:1, torch_3:1, torch_4:1,
  };
  let packMeta = null;

  function aplicarMeta(m){
    if(!m || m.schema!==2 || !m.sheets) throw new Error('sprites-meta.json inválido');
    packMeta = m;
    for(const [nome,spec] of Object.entries(m.sheets)){
      META[nome] = spec.frames;
      if(!reg[nome] && spec.file) carregar(nome, spec.file);  // sheets que só o META anuncia (*_proj)
    }
    for(const [nome,o] of Object.entries(reg)) if(o.ok) validarDimensoes(nome,o);
    return true;
  }
  const metaPromessa = fetch(BASE+'sprites-meta.json', { cache:'no-cache' })
    .then(r=>{ if(!r.ok) throw new Error('META HTTP '+r.status); return r.json(); })
    .then(aplicarMeta)
    .catch(()=>false); // file:// e builds antigos: naturalWidth mantém fallback funcional

  function validarDimensoes(nome,o){
    const spec = packMeta && packMeta.sheets[nome];
    if(!spec) return true;
    const cw=spec.cell?.w||256, ch=spec.cell?.h||256;
    if(o.w !== cw*spec.frames || o.h !== ch){
      o.ok=false; o.erro=`dimensões ${o.w}×${o.h}; esperado ${cw*spec.frames}×${ch}`;
      return false;
    }
    return true;
  }

  function carregar(nome, ficheiro){
    const o = { img:new Image(), ok:false, w:0, h:0, promessa:null };
    o.promessa = new Promise(resolve=>{
      o.img.onload = ()=>{
        o.ok=true; o.w=o.img.naturalWidth; o.h=o.img.naturalHeight;
        // Todos os sheets v2 usam células 256×256; isto mantém file:// útil
        // mesmo quando fetch(JSON) é bloqueado pelo browser.
        if(!META[nome] && o.h===256 && o.w%256===0) META[nome]=o.w/256;
        validarDimensoes(nome,o);
        for(const fn of ouvintes){ try{ fn(nome, true); }catch(e){} }
        resolve(true);
      };
      o.img.onerror = ()=>{
        o.ok=false;
        for(const fn of ouvintes){ try{ fn(nome, false); }catch(e){} }
        resolve(false);
      };
    });
    o.img.src = BASE + ficheiro;
    reg[nome] = o;
    return o.promessa;
  }

  const ok  = nome => { const o=reg[nome]; return !!(o && o.ok); };
  const n   = nome => (packMeta?.sheets?.[nome]?.frames || META[nome] || 1);
  const spec = nome => packMeta?.sheets?.[nome] || null;
  const aoCarregar = fn => { ouvintes.add(fn); return ()=>ouvintes.delete(fn); };
  function esperar(nomes, timeout=5000){
    const lista = [...new Set((nomes||[]).filter(Boolean))];
    const todas = Promise.all([metaPromessa, ...lista.map(nome=> reg[nome] ? reg[nome].promessa : Promise.resolve(false))]);
    if(!timeout) return todas.then(()=>lista.every(ok));
    return Promise.race([todas, new Promise(resolve=>setTimeout(resolve, timeout))])
      .then(()=>lista.every(ok));
  }

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
    const sp = spec(nome), nn = total || sp?.frames || META[nome] || 1;
    const fw = sp?.cell?.w || o.w/nn, fh = sp?.cell?.h || o.h;
    const esc = altDest/fh, dw = fw*esc, dh = altDest;
    const ay = (ancoraY==null ? (sp?.anchor?.y ?? 0.92) : ancoraY);
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
  // CRÍTICO: cenário primeiro. Antes, mais de 100 sheets grandes ficavam à
  // frente destas imagens e o primeiro combate era pré-renderizado no fallback.
  for(let i=1;i<=16;i++){ const t='tex_'+String(i).padStart(2,'0'); carregar(t, t+'.jpg'); }
  carregar('hig_chao_pedra','hig_chao_pedra.jpg');
  carregar('hig_chao_madeira','hig_chao_madeira.jpg');
  carregar('hig_parede','hig_parede.jpg');
  carregar('hig_barril','hig_barril.png');
  carregar('hig_tocha','hig_tocha.png');
  carregar('dungeon_tileset','dungeon_tileset.png');
  for(let i=1;i<=4;i++) carregar('torch_'+i,'torch_'+i+'.png');

  // pack do dono (recorte v2): seis ações e contagens vindas do META/naturalWidth
  for(const a of ['idle','walk','attack','skill','hurt','death']){
    for(const cl of ['guerreiro','mago','batedor','assassino','paladino']){
      for(const s of ['','2']) carregar('heroi_'+cl+s+'_'+a, 'heroi_'+cl+s+'_'+a+'.png');
    }
    for(const e of ['goblin','orcbrute','necro','warlock','bone','plague','stalker','venom','corrupted','templar']){
      carregar('en_'+e+'_'+a, 'en_'+e+'_'+a+'.png');
    }
  }
  // personagens antigos (fallback)
  for(const m of ['idle','walk','attack','hurt','death']){ carregar('soldier_'+m,'soldier_'+m+'.png'); carregar('orc_'+m,'orc_'+m+'.png'); }
  // inimigos pixel (32x32)
  for(const e of ['skeleton1','skeleton2','vampire']) for(const a of ['idle','walk','attack','death','take_damage']) carregar('enemy_'+e+'_'+a,'enemy_'+e+'_'+a+'.png');
  // vila (Cute Fantasy)
  for(const t of ['grass','water','path','water_tile','path_tile','cliff_tile','house','tree','tree_small','decor','chest','fences','bridge']) carregar('cf_'+t,'cf_'+t+'.png');

  return { carregar, esperar, aoCarregar, ok, n, spec, tingir, frameH, tile, imagem, reg,
           meta:()=>packMeta, metaPromessa };
})();
