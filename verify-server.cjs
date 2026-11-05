const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createHandler}=require('./server.cjs');
async function request(url,{method='GET',origin='null',host='127.0.0.1:8765',data='',upstream}={}){
  const req=Readable.from([typeof data==='string'?data:JSON.stringify(data)]);req.url=url;req.method=method;req.headers={origin,host};
  let status,headers;let finish;const done=new Promise(r=>finish=r);const res={writeHead(s,h){status=s;headers=h;},end(body=''){finish({status,headers,body:String(body)});}};
  await createHandler(upstream||(async()=>{throw Error('Unavailable');}))(req,res);return done;
}
(async()=>{
  const calls=[];
  const upstream=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/api/tags')?{models:[{name:'llama3.2:3b'}]}:{message:{content:'Collect DNS evidence first.'}}};};
  let response=await request('/api/models',{upstream});assert.equal(response.status,200);assert.deepEqual(JSON.parse(response.body),{models:[{name:'llama3.2:3b'}]});
  response=await request('/api/chat',{method:'POST',upstream,data:{model:'llama3.2:3b',messages:[{role:'user',content:'Help me diagnose DNS.'}]}});assert.equal(response.status,200);assert.equal(JSON.parse(response.body).message.content,'Collect DNS evidence first.');
  assert.ok(calls.every(c=>c.url.startsWith('http://127.0.0.1:11434/api/')),'upstream destination is fixed to loopback Ollama');
  const sent=JSON.parse(calls.at(-1).options.body);assert.equal(sent.stream,false);assert.equal(sent.model,'llama3.2:3b');
  response=await request('/api/chat',{method:'POST',upstream,data:{task:'tickets',model:'llama3.2:3b',messages:[{role:'user',content:'Generate a DNS support ticket.'}]}});assert.equal(response.status,200);
  const ticketRequest=JSON.parse(calls.at(-1).options.body);assert.equal(ticketRequest.format,'json');assert.equal(ticketRequest.options.temperature,0.8);
  response=await request('/api/chat',{method:'POST',upstream,data:{model:'not-downloaded:3b',messages:[{role:'user',content:'Hello'}]}});assert.equal(response.status,400);
  response=await request('/api/chat',{method:'POST',upstream,data:{model:'example-cloud',messages:[{role:'user',content:'Hello'}]}});assert.equal(response.status,400);
  response=await request('/api/models',{origin:'https://unrelated.example',upstream});assert.equal(response.status,403);
  response=await request('/api/models',{host:'other.example:8765',upstream});assert.equal(response.status,403);
  response=await request('/api/chat',{method:'POST',data:'{broken'});assert.equal(response.status,400);
  response=await request('/api/chat',{method:'POST',data:'x'.repeat(70000)});assert.equal(response.status,413);
  response=await request('/api/models');assert.equal(response.status,503);
  response=await request('/api/models',{method:'OPTIONS'});assert.equal(response.status,204);
  response=await request('/desktop.js');assert.equal(response.status,200);assert.match(response.body,/renderChrome/);
  response=await request('/desktop.css');assert.equal(response.status,200);assert.match(response.body,/system-tray/);
  response=await request('/not-a-file');assert.equal(response.status,404);
  console.log('PASS: static assets and local Ollama bridge routes, downloaded-model checks, request validation, size limits, origin/host restrictions, and unavailable-service errors (mock upstream; no real model inference).');
})().catch(error=>{console.error(error);process.exitCode=1;});
