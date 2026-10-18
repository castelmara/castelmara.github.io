(function(){
 'use strict';
 const labels={fullName:'Полное имя',originalName:'Имя латиницей',birthDate:'Дата рождения',age:'Возраст',faculty:'Факультет / место работы',specialization:'Специализация / должность',biography:'Биография',personality:'Характер',motivation:'Мотивация и амбиции',extra:'Дополнительные факты',faceclaim:'Внешность'};
 const headerLabels={fullName:'Имя персонажа',faculty:'Факультет / место работы',faceclaim:'Внешность · имя прототипа'};
 const acceptance=name=>'Анкета принята. Персонаж «'+name+'» успешно зарегистрирован в системе АТЛАС. Добро пожаловать в Кастельмару!';
 const corrections='Анкета требует доработки. Пожалуйста, исправьте следующие пункты:\n\n1. \n2. \n3. ';
 const longKeys=['biography','personality','motivation','extra'];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mergeProfile(base,content){
   const c=JSON.parse(JSON.stringify(base));c.profile=c.profile||{};
   c.profile.overview=c.profile.overview||{};c.profile.overview.mainInfo=c.profile.overview.mainInfo||{};
   c.profile.dossier=c.profile.dossier||{};
   for(const key of Object.keys(labels))if(typeof content[key]==='string'&&content[key].trim()){
     if(longKeys.includes(key))c.profile.dossier[key]={text:content[key]};
     else c.profile.overview.mainInfo[key]=content[key];
   }
   return c;
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={mergeProfile,esc,acceptance,headerLabels};return}
 const documentModule=new URL('./atlas-questionnaire-documents.mjs',document.currentScript.src).href;
 let reader=null,readerEpoch=0,editorState=null;
 function clearReader(){++readerEpoch;reader?.destroy();reader=null;editorState=null}
 function mayLeave(){const text=dialog?.querySelector('[data-q-editor]');return !text||!editorState||text.value===editorState.saved||confirm('Выйти без сохранения правок текста?')}
 const client=()=>window.ATLAS_SUPABASE,uid=()=>window.ATLAS_CURRENT_SESSION?.user?.id||'';
 const checked=async q=>{const r=await q;if(r.error)throw r.error;return r.data};
 const local=id=>[...(window.ATLAS_CHARACTERS||[]),...(window.ATLAS_CARD_ONLY||[]),...(window.ATLAS_CHARACTER_DIRECTORY||[])].find(c=>c.id===id);
 const title=id=>window.atlasCharacterDisplayName?.(id)||local(id)?.name||id;
 const base=new Map(),publications=new Map();
 let viewer={id:'',role:'',characters:[]},epoch=0,dialog=null,busy=false,rows=[],mode='mine';
 function message(t){const n=dialog?.querySelector('[data-q-status]');if(n)n.textContent=t}
 function lock(on){busy=on;dialog?.querySelectorAll('button,input,textarea,select').forEach(x=>x.disabled=on);const text=dialog?.querySelector('[data-q-editor]');if(text&&!on&&!editorState?.ready)text.disabled=true}
 function close(){if(busy||!mayLeave())return;clearReader();dialog?.close();dialog?.remove();dialog=null}
 function shell(){close();dialog=document.createElement('dialog');dialog.className='atlas-q-dialog';
   dialog.innerHTML='<header><h2>Анкеты персонажей</h2><button type="button" data-q-close aria-label="Закрыть">×</button></header><div data-q-body></div><p data-q-status role="status"></p>';
   dialog.addEventListener('cancel',e=>{e.preventDefault();close()});(document.getElementById('atlas-app')||document.body).appendChild(dialog);dialog.showModal();return dialog;
 }
 async function loadViewer(){
   const user=uid(),v=++epoch;viewer={id:user,role:'',characters:[]};if(!user||!client())return;
   const [p,owns]=await Promise.all([checked(client().from('profiles').select('role').eq('id',user).single()),checked(client().from('character_owners').select('character_id').eq('user_id',user))]);
   const chars=owns.length?await checked(client().from('atlas_character_catalog').select('id,name').in('id',owns.map(o=>o.character_id)).eq('active',true).order('name')):[];
   if(v!==epoch||user!==uid())return;viewer={id:user,role:p.role,characters:chars};mount();
 }
 function mount(){
   document.querySelectorAll('[data-q-launch]').forEach(x=>x.remove());if(!uid()||viewer.id!==uid())return;
   const places=[document.querySelector('#atlas-page-mi-atlas > .atlas-page-shell'),document.querySelector('#atlasPlayerProfileRoot [data-player-tab-panel="characters"]')];
   for(const parent of places){if(!parent)continue;const b=document.createElement('button');b.type='button';b.className='atlas-q-launch';b.dataset.qLaunch='';b.textContent=viewer.role==='superadmin'?'Анкеты · мои заявки и проверка':'Мои анкеты';parent.prepend(b)}
   const root=document.getElementById('atlasCharacterProfileRoot'),id=root?.dataset.communityId;
   if(id&&viewer.characters.some(c=>c.id===id)){const b=document.createElement('button');b.type='button';b.className='atlas-personal-action';b.dataset.qLaunch=id;b.textContent='Подать анкету на проверку';root.querySelector('.atlas-personal-actions')?.appendChild(b)}
 }
 async function loadPublic(){
   if(!client())return;
   let all=[],offset=0,part;
   do{part=await checked(client().from('atlas_questionnaire_publications').select('*').range(offset,offset+499));all.push(...part);offset+=500}while(part.length===500);
   const chars=window.ATLAS_CHARACTERS=window.ATLAS_CHARACTERS||[];
   for(const row of all){
     if(!base.has(row.character_id)){
       const original=local(row.character_id)||{id:row.character_id,name:row.character_id,category:'estudiantes',type:'student_sport'};
       base.set(row.character_id,JSON.parse(JSON.stringify({...original,cardImage:original.cardImage||original.image,avatar:original.avatar||original.image})));
     }
     const c=mergeProfile(base.get(row.character_id),row.content);publications.set(row.character_id,row);
     const i=chars.findIndex(x=>x.id===c.id);if(i<0)chars.push(c);else chars[i]=c;
   }
   window.atlasRenderCharacters?.();window.atlasRenderCardOnlyCharacters?.();
 }
 function hydrate(id){mount();const root=document.getElementById('atlasCharacterProfileRoot');if(root?.dataset.communityId!==id)return;
   root.querySelector('[data-q-public-file]')?.remove();const row=publications.get(id);if(!row?.file_path)return;
   const b=document.createElement('button');b.type='button';b.className='atlas-q-launch';b.dataset.qPublicFile=id;b.textContent='Открыть анкету';const panel=root.querySelector('[data-character-tab-panel="dossier"]');if(row.document_text!=null&&panel)panel.innerHTML='<article class="atlas-profile-card"><h3>АНКЕТА</h3><div class="atlas-q-text">'+esc(row.document_text)+'</div></article>';panel?.prepend(b);
 }
 const statuses={pending:'На проверке',approved:'Одобрено',rejected:'На доработке'};
 async function showList(){
   clearReader();
   const d=dialog,user=uid();message('Загружаем…');
   let q=client().from('atlas_questionnaire_submissions').select('*').order('created_at',{ascending:false});if(mode==='mine')q=q.eq('actor_id',user);
   const result=[];for(let offset=0;;offset+=100){const part=await checked(q.range(offset,offset+99));result.push(...part);if(part.length<100)break}
   if(dialog!==d||uid()!==user)return;rows=result;
   d.querySelector('[data-q-body]').innerHTML='<nav><button type="button" data-q-mode="mine">Мои заявки</button>'+(viewer.role==='superadmin'?'<button type="button" data-q-mode="review">Проверка и история</button>':'')+'</nav>'+
     (mode==='mine'?'<button type="button" data-q-new>＋ Подать анкету</button>':'')+
     (rows.length?rows.map(r=>'<button class="atlas-q-row" type="button" data-q-view="'+esc(r.id)+'"><strong>'+esc(title(r.character_id))+'</strong><span>'+statuses[r.status]+' · '+new Date(r.created_at).toLocaleDateString('ru')+'</span></button>').join(''):'<p>Заявок пока нет.</p>');message('');
 }
 function form(characterId,copy){
   if(!viewer.characters.length){message('Сначала добавь персонажа в свой профиль.');return}
   const id=characterId||viewer.characters[0].id;if(!viewer.characters.some(c=>c.id===id)){message('Персонаж не добавлен в твой профиль.');return}
   clearReader();dialog.classList.remove('is-review');
   const c=local(id),content=copy||publications.get(id)?.content||c?.profile?.overview?.mainInfo||{};
   dialog.querySelector('[data-q-body]').innerHTML='<button type="button" data-q-back>← К заявкам</button><form data-q-form autocomplete="off"><label>Персонаж<select name="character">'+viewer.characters.map(c=>'<option value="'+esc(c.id)+'"'+(c.id===id?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>'+Object.entries(headerLabels).map(([k,l])=>'<label>'+l+'<input name="'+k+'" required value="'+esc(content[k]||'')+'" autocomplete="off" data-lpignore="true" data-1p-ignore></label>').join('')+'<label>Файл анкеты · PDF, DOCX, TXT<input name="file" type="file" required accept=".pdf,.docx,.txt"></label><button type="submit">Отправить на проверку</button></form>';message('');
   dialog.querySelector('[name=character]').addEventListener('change',e=>{if(confirm('Переключить персонажа? Несохранённая шапка будет сброшена.'))form(e.target.value);else e.target.value=id});
   dialog.querySelector('form').addEventListener('submit',submit);
 }
 function view(id){const r=rows.find(r=>r.id===id);if(!r)return;
   clearReader();const editable=viewer.role==='superadmin'&&r.status==='pending';dialog.classList.add('is-review');
   editorState=editable?{id:r.id,revision:r.edit_revision||0,saved:r.edited_text??'',ready:r.edited_text!=null}:null;
   dialog.querySelector('[data-q-body]').innerHTML='<button type="button" data-q-back>← К заявкам</button><div class="atlas-q-review-grid"><section class="atlas-q-request"><h3>'+esc(r.content.fullName||title(r.character_id))+'</h3><p>'+statuses[r.status]+'</p>'+Object.entries(headerLabels).filter(([k])=>r.content[k]).map(([k,l])=>'<div class="atlas-q-header-line"><small>'+l+'</small><div>'+esc(r.content[k])+'</div></div>').join('')+
   (r.file_path?'<details class="atlas-q-original" open><summary>Файл анкеты · '+esc(r.file_name||'оригинал')+'</summary><div data-q-document><p>Открываем документ…</p></div><button type="button" data-q-file="'+esc(id)+'">Открыть заново</button></details>':'<p>Файл не прикреплён.</p>')+
   (editable?'<label>Редактор текста<textarea data-q-editor rows="16" '+(editorState.ready?'':'disabled')+'>'+esc(r.edited_text||'')+'</textarea></label><small>Правки сохраняются отдельно. Оригинальный файл остаётся в заявке.</small><button type="button" data-q-save-text="'+esc(id)+'">Сохранить правки</button>':r.edited_text!=null?'<h4>Текст после проверки</h4><div class="atlas-q-text">'+esc(r.edited_text)+'</div>':'')+'</section><aside class="atlas-q-response">'+
   (editable?'<h3>Ответ администрации</h3><div class="atlas-q-actions"><button type="button" data-q-template="approved" data-q-id="'+esc(id)+'">Шаблон принятия</button><button type="button" data-q-template="rejected">Список исправлений</button></div><label>Комментарий<textarea data-q-note rows="12" placeholder="Ответ игроку…"></textarea></label><div class="atlas-q-actions"><button type="button" data-q-decision="approved" data-q-id="'+esc(id)+'">Принять анкету</button><button type="button" data-q-decision="rejected" data-q-id="'+esc(id)+'">Вернуть на доработку</button></div>':r.review_note?'<div class="atlas-q-notice '+(r.status==='approved'?'is-approved':'')+'"><span>'+(r.status==='approved'?'АТЛАС · системное уведомление':'АТЛАС · администрация')+'</span><h3>'+(r.status==='approved'?'Персонаж зарегистрирован':'Нужны исправления')+'</h3><p class="atlas-q-text">'+esc(r.review_note)+'</p></div>':'<p>Ожидает проверки администрацией.</p>')+
   (r.actor_id===uid()&&r.status!=='pending'?'<button type="button" data-q-copy="'+esc(id)+'">Подать исправленную анкету</button>':'')+'</aside></div>';message('');
   if(r.file_path)openAttached(r).catch(err=>message(err.message));else if(editable){editorState.ready=true;dialog.querySelector('[data-q-editor]').disabled=false}
 }
 async function openAttached(row){
   let host=dialog?.querySelector('[data-q-document]');if(!host)return;const fresh=host.cloneNode(false);host.replaceWith(fresh);host=fresh;const d=dialog,user=uid(),version=++readerEpoch;
   reader?.destroy();reader=null;host.innerHTML='<p>Открываем документ…</p>';
   try{const blob=await checked(client().storage.from('atlas-questionnaires').download(row.file_path));
     if(version!==readerEpoch||dialog!==d||uid()!==user)return;
     const module=await import(documentModule),opened=await module.openDocument(blob,row.file_name,host);
     if(version!==readerEpoch||dialog!==d||uid()!==user){opened.destroy();return}reader=opened;
     const text=dialog.querySelector('[data-q-editor]');if(text&&editorState&&!editorState.ready){text.value=row.edited_text??opened.text;editorState.saved=text.value;editorState.ready=true;text.disabled=false}
   }catch(err){if(version===readerEpoch&&dialog===d){host.textContent='Не удалось открыть файл: '+(err.message||'проверь соединение')+'. Можно повторить открытие.';}throw err}
 }
 async function submit(e){e.preventDefault();if(busy)return;const f=e.target,user=uid();if(!user||viewer.id!==user)return;
   const id=f.elements.character.value,content=Object.fromEntries(Object.keys(headerLabels).map(k=>[k,f.elements[k].value.trim()])),file=f.elements.file.files[0];
   if(!file||Object.values(content).some(v=>!v)){message('Заполни шапку и прикрепи файл анкеты.');return}
   const ext=file?.name.split('.').pop().toLowerCase(),types={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'};
   if(file&&!types[ext]){message('Выбери PDF, DOCX или TXT.');return}lock(true);message('Отправляем…');
   try{
     let path=null;if(file){path=user+'/'+crypto.randomUUID()+'.'+ext;await checked(client().storage.from('atlas-questionnaires').upload(path,file,{contentType:types[ext],upsert:false}))}
     if(uid()!==user)throw Error('Аккаунт изменился. Открой форму заново.');
     await checked(client().from('atlas_questionnaire_submissions').insert({character_id:id,actor_id:user,content,file_path:path,file_name:file?.name||''}));
     if(uid()!==user)return;await showList();message('Анкета отправлена на проверку.');
   }catch(err){message(err.code==='23505'?'Для этого персонажа уже есть анкета на проверке.':err.message||'Не удалось отправить анкету.')}
   finally{lock(false)}
 }
 document.addEventListener('click',async e=>{
   const b=e.target.closest('button');if(!b)return;const d=b.dataset;
   try{
     if('qLaunch' in d){if(!uid()||busy)return;const user=uid();await loadViewer();if(uid()!==user)return;shell();mode='mine';if(d.qLaunch)form(d.qLaunch);else await showList()}
     else if('qClose' in d)close();else if('qBack' in d){if(mayLeave())await showList()}
     else if(d.qMode){mode=d.qMode==='review'&&viewer.role==='superadmin'?'review':'mine';await showList()}
     else if('qNew' in d)form();else if(d.qView)view(d.qView);
     else if(d.qCopy){const r=rows.find(r=>r.id===d.qCopy);if(r)form(r.character_id,r.content)}
     else if(d.qFile){const r=rows.find(r=>r.id===d.qFile);if(r?.file_path)await openAttached(r)}
     else if(d.qPublicFile){const r=publications.get(d.qPublicFile);if(r?.file_path){shell();dialog.classList.add('is-review');dialog.querySelector('[data-q-body]').innerHTML='<h3>'+esc(r.content.fullName||title(r.character_id))+'</h3>'+(r.document_text!=null?'<div class="atlas-q-text">'+esc(r.document_text)+'</div><h4>Оригинальный файл</h4>':'')+'<div data-q-document></div>';await openAttached(r)}}
     else if(d.qTemplate){const note=dialog.querySelector('[data-q-note]');if(note.value&&!confirm('Заменить текущий комментарий шаблоном?'))return;const r=rows.find(r=>r.id===d.qId);note.value=d.qTemplate==='approved'?acceptance(r?.content.fullName||title(r?.character_id)):corrections;note.focus()}
     else if(d.qSaveText&&!busy){if(!editorState?.ready){message('Сначала дождись открытия текста анкеты.');return}const state=editorState,text=dialog.querySelector('[data-q-editor]').value,user=uid();lock(true);try{const revision=await checked(client().rpc('atlas_save_questionnaire_text',{p_id:state.id,p_text:text,p_revision:state.revision}));if(uid()!==user||editorState!==state)return;state.revision=revision;state.saved=text;const r=rows.find(r=>r.id===state.id);Object.assign(r,{edited_text:text,edit_revision:revision});message('Правки сохранены. Публикация — после принятия анкеты.')}finally{lock(false)}}
     else if(d.qDecision&&!busy){
       if(d.qDecision==='approved'&&!editorState?.ready){message('Дождись открытия файла перед принятием анкеты.');return}let note=dialog.querySelector('[data-q-note]').value.trim();const user=uid(),r=rows.find(r=>r.id===d.qId);if(d.qDecision==='approved'&&!note)note=acceptance(r.content.fullName||title(r.character_id));if(d.qDecision==='rejected'&&note===corrections.trim()){message('Заполни пункты, которые нужно исправить.');return}if(d.qDecision==='rejected'&&!note){message('Укажи причину отклонения.');return}
       lock(true);try{await checked(client().rpc('atlas_decide_questionnaire',{p_id:d.qId,p_decision:d.qDecision,p_note:note,p_text:editorState?.ready?dialog.querySelector('[data-q-editor]').value:null,p_revision:editorState?.revision??r.edit_revision??0}));if(uid()!==user)return;await loadPublic();await showList();message(d.qDecision==='approved'?'Анкета опубликована.':'Заявка отклонена.');const current=document.getElementById('atlasCharacterProfileRoot')?.dataset.communityId;if(current&&document.getElementById('atlas-page-character-profile')?.classList.contains('active'))window.atlasOpenCharacter?.(current)}finally{lock(false)}
     }
   }catch(err){message(err.message||'Не удалось выполнить действие.')}
 });
 window.atlasMountQuestionnaires=mount;window.atlasHydrateQuestionnaire=hydrate;
 window.addEventListener('atlasPlayerAuthReady',()=>{busy=false;editorState=null;close();rows=[];++epoch;loadViewer().catch(()=>{});loadPublic().catch(()=>{})});
 window.addEventListener('atlasCharactersReady',()=>loadPublic().catch(()=>{}));
 loadViewer().catch(()=>{});loadPublic().catch(()=>{});
})();
