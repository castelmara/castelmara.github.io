const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.search(new RegExp('  (?:async )?function '+name+'\\('));assert(start>=0,name);const tail=html.slice(start+1),end=tail.search(/\n  (?:async )?function /);return html.slice(start,start+1+end);}
const data={direct_messages:Array.from({length:1301},(_,i)=>({id:'m'+i,chat_id:'chat',deleted_at:null})),direct_message_attachments:Array.from({length:1101},(_,i)=>({id:'a'+i,message_id:'m1300',chat_id:'chat'}))};
data.direct_photo_reactions=[];
const pages=[];let currentUser='A',switchAt=null;
const ctx={Set,console,Array,Number,String,Error,activeChatId:'chat',chatViewVersion:1,messageToken:0,messages:[],attachmentByMessage:{},pendingFiles:[],
 uid:()=>currentUser,loadReadReceipts:async()=>{},setMessageStatus(){},document:{getElementById:()=>null},
 imageMime:m=>m.startsWith('image/'),fileMime:f=>f.type,pendingFilesHtml:()=>'',
 esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 attachmentsFor:()=>[],photoReactionHtml:()=>'',photoReactions:{},
 client:()=>({from(table){return {select(){return this},eq(){return this},order(){return this},async range(a,b){pages.push([table,a,b]);if(switchAt===a)currentUser='B';return {data:data[table].slice(a,b+1)};}}}})};
vm.createContext(ctx);vm.runInContext(['loadDirectRows','loadMessages','addPendingFiles','attachmentHtml'].map(fn).join('\n'),ctx);
(async()=>{
 assert.equal(await ctx.loadMessages('chat'),true);
 assert.equal(ctx.messages.length,1301);assert.equal(ctx.messages.at(-1).id,'m1300');
 assert.equal(ctx.attachmentByMessage.m1300.length,1101,'Attachment API pagination does not truncate');
 assert(pages.every(p=>p[2]-p[1]===499));
 ctx.addPendingFiles(Array.from({length:20},(_,i)=>({name:i+'.jpg',type:'image/jpeg',size:100})));
 assert.equal(ctx.pendingFiles.length,20);
 ctx.addPendingFiles([{name:'large.pdf',type:'application/pdf',size:100*1024*1024}]);
 assert.equal(ctx.pendingFiles.length,21,'Files above the former 10 MB cap reach the uploader');
 assert(!/id="atlasDirectMessageBody"[^>]*maxlength/.test(html),'Composer has no text-length cap');
 ctx.attachmentsFor=()=>[{public_url:'https://example.test/photo.jpg',mime_type:'image/jpeg',file_name:'private-name.jpg'}];
 const image=ctx.attachmentHtml('m');assert(!image.includes('private-name.jpg'));assert(image.includes('loading="lazy"'));
 ctx.attachmentsFor=()=>[{public_url:'https://example.test/doc.pdf',mime_type:'application/pdf',file_name:'document.pdf'}];
 assert(ctx.attachmentHtml('m').includes('document.pdf'),'Document filenames remain useful');
 assert(html.includes('height:auto;max-height:none;background:transparent'));
 const before=ctx.messages;switchAt=500;await ctx.loadMessages('chat');assert.equal(ctx.messages,before,'Account change cancels remaining pages');
 console.log('PASS direct limits: 1301 messages, 1101 attachments, 20 selected files, natural photo ratio, no image caption, document names, stale account guard');
})().catch(e=>{console.error(e);process.exitCode=1});
