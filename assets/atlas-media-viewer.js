(function(){
  'use strict';
  const excluded='dialog,.atlas-sidebar,.atlas-companion,[class*="companion"],[class*="emoji"],[class*="sticker"],[class*="achievement"],.atlas-photo-zoom';
  const ready=new WeakSet();let dialog,lastFocus;
  const backgrounds='.atlas-profile-hero,.atlas-entrenador-card-photo,.ciudad-side-image,.ciudad-location-image';
  function backgroundPhotos(root){
    const nodes=[...(root.matches?.(backgrounds)?[root]:[]),...(root.querySelectorAll?.(backgrounds)||[])];
    for(const node of nodes){if(ready.has(node)||!node.closest('#atlas-app'))continue;const css=getComputedStyle(node);const raw=css.getPropertyValue('--character-banner')||css.backgroundImage;const match=raw.match(/url\(["']?(.*?)["']?\)/);if(!match)continue;
      ready.add(node);if(css.position==='static')node.style.position='relative';const button=document.createElement('button');button.type='button';button.className='atlas-photo-zoom';button.setAttribute('aria-label','Открыть обложку полностью');button.textContent='⤢';button.onclick=e=>{e.preventDefault();e.stopPropagation();open(match[1])};node.appendChild(button);
    }
  }
  function open(src){
    try{const u=new URL(src,location.href);if(!['https:','http:','blob:'].includes(u.protocol))return;src=u.href}catch(_){return}
    if(!dialog){dialog=document.createElement('dialog');dialog.className='atlas-media-viewer';dialog.setAttribute('aria-label','Фотография');dialog.innerHTML='<header><a target="_blank" rel="noopener">Открыть оригинал ↗</a><button type="button" aria-label="Закрыть фотографию">×</button></header><img alt="Фотография полностью">';document.body.appendChild(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.querySelector('img').removeAttribute('src');lastFocus?.focus?.({preventScroll:true})})}
    lastFocus=document.activeElement;dialog.querySelector('img').src=src;dialog.querySelector('a').href=src;dialog.showModal();
  }
  function decorate(root){
    if(!root)return;
    backgroundPhotos(root);
    const images=root.matches?.('img')?[root]:root.querySelectorAll?.('img')||[];
    for(const img of images){
      if(ready.has(img)||img.closest(excluded)||!img.closest('#atlas-app'))continue;
      // Decorative logos, badges and small icons aren't photo attachments.
      if(/(?:logo|icon|badge|sprite|emoji|companion)/i.test(img.className+' '+img.getAttribute('src')))continue;
      ready.add(img);
      if(img.closest('[data-social-photo],[data-pm-photo],[data-player-photo]'))continue;
      const action=img.closest('button,a,[role=button]');
      if(action&&!action.matches('.atlas-direct-attachment-image')){
        const holder=img.parentElement;if(getComputedStyle(holder).position==='static')holder.style.position='relative';
        const zoom=document.createElement('span');zoom.className='atlas-photo-zoom';zoom.tabIndex=0;zoom.setAttribute('role','button');zoom.setAttribute('aria-label','Открыть фото полностью');zoom.textContent='⤢';
        const show=e=>{e.preventDefault();e.stopPropagation();open(img.dataset.originalSrc||img.currentSrc||img.src)};
        zoom.addEventListener('click',show);zoom.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){show(e)}});holder.appendChild(zoom);
      }else{
        img.classList.add('atlas-photo-open');if(!action){img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Открыть фото полностью')}
        img.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open(img.dataset.originalSrc||img.currentSrc||img.src)});
        img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(img.dataset.originalSrc||img.currentSrc||img.src)}});
      }
    }
  }
  new MutationObserver(changes=>{for(const change of changes)for(const n of change.addedNodes)if(n.nodeType===1)decorate(n)}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('atlasPlayerAuthReady',()=>{if(dialog?.open)dialog.close()});
  decorate(document.getElementById('atlas-app'));
})();
