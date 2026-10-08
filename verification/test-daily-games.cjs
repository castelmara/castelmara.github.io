const assert=require('node:assert/strict'),E=require('../assets/atlas-daily-games.js');
assert(E.answers.length>=180);
assert.equal(new Set(E.answers).size,E.answers.length);
assert(E.answers.every(w=>/^[а-я]{5}$/.test(w)));
assert.equal(E.dayKey(new Date('2026-10-08T21:59:00Z')),'2026-10-08');
assert.equal(E.dayKey(new Date('2026-10-08T22:00:00Z')),'2026-10-09');
assert.equal(E.dayKey(new Date('2026-12-08T23:00:00Z')),'2026-12-09');
const cycle=Array.from({length:E.answers.length},(_,i)=>E.answer(new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10)));
assert.equal(new Set(cycle).size,E.answers.length,'Daily deck does not repeat before completing a cycle');
assert.deepEqual(E.grade('банан','банка'),['correct','correct','correct','present','absent']);
assert.deepEqual(E.grade('маска','лампа'),['present','correct','absent','absent','correct']);
assert.deepEqual(E.grade('слово','слово'),Array(5).fill('correct'));
assert(!E.adjacent(6,7),'Rows do not wrap');
assert(!E.adjacent(0,8));assert(!E.adjacent(-1,0));
let seed=42;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let game=0;game<12;game++){
 let board=E.fresh(random);
 for(let turn=0;turn<30;turn++){
  assert.equal(E.lines(board).length,0,'Settled board has no free matches');assert(E.possible(board));
  let pair;for(let i=0;i<49&&!pair;i++)for(const j of [i+1,i+7])if(E.legal(board,i,j)){pair=[i,j];break;}
  const before=board.slice(),result=E.swap(board,...pair,random);
  assert.deepEqual(board,before,'Engine does not mutate input');
  assert(result.score>=30);assert(result.combo>=1);assert(result.frames.length===result.combo);
  assert.equal(result.board.length,49);assert(result.board.every(v=>Number.isInteger(v)&&v>=0&&v<5));
  assert.equal(E.swap(board,0,48,random),null,'Invalid swap costs nothing');board=result.board;
 }
}
const fallback=E.fresh(()=>0);assert.equal(E.lines(fallback).length,0);assert(E.possible(fallback));
console.log('PASS daily games: dictionary, Madrid midnight/DST, nonrepeating daily deck, duplicate letters, 360 legal swaps/cascades, immutability, playable boards');
