const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'dist');
const allowed = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/windows.css':'windows.css','/windows.js':'windows.js','/desktop.css':'desktop.css','/desktop.js':'desktop.js'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
allowed['/workflow.css']='workflow.css';allowed['/workflow.js']='workflow.js';
Object.assign(allowed,{'/lab.html':'lab.html','/landing.css':'landing.css','/landing.js':'landing.js','/native-bridge.js':'native-bridge.js','/aduc.js':'aduc.js','/assets/corpdesk.png':'assets/corpdesk.png','/assets/corpdesk.ico':'assets/corpdesk.ico','/downloads/CORP-Desk-Setup.exe':'downloads/CORP-Desk-Setup.exe','/downloads/release.json':'downloads/release.json'});
Object.assign(mime,{'.png':'image/png','.ico':'image/x-icon','.json':'application/json','.exe':'application/octet-stream','.svg':'image/svg+xml','.webp':'image/webp'});
Object.assign(allowed,{'/rdp.js':'rdp.js','/rdp.css':'rdp.css','/lock.js':'lock.js','/winapps.js':'winapps.js','/winapps.css':'winapps.css','/lock.css':'lock.css','/wallpapers/blue-shield.webp':'wallpapers/blue-shield.webp','/wallpapers/network-constellation.webp':'wallpapers/network-constellation.webp','/wallpapers/emerald-core.webp':'wallpapers/emerald-core.webp'});
// The remote workstation Remote Desktop shows: every file shipped in dist/remote-pc, listed once at startup.
(function addRemotePc(dir,prefix){try{for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=dir+'/'+entry.name;if(entry.isDirectory())addRemotePc(rel);else if(mime[path.extname(entry.name)])allowed['/'+rel]=rel;}}catch{}})('remote-pc');
function createHandler(ollamaFetch=fetch){return async(req,res)=>{
  let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400);res.end('Bad request');return;}
  if(pathname.startsWith('/api/')){
    const origin=req.headers.origin;
    // The hosted copy on Vercel may also call this local server; Host must still be loopback.
    const origins=new Set(['null','http://127.0.0.1:8765','http://localhost:8765','https://corpdesk-it-support-lab.vercel.app']);
    if(!['127.0.0.1:8765','localhost:8765'].includes(req.headers.host)||origin&&!origins.has(origin)){res.writeHead(403);res.end('Local training requests only');return;}
    const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors});res.end(JSON.stringify(data));};
    if(req.method==='OPTIONS'){res.writeHead(204,{...cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Private-Network':'true'});res.end();return;}
    try{
      if(pathname==='/api/models'&&req.method==='GET'){
        const upstream=await ollamaFetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(10000)});
        if(!upstream.ok){json(502,{error:'Local Ollama is not ready.'});return;}
        const data=await upstream.json();json(200,{models:(data.models||[]).map(m=>({name:m.name}))});return;
      }
      if(pathname==='/api/chat'&&req.method==='POST'){
        let size=0,body='';for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>65536){json(413,{error:'Message payload is too large.'});return;}body+=chunk;}
        let data;try{data=JSON.parse(body);}catch{json(400,{error:'Invalid JSON.'});return;}
        if(typeof data.model!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,120}$/.test(data.model)||/cloud/i.test(data.model)){json(400,{error:'Choose a downloaded local model tag; cloud models are not used.'});return;}
        if(!Array.isArray(data.messages)||!data.messages.length||data.messages.length>20||data.messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>9000)){json(400,{error:'Invalid chat messages.'});return;}
        // Require an already-downloaded model, avoiding automatic remote model use.
        const tags=await ollamaFetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(10000)});
        if(!tags.ok){json(502,{error:'Cannot list downloaded Ollama models.'});return;}
        const models=await tags.json();if(!(models.models||[]).some(m=>m.name===data.model||m.model===data.model)){json(400,{error:'Model is not downloaded. Select a model listed in Assistant settings.'});return;}
        const upstream=await ollamaFetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(85000),body:JSON.stringify({model:data.model,messages:data.messages.map(m=>({role:m.role,content:m.content})),stream:false,...(data.task==='tickets'?{format:'json'}:{}),options:{num_ctx:4096,temperature:data.task==='tickets'?0.8:0.2,num_predict:data.task==='tickets'?2500:1200}})});
        if(!upstream.ok){json(502,{error:'Local model request failed. Check Ollama and the selected model.'});return;}
        const answer=await upstream.json();json(200,{message:{role:'assistant',content:String(answer.message?.content||'')}});return;
      }
      json(404,{error:'Unknown local API route.'});return;
    }catch{json(503,{error:'Local Ollama is unavailable or the request timed out. Start Ollama and choose a downloaded model.'});return;}
  }
  const file=allowed[pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(root,file),(err,data)=>{if(err){res.writeHead(500);res.end('Unable to read application file');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
};}
if(require.main===module){
  const server=http.createServer(createHandler());
  server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'Port 8765 is already in use. Close the old lab server or open its existing page.':err.message);process.exitCode=1;});
  server.listen(8765,'127.0.0.1',()=>console.log('CORP Desk ready at http://127.0.0.1:8765'));
}
module.exports={createHandler};
