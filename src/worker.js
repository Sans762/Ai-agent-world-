// Namo Agent World: optional secure cloud layer for Cloudflare Workers + D1.
// The static pixel town works without this worker. No secret is ever sent to the UI.
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'}});
const limited=(s,n=160)=>String(s??'').trim().slice(0,n);
const roles=new Set(['planner','developer','designer','researcher','qa','support']);
const statuses=new Set(['new','assigned','working','completed','failed']);
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function verify(req,env){
  if(!env.OWNER_KEY || String(env.OWNER_KEY).length<12)return false;
  const got=req.headers.get('X-Namo-Key')||'';
  if(!got||got.length>400)return false;
  const [a,b]=await Promise.all([digest(got),digest(env.OWNER_KEY)]);
  let wrong=0;for(let i=0;i<a.length;i++)wrong|=a[i]^b[i];return wrong===0;
}
async function bodyJSON(req){
  if(Number(req.headers.get('content-length'))>24000)throw new Error('request_too_large');
  const raw=await req.text();if(raw.length>10000)throw new Error('request_too_large');
  return JSON.parse(raw);
}
const fetchTasks=async env=>{const q=await env.DB.prepare('SELECT id,title,description,role,status,result,error,created_at,updated_at FROM tasks ORDER BY id DESC LIMIT 300').all();return q.results||[]};
const getTask=async(env,id)=>env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
const normalize=t=>({id:t.id,title:t.title,description:t.description,role:t.role,status:t.status,result:t.result||'',error:t.error||'',createdAt:t.created_at,updatedAt:t.updated_at});
const prompts={
 planner:'คุณคือ Core AI Planner ของบริษัท Namo วิเคราะห์เป้าหมาย แผนงาน ความเสี่ยง เกณฑ์ความสำเร็จ และคำถามที่ควรถาม ไม่อ้างว่าลงมือทำแล้ว',
 developer:'คุณคือ Software Developer ของ Namo ส่งมอบโค้ดหรือโครงสร้างที่ใช้งานได้จริงพร้อมคำสั่งทดสอบ ระบุข้อจำกัด ห้ามอ้างว่าทดสอบแล้วหากยังไม่ได้รัน',
 designer:'คุณคือ UI/UX Designer ของ Namo ส่งมอบรายละเอียดดีไซน์ที่นำไปทำต่อได้จริง และตัวอย่างโค้ด HTML/CSS เมื่อเหมาะสม',
 researcher:'คุณคือ Researcher ของ Namo แยกข้อเท็จจริงจากสมมติฐาน ไม่สร้างแหล่งอ้างอิงปลอม และบอกข้อมูลที่ต้องตรวจเพิ่มเติม',
 qa:'คุณคือ QA Engineer ของ Namo สร้างกรณีทดสอบตามข้อกำหนด และรายงานว่าเป็น test plan ไม่ใช่ผลรันจริง เว้นแต่มีหลักฐาน',
 support:'คุณคือ Support Engineer ของ Namo ให้ขั้นตอนแก้ปัญหาตามหลักฐาน คำสั่งต้องปลอดภัยและไม่แตะระบบอื่น'
};
async function runGemini(task,env){
  const model=env.GEMINI_MODEL||'gemini-3.1-flash-lite';
  if(!/^[a-z0-9_.-]{5,80}$/i.test(model))throw new Error('gemini_model_invalid');
  const payload={systemInstruction:{parts:[{text:prompts[task.role]}]},contents:[{role:'user',parts:[{text:`ชื่องาน: ${task.title}\nรายละเอียด: ${task.description||'ไม่ระบุ'}\nตอบไทยแบบลงมือทำได้จริง บอกสิ่งที่ได้ผลิตและสิ่งที่ยังไม่ได้ทำ ห้ามแกล้งอ้างว่าทดสอบผ่านหรือเปิดโปรแกรมจริง` }]}],generationConfig:{maxOutputTokens:2200,temperature:0.45}};
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent';
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const message=limited(data.error?.message||'Gemini HTTP '+response.status,250);throw new Error(message)}
  const result=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('\n').trim();
  if(!result)throw new Error('Gemini ส่งผลลัพธ์ว่าง');
  return result.slice(0,18000);
}
export default {
 async fetch(req,env){
  const url=new URL(req.url),p=url.pathname;
  if(!p.startsWith('/api/'))return env.ASSETS.fetch(req);
  if(req.method==='OPTIONS')return reply({error:'cors_not_enabled'},405);
  if(req.method!=='GET'){
    const origin=req.headers.get('Origin');
    if(origin && origin!==url.origin)return reply({error:'cross_origin_denied'},403);
    if(req.method!=='DELETE' && !req.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'json_required'},415);
  }
  if(p==='/api/health' && req.method==='GET')return reply({ok:true,name:'Namo Agent World',cloudConfigured:!!env.DB});
  if(!await verify(req,env))return reply({error:'unauthorized_owner_key'},401);
  if(!env.DB)return reply({error:'d1_database_not_bound'},503);
  try{
   if(p==='/api/state'&&req.method==='GET')return reply({tasks:(await fetchTasks(env)).map(normalize),geminiConfigured:!!env.GEMINI_API_KEY});
   if(p==='/api/tasks'&&req.method==='POST'){
     const b=await bodyJSON(req),title=limited(b.title),description=limited(b.description,3000),role=limited(b.role,25);
     if(!title||!roles.has(role))return reply({error:'invalid_task'},400);
     const timestamp=Date.now();
     const result=await env.DB.prepare('INSERT INTO tasks(title,description,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(title,description,role,'new',timestamp,timestamp).run();
     return reply({task:normalize(await getTask(env,result.meta.last_row_id))},201);
   }
   const match=p.match(/^\/api\/tasks\/(\d+)$/);
   if(match && (req.method==='PATCH'||req.method==='DELETE')){
     const id=Number(match[1]);if(!Number.isSafeInteger(id)||id<1)return reply({error:'invalid_id'},400);
     if(req.method==='DELETE'){await env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(id).run();return reply({ok:true})}
     const b=await bodyJSON(req),status=limited(b.status,25);
     if(!['assigned','new'].includes(status))return reply({error:'only_assignment_is_allowed'},400);
     const res=await env.DB.prepare('UPDATE tasks SET status=?,updated_at=? WHERE id=? AND status IN (\'new\',\'assigned\',\'failed\')').bind(status,Date.now(),id).run();
     if(!res.meta.changes)return reply({error:'task_not_editable'},409);
     return reply({task:normalize(await getTask(env,id))});
   }
   // Explicit human-assisted handoff for ChatGPT/Claude. This is NOT an automatic API call.
   if(p==='/api/handoff'&&req.method==='POST'){
     const b=await bodyJSON(req),id=Number(b.id),provider=limited(b.provider,16),content=limited(b.result,6200);
     if(!Number.isSafeInteger(id)||id<1||!['chatgpt','claude','gemini'].includes(provider)||content.length<4)
       return reply({error:'invalid_handoff'},400);
     const label={chatgpt:'ChatGPT',claude:'Claude',gemini:'Gemini'}[provider];
     const attribution=`[นำเข้าคำตอบจาก ${label} โดยเจ้าของบริษัท - ไม่ใช่การเรียก API อัตโนมัติ]\n\n${content}`;
     const changed=await env.DB.prepare("UPDATE tasks SET status='completed',result=?,error='',updated_at=? WHERE id=? AND status IN ('assigned','failed')")
       .bind(attribution,Date.now(),id).run();
     if(!changed.meta.changes)return reply({error:'task_not_assigned_or_already_completed'},409);
     return reply({task:normalize(await getTask(env,id))});
   }
   if(p==='/api/run'&&req.method==='POST'){
     if(!env.GEMINI_API_KEY)return reply({error:'gemini_secret_not_configured'},503);
     const b=await bodyJSON(req),id=Number(b.id);
     if(!Number.isSafeInteger(id)||id<1)return reply({error:'invalid_id'},400);
     const row=await getTask(env,id);if(!row)return reply({error:'task_not_found'},404);
     const changed=await env.DB.prepare("UPDATE tasks SET status='working',error='',updated_at=? WHERE id=? AND status='assigned'").bind(Date.now(),id).run();
     if(!changed.meta.changes)return reply({error:'task_not_assigned_or_already_running'},409);
     try{
       const result=await runGemini(row,env);
       await env.DB.prepare("UPDATE tasks SET status='completed',result=?,updated_at=? WHERE id=?").bind(result,Date.now(),id).run();
     }catch(e){
       await env.DB.prepare("UPDATE tasks SET status='failed',error=?,updated_at=? WHERE id=?").bind(limited(e.message,350),Date.now(),id).run();
     }
     return reply({task:normalize(await getTask(env,id))});
   }
   return reply({error:'not_found'},404);
  }catch(e){return reply({error:limited(e.message,250)},500)}
 }
};
