const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  var messageScrollByChat='),html.indexOf('  // Keep existing message/image nodes'));
let observer;
const ctx={activeChatId:'chat',uid:()=> 'user',setMessagesBottom:b=>b.scrollTop=Math.max(0,b.scrollHeight-b.clientHeight),ResizeObserver:class{constructor(fn){this.fn=fn;observer=this}observe(){}disconnect(){}}};
vm.createContext(ctx);vm.runInContext(source,ctx);
function box(){
 const b={isConnected:true,clientHeight:300,scrollHeight:1000,scrollTop:700,getBoundingClientRect:()=>({top:0})};
 b.children=Array.from({length:10},(_,i)=>({getAttribute:()=>String(i),getBoundingClientRect:()=>({top:i*100-b.scrollTop,bottom:(i+1)*100-b.scrollTop})}));
 b.querySelectorAll=()=>b.children;return b;
}
let b=box();ctx.restoreMessageScroll(b,null,true);
b.clientHeight=500;observer.fn();assert.equal(b.scrollTop,500,'keyboard closing keeps latest message visible');
b.scrollHeight=1200;observer.fn();assert.equal(b.scrollTop,700,'late content stays pinned at bottom');
b.scrollTop=200;b.onscroll();b.clientHeight=300;observer.fn();assert.equal(b.scrollTop,200,'reading history is not pulled to bottom');
const saved=ctx.rememberMessageScroll(b,'chat');
b.clientHeight=0;b.scrollTop=0;assert.equal(ctx.rememberMessageScroll(b,'chat'),null);
assert.equal(ctx.messageScrollByChat['user:chat'].top,200,'hidden pane cannot replace saved position with zero');
b=box();ctx.restoreMessageScroll(b,null,false);assert.equal(b.scrollTop,200,'returning from management restores history');
// A loaded image above the anchor adds height after the initial render.
const rows=b.children;rows.forEach((row,i)=>row.getBoundingClientRect=()=>({top:i*100+(i>=2?80:0)-b.scrollTop,bottom:(i+1)*100+(i>=2?80:0)-b.scrollTop}));
b.scrollHeight+=80;observer.fn();assert.equal(b.scrollTop,280,'late image preserves visible message offset');
ctx.activeChatId='other';b.scrollHeight+=100;observer.fn();assert.equal(b.scrollTop,280,'stale callback does not affect another chat');
console.log('PASS Direct scroll: keyboard, late media, reader position, hidden pane, management return, stale callback');
