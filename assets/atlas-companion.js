(function(){
  'use strict';

  var PETS = {
    sprout:   {name:'росточек', file:'assets/companions/sprout.png', note:'любимчик'},
    cat:      {name:'кот', file:'assets/companions/cat.png', note:'тихий'},
    fox:      {name:'лисёнок', file:'assets/companions/fox.png', note:'шустрый'},
    dragon:   {name:'дракон', file:'assets/companions/dragon.png', note:'маленький'},
    ghost:    {name:'призрак', file:'assets/companions/ghost.png', note:'не страшный'},
    axolotl:  {name:'аксолотль', file:'assets/companions/axolotl.png', note:'розовый'},
    raven:    {name:'ворон', file:'assets/companions/raven.png', note:'наблюдает'}
  };

  var state = {
    pet:'sprout',
    visible:true,
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
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function uid(){
    return window.ATLAS_CURRENT_SESSION && window.ATLAS_CURRENT_SESSION.user
      ? window.ATLAS_CURRENT_SESSION.user.id
      : '';
  }

  function key(part){
    return 'atlasCompanion:' + (uid() || 'guest') + ':' + part;
  }

  function get(part, fallback){
    try {
      var v = localStorage.getItem(key(part));
      return v == null ? fallback : v;
    } catch(_e) { return fallback; }
  }

  function set(part, value){
    try { localStorage.setItem(key(part), String(value)); } catch(_e) {}
  }

  function viewportSize(){
    return {
      w: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
      h: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
    };
  }

  function petSize(){
    return window.matchMedia && window.matchMedia('(max-width:700px)').matches ? 102 : 124;
  }

  function clamp(x,y){
    var vp = viewportSize(), s = petSize(), pad = 8;
    return {
      x: Math.max(pad, Math.min(vp.w - s - pad, x)),
      y: Math.max(70, Math.min(vp.h - s - pad, y))
    };
  }

  function defaultPos(){
    var vp = viewportSize(), s = petSize();
    return clamp(vp.w - s - 26, vp.h - s - 24);
  }

  function parsePos(raw){
    try {
      var p = JSON.parse(raw || '');
      if (typeof p.x === 'number' && typeof p.y === 'number') return clamp(p.x,p.y);
    } catch(_e) {}
    return defaultPos();
  }

  function ensureRoot(){
    if (root) return root;
    root = document.createElement('div');
    root.id = 'atlasCompanion';
    root.hidden = true;
    root.innerHTML =
      '<button class="atlas-companion-pet" type="button" aria-label="погладить помощника">' +
        '<img class="atlas-companion-img" alt="пиксельный помощник">' +
      '</button>';
    document.body.appendChild(root);
    img = root.querySelector('.atlas-companion-img');

    var petButton = root.querySelector('.atlas-companion-pet');
    petButton.addEventListener('pointerdown', onPointerDown);
    petButton.addEventListener('pointermove', onPointerMove);
    petButton.addEventListener('pointerup', onPointerUp);
    petButton.addEventListener('pointercancel', onPointerCancel);
    petButton.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pet();
      }
    });

    return root;
  }

  function setVisual(x,y,duration){
    ensureRoot();
    var p = clamp(x,y);
    state.pos = p;
    root.style.transition = duration ? ('left '+duration+'ms ease, top '+duration+'ms ease') : 'none';
    root.style.left = p.x + 'px';
    root.style.top = p.y + 'px';
    return p;
  }

  function saveAnchor(){
    if (!state.anchor) return;
    set('position', JSON.stringify(state.anchor));
  }

  function applyPet(){
    ensureRoot();
    if (!PETS[state.pet]) state.pet = 'sprout';
    img.src = PETS[state.pet].file;
    img.alt = PETS[state.pet].name;
    root.dataset.pet = state.pet;
    root.querySelector('.atlas-companion-pet').setAttribute('aria-label','погладить: '+PETS[state.pet].name);
  }

  function render(){
    ensureRoot();

    if (!uid()) {
      root.hidden = true;
      clearRoam();
      injectSettings();
      return;
    }

    root.hidden = !state.visible;
    applyPet();

    if (!state.anchor) state.anchor = parsePos(get('position',''));
    state.anchor = clamp(state.anchor.x,state.anchor.y);
    setVisual(state.anchor.x,state.anchor.y,0);

    if (state.visible) scheduleRoam();
    else clearRoam();

    injectSettings();
  }

  function load(){
    var savedPet = get('pet','sprout');
    state.pet = PETS[savedPet] ? savedPet : 'sprout';
    state.visible = get('visible','1') !== '0';
    state.anchor = parsePos(get('position',''));
    state.pos = {x:state.anchor.x,y:state.anchor.y};
    render();
  }

  function clearRoam(){
    if (state.roamTimer) {
      clearTimeout(state.roamTimer);
      state.roamTimer = null;
    }
  }

  function scheduleRoam(){
    clearRoam();
    if (!state.visible || reduced || state.dragging || !uid()) return;
    var wait = 4200 + Math.floor(Math.random()*4800);
    state.roamTimer = setTimeout(roam, wait);
  }

  function roam(){
    if (!state.visible || reduced || state.dragging || document.hidden || !state.anchor) {
      scheduleRoam();
      return;
    }
    if (Date.now() - state.interactionAt < 2200) {
      scheduleRoam();
      return;
    }

    var radiusX = window.innerWidth < 700 ? 62 : 105;
    var radiusY = window.innerWidth < 700 ? 18 : 28;
    var target = clamp(
      state.anchor.x + (Math.random() * 2 - 1) * radiusX,
      state.anchor.y + (Math.random() * 2 - 1) * radiusY
    );

    if (target.x < state.pos.x) img.style.transform = 'scaleX(-1)';
    else img.style.transform = '';

    root.classList.add('is-walking');
    setVisual(target.x,target.y,760);

    setTimeout(function(){
      root.classList.remove('is-walking');
      img.style.transform = '';
      scheduleRoam();
    },820);
  }

  function onPointerDown(e){
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearRoam();
    state.interactionAt = Date.now();
    state.dragging = true;
    state.moved = false;
    state.downX = e.clientX;
    state.downY = e.clientY;
    state.startX = state.pos ? state.pos.x : state.anchor.x;
    state.startY = state.pos ? state.pos.y : state.anchor.y;
    root.classList.add('is-dragging');
    root.style.transition = 'none';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch(_e) {}
  }

  function onPointerMove(e){
    if (!state.dragging) return;
    var dx = e.clientX - state.downX;
    var dy = e.clientY - state.downY;
    if (Math.hypot(dx,dy) > 5) state.moved = true;
    setVisual(state.startX + dx, state.startY + dy, 0);
  }

  function finishPointer(e, cancelled){
    if (!state.dragging) return;
    state.dragging = false;
    root.classList.remove('is-dragging');
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(_e) {}

    if (!cancelled && state.moved) {
      state.anchor = clamp(state.pos.x,state.pos.y);
      state.pos = {x:state.anchor.x,y:state.anchor.y};
      saveAnchor();
    } else if (!cancelled && !state.moved) {
      pet();
    }
    scheduleRoam();
  }

  function onPointerUp(e){ finishPointer(e,false); }
  function onPointerCancel(e){ finishPointer(e,true); }

  function pet(){
    if (!state.visible || !root) return;
    state.interactionAt = Date.now();
    root.classList.remove('is-petted');
    void root.offsetWidth;
    root.classList.add('is-petted');

    [-18,0,18].forEach(function(dx,i){
      var heart = document.createElement('span');
      heart.className = 'atlas-companion-heart';
      heart.textContent = i === 1 ? '♥' : '✦';
      heart.style.setProperty('--dx', dx+'px');
      heart.style.animationDelay = (i*55)+'ms';
      root.appendChild(heart);
      setTimeout(function(){ if (heart.parentNode) heart.parentNode.removeChild(heart); },1000);
    });

    setTimeout(function(){ if(root) root.classList.remove('is-petted'); },700);
  }

  function choosePet(id){
    if (!PETS[id]) return;
    state.pet = id;
    set('pet',id);
    applyPet();
    pet();
    injectSettings(true);
  }

  function setVisible(value){
    state.visible = !!value;
    set('visible',state.visible ? '1' : '0');
    render();
  }

  function resetPosition(){
    state.anchor = defaultPos();
    state.pos = {x:state.anchor.x,y:state.anchor.y};
    saveAnchor();
    setVisual(state.anchor.x,state.anchor.y,280);
    scheduleRoam();
  }

  function choiceHtml(id,p){
    return '<button class="atlas-companion-choice'+(state.pet===id?' is-selected':'')+'" type="button" data-atlas-companion-pet="'+id+'">' +
      '<img src="'+p.file+'" alt="">' +
      '<strong>'+p.name+'</strong>' +
      '<small>'+p.note+'</small>' +
    '</button>';
  }

  function settingsHtml(){
    var choices = Object.keys(PETS).map(function(id){ return choiceHtml(id,PETS[id]); }).join('');
    return '<div class="atlas-companion-settings">' +
      '<div class="atlas-companion-settings-head">' +
        '<div><h3>пиксельный помощник</h3><p>он просто живёт на сайте: немного гуляет рядом, перетаскивается мышкой или пальцем и радуется, когда его гладят. никаких стриков, наград и обязательств.</p></div>' +
        '<div class="atlas-companion-actions">' +
          '<button class="atlas-companion-action" type="button" data-atlas-companion-toggle>'+(state.visible?'спрятать':'показать')+'</button>' +
          '<button class="atlas-companion-action" type="button" data-atlas-companion-reset>вернуть в угол</button>' +
          '<button class="atlas-companion-action" type="button" data-atlas-companion-pet-now>погладить</button>' +
        '</div>' +
      '</div>' +
      '<div class="atlas-companion-grid">'+choices+'</div>' +
    '</div>';
  }

  function injectSettings(){
    var personal = document.getElementById('atlasPersonalRoot');
    if (!personal) return;
    var tabs = personal.querySelector('.atlas-personal-tabs');
    if (!tabs) return;

    var tab = tabs.querySelector('[data-personal-tab="companion"]');
    if (!tab) {
      tab = document.createElement('button');
      tab.className = 'atlas-personal-tab';
      tab.type = 'button';
      tab.setAttribute('data-personal-tab','companion');
      tab.textContent = 'питомец';
      tabs.appendChild(tab);
    }

    var existing = personal.querySelector('[data-personal-panel="companion"]');
    if (existing) existing.remove();

    var noneActive = !tabs.querySelector('.atlas-personal-tab.is-active');
    if (noneActive) tab.classList.add('is-active');

    var panel = document.createElement('section');
    panel.className = 'atlas-personal-panel' + (tab.classList.contains('is-active') ? ' is-active' : '');
    panel.setAttribute('data-personal-panel','companion');
    panel.innerHTML = uid()
      ? settingsHtml()
      : '<div class="atlas-personal-empty">войдите в ATLAS, чтобы выбрать помощника.</div>';

    personal.appendChild(panel);
  }

  document.addEventListener('click',function(e){
    var choice = e.target.closest && e.target.closest('[data-atlas-companion-pet]');
    if (choice) {
      e.preventDefault();
      choosePet(choice.getAttribute('data-atlas-companion-pet'));
      return;
    }

    var toggle = e.target.closest && e.target.closest('[data-atlas-companion-toggle]');
    if (toggle) {
      e.preventDefault();
      setVisible(!state.visible);
      return;
    }

    var reset = e.target.closest && e.target.closest('[data-atlas-companion-reset]');
    if (reset) {
      e.preventDefault();
      resetPosition();
      injectSettings(true);
      return;
    }

    var petNow = e.target.closest && e.target.closest('[data-atlas-companion-pet-now]');
    if (petNow) {
      e.preventDefault();
      if (!state.visible) setVisible(true);
      pet();
      return;
    }

    var mi = e.target.closest && e.target.closest('[data-page="mi-atlas"]');
    if (mi) setTimeout(injectSettings,120);
  },true);

  window.addEventListener('resize',function(){
    if (!state.anchor) return;
    state.anchor = clamp(state.anchor.x,state.anchor.y);
    state.pos = clamp(state.pos.x,state.pos.y);
    saveAnchor();
    setVisual(state.pos.x,state.pos.y,0);
  });

  document.addEventListener('visibilitychange',function(){
    if (document.hidden) clearRoam();
    else scheduleRoam();
  });

  window.addEventListener('atlasPlayerAuthReady',function(){
    load();
    setTimeout(injectSettings,120);
  });

  var observerQueued = false;
  var observer = new MutationObserver(function(){
    if (observerQueued) return;

    var personal = document.getElementById('atlasPersonalRoot');
    if (!personal) return;

    var tabs = personal.querySelector('.atlas-personal-tabs');
    if (!tabs) return;

    var hasTab = !!tabs.querySelector('[data-personal-tab="companion"]');
    var hasPanel = !!personal.querySelector('[data-personal-panel="companion"]');

    if (hasTab && hasPanel) return;

    observerQueued = true;
    setTimeout(function(){
      observerQueued = false;
      injectSettings();
    }, 0);
  });
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('DOMContentLoaded',function(){
    ensureRoot();
    load();
    setTimeout(injectSettings,180);
  });

  if (document.readyState !== 'loading') {
    ensureRoot();
    load();
    setTimeout(injectSettings,180);
  }

  window.ATLAS_COMPANION = {
    pets:PETS,
    pet:pet,
    choose:choosePet,
    show:function(){setVisible(true)},
    hide:function(){setVisible(false)},
    reset:resetPosition
  };
})();