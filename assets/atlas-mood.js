(function(){
  'use strict';
  let cached = null, pending = null, generation = 0;
  const uid = () => window.ATLAS_CURRENT_SESSION?.user?.id || '';
  function dateKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function put(text){const root=document.getElementById('atlasMoodResult');if(!root)return;root.replaceChildren();const prefix=document.createElement('span');prefix.textContent='сегодня вы —';const value=document.createElement('strong');value.textContent=text;root.append(prefix,value);}
  async function render(){
    const date=document.getElementById('atlasMoodDate'),result=document.getElementById('atlasMoodResult'),explain=document.getElementById('atlasMoodExplain');
    if(!date||!result)return;
    date.textContent=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Madrid',day:'numeric',month:'long'}).format(new Date());
    const user=uid(),key=user+'|'+dateKey(),token=generation;
    if(!user){put('войдите в ATLAS, чтобы узнать');if(explain)explain.textContent='ATLAS выбирает настроение один раз в день. Новое появится после полуночи по времени Испании.';return;}
    if(cached?.key===key){put(cached.phrase);if(explain)explain.textContent=cached.explanation;return;}
    if(pending?.key===key)return;
    const request={key};pending=request;put('выбираем настроение…');
    try{
      if(!window.ATLAS_SUPABASE)throw new Error('Нет подключения');
      let timer;
      let response;
      try { response=await Promise.race([window.ATLAS_SUPABASE.rpc('atlas_today_mood'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Сервер не ответил')),20000);})]); }
      finally { clearTimeout(timer); }
      const {data,error}=response;
      if(error)throw error;if(!data?.length)throw new Error('Пустой ответ');
      if(token!==generation||uid()!==user||key!==uid()+'|'+dateKey())return;
      cached={key,phrase:data[0].phrase,explanation:data[0].explanation+' Настроение действует до полуночи по времени Испании.'};put(cached.phrase);
      if(explain)explain.textContent=cached.explanation;
    }catch(_err){if(token===generation&&uid()===user){put('не удалось загрузить — нажмите, чтобы повторить');if(explain)explain.textContent='Проверьте подключение. Повторная загрузка сохранит уже выбранное настроение.';}}
    finally{if(pending===request)pending=null;}
  }
  document.addEventListener('click',e=>{
    const toggle=e.target.closest('#atlasMoodExplainToggle');
    if(toggle){const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.textContent=open?'что это вообще значит?':'ладно, понятно';document.getElementById('atlasMoodExplain').hidden=open;return;}
    if(e.target.closest('#atlasMoodResult')){if(!uid())document.getElementById('atlasAccountButton')?.click();else render();}
    if(e.target.closest('.atlas-nav-item,[data-open-page]'))setTimeout(render,80);
  });
  window.addEventListener('atlasPlayerAuthReady',()=>{generation++;pending=null;cached=null;render();});
  document.addEventListener('DOMContentLoaded',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  setInterval(render,60000);
  window.atlasRenderMoodCheck=render;
})();
