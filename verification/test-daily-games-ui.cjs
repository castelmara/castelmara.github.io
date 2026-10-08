const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../assets/atlas-daily-games.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/atlas-daily-games.js'),'utf8');
const storage=new Map();
function env(){
 const events={},windowEvents={},host={isConnected:true,innerHTML:''},timers=new Map();let seq=0;
 const doc={querySelector:()=>({}),addEventListener:(n,f)=>events[n]=f};
 const win={document:doc,ATLAS_CURRENT_SESSION:{user:{id:'A'}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:true}),addEventListener:(n,f)=>windowEvents[n]=f};
 vm.runInNewContext(source,{window:win,document:doc,Intl,Date,Math,Set,setInterval(){},setTimeout(fn){timers.set(++seq,fn);return seq;},clearTimeout(id){timers.delete(id);},navigator:{clipboard:{writeText:async text=>win.copied=text}}});
 const click=dataset=>events.click({target:{closest:s=>s==='#atlasDailyGamesRoot'?host:{dataset}}});
 const type=async word=>{for(const letter of word)await click({letter});await click({letter:'Enter'});};
 return {win,host,events,windowEvents,click,type,timers,mount:kind=>win.AtlasDailyGames.mount(host,kind)};
}
(async()=>{
 const e=env();e.mount('word');
 await e.type('ааааа');assert.match(e.host.innerHTML,/нет в игровом словаре/);
 assert.equal(JSON.parse([...storage.values()][0]).guesses.length,0,'Invalid words do not spend an attempt');
 for(let i=0;i<5;i++)await e.click({letter:'Backspace'});
 const secret=E.answer(E.dayKey());await e.type(secret);assert.match(e.host.innerHTML,/Угадано/);
 await e.click({dailyAction:'share'});assert(e.win.copied.includes('1/6'));assert(!e.win.copied.includes(secret));
 const reload=env();reload.mount('word');assert.match(reload.host.innerHTML,/Угадано/,'Reload restores result');
 reload.win.ATLAS_CURRENT_SESSION.user.id='B';reload.windowEvents.atlasPlayerAuthReady();
 assert(!reload.host.innerHTML.includes('Угадано'),'Other account does not receive A result');
 const wrong=E.answers.find(w=>w!==secret);for(let i=0;i<6;i++)await reload.type(wrong);
 assert.match(reload.host.innerHTML,/Сегодняшнее слово/);
 await reload.type(secret);assert(!reload.host.innerHTML.includes('Угадано'),'Seventh guess is blocked');
 reload.mount('match3');assert.equal((reload.host.innerHTML.match(/data-gem=/g)||[]).length,49);
 const board=[...reload.host.innerHTML.matchAll(/class="gem gem-(\d)/g)].map(m=>Number(m[1]));let pair;
 for(let i=0;i<49&&!pair;i++)for(const j of [i+1,i+7])if(E.legal(board,i,j)){pair=[i,j];break;}
 await reload.click({gem:String(pair[0])});await reload.click({gem:String(pair[1])});
 assert.match(reload.host.innerHTML,/Осталось ходов: 29/);
 reload.win.AtlasDailyGames.leave();assert.equal(reload.timers.size,0,'Leaving cancels cascade timers');
 reload.mount('match3');assert.match(reload.host.innerHTML,/Осталось ходов: 29/,'Tab switch keeps completed move');
 await reload.click({dailyAction:'new'});assert.match(reload.host.innerHTML,/Осталось ходов: 30 · счёт: 0/);
 console.log('PASS daily UI: dictionary rejection, persistence, account isolation, win/share, six guesses, match score, leave/resume, reset');
})().catch(e=>{console.error(e);process.exitCode=1});
