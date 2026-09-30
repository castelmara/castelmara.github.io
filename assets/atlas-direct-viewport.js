(function(){
  'use strict';
  const app=document.getElementById('atlas-app');
  if(!app)return;
  function resize(){
    const viewport=window.visualViewport;
    // Do not fight deliberate pinch zoom. Font size prevents automatic input zoom.
    if(viewport&&viewport.scale!==1)return;
    const height=viewport?viewport.height:window.innerHeight;
    app.style.setProperty('--direct-viewport-height',Math.round(height)+'px');
    app.dataset.directKeyboard=String(window.innerHeight-height>120);
  }
  window.visualViewport?.addEventListener('resize',resize);
  window.addEventListener('resize',resize);
  resize();
})();
