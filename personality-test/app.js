(function() {
  'use strict';
  const bank=window.AtlasPersonalityQuestions, content=window.AtlasPersonalityResults, engine=window.AtlasPersonalityEngine;
  const view=document.getElementById('test-view'), app=document.getElementById('test-app');
  const key='atlas:personality_test_v1:draft', themeKey='atlas:personality_test_v1:theme', resultKey='atlas:personality_test_v1:result';
  let answers=Array(24).fill(null), index=0, screen='landing', result=null;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paragraphs=items=>items.map(text=>'<p>'+esc(text)+'</p>').join('');
  const primaryUiCopy={
    captain:{motto:'кто-то должен был взять ответственность на себя.',status:'я разберусь.'},
    wildcard:{motto:'тогда это казалось хорошей идеей.',status:'планы можно менять.'},
    anchor:{motto:'каждому нужно место, куда можно вернуться.',status:'я всё ещё здесь.'},
    prodigy:{motto:'хорошо — не значит достаточно хорошо.',status:'ещё одна попытка.'},
    ghost:{motto:'ты меня знаешь. просто не всего.',status:'доступ ограничен.'},
    spark:{motto:'достаточно одного импульса.',status:'давай, будет весело.'}
  };
  const secondaryUiPhrases={
    'captain:wildcard':'ты меняешь план. а потом каким-то образом заставляешь новый работать.',
    'captain:anchor':'ты заботишься и о проблеме, и о людях внутри неё.',
    'captain:prodigy':'тебе мало просто закончить. тебе важно сделать правильно.',
    'captain:ghost':'ты справишься. объяснения могут подождать.',
    'captain:spark':'ты запускаешь движение раньше, чем кто-то успевает всё переосмыслить.',
    'wildcard:captain':'ты ломаешь план, а не результат.',
    'wildcard:anchor':'тебе нужна свобода. просто своих ты не бросаешь.',
    'wildcard:prodigy':'ты знаешь правила достаточно хорошо, чтобы правильно их нарушать.',
    'wildcard:ghost':'ты не обязан всем всё объяснять.',
    'wildcard:spark':'одна плохая идея до очень хорошей истории.',
    'anchor:captain':'если все остальные развалятся, ты, скорее всего, нет.',
    'anchor:wildcard':'ты остаёшься потому, что хочешь, а не потому, что должен.',
    'anchor:prodigy':'ты замечаешь детали. особенно когда они важны тому, кого ты любишь.',
    'anchor:ghost':'можно быть близко и не отдавать всего себя.',
    'anchor:spark':'обычно именно благодаря тебе все продолжают общаться.',
    'prodigy:captain':'компетентность — твой способ быть надёжным.',
    'prodigy:wildcard':'сначала освой правила. потом посмотри, что будет, если их согнуть.',
    'prodigy:anchor':'ты запоминаешь, что важно людям. а потом учишься хорошо им с этим помогать.',
    'prodigy:ghost':'ты показываешь результат, а не процесс.',
    'prodigy:spark':'сначала ты загораешься. потом узнаёшь об этом всё.',
    'ghost:captain':'молчаливость не значит пассивность.',
    'ghost:wildcard':'закрытый, непредсказуемый — и тебя вполне устраивает и то, и другое.',
    'ghost:anchor':'ты впускаешь очень немногих. зато надолго.',
    'ghost:prodigy':'тебе проще, когда тебя понимают по тому, что ты делаешь.',
    'ghost:spark':'ты исчезаешь на время и возвращаешься с новой одержимостью.',
    'spark:captain':'идея лучше, когда она действительно случается.',
    'spark:wildcard':'ты уже был в пути, пока остальные ещё не закончили спрашивать.',
    'spark:anchor':'ты собираешь людей вместе — и каким-то образом они остаются рядом.',
    'spark:prodigy':'любопытство имеет привычку превращаться в мастерство.',
    'spark:ghost':'все знают твою энергию. куда меньше людей знают тебя.'
  };
  function storage(method,...args) {try{return sessionStorage[method](...args)}catch(_error){return null}}
  const savedTheme=storage('getItem',themeKey);
  if(savedTheme==='light') document.documentElement.dataset.theme='light';
  try {
    const draft=JSON.parse(storage('getItem',key));
    if(draft?.version===bank.version && engine.validateAnswers(draft.answers,false) && Number.isInteger(draft.index) && draft.index>=0 && draft.index<24) {
      answers=draft.answers.slice();index=draft.index;screen='questions';
      // Do not allow a corrupt/stale draft to skip an unanswered question.
      const firstMissing=answers.indexOf(null);if(firstMissing>=0) index=Math.min(index,firstMissing);
    }
  } catch(_error) {storage('removeItem',key)}
  function save() {storage('setItem',key,JSON.stringify({version:bank.version,answers,index}))}
  function motif() {return '<div class="identity-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><span class="art-coordinate">CM / 06</span><span class="art-star">✳</span><span class="art-label">a different side<br>of the same you.</span><span class="art-index">01—24</span></div>'}
  function landing() {
    app.removeAttribute('data-type');
    view.innerHTML='<section class="landing"><div class="landing-copy"><p class="eyebrow"><span class="live-dot"></span> CASTELMARA / ATLAS</p><h1>PERSONALITY<br><span>TEST.</span></h1><p class="intro">Тест — внутренняя игровая механика ATLAS для определения одного из шести архетипов Кастельмары. Это не психологическая диагностика.</p><div class="start-row"><button class="primary-button" data-action="start">начать тест <span aria-hidden="true">↗</span></button><span class="time-pill">~20 минут</span></div><div class="landing-meta"><span>24 вопроса</span><span>один ответ на каждый</span></div></div>'+motif()+'</section>';
  }
  function question() {
    const q=bank.questions[index], selected=answers[index], complete=engine.validateAnswers(answers);
    app.removeAttribute('data-type');
    view.innerHTML='<section class="question-view"><div class="question-top"><p class="eyebrow">PERSONALITY TEST</p><span class="counter">'+String(index+1).padStart(2,'0')+' <span>/ 24</span></span></div><div class="progress" role="progressbar" aria-label="Ответы" aria-valuemin="0" aria-valuemax="24" aria-valuenow="'+answers.filter(Boolean).length+'"><span style="width:'+answers.filter(Boolean).length/24*100+'%"></span></div><form id="question-form"><fieldset><legend><span class="question-number" aria-hidden="true">'+String(index+1).padStart(2,'0')+'</span>'+esc(q.text)+'</legend><div class="answer-grid">'+q.answers.map(answer=>'<label class="answer-card"><input type="radio" name="answer" value="'+answer.id+'"'+(selected===answer.id?' checked':'')+'><span class="answer-letter">'+answer.id+'</span><span class="answer-text">'+esc(answer.text)+'</span><span class="answer-check" aria-hidden="true">↗</span></label>').join('')+'</div></fieldset><div class="question-nav"><button class="back-button" type="button" data-action="back">← назад</button><span class="choice-hint">выбери один ответ</span><button class="primary-button" type="submit" '+(index===23?!complete?'disabled':'':!selected?'disabled':'')+'>'+(index===23?'завершить тест':'далее')+' <span aria-hidden="true">→</span></button></div></form></section>';
  }
  function resultView() {
    const primary=content.archetypes[result.primary_type],secondaryKey=result.secondary_type&&result.primary_type+':'+result.secondary_type,secondary=secondaryKey&&content.secondary[secondaryKey],ui=primaryUiCopy[result.primary_type];
    app.dataset.type=result.primary_type;
    view.innerHTML='<section class="result-view"><div class="result-header"><p class="eyebrow">ATLAS / PERSONALITY TEST</p><span class="result-stamp">твой результат</span></div><article class="result-card"><div class="result-title"><span class="result-symbol" aria-hidden="true">✳</span><h1>'+esc(primary.title)+'</h1><p class="motto">'+esc(ui.motto)+'</p></div><div class="result-copy">'+paragraphs(primary.description)+(secondary?'<section class="secondary-block"><h2>ВТОРИЧНЫЙ ТИП — '+esc(result.secondary_type.toUpperCase())+'</h2><p class="motto">'+esc(secondaryUiPhrases[secondaryKey])+'</p><p>'+esc(secondary.description)+'</p></section>':'')+'<section class="result-detail"><h2>СИЛЬНАЯ СТОРОНА</h2><p>'+esc(primary.strength)+'</p></section><section class="result-detail"><h2>СЛЕПАЯ ЗОНА</h2><p>'+esc(primary.blindSpot)+'</p></section><section class="result-status"><h2>СТАТУС ПРОФИЛЯ</h2><p>'+esc(ui.status)+'</p></section></div></article><div class="result-bottom"><p>Внутренняя игровая механика ATLAS.<br>Не психологическая диагностика.</p><a class="primary-button" href="../#inicio" data-return>вернуться в ATLAS <span aria-hidden="true">↗</span></a></div></section>';
  }
  function render(focus=false) {
    if(screen==='landing') landing();else if(screen==='questions') question();else resultView();
    if(focus){view.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'})}
  }
  document.addEventListener('click',event=>{
    const back=event.target.closest('[data-return]');
    if(back && window.parent!==window){event.preventDefault();window.parent.postMessage({type:'atlas-personality-return'},window.location.origin);return}
    if(event.target.closest('.theme-toggle')) {
      const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;storage('setItem',themeKey,theme);return;
    }
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='start'){screen='questions';save();render(true)}
    if(action==='back' && screen==='questions'){if(index>0)index--;else screen='landing';save();render(true)}
  });
  view.addEventListener('change',event=>{
    if(screen!=='questions'||event.target.name!=='answer')return;
    if(!bank.questions[index].answers.some(a=>a.id===event.target.value))return;
    answers[index]=event.target.value;save();
    view.querySelector('[type="submit"]').disabled=index===23?!engine.validateAnswers(answers):false;
    const progress=view.querySelector('[role="progressbar"]');progress.setAttribute('aria-valuenow',answers.filter(Boolean).length);progress.firstElementChild.style.width=answers.filter(Boolean).length/24*100+'%';
  });
  view.addEventListener('submit',event=>{
    event.preventDefault();if(screen!=='questions'||!answers[index])return;
    if(index<23){index++;save();render(true);return}
    if(!engine.validateAnswers(answers))return;
    result=engine.scoreAnswers(answers);try{const playerId=sessionStorage.getItem('atlasPersonalityPlayerId')||'';localStorage.setItem(resultKey+(playerId?':'+playerId:''),JSON.stringify({version:bank.version,primary_type:result.primary_type,secondary_type:result.secondary_type||null,completed_at:new Date().toISOString()}))}catch(_error){}if(window.parent!==window)window.parent.postMessage({type:'atlas-personality-complete',result:{primary_type:result.primary_type,secondary_type:result.secondary_type||null}},window.location.origin);screen='result';storage('removeItem',key);render(true);
  });
  render();
})();



