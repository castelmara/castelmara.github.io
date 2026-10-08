const assert=require('node:assert/strict');
const {Chess}=require('../assets/vendor/chess-1.4.0.js');
const {choose}=require('../assets/atlas-chess-ai.js');
function play(moves){const g=new Chess();moves.forEach(m=>g.move(m));return g;}
const opening=new Chess();assert.equal(opening.moves().length,20);
assert.throws(()=>opening.move({from:'e2',to:'e5'}));
const castle=play(['e4','e5','Nf3','Nc6','Bc4','Nf6','O-O']);assert.equal(castle.get('g1').type,'k');assert.equal(castle.get('f1').type,'r');
const attackedCastle=new Chess('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1');assert(!attackedCastle.moves().includes('O-O'));
const ep=play(['e4','a6','e5','d5','exd6']);assert(!ep.get('d5'));assert.equal(ep.get('d6').type,'p');
for(const promotion of ['q','r','b','n']){const g=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');g.move({from:'a7',to:'a8',promotion});assert.equal(g.get('a8').type,promotion);}
const mate=play(['f3','e5','g4','Qh4#']);assert(mate.isCheckmate());assert.equal(mate.turn(),'w');
assert(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').isStalemate());
assert(new Chess('7k/8/6K1/8/8/8/8/8 w - - 0 1').isInsufficientMaterial());
const repeated=play(['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']);assert(repeated.isThreefoldRepetition());
const restored=new Chess();restored.loadPgn(repeated.pgn());assert(restored.isThreefoldRepetition(),'PGN preserves draw history after reload');
const ai=play(['f3','e5','g4']),before=ai.pgn(),best=choose(ai,1200);assert.equal(ai.pgn(),before,'AI must restore its input position');ai.move(best);assert(ai.isCheckmate(),'AI sees mate in one');
assert.equal(choose(mate),null);
async function serverTests(){
 const {createHandler}=await import('../supabase/functions/atlas-chess/handler.mjs');
 const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444';
 let row={id,white_user:A,black_user:B,pgn:'',revision:0,status:'active'},writes=0;
 const handler=createHandler({Chess,getUser:async token=>[A,B,C].includes(token)?{id:token}:null,readMatch:async()=>structuredClone(row),write:async args=>{
  if(args.p_revision!==row.revision)throw {code:'40001'};
  writes++;row={...row,...args.p_state,revision:row.revision+1};return row;
 }});
 const request=(user,body)=>handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+user},body:JSON.stringify({action:'move',match:id,revision:row.revision,from:'e2',to:'e4',...body})}));
 assert.equal((await request('invalid',{})).status,401);
 assert.equal((await request(C,{})).status,403);
 assert.equal((await request(B,{})).status,409);
 assert.equal((await request(A,{to:'e5'})).status,400);assert.equal(writes,0);
 const r=await request(A,{});assert.equal(r.status,200);assert.equal(row.turn,'b');assert(row.pgn.includes('e4'));
 assert.equal((await request(B,{from:'e7',to:'e5',revision:0})).status,409);
 // Concurrent valid requests share a revision; only one atomic write may succeed.
 const outcomes=await Promise.all([request(B,{from:'e7',to:'e5'}),request(B,{from:'e7',to:'e6'})]);assert.equal(outcomes.filter(r=>r.status===200).length,1);assert.equal(writes,2);
 row={...row,pgn:play(['f3','e5','g4']).pgn(),revision:10};
 assert.equal((await request(B,{from:'d8',to:'h4'})).status,200);assert.equal(row.result,'b');
 row.status='finished';assert.equal((await request(A,{})).status,409);
 assert.equal((await handler(new Request('https://example.test',{method:'OPTIONS'}))).status,200);
 console.log('PASS chess: legal moves, castling safety, en passant, all promotions, mate/stalemate/repetition, AI, auth/outsider/turn checks, stale and concurrent writes');
}
serverTests().catch(e=>{console.error(e);process.exitCode=1});
