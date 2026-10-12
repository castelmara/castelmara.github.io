const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let active=false,observer,disconnected=false;const fetched=[];
const root={textContent:''};
const ctx={Set,Promise,setTimeout,window:{addEventListener(){}},MutationObserver:class{constructor(fn){observer=fn}observe(){}disconnect(){disconnected=true}},document:{querySelector:()=>active?{}:null,getElementById:()=>root,createElement:()=>({remove(){}}),head:{appendChild(el){fetched.push(el.src||el.href);queueMicrotask(()=>el.onload())}}}};
vm.runInNewContext(fs.readFileSync('assets/atlas-games-loader.js','utf8'),ctx);
(async()=>{assert.equal(fetched.length,0,'No game downloads on home');active=true;await observer();assert.equal(fetched.length,8);assert(fetched.at(-1).startsWith('assets/atlas-games.js'));assert(disconnected);await observer();assert.equal(fetched.length,8,'Loaded only once');console.log('PASS games lazy loading, dependency order, no duplicate downloads');})();
