(function() {
  'use strict';
  const bank=window.AtlasPersonalityQuestions, content=window.AtlasPersonalityResults, engine=window.AtlasPersonalityEngine;
  const view=document.getElementById('test-view'), app=document.getElementById('test-app');
  const key='atlas:personality_test_v1:draft', themeKey='atlas:personality_test_v1:theme';
  let answers=Array(24).fill(null), index=0, screen='landing', result=null;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paragraphs=items=>items.map(text=>'<p>'+esc(text)+'</p>').join('');
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
    view.innerHTML='<section class="landing"><div class="landing-copy"><p class="eyebrow"><span class="live-dot"></span> CASTELMARA / ATLAS</p><h1>PERSONALITY<br><span>TEST.</span></h1><p class="intro">Тест — внутренняя игровая механика ATLAS для определения одного из шести Castelmara archetypes. Это не психологическая диагностика.</p><div class="start-row"><button class="primary-button" data-action="start">начать тест <span aria-hidden="true">↗</span></button><span class="time-pill">~20 минут</span></div><div class="landing-meta"><span>24 вопроса</span><span>один ответ на каждый</span></div></div>'+motif()+'</section>';
  }
  function question() {
    const q=bank.questions[index], selected=answers[index], complete=engine.validateAnswers(answers);
    app.removeAttribute('data-type');
    view.innerHTML='<section class="question-view"><div class="question-top"><p class="eyebrow">PERSONALITY TEST</p><span class="counter">'+String(index+1).padStart(2,'0')+' <span>/ 24</span></span></div><div class="progress" role="progressbar" aria-label="Ответы" aria-valuemin="0" aria-valuemax="24" aria-valuenow="'+answers.filter(Boolean).length+'"><span style="width:'+answers.filter(Boolean).length/24*100+'%"></span></div><form id="question-form"><fieldset><legend><span class="question-number" aria-hidden="true">'+String(index+1).padStart(2,'0')+'</span>'+esc(q.text)+'</legend><div class="answer-grid">'+q.answers.map(answer=>'<label class="answer-card"><input type="radio" name="answer" value="'+answer.id+'"'+(selected===answer.id?' checked':'')+'><span class="answer-letter">'+answer.id+'</span><span class="answer-text">'+esc(answer.text)+'</span><span class="answer-check" aria-hidden="true">↗</span></label>').join('')+'</div></fieldset><div class="question-nav"><button class="back-button" type="button" data-action="back">← назад</button><span class="choice-hint">выбери один ответ</span><button class="primary-button" type="submit" '+(index===23?!complete?'disabled':'':!selected?'disabled':'')+'>'+(index===23?'завершить тест':'далее')+' <span aria-hidden="true">→</span></button></div></form></section>';
  }
  function resultView() {
    const primary=content.archetypes[result.primary_type],secondary=result.secondary_type&&content.secondary[result.primary_type+':'+result.secondary_type];
    app.dataset.type=result.primary_type;
    view.innerHTML='<section class="result-view"><div class="result-header"><p class="eyebrow">ATLAS / PERSONALITY TEST</p><span class="result-stamp">твой результат</span></div><article class="result-card"><div class="result-title"><span class="result-symbol" aria-hidden="true">✳</span><h1>'+esc(primary.title)+'</h1><p class="motto">'+esc(primary.motto)+'</p></div><div class="result-copy">'+paragraphs(primary.description)+(secondary?'<section class="secondary-block"><h2>SECONDARY — '+esc(result.secondary_type.toUpperCase())+'</h2><p class="motto">'+esc(secondary.phrase)+'</p><p>'+esc(secondary.description)+'</p></section>':'')+'<section class="result-detail"><h2>STRENGTH</h2><p>'+esc(primary.strength)+'</p></section><section class="result-detail"><h2>BLIND SPOT</h2><p>'+esc(primary.blindSpot)+'</p></section><section class="result-status"><h2>PROFILE STATUS</h2><p>'+esc(primary.profileStatus)+'</p></section></div></article><div class="result-bottom"><p>Внутренняя игровая механика ATLAS.<br>Не психологическая диагностика.</p><a class="primary-button" href="../#inicio" data-return>вернуться в ATLAS <span aria-hidden="true">↗</span></a></div></section>';
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
    result=engine.scoreAnswers(answers);screen='result';storage('removeItem',key);render(true);
  });
  render();
})();
