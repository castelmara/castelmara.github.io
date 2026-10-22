(function(){
  'use strict';
  // Only message and post attachments use this viewer. Social/Charla have their own.
  const attachments='.atlas-direct-attachment-image img,.atlas-player-post-images img';
  const ready=new WeakSet();let dialog,lastFocus;
  function open(src){
    try{const u=new URL(src,location.href);if(!['https:','http:','blob:'].includes(u.protocol))return;src=u.href}catch(_){return}
    if(!dialog){dialog=document.createElement('dialog');dialog.className='atlas-media-viewer';dialog.setAttribute('aria-label','Фотография');dialog.innerHTML='<header><a target="_blank" rel="noopener">Открыть оригинал ↗</a><button type="button" aria-label="Закрыть фотографию">×</button></header><img alt="Фотография полностью">';document.body.appendChild(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.querySelector('img').removeAttribute('src');lastFocus?.focus?.({preventScroll:true})})}
    lastFocus=document.activeElement;dialog.querySelector('img').src=src;dialog.querySelector('a').href=src;dialog.showModal();
  }
  function decorate(root){
    if(!root)return;
    const images=[...(root.matches?.(attachments)?[root]:[]),...(root.querySelectorAll?.(attachments)||[])];
    for(const img of images){
      if(ready.has(img)||!img.closest('#atlas-app')||img.closest('dialog'))continue;
      ready.add(img);
      const action=img.closest('.atlas-direct-attachment-image')||img;
      img.classList.add('atlas-photo-open');
      if(action===img){img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Открыть фото полностью')}
      const show=e=>{e.preventDefault();e.stopPropagation();open(img.dataset.originalSrc||img.currentSrc||img.src)};
      action.addEventListener('click',show);
      action.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')show(e)});
    }
  }

  new MutationObserver(changes=>{for(const change of changes)for(const n of change.addedNodes)if(n.nodeType===1)decorate(n)}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('atlasPlayerAuthReady',()=>{if(dialog?.open)dialog.close()});
  decorate(document.getElementById('atlas-app'));
})();
