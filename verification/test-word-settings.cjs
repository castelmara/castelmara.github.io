const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let saved=null,confirmYes=true,fail=false,count=0;
const make=(length=5)=>({id:String(++count),mode:'practice',length,level:'normal',status:'playing',guesses:[],marks:[],max_attempts:6});
const host={isConnected:true,innerHTML:''};
const window={ATLAS_CURRENT_SESSION:{user:{id:'a'}},addEventListener(){},dispatchEvent(){},ATLAS_SUPABASE:{async rpc(name,a){
 if(fail)return {error:{message:'offline'}};
 if(name==='atlas_word_start'){if(!saved||saved.status!=='playing')saved=make(a.p_length)}
 else {saved.status='skipped'}
 return {data:structuredClone(saved)};
}}};
const ctx={window,document:{querySelector:()=>true,addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},Intl,Date,confirm:()=>confirmYes,setInterval(){},CustomEvent:class{}};
vm.createContext(ctx);
let source=fs.readFileSync('assets/atlas-word-game.js','utf8').replace(/\}\)\(\);\s*$/,`window.test={changeSettings,start,state:()=>({game,length,level}),setup(g,n){host=window.host;mode='practice';game=g;length=n;level='normal'}};})();`);
window.host=host;vm.runInContext(source,ctx);const api=window.test;
(async()=>{
 saved=make();api.setup(structuredClone(saved),5);
 confirmYes=false;assert.equal(await api.changeSettings(6,'normal'),false);assert.equal(api.state().length,5);assert.equal(saved.status,'playing');
 confirmYes=true;await api.changeSettings(6,'normal');assert.equal(saved.status,'skipped');assert.equal(api.state().length,6);await api.start();assert.equal(api.state().game.length,6);
 saved=make(5);api.setup(null,6);await api.start();assert.equal(api.state().game.length,6,'resumed five-letter game cannot silently override requested six letters');
 fail=true;await api.changeSettings(7,'normal');assert.equal(api.state().length,6,'network error preserves game and settings');
 console.log('PASS word settings: cancel, active switch, resumed game, network failure');
})().catch(e=>{console.error(e);process.exitCode=1});
