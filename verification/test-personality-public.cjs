const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'..'),engine=require('../personality-test/engine.js');
const source=fs.readFileSync(path.join(base,'assets/atlas-personality-store.js'),'utf8');
const rows=new Map();let fail=false,writes=0;
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
function browser(id){
  const events=[],window={AtlasPersonalityEngine:engine,ATLAS_CURRENT_SESSION:id?{user:{id}}:null,dispatchEvent:e=>events.push(e)};
  window.ATLAS_SUPABASE={auth:{getSession:async()=>({data:{session:window.ATLAS_CURRENT_SESSION}})},from(table){
    assert.equal(table,'atlas_player_personality_results');let target,payload;
    return {select(){return this},eq(key,value){assert.equal(key,'user_id');target=value;return this},maybeSingle:async()=>({data:clone(rows.get(target))}),
      upsert(value,options){assert.equal(options.onConflict,'user_id');payload=clone(value);return this},async single(){
        if(fail)return {error:new Error('network failure')};
        assert.equal(payload.user_id,window.ATLAS_CURRENT_SESSION.user.id);writes++;rows.set(payload.user_id,payload);return {data:clone(payload)};
      }};
  }};
  vm.runInNewContext(source,{window,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},localStorage:{getItem(){throw Error('Local completed result must never be read')}}});
  return {window,store:window.AtlasPersonalityStore,events};
}
(async()=>{
  const a=browser('A'),b=browser('B'),guest=browser(null),answers=Array(24).fill('A'),retake=Array(24).fill('B');
  const first=await a.store.complete('A',answers,engine.version);assert.equal(writes,1);assert.equal(a.events.length,1);
  for(const reader of [a,b,guest,browser('A'),browser(null)])assert.equal((await reader.store.load('A')).primary_type,first.primary_type);
  assert.equal(await b.store.load('B'),null);assert.equal(await guest.store.load('absent'),null);
  assert.deepEqual(rows.get('A').answers,answers);assert.equal(rows.get('A').test_version,engine.version);
  // Drafts, incomplete retakes and failed writes cannot replace the completed row.
  const old=clone(rows.get('A'));
  await assert.rejects(a.store.complete('A',retake.slice(0,12),engine.version));assert.deepEqual(rows.get('A'),old);
  fail=true;await assert.rejects(a.store.complete('A',retake,engine.version));fail=false;assert.deepEqual(rows.get('A'),old);assert.equal(a.events.length,1);
  await assert.rejects(b.store.complete('A',retake,engine.version));await assert.rejects(guest.store.complete('A',retake,engine.version));
  await a.store.complete('A',retake,engine.version);assert.deepEqual(rows.get('A').answers,retake);assert.equal(a.events.length,2);
  // Answers/version are authoritative even when stored summary columns are inconsistent.
  rows.get('A').primary_type='forged';assert.equal((await b.store.load('A')).primary_type,engine.scoreAnswers(retake).primary_type);
  rows.get('A').test_version='unsupported';assert.equal(await b.store.load('A'),null);
  a.window.ATLAS_CURRENT_SESSION={user:{id:'B'}};await assert.rejects(a.store.complete('A',answers,engine.version));
  const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
  const snippet=html.slice(html.indexOf('  var atlasPlayerPersonalityTypes='),html.indexOf("  document.addEventListener('click',function(event){",html.indexOf('  var atlasPlayerPersonalityTypes=')));
  const ui={esc:String};vm.createContext(ui);vm.runInContext(snippet,ui);
  assert(ui.atlasPlayerPersonalityCard('A',false,first).includes('THE '+first.primary_type.toUpperCase()));
  assert(!ui.atlasPlayerPersonalityCard('A',false,first).includes('data-player-personality-open'));
  assert(!ui.atlasPlayerPersonalityCard('A',false,null).includes('data-player-personality-open'));
  assert(ui.atlasPlayerPersonalityCard('A',true,null).includes('УЗНАЙ СВОЙ ТИП'));
  assert(ui.atlasPlayerPersonalityCard('A',true,first).includes('пройти тест заново'));
  console.log('PASS public personality: A/B/guest/fresh-browser reads, source answers/version, owner-only completion, missing results, retake/failure preservation, successful replacement, account switch, owner/visitor card actions. Mocked API; see SQL test for actual RLS.');
})().catch(error=>{console.error(error);process.exitCode=1});
