(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>window.ATLAS_SUPABASE;
  const uid=()=>window.ATLAS_CURRENT_SESSION?.user?.id||'';
  const checked=async q=>{const r=await q;if(r.error)throw r.error;return r.data};
  const name=p=>p?.display_name||p?.nickname||'игрок';
  const url=v=>{if(!v||typeof v!=='string')return '';try{const u=new URL(v,location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch(_){return ''}};
  const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
  let s={active:false,user:'',version:0,roomVersion:0,revision:0,root:null,rooms:[],room:null,rows:[],files:[],previews:[],unread:{},drafts:{},signed:new Map(),busy:false,loading:false};
  let channel=null,timer=null,poll=null,searchTimer=null;
  const $=q=>s.root?.querySelector(q);
  const valid=(v,r)=>s.active&&s.version===v&&s.user===uid()&&(r===undefined||s.roomVersion===r);
  const roomName=r=>r.kind==='dm'?name(r.members?.find(m=>m.user_id!==s.user)?.profile):r.title;
  const roomAvatar=r=>r.kind==='dm'?r.members?.find(m=>m.user_id!==s.user)?.profile?.avatar_url:'';
  function avatar(src,label){return '<span class="pm-avatar">'+(url(src)?'<img src="'+esc(url(src))+'" alt="" loading="lazy">':esc(label.slice(0,1)))+'</span>'}
  function status(text,error=false){const el=$('[data-pm-status]');if(el){el.textContent=text;el.classList.toggle('is-error',error)}}
  function clearFiles(){s.previews.forEach(URL.revokeObjectURL);s.files=[];s.previews=[]}
  function stop(){clearTimeout(timer);clearInterval(poll);clearTimeout(searchTimer);if(channel)client()?.removeChannel(channel);channel=null}
  function saveDraft(){if(s.room&&$('[name=message]'))s.drafts[s.room.id]=$('[name=message]').value}
  function resize(){if(!s.active)return;const box=$('.pm-shell');if(!box)return;const viewport=window.visualViewport;if(viewport&&viewport.scale!==1)return;const top=box.getBoundingClientRect().top;box.style.height=Math.max(320,(viewport?.height||innerHeight)-Math.max(0,top)-12)+'px'}
  function renderRooms(){
    const list=$('[data-pm-rooms]');if(!list)return;
    list.innerHTML=s.rooms.map(r=>'<button type="button" class="pm-room'+(r.id===s.room?.id?' is-selected':'')+'" data-pm-room="'+r.id+'">'+avatar(roomAvatar(r),r.kind==='general'?'А':roomName(r))+'<span><strong>'+esc(roomName(r))+'</strong><small>'+esc(r.preview||({general:'все игроки',dm:'личные сообщения',group:'групповой чат'}[r.kind]))+'</small></span>'+(s.unread[r.id]?'<b class="pm-unread">'+s.unread[r.id]+'</b>':'')+'</button>').join('');
  }
  async function loadRooms(){
    const v=s.version;
    const rows=await checked(client().from('atlas_player_rooms').select('id,kind,title,creator_id,created_at,members:atlas_player_room_members(user_id,profile:profiles!user_id(id,nickname,display_name,avatar_url))').order('created_at',{ascending:false}));
    if(!valid(v))return;
    s.rooms=rows.map(r=>({...r,preview:s.rooms.find(old=>old.id===r.id)?.preview})).sort((a,b)=>(b.kind==='general')-(a.kind==='general'));
    renderRooms();
  }
  function frame(){
    s.root.innerHTML='<div class="pm-shell"><aside class="pm-sidebar"><header><div><small>ATLAS · игроки</small><h2>charla</h2></div><button type="button" data-pm-new aria-label="Новый диалог или группа">＋</button></header><div class="pm-room-list" data-pm-rooms></div></aside><section class="pm-conversation"><header class="pm-room-head"><button type="button" data-pm-back aria-label="Все чаты">←</button><div data-pm-title></div><button type="button" data-pm-members title="Участники" aria-label="Участники">♙</button></header><div class="pm-history" tabindex="0" aria-label="Сообщения"><button type="button" data-pm-older hidden>предыдущие сообщения</button><div data-pm-messages></div></div><button type="button" class="pm-new-messages" data-pm-bottom hidden>новые сообщения ↓</button><form class="pm-compose" autocomplete="off"><div class="pm-file-previews"></div><div class="pm-compose-row"><label class="pm-attach" title="Прикрепить фото">＋<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple aria-label="Прикрепить фото"></label><textarea name="message" rows="1" placeholder="Написать сообщение…" aria-label="Сообщение игрока" autocomplete="off" data-lpignore="true" data-1p-ignore></textarea><button type="submit" class="social-primary" aria-label="Отправить сообщение">➤</button></div><div class="pm-compose-note"><span data-pm-status role="status"></span></div></form></section></div>'+
      '<dialog class="pm-picker"><form><header><h3>Новая переписка</h3><button type="button" data-pm-close>×</button></header><label>Тип<select name="kind"><option value="dm">Личные сообщения</option><option value="group">Групповой чат</option></select></label><input name="title" maxlength="120" placeholder="Название группы" aria-label="Название группы" hidden><input name="search" type="search" placeholder="Найти игрока…" aria-label="Найти игрока" autocomplete="off"><div data-pm-selected></div><div data-pm-people></div><p role="status"></p><button type="submit" class="social-primary">создать переписку</button></form></dialog>'+
      '<dialog class="pm-members"><header><h3>Участники</h3><button type="button" data-pm-close>×</button></header><div></div></dialog>'+
      '<dialog class="pm-photo"><button type="button" data-pm-close aria-label="Закрыть фото">×</button><img alt="Фото в оригинальном качестве"><a target="_blank" rel="noopener">открыть оригинал ↗</a></dialog>'+
      '<dialog class="pm-edit"><form><h3>Изменить сообщение</h3><textarea name="body" rows="5" aria-label="Изменённый текст"></textarea><p role="status"></p><button type="button" data-pm-close>отмена</button><button type="submit" class="social-primary">сохранить</button></form></dialog>';
    $('.pm-compose').addEventListener('submit',send);
    const text=$('[name=message]');
    text.addEventListener('input',()=>{text.style.height='auto';text.style.height=Math.min(120,text.scrollHeight)+'px'});
    text.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!matchMedia('(pointer:coarse)').matches){e.preventDefault();$('.pm-compose').requestSubmit()}});
    $('[type=file]').addEventListener('change',e=>{const files=Array.from(e.target.files);try{if(files.length+s.files.length>6)throw Error('До 6 фото в одном сообщении.');if(files.some(f=>!types[f.type]))throw Error('Поддерживаются JPG, PNG, WebP, GIF, AVIF.');s.files.push(...files);previews();status('')}catch(err){status(err.message,true)}e.target.value=''});
    $('.pm-picker form').addEventListener('submit',createRoom);
    $('.pm-picker [name=search]').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(searchPeople,200)});
    $('.pm-picker [name=kind]').addEventListener('change',()=>{const group=$('.pm-picker [name=kind]').value==='group';$('.pm-picker [name=title]').hidden=!group;selected.clear();drawSelected();searchPeople()});
    $('.pm-edit form').addEventListener('submit',editMessage);
  }
  const fields='id,room_id,sender_id,body,images,created_at,edited_at,player:profiles!sender_id(id,nickname,display_name,avatar_url)';
  async function signImages(rows){
    const paths=[...new Set(rows.flatMap(r=>r.images||[]))].filter(p=>!s.signed.has(p)||s.signed.get(p).expires<Date.now());
    if(!paths.length)return;
    const v=s.version;
    const data=await checked(client().storage.from('atlas-player-chat').createSignedUrls(paths,3600));
    if(!valid(v))return;
    data.forEach(x=>{if(x.signedUrl)s.signed.set(x.path,{url:x.signedUrl,expires:Date.now()+3300000})});
    return true;
  }
  function message(row){
    const own=row.sender_id===s.user,moderator=s.room.kind==='group'&&s.room.creator_id===s.user||s.room.kind==='general'&&['admin','superadmin'].includes(window.ATLAS_CURRENT_PROFILE?.role);
    return '<article class="pm-message'+(own?' is-own':'')+'" data-message-id="'+row.id+'"><button type="button" class="pm-sender" data-pm-player="'+row.sender_id+'">'+avatar(row.player?.avatar_url,name(row.player))+'</button><div class="pm-message-content"><button type="button" class="pm-name" data-pm-player="'+row.sender_id+'">'+esc(name(row.player))+'</button><div class="pm-bubble"><div class="pm-message-body">'+esc(row.body)+'</div>'+((row.images||[]).length?'<div class="pm-images">'+row.images.map(path=>{const signed=s.signed.get(path)?.url;return signed?'<button type="button" data-pm-photo="'+esc(signed)+'"><img src="'+esc(signed)+'" alt="Фото" loading="lazy"></button>':'<span>Фото временно недоступно</span>'}).join('')+'</div>':'')+'<time>'+esc(new Date(row.created_at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+(row.edited_at?' · изм.':'')+'</time></div><div class="pm-message-actions">'+(own?'<button type="button" data-pm-edit="'+row.id+'">изменить</button>':'')+(own||moderator?'<button type="button" data-pm-delete="'+row.id+'">удалить</button>':'')+'</div></div></article>';
  }
  function drawMessages(mode='refresh'){
    const history=$('.pm-history'),before=history.scrollHeight,top=history.scrollTop,bottom=before-top-history.clientHeight<100;
    $('[data-pm-messages]').innerHTML=[...s.rows].reverse().map(message).join('')||'<p class="pm-empty">Нет сообщений.</p>';
    if(mode==='older')history.scrollTop=history.scrollHeight-before+top;
    else if(mode==='open'||mode==='send'||bottom){history.scrollTop=history.scrollHeight;$('[data-pm-bottom]').hidden=true}
    else{history.scrollTop=top;$('[data-pm-bottom]').hidden=false}
  }
  async function loadMessages(mode='refresh'){
    if(!s.room||s.loading)return;
    const v=s.version,rv=s.roomVersion,revision=s.revision,room=s.room.id;s.loading=true;
    try{
      let q=client().from('atlas_player_messages').select(fields).eq('room_id',room).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(40);
      if(mode==='older'&&s.rows.length){const last=s.rows[s.rows.length-1];q=q.or('created_at.lt.'+last.created_at+',and(created_at.eq.'+last.created_at+',id.lt.'+last.id+')')}
      const rows=await checked(q);const changedImages=await signImages(rows);if(!valid(v,rv)||revision!==s.revision)return;
      if(mode==='open'){s.rows=rows;$('[data-pm-older]').hidden=rows.length<40}
      else if(mode==='older'){s.rows.push(...rows);$('[data-pm-older]').hidden=rows.length<40}
      else{
        const cutoff=rows[rows.length-1];
        const older=cutoff?s.rows.filter(r=>r.created_at<cutoff.created_at||(r.created_at===cutoff.created_at&&r.id<cutoff.id)):[];
        const merged=[...rows,...older];
        if(mode==='refresh'&&!changedImages&&JSON.stringify(merged)===JSON.stringify(s.rows))return;
        s.rows=merged;
      }
      drawMessages(mode);
    }catch(err){if(valid(v,rv))status('Не удалось загрузить сообщения: '+err.message,true)}
    finally{if(valid(v,rv))s.loading=false}
  }
  async function openRoom(id){
    const room=s.rooms.find(r=>r.id===id);if(!room)return;
    saveDraft();clearFiles();s.room=room;s.rows=[];s.loading=false;s.busy=false;++s.roomVersion;s.unread[id]=0;
    $('.pm-shell').classList.add('is-open');
    $('[data-pm-title]').innerHTML='<strong>'+esc(roomName(room))+'</strong><small>'+esc(room.kind==='general'?'общение от лица игроков':room.kind==='dm'?'личная переписка':room.members.length+' участников')+'</small>';
    $('[name=message]').value=s.drafts[id]||'';previews();status('');
    $('.pm-compose').querySelectorAll('button,input,textarea').forEach(e=>e.disabled=false);
    $('[data-pm-messages]').textContent='Загружаем сообщения…';renderRooms();resize();await loadMessages('open');
  }
  function previews(){s.previews.forEach(URL.revokeObjectURL);s.previews=s.files.map(URL.createObjectURL);$('.pm-file-previews').innerHTML=s.previews.map((src,i)=>'<div><img src="'+src+'" alt="Фото '+(i+1)+'"><button type="button" data-pm-remove="'+i+'" aria-label="Убрать фото">×</button></div>').join('');resize()}
  async function send(e){
    e.preventDefault();if(s.busy||!s.room)return;
    const form=e.currentTarget,text=$('[name=message]'),body=text.value,files=[...s.files];if(!body.trim()&&!files.length)return;
    const v=s.version,rv=s.roomVersion,room=s.room.id,user=s.user,paths=[];let committed=false;
    s.busy=true;form.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);
    try{
      for(let i=0;i<files.length;i++){
        if(!valid(v,rv))throw Error('Переписка изменилась. Отправка отменена.');
        status('Загружаем фото '+(i+1)+'…');const path=user+'/'+room+'/'+crypto.randomUUID()+'.'+types[files[i].type];
        await checked(client().storage.from('atlas-player-chat').upload(path,files[i],{contentType:files[i].type,upsert:false}));paths.push(path);
      }
      if(!valid(v,rv))throw Error('Переписка изменилась. Отправка отменена.');
      const row=await checked(client().from('atlas_player_messages').insert({room_id:room,sender_id:user,body,images:paths}).select(fields).single());committed=true;
      if(s.user===user)s.drafts[room]='';
      if(!valid(v,rv))return;
      ++s.revision;
      text.value='';text.style.height='auto';s.drafts[room]='';clearFiles();previews();status('');
      await signImages([row]);if(!valid(v,rv))return;
      s.rows=[row,...s.rows.filter(r=>r.id!==row.id)];drawMessages('send');s.room.preview=body||'фотография';renderRooms();
      if(!matchMedia('(pointer:coarse)').matches){text.disabled=false;text.focus()}
    }catch(err){if(!committed&&paths.length&&uid()===user)await client().storage.from('atlas-player-chat').remove(paths);if(valid(v,rv))status(err.message,true)}
    finally{if(valid(v,rv)){s.busy=false;form.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=false)}}
  }
  let selected=new Map(),searchVersion=0;
  function drawSelected(){const el=$('[data-pm-selected]');if(el)el.innerHTML=[...selected].map(([id,p])=>'<button type="button" data-pm-unselect="'+id+'">'+esc(name(p))+' ×</button>').join('')}
  async function searchPeople(){
    const version=++searchVersion,v=s.version;
    const term=$('.pm-picker [name=search]').value.trim().replace(/[%_,().]/g,' ');
    let q=client().from('profiles').select('id,nickname,display_name,avatar_url').neq('id',s.user).order('nickname').limit(80);
    if(term)q=q.or('nickname.ilike.%'+term+'%,display_name.ilike.%'+term+'%');
    try{const people=await checked(q);if(!valid(v)||version!==searchVersion)return;
      $('[data-pm-people]').innerHTML=people.map(p=>'<label class="pm-person">'+avatar(p.avatar_url,name(p))+'<span>'+esc(name(p))+'<small>@'+esc(p.nickname)+'</small></span><input type="checkbox" value="'+p.id+'" '+(selected.has(p.id)?'checked':'')+'></label>').join('')||'<p>Игроки не найдены.</p>';
      $('[data-pm-people]').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{const p=people.find(x=>x.id===input.value);if(input.checked){if($('.pm-picker [name=kind]').value==='dm'){selected.clear();$('[data-pm-people]').querySelectorAll('input').forEach(x=>x.checked=x===input)}selected.set(p.id,p)}else selected.delete(p.id);drawSelected()}));
    }catch(err){if(valid(v)&&version===searchVersion)$('[data-pm-people]').textContent=err.message}
  }
  async function createRoom(e){
    e.preventDefault();const form=e.currentTarget,v=s.version,button=form.querySelector('[type=submit]');button.disabled=true;
    try{const id=await checked(client().rpc('atlas_create_player_room',{p_kind:form.elements.kind.value,p_title:form.elements.title.value,p_users:[...selected.keys()]}));if(!valid(v))return;await loadRooms();if(!valid(v))return;$('.pm-picker').close();await openRoom(id)}
    catch(err){if(valid(v))form.querySelector('[role=status]').textContent=err.message}
    finally{button.disabled=false}
  }
  async function editMessage(e){
    e.preventDefault();const form=e.currentTarget,dialog=form.closest('dialog'),v=s.version,rv=s.roomVersion;form.querySelector('[type=submit]').disabled=true;
    try{const row=await checked(client().from('atlas_player_messages').update({body:form.elements.body.value}).eq('id',dialog.dataset.id).select(fields).single());if(!valid(v,rv))return;s.rows=s.rows.map(r=>r.id===row.id?row:r);drawMessages();dialog.close()}
    catch(err){if(valid(v,rv))form.querySelector('[role=status]').textContent=err.message}
    finally{form.querySelector('[type=submit]').disabled=false}
  }
  function subscribe(){
    stop();const v=s.version;
    channel=client().channel('atlas-player-messenger-'+s.user+'-'+v)
      .on('postgres_changes',{event:'*',schema:'public',table:'atlas_player_messages'},payload=>{
        if(!valid(v))return;const row=payload.new||{},old=payload.old||{};
        if(payload.eventType==='DELETE'){s.rows=s.rows.filter(r=>r.id!==old.id);if(s.room)drawMessages();return}
        const room=s.rooms.find(r=>r.id===row.room_id);if(room){room.preview=row.body||'фотография';if(row.room_id!==s.room?.id&&payload.eventType==='INSERT'&&row.sender_id!==s.user)s.unread[room.id]=(s.unread[room.id]||0)+1;renderRooms()}
        if(row.room_id===s.room?.id){clearTimeout(timer);timer=setTimeout(()=>loadMessages(),180)}
        else if(!room)loadRooms().catch(()=>{});
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'atlas_player_room_members',filter:'user_id=eq.'+s.user},()=>loadRooms().catch(()=>{})).subscribe();
    poll=setInterval(()=>{if(!document.hidden&&s.active){loadRooms().catch(()=>{});loadMessages()}},60000);
  }
  async function activate(page,force=false,initialRoom=null){
    if(page!=='charla'){if(s.active){saveDraft();stop();clearFiles();++s.version;s.active=false;document.getElementById('atlas-app')?.classList.remove('pm-active')}return}
    if(s.active&&s.user===uid()&&!force)return;
    stop();clearFiles();const root=document.querySelector('#atlas-page-charla .social-root');if(!root)return;
    const same=s.user===uid();s={...s,active:true,user:uid(),version:s.version+1,roomVersion:0,root,room:null,rooms:[],rows:[],signed:new Map(),unread:same?s.unread:{},drafts:same?s.drafts:{},loading:false,busy:false};const v=s.version;
    root.classList.add('pm-root');document.getElementById('atlas-app')?.classList.add('pm-active');
    if(!s.user){root.innerHTML='<h2>charla</h2><p>Войди в аккаунт, чтобы общаться.</p><button type="button" data-pm-login>войти</button>';return}
    frame();resize();
    try{await loadRooms();if(!valid(v))return;const first=s.rooms.find(r=>r.id===initialRoom)||s.rooms.find(r=>r.kind==='general');if(first)await openRoom(first.id);if(!valid(v))return;subscribe()}
    catch(err){if(valid(v))status(err.message,true)}
  }
  document.addEventListener('click',async e=>{
    if(!s.active||!s.root?.contains(e.target))return;const button=e.target.closest('button');if(!button)return;const d=button.dataset;
    if(d.pmRoom)openRoom(d.pmRoom);
    else if('pmNew' in d){selected.clear();drawSelected();$('.pm-picker form').reset();$('.pm-picker [name=title]').hidden=true;$('.pm-picker [role=status]').textContent='';$('.pm-picker').showModal();searchPeople()}
    else if('pmClose' in d)button.closest('dialog').close();
    else if('pmBack' in d){$('.pm-shell').classList.remove('is-open');resize()}
    else if('pmOlder' in d)loadMessages('older');
    else if('pmBottom' in d){$('.pm-history').scrollTop=$('.pm-history').scrollHeight;button.hidden=true}
    else if('pmLogin' in d)document.getElementById('atlasAccountButton')?.click();
    else if('pmMembers' in d){const dialog=$('.pm-members');dialog.querySelector('div').innerHTML=s.room?.kind==='general'?'<p>В общем чате могут писать все зарегистрированные игроки.</p>':s.room?.members.map(m=>'<p>'+esc(name(m.profile))+' · @'+esc(m.profile?.nickname)+'</p>').join('');dialog.showModal()}
    else if(d.pmPlayer)window.atlasOpenPlayerProfile?.(d.pmPlayer);
    else if(d.pmPhoto){const dialog=$('.pm-photo');dialog.querySelector('img').src=d.pmPhoto;dialog.querySelector('a').href=d.pmPhoto;dialog.showModal()}
    else if('pmRemove' in d&&!s.busy){s.files.splice(Number(d.pmRemove),1);previews()}
    else if(d.pmUnselect){selected.delete(d.pmUnselect);drawSelected();searchPeople()}
    else if(d.pmEdit){const row=s.rows.find(r=>r.id===d.pmEdit),dialog=$('.pm-edit');if(!row)return;dialog.dataset.id=row.id;dialog.querySelector('textarea').value=row.body;dialog.querySelector('[role=status]').textContent='';dialog.showModal()}
    else if(d.pmDelete){if(!confirm('Удалить сообщение?'))return;const v=s.version,rv=s.roomVersion;try{const deleted=await checked(client().from('atlas_player_messages').delete().eq('id',d.pmDelete).select('id'));if(!deleted.length)throw Error('Нет прав на удаление');if(valid(v,rv)){s.rows=s.rows.filter(r=>r.id!==d.pmDelete);drawMessages()}}catch(err){if(valid(v,rv))status(err.message,true)}}
  });
  let openingPlayer=false;
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-player-message]');if(!button)return;
    e.preventDefault();
    if(!uid()){document.getElementById('atlasAccountButton')?.click();return}
    const player=button.dataset.playerMessage,user=uid();
    if(!player||player===user||openingPlayer)return;
    const notice=button.parentElement.querySelector('[data-player-message-status]');
    openingPlayer=true;button.disabled=true;if(notice)notice.textContent='';
    try{
      const room=await checked(client().rpc('atlas_create_player_room',{p_kind:'dm',p_title:'',p_users:[player]}));
      if(uid()!==user||!button.isConnected)return;
      window.atlasOpenPage('charla');
      await activate('charla',true,room);
    }catch(err){if(notice&&uid()===user)notice.textContent='Не удалось открыть диалог. '+(err.message||'Попробуй ещё раз.');}
    finally{openingPlayer=false;button.disabled=false;}
  });
  window.atlasRenderPlayerMessenger=activate;
  window.addEventListener('atlasPlayerAuthReady',()=>{
    if(s.user===uid())return;
    const wasActive=s.active;stop();clearFiles();++s.version;s.rows=[];s.rooms=[];s.drafts={};s.signed.clear();
    if(s.root)s.root.replaceChildren();
    if(wasActive)activate('charla',true);
  });
  window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(s.active&&!document.hidden)loadMessages()});
  activate(document.querySelector('.atlas-page.active')?.id.replace('atlas-page-',''));
})();
