(function(){
  'use strict';
  const base='assets/vendor/emoji-mart/';
  const gothic=[['black_heart','чёрное сердце'],['thorn_heart','сердце с шипами'],['bow','чёрный бант'],['rose','бордовая роза'],['cat','чёрный кот'],['skull','череп'],['butterfly','бабочка'],['candles','свечи'],['crescent','полумесяц'],['moon','луна'],['key','ключ'],['lock','замок-сердце'],['cherries','вишни'],['crown','корона'],['swan','чёрный лебедь'],['letter','письмо с печатью']];
  const gothicMap=new Map(gothic.map(([id,name],i)=>[':gothic_'+id+':',{name,i}]));
  function stickerSpan(token){const item=gothicMap.get(token);if(!item)return null;const span=document.createElement('span');span.dataset.atlasEmoji='';span.className='atlas-gothic-sticker';span.textContent=token;span.setAttribute('role','img');span.setAttribute('aria-label',item.name);span.title=item.name;span.style.backgroundPosition=((item.i%4)/3*100)+'% '+(Math.floor(item.i/4)/3*100)+'%';return span}
  let loading,resources,panel,button,field,selection,resizeObserver,version=0;
  function load(){
    if(!loading)loading=Promise.all([
      fetch(base+'apple.json').then(r=>{if(!r.ok)throw Error('data');return r.json()}),
      fetch(base+'ru.json').then(r=>{if(!r.ok)throw Error('locale');return r.json()}),
      new Promise((resolve,reject)=>{if(window.EmojiMart)return resolve();const s=document.createElement('script');s.src=base+'browser.js';s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('script'))};document.head.appendChild(s)})
    ]).then(([data,i18n])=>resources={data,i18n}).catch(e=>{loading=null;throw e});
    return loading;
  }
  function close(focus){version++;if(resizeObserver){resizeObserver.disconnect();resizeObserver=null}if(panel)panel.remove();panel=null;if(button){button.setAttribute('aria-expanded','false');if(focus&&button.isConnected)button.focus()}button=null;field=null;}
  function position(){
    if(!panel||!button)return;
    const r=button.getBoundingClientRect(),v=window.visualViewport;
    const width=v?v.width:innerWidth,height=v?v.height:innerHeight,left=v?v.offsetLeft:0,top=v?v.offsetTop:0;
    panel.style.width=Math.min(352,width-16)+'px';panel.style.maxHeight=Math.max(100,height-24)+'px';
    panel.style.left=Math.max(left+8,Math.min(r.right-panel.offsetWidth,left+width-panel.offsetWidth-8))+'px';
    panel.style.top=Math.max(top+8,r.top-panel.offsetHeight-8)+'px';
  }
  async function open(trigger){
    if(panel&&button===trigger){close(true);return}
    close();button=trigger;field=document.getElementById('atlasDirectMessageBody');if(!field)return;
    const originalField=field,originalForm=field.form;
    selection={start:field.selectionStart,end:field.selectionEnd};
    trigger.setAttribute('aria-expanded','true');
    panel=document.createElement('div');panel.id='atlasDirectEmojiPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Выбор эмодзи');
    panel.innerHTML='<div class="atlas-emoji-tabs"><button type="button" data-emoji-set="standard" aria-pressed="true">эмодзи</button><button type="button" data-emoji-set="gothic" aria-pressed="false">готика</button></div><button type="button" class="atlas-emoji-close" aria-label="Закрыть эмодзи">×</button><div class="atlas-emoji-content" role="status">Загружаем эмодзи…</div>';
    function insert(value){
      if(!originalField.isConnected||originalField.form!==originalForm||document.getElementById('atlasDirectMessageBody')!==originalField){close();return}
      originalField.setRangeText(value,selection.start,selection.end,'end');
      originalField.dispatchEvent(new Event('input',{bubbles:true}));close();originalField.focus({preventScroll:true});
    }
    const grid=document.createElement('div');grid.className='atlas-gothic-grid';grid.hidden=true;
    gothicMap.forEach((item,token)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',item.name);b.title=item.name;b.appendChild(stickerSpan(token));b.addEventListener('click',()=>insert(token));grid.appendChild(b)});
    panel.appendChild(grid);
    panel.querySelectorAll('[data-emoji-set]').forEach(tab=>tab.addEventListener('click',()=>{
      const custom=tab.dataset.emojiSet==='gothic';grid.hidden=!custom;panel.querySelector('.atlas-emoji-content').hidden=custom;
      panel.querySelectorAll('[data-emoji-set]').forEach(b=>b.setAttribute('aria-pressed',String(b===tab)));position();
    }));
    document.body.appendChild(panel);position();const own=version;
    try{
      const {data,i18n}=await load();if(own!==version||!panel)return;
      const picker=new EmojiMart.Picker({data,i18n,locale:'ru',set:'apple',emojiVersion:15,getSpritesheetURL:()=>base+'apple-64.png',skinTonePosition:'search',previewPosition:'none',perLine:8,maxFrequentRows:2,autoFocus:false,theme:document.documentElement.dataset.atlasTheme==='dark'?'dark':'light',onEmojiSelect(emoji){insert(emoji.native)}});
      panel.querySelector('.atlas-emoji-content').replaceChildren(picker);requestAnimationFrame(position);
      resizeObserver=new ResizeObserver(()=>{if(panel)position()});resizeObserver.observe(picker);
    }catch(e){if(own===version&&panel)panel.querySelector('.atlas-emoji-content').textContent='Не удалось загрузить эмодзи. Закрой и попробуй ещё раз.'}
  }
  document.addEventListener('pointerdown',e=>{
    if(e.target.closest('[data-direct-emojis]')){const t=document.getElementById('atlasDirectMessageBody');if(t)selection={start:t.selectionStart,end:t.selectionEnd};return}
    if(panel&&!panel.contains(e.target))close();
  });
  document.addEventListener('click',e=>{const t=e.target.closest('[data-direct-emojis]');if(t){open(t);return}if(e.target.closest('.atlas-emoji-close'))close(true)});
  document.addEventListener('keydown',e=>{if(panel&&e.key==='Escape'){e.preventDefault();close(true)}});
  window.addEventListener('resize',position);window.addEventListener('hashchange',()=>close());
  if(window.visualViewport){visualViewport.addEventListener('resize',position);visualViewport.addEventListener('scroll',position)}
  let emojiMap,scheduled=false,failedUntil=0;
  const processedText=new WeakMap();
  const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
  async function decorate(){
    scheduled=false;if(!segmenter||Date.now()<failedUntil)return;
    const blocks=[...document.querySelectorAll('.atlas-direct-message-text,.atlas-voice-transcript')];
    if(!blocks.some(b=>/\p{Extended_Pictographic}|:gothic_[a-z_]+:/u.test(b.textContent)))return;
    try{
      const {data}=await load();
      if(!emojiMap){emojiMap=new Map();Object.values(data.emojis).forEach(e=>e.skins.forEach(s=>emojiMap.set(s.native,s)))}
      for(const block of blocks){
        if(!block.isConnected)continue;
        const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),texts=[];let node;
        while((node=walker.nextNode()))if(!node.parentElement.closest('[data-atlas-emoji]'))texts.push(node);
        texts.forEach(text=>{
          if(processedText.get(text)===text.nodeValue)return;
          processedText.set(text,text.nodeValue);
          if(!/\p{Extended_Pictographic}|:gothic_[a-z_]+:/u.test(text.nodeValue))return;
          const parts=text.nodeValue.split(/(:gothic_[a-z_]+:)/g);
          const pieces=parts.flatMap(part=>gothicMap.has(part)?[{segment:part,gothic:true}]:[...segmenter.segment(part)]);
          if(!pieces.some(p=>p.gothic||emojiMap.has(p.segment)))return;
          const fragment=document.createDocumentFragment();let plain='';
          function flush(){if(plain){fragment.appendChild(document.createTextNode(plain));plain=''}}
          pieces.forEach(p=>{
            if(p.gothic){flush();fragment.appendChild(stickerSpan(p.segment));return}
            const skin=emojiMap.get(p.segment);if(!skin){plain+=p.segment;return}flush();
            const span=document.createElement('span');span.dataset.atlasEmoji='';span.className='atlas-direct-apple-emoji';span.textContent=p.segment;
            span.style.backgroundSize=(data.sheet.cols*100)+'% '+(data.sheet.rows*100)+'%';
            span.style.backgroundPosition=(skin.x/(data.sheet.cols-1)*100)+'% '+(skin.y/(data.sheet.rows-1)*100)+'%';fragment.appendChild(span);
          });flush();text.replaceWith(fragment);
        });
      }
    }catch(_e){failedUntil=Date.now()+30000}
  }
  new MutationObserver(changes=>{
    if(panel&&(!button.isConnected||!field.isConnected))close();
    const relevant=changes.some(m=>(m.target.nodeType===1&&m.target.closest('.atlas-direct-message-text,.atlas-voice-transcript'))||[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches('.atlas-direct-message-text,.atlas-voice-transcript')||n.querySelector('.atlas-direct-message-text,.atlas-voice-transcript'))));
    if(relevant&&!scheduled){scheduled=true;requestAnimationFrame(decorate)}
  }).observe(document.body,{childList:true,subtree:true});
  decorate();
})();
