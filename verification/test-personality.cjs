const assert=require('node:assert/strict'),crypto=require('node:crypto');
const bank=require('../personality-test/questions.js'),copy=require('../personality-test/results.js'),engine=require('../personality-test/engine.js');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const types=['captain','wildcard','anchor','prodigy','ghost','spark'];
const vector=values=>Object.assign(Object.fromEntries(types.map(t=>[t,0])),values);
assert.equal(bank.version,'personality_test_v1');assert.equal(copy.version,bank.version);
assert.deepEqual(engine.ORDER,types);
assert.deepEqual(engine.CORE,{anchor:1,captain:5,prodigy:9,ghost:13,spark:17,wildcard:21});
assert.equal(bank.questions.length,24);
const primary=vector(),secondary=vector(),positions=Object.fromEntries(types.map(t=>[t,{A:0,B:0,C:0,D:0}]));
let count=0;
bank.questions.forEach((q,i)=>{
 assert.equal(q.id,'q'+String(i+1).padStart(2,'0'));assert.equal(q.answers.length,4);assert(q.text.trim());
 assert.deepEqual(q.answers.map(a=>a.id),['A','B','C','D']);
 assert.equal(new Set(q.answers.map(a=>a.primary_type)).size,4);
 q.answers.forEach(a=>{
  assert(types.includes(a.primary_type)&&types.includes(a.secondary_type));assert.notEqual(a.primary_type,a.secondary_type);
  assert.equal(a.primary_weight,3);assert.equal(a.secondary_weight,1);assert(a.text.trim());
  primary[a.primary_type]++;secondary[a.secondary_type]++;positions[a.primary_type][a.id]++;count++;
 });
});
assert.equal(count,96);
for(const type of types){assert.equal(primary[type],16,type);assert.equal(secondary[type],16,type);assert.deepEqual(positions[type],{A:4,B:4,C:4,D:4},type)}
// Fingerprints taken independently from DOCX sections 8 and 13, not from generated UI.
assert.equal(hash(JSON.stringify(bank.questions)),'5a989acec85028f4542807865f390c860a77a9dd1207ac5dcc39229855e3ff88','Exact canonical questions, order and weights');
const resultHashes=[];
assert.equal(Object.keys(copy.secondary).length,30);
for(const type of types){
 const a=copy.archetypes[type];
 for(const second of [null,...types.filter(t=>t!==type)]){
  const text=[a.title,a.motto,...a.description];
  if(second){const b=copy.secondary[type+':'+second];assert(b);text.push('SECONDARY — '+second.toUpperCase(),b.phrase,b.description)}
  text.push('STRENGTH',a.strength,'BLIND SPOT',a.blindSpot,'PROFILE STATUS',a.profileStatus);
  resultHashes.push(hash(text.join('\n')));
 }
}
assert.equal(hash(JSON.stringify(resultHashes)),'9dc3ae7ff339a563099a2a847e741da1337cf75b1f885d2a17ed804e37382898','All 36 canonical result compositions');
const resolve=(scores,core={},hits={})=>engine.resolveScores(vector(scores),vector(core),vector(hits));
assert.equal(resolve({captain:30,wildcard:30},{wildcard:3},{captain:20}).primary_type,'wildcard','CORE precedes hits');
assert.equal(resolve({captain:30,wildcard:30},{captain:1,wildcard:1},{wildcard:8,captain:7}).primary_type,'wildcard','Hits precede stable order');
assert.equal(resolve({captain:30,wildcard:30},{captain:1,wildcard:1},{captain:7,wildcard:7}).primary_type,'captain','Stable fallback');
assert.equal(resolve({captain:31,wildcard:30},{wildcard:3},{wildcard:24}).primary_type,'captain','Total precedes CORE');
assert.equal(resolve({captain:40,wildcard:28,anchor:26}).secondary_type,'wildcard','Exactly 70% and gap 2');
assert.equal(resolve({captain:40,wildcard:27,anchor:25}).secondary_type,null,'Below 70%');
assert.equal(resolve({captain:40,wildcard:28,anchor:27}).secondary_type,null,'Gap 1');
assert.equal(resolve({captain:40,wildcard:28,anchor:28},{wildcard:3}).secondary_type,null,'T2/T3 tie even with CORE advantage');
assert.equal(resolve({captain:30,wildcard:30,anchor:28}).secondary_type,'wildcard','T1/T2 tie can have secondary');
for(const [gap,category] of [[0,'mixed'],[2,'mixed'],[3,'balanced'],[6,'balanced'],[7,'dominant']])assert.equal(resolve({captain:40,wildcard:40-gap}).dominance_category,category);
let seed=27;
for(let trial=0;trial<100;trial++){
 const answers=Array.from({length:24},()=>{seed=(seed*1664525+1013904223)>>>0;return 'ABCD'[seed>>>30]});
 const before=JSON.stringify(answers),result=engine.scoreAnswers(answers);
 assert.equal(Object.values(result.scores).reduce((a,b)=>a+b,0),96);assert.equal(Object.values(result.primary_hits).reduce((a,b)=>a+b,0),24);
 assert.deepEqual(engine.scoreAnswers(answers),result);assert.equal(JSON.stringify(answers),before);
 for(const type of types){const q=bank.questions[engine.CORE[type]-1],a=q.answers.find(a=>a.id===answers[engine.CORE[type]-1]);assert.equal(result.core_scores[type],a.primary_type===type?3:a.secondary_type===type?1:0)}
 const old=answers[0];answers[0]=old==='A'?'B':'A';engine.scoreAnswers(answers);answers[0]=old;assert.deepEqual(engine.scoreAnswers(answers),result,'Changed answers never accumulate stale points');
}
assert(!engine.validateAnswers(Array(24).fill(null)));assert(engine.validateAnswers(Array(24).fill(null),false));
assert(!engine.validateAnswers(Array(24)));assert(!engine.validateAnswers(Array(24).fill('E')));
assert.throws(()=>engine.scoreAnswers(Array(23).fill('A')));assert.throws(()=>engine.scoreAnswers(Array(24).fill(null)));
console.log('PASS personality v1: 24/96 canonical bank, balanced 16/16 and 4/4/4/4, 36 exact results; scores, CORE/hits/order tie-breaks, secondary boundaries, dominance, determinism and answer edits.');
