(function() {
  'use strict';
  let frame=null;
  window.atlasRenderPersonalityTest=function(pageName) {
    const active=pageName==='personality-test',app=document.getElementById('atlas-app');
    app?.classList.toggle('is-personality-app',active);
    if(!active){if(frame){frame.remove();frame=null}return}
    const mount=document.getElementById('atlasPersonalityMount');
    if(!mount||frame)return;
    frame=document.createElement('iframe');
    frame.title='ATLAS PERSONALITY TEST';
    frame.src='personality-test/index.html';
    frame.className='atlas-personality-frame';
    mount.appendChild(frame);
  };
  window.addEventListener('message',event=>{
    if(!frame||event.source!==frame.contentWindow||event.origin!==window.location.origin||event.data?.type!=='atlas-personality-return')return;
    window.atlasOpenPage('inicio');
  });
  // Bind drafts and completion to the authenticated account, including delayed session restore.
  let viewerId=window.AtlasPersonalityStore?.viewerId() || '';
  window.addEventListener('atlasPlayerAuthReady',()=>{
    const next=window.AtlasPersonalityStore?.viewerId() || '';
    if(next===viewerId)return;
    viewerId=next;
    if(frame){frame.remove();frame=null;window.atlasRenderPersonalityTest('personality-test')}
  });
  // Also unmount when an existing auxiliary page renderer changes the active page directly.
  document.addEventListener('DOMContentLoaded',()=>{
    const holder=document.getElementById('atlas-pages-holder');if(!holder)return;
    const sync=()=>{
      const page=holder.querySelector('.atlas-page.active');
      window.atlasRenderPersonalityTest(page?.id==='atlas-page-personality-test'?'personality-test':'');
    };
    new MutationObserver(sync).observe(holder,{subtree:true,attributes:true,attributeFilter:['class']});
    sync();
  });
})();
