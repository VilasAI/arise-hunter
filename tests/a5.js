(function(){
  'use strict';
  const estado={ ready:false, errors:[], resources:[], details:{} };
  window.__A5__=estado;
  document.documentElement.dataset.a5Status='loading';

  function erro(msg){
    estado.errors.push(String(msg));
    document.documentElement.dataset.a5Status='error';
    document.title='A5 ERRO — '+String(msg).slice(0,120);
  }
  window.addEventListener('error',e=>{
    const t=e.target;
    if(t && t!==window && (t.src||t.href)){
      const url=t.src||t.href; estado.resources.push(url); erro('recurso: '+url);
    } else erro(e.message||'erro JavaScript');
  },true);
  window.addEventListener('unhandledrejection',e=>erro(e.reason?.message||e.reason||'promise rejeitada'));

  window.a5Fail=erro;
  window.a5Ready=async function(details={}){
    Object.assign(estado.details,details);
    // dump-dom pode suspender rAF quando a página fica estática. O timeout
    // mantém o contrato headless sem retirar os dois frames de compositor.
    await Promise.race([
      new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),
      new Promise(r=>setTimeout(r,64)),
    ]);
    if(estado.errors.length){ erro(estado.errors[0]); return false; }
    estado.ready=true;
    document.documentElement.dataset.a5Status='ready';
    return true;
  };
})();
