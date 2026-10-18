const vendor=new URL('./vendor/',import.meta.url);
let mammothReady;
function mammoth(){
 if(!mammothReady)mammothReady=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=new URL('mammoth-1.13.0/mammoth.browser.js',vendor).href;
   script.onload=()=>resolve(window.mammoth);script.onerror=()=>{mammothReady=null;script.remove();reject(Error('Не удалось загрузить просмотр DOCX. Попробуй ещё раз.'))};document.head.appendChild(script);
 });return mammothReady;
}
export async function openDocument(blob,fileName,host){
 let destroyed=false,pdf=null,pageNumber=1,rendering=false,renderTask=null,loadingTask=null;
 const handle={text:'',destroy(){destroyed=true;renderTask?.cancel();loadingTask?.destroy()?.catch(()=>{});host.replaceChildren()}};
 const ext=String(fileName).split('.').pop().toLowerCase();
 if(ext==='pdf'){
   const lib=await import(new URL('pdfjs-dist-6.4.299/legacy/build/pdf.mjs',vendor).href);
   lib.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist-6.4.299/legacy/build/pdf.worker.mjs',vendor).href;
   const task=loadingTask=lib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,
     cMapUrl:new URL('pdfjs-dist-6.4.299/cmaps/',vendor).href,cMapPacked:true,
     standardFontDataUrl:new URL('pdfjs-dist-6.4.299/standard_fonts/',vendor).href,
     wasmUrl:new URL('pdfjs-dist-6.4.299/wasm/',vendor).href});
   task.onPassword=()=>task.destroy();pdf=await task.promise;
   if(!host.isConnected){handle.destroy();return handle}
   host.innerHTML='<div class="atlas-q-pdf-nav"><button type="button" data-doc-prev aria-label="Предыдущая страница">←</button><span></span><button type="button" data-doc-next aria-label="Следующая страница">→</button></div><canvas aria-label="Страница PDF"></canvas><p class="atlas-q-doc-hint">Извлекаем текст…</p>';
   const canvas=host.querySelector('canvas'),prev=host.querySelector('[data-doc-prev]'),next=host.querySelector('[data-doc-next]'),counter=host.querySelector('span');
   async function render(){
     if(destroyed||rendering)return;rendering=true;prev.disabled=next.disabled=true;
     try{const page=await pdf.getPage(pageNumber),natural=page.getViewport({scale:1});
       const width=Math.max(240,host.clientWidth),scale=width/natural.width,ratio=Math.min(window.devicePixelRatio||1,2),viewport=page.getViewport({scale:scale*ratio});
       canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width='100%';canvas.style.height='auto';
       renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;counter.textContent=pageNumber+' / '+pdf.numPages;
     }finally{rendering=false;if(!destroyed){prev.disabled=pageNumber===1;next.disabled=pageNumber===pdf.numPages}}
   }
   prev.onclick=()=>{if(pageNumber>1){pageNumber--;render().catch(()=>{})}};next.onclick=()=>{if(pageNumber<pdf.numPages){pageNumber++;render().catch(()=>{})}};
   await render();const chunks=[];
   for(let i=1;i<=pdf.numPages;i++){
     if(!host.isConnected){handle.destroy();return handle}
     const page=await pdf.getPage(i),content=await page.getTextContent();
     chunks.push(content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join(''));
   }
   handle.text=chunks.join('\n\n').trim();host.querySelector('.atlas-q-doc-hint').textContent=handle.text?'Текст PDF извлечён. Проверь переносы перед сохранением.':'В PDF нет доступного текста. Если это скан, впиши текст в редактор вручную.';
 }else{
   if(ext==='docx'){const parser=await mammoth();handle.text=(await parser.extractRawText({arrayBuffer:await blob.arrayBuffer()})).value}
   else if(ext==='txt')handle.text=await blob.text();
   else throw Error('Встроенный просмотр поддерживает PDF, DOCX и TXT.');
   if(!host.isConnected)return handle;
   const pre=document.createElement('div');pre.className='atlas-q-document-text';pre.textContent=handle.text||'В документе нет текста.';host.replaceChildren(pre);
 }
 return handle;
}
