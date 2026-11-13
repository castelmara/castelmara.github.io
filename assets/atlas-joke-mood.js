(function(root){
  'use strict';
  const phrases=[
    'ты кринж, но наш','ты ред флаг, но мы колорблайнд','ты кабачок','ты булочка','ты икона',
    'ты вайб, который не объяснить','ты кофе на голодный желудок','ты мем без контекста',
    'ты котик с неоплаченными счетами','ты причина выключить уведомления','ты чья-то гиперфиксация',
    'ты сюжетная дыра, но красивая','ты делулу на максималках','ты зелёный флаг в красной упаковке',
    'ты последний пельмень','ты круассан с характером','ты драматичная картошка','ты жабка в спа',
    'ты скрин, который нельзя пересылать','ты непрочитанные 99+','ты «я на пять минут» в три ночи',
    'ты случайный лайк на фото за 2017 год','ты голосовое на семь минут','ты опечатка судьбы',
    'ты главный экспонат дурки','ты тревожный сырок','ты опасно милый баг','ты легенда без пруфов',
    'ты сплетня с доставкой на дом','ты понедельник в образе пятницы','ты бесплатный дофамин',
    'ты романтика с побочками','ты милый человек с подозрительным плейлистом','ты лягушка-путешественница по чужим профилям',
    'ты кот, который нажал отправить','ты повод открыть групповой чат','ты «всё нормально» с тремя точками',
    'ты маленький хаос в большом худи','ты картошка фри в чужом заказе','ты внезапный лор',
    'ты человек, а ощущаешься как отпуск','ты спящий режим с амбициями','ты булочка с перцем',
    'ты уведомление от любимого человека','ты босс последней нервной клетки','ты сериал, который продлили зря, но мы смотрим',
    'ты капибара на дедлайне','ты краш с техническими неполадками'
  ];
  function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
  function phraseFor(user,day){
    // A stable personal deck: same account/date on every device, no daily rerolls.
    let seed=hash('castelmara-joke-v1:'+user)||1;
    const deck=phrases.slice();
    for(let i=deck.length-1;i>0;i--){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const j=(seed>>>0)%(i+1);[deck[i],deck[j]]=[deck[j],deck[i]]}
    const index=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
    return deck[((index%deck.length)+deck.length)%deck.length];
  }
  if(typeof module==='object'&&module.exports){module.exports={phraseFor,phrases};return}
  function render(){
    const result=document.getElementById('atlasJokeMoodResult');if(!result)return;
    const user=root.ATLAS_CURRENT_SESSION?.user?.id;
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    result.textContent=user?phraseFor(user,day):'войди в аккаунт, чтобы узнать';
  }
  document.addEventListener('click',e=>{
    const toggle=e.target.closest('#atlasJokeMoodToggle');if(!toggle)return;
    const panel=document.getElementById('atlasJokeMoodPanel');if(!panel)return;
    panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));toggle.lastElementChild.textContent=panel.hidden?'＋':'−';render();
  });
  root.addEventListener('atlasPlayerAuthReady',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
  document.addEventListener('DOMContentLoaded',render);setInterval(render,60000);render();
})(typeof window==='undefined'?globalThis:window);
