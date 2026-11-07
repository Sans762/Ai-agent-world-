import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
const root=path.join(import.meta.dirname,'../public');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
test('HTML contains navigation, map canvas, panels and touch zoom buttons',()=>{
 for(const id of ['world','miniMap','zoomIn','zoomOut','fitMap','sidePanel','panelBody','newTask']){
  if(id==='newTask')assert.match(js,/id=\\?"newTask/);
  else assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/viewport-fit=cover/);
 assert.match(css,/touch-action:none/);
 assert.match(js,/api\/health/);
 assert.match(js,/api\/handoff/);
 for(const tab of ['agents','tasks','ai','settings'])assert.match(html,new RegExp('data-tab="'+tab+'"'));
});
test('UI script initializes in a synthetic DOM and prerenders pixel map without exceptions',async()=>{
 const events=new Map(),local=new Map();
 const makeContext=()=>({fillRect(){},strokeRect(){},fillText(){},drawImage(){},save(){},restore(){},scale(){},translate(){},setTransform(){},measureText(t){return {width:String(t).length*8}},fillStyle:'',font:'',textBaseline:''});
 function el(id=''){
  const listeners={};let classes=new Set();
  return {id,style:{},value:'',width:1100,height:720,innerHTML:'',textContent:'',hidden:false,addEventListener(type,fn){(listeners[type]||=[]).push(fn);events.set(id+':'+type,fn)},classList:{add(s){classes.add(s)},remove(s){classes.delete(s)},toggle(s,v){if(v===undefined?v:!!v)classes.add(s);else classes.delete(s)},contains(s){return classes.has(s)}},
   closest(){return null},querySelector(){return null},querySelectorAll(){return []},getContext(){return makeContext()},getBoundingClientRect(){return {width:390,height:700,left:0,top:0}},setPointerCapture(){},focus(){},click(){},append(){}};
 }
 const ids=new Map();const get=id=>ids.get(id)||ids.set(id,el(id)).get(id);
 const document={body:el('body'),getElementById:get,createElement:tag=>el(tag),querySelectorAll:()=>[],querySelector:(s)=>s==='.liveDot'?get('liveDot'):null};
 const store={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)};
 const context={window:{open(){},addEventListener(){}},document,localStorage:store,sessionStorage:store,performance:{now:()=>0},devicePixelRatio:1,setInterval(){},setTimeout(){return 1},clearTimeout(){},requestAnimationFrame(){},ResizeObserver:class{observe(){}},console,URL,confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},fetch:async()=>({ok:false,json:async()=>({})}),FormData:class{get(k){return {title:'เว็บทดสอบบนมือถือ',description:'สร้างงานผ่านฟอร์มจริง',role:'developer'}[k]}},Math,Date,Blob};
 vm.createContext(context);
 vm.runInContext(js,context,{timeout:5000});
 assert.equal(get('agentStat').textContent,6);
 assert.equal(get('taskStat').textContent,0);
 assert.equal(get('onlineStat').textContent,'LOCAL');
 assert.equal(get('modeLabel').textContent,'ตัวอย่างในเบราว์เซอร์ · ยังไม่เชื่อมฐานข้อมูลกลาง');
 assert.equal(typeof get('zoomIn').onclick,'function');
 assert.equal(typeof get('fitMap').onclick,'function');
 assert.ok(events.has('stage:pointerdown'));
 assert.ok(events.has('panelBody:submit'));
 assert.ok(local.size===0);
 const submit=events.get('panelBody:submit');
 await submit({target:{id:'newTask'},preventDefault(){}});
 assert.equal(get('taskStat').textContent,1);
 const saved=JSON.parse(local.get('namo-cloud-town-v1'));
 assert.equal(saved.tasks.length,1);
 assert.equal(saved.tasks[0].title,'เว็บทดสอบบนมือถือ');
 assert.equal(saved.tasks[0].status,'new');
});
