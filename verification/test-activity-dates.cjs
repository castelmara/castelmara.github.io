const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
for(const source of scripts) new vm.Script(source);
const source=scripts.find(s=>s.includes('function renderRollCallDate()'));
const start=source.indexOf('  function renderRollCallDate()');
const end=source.indexOf('\n  document.addEventListener',start);
assert(start>=0&&end>start);
const render=source.slice(start,end)+'\nrenderRollCallDate();';
const cases=[
  [2026,9,3,'AUG','28.08','03.09'],
  [2026,9,4,'SEPT','28.09','03.10'],
  [2026,9,27,'SEPT','28.09','03.10'],
  [2026,9,28,'SEPT','28.09','03.10'],
  [2026,12,28,'DEC','28.12','03.01'],
  [2026,12,31,'DEC','28.12','03.01'],
  [2027,1,1,'DEC','28.12','03.01'],
  [2027,1,3,'DEC','28.12','03.01'],
  [2027,1,4,'JAN','28.01','03.02'],
  [2028,2,29,'FEB','28.02','03.03']
];
for(const [year,month,day,label,from,to] of cases){
  const nodes=Object.fromEntries(['atlasRollCallMonth','atlasRollCallDay','atlasRollCallDescription'].map(id=>[id,{textContent:''}]));
  class BrowserDate extends Date {constructor(...args){super(...(args.length?args:[year,month-1,day,0,15]));}}
  const context=vm.createContext({Date:BrowserDate,document:{getElementById:id=>nodes[id]}});
  vm.runInContext(render,context);
  assert.equal(nodes.atlasRollCallMonth.textContent,label);
  assert.equal(nodes.atlasRollCallDay.textContent,'28');
  assert.equal(nodes.atlasRollCallDescription.textContent,`проверка активности с ${from} по ${to}`);
}
console.log(`PASS ${cases.length} activity periods: 03/04/27/28, December–January and leap February; browser-local dates.`);
