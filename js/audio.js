/* ============ ÁUDIO (Web Audio — tudo sintetizado, zero ficheiros) ============
   SFX por osciladores + ruído filtrado · música procedural em loop (2 faixas).
   O AudioContext só nasce num gesto do utilizador (política iOS/Android);
   o mute persiste em localStorage, fora do save do jogo.                    */
'use strict';

const AUDIO = (()=>{
  const VOL_SFX = 0.5, VOL_MUS = 0.16;
  let ac = null, gSfx = null, gMus = null;
  let mudo = localStorage.getItem('vigilia.mudo') === '1';
  let faixa = null;             // 'calma' | 'combate' | null
  let passo = 0, proxT = 0;     // agendador da música

  /* cria o contexto no 1.º gesto; nos seguintes só retoma se suspenso */
  function ativar(){
    if(ac){ if(ac.state==='suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    gSfx = ac.createGain(); gSfx.connect(ac.destination);
    gMus = ac.createGain(); gMus.connect(ac.destination);
    aplicarMudo();
    setInterval(agendar, 120);
  }
  window.addEventListener('pointerdown', ativar);

  /* meio segundo de ruído branco, partilhado por todos os "sopros" */
  let bufRuido = null;
  function ruido(){
    if(!bufRuido){
      bufRuido = ac.createBuffer(1, ac.sampleRate/2, ac.sampleRate);
      const d = bufRuido.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
    }
    return bufRuido;
  }

  /* nota percussiva: oscilador com envelope a cair até ao silêncio */
  function tom(t0, onda, f0, f1, dur, vol, destino){
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = onda;
    o.frequency.setValueAtTime(f0, t0);
    if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t0+dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
    o.connect(g); g.connect(destino || gSfx);
    o.start(t0); o.stop(t0+dur+0.02);
  }
  /* rajada de ruído passa-banda (impactos, dash) */
  function sopro(t0, dur, vol, freq){
    const s = ac.createBufferSource(); s.buffer = ruido();
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
    s.connect(f); f.connect(g); g.connect(gSfx);
    s.start(t0); s.stop(t0+dur+0.02);
  }

  /* ---------- SFX ---------- */
  const SFX = {
    golpe(t){    sopro(t,0.07,0.5,900);  tom(t,'triangle',160,70,0.08,0.4); },
    crit(t){     sopro(t,0.10,0.6,1400); tom(t,'triangle',180,60,0.12,0.5);
                 tom(t,'square',880,220,0.10,0.18); },
    dash(t){     sopro(t,0.16,0.35,600); },
    dano(t){     tom(t,'sawtooth',220,90,0.16,0.3); sopro(t,0.08,0.3,400); },
    poder(t){    tom(t,'sawtooth',300,900,0.18,0.22); tom(t,'sine',600,1200,0.15,0.15); },
    ultimate(t){ tom(t,'sawtooth',80,40,0.5,0.5); tom(t,'square',200,800,0.35,0.2);
                 sopro(t,0.4,0.4,300); },
    loot(t){     tom(t,'sine',660,0,0.09,0.25); tom(t+0.09,'sine',880,0,0.14,0.25); },
    nivel(t){    [523,659,784,1047].forEach((f,i)=> tom(t+i*0.09,'square',f,0,0.12,0.14)); },
    ui(t){       tom(t,'square',700,0,0.03,0.08); },
  };
  function sfx(id){ if(!ac || mudo || !SFX[id]) return; SFX[id](ac.currentTime); }

  /* ---------- música: loops de 16 semicolcheias (0 = pausa) ---------- */
  const FAIXAS = {
    calma:   { bpm:66,  ondaArp:'sine',
               baixo:[110,0,0,0,  87,0,0,0,  98,0,0,0,  82,0,0,0],
               arp:  [220,0,262,0, 330,0,262,0, 294,0,247,0, 330,0,247,0] },
    combate: { bpm:132, ondaArp:'square',
               baixo:[110,110,0,110, 0,110,0,98, 87,87,0,87, 0,98,0,110],
               arp:  [440,0,0,349,  0,440,0,0,  415,0,0,349, 0,415,440,0] },
  };
  function agendar(){
    if(!ac || mudo || !faixa){ proxT = 0; return; }
    const fx = FAIXAS[faixa], dur = 15/fx.bpm;    // semicolcheia em segundos
    if(!proxT || proxT < ac.currentTime){ proxT = ac.currentTime+0.05; passo = 0; }
    while(proxT < ac.currentTime + 0.30){
      const i = passo % 16;
      if(fx.baixo[i]) tom(proxT, 'triangle', fx.baixo[i], 0, dur*2.2, 0.5,  gMus);
      if(fx.arp[i])   tom(proxT, fx.ondaArp, fx.arp[i],   0, dur*0.9, 0.12, gMus);
      passo++; proxT += dur;
    }
  }
  function musica(nome){ if(faixa !== nome){ faixa = nome; proxT = 0; } }

  function aplicarMudo(){
    if(!ac) return;
    gSfx.gain.value = mudo ? 0 : VOL_SFX;
    gMus.gain.value = mudo ? 0 : VOL_MUS;
  }
  function alternarMudo(){
    mudo = !mudo;
    localStorage.setItem('vigilia.mudo', mudo ? '1' : '0');
    aplicarMudo();
    return mudo;
  }

  return { sfx, musica, alternarMudo, get mudo(){ return mudo; } };
})();
