const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {Chess}=require('../assets/vendor/chess-1.4.0.js');
const source=fs.readFileSync(path.join(__dirname,'../assets/atlas-chess.js'),'utf8');
const events={},windowEvents={},host={isConnected:true,innerHTML:''};let worker,resolveRequest;
const win={AtlasChess:Chess,ATLAS_CURRENT_SESSION:{user:{id:'A'}},addEventListener:(type,fn)=>{windowEvents[type]=fn},ATLAS_SUPABASE:{functions:{invoke:()=>new Promise(resolve=>{resolveRequest=resolve})}}};
const sandbox={window:win,document:{hidden:false,querySelector:()=>host,addEventListener:(type,fn)=>{events[type]=fn}},setInterval:()=>1,clearInterval(){},Worker:class{constructor(){worker=this}postMessage(data){this.request=data}terminate(){this.terminated=true}}};
vm.runInNewContext(source.replace('})();',`window.testChess={
 online(row){mode='online';matches=[row];installMatch(row);render();},
 ai(fen){mode='ai';local=new Chess(fen);from='';promotion=null;render();},
 installMatch,send,render,think,
 snapshot(){return {from,promotion,selected,busy,fen:game().fen()};}
};})();`),sandbox);
win.AtlasChessUI.mount(host);const ui=win.testChess;
const click=dataset=>{const b={dataset};events.click({target:{closest:s=>s==='#atlasChessRoot'?host:b}})};
assert.equal((host.innerHTML.match(/data-square=/g)||[]).length,64);
click({square:'e2'});assert.equal(ui.snapshot().from,'e2');assert.equal((host.innerHTML.match(/ legal/g)||[]).length,2);
click({square:'e4'});assert(worker);assert(host.innerHTML.includes('Компьютер думает'));
assert(host.innerHTML.includes('atlasChessDifficulty'),'AI difficulty selector is visible');
assert.equal(worker.request.difficulty,'medium');
const oldWorker=worker,position=ui.snapshot().fen;
events.change({target:{id:'atlasChessDifficulty',value:'hard'}});
assert(oldWorker.terminated,'Changing difficulty stops old search');assert.equal(worker.request.difficulty,'hard');
assert.equal(ui.snapshot().fen,position,'Changing difficulty preserves the game');
oldWorker.onmessage({data:{move:{from:'e7',to:'e5'}}});
assert.equal(ui.snapshot().fen,position,'Stale worker cannot move in the same position');
assert(!worker.terminated,'Stale worker cannot cancel the replacement');
win.AtlasChessUI.leave();assert(worker.terminated,'Leaving terminates worker');win.AtlasChessUI.mount(host);
worker.onmessage({data:{move:{from:'e7',to:'e5'}}});assert(ui.snapshot().fen.includes(' b ')===false);
ui.ai('7k/P7/8/8/8/8/8/7K w - - 0 1');click({square:'a7'});click({square:'a8'});
assert.equal(ui.snapshot().promotion,'a8');assert.equal((host.innerHTML.match(/data-piece=/g)||[]).length,4);
click({chessAction:'promote',piece:'n'});assert.equal(new Chess(ui.snapshot().fen).get('a8').type,'n');
const row={id:'match',white_user:'A',black_user:'B',status:'active',pgn:'',revision:1};ui.online(row);click({square:'e2'});ui.installMatch({...row});assert.equal(ui.snapshot().from,'e2','Unchanged poll must preserve the selected piece');
win.ATLAS_CURRENT_SESSION.user.id='B';ui.render();assert(host.innerHTML.indexOf('data-square="h1"')<host.innerHTML.indexOf('data-square="a8"'),'Black sees their side at the bottom');
win.ATLAS_CURRENT_SESSION.user.id='A';
(async()=>{
 const pending=ui.send('move',{from:'e2',to:'e4'});assert(ui.snapshot().busy);
 // Leave before a response, then change account: old response cannot repopulate state.
 win.AtlasChessUI.leave();win.ATLAS_CURRENT_SESSION.user.id='B';windowEvents.atlasPlayerAuthReady();
 resolveRequest({data:{match:{...row,revision:2}}});await pending;assert.equal(ui.snapshot().selected,'');assert(!ui.snapshot().busy);
 console.log('PASS chess UI: legal highlights, worker lifecycle, promotion choices, stable polling, black orientation, stale account response');
})().catch(e=>{console.error(e);process.exitCode=1});
