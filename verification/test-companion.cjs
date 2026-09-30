'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.resolve('assets/atlas-companion.js'),'utf8');
function harness(role='admin',reduced=false,client=null){
 let now=10000,id=0;const timers=new Map(),storage=new Map(),listeners={};
 const classes=()=>{const s=new Set();return {add:(...v)=>v.forEach(x=>s.add(x)),remove:(...v)=>v.forEach(x=>s.delete(x)),toggle:(x,on)=>on?s.add(x):s.delete(x),contains:x=>s.has(x)}};
 function el(){return {hidden:false,dataset:{},style:{setProperty(){}},classList:classes(),events:{},children:[],addEventListener(n,f){this.events[n]=f},setAttribute(){},appendChild(e){this.children.push(e)},remove(){},querySelectorAll(){return []},setPointerCapture(){},releasePointerCapture(){}}}
 const image=el(),name=el(),button=el(),root=el();root.querySelector=s=>s.includes('img')?image:s.includes('name-tag')?name:button;
 const document={hidden:false,readyState:'complete',documentElement:{clientWidth:1000,clientHeight:800},body:el(),createElement:()=>root,getElementById:()=>null,addEventListener(n,f){listeners[n]=f}};
 const window={ATLAS_SUPABASE:client,ATLAS_CURRENT_SESSION:{user:{id:'a'}},ATLAS_CURRENT_PROFILE:{role},innerWidth:1000,innerHeight:800,matchMedia:q=>({matches:q.includes('reduced')&&reduced}),addEventListener(n,f){listeners[n]=f}};
 const context={window,document,location:{hash:''},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:i=>timers.delete(i),Date:{now:()=>now},Math:Object.assign(Object.create(Math),{random:()=>.5})};
 vm.runInNewContext(source,context);
 function tick(ms){const end=now+ms;let safety=1000;while(safety--){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].f()}assert(safety>0,'bounded timers');now=end}
 return {api:window.ATLAS_COMPANION,window,document,root,image,name,button,storage,timers,listeners,tick};
}
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name)}
test('each animation frame sets one final image URL',()=>{const h=harness();let value=h.image.src;const writes=[];Object.defineProperty(h.image,'src',{get:()=>value,set:v=>{value=v;writes.push(v)}});h.api.pet();assert.deepEqual(writes,['assets/companions/v2/sprout-happy.png?v=20260930-clean']);writes.length=0;h.tick(1200);assert.deepEqual(writes,['assets/companions/v2/sprout.png'])});
test('auth restored after returning to tab resumes CSS and frame animation',()=>{const h=harness();h.document.hidden=true;h.listeners.visibilitychange();assert(h.root.classList.contains('is-paused'));h.window.ATLAS_CURRENT_PROFILE=null;h.document.hidden=false;h.listeners.visibilitychange();h.window.ATLAS_CURRENT_PROFILE={role:'admin'};h.listeners.atlasPlayerAuthReady();assert(!h.root.classList.contains('is-paused'));h.api.choose('codercat');h.tick(1760);assert.equal(h.root.dataset.frame,'typing-left')});
test('all 13 pets restore idle and load real PNG states',()=>{const h=harness();assert.equal(Object.keys(h.api.pets).length,13);for(const id of Object.keys(h.api.pets)){h.api.choose(id);h.tick(200);assert(fs.existsSync(h.image.src.split('?')[0]),h.image.src);h.tick(1000);assert.equal(h.root.dataset.frame,'idle',id);assert.equal(h.image.src,h.api.pets[id].file)}});
test('kitsune repeat pet restarts; switching cancels old frames',()=>{const h=harness();h.api.choose('kitsune');h.tick(900);h.api.pet();h.tick(500);assert.equal(h.root.dataset.frame,'happy');h.api.choose('duck');h.tick(700);assert(h.image.src.includes('duck-happy'));h.tick(500);assert.equal(h.root.dataset.frame,'idle')});
test('cat hover hides, leave returns, tap pops before happy',()=>{const h=harness();h.api.choose('catbox');h.tick(1200);h.button.events.pointerenter({pointerType:'mouse'});assert.equal(h.root.dataset.frame,'hide');h.api.pet();assert.equal(h.root.dataset.frame,'pop');h.tick(170);assert.equal(h.root.dataset.frame,'happy');h.tick(1000);h.button.events.pointerleave({pointerType:'mouse'});h.tick(450);assert.equal(h.root.dataset.frame,'idle')});
test('coder uses alternating paw images and pauses for pet',()=>{const h=harness();h.api.choose('codercat');h.tick(1760);assert.equal(h.root.dataset.frame,'typing-left');h.tick(130);assert.equal(h.root.dataset.frame,'typing-right');h.api.pet();h.tick(300);assert.equal(h.root.dataset.frame,'happy')});
test('hide and hidden tab cancel sequences; visible resumes',()=>{const h=harness();h.api.choose('ghost');h.api.hide();h.tick(10000);assert(h.root.hidden);h.api.show();h.document.hidden=true;h.listeners.visibilitychange();h.tick(4000);assert.equal(h.root.dataset.frame,'idle');assert.equal(h.timers.size,0);h.document.hidden=false;h.listeners.visibilitychange();assert(h.timers.size>0)});
test('reduced motion has no autonomous timers',()=>{const h=harness('admin',true);h.tick(4000);assert.equal(h.timers.size,0);h.api.choose('book');h.tick(1000);assert.equal(h.root.dataset.frame,'idle');assert.equal(h.timers.size,0)});
test('every signed-in role can choose, rename, hide and show a pet',()=>{for(const role of ['player','admin','superadmin','']){const h=harness(role);assert(!h.root.hidden);h.api.choose('ghost');assert.equal(h.root.dataset.pet,'ghost');h.api.rename('my pet');assert.equal(h.name.textContent,'my pet');h.api.hide();assert(h.root.hidden);h.api.show();assert(!h.root.hidden)}});
test('late mi atlas render restores companion tab after polling has stopped',()=>{
 const h=harness('player');h.tick(5000);
 let tab=null,panel=null;
 const tabs={querySelector:s=>s.includes('is-active')?null:tab,appendChild:e=>{tab=e}};
 const personal={querySelector:s=>s==='.atlas-personal-tabs'?tabs:s.includes('data-personal-tab')?tab:panel,appendChild:e=>{panel=e}};
 h.document.getElementById=id=>id==='atlasPersonalRoot'?personal:null;
 h.document.createElement=()=>({classList:{add(){},toggle(){}},setAttribute(){}});
 h.listeners.atlasPersonalRendered();assert(tab);assert(panel);assert(panel.innerHTML.includes('пиксельный помощник'));
 const previous=tab;h.listeners.atlasPersonalRendered();assert.equal(tab,previous);
});
test('sign-out blocks pet controls and account switch keeps preferences separate',()=>{const h=harness('player');h.api.choose('kitsune');h.api.rename('first');h.window.ATLAS_CURRENT_SESSION={user:{id:'b'}};h.listeners.atlasPlayerAuthReady();assert(!h.root.hidden);assert.equal(h.root.dataset.pet,'sprout');assert(h.name.hidden);h.window.ATLAS_CURRENT_SESSION=null;h.listeners.atlasPlayerAuthReady();const size=h.storage.size;h.api.choose('ghost');h.api.show();h.api.pet();h.api.rename('no');h.tick(3000);assert(h.root.hidden);assert.equal(h.storage.size,size);assert.equal(h.timers.size,0)});
test('names are per pet and account, capped at 24',()=>{const h=harness();h.api.rename('x'.repeat(40));assert.equal(h.name.textContent.length,24);h.api.choose('duck');assert(h.name.hidden);h.api.rename('  duck   name  ');assert.equal(h.name.textContent,'duck name');h.api.choose('sprout');assert.equal(h.name.textContent.length,24);h.window.ATLAS_CURRENT_SESSION.user.id='b';h.listeners.atlasPlayerAuthReady();assert(h.name.hidden)});
test('mouse/touch drag saves a clamped position',()=>{for(const pointerType of ['mouse','touch']){const h=harness();const e={pointerType,button:0,clientX:800,clientY:650,currentTarget:h.button,pointerId:1};h.button.events.pointerdown(e);h.button.events.pointermove({...e,clientX:50,clientY:100});h.button.events.pointerup(e);const p=JSON.parse(h.storage.get('atlasCompanion:a:position'));assert(p.x>=8&&p.y>=70);assert(!h.root.classList.contains('is-dragging'))}});
test('book autonomously closes and reopens',()=>{const h=harness();h.api.choose('book');h.tick(8510);assert.equal(h.root.dataset.frame,'closing');h.tick(180);assert.equal(h.root.dataset.frame,'closed');h.tick(900);assert.equal(h.root.dataset.frame,'idle')});
test('cat autonomously hides and pops back',()=>{const h=harness();h.api.choose('catbox');h.tick(8810);assert.equal(h.root.dataset.frame,'hide');h.tick(1020);assert.equal(h.root.dataset.frame,'pop');h.tick(800);assert.equal(h.root.dataset.frame,'idle')});
test('ghost phase lasts 550ms and then returns',()=>{const h=harness();h.api.choose('ghost');h.tick(8860);assert(h.root.classList.contains('is-phasing'));h.tick(550);assert(!h.root.classList.contains('is-phasing'));assert.equal(h.root.dataset.frame,'idle')});
test('spider crawls with alternating sides',()=>{const h=harness();h.api.choose('spider');h.tick(3800);assert.equal(h.root.dataset.frame,'crawl-left');h.tick(120);assert.equal(h.root.dataset.frame,'idle');h.tick(120);assert.equal(h.root.dataset.frame,'crawl-right');assert(fs.existsSync(h.image.src.split('?')[0]));h.tick(120);assert.equal(h.root.dataset.frame,'idle');h.tick(120);assert.equal(h.root.dataset.frame,'crawl-left');h.tick(695);assert.equal(h.root.dataset.frame,'idle')});
test('spider alternates feet in place and petting interrupts the cycle',()=>{const h=harness();h.api.choose('spider');h.tick(2700);assert.equal(h.root.dataset.frame,'crawl-left');h.tick(140);assert.equal(h.root.dataset.frame,'idle');h.tick(100);assert.equal(h.root.dataset.frame,'crawl-right');h.api.pet();h.tick(500);assert.equal(h.root.dataset.frame,'happy');h.tick(700);assert.equal(h.root.dataset.frame,'idle')});
test('approved designs are wired to catalog and animation frames',()=>{const h=harness();for(const id of ['frog','axolotl','bat','sprout','duck','catbox','book','codercat','spider','raven','dragon','kitsune','ghost']){assert.equal(h.api.pets[id].file,'assets/companions/v2/'+id+'.png');assert(fs.existsSync(h.api.pets[id].happy))}const html=fs.readFileSync('index.html','utf8');assert(html.includes('assets/atlas-companion.js?v=20260930-v8'));assert(html.includes('assets/atlas-companion.css?v=20260929-v2'))});
test('new pets play their own idle sequences and stop for pet',()=>{for(const [id,pose] of [['frog','crouch'],['axolotl','wave'],['bat','flap']]){const h=harness();h.api.choose(id);h.tick(9050);assert.equal(h.root.dataset.frame,pose,id);assert(fs.existsSync(h.image.src.split('?')[0]));h.api.pet();assert.equal(h.root.dataset.frame,'happy');h.tick(1200);assert.equal(h.root.dataset.frame,'idle')}});
assert(!source.includes('MutationObserver'));
console.log(checks+' companion checks passed; isolated DOM, no live account.');

