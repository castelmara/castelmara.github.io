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

for(const id of ['martina-chavez-romero','mariella-alcaraz','elias-azarolla']){
 const matches=window.ATLAS_CHARACTERS.filter(c=>c.id===id);assert.equal(matches.length,1);
 const c=matches[0];assert(!window.ATLAS_CARD_ONLY.some(c=>c.id===id));
 assert(window.atlasRenderCharacterChip(c).includes('data-atlas-profile-id="'+id+'"'));
 window.atlasOpenCharacter(id);assert.equal(root.dataset.communityId,id);
 for(const part of Object.values(c.profile.dossier))assert(part.text.length>100);
 assert(c.cardImage&&c.player);
}
console.log('PASS three full profiles, clickable cards, preserved media/player and dossier sections');
