const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('  async function loadInboxMessages('),end=html.indexOf('  var pendingInboxChats',start);
let selected,viewer='a',error=false;
const ctx={chats:[{id:'one'},{id:'two'}],inboxMessages:[{id:'old',chat_id:'one'},{id:'keep',chat_id:'two'}],uid:()=>viewer,
client:()=>({from:()=>({select(){return this},in(k,v){selected=v;return this},order(){return this}})}),
loadDirectRows:async(q,current)=>{q();return error?{error:true}:{data:[{id:'new',chat_id:'one'},{id:'deleted',chat_id:'one',deleted_at:'today'}]}}};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
(async()=>{await ctx.loadInboxMessages(['one']);assert.equal(selected.join(','),'one');assert.equal(ctx.inboxMessages.map(x=>x.id).sort().join(','),'keep,new');error=true;await ctx.loadInboxMessages(['one']);assert.equal(ctx.inboxMessages.length,2,'Network error preserves existing history');console.log('PASS scoped inbox refresh, other chats retained, deletion, network failure');})();
