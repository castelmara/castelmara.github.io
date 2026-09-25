const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes("var chats=[],personas=[],memberRows=[]"));
assert(source);
const events={},calls=[],root={innerHTML:'',querySelector:()=>null,contains:()=>false};
const nodes={atlasDirectRoot:root,'atlas-page-direct':{classList:{contains:()=>true}}};
let mobile=false;
const window={ATLAS_CURRENT_SESSION:{user:{id:'user'}},ATLAS_CURRENT_PROFILE:{id:'user',role:'player'},addEventListener(){},matchMedia:()=>({matches:mobile})};
const document={getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(n,f)=>(events[n]||=[]).push(f),visibilityState:'visible'};
const context=vm.createContext({window,document,console,Intl,Date,Set,Map,Promise,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},sessionStorage:{setItem(){},getItem(){return null}},FormData:class{}});
vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.directTest={run:s=>eval(s),openChat,loadMessages,sendMessage,shell};})();'),context);
const api=window.directTest;
api.run(`chats=[{id:'mine',title:'My conversation',rp_date:'2026-09-25',next_rp_time:'12:00'},{id:'other',title:'Other conversation',rp_date:'2026-09-25',next_rp_time:'12:00'},{id:'archive',title:'Archived conversation',is_archived:true}];personas=[{id:'p1',owner_user_id:'user',display_name:'Alice',nickname:'alice'},{id:'p2',owner_user_id:'someone',display_name:'Bob',nickname:'bob'}];memberRows=[{chat_id:'mine',persona_id:'p1'},{chat_id:'other',persona_id:'p2'},{chat_id:'archive',persona_id:'p2'}];`);
function list(section,search='') {api.run('chatSection='+JSON.stringify(section)+';chatSearch='+JSON.stringify(search));return api.run('chatListHtml()');}
assert(list('personal').includes('data-direct-chat="mine"'));
assert(!list('personal').includes('data-direct-chat="other"'));
const publicList=list('public');
for(const id of ['mine','other','archive']) assert.equal(publicList.split('data-direct-chat="'+id+'"').length-1,1);
assert(publicList.includes('активные')&&publicList.includes('архив'));
assert(list('public','bob').includes('data-direct-chat="other"'));
assert(!list('personal','bob').includes('data-direct-chat='));
assert(!api.run('composerHtml(chats[1])').includes('<form'));
assert(api.run('composerHtml(chats[0])').includes('<form'));
assert.equal(api.run('canManage(chats[1])'),false);
for(const role of ['admin','superadmin']) {
 window.ATLAS_CURRENT_PROFILE.role=role;
 assert.equal(api.run('canManage(chats[1])'),true);
 assert.equal(api.run("messageCanModify({persona_id:'p2'})"),true);
 assert.equal(api.run('writablePersonas(chats[1]).length'),role==='superadmin'?1:0);
}
window.ATLAS_CURRENT_PROFILE={id:'old-user',role:'superadmin'};
assert.equal(api.run('canManage(chats[1])'),false);
window.ATLAS_CURRENT_PROFILE={id:'user',role:'player'};
window.ATLAS_SUPABASE={from(table){return {select(){return this},eq(){return this},in(){return this},order(){return this},limit(){return this},then(resolve){calls.push(table);return Promise.resolve({data:table==='direct_messages'?[{id:'message',chat_id:'other',persona_id:'p2',body:'Readable foreign chat',rp_datetime:'2026-09-25T12:00',created_at:'2026-09-25T12:00'}]:[]}).then(resolve)}}},rpc(name){calls.push(name);return Promise.resolve({data:[]})}};
(async()=>{
 api.run("activeChatId='other'");
 assert.equal(await api.loadMessages('other'),true);
 assert(api.run('messagesHtml()').includes('Readable foreign chat'));
 const before=calls.length;
 await api.sendMessage({elements:{persona:{value:'p2'}}});
 await api.sendMessage({elements:{persona:{value:'p1'}}});
 assert.equal(calls.length,before,'Foreign writer must be rejected before uploads or RPC');
 // Exercise real opening/rendering; realtime transport alone is disabled in this DOM fixture.
 api.run("chatSearch='';syncPresenceLifecycle=()=>{};subscribeMessages=()=>{};stopRealtime=()=>{};updateGlobalUnreadBadge=()=>{}");
 await api.openChat('other');api.shell();
 assert.equal(api.run('isMobile()'),false);
 assert(root.innerHTML.includes('class="atlas-direct-channels"'));
 assert(root.innerHTML.includes('class="atlas-direct-chat"'));
 for(const section of ['personal','public','personal','public']){
   for(const handler of events.click) handler({target:{closest:selector=>selector==='[data-direct-section]'?{getAttribute:()=>section}:null}});
   assert.equal(api.run('activeChatId'),'other');
   assert.equal((api.run('chatListHtml()').match(/data-direct-chat="mine"/g)||[]).length,1);
 }
 mobile=true;assert.equal(api.run('isMobile()'),true);
 const css=fs.readFileSync(path.join(base,'assets/atlas-community.css'),'utf8');
 const desktop=css.slice(css.indexOf('/* Direct:'),css.indexOf('@media(max-width:900px)',css.indexOf('/* Direct:')));
 assert(desktop.includes('.atlas-direct-layout.is-mobile-chat .atlas-direct-channels{display:block!important}'));
 assert(desktop.includes('.atlas-direct-mobile-back{display:none!important}'));
 assert(html.includes('class="atlas-direct-head atlas-section-hero"'));
 api.run("activeChatId='mine';broadcastDirectEvent=()=>{};loadInboxMessages=async()=>{};loadUnreadCounts=async()=>{};refreshActiveChat=async()=>{};renderChatListOnly=()=>{};trackTyping=()=>{}");
 const button={disabled:false};
 await api.sendMessage({elements:{persona:{value:'p1'},rp_date:{value:'2026-09-25'},rp_time:{value:'12:00'},body:{value:'Participant message'}},querySelector:()=>button});
 assert(calls.includes('send_direct_message_v3'),'Participant reaches the authorized send RPC');
 assert.equal(button.disabled,false);
 console.log('PASS Direct: personal/public overlap, foreign reads, write restrictions, staff rights, archives/search, stable tab switching, desktop columns and shared hero.');
})().catch(e=>{console.error(e);process.exitCode=1});
