(function(){
  'use strict';
  var loading=null,loaded=new Set();
  var scripts=['assets/atlas-games-engine.js?v=20261002-1','assets/vendor/chess-1.4.0.js','assets/atlas-chess.js?v=20261008-levels','assets/atlas-daily-games.js?v=20261008-1','assets/atlas-games.js?v=20261008-daily'];
  var styles=['assets/atlas-games.css?v=20261005-2','assets/atlas-chess.css?v=20261006-1','assets/atlas-daily-games.css?v=20261008-1'];
  function active(){return !!document.querySelector('#atlas-page-games.active')}
  function resource(url,css){
    if(loaded.has(url))return Promise.resolve();
    return new Promise(function(resolve,reject){
      var el=document.createElement(css?'link':'script');
      if(css){el.rel='stylesheet';el.href=url}else{el.src=url;el.async=false}
      el.onload=function(){loaded.add(url);resolve()};
      el.onerror=function(){el.remove();reject(new Error('Не удалось загрузить игры'))};
      document.head.appendChild(el);
    });
  }
  async function load(){
    if(!active()||loading||loaded.has(scripts[scripts.length-1]))return;
    var root=document.getElementById('atlasGamesRoot');
    if(root)root.textContent='Загружаем игры…';
    loading=(async function(){
      await Promise.all(styles.map(function(url){return resource(url,true)}));
      for(var url of scripts)await resource(url,false);
    })();
    try{await loading;observer.disconnect()}catch(e){if(root&&active()){root.textContent='Не удалось загрузить игры. ';var retry=document.createElement('button');retry.type='button';retry.textContent='Повторить';retry.onclick=load;root.appendChild(retry)}}
    finally{loading=null}
  }
  window.atlasRenderGames=function(page){if(page==='games')load()};
  window.addEventListener('hashchange',function(){setTimeout(load,0)});
  var observer=new MutationObserver(load);
  observer.observe(document.getElementById('atlas-app')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  load();
})();
