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
const {dossierMarkup}=require('../assets/atlas-questionnaires.js');
const formatted=dossierMarkup('Раздел I. Личное дело кандидата\n\nПолное имя: Мартина\n\n\n\nБиография\n\nПервый абзац.\n\nВторой абзац.\n\nХарактер\n\n<script>bad()</script>');
assert.equal((formatted.match(/<article /g)||[]).length,3);
assert.match(formatted,/<p>Первый абзац\.<\/p><p>Второй абзац\.<\/p>/);
assert.ok(!formatted.includes('<script>'));
assert.match(formatted,/&lt;script&gt;/);
assert.match(dossierMarkup('Текст без заголовка'),/Биография не найдена/);
console.log('Dossier sections, whitespace and escaping checks passed');

const {parseQuestionnaire}=require('../assets/atlas-questionnaires.js');
const documentText=`раздел i. личное дело кандидата
имя и фамилия персонажа [rus / eng]: каталina / Catalina Duarte
— производные от имени, прозвища, номер в команде: ката
возраст и дата рождения: 07.01.2003, 21 год
род деятельности, факультет / статус в академии: студентка 4 курса факультета индивидуальных видов спорта
кафедра: теннис
специализация: большой теннис
команда, в которой состоит персонаж: —
никнейм в локальном приложении академии / соцсетях: атлас – catalina.nunez, соц.сети – itscata
прототип внешности [eng]: daiane meneghel
раздел ii. путь к пьедесталу
место рождения: реколета, буэнос-айрес, аргентина
биография: Авторский первый абзац.

Второй абзац.
раздел iii. спортивная психология
характер:
Авторский характер.
мотивация и амбиции: Мотивация.
раздел iv. вне протокола
дополнительные факты:
– факт один;
– факт два.`;
const parsed=parseQuestionnaire(documentText);
assert.equal(parsed.originalName,'Catalina Duarte');
assert.equal(parsed.birthDate,'07.01.2003');
assert.equal(parsed.age,'21 год');
assert.equal(parsed.course,'4 курса');
assert.equal(parsed.faculty,'факультет индивидуальных видов спорта');
assert.equal(parsed.department,'теннис');
assert.equal(parsed.placeOfBirth,'реколета, буэнос-айрес, аргентина');
assert.equal(parsed.atlasNickname,'catalina.nunez');
assert.equal(parsed.socialNickname,'itscata');
assert.equal(parsed.biography,'Авторский первый абзац.\n\nВторой абзац.');
assert.equal(parsed.personality,'Авторский характер.');
assert.equal(parsed.motivation,'Мотивация.');
const mapped=mergeProfile(base,{fullName:'Short'},documentText);
assert.equal(mapped.profile.overview.mainInfo.nicknames,'ката');
assert.equal(mapped.profile.dossier.biography.text,parsed.biography);
assert.deepEqual(Object.keys(mapped.profile.dossier).sort(),['biography','extra','motivation','personality']);
assert.ok(!dossierMarkup(documentText).includes('путь к пьедесталу'));
assert.ok(!dossierMarkup(documentText).includes('личное дело кандидата'));
assert.equal(base.profile.dossier.biography.text,'old');
console.log('Standard profile mapping and source text preservation passed');
// Verify approved content passes through the site's existing profile renderer.
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const renderer=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('function renderCharacterProfile(character)'));
const root={innerHTML:'',dataset:{}};
const document={head:{appendChild(){}},body:{appendChild(){}},createElement(){return {}},getElementById:id=>id==='atlasCharacterProfileRoot'?root:null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
const window={ATLAS_CHARACTERS:[],addEventListener(){},dispatchEvent(){}};
const context=vm.createContext({window,document,console,CustomEvent:class{},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){}});
vm.runInContext(renderer.replace(/\}\)\(\);\s*$/, 'window.questionnaireTestRender=renderCharacterProfile;})();'),context);
window.questionnaireTestRender(mapped);
assert.match(root.innerHTML,/оригинальное имя/);
assert.match(root.innerHTML,/Catalina Duarte/);
assert.match(root.innerHTML,/кафедра \/ отделение/);
assert.match(root.innerHTML,/Авторский первый абзац/);
assert.ok(!root.innerHTML.includes('путь к пьедесталу'));
assert.ok(!root.innerHTML.includes('личное дело кандидата'));
console.log('Approved questionnaire uses the existing character profile renderer');
