(function(){
  'use strict';
  // A missing preview must not hide an otherwise available original.
  document.addEventListener('error',function(event){
    const img=event.target;
    if(img.tagName!=='IMG'||!img.dataset.originalSrc||img.dataset.originalFallback)return;
    if(img.getAttribute('src')===img.dataset.originalSrc)return;
    img.dataset.originalFallback='true';
    img.src=img.dataset.originalSrc;
  },true);
})();
