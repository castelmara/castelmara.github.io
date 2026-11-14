(function(){
 'use strict';
 let host=null,game=null,mode='daily',length=5,level='normal',draft='',notice='',busy=false,epoch=0;
 const uid=()=>window.ATLAS_CURRENT_SESSION?.user?.id||'';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const active=()=>host?.isConnected&&document.querySelector('#atlas-page-games.active');
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const playing=()=>game?.status==='playing';
 function remember(){if(game)try{localStorage.setItem('atlas-word-draft:'+uid()+':'+game.id,draft)}catch(_){}}
 function restore(){draft='';if(game&&playing())try{const s=localStorage.getItem('atlas-word-draft:'+uid()+':'+game.id)||'';if(/^[а-я]*$/.test(s))draft=s.slice(0,game.length)}catch(_){}}
 function button(action,label,disabled=false){return '<button type="button" data-word-action="'+action+'" '+(disabled?'disabled':'')+'>'+label+'</button>'}
 function render(){
  if(!active())return;
  if(!uid()){host.innerHTML='<p class="games-status">войди в аккаунт, чтобы играть без повторов и сохранять результаты на всех устройствах.</p><div class="games-toolbar">'+button('login','войти')+'</div>';return}
  const finished=game&&!playing(),locked=busy;
  const settings='<div class="word-settings"><label>букв<select data-word-setting="length" '+(locked?'disabled':'')+'>'+[4,5,6,7,8].map(n=>'<option value="'+n+'" '+(length===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>сложность<select data-word-setting="level" '+(locked?'disabled':'')+'>'+[['easy','лёгкая · 8 попыток'],['normal','обычная · 6 попыток'],['hard','сложная · 5 попыток']].map(([v,t])=>'<option value="'+v+'" '+(level===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label></div>';
  let board='',keyboard='';
  if(game){
   const colors={},priority={absent:1,present:2,correct:3};
   board='<div class="word-board" style="--word-length:'+game.length+'" role="group" aria-label="попытки">'+Array.from({length:game.max_attempts},(_,i)=>{
    const g=game.guesses[i],text=g||(i===game.guesses.length?draft:''),marks=game.marks[i]||[];
    if(g)[...g].forEach((c,j)=>{if((priority[marks[j]]||0)>(priority[colors[c]]||0))colors[c]=marks[j]});
    return '<div class="word-row">'+Array.from({length:game.length},(_,j)=>'<span class="word-tile '+(marks[j]||'')+'" aria-label="'+esc((text[j]||'пусто')+(marks[j]?' — '+{correct:'на месте',present:'есть в другом месте',absent:'нет в слове'}[marks[j]]:''))+'">'+esc(text[j]||'')+'</span>').join('')+'</div>';
   }).join('')+'</div>';
   keyboard='<div class="word-keyboard" role="group" aria-label="клавиатура">'+['йцукенгшщзхъ','фывапролджэ','ячсмитьбю'].map(row=>'<div>'+[...row].map(c=>'<button type="button" data-word-letter="'+c+'" class="'+(colors[c]||'')+'" '+(busy||finished?'disabled':'')+'>'+c+'</button>').join('')+'</div>').join('')+'<div><button type="button" data-word-letter="Enter" '+(busy||finished?'disabled':'')+'>проверить</button><button type="button" data-word-letter="Backspace" aria-label="стереть букву" '+(busy||finished?'disabled':'')+'>⌫</button></div></div>';
  }
  const result=game?.status==='won'?'угадано! '+game.guesses.length+' из '+game.max_attempts+' попыток':finished?'слово: '+game.answer:game?'русское существительное · '+game.length+' букв':'';
  host.innerHTML='<div class="word-modes" aria-label="режим">'+button('daily','слово дня',busy||mode==='daily')+button('practice','играть подряд',busy||mode==='practice')+'</div>'+(mode==='practice'?settings:'<p class="games-hint">'+today()+' · общее слово для всех · 5 букв · 6 попыток</p>')+(game?'<p class="word-score">угадано на аккаунте: <strong>'+Number(game.solved||0)+'</strong></p>':'')+board+'<p class="games-status" role="status">'+esc(notice||(busy?'загружаем…':result))+'</p>'+keyboard+'<div class="games-toolbar">'+(!game&&!busy?button('retry',notice?'попробовать снова':'начать игру'):'')+(finished&&mode==='practice'?button('next','следующее слово',busy):'')+(finished&&mode==='daily'?button('practice','продолжить в свободном режиме',busy):'')+(playing()?button('skip','сдаться и узнать слово',busy):'')+'</div><details class="word-help"><summary>как играть</summary><p>зелёная — буква на месте, золотая — есть в другом месте, серая — нет. е и ё считаются одной буквой. загадки и ответы — существительные; в большом словаре встречаются редкие слова. сложность задаёт число попыток: 8, 6 или 5.</p><p>каждая новая загадка закрепляется за аккаунтом и больше не повторяется, даже после проигрыша или сдачи. незавершённую партию можно продолжить на другом устройстве. ежедневный набор отдельный, новое слово — в полночь по Мадриду. когда набор закончится, повторов не будет: предложим другую длину.</p><p>словарь: <a href="https://github.com/Badestrand/russian-dictionary" target="_blank" rel="noopener">OpenRussian</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. счётчик учитывает победы в новой версии игры.</p></details>';
 }
 async function request(name,args){
  if(busy||!uid())return;
  const token=++epoch,owner=uid(),oldId=game?.id,oldCount=game?.guesses.length;
  busy=true;notice='';render();
  try{
   const result=await window.ATLAS_SUPABASE.rpc(name,args);
   if(token!==epoch||owner!==uid()||!active())return;
   if(result.error)throw result.error;
   game=result.data;
   if(game.mode==='practice'){length=game.length;level=game.level}
   if(game.id!==oldId)restore();else if(game.guesses.length!==oldCount||!playing()){draft='';remember()}
   if(game.status==='won')window.dispatchEvent(new CustomEvent('atlasWordScoreChanged'));
   return true;
  }catch(e){if(token===epoch)notice=e.message||'не удалось связаться с сервером. попробуй ещё раз.'}
  finally{if(token===epoch){busy=false;render()}}
 }
 async function changeSettings(wantedLength,wantedLevel){
  if(playing()){
   if(!confirm('сменить настройки? текущая партия завершится без победы, и её слово больше не выпадет.')){render();return false}
   if(!await request('atlas_word_play',{p_id:game.id,p_guess:'',p_expected:game.guesses.length,p_skip:true}))return false;
   if(playing()){notice='партия обновилась на другом устройстве. повтори смену настроек.';render();return false}
  }
  length=wantedLength;level=wantedLevel;game=null;draft='';notice='';render();return true;
 }
 async function start(next=false){
  const wantedMode=mode,wantedLength=length,wantedLevel=level;
  if(!await request('atlas_word_start',{p_mode:mode,p_length:length,p_level:level,p_next:next}))return;
  // The server resumes the one unfinished practice game, even from another device.
  if(wantedMode==='practice'&&mode==='practice'&&(game.length!==wantedLength||game.level!==wantedLevel)){
   if(await changeSettings(wantedLength,wantedLevel))await request('atlas_word_start',{p_mode:mode,p_length:length,p_level:level,p_next:true});
  }
 }
 function type(key){
  if(!active()||busy||!playing())return;
  notice='';
  if(key==='Enter'){
   if(draft.length!==game.length){notice='нужно '+game.length+' букв.';render();return}
   request('atlas_word_play',{p_id:game.id,p_guess:draft,p_expected:game.guesses.length,p_skip:false});return;
  }
  if(key==='Backspace')draft=draft.slice(0,-1);
  else if(/^[а-яё]$/i.test(key)&&draft.length<game.length)draft+=key.toLowerCase().replace('ё','е');
  remember();render();
 }
 document.addEventListener('click',e=>{
  if(!active()||!e.target.closest('#atlasWordGamesRoot'))return;
  const b=e.target.closest('button');if(!b||b.disabled||busy)return;
  if(b.dataset.wordLetter){type(b.dataset.wordLetter);return}
  const action=b.dataset.wordAction;
  if(action==='login'){document.getElementById('atlasAccountButton')?.click();return}
  if(action==='daily'||action==='practice'){remember();mode=action;game=null;draft='';notice='';if(mode==='daily')start();else render();return}
  if(action==='next'||action==='retry'){start(action==='next');return}
  if(action==='skip'&&game&&confirm('сдаться? слово будет раскрыто и больше не выпадет.'))request('atlas_word_play',{p_id:game.id,p_guess:'',p_expected:game.guesses.length,p_skip:true});
 });
 document.addEventListener('change',async e=>{
  if(!active()||!e.target.closest('#atlasWordGamesRoot')||busy)return;
  if(e.target.dataset.wordSetting==='length')await changeSettings(Number(e.target.value),level);
  else if(e.target.dataset.wordSetting==='level')await changeSettings(length,e.target.value);
 });
 document.addEventListener('keydown',e=>{
  if(!active()||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.target.closest('button,input,textarea,select,dialog,[contenteditable="true"]'))return;
  if(e.key==='Enter'||e.key==='Backspace'||/^[а-яё]$/i.test(e.key)){e.preventDefault();type(e.key)}
 });
 function reset(){epoch++;busy=false;game=null;draft='';notice='';if(active()){render();if(uid())start()}}
 window.addEventListener('atlasPlayerAuthReady',reset);
 function refreshDay(){if(active()&&!document.hidden&&mode==='daily'&&game?.day!==today()&&!busy)reset()}
 document.addEventListener('visibilitychange',refreshDay);setInterval(refreshDay,60000);
 window.AtlasWordGame={mount(el){host=el;reset()},leave(){remember();epoch++;busy=false;host=null}};
})();
