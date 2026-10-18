(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function formatBody(value) {
    return esc(value).split('\n').map(line => {
      const quote = line.startsWith('&gt; ');
      if (quote) line = line.slice(5);
      line = line.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/_([^_\n]+)_/g, '<em>$1</em>');
      return quote ? '<span class="social-quote">' + line + '</span>' : line;
    }).join('\n');
  }
  function validFiles(files, count = 0) {
    if (files.length + count > 6) throw new Error('Можно прикрепить до 6 фотографий.');
    if (files.some(f => !['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(f.type)))
      throw new Error('Выбери фотографии JPG, PNG, WebP, GIF или AVIF.');
    return files;
  }
  function identity(kind, selection, actor, isStaff = false) {
    if (kind === 'chat') return {author_kind:'player', character_id:null, actor_id:actor};
    if (selection === 'atlas') {
      if (!isStaff || !['topic','reply'].includes(kind)) throw new Error('Выбери своего персонажа.');
      return {author_kind:'atlas', character_id:null, actor_id:actor};
    }
    if (!selection) throw new Error('Сначала выбери персонажа.');
    return {author_kind:'character', character_id:selection, actor_id:actor};
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {esc, formatBody, validFiles, identity}; return; }

  const pages = {
    muro: {kind:'feed', title:'muro', subtitle:''},
    debates: {kind:'topic', title:'debates', subtitle:''}
  };
  const client = () => window.ATLAS_SUPABASE;
  const uid = () => window.ATLAS_CURRENT_SESSION?.user?.id || '';
  const checked = async query => { const r = await query; if (r.error) throw r.error; return r.data || []; };
  const staff = () => ['admin','superadmin'].includes(state.profile?.role);
  const localCharacter = id => [...(window.ATLAS_CHARACTERS || []), ...(window.ATLAS_CHARACTER_DIRECTORY || []), ...(window.ATLAS_CARD_ONLY || [])].find(c => c.id === id) || {};
  const characterName = (id, fallback) => window.atlasCharacterDisplayName?.(id, fallback) || localCharacter(id).name || fallback || id;
  const safeURL = value => { if (!value || typeof value !== 'string') return ''; try { const u = new URL(value, location.href); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; } };
  let state = {page:'', root:null, user:'', version:0, profile:null, characters:[], rows:[], files:[], previews:[], topic:null, filter:'all', channel:null, busy:false, loading:false, more:false};
  let refreshTimer, pollTimer;
  let editImages = [], editFiles = [], editURLs = [], editSaving = false;
  function clearEditFiles(){ editURLs.forEach(URL.revokeObjectURL); editURLs=[]; editFiles=[]; editImages=[]; }
  function drawEditPhotos(){
    editURLs.forEach(URL.revokeObjectURL); editURLs=editFiles.map(URL.createObjectURL);
    const urls=editImages.map(p=>client().storage.from('atlas-media').getPublicUrl(p).data.publicUrl).concat(editURLs);
    $('[data-edit-previews]').innerHTML=urls.map((url,i)=>'<div><img src="'+esc(url)+'" alt="Фото '+(i+1)+'"><button type="button" data-edit-remove="'+i+'" aria-label="Убрать фото '+(i+1)+'">×</button></div>').join('');
  }
  const currentKind = () => state.topic ? 'reply' : pages[state.page]?.kind;
  const valid = version => version === state.version && state.user === uid();
  const $ = selector => state.root?.querySelector(selector);
  function status(message, error = false) {
    const el = $('[data-social-status]');
    if (el) { el.textContent = message; el.classList.toggle('is-error', error); }
  }
  function clearFiles() {
    state.previews.forEach(URL.revokeObjectURL); state.files = []; state.previews = [];
  }
  function stop() {
    clearTimeout(refreshTimer); clearInterval(pollTimer);
    if (state.channel) client()?.removeChannel(state.channel);
    state.channel = null;
  }
  function header() {
    const page = pages[state.page];
    return '<header class="social-heading"><div><span class="social-kicker">ATLAS · comunidad</span><h2>' + page.title + '</h2>' + (page.subtitle ? '<p>'+page.subtitle+'</p>' : '') + '</div><button type="button" data-social-refresh title="Обновить" aria-label="Обновить">↻</button></header>';
  }
  function composer() {
    const kind = currentKind();
    if (['feed','reply','topic'].includes(kind) && !state.characters.length && !(['topic','reply'].includes(kind) && staff()))
      return '<p class="social-note">Добавь персонажа в <button type="button" data-open-page="mi-atlas">mi atlas</button>, чтобы публиковать здесь.</p>';
    const player = state.profile?.display_name || state.profile?.nickname || 'игрок';
    let author = kind === 'chat' ? '<span class="social-author-label">' + esc(player) + ' <small>· профиль игрока</small></span>' :
      '<label class="social-select"><span>от имени</span><select name="character" aria-label="Автор публикации">' + state.characters.map(c => '<option value="' + esc(c.id) + '">' + esc(characterName(c.id, c.name)) + '</option>').join('') + (['topic','reply'].includes(kind) && staff() ? '<option value="atlas">АТЛАС · администрация</option>' : '') + '</select></label>';
    return '<form class="social-composer" autocomplete="off"><div class="social-composer-head">' + author + '</div>' + (kind === 'feed' ? '<label class="social-story-date">Дата публикации<input type="datetime-local" name="story_at" aria-label="Дата публикации" value="'+localDate(new Date())+'"></label>' : '') +
      (kind === 'topic' ? '<input name="title" maxlength="160" required placeholder="Название обсуждения" aria-label="Название обсуждения" autocomplete="off">' : '') +
      '<div class="social-toolbar" aria-label="Форматирование"><button type="button" data-format="bold" aria-label="Жирный текст"><b>B</b></button><button type="button" data-format="italic" aria-label="Курсив"><i>i</i></button><button type="button" data-format="quote" aria-label="Цитата">❞</button><button type="button" data-format="indent" aria-label="Отступ">⇥</button><button type="button" data-social-preview>предпросмотр</button></div>' +
      '<textarea name="body" rows="' + (kind === 'chat' ? '3' : '5') + '" placeholder="' + (kind === 'chat' ? 'Написать в общий чат…' : 'Текст поста…') + '" aria-label="Текст публикации" autocomplete="off" data-lpignore="true" data-1p-ignore></textarea><div class="social-body social-draft-preview" hidden></div>' +
      '<div class="social-previews"></div><div class="social-composer-footer"><label class="social-file">＋ фото<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple aria-label="Прикрепить до 6 фото"></label><small>до 6 фото</small><button class="social-primary" type="submit">' + (kind === 'chat' ? 'отправить' : 'опубликовать') + '</button></div><p data-social-status role="status"></p></form>';
  }
  function localDate(value){const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
  function frame() {
    const chat = currentKind() === 'chat';
    const topicList = currentKind() === 'topic';
    state.root.innerHTML = header() + (state.page==='muro'&&!state.topic?'<nav class="social-feed-tabs" aria-label="Публикации"><button type="button" data-social-filter="all" aria-pressed="'+(state.filter==='all')+'">Все посты</button><button type="button" data-social-filter="mine" aria-pressed="'+(state.filter==='mine')+'">Мои</button></nav>':'') + (state.topic ? '<button type="button" class="social-back" data-social-back>← '+(state.page==='muro'?'все посты':'все обсуждения')+'</button><div data-social-topic></div>' : '') +
      (topicList ? '<details class="social-new-topic"><summary>＋ создать тему</summary>' + composer() + '</details>' : (!chat && !state.topic ? composer() : '')) + '<div class="social-stream" data-social-stream aria-live="polite"></div><button type="button" class="social-more" data-social-more hidden>показать ещё</button>' + (chat || state.topic ? composer() : '') +
      '<dialog class="social-lightbox"><button type="button" data-social-close aria-label="Закрыть фотографию">×</button><img alt="Фотография в оригинальном качестве"><a target="_blank" rel="noopener">открыть оригинал ↗</a></dialog><dialog class="social-edit"><form><h3>Редактировать</h3><input name="title" maxlength="160" aria-label="Название темы"><label class="social-story-date" data-edit-date>Дата публикации<input type="datetime-local" name="story_at" aria-label="Дата публикации"></label><textarea name="body" rows="8" aria-label="Текст публикации"></textarea><section data-edit-photos hidden><label class="social-file">＋ добавить фото<input type="file" data-edit-file accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple aria-label="Добавить фотографии к заглавному посту"></label><small> до 6 фото</small><div class="social-previews" data-edit-previews></div></section><p role="status"></p><div><button type="button" data-social-cancel>отмена</button><button type="submit" class="social-primary">сохранить</button></div></form></dialog>';
    if (state.topic) $('[data-social-topic]').innerHTML = article(state.topic);
    state.root.querySelector('.social-composer')?.addEventListener('submit', publish);
    state.root.querySelector('.social-edit form')?.addEventListener('submit', saveEdit);
    $('.social-edit').addEventListener('cancel', e=>{if(editSaving)e.preventDefault()});
    $('.social-edit').addEventListener('close', clearEditFiles);
    $('[data-edit-file]').addEventListener('change',e=>{
      try { editFiles.push(...validFiles(Array.from(e.target.files),editImages.length+editFiles.length));drawEditPhotos();$('.social-edit [role=status]').textContent=''; }
      catch(err){$('.social-edit [role=status]').textContent=err.message}
      e.target.value='';
    });
    $('.social-composer [type=file]')?.addEventListener('change', e => {
      try { state.files.push(...validFiles(Array.from(e.target.files), state.files.length)); drawPreviews(); status(''); }
      catch (err) { status(err.message, true); }
      e.target.value = '';
    });
  }
  function drawPreviews() {
    state.previews.forEach(URL.revokeObjectURL); state.previews = state.files.map(URL.createObjectURL);
    $('.social-previews').innerHTML = state.previews.map((url,i) => '<div><img src="' + url + '" alt="Фото ' + (i+1) + '"><button type="button" data-social-remove="' + i + '" aria-label="Убрать фото ' + (i+1) + '">×</button></div>').join('');
  }
  function author(row) {
    if (row.author_kind === 'atlas') return {name:'АТЛАС', sub:'администрация', avatar:'', attr:''};
    if (row.author_kind === 'player') return {name:row.player?.display_name || row.player?.nickname || 'игрок', sub:row.player?.nickname ? '@' + row.player.nickname : 'игрок', avatar:row.player?.avatar_url, attr:'data-social-player="' + esc(row.actor_id) + '"'};
    const c = localCharacter(row.character_id);
    return {name:characterName(row.character_id, row.character?.name), sub:'персонаж', avatar:c.avatar || c.cardImage || c.image || c.card?.image, attr:'data-social-character="' + esc(row.character_id) + '"'};
  }
  function article(row) {
    const a = author(row), avatar = safeURL(a.avatar || ''), own = row.actor_id === state.user;
    const images = row.images || [];
    const published = row.story_at || row.created_at;
    return '<article class="social-post' + (row.author_kind === 'atlas' ? ' is-atlas' : '') + '" data-social-id="' + esc(row.id) + '"><header><button type="button" class="social-author" ' + a.attr + '><span class="social-avatar">' + (avatar ? '<img src="' + esc(avatar) + '" loading="lazy" alt="">' : esc(a.name.slice(0,1))) + '</span><span><strong>' + esc(a.name) + '</strong><small>' + esc(a.sub) + '</small></span></button><time datetime="' + esc(published) + '">' + esc(new Date(published).toLocaleString('ru-RU',{year:'numeric',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})) + (row.edited_at ? ' · изм.' : '') + '</time></header>' +
      (row.title ? '<h3>' + esc(row.title) + '</h3>' : '') + '<div class="social-body">' + formatBody(row.body) + '</div>' +
      (images.length ? '<div class="social-gallery social-gallery-' + images.length + '">' + images.map((path,i) => {
        const url = client().storage.from('atlas-media').getPublicUrl(path).data.publicUrl;
        return '<button type="button" data-social-photo="' + esc(url) + '" aria-label="Открыть фото ' + (i+1) + '"><img src="' + esc(url) + '" alt="Фото ' + (i+1) + '" loading="lazy" decoding="async"></button>';
      }).join('') + '</div>' : '') + '<footer>' +
      (row.kind === 'topic' && !state.topic ? '<button type="button" class="social-primary" data-social-topic-open="' + row.id + '">открыть обсуждение →</button>' : '') +
      (row.kind==='feed'&&!state.topic?'<button type="button" data-social-topic-open="'+row.id+'">Комментарии →</button>':'') +
      (own ? '<button type="button" data-social-edit="' + row.id + '">изменить</button>' : '') +
      (own || staff() ? '<button type="button" data-social-delete="' + row.id + '">удалить</button>' : '') + '</footer></article>';
  }
  function topicCard(row) {
    const a = author(row);
    return '<button type="button" class="social-topic-card" data-social-topic-open="'+esc(row.id)+'"><span class="social-topic-icon">≋</span><span><strong>'+esc(row.title)+'</strong><small>'+esc(a.name)+' · '+esc(new Date(row.created_at).toLocaleDateString('ru-RU'))+'</small><span class="social-topic-excerpt">'+esc(row.body.replace(/[*_>]/g,'').slice(0,160))+'</span></span><span aria-hidden="true">→</span></button>';
  }
  const fields = '*,player:profiles!actor_id(id,nickname,display_name,avatar_url),character:atlas_character_catalog!character_id(id,name)';
  function queryEntries() {
    let q = client().from('atlas_social_entries').select(fields).eq('kind', currentKind());
    if (state.topic) q = q.eq('parent_id', state.topic.id);
    else if(state.page==='muro'&&state.filter==='mine')q=q.eq('actor_id',state.user);
    return q;
  }
  async function loadMore(reset = false) {
    if (state.loading) return;
    const version = state.version, ascending = false;
    state.loading = true;
    const button = $('[data-social-more]'); if (button) button.disabled = true;
    try {
      let q = queryEntries().order('created_at',{ascending}).order('id',{ascending}).limit(30);
      if (!reset && state.rows.length) {
        const row = state.rows[state.rows.length-1], op = ascending ? 'gt' : 'lt';
        q = q.or('created_at.' + op + '.' + row.created_at + ',and(created_at.eq.' + row.created_at + ',id.' + op + '.' + row.id + ')');
      }
      const rows = await checked(q);
      if (!valid(version)) return;
      state.rows = reset ? rows : [...state.rows, ...rows]; state.more = rows.length === 30;
      drawStream();
    } catch (err) { if (valid(version)) { const stream = $('[data-social-stream]'); if (!state.rows.length && stream) stream.textContent = 'Не удалось загрузить публикации. ' + err.message; status(err.message, true); } }
    finally { if (valid(version)) { state.loading = false; if (button) button.disabled = false; } }
  }
  function drawStream() {
    const rows = ['chat','reply'].includes(currentKind()) ? [...state.rows].reverse() : state.rows;
    $('[data-social-stream]').innerHTML = rows.length ? rows.map(currentKind() === 'topic' ? topicCard : article).join('') : '<div class="social-empty"><span>✦</span><p>' + (currentKind() === 'topic' ? 'Пока нет тем.' : currentKind() === 'reply' ? 'Пока нет ответов.' : 'Пока нет публикаций.') + '</p></div>';
    $('[data-social-more]').hidden = !state.more;
    $('[data-social-more]').textContent = ['chat','reply'].includes(currentKind()) ? 'предыдущие сообщения' : 'показать ещё';
  }
  async function refresh() {
    // Refresh only the currently loaded window; never download the whole history.
    if (state.loading || !state.user || document.hidden) return;
    const version = state.version, ascending = false;
    state.loading = true;
    try {
      const rows = await checked(queryEntries().order('created_at',{ascending}).order('id',{ascending}).limit(Math.max(30,state.rows.length)));
      if (!valid(version)) return;
      if (JSON.stringify(rows) !== JSON.stringify(state.rows)) { state.more = rows.length >= Math.max(30,state.rows.length); state.rows = rows; drawStream(); }
    } catch (err) { if (valid(version)) status('Не удалось обновить. ' + err.message, true); }
    finally { if (valid(version)) state.loading = false; }
  }
  function subscribe() {
    stop();
    const filter = state.topic ? 'parent_id=eq.' + state.topic.id : 'kind=eq.' + currentKind();
    state.channel = client().channel('social-' + state.page + '-' + state.version).on('postgres_changes', {event:'*',schema:'public',table:'atlas_social_entries',filter}, () => {
      clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh,350);
    }).subscribe();
    // Also recovers missed events after sleep/reconnection and DELETE filter limitations.
    pollTimer = setInterval(refresh,30000);
  }
  async function activate(page, force = false) {
    window.atlasRenderPlayerMessenger?.(page,force);
    if (!pages[page]) { if (state.page) { stop(); clearFiles(); ++state.version; state.page = ''; } return; }
    const root = document.querySelector('#atlas-page-' + page + ' .social-root');
    if (!root || (!force && state.page === page && state.user === uid())) return;
    stop(); clearFiles();
    state = {...state,page,root,user:uid(),version:state.version+1,rows:[],topic:null,loading:false,busy:false,more:false,characters:[],profile:null};
    const version = state.version;
    root.innerHTML = header() + '<p class="social-note">' + (state.user ? 'Загружаем…' : 'Войди в аккаунт, чтобы читать и общаться. <button type="button" data-social-login>войти</button>') + '</p>';
    if (!state.user || !client()) return;
    try {
      const [profile, owners] = await Promise.all([
        checked(client().from('profiles').select('id,nickname,display_name,role').eq('id',state.user).single()),
        checked(client().from('character_owners').select('character_id').eq('user_id',state.user))
      ]);
      const characters = owners.length ? await checked(client().from('atlas_character_catalog').select('id,name').in('id',owners.map(o => o.character_id)).eq('active',true).order('name')) : [];
      if (!valid(version)) return;
      state.profile = profile; state.characters = characters;
      frame(); await loadMore(true); if (valid(version)) subscribe();
    } catch (err) { if (valid(version)) root.innerHTML = header() + '<p class="social-note">Не удалось загрузить раздел: ' + esc(err.message) + '</p>'; }
  }
  async function publish(event) {
    event.preventDefault(); if (state.busy) return;
    const form = event.currentTarget, body = form.elements.body.value, title = form.elements.title?.value.trim() || '';
    if (currentKind() !== 'topic' && !body.trim() && !state.files.length) { status('Добавь текст или фотографию.', true); return; }
    const version = state.version, actor = state.user, kind = currentKind(), parent = state.topic?.id || null;
    const files = [...state.files], uploaded = [];
    let committed = false;
    state.busy = true; form.querySelector('[type=submit]').disabled = true;
    try {
      const selection=form.elements.character?.value;
      if (kind !== 'chat' && !(selection==='atlas' && ['topic','reply'].includes(kind) && staff()) && !state.characters.some(c=>c.id===selection)) throw new Error('Выбери персонажа, добавленного в свой профиль.');
      const author = identity(kind,selection,actor,staff());
      Array.from(form.elements).forEach(control => { control.disabled = true; });
      for (let i=0;i<files.length;i++) {
        if (!valid(version)) throw new Error('Аккаунт или раздел изменился. Публикация отменена.');
        status('Загружаем оригинал ' + (i+1) + ' из ' + files.length + '…');
        const file = files[i], ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}[file.type];
        const path = actor + '/social/' + crypto.randomUUID() + '.' + ext;
        await checked(client().storage.from('atlas-media').upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false}));
        uploaded.push(path);
      }
      if (!valid(version)) throw new Error('Аккаунт или раздел изменился. Публикация отменена.');
      await checked(client().from('atlas_social_entries').insert({kind,parent_id:parent,...author,title,body,images:uploaded,...(kind==='feed'?{story_at:form.elements.story_at.value||null}:{})}));
      committed = true;
      if (valid(version)) {
        form.elements.body.value = ''; if (form.elements.title) form.elements.title.value = '';
        clearFiles(); drawPreviews(); $('.social-draft-preview').hidden = true; status('Опубликовано.');
        await loadMore(true);
      }
    } catch (err) {
      if (!committed && uploaded.length && uid() === actor) await client().storage.from('atlas-media').remove(uploaded);
      if (valid(version)) status(err.message || 'Не удалось опубликовать.', true);
    } finally { if (valid(version)) { state.busy = false; Array.from(form.elements).forEach(control => { control.disabled = false; }); } }
  }
  function rowById(id) { return state.rows.find(r => r.id === id) || (state.topic?.id === id ? state.topic : null); }
  async function openTopic(id) {
    const row = rowById(id); if (!row) return;
    stop(); clearFiles(); ++state.version; state.topic = row; state.rows = []; state.loading = false; state.more = false;
    const version = state.version; frame(); await loadMore(true); if (!valid(version)) return; subscribe(); state.root.scrollIntoView({block:'start',behavior:'smooth'});
  }
  async function saveEdit(event) {
    event.preventDefault(); const form = event.currentTarget, dialog = form.closest('dialog'), version = state.version;
    const row = rowById(dialog.dataset.id); if (!row) return;
    if(editSaving)return;
    const patch = {body:form.elements.body.value};
    if(row.kind==='feed')patch.story_at=form.elements.story_at.value||null;
    const files=[...editFiles], retained=[...editImages], actor=state.user, uploaded=[];
    let attempted=false;
    editSaving=true;Array.from(form.elements).forEach(x=>x.disabled=true);
    try {
      if(row.kind==='topic'){
        patch.title=form.elements.title.value.trim();
        validFiles(files,retained.length);
        for(let i=0;i<files.length;i++){
          if(!valid(version))throw new Error('Раздел или аккаунт изменился.');
          form.querySelector('[role=status]').textContent='Загружаем фото '+(i+1)+' из '+files.length+'…';
          const file=files[i],ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}[file.type];
          const path=actor+'/social/'+crypto.randomUUID()+'.'+ext;
          await checked(client().storage.from('atlas-media').upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false}));
          uploaded.push(path);
        }
        patch.images=retained.concat(uploaded);
      }
      if(!valid(version))throw new Error('Раздел или аккаунт изменился.');
      attempted=true;
      const changed = await checked(client().from('atlas_social_entries').update(patch).eq('id',row.id).select(fields).single());
      if (!valid(version)) return;
      if (state.topic?.id === row.id) { state.topic = changed; $('[data-social-topic]').innerHTML = article(changed); }
      else state.rows = state.rows.map(r => r.id === row.id ? changed : r);
      dialog.close(); drawStream();
    } catch (err) {
      if(!attempted && uploaded.length && uid()===actor)await client().storage.from('atlas-media').remove(uploaded);
      if(valid(version))form.querySelector('[role=status]').textContent=err.message;
    } finally { editSaving=false;Array.from(form.elements).forEach(x=>x.disabled=false); }
  }
  document.addEventListener('click', async event => {
    if (!state.root?.contains(event.target)) return;
    const button = event.target.closest('button');
    if (!button) return;
    const data = button.dataset;
    if ('socialRefresh' in data) { if (!state.profile) activate(state.page,true); else refresh(); }
    else if ('socialLogin' in data) document.getElementById('atlasAccountButton')?.click();
    else if ('socialMore' in data) loadMore();
    else if ('socialBack' in data) activate(state.page,true);
    else if(data.socialFilter){if(state.busy)return;const draft=$('.social-composer'),values=draft?Object.fromEntries([...draft.elements].filter(e=>e.name&&e.type!=='file').map(e=>[e.name,e.value])):{};state.filter=data.socialFilter;stop();++state.version;state.rows=[];state.loading=false;const version=state.version;frame();for(const [name,value] of Object.entries(values)){const field=$('.social-composer')?.elements[name];if(field)field.value=value}if(state.files.length)drawPreviews();await loadMore(true);if(valid(version))subscribe();}
    else if (data.socialTopicOpen) openTopic(data.socialTopicOpen);
    else if (data.socialPlayer) window.atlasOpenPlayerProfile?.(data.socialPlayer);
    else if (data.socialCharacter) window.atlasOpenCharacter?.(data.socialCharacter);
    else if ('socialRemove' in data && !state.busy) { state.files.splice(Number(data.socialRemove),1); drawPreviews(); }
    else if (data.socialPhoto) { const dialog = $('.social-lightbox'); dialog.querySelector('img').src = data.socialPhoto; dialog.querySelector('a').href = data.socialPhoto; dialog.showModal(); }
    else if ('socialClose' in data) $('.social-lightbox').close();
    else if ('socialCancel' in data && !editSaving) $('.social-edit').close();
    else if ('editRemove' in data && !editSaving) { const i=Number(data.editRemove); if(i<editImages.length)editImages.splice(i,1);else editFiles.splice(i-editImages.length,1);drawEditPhotos(); }
    else if (data.socialEdit) {
      const row = rowById(data.socialEdit), dialog = $('.social-edit'), form = dialog.querySelector('form');
      clearEditFiles();editImages=[...(row.images||[])];$('[data-edit-photos]').hidden=row.kind!=='topic';drawEditPhotos();
      dialog.dataset.id = row.id; form.elements.body.value = row.body; form.elements.title.value = row.title;
      form.elements.title.hidden = row.kind !== 'topic'; $('[data-edit-date]').hidden=row.kind!=='feed';form.elements.story_at.value=row.story_at?row.story_at.slice(0,16):localDate(row.created_at); form.querySelector('[role=status]').textContent = ''; dialog.showModal();
    } else if (data.socialDelete) {
      const row = rowById(data.socialDelete), version = state.version;
      if (!row || !confirm(row.kind === 'topic' ? 'Удалить тему вместе со всеми ответами?' : 'Удалить публикацию?')) return;
      button.disabled = true;
      try {
        const removed = await checked(client().from('atlas_social_entries').delete().eq('id',row.id).select('id'));
        if (!removed.length) throw new Error('Нет прав на удаление.');
        // Originals are retained: deleting a topic must not remove images referenced elsewhere.
        if (!valid(version)) return;
        if (state.topic?.id === row.id) activate(state.page,true);
        else { state.rows = state.rows.filter(r => r.id !== row.id); drawStream(); }
      } catch (err) { if (valid(version)) { alert(err.message); button.disabled = false; } }
    } else if (data.format) {
      const text = $('.social-composer textarea'), start = text.selectionStart, end = text.selectionEnd, selected = text.value.slice(start,end) || 'текст';
      const wrapped = data.format === 'bold' ? '**' + selected + '**' : data.format === 'italic' ? '_' + selected + '_' : selected.split('\n').map(line => (data.format === 'quote' ? '> ' : '    ') + line).join('\n');
      text.setRangeText(wrapped,start,end,'select'); text.focus();
    } else if ('socialPreview' in data) {
      const preview = $('.social-draft-preview'); preview.innerHTML = formatBody($('.social-composer textarea').value); preview.hidden = !preview.hidden;
    }
  });
  window.atlasRenderSocial = activate;
  window.addEventListener('atlasPlayerAuthReady', () => { const page = document.querySelector('.atlas-page.active')?.id.replace('atlas-page-',''); if (pages[page]) activate(page,true); });
  document.addEventListener('visibilitychange', () => { if (state.page && !document.hidden) refresh(); });
  activate(document.querySelector('.atlas-page.active')?.id.replace('atlas-page-',''));
})();
