const assert=require('node:assert/strict'),E=require('../assets/atlas-games-engine.js');
let paths=0;
function explore(board){const r=E.outcome(board);if(r){assert.notEqual(r,'X','AI must block every winning line');paths++;return;}
 for(let i=0;i<9;i++)if(!board[i]){const b=board.slice();b[i]='X';if(!E.outcome(b))b[E.ai(b)]='O';explore(b);}}
explore(Array(9).fill(''));assert(paths>100);
assert.equal(E.outcome(['X','X','X','','','','','','']),'X');
assert.equal(E.outcome(['X','O','X','X','O','O','O','X','X']),'draw');
for(let n=0;n<40;n++){const b=E.puzzle();assert.equal(new Set(b).size,16);assert(!E.solved(b));let inv=0;for(let i=0;i<16;i++)for(let j=i+1;j<16;j++)if(b[i]&&b[j]&&b[i]>b[j])inv++;assert.equal((inv+4-Math.floor(b.indexOf(0)/4))%2,1);}
const solved=Array.from({length:16},(_,i)=>(i+1)%16);assert.equal(E.slide(solved,0),solved);assert(E.solved(E.slide(E.slide(solved,14),15)));
let snake={size:4,body:[{x:2,y:1},{x:1,y:1}],direction:{x:1,y:0},food:{x:3,y:1},score:0};snake=E.snakeStep(snake,()=>0);assert.equal(snake.score,1);assert.equal(snake.body.length,3);assert(E.snakeStep(snake).over);
const well=Array.from({length:20},()=>Array(10).fill(0));well[19]=Array(10).fill(1);well[19][9]=0;const p={x:9,y:19,shape:[[1]],color:2};assert(E.fits(well,p));assert(!E.fits(well,{...p,x:10}));const locked=E.lock(well,p);assert.equal(locked.lines,1);assert(locked.board[0].every(x=>!x));assert.equal(well[19][9],0);
for(const shape of E.shapes){let r=shape;for(let n=0;n<4;n++)r=E.rotate(r);assert.deepEqual(r,shape);}
console.log('PASS games: exhaustive AI ('+paths+' outcomes), solvable puzzles, snake growth/collision, tetris bounds/rotation/line clearing');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/atlas-games.js'),'utf8');
const keyboard=source.split('\n').find(line=>line.includes("document.addEventListener('keydown'"));
for(const game of ['snake','tetris']){
 let handler,action,prevented=false;
 vm.runInNewContext(keyboard,{game,active:()=>true,control:a=>{action=a},document:{addEventListener:(_,fn)=>{handler=fn}}});
 for(const [code,key,expected] of [['KeyW','ц','up'],['KeyA','ф','left'],['KeyS','ы','down'],['KeyD','в','right'],['KeyW','W','up'],['KeyA','A','left'],['KeyS','S','down'],['KeyD','D','right'],['ArrowLeft','ArrowLeft','left'],['Space',' ','drop']]){
  action=null;prevented=false;handler({code,key,target:{closest:()=>null},preventDefault:()=>{prevented=true}});
  assert.equal(action,expected,game+' '+key);assert(prevented);
 }
 for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{target:{closest:()=>({})}}]){
  action=null;handler({code:'KeyW',key:'w',target:{closest:()=>null},preventDefault:()=>{},...extra});assert.equal(action,null);
 }
}
console.log('PASS WASD: both games, Cyrillic layout, uppercase, arrows, space; typing and browser shortcuts preserved');

// Exercise the real input and animation lifecycle without a database or a browser.
const events={},frames=new Map(),timers=new Map();let sequence=0,now=100;
const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>target[key]||(()=>{})});
const canvas={width:0,height:0,getContext:()=>context2d,matches:()=>true,setPointerCapture(){}};
const statusNode={textContent:''},gameRoot={querySelector:s=>s==='canvas'?canvas:statusNode,querySelectorAll:()=>[],innerHTML:''};
const testWindow={AtlasGamesEngine:E,devicePixelRatio:2,matchMedia:()=>({matches:false}),addEventListener(){}};
const sandbox={window:testWindow,document:{hidden:false,querySelector:()=>null,getElementById:()=>gameRoot,addEventListener:(name,fn)=>{events[name]=fn}},performance:{now:()=>now},
 setTimeout:fn=>{timers.set(++sequence,fn);return sequence},clearTimeout:id=>timers.delete(id),setInterval:()=>0,clearInterval(){},
 requestAnimationFrame:fn=>{frames.set(++sequence,fn);return sequence},cancelAnimationFrame:id=>frames.delete(id)};
vm.runInNewContext(source.replace("  if(active())window.atlasRenderGames('games');",`window.gameTest={
 setup(name){game=name;reset();paused=false;}, step,draw,stop,
 snapshot(){return {direction:snake?.direction,body:snake?.body,previousBody,piece:JSON.parse(JSON.stringify(piece||null)),paused,gesture};}
};`),sandbox);
sandbox.document.querySelector=()=>({});
const ui=testWindow.gameTest;
ui.setup('snake');ui.step();assert.equal(frames.size,1);assert.equal(timers.size,1);
assert.equal(ui.snapshot().body[0].x,9);assert.equal(ui.snapshot().previousBody[0].x,8);
events.pointerdown({target:canvas,isPrimary:true,pointerId:1,clientX:80,clientY:80});
events.pointermove({pointerId:1,clientX:80,clientY:40});assert.equal(ui.snapshot().direction.y,-1);
events.pointermove({pointerId:1,clientX:20,clientY:40});assert.equal(ui.snapshot().direction.y,-1,'Only one turn is allowed per snake step');
events.pointercancel();assert.equal(ui.snapshot().gesture,null);
ui.stop();assert.equal(frames.size,0);assert.equal(timers.size,0);assert(ui.snapshot().paused);
ui.setup('tetris');const before=JSON.stringify(ui.snapshot().piece);now+=16;ui.draw();assert.equal(JSON.stringify(ui.snapshot().piece),before,'Visual easing/landing preview never changes collision state');
assert.equal(canvas.width,480);assert.equal(canvas.height,960,'Canvas uses a capped retina backing store');
events.pointerdown({target:canvas,isPrimary:true,pointerId:2,clientX:80,clientY:80});
events.pointermove({pointerId:2,clientX:110,clientY:80});assert.equal(ui.snapshot().piece.x,4);
events.pointerup({pointerId:2});assert.equal(ui.snapshot().gesture,null);
ui.step();ui.stop();assert.equal(frames.size,0);assert.equal(timers.size,0);
console.log('PASS mobile: swipe controls, snake turn guard, cancellation, animation cleanup, retina canvas and read-only landing preview');
