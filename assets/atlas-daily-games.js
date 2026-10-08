(function(root){
  'use strict';
  // Hand-picked five-letter nouns; Ё is accepted as Е for keyboard consistency.
  const answers=('автор адрес актёр алмаз арбуз атлас багаж банан банка барон башня берег билет бисер благо бочка буква букет ветер ветка вечер весна вишня волна город гость гроза груша дверь диван доска дождь домик драма дрель дуэль живот завод замок запас звено зверь земля зерно зефир игрок искра кабан камин камыш капля катер книга ковёр комар конёк кошка краса крест крыло кукла кузов купол лампа лапша лента лимон линия лодка ложка маска масло месяц мечта мешок миска мороз музей мячик набор навык народ наука нитка номер носок образ огонь океан олива опера орден осень отряд пакет палка парус паста песня петля пламя плита пляжи поезд покой полка порог почта птица пчела радио рамка ранка ребро речка робот роман рояль рубин рулет ручей рыбак рынок салат сапог сахар север скала склад сквер склон слава слово смена смола сокол сосна спорт сцена танец театр текст тесто товар толпа топор точка трава тропа туман уголь удача узник улица улика финиш фокус форма фраза фрукт халат хвост холод хомяк цифра чайка чашка черта чехол число шапка шарик школа шорох шоссе шутка щенок экран эскиз ягода якорь').split(' ').map(w=>w.replace(/ё/g,'е'));
  const dictionary=new Set(answers);
  function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
  const deck=answers.slice();let seed=20261008;
  for(let i=deck.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  function answer(day){const n=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);return deck[((n%deck.length)+deck.length)%deck.length];}
  function grade(guess,secret){
    const marks=Array(5).fill('absent'),remaining={};
    for(let i=0;i<5;i++)if(guess[i]===secret[i])marks[i]='correct';else remaining[secret[i]]=(remaining[secret[i]]||0)+1;
    for(let i=0;i<5;i++)if(marks[i]!=='correct'&&remaining[guess[i]]){marks[i]='present';remaining[guess[i]]--;}
    return marks;
  }
  function lines(board){const hits=new Set();for(let r=0;r<7;r++)for(let c=0;c<7;c++)for(const [dr,dc] of [[0,1],[1,0]]){
    const run=[];let y=r,x=c;while(y<7&&x<7&&board[y*7+x]===board[r*7+c]){run.push(y*7+x);y+=dr;x+=dc;}
    if(run.length>=3)run.forEach(i=>hits.add(i));
  }return [...hits];}
  function adjacent(a,b){return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<49&&b<49&&Math.abs(a%7-b%7)+Math.abs(Math.floor(a/7)-Math.floor(b/7))===1;}
  function legal(board,a,b){if(!adjacent(a,b))return false;const next=board.slice();[next[a],next[b]]=[next[b],next[a]];return lines(next).length>0;}
  function possible(board){for(let i=0;i<49;i++)for(const j of [i+1,i+7])if(legal(board,i,j))return true;return false;}
  function fresh(random=Math.random){
    for(let tries=0;tries<100;tries++){
      const b=[];for(let i=0;i<49;i++){const choices=[0,1,2,3,4].filter(v=>!(i%7>=2&&b[i-1]===v&&b[i-2]===v)&&!(i>=14&&b[i-7]===v&&b[i-14]===v));b.push(choices[Math.floor(random()*choices.length)]);}
      if(possible(b))return b;
    }
    const b=Array.from({length:49},(_,i)=>(i%7+Math.floor(i/7))%5);b[0]=1;b[1]=0;b[2]=1;b[8]=1;return b;
  }
  function swap(board,a,b,random=Math.random){
    if(!legal(board,a,b))return null;
    let next=board.slice();[next[a],next[b]]=[next[b],next[a]];
    const frames=[];let score=0,combo=0,reshuffled=false;
    for(let hits=lines(next);hits.length;hits=lines(next)){
      combo++;score+=hits.length*10*combo;frames.push({board:next.slice(),hits});
      for(let col=0;col<7;col++){
        const kept=[];for(let row=0;row<7;row++)if(!hits.includes(row*7+col))kept.push(next[row*7+col]);
        while(kept.length<7)kept.unshift(Math.floor(random()*5));
        for(let row=0;row<7;row++)next[row*7+col]=kept[row];
      }
      if(combo>=30){next=fresh(random);reshuffled=true;break;}
    }
    if(!possible(next)){next=fresh(random);reshuffled=true;}
    return {board:next,score,combo,frames,reshuffled};
  }
  const engine={answers,dayKey,answer,grade,lines,adjacent,legal,possible,fresh,swap};
  if(typeof module!=='undefined')module.exports=engine;
  if(!root.document)return;
  let host=null,kind='',board=fresh(),selected=-1,score=0,turns=30,animating=false,timer=null,notice='',wordState=null;
  const symbols=['◆','●','★','♥','✿'],labels=['ромб','круг','звезда','сердце','цветок'];
  const active=()=>host?.isConnected&&!!document.querySelector('#atlas-page-games.active');
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function identity(){return 'atlas-word-v1:'+dayKey()+':'+(root.ATLAS_CURRENT_SESSION?.user?.id||'guest');}
  function loadWord(){
    const key=identity();if(wordState?.key===key)return;
    wordState={key,day:dayKey(),guesses:[],draft:''};notice='';
    try{const saved=JSON.parse(root.localStorage.getItem(key));if(Array.isArray(saved?.guesses)){
      for(const guess of saved.guesses.slice(0,6)){if(!dictionary.has(guess))break;wordState.guesses.push(guess);if(guess===answer(wordState.day))break;}
      if(typeof saved.draft==='string'&&/^[а-я]{0,5}$/.test(saved.draft))wordState.draft=saved.draft;
    }}catch{}
  }
  function saveWord(){try{root.localStorage.setItem(wordState.key,JSON.stringify({guesses:wordState.guesses,draft:wordState.draft}));}catch{notice='Браузер не разрешает сохранение. Прогресс останется до закрытия страницы.';}}
  const done=()=>wordState.guesses.includes(answer(wordState.day))||wordState.guesses.length>=6;
  function render(frame){
    if(!active())return;
    if(kind==='match3'){
      const view=frame?.board||board,hits=frame?.hits||[];
      host.innerHTML='<div class="games-toolbar"><button type="button" data-daily-action="new">новая игра</button></div><p class="games-status" role="status">'+(turns?'Осталось ходов: '+turns:'Игра окончена')+' · счёт: '+score+'</p><div class="match3-board" role="group" aria-label="поле три в ряд">'+view.map((v,i)=>'<button type="button" data-gem="'+i+'" class="gem gem-'+v+(hits.includes(i)?' gem-clear':'')+'" aria-label="'+labels[v]+', ряд '+(Math.floor(i/7)+1)+', столбец '+(i%7+1)+'" aria-pressed="'+(selected===i)+'" '+(animating||!turns?'disabled':'')+'><span>'+symbols[v]+'</span></button>').join('')+'</div><p class="games-status" role="status">'+esc(notice)+'</p><p class="games-hint">Нажми на две соседние фишки, чтобы поменять их местами. Собирай от трёх одинаковых по горизонтали или вертикали. Цепочки дают множитель очков; неудачный обмен не тратит ход. Всего 30 ходов.</p>';
      return;
    }
    loadWord();const secret=answer(wordState.day),won=wordState.guesses.includes(secret),finished=done(),keyboard={},priority={absent:1,present:2,correct:3};
    const rows=Array.from({length:6},(_,i)=>{const guess=wordState.guesses[i],text=guess||(i===wordState.guesses.length?wordState.draft:''),marks=guess?grade(guess,secret):[];
      if(guess)[...guess].forEach((letter,j)=>{if((priority[marks[j]]||0)>(priority[keyboard[letter]]||0))keyboard[letter]=marks[j];});
      return '<div class="word-row">'+Array.from({length:5},(_,j)=>'<span class="word-tile '+(marks[j]||'')+'" aria-label="'+esc((text[j]||'пусто')+(marks[j]?' — '+({correct:'на месте',present:'есть в другом месте',absent:'нет в слове'}[marks[j]]):''))+'">'+esc(text[j]||'')+'</span>').join('')+'</div>';
    }).join('');
    host.innerHTML='<p class="games-status">слово дня · '+wordState.day+'</p><div class="word-board" role="group" aria-label="попытки">'+rows+'</div><p class="games-status" role="status">'+esc(notice||(won?'Угадано! Попыток: '+wordState.guesses.length:finished?'Сегодняшнее слово: '+secret:'Угадай русское слово из пяти букв'))+'</p><div class="word-keyboard" role="group" aria-label="клавиатура">'+['йцукенгшщзхъ','фывапролджэ','ячсмитьбю'].map(row=>'<div>'+[...row].map(letter=>'<button type="button" data-letter="'+letter+'" class="'+(keyboard[letter]||'')+'" '+(finished?'disabled':'')+'>'+letter+'</button>').join('')+'</div>').join('')+'<div><button type="button" data-letter="Enter" '+(finished?'disabled':'')+'>проверить</button><button type="button" data-letter="Backspace" aria-label="стереть букву" '+(finished?'disabled':'')+'>⌫</button></div></div>'+(finished?'<div class="games-toolbar"><button type="button" data-daily-action="share">скопировать результат</button></div>':'')+'<p class="games-hint">Зелёная — буква на месте, золотая — есть в другом месте, серая — нет. Е и Ё считаются одной буквой. Слова проверяются по игровому словарю. Шесть попыток; новое слово для всех в полночь по Мадриду. Прогресс сохраняется в этом браузере отдельно для каждого аккаунта.</p>';
  }
  function type(letter){if(!active()||kind!=='word')return;loadWord();if(done())return;notice='';
    if(letter==='Backspace')wordState.draft=wordState.draft.slice(0,-1);
    else if(letter==='Enter'){
      if(wordState.draft.length!==5)notice='Нужно пять букв.';
      else if(!dictionary.has(wordState.draft))notice='Этого слова пока нет в игровом словаре. Попробуй другое.';
      else{wordState.guesses.push(wordState.draft);wordState.draft='';}
    }else if(/^[а-яё]$/i.test(letter)&&wordState.draft.length<5)wordState.draft+=letter.toLowerCase().replace('ё','е');
    saveWord();render();
  }
  function leave(){clearTimeout(timer);timer=null;animating=false;selected=-1;host=null;}
  document.addEventListener('click',async e=>{
    if(!active()||!e.target.closest('#atlasDailyGamesRoot'))return;const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.letter){type(b.dataset.letter);return;}
    if(b.dataset.dailyAction==='new'){clearTimeout(timer);animating=false;board=fresh();score=0;turns=30;selected=-1;notice='';render();return;}
    if(b.dataset.dailyAction==='share'){
      loadWord();if(!done()){render();return;}const current=wordState.key;
      const text='ATLAS · слово дня '+wordState.day+' · '+(wordState.guesses.includes(answer(wordState.day))?wordState.guesses.length:'X')+'/6\n'+wordState.guesses.map(g=>grade(g,answer(wordState.day)).map(v=>({correct:'🟩',present:'🟨',absent:'⬛'}[v])).join('')).join('\n');
      try{await navigator.clipboard.writeText(text);if(wordState.key===current)notice='Результат скопирован — без самого слова.';}catch{if(wordState.key===current)notice='Браузер не разрешил копирование.';}render();return;
    }
    if(kind!=='match3'||b.dataset.gem==null||animating||!turns)return;const i=Number(b.dataset.gem);
    if(selected<0){selected=i;render();return;}if(selected===i){selected=-1;render();return;}
    if(!adjacent(selected,i)){selected=i;render();return;}
    const result=swap(board,selected,i);selected=-1;
    if(!result){notice='Этот обмен не собирает ряд. Попробуй другой.';render();return;}
    board=result.board;score+=result.score;turns--;notice='+'+result.score+(result.combo>1?' · цепочка ×'+result.combo:'')+(result.reshuffled?' · поле перемешано: не было ходов':'');
    const frames=result.frames.slice();animating=true;
    function step(){if(!active()){animating=false;return;}const frame=frames.shift();if(!frame){animating=false;render();return;}render(frame);timer=setTimeout(step,root.matchMedia('(prefers-reduced-motion: reduce)').matches?0:240);}
    step();
  });
  document.addEventListener('keydown',e=>{if(!active()||kind!=='word'||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;if(e.key==='Enter'||e.key==='Backspace'||/^[а-яё]$/i.test(e.key)){e.preventDefault();type(e.key);}});
  root.addEventListener('atlasPlayerAuthReady',()=>{if(kind==='word'&&active()){loadWord();render();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active()&&kind==='word')render();});
  setInterval(()=>{if(active()&&kind==='word'&&wordState?.key!==identity())render();},30000);
  root.AtlasDailyGames={mount(el,type){leave();host=el;kind=type;render();},leave};
})(typeof window==='undefined'?globalThis:window);
