const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const base = path.join(__dirname, '..');
// User-supplied list, mapped to existing IDs (including shortened names).
const groups = {
  1: `milagros-paz-bonachera bruna-valentina-morales amalia-reinhart taejoon-soh katarina-ward chiara-de-luca`,
  2: `dolly-eigner hudson-hummond michaela-portado ramona-martina-suarez anthony-rookwood martina-chavez-romero nico-guerriero elias-azarolla pedro-martinez flores-del-campo ava-leone esteban-furtado alexa-soriano vanessa-moreno joaquin-morales rene-gott tatiana-herrera pieter-vermeer javier-gonzalez axel-beltran satoru-saitou dahlia-vale francesca-romero kira-denali scarlett-vega shawn-oconnor erasmo-de-verastegui amaya-ruiz jacqueline-kelsada leandros-asteriadis enrique-cruz letitia-esteban bosco-salviati silvia-ramos perry-gallagher hikaru-haitani ariella-de-ville siena-sinclair`,
  3: `oliver-brown alessandra-manrique manuel-moretti morena-salazar sebastian-ward miles-turner elarian-casterly zoe-baudelaire roberto-castillo jose-blanco eli-stone camilo-avanzini marcel-gavira aiden-nolan ilias-markou dani-rojas alejandro-hernandez josuke-higashikata mikhail-vilmos santiago-de-bianco philip-novoselic estelle-de-paris gwendoline-gallagher tamires-moreira noah-foster leonard-carnegie max-bauer camilla-ortiz maelys-mallarme mauro-caliente yuri-choi cristina-vargas nicolas-serrano francisco-ramos tello-de-giron`,
  4: `melody-stoker rodrigo-morales federico-herrera charles-berg juniper-viscarra cedric-joy catalina-nunez-duarte gabriel-marquez alicia-rivera remi-de-smet lorenzo-maldonado jaehyun-lim william-de-bianco`
};
const expected = Object.fromEntries(Object.entries(groups).flatMap(([year, ids]) => ids.split(' ').map(id => [id, year+' курс'])));
assert.deepEqual(Object.values(groups).map(ids => ids.split(' ').length), [6,38,35,13]);
assert.equal(Object.keys(expected).length, 92);
function load(ref) {
  const read = file => ref ? execFileSync('git', ['show', ref+':'+file], {cwd:base,encoding:'utf8'}) : fs.readFileSync(path.join(base,file),'utf8');
  const window = {dispatchEvent(){},addEventListener(){}};
  const document = {getElementById(){},head:{appendChild(){}},body:{appendChild(){}},createElement(){return{}},addEventListener(){},querySelectorAll(){return[]},querySelector(){}};
  const ctx = vm.createContext({window,document,CustomEvent:class{},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console});
  for(const file of ['students','coaches','staff','leon','character-directory']) vm.runInContext(read('data/'+file+'.js'),ctx);
  const all = JSON.parse(JSON.stringify([...window.ATLAS_CHARACTERS,...window.ATLAS_CARD_ONLY]));
  return {all, records:JSON.parse(JSON.stringify(window.ATLAS_CHARACTER_DIRECTORY)),ctx,read};
}
function courseFields(c) {
  return [c.course,c.year,c.profile?.overview?.mainInfo?.course,c.profile?.overview?.mainInfo?.year].filter(v=>v!=null);
}
function withoutCourses(c) {
  const copy=JSON.parse(JSON.stringify(c));
  if(expected[c.id]) {
    delete copy.course;delete copy.year;
    if(copy.profile?.overview?.mainInfo) {delete copy.profile.overview.mainInfo.course;delete copy.profile.overview.mainInfo.year;}
  }
  return copy;
}
if(require.main===module) {
  // Approved Russian-copy localization; course expectations remain the original 92 IDs.
  const current=load(), prior=load(process.argv[2] || 'c83dacb9e7a47406a4f6342501a7c5f3ed860c51');
  let correct=0,changed=0;
  for(const [id,course] of Object.entries(expected)) {
    const matches=current.all.filter(c=>c.id===id);assert.equal(matches.length,1,id+': exactly one existing character');
    const c=matches[0];assert.equal(c.category,'estudiantes',id);
    const fields=courseFields(c);assert(fields.length,id+': missing course');
    for(const value of fields) assert.equal(value,course,id+': consistent course fields');
    const old=prior.all.find(c=>c.id===id);assert(old,id+': existed before');
    if(courseFields(old).length && courseFields(old).every(v=>v===course)) correct++;else changed++;
  }
  assert.deepEqual(current.all.map(withoutCourses),prior.all.map(withoutCourses),'Only requested course/year fields may change; profiles and other characters remain intact');
  assert.deepEqual(current.records.map(withoutCourses),prior.records.map(withoutCourses),'Directory changes limited to requested course/year fields');
  vm.runInContext(current.read('assets/atlas-community.js'),current.ctx);
  for(const [id,course] of Object.entries(expected)) {
    const c=current.all.find(c=>c.id===id),markup=current.ctx.window.atlasCardDetailsHtml(c);
    assert(markup.includes('>'+course.toUpperCase()+'</span>'),id+': visible card course');
  }
  console.log(`PASS courses: 92 unique students (6/38/35/13); ${changed} changed, ${correct} already correct; card/full-profile consistency; all other data unchanged.`);
}
module.exports={expected,load,courseFields};