async function cloudChecks(){
 const rows=new Map(),clone=v=>JSON.parse(JSON.stringify(v));
 const client={from(table){assert.equal(table,'atlas_player_companions');let account,payload,options;const q={select(){return q},eq(k,v){assert.equal(k,'user_id');account=v;return q},upsert(p,o){payload=clone(p);options=o;return q},single(){return q},maybeSingle(){return q},then(resolve){if(payload){account=payload.user_id;if(!options.ignoreDuplicates||!rows.has(account))rows.set(account,{pet:'sprout',visible:true,names:{},...rows.get(account),...payload})}return Promise.resolve({data:clone(rows.get(account)||null),error:null}).then(resolve)}};return q}};
 const flush=async()=>{for(let i=0;i<50;i++)await Promise.resolve()};
 const a=harness('player',false,client);await flush();
 a.api.choose('spider');a.api.rename('Лапки');await flush();
 const phone=harness('player',false,client);await flush();
 assert.equal(phone.root.dataset.pet,'spider');assert.equal(phone.name.textContent,'Лапки');
 phone.api.hide();await flush();a.listeners.visibilitychange();await flush();assert(a.root.hidden);
 a.api.show();await flush();assert.equal(rows.get('a').pet,'spider');assert.equal(rows.get('a').names.spider,'Лапки');
 a.api.choose('ghost');a.window.ATLAS_CURRENT_SESSION={user:{id:'b'}};a.listeners.atlasPlayerAuthReady();await flush();
 assert.equal(a.root.dataset.pet,'sprout');assert(a.name.hidden);assert.equal(rows.get('a').pet,'spider');
 const stale=harness('player',false,client);stale.storage.set('atlasCompanion:a:pet','duck');stale.listeners.atlasPlayerAuthReady();await flush();assert.equal(stale.root.dataset.pet,'spider');
 const html=fs.readFileSync('index.html','utf8');assert(html.includes("window.dispatchEvent(new CustomEvent('atlasPersonalRendered'))"));assert.equal(typeof a.listeners.atlasPersonalRendered,'function');
 console.log('PASS cloud: cross-device selection/names/visibility, partial updates, account switch, server priority, post-render hook');
}
cloudChecks().catch(e=>{console.error(e);process.exitCode=1});
