const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('var chats=[],personas=[],memberRows=[]'));
const window={ATLAS_CURRENT_SESSION:{user:{id:'u'}},ATLAS_CURRENT_PROFILE:{id:'u',role:'player'},addEventListener(){},matchMedia:()=>({matches:false})};
const document={addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []}};
vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,'window.test=s=>eval(s);})();'),{window,document,console,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},clearInterval(){},sessionStorage:{getItem(){return null}},requestAnimationFrame(){},URL,Set,Map});
const run=window.test;
run("chats=[{id:'c'}];activeChatId='c';personas=[{id:'p',character_id:'character',owner_user_id:'u'}];memberRows=[{chat_id:'c',persona_id:'p'}];photoReactions={a:[{user_id:'u',emoji:'❤️'},{user_id:'v',emoji:'❤️'}]};");
let rendered=run("photoReactionHtml({id:'a'})");assert(rendered.includes('aria-pressed="true"'));assert(rendered.includes('<small>2</small>'));
run("chats[0].is_archived=true");assert(run("photoReactionHtml({id:'a'})").includes('disabled'));run("chats[0].is_archived=false");
rendered=run("voiceHtml({id:'m'},'<script>alert(1)</script>')");assert(!rendered.includes('<script>'));assert(rendered.includes(' hidden'));run("voiceOpened.m=true");assert(!run("voiceHtml({id:'m'},'hello')").includes(' hidden'));
let calls=[];window.ATLAS_SUPABASE={rpc:async(name,args)=>{calls.push({name,args});return {data:'m'}}};
run("refreshActiveChat=async()=>{};broadcastDirectEvent=()=>{};loadInboxMessages=async()=>{};loadUnreadCounts=async()=>{};trackTyping=()=>{};renderChatListOnly=()=>{}");
(async()=>{
const storageCalls=[];
window.ATLAS_SUPABASE.storage={from:()=>({upload:async(path,file)=>{storageCalls.push({path,file});return {data:{path}}},getPublicUrl:path=>({data:{publicUrl:'https://example.test/'+path}})})};
for(const name of ['Знімок екрана 2026-10-10.png','фото ❤️.JPG','résumé.pdf','a/b?c#.docx']){
 const file={name,type:'image/png',size:10},result=await run('uploadDirectFile')(file,{id:'chat'});
 assert.match(result.storage_path,/^u\/direct\/chat\/[a-zA-Z0-9._-]+$/);
 assert.equal(result.file_name,name,'Original filename remains metadata');
 assert.equal(storageCalls.at(-1).file,file);
}
const button={disabled:false,getAttribute:n=>n==='data-photo-reaction'?'a':'❤️'};
await run('reactToPhoto')(button);assert.equal(calls.at(-1).args.p_emoji,null);
button.getAttribute=n=>n==='data-photo-reaction'?'a':'🔥';await run('reactToPhoto')(button);assert.equal(calls.at(-1).args.p_emoji,'🔥');
const form={elements:{persona:{value:'p'},rp_date:{value:'2026-10-10'},rp_time:{value:'12:00'},body:{value:'Расшифровка'},message_kind:{value:'voice'}},querySelector:()=>({disabled:false})};
await run('sendMessage')(form);assert.equal(calls.at(-1).name,'send_direct_voice_message');assert.equal(calls.at(-1).args.p_body,'Расшифровка');
const count=calls.length;form.elements.body.value='';await run('sendMessage')(form);assert.equal(calls.length,count,'Empty voice transcript rejected');
form.elements.body.value='text';form.elements.message_kind.value='text';await run('sendMessage')(form);assert.equal(calls.at(-1).name,'send_direct_message_v3');
console.log('PASS reactions counts/toggle/change/archive, voice escaping/expand/send/empty validation, legacy text send');
})().catch(e=>{console.error(e);process.exitCode=1});
