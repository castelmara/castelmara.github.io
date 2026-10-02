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
