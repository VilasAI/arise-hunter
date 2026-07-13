import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args=process.argv.slice(2);
const valor=(nome,padrao)=>{const i=args.indexOf(nome);return i>=0&&args[i+1]?args[i+1]:padrao;};
const host=valor('--host','127.0.0.1'),port=Number(valor('--port','4173'));
const raiz=path.resolve(valor('--root',path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};

const servidor=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||host}`);
    let relativo=decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if(!relativo)relativo='index.html';
    let ficheiro=path.resolve(raiz,relativo);
    if(ficheiro!==raiz&&!ficheiro.startsWith(raiz+path.sep))throw new Error('path traversal');
    const info=await stat(ficheiro);if(info.isDirectory())ficheiro=path.join(ficheiro,'index.html');
    const corpo=await readFile(ficheiro);
    res.writeHead(200,{'Content-Type':mime[path.extname(ficheiro).toLowerCase()]||'application/octet-stream',
      'Cache-Control':'no-store, max-age=0','Access-Control-Allow-Origin':'*'});
    res.end(corpo);
  }catch(e){res.writeHead(e?.code==='ENOENT'?404:400,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('Não encontrado');}
});
servidor.listen(port,host,()=>console.log(`VIGILIA A5 http://${host}:${port}`));
for(const sinal of ['SIGINT','SIGTERM'])process.on(sinal,()=>servidor.close(()=>process.exit(0)));
