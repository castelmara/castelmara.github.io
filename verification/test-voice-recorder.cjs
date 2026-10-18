const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let stopped=0,revoke=0,clock=0,permission,latest,state;
const element=()=>({children:[],setAttribute(){},addEventListener(){},appendChild(e){this.children.push(e)},replaceChildren(){this.children=[]}});
class Recorder{
 static isTypeSupported(t){return t==='audio/webm;codecs=opus'}
 constructor(stream,opts){this.mimeType=opts.mimeType;this.state='inactive';latest=this}
 start(){this.state='recording'}
 stop(){this.state='inactive';const done=this.onstop;this.ondataavailable?.({data:new Blob(['sound'])});queueMicrotask(()=>done?.())}
}
const stream=()=>({getTracks:()=>[{stop(){stopped++}}]});
const context={window:{MediaRecorder:Recorder},MediaRecorder:Recorder,navigator:{mediaDevices:{getUserMedia:()=>permission||Promise.resolve(stream())}},document:{createElement:element},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>revoke++},performance:{now:()=>clock},Blob,setInterval:()=>1,clearInterval(){},Error};
vm.runInNewContext(fs.readFileSync('assets/atlas-voice-recorder.js','utf8'),context);
(async()=>{
 const host=element(),r=context.window.atlasCreateVoiceRecorder(host,s=>state=s);
 await r.start();assert(r.recording);assert.equal(latest.mimeType,'audio/webm;codecs=opus');
 clock=3400;r.stop();await Promise.resolve();assert(!r.recording);assert.equal(r.value.seconds,3);assert.equal(r.value.blob.type,'audio/webm');assert(r.value.blob.size>0);assert(stopped>0);assert.equal(host.children[0].src,'blob:test');
 r.clear();assert.equal(r.value,null);assert(revoke>0);
 let resolve;permission=new Promise(r=>resolve=r);const pending=r.start();assert(r.pending);r.clear();const before=stopped;resolve(stream());await pending;assert.equal(r.value,null);assert(!r.recording);assert(stopped>before,'Late microphone permission must release device after navigation');
 permission=Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));await assert.rejects(()=>r.start(),/микрофону/);assert(!r.pending);
 console.log('Recording, preview, cleanup, navigation race and denied permission passed');
})().catch(e=>{console.error(e);process.exitCode=1});
