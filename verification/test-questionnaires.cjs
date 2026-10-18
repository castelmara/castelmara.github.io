const assert=require('node:assert/strict');
const {mergeProfile,esc}=require('../assets/atlas-questionnaires.js');
const base={id:'example',name:'Original',cardImage:'portrait.jpg',profile:{overview:{mainInfo:{fullName:'Original',age:'20'}},dossier:{biography:{text:'old'},personality:{text:'kept'}},relations:{friends:{items:[]}}}};
const next=mergeProfile(base,{biography:'new\n\nparagraph',fullName:'Approved name',age:'',unknown:'ignored'});
assert.equal(next.profile.dossier.biography.text,'new\n\nparagraph');
assert.equal(base.profile.dossier.biography.text,'old');
assert.equal(next.profile.dossier.personality.text,'kept');
assert.equal(next.profile.overview.mainInfo.age,'20');
assert.equal(next.profile.overview.mainInfo.fullName,'Approved name');
assert.equal(next.cardImage,'portrait.jpg');
assert.equal(next.profile.overview.mainInfo.unknown,undefined);
assert.deepEqual(next.profile.relations,base.profile.relations);
assert.ok(mergeProfile({id:'card-only'},{biography:'new'}).profile.dossier.biography);
assert.equal(esc('<img onerror="bad">'),'&lt;img onerror=&quot;bad&quot;&gt;');
console.log('Questionnaire merge, preservation and escaping checks passed');

const {headerLabels,acceptance}=require("../assets/atlas-questionnaires.js");
assert.deepEqual(Object.keys(headerLabels),["fullName","faculty","faceclaim"]);
assert.match(acceptance("Мартина"),/Мартина.*успешно зарегистрирован/);
