const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.indexOf('  function '+name+'(');assert(start>=0);const end=html.indexOf('\n  function ',start+1);return html.slice(start,end);}
const ctx={Map,Date,Math,cleanMessageBody:v=>String(v),inboxMessages:[
 {id:'old',chat_id:'a',body:'Встретимся у ёлки после тренировки',created_at:'2026-10-01'},
 {id:'new',chat_id:'a',body:'Спокойной ночи',created_at:'2026-10-12'},
 {id:'voice',chat_id:'b',body:'После тренировки позвони',message_kind:'voice'},
 {id:'deleted',chat_id:'c',body:'после тренировки',deleted_at:'2026-10-12'}
],messages:[],chatMembers:()=>[{name:'Мария',nickname:'mary'}],pName:p=>p.name};
vm.createContext(ctx);vm.runInContext(['directSearchText','messageSearchResults','searchMessagePreview','chatMatches'].map(fn).join('\n'),ctx);
const q=ctx.directSearchText(' ПОСЛЕ   тренировки '),found=ctx.messageSearchResults(q);
assert.equal(found.size,2);assert.equal(found.get('a').id,'old');assert(found.has('b'));assert(!found.has('c'));
assert(ctx.chatMatches({id:'a',title:'Общежитие'},q,found));
assert(ctx.chatMatches({id:'z',title:'Общежитие'},'mary',new Map()));
assert(ctx.chatMatches({id:'z',title:'Общежитие'},'общежитие',new Map()));
assert(ctx.messageSearchResults('елки').has('a'));
ctx.messages=[{...ctx.inboxMessages[0],deleted_at:'2026-10-12'}];
assert(!ctx.messageSearchResults(q).has('a'),'Fresh deleted message overrides inbox cache');
assert(ctx.searchMessagePreview('x'.repeat(150)+' ключевое слово в конце','ключевое слово').includes('ключевое слово'));
console.log('PASS Direct search: older messages, voice transcripts, deleted exclusion, names, case/spacing/ё, matching excerpt');
