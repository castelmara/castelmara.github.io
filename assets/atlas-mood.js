(function(){
  'use strict';
  const moods={
    'будущая запись в протоколе':'futura línea en el expediente',
    'виновник чужой бессонницы':'culpable del insomnio ajeno',
    'главная причина нового правила в FAQ':'motivo de una nueva norma en las preguntas frecuentes',
    'главная сплетница кампуса':'la mayor cotilla del campus',
    'главный герой чужого эдита':'protagonista del edit de alguien',
    'главный поставщик мемов':'proveedor oficial de memes',
    'гроза дедлайнов':'terror de los plazos',
    'единственная рабочая клетка команды':'única neurona funcional del equipo',
    'загадка без правильного ответа':'misterio sin respuesta correcta',
    'звезда группового чата':'estrella del chat grupal',
    'королева драматичных выходов':'reina de las salidas dramáticas',
    'красный флаг с хорошей причёской':'bandera roja con buen peinado',
    'легенда ещё до выпуска':'leyenda antes de graduarte',
    'локальная знаменитость':'celebridad local',
    'любимчик деканата. деканат об этом не знает':'favorito del decanato; el decanato aún no lo sabe',
    'любимчик судьбы':'favorito del destino',
    'любимый кошмар тренера':'pesadilla favorita del entrenador',
    'любимый человек деканата':'persona favorita del decanato',
    'маленькая академическая легенда':'pequeña leyenda académica',
    'мастер исчезать перед уборкой':'experto en desaparecer antes de limpiar',
    'моральная поддержка с кофе':'apoyo moral con café',
    'на одну плохую идею от сюжетной катастрофы':'a una mala idea de la catástrofe argumental',
    'неожиданно хороший совет':'consejo inesperadamente bueno',
    'неотменённая тренировка':'entrenamiento que nadie canceló',
    'неофициальный психолог команды':'psicólogo no oficial del equipo',
    'непредсказуемый сюжетный поворот':'giro argumental imprevisible',
    'опасно близки к созданию ещё одного персонажа':'peligrosamente cerca de crear otro personaje',
    'опасно обаятельная проблема':'problema peligrosamente encantador',
    'официально не готовы писать эпизод':'oficialmente sin ganas de escribir un episodio',
    'официальный талисман хаоса':'mascota oficial del caos',
    'очень занятый ничем человек':'persona muy ocupada en nada',
    'очень подозрительный голубь':'paloma muy sospechosa',
    'очень убедительная плохая идея':'mala idea sorprendentemente convincente',
    'персонаж с секретной сценой после титров':'personaje con escena secreta poscréditos',
    'победа без дополнительного времени':'victoria sin prórroga',
    'победитель внутреннего монолога':'ganador del monólogo interior',
    'потенциальная угроза испанскому законодательству':'posible amenaza para la legislación española',
    'потерянный носок из прачечной':'calcetín perdido de la lavandería',
    'причина внепланового собрания':'motivo de una reunión imprevista',
    'причина опоздания всей группы':'razón por la que todo el grupo llega tarde',
    'причина проверить уведомления':'motivo para revisar las notificaciones',
    'профессиональный похититель худи':'profesional del robo de sudaderas',
    'романтическая угроза':'amenaza romántica',
    'самый красивый человек в радиусе километра':'la persona más guapa en un kilómetro a la redonda',
    'самый подозрительный невиновный':'inocente más sospechoso',
    'сегодня удивительно приличный человек':'hoy eres sorprendentemente formal',
    'сегодняшняя гордость atlas':'orgullo de ATLAS por hoy',
    'секретное оружие команды':'arma secreta del equipo',
    'сладкая булочка':'bollito dulce',
    'случайный гений':'genio por accidente',
    'случайный свидетель драмы':'testigo casual del drama',
    'сонный капитан':'capitán con sueño',
    'талисман победы':'amuleto de la victoria',
    'тот самый взгляд через весь зал':'esa mirada desde el otro lado de la sala',
    'тот самый странный тип из библиотеки':'el tipo raro de la biblioteca',
    'тот самый человек из слухов':'la persona de la que hablan los rumores',
    'тот, кому сегодня всё можно':'la persona a quien hoy todo se le permite',
    'тот, кто всё понял, но промолчал':'quien lo entendió todo y guardó silencio',
    'ходячая катастрофа':'desastre andante',
    'ходячее оправдание':'excusa andante',
    'человек с вайбом пятницы':'persona con vibra de viernes',
    'человек с запасным планом':'persona con un plan alternativo',
    'человек с идеальным алиби':'persona con la coartada perfecta',
    'человек-пятница':'persona viernes',
    'человек, которого обсуждают в раздевалке':'persona de la que hablan en el vestuario',
    'человек, которому нельзя доверять кофемашину':'persona a quien no confiar la cafetera',
    'человек, которому нужен плед':'persona que necesita una manta',
    'чемпион по откладыванию дел':'campeón de la procrastinación',
    'чья-то лучшая идея':'la mejor idea de alguien',
    'эмоциональная поддержка всей раздевалки':'apoyo emocional de todo el vestuario',
    'эмоциональная поддержка кампуса':'apoyo emocional del campus'
  };
  const uid=()=>window.ATLAS_CURRENT_SESSION?.user?.id||'';
  let cached=null,pending=null,generation=0;
  function dateKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  function put(text){const root=document.getElementById('atlasMoodResult');if(!root)return;root.replaceChildren();const prefix=document.createElement('span');prefix.textContent='кто ты сегодня';const value=document.createElement('strong');value.textContent=text;root.append(prefix,value)}
  async function render(){
    const date=document.getElementById('atlasMoodDate'),result=document.getElementById('atlasMoodResult'),explain=document.getElementById('atlasMoodExplain');if(!date||!result)return;
    date.textContent=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'numeric',month:'long'}).format(new Date());
    const user=uid(),key=user+'|'+dateKey(),token=generation;
    if(!user){put('войдите в аккаунт, чтобы узнать');if(explain)explain.textContent='ATLAS выбирает одно настроение на день. новое появится после полуночи по времени Испании.';return}
    if(cached?.key===key){put(cached.phrase);if(explain)explain.textContent=cached.explanation;return}if(pending?.key===key)return;
    const request={key};pending=request;put('ищем твоё настроение…');
    try{if(!window.ATLAS_SUPABASE)throw new Error('Sin conexión');let timer,response;try{response=await Promise.race([window.ATLAS_SUPABASE.rpc('atlas_today_mood'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('El servidor no responde')),20000)})])}finally{clearTimeout(timer)}const {data,error}=response;if(error)throw error;if(!data?.length)throw new Error('Respuesta vacía');if(token!==generation||uid()!==user||key!==uid()+'|'+dateKey())return;const original=String(data[0].phrase||'').trim();let description='ATLAS выдал тебе этот титул на сегодня. относись к нему с юмором — завтра будет новый.';if(original.toLocaleLowerCase('ru-RU')==='сладкая булочка')description='пожалуйста, убери нож. сегодня тебя надо беречь, кормить и периодически осыпать комплиментами.';cached={key,phrase:original||'сюрприз кастельмары',explanation:description+' настроение меняется после полуночи по времени Испании.'};put(cached.phrase);if(explain)explain.textContent=cached.explanation}
    catch(_err){if(token===generation&&uid()===user){put('не удалось загрузить — нажми, чтобы попробовать ещё раз');if(explain)explain.textContent='проверь подключение. выбранное на сегодня настроение сохранится при повторной загрузке.'}}
    finally{if(pending===request)pending=null}
  }
  document.addEventListener('click',e=>{const toggle=e.target.closest('#atlasMoodExplainToggle');if(toggle){const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.textContent=open?'что это значит?':'понятно';const explanation=document.getElementById('atlasMoodExplain');if(explanation)explanation.hidden=open;return}if(e.target.closest('#atlasMoodResult')){if(!uid())document.getElementById('atlasAccountButton')?.click();else render()}if(e.target.closest('.atlas-nav-item,[data-open-page]'))setTimeout(render,80)});
  window.addEventListener('atlasPlayerAuthReady',()=>{generation++;pending=null;cached=null;render()});document.addEventListener('DOMContentLoaded',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});setInterval(render,60000);window.atlasRenderMoodCheck=render;
})();
