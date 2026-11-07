import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
const base='https://namo-agent-world.example.workers.dev';
function mockEnv(extra={}){
 const rows=[];let next=1;
 const DB={prepare(sql){let values=[];return {bind(...v){values=v;return this},async all(){return {results:rows.slice().sort((a,b)=>b.id-a.id)}},async first(){return rows.find(x=>x.id===values[0])||null},async run(){
 if(sql.startsWith('INSERT')){let id=next++;rows.push({id,title:values[0],description:values[1],role:values[2],status:values[3],result:'',error:'',created_at:values[4],updated_at:values[5]});return {meta:{last_row_id:id,changes:1}}}
 if(sql.startsWith('DELETE')){const i=rows.findIndex(t=>t.id===values[0]);if(i>=0){rows.splice(i,1);return {meta:{changes:1}}}return {meta:{changes:0}}}
 if(sql.includes("AND status IN ('assigned','failed')")){const t=rows.find(x=>x.id===values[2] && ['assigned','failed'].includes(x.status));if(t){t.status='completed';t.result=values[0];t.error='';return {meta:{changes:1}}}return {meta:{changes:0}}}
 if(sql.includes('WHERE id=? AND status IN')){const t=rows.find(x=>x.id===values[2]&&['new','assigned','failed'].includes(x.status));if(t){t.status=values[0];t.updated_at=values[1];return {meta:{changes:1}}}return {meta:{changes:0}}}
 if(sql.includes("SET status='working'")){const t=rows.find(x=>x.id===values[1]&&x.status==='assigned');if(t){t.status='working';return {meta:{changes:1}}}return {meta:{changes:0}}}
 if(sql.includes("SET status='completed'")){const t=rows.find(x=>x.id===values[2]);if(t){t.status='completed';t.result=values[0];return {meta:{changes:1}}}return {meta:{changes:0}}}
 if(sql.includes("SET status='failed'")){const t=rows.find(x=>x.id===values[2]);if(t){t.status='failed';t.error=values[0];return {meta:{changes:1}}}return {meta:{changes:0}}}
 throw new Error('Unknown SQL: '+sql);
 }};}}
 return {DB,OWNER_KEY:'strong-secret-demo-code-123',GEMINI_API_KEY:'gemini-test-secret',ASSETS:{fetch:async()=>new Response('static-test')},...extra};
}
const request=(route,key='strong-secret-demo-code-123',method='GET',body)=>new Request(base+route,{method,headers:{...(key?{'X-Namo-Key':key}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
test('assets served and public health checked',async()=>{
 const env=mockEnv();const a=await worker.fetch(request('/'),env);assert.equal(await a.text(),'static-test');const h=await worker.fetch(request('/api/health',null),env);assert.equal((await h.json()).ok,true);
});
test('owner key required and unknown endpoints denied',async()=>{
 const env=mockEnv();assert.equal((await worker.fetch(request('/api/state',null),env)).status,401);
 assert.equal((await worker.fetch(request('/api/state','wrong'),env)).status,401);
 assert.equal((await worker.fetch(request('/api/missing'),env)).status,404);
});
test('task lifecycle D1 cloud sync, assignment only from client',async()=>{
 const env=mockEnv();let r=await worker.fetch(request('/api/tasks',undefined,'POST',{title:'Create a design',description:'spec',role:'designer'}),env);assert.equal(r.status,201);const t=(await r.json()).task;assert.equal(t.status,'new');assert.equal(t.role,'designer');
 r=await worker.fetch(request('/api/state'),env);assert.equal((await r.json()).tasks.length,1);
 r=await worker.fetch(request('/api/tasks/'+t.id,undefined,'PATCH',{status:'completed'}),env);assert.equal(r.status,400);
 r=await worker.fetch(request('/api/tasks/'+t.id,undefined,'PATCH',{status:'assigned'}),env);assert.equal(r.status,200);
 assert.equal((await r.json()).task.status,'assigned');
 r=await worker.fetch(request('/api/tasks/'+t.id,undefined,'DELETE'),env);assert.equal(r.status,200);
 r=await worker.fetch(request('/api/state'),env);assert.equal((await r.json()).tasks.length,0);
});
test('Gemini response is actual generated content, keys never exposed',async()=>{
 const env=mockEnv();const oldFetch=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  assert.equal(opts.headers['x-goog-api-key'],'gemini-test-secret');
  assert.match(url,/gemini-3\.1-flash-lite/);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'ผลวิเคราะห์งานจาก Gemini จริงในแบบทดสอบ'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const t=(await (await worker.fetch(request('/api/tasks',undefined,'POST',{title:'Build app',role:'developer'}),env)).json()).task;
  await worker.fetch(request('/api/tasks/'+t.id,undefined,'PATCH',{status:'assigned'}),env);
  const res=await worker.fetch(request('/api/run',undefined,'POST',{id:t.id}),env);assert.equal(res.status,200);const result=(await res.json()).task;
  assert.equal(result.status,'completed');assert.match(result.result,/Gemini/);
  assert.equal(JSON.stringify(result).includes('gemini-test-secret'),false);
 }finally{globalThis.fetch=oldFetch}
});
test('without Gemini secret cannot claim task completed',async()=>{
 const env=mockEnv({GEMINI_API_KEY:''});const t=(await (await worker.fetch(request('/api/tasks',undefined,'POST',{title:'Task',role:'qa'}),env)).json()).task;
 await worker.fetch(request('/api/tasks/'+t.id,undefined,'PATCH',{status:'assigned'}),env);
 const res=await worker.fetch(request('/api/run',undefined,'POST',{id:t.id}),env);assert.equal(res.status,503);
 const state=(await (await worker.fetch(request('/api/state'),env)).json()).tasks[0];assert.equal(state.status,'assigned');
});
test('XSS strings are stored as data, server rejects cross-origin writes',async()=>{
 const env=mockEnv();const req=new Request(base+'/api/tasks',{method:'POST',headers:{'Origin':'https://evil.example','Content-Type':'application/json','X-Namo-Key':'strong-secret-demo-code-123'},body:JSON.stringify({title:'x',role:'planner'})});assert.equal((await worker.fetch(req,env)).status,403);
 const t=(await (await worker.fetch(request('/api/tasks',undefined,'POST',{title:'<script>alert(1)</script>',role:'planner'}),env)).json()).task;assert.equal(t.title,'<script>alert(1)</script>');
});

test('one cloud API and D1 database are shared by phone and desktop clients',async()=>{
 const env=mockEnv();
 const create=new Request(base+'/api/tasks',{method:'POST',headers:{'X-Namo-Key':env.OWNER_KEY,'Content-Type':'application/json','User-Agent':'Android Chrome'},body:JSON.stringify({title:'Single synced project',role:'planner'})});
 const created=await worker.fetch(create,env);assert.equal(created.status,201);
 const fromDesktop=new Request(base+'/api/state',{headers:{'X-Namo-Key':env.OWNER_KEY,'User-Agent':'Windows Chrome'}});
 const state=await worker.fetch(fromDesktop,env);const data=await state.json();
 assert.equal(data.tasks.length,1);assert.equal(data.tasks[0].title,'Single synced project');
});
test('manual ChatGPT/Claude handoff is stored in same cloud task, not falsely called API automation',async()=>{
 const env=mockEnv({GEMINI_API_KEY:''});
 const t=(await (await worker.fetch(request('/api/tasks',undefined,'POST',{title:'Design a logo',role:'designer'}),env)).json()).task;
 assert.equal((await worker.fetch(request('/api/handoff',undefined,'POST',{id:t.id,provider:'claude',result:'Human copied result'}),env)).status,409);
 await worker.fetch(request('/api/tasks/'+t.id,undefined,'PATCH',{status:'assigned'}),env);
 const imported=await worker.fetch(request('/api/handoff',undefined,'POST',{id:t.id,provider:'chatgpt',result:'Layout + typography choices'}),env);
 assert.equal(imported.status,200);
 const result=(await imported.json()).task;
 assert.equal(result.status,'completed');
 assert.match(result.result,/ChatGPT/);
 assert.match(result.result,/ไม่ใช่การเรียก API อัตโนมัติ/);
 const state=(await (await worker.fetch(request('/api/state'),env)).json()).tasks;
 assert.equal(state[0].result,result.result);
 assert.equal((await worker.fetch(request('/api/handoff',undefined,'POST',{id:t.id,provider:'claude',result:'Overwrite'}),env)).status,409);
 assert.equal((await worker.fetch(request('/api/handoff',null,'POST',{id:t.id,provider:'chatgpt',result:'stolen'}),env)).status,401);
});
