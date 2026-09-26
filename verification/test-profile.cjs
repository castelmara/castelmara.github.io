const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
for(const script of scripts) new vm.Script(script);
const renderer=scripts.find(s=>s.includes('function renderCharacterProfile(character)'));
const root={innerHTML:'',dataset:{}};
let tabNodes=[],panelNodes=[];
const document={head:{appendChild(){}},body:{appendChild(){}},createElement(){return {}},getElementById:id=>id==='atlasCharacterProfileRoot'?root:null,querySelector:()=>null,querySelectorAll:s=>s.endsWith('.atlas-profile-tab-btn')?tabNodes:s.endsWith('.atlas-profile-tab-panel')?panelNodes:[],addEventListener(){}};
const window={addEventListener(){},dispatchEvent(){}};
const context=vm.createContext({window,document,console,CustomEvent:class{},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){}});
for(const [,file] of html.matchAll(/<script\s+src="(data\/[^"?]+\.js)(?:\?[^\"]*)?"/g)) vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
vm.runInContext(renderer.replace(/\}\)\(\);\s*$/, 'window.profileTest={render:renderCharacterProfile,overview:renderOverview,indicators:normalizeIndicators,renderIndicators,player:renderPlayerMetaCard,switchTab:switchCharacterTab};})();'),context);
const chars=window.ATLAS_CHARACTERS.filter(c=>c.profile),before=JSON.stringify(chars);
for(const c of chars){
 window.atlasOpenCharacter(c.id);
 assert(!/\bundefined\b|\bnull\b|PASTE_|\[object Object\]/.test(root.innerHTML),c.id+': no leaked placeholders');
 for(const value of Object.values(c.profile.overview?.mainInfo||{})) assert(['string','number'].includes(typeof value),c.id+': scalar main info');
 for(const section of Object.values(c.profile.dossier||{})) assert.equal(typeof section.text,'string',c.id+': dossier text');
 for(const group of Object.values(c.profile.relations||{})) {
  assert(Array.isArray(group.items),c.id+': relation items');
  for(const item of group.items) for(const key of ['name','relation','text','targetId']) if(item[key]!=null) assert.equal(typeof item[key],'string',c.id+': relation '+key);
 }
 for(const cls of ['atlas-profile-hero','atlas-profile-status-card','atlas-profile-overview-left','atlas-profile-main-info','atlas-profile-overview-side','atlas-player-meta-card']) assert(root.innerHTML.includes(cls),c.id+': '+cls);
 for(const tab of ['overview','dossier','relations']) assert(root.innerHTML.includes('data-character-tab="'+tab+'"'),c.id+': '+tab);
 assert.equal((root.innerHTML.match(/class="atlas-community-portrait"/g)||[]).length,1);
 for(const cls of ['atlas-profile-overview-grid','atlas-profile-tabs','atlas-profile-card atlas-player-meta-card']) assert.equal(root.innerHTML.split('class="'+cls+'"').length-1,1,c.id+': one '+cls);
 for(const tab of ['overview','dossier','relations']) assert.equal(root.innerHTML.split('data-character-tab-panel="'+tab+'"').length-1,1,c.id+': one panel '+tab);
 // The actual switcher must activate exactly one button and its matching panel.
 const nodes=()=>['overview','dossier','relations'].map(id=>{const node={id,active:false,getAttribute(){return id}};node.classList={toggle(_class,on){node.active=on}};return node});
 tabNodes=nodes();panelNodes=nodes();
 for(const tab of ['overview','dossier','relations']) {
  window.profileTest.switchTab(tab);
  assert.deepEqual(tabNodes.filter(n=>n.active).map(n=>n.id),[tab]);
  assert.deepEqual(panelNodes.filter(n=>n.active).map(n=>n.id),[tab]);
 }
 const first=root.innerHTML;window.profileTest.render(c);assert.equal(root.innerHTML,first,c.id+': repeat rendering must replace, not append');
 assert.equal(root.dataset.communityId,c.id);
}
assert.equal(JSON.stringify(chars),before,'Rendering must not mutate profile data');
// Import scope and media protection use the last pre-import commit, not a snapshot of this implementation.
const prior=require('./test-courses.cjs').load('af8ef81c8984c461f8e98094aeba706a6121e878').all;
const imported='alessandra-manrique bianca-solis josuke-higashikata jacqueline-kelsada miles-turner manuel-moretti melody-stoker oliver-brown ramona-martina-suarez cedric-joy francesca-romero hudson-hummond charles-berg roberto-castillo rodrigo-morales'.split(' ');
const all=JSON.parse(JSON.stringify([...window.ATLAS_CHARACTERS,...window.ATLAS_CARD_ONLY]));
assert.equal(chars.length,70);assert.equal(all.length,prior.length);
assert.equal(new Set(all.map(c=>c.id)).size,all.length);
assert.equal(imported.filter(id=>!prior.find(c=>c.id===id).profile).length,9);
const media=c=>[c.image,c.avatar,c.cardImage,c.banner,c.heroImage,c.card?.image,c.profile?.avatar,c.profile?.heroImage];
for(const old of prior) {
 const c=all.find(c=>c.id===old.id);assert(c,old.id);
 if(!imported.includes(c.id)) {assert.deepEqual(c,old,c.id+': outside import unchanged');continue;}
 assert(c.profile?.sourceQuestionnaire,c.id+': source provenance');assert(!c.closed,c.id+': opens as full profile');
 assert.deepEqual(c.player,old.player,c.id+': player preserved');
 if(old.profile) assert.deepEqual(media(c),media(old),c.id+': all existing media preserved');
 else assert(media(c).filter(Boolean).every(url=>url===old.image),c.id+': use existing image only');
 for(const url of media(c).filter(Boolean)) if(!/^https?:\/\//.test(url)) assert(fs.existsSync(path.join(base,url)),c.id+': local image exists');
 for(const part of ['biography','personality','motivation','extra']) assert(c.profile.dossier[part]?.text.trim(),c.id+': '+part);
}
for(const id of ['hudson-hummond','oliver-brown','cedric-joy','melody-stoker']) assert.deepEqual(all.find(c=>c.id===id).profile.dossier,prior.find(c=>c.id===id).profile.dossier,id+': authored text preserved');
const manuel=all.find(c=>c.id==='manuel-moretti').profile.dossier;
for(const [key,section] of Object.entries(prior.find(c=>c.id==='manuel-moretti').profile.dossier)) {
 const text=manuel[key].text.replace(' (American Youth Soccer Organization)','').replaceAll(' (coppa carnevale)','').replace(' (полупрофессиональная лига США)','');
 assert.equal(text,section.text,'Manuel: preserve corrected prose, only add source details');
}
const ramona=all.find(c=>c.id==='ramona-martina-suarez').profile;
assert.equal(ramona.overview.mainInfo.birthDate,'22.02.2004');assert.equal(ramona.overview.mainInfo.age,'20 лет');
assert.equal(ramona.overview.mainInfo.faculty,'факультет спортивной аналитики и менеджмента');
assert.equal(ramona.overview.mainInfo.department,'кафедра спортивного права и агентской деятельности');
assert(!/седрик|впервые о мигеле/.test(JSON.stringify(ramona.dossier)));
assert(ramona.dossier.biography.text.startsWith('рамона родилась в мадриде'));
assert.deepEqual(Object.keys(ramona.relations),['family'],'Ramona: use relationships from the current questionnaire');
const charles=all.find(c=>c.id==='charles-berg').profile;
assert(!/холихилл|геймдизайн/.test(JSON.stringify(charles)));
assert(charles.dossier.motivation.text.startsWith("[для пасс: самая главная и очевидная мотивация чарли – возможность ебаться с холгером абелем]\n\n"),"Charles: retain the author note verbatim");
const importedBefore=JSON.stringify(all);
vm.runInContext(fs.readFileSync(path.join(base,'data/ankety-profiles.js'),'utf8'),context);
assert.equal(JSON.stringify([...window.ATLAS_CHARACTERS,...window.ATLAS_CARD_ONLY]),importedBefore,'Repeated import does not duplicate/reset profiles');
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
console.log('PASS '+chars.length+' full profiles: opening, tab switching, valid fields, no placeholders/duplicates; 15 imports, 9 conversions, preserved media/players/authored prose; all other characters unchanged.');
if(process.argv.includes('--preview')){
 const out=process.env.PROFILE_PREVIEW_DIR;assert(out);
 fs.mkdirSync(out,{recursive:true});
 const css=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n')+'\n'+fs.readFileSync(path.join(base,'assets/atlas-community.css'),'utf8');
 for(const id of ['ramona-martina-suarez','amelia-castro','mikel-vila-rodriguez','leon-scott-redfield']){
  const c=chars.find(c=>c.id===id);assert(c,id);window.profileTest.render(c);
  fs.writeFileSync(path.join(out,id+'.html'),'<meta charset="utf-8"><style>'+css+'</style><div id="atlas-app" data-theme="dark"><div id="atlasCharacterProfileRoot">'+root.innerHTML+'</div></div>');
 }
}
