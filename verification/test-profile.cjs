const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
for(const script of scripts) new vm.Script(script);
const renderer=scripts.find(s=>s.includes('function renderCharacterProfile(character)'));
const root={innerHTML:'',dataset:{}};
const document={head:{appendChild(){}},body:{appendChild(){}},createElement(){return {}},getElementById:id=>id==='atlasCharacterProfileRoot'?root:null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
const window={addEventListener(){},dispatchEvent(){}};
const context=vm.createContext({window,document,console,CustomEvent:class{},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){}});
for(const file of ['students','coaches','staff','leon','character-directory']) vm.runInContext(fs.readFileSync(path.join(base,'data',file+'.js'),'utf8'),context);
vm.runInContext(renderer.replace(/\}\)\(\);\s*$/, 'window.profileTest={render:renderCharacterProfile,overview:renderOverview,indicators:normalizeIndicators,renderIndicators,player:renderPlayerMetaCard};})();'),context);
const chars=window.ATLAS_CHARACTERS.filter(c=>c.profile),before=JSON.stringify(chars);
for(const c of chars){
 window.profileTest.render(c);
 for(const cls of ['atlas-profile-hero','atlas-profile-status-card','atlas-profile-overview-left','atlas-profile-main-info','atlas-profile-overview-side','atlas-player-meta-card']) assert(root.innerHTML.includes(cls),c.id+': '+cls);
 for(const tab of ['overview','dossier','relations']) assert(root.innerHTML.includes('data-character-tab="'+tab+'"'),c.id+': '+tab);
 assert.equal((root.innerHTML.match(/class="atlas-community-portrait"/g)||[]).length,1);
 for(const cls of ['atlas-profile-overview-grid','atlas-profile-tabs','atlas-profile-card atlas-player-meta-card']) assert.equal(root.innerHTML.split('class="'+cls+'"').length-1,1,c.id+': one '+cls);
 for(const tab of ['overview','dossier','relations']) assert.equal(root.innerHTML.split('data-character-tab-panel="'+tab+'"').length-1,1,c.id+': one panel '+tab);
 const first=root.innerHTML;window.profileTest.render(c);assert.equal(root.innerHTML,first,c.id+': repeat rendering must replace, not append');
 assert.equal(root.dataset.communityId,c.id);
}
assert.equal(JSON.stringify(chars),before,'Rendering must not mutate profile data');
const sparse={id:'sparse',name:'Sparse',profile:{}};
window.profileTest.render(sparse);assert(root.innerHTML.includes('показатели пока пустые'));assert(root.innerHTML.includes(' hidden>'));assert(!root.innerHTML.includes('—/10'));
assert(root.innerHTML.includes('информация пока не добавлена'));assert(root.innerHTML.includes('class="atlas-profile-status-card" hidden'));
const snapshot=root.innerHTML;window.profileTest.render({id:'card-only',name:'Closed'});assert.equal(root.innerHTML,snapshot);
assert(!window.atlasRenderCharacterChip({id:'closed',name:'Closed'}).includes('<button'));
assert(window.atlasRenderCharacterChip(chars[0]).includes('data-atlas-profile-id="'+chars[0].id+'"'));
const values={items:[{label:'репутация',value:'хорошая'},{label:'пропуск',value:''},{label:'счёт',value:0}]};
const normalized=window.profileTest.indicators(sparse,values);assert.equal(normalized.items.length,2);assert.equal(normalized.items[0].value,'хорошая');
const mixed=window.profileTest.renderIndicators({display:'bars',items:[{label:'балл',value:'0/10'},{label:'счёт',value:0},{label:'репутация',value:'хорошая'}]});
assert(mixed.includes('>0</span>'));assert(mixed.includes('>хорошая</span>'));assert(!mixed.includes('—/10'));assert.equal(mixed.split('class="atlas-indicator-bar"').length-1,1);
const player=window.profileTest.player({id:'fixture',profile:{},player:{name:'<Player>',nickname:'@handle'}});assert(player.includes('&lt;Player&gt; · @handle'));
console.log('PASS '+chars.length+' full profiles: common layout, tabs, one portrait, immutable data, sparse fields, full-only chips and actual indicators.');
if(process.argv.includes('--preview')){
 const out=process.env.PROFILE_PREVIEW_DIR;assert(out);
 fs.mkdirSync(out,{recursive:true});
 const css=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n')+'\n'+fs.readFileSync(path.join(base,'assets/atlas-community.css'),'utf8');
 for(const id of ['ramona-martina-suarez','amelia-castro','mikel-vila-rodriguez','leon-scott-redfield']){
  const c=chars.find(c=>c.id===id);assert(c,id);window.profileTest.render(c);
  fs.writeFileSync(path.join(out,id+'.html'),'<meta charset="utf-8"><style>'+css+'</style><div id="atlas-app" data-theme="dark"><div id="atlasCharacterProfileRoot">'+root.innerHTML+'</div></div>');
 }
}
