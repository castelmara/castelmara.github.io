(function(){
  'use strict';
  let userId='', generation=0, pending=null, timer=null, active=null;
  const shown=new Set();
  function today(){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const date=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return date.year+'-'+date.month+'-'+date.day;
  }
  function seen(key){try{return shown.has(key)||localStorage.getItem(key)==='1'}catch(_){return shown.has(key)}}
  function close(){if(active){active.close();active.remove();active=null}}
  function present(){
    clearTimeout(timer);
    if(!pending||document.hidden)return;
    if(document.querySelector('dialog[open],.atlas-auth-modal.is-open,.atlas-modal.is-open')){timer=setTimeout(present,1500);return}
    const item=pending;
    if(item.date!==today()||seen(item.key)){pending=null;return}
    const dialog=document.createElement('dialog');
    dialog.className='atlas-birthday';
    dialog.setAttribute('aria-labelledby','atlasBirthdayTitle');
    dialog.innerHTML='<div class="atlas-birthday-effects" aria-hidden="true"></div><div class="atlas-birthday-card"><button type="button" class="atlas-birthday-close" aria-label="закрыть поздравление">×</button><span class="atlas-birthday-kicker">atlas · твой день</span><div class="atlas-birthday-spark" aria-hidden="true">✦</div><h2 id="atlasBirthdayTitle">с днём рождения!</h2><p class="atlas-birthday-name"></p><p class="atlas-birthday-wish">пусть впереди будет много счастливых моментов, любимых людей рядом и историй, которые хочется проживать.</p><button type="button" class="atlas-birthday-done">спасибо ♡</button></div>';
    dialog.querySelector('.atlas-birthday-name').textContent=item.name.toLocaleLowerCase('ru');
    const effects=dialog.querySelector('.atlas-birthday-effects');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      for(let i=0;i<30;i++){
        const particle=document.createElement('i');
        particle.className=i<6?'atlas-birthday-balloon':'atlas-birthday-confetti';
        particle.style.setProperty('--x',(i<6?8+i*17:Math.random()*100)+'%');
        particle.style.setProperty('--delay',(Math.random()*1.5)+'s');
        particle.style.setProperty('--color',['#c13f55','#efb8c2','#e8c786','#dad9f0'][i%4]);
        particle.addEventListener('animationend',()=>particle.remove(),{once:true});
        effects.appendChild(particle);
      }
    }
    dialog.querySelectorAll('button').forEach(button=>button.addEventListener('click',close));
    dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
    document.body.appendChild(dialog);
    dialog.showModal();active=dialog;pending=null;
    shown.add(item.key);try{localStorage.setItem(item.key,'1')}catch(_){}
  }
  async function sync(){
    const session=window.ATLAS_CURRENT_SESSION, profile=window.ATLAS_CURRENT_PROFILE;
    const id=session?.user?.id||'';
    if(id===userId)return;
    userId=id;const token=++generation;
    pending=null;clearTimeout(timer);close();
    if(!id||!window.ATLAS_SUPABASE)return;
    const date=today(),key='atlas-birthday-shown:'+id+':'+date;
    if(seen(key))return;
    try{
      // Read only the signed-in player's birthday, including when hidden publicly.
      const result=await window.ATLAS_SUPABASE.from('profile_private').select('birthday').eq('id',id).maybeSingle();
      if(token!==generation||result.error||String(result.data?.birthday||'').slice(5)!==date.slice(5))return;
      pending={date,key,name:profile?.display_name||profile?.nickname||'это твой день'};
      present();
    }catch(_){/* A greeting must never interrupt sign-in. */}
  }
  window.addEventListener('atlasPlayerAuthReady',sync);
  document.addEventListener('visibilitychange',present);
  sync();
})();
