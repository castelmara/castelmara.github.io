(function(){
  'use strict';

  var PETS = {
    sprout:  {name:'росточек', file:'assets/companions/sprout.png', happy:'assets/companions/sprout-happy.png', note:'любимчик'},
    frog:    {name:'лягушка', file:'assets/companions/frog.png', happy:'assets/companions/frog-happy.png', note:'любит подпрыгивать'},
    duck:    {name:'утёнок', file:'assets/companions/duck.png', happy:'assets/companions/duck-happy.png', note:'важно покачивается'},
    catbox:  {name:'кот в коробке', file:'assets/companions/catbox.png', happy:'assets/companions/catbox-happy.png', note:'сидит в своей коробке'},
    book:    {name:'книга', file:'assets/companions/book.png', happy:'assets/companions/book-happy.png', note:'немного волшебная'},
    codercat:{name:'кот-кодер', file:'assets/companions/codercat.png', happy:'assets/companions/codercat-happy.png', note:'тапает по клавиатуре'},
    axolotl: {name:'аксолотль', file:'assets/companions/axolotl.png', happy:'assets/companions/axolotl-happy.png', note:'очень доволен жизнью'},
    spider:  {name:'паучок', file:'assets/companions/spider.png', happy:'assets/companions/spider-happy.png', note:'ползает рядом'},
    raven:   {name:'ворон', file:'assets/companions/raven.png', happy:'assets/companions/raven-happy.png', note:'наблюдает'},
    dragon:  {name:'дракон', file:'assets/companions/dragon.png', happy:'assets/companions/dragon-happy.png', note:'маленький, но дракон'},
    kitsune: {name:'кицунэ', file:'assets/companions/kitsune.png', happy:'assets/companions/kitsune-happy.png', note:'показывает хвосты, когда гладят'},
    ghost:   {name:'призрак', file:'assets/companions/ghost.png', happy:'assets/companions/ghost-happy.png', note:'просто тусуется'}
  };

  var state = {
    pet:'sprout',
    visible:true,
    names:{},
    anchor:null,
    pos:null,
    dragging:false,
    moved:false,
    downX:0,
    downY:0,
    startX:0,
    startY:0,
    roamTimer:null,
    interactionAt:0
  };

  var root = null;
  var img = null;
  var nameTag = null;
  var petRestoreTimer = null;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function uid(){
    return window.ATLAS_CURRENT_SESSION && window.ATLAS_CURRENT_SESSION.user
      ? window.ATLAS_CURRENT_SESSION.user.id
      : '';
  }

  function key(part){
    return 'atlasCompanion:' + (uid() || 'guest') + ':' + part;
  }

  function get(part,fallback){
    try{
      var v = localStorage.getItem(key(part));
      return v == null ? fallback : v;
    }catch(_e){ return fallback; }
  }

  function set(part,value){
    try{ localStorage.setItem(key(part),String(value)); }catch(_e){}
  }

  function loadNames(){
    try{
      var parsed = JSON.parse(get('names','{}') || '{}');
      state.names = parsed && typeof parsed === 'object' ? parsed : {};
    }catch(_e){
      state.names = {};
    }
  }

  function saveNames(){
    set('names',JSON.stringify(state.names || {}));
  }

  function petDisplayName(id){
    var custom = String((state.names && state.names[id]) || '').trim();
    return custom || (PETS[id] ? PETS[id].name : id);
  }

  function viewportSize(){
    return {
      w:Math.max(document.documentElement.clientWidth || 0,window.innerWidth || 0),
      h:Math.max(document.documentElement.clientHeight || 0,window.innerHeight || 0)
    };
  }

  function petSize(){
    return window.matchMedia && window.matchMedia('(max-width:700px)').matches ? 102 : 124;
  }

  function clamp(x,y){
    var vp=viewportSize(), s=petSize(), pad=8;
    return {
      x:Math.max(pad,Math.min(vp.w-s-pad,x)),
      y:Math.max(70,Math.min(vp.h-s-pad,y))
    };
  }

  function defaultPos(){
    var vp=viewportSize(), s=petSize();
    return clamp(vp.w-s-26,vp.h-s-24);
  }

  function parsePos(raw){
    try{
      var p=JSON.parse(raw || '');
      if(typeof p.x==='number' && typeof p.y==='number') return clamp(p.x,p.y);
    }catch(_e){}
    return defaultPos();
  }

  function ensureRoot(){
    if(root) return root;

    root=document.createElement('div');
    root.id='atlasCompanion';
    root.hidden=true;
    root.innerHTML=
      '<button class="atlas-companion-pet" type="button">' +
        '<span class="atlas-companion-name-tag" hidden></span>' +
        '<span class="atlas-companion-visual">' +
          '<img class="atlas-companion-img" alt="пиксельный помощник">' +
        '</span>' +
      '</button>';

    document.body.appendChild(root);

    img=root.querySelector('.atlas-companion-img');
    nameTag=root.querySelector('.atlas-companion-name-tag');

    var btn=root.querySelector('.atlas-companion-pet');
    btn.addEventListener('pointerdown',onPointerDown);
    btn.addEventListener('pointermove',onPointerMove);
    btn.addEventListener('pointerup',onPointerUp);
    btn.addEventListener('pointercancel',onPointerCancel);
    btn.addEventListener('keydown',function(e){
      if(e.key==='Enter' || e.key===' '){
        e.preventDefault();
        pet();
      }
    });

    return root;
  }

  function setVisual(x,y,duration,easing){
    ensureRoot();
    var p=clamp(x,y);
    state.pos=p;
    root.style.transition=duration
      ? ('left '+duration+'ms '+(easing || 'ease')+', top '+duration+'ms '+(easing || 'ease'))
      : 'none';
    root.style.left=p.x+'px';
    root.style.top=p.y+'px';
    return p;
  }

  function saveAnchor(){
    if(state.anchor) set('position',JSON.stringify(state.anchor));
  }

  function applyPet(){
    ensureRoot();
    if(!PETS[state.pet]) state.pet='sprout';

    var p=PETS[state.pet];
    img.src=p.file;
    img.alt=petDisplayName(state.pet);
    root.dataset.pet=state.pet;

    var btn=root.querySelector('.atlas-companion-pet');
    btn.setAttribute('aria-label','погладить: '+petDisplayName(state.pet));

    var custom=String((state.names && state.names[state.pet]) || '').trim();
    nameTag.textContent=custom;
    nameTag.hidden=!custom;
  }

  function render(){
    ensureRoot();

    if(!uid()){
      root.hidden=true;
      clearRoam();
      waitForMiAtlas(0);
      return;
    }

    root.hidden=!state.visible;
    applyPet();

    if(!state.anchor) state.anchor=parsePos(get('position',''));
    state.anchor=clamp(state.anchor.x,state.anchor.y);
    setVisual(state.anchor.x,state.anchor.y,0);

    if(state.visible) scheduleRoam();
    else clearRoam();

    waitForMiAtlas(0);
  }

  function load(){
    var savedPet=get('pet','sprout');
    state.pet=PETS[savedPet] ? savedPet : 'sprout';
    state.visible=get('visible','1')!=='0';
    loadNames();
    state.anchor=parsePos(get('position',''));
    state.pos={x:state.anchor.x,y:state.anchor.y};
    render();
  }

  function clearRoam(){
    if(state.roamTimer){
      clearTimeout(state.roamTimer);
      state.roamTimer=null;
    }
  }

  function scheduleRoam(){
    clearRoam();
    if(!state.visible || reduced || state.dragging || !uid()) return;

    var spider=state.pet==='spider';
    var wait=spider
      ? 1500+Math.floor(Math.random()*2200)
      : 4200+Math.floor(Math.random()*4800);

    state.roamTimer=setTimeout(roam,wait);
  }

  function roam(){
    if(!state.visible || reduced || state.dragging || document.hidden || !state.anchor){
      scheduleRoam();
      return;
    }

    if(Date.now()-state.interactionAt<1800){
      scheduleRoam();
      return;
    }

    var spider=state.pet==='spider';
    var radiusX=spider ? 190 : 105;
    var radiusY=spider ? 125 : 28;

    var target=clamp(
      state.anchor.x+(Math.random()*2-1)*radiusX,
      state.anchor.y+(Math.random()*2-1)*radiusY
    );

    root.dataset.dir=target.x<state.pos.x ? 'left' : 'right';
    root.classList.add('is-walking');

    var duration=spider
      ? 900+Math.floor(Math.random()*550)
      : 760;

    setVisual(target.x,target.y,duration,spider?'linear':'ease');

    setTimeout(function(){
      root.classList.remove('is-walking');
      scheduleRoam();
    },duration+70);
  }

  function onPointerDown(e){
    if(e.pointerType==='mouse' && e.button!==0) return;

    clearRoam();
    state.interactionAt=Date.now();
    state.dragging=true;
    state.moved=false;
    state.downX=e.clientX;
    state.downY=e.clientY;
    state.startX=state.pos ? state.pos.x : state.anchor.x;
    state.startY=state.pos ? state.pos.y : state.anchor.y;

    root.classList.add('is-dragging');
    root.style.transition='none';

    try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_e){}
  }

  function onPointerMove(e){
    if(!state.dragging) return;

    var dx=e.clientX-state.downX;
    var dy=e.clientY-state.downY;

    if(Math.hypot(dx,dy)>5) state.moved=true;

    root.dataset.dir=dx<0 ? 'left' : 'right';
    setVisual(state.startX+dx,state.startY+dy,0);
  }

  function finishPointer(e,cancelled){
    if(!state.dragging) return;

    state.dragging=false;
    root.classList.remove('is-dragging');

    try{e.currentTarget.releasePointerCapture(e.pointerId)}catch(_e){}

    if(!cancelled && state.moved){
      state.anchor=clamp(state.pos.x,state.pos.y);
      state.pos={x:state.anchor.x,y:state.anchor.y};
      saveAnchor();
    }else if(!cancelled && !state.moved){
      pet();
    }

    scheduleRoam();
  }

  function onPointerUp(e){finishPointer(e,false)}
  function onPointerCancel(e){finishPointer(e,true)}

  function burst(){
    var chars=state.pet==='book' ? ['✦','✦','✧'] : ['♥','✦','♥'];

    [-18,0,18].forEach(function(dx,i){
      var el=document.createElement('span');
      el.className=chars[i]==='♥' ? 'atlas-companion-heart' : 'atlas-companion-spark';
      el.textContent=chars[i];
      el.style.setProperty('--dx',dx+'px');
      el.style.animationDelay=(i*55)+'ms';
      root.appendChild(el);
      setTimeout(function(){
        if(el.parentNode) el.parentNode.removeChild(el);
      },1000);
    });
  }

  function pet(){
    if(!state.visible || !root) return;

    state.interactionAt=Date.now();

    var activePet=state.pet;
    var p=PETS[activePet];

    if(p && p.happy){
      img.src=p.happy;
    }

    if(petRestoreTimer){
      clearTimeout(petRestoreTimer);
      petRestoreTimer=null;
    }

    root.classList.remove('is-petted');
    void root.offsetWidth;
    root.classList.add('is-petted');

    burst();

    petRestoreTimer=setTimeout(function(){
      if(root && state.pet===activePet && PETS[activePet]){
        img.src=PETS[activePet].file;
      }
      if(root) root.classList.remove('is-petted');
      petRestoreTimer=null;
    },900);
  }
  function choosePet(id){
    if(!PETS[id]) return;

    state.pet=id;
    set('pet',id);
    applyPet();

    if(state.anchor){
      state.anchor=clamp(state.anchor.x,state.anchor.y);
      state.pos={x:state.anchor.x,y:state.anchor.y};
      saveAnchor();
      setVisual(state.anchor.x,state.anchor.y,0);
    }

    pet();
    refreshMiAtlasPanel();
    scheduleRoam();
  }

  function setVisible(value){
    state.visible=!!value;
    set('visible',state.visible?'1':'0');
    render();
  }

  function resetPosition(){
    state.anchor=defaultPos();
    state.pos={x:state.anchor.x,y:state.anchor.y};
    saveAnchor();
    setVisual(state.anchor.x,state.anchor.y,280);
    scheduleRoam();
  }

  function renameCurrent(value){
    var clean=String(value || '').trim().replace(/\s+/g,' ').slice(0,24);

    if(clean) state.names[state.pet]=clean;
    else delete state.names[state.pet];

    saveNames();
    applyPet();
    refreshMiAtlasPanel();
  }

  function choiceHtml(id,p){
    var custom=String((state.names && state.names[id]) || '').trim();
    var subtitle=custom ? ('имя: '+custom) : p.note;

    return '<button class="atlas-companion-choice'+(state.pet===id?' is-selected':'')+'" type="button" data-atlas-companion-pet="'+id+'">' +
      '<img src="'+p.file+'" alt="">' +
      '<strong>'+p.name+'</strong>' +
      '<small>'+escapeHtml(subtitle)+'</small>' +
    '</button>';
  }

  function escapeHtml(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function settingsHtml(){
    var choices=Object.keys(PETS).map(function(id){
      return choiceHtml(id,PETS[id]);
    }).join('');

    var currentName=String((state.names && state.names[state.pet]) || '').trim();

    return '<div class="atlas-companion-settings">' +
      '<div class="atlas-companion-settings-head">' +
        '<div>' +
          '<h3>пиксельный помощник</h3>' +
          '<p>он просто живёт на сайте. можно таскать его мышкой или пальцем, гладить сколько угодно, выбрать другого и дать каждому своё имя.</p>' +
        '</div>' +
        '<div class="atlas-companion-actions">' +
          '<button class="atlas-companion-action" type="button" data-atlas-companion-toggle>'+(state.visible?'спрятать':'показать')+'</button>' +
          '<button class="atlas-companion-action" type="button" data-atlas-companion-reset>вернуть в угол</button>' +
          '<button class="atlas-companion-action" type="button" data-atlas-companion-pet-now>погладить</button>' +
        '</div>' +
      '</div>' +
      '<div class="atlas-companion-name-editor">' +
        '<input id="atlasCompanionNameInput" maxlength="24" value="'+escapeHtml(currentName)+'" placeholder="назвать '+escapeHtml(PETS[state.pet].name)+'…">' +
        '<button class="atlas-companion-action" type="button" data-atlas-companion-name-save>сохранить имя</button>' +
        '<button class="atlas-companion-action" type="button" data-atlas-companion-name-clear>сбросить</button>' +
      '</div>' +
      '<div class="atlas-companion-grid">'+choices+'</div>' +
    '</div>';
  }

  function refreshMiAtlasPanel(){
    var personal=document.getElementById('atlasPersonalRoot');
    if(!personal) return;

    var panel=personal.querySelector('[data-personal-panel="companion"]');
    if(panel) panel.innerHTML=uid()
      ? settingsHtml()
      : '<div class="atlas-personal-empty">войдите в ATLAS, чтобы выбрать помощника.</div>';
  }

  function ensureMiAtlas(){
    var personal=document.getElementById('atlasPersonalRoot');
    if(!personal) return false;

    var tabs=personal.querySelector('.atlas-personal-tabs');
    if(!tabs) return false;

    var tab=tabs.querySelector('[data-personal-tab="companion"]');

    if(!tab){
      tab=document.createElement('button');
      tab.className='atlas-personal-tab';
      tab.type='button';
      tab.setAttribute('data-personal-tab','companion');
      tab.textContent='питомец';
      tabs.appendChild(tab);
    }

    var panel=personal.querySelector('[data-personal-panel="companion"]');

    if(!panel){
      panel=document.createElement('section');
      panel.className='atlas-personal-panel';
      panel.setAttribute('data-personal-panel','companion');
      personal.appendChild(panel);
    }

    var active=tabs.querySelector('.atlas-personal-tab.is-active');

    if(!active){
      tab.classList.add('is-active');
      panel.classList.add('is-active');
    }else{
      var companionActive=active.getAttribute('data-personal-tab')==='companion';
      tab.classList.toggle('is-active',companionActive);
      panel.classList.toggle('is-active',companionActive);
    }

    refreshMiAtlasPanel();
    return true;
  }

  function waitForMiAtlas(attempt){
    attempt=attempt || 0;

    if(ensureMiAtlas()) return;
    if(attempt>=30) return;

    setTimeout(function(){
      waitForMiAtlas(attempt+1);
    },100);
  }

  document.addEventListener('click',function(e){
    var choice=e.target.closest && e.target.closest('[data-atlas-companion-pet]');
    if(choice){
      e.preventDefault();
      choosePet(choice.getAttribute('data-atlas-companion-pet'));
      return;
    }

    var toggle=e.target.closest && e.target.closest('[data-atlas-companion-toggle]');
    if(toggle){
      e.preventDefault();
      setVisible(!state.visible);
      refreshMiAtlasPanel();
      return;
    }

    var reset=e.target.closest && e.target.closest('[data-atlas-companion-reset]');
    if(reset){
      e.preventDefault();
      resetPosition();
      refreshMiAtlasPanel();
      return;
    }

    var petNow=e.target.closest && e.target.closest('[data-atlas-companion-pet-now]');
    if(petNow){
      e.preventDefault();
      if(!state.visible) setVisible(true);
      pet();
      return;
    }

    var saveName=e.target.closest && e.target.closest('[data-atlas-companion-name-save]');
    if(saveName){
      e.preventDefault();
      var input=document.getElementById('atlasCompanionNameInput');
      renameCurrent(input ? input.value : '');
      return;
    }

    var clearName=e.target.closest && e.target.closest('[data-atlas-companion-name-clear]');
    if(clearName){
      e.preventDefault();
      renameCurrent('');
      return;
    }

    var nav=e.target.closest && e.target.closest('[data-page="mi-atlas"]');
    if(nav){
      setTimeout(function(){waitForMiAtlas(0)},80);
      return;
    }

    var personalTab=e.target.closest && e.target.closest('[data-personal-tab]');
    if(personalTab){
      setTimeout(function(){waitForMiAtlas(0)},80);
    }
  },true);

  document.addEventListener('keydown',function(e){
    if(e.key==='Enter' && e.target && e.target.id==='atlasCompanionNameInput'){
      e.preventDefault();
      renameCurrent(e.target.value);
    }
  },true);

  window.addEventListener('resize',function(){
    if(!state.anchor) return;

    state.anchor=clamp(state.anchor.x,state.anchor.y);
    state.pos=clamp(state.pos.x,state.pos.y);
    saveAnchor();
    setVisual(state.pos.x,state.pos.y,0);
  });

  document.addEventListener('visibilitychange',function(){
    if(document.hidden) clearRoam();
    else scheduleRoam();
  });

  window.addEventListener('atlasPlayerAuthReady',function(){
    load();
    setTimeout(function(){waitForMiAtlas(0)},120);
  });

  document.addEventListener('DOMContentLoaded',function(){
    ensureRoot();
    load();

    if((location.hash || '').replace(/^#/,'')==='mi-atlas'){
      setTimeout(function(){waitForMiAtlas(0)},160);
    }
  });

  if(document.readyState!=='loading'){
    ensureRoot();
    load();

    if((location.hash || '').replace(/^#/,'')==='mi-atlas'){
      setTimeout(function(){waitForMiAtlas(0)},160);
    }
  }

  window.ATLAS_COMPANION={
    pets:PETS,
    pet:pet,
    choose:choosePet,
    rename:renameCurrent,
    show:function(){setVisible(true)},
    hide:function(){setVisible(false)},
    reset:resetPosition
  };
})();