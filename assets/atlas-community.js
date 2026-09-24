(function () {
  'use strict';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client = () => window.ATLAS_SUPABASE;
  const uid = () => window.ATLAS_CURRENT_SESSION?.user?.id || '';
  const character = id => (window.ATLAS_CHARACTERS || []).find(c => c.id === id);
  let rosterCatalog = [];
  const allCharacters = () => {
    const base = [...(window.ATLAS_CHARACTERS || []), ...(window.ATLAS_CARD_ONLY || [])];
    const seen = new Set(base.map(c => c.id));
    return base.concat(rosterCatalog.filter(c => !seen.has(c.id)));
  };
  const name = c => c?.fullName || c?.name || c?.cardName || c?.id || '';
  const rosterName = c => window.ATLAS_CHARACTER_NAMES_RU?.[c?.id] || c?.nameRu || name(c);
  const groups = {family:'семья',friends:'друзья',love:'любовь',tension:'сложные отношения',plot:'сюжетные связи',colleagues:'коллеги',students:'студенты'};
  const link = p => p ? '<button type="button" class="atlas-community-link" data-community-player="'+esc(p.id)+'">'+esc(p.display_name || p.nickname)+' · @'+esc(p.nickname)+'</button>' : '<span>игрок не привязан</span>';
  let owners = [], profiles = [], ownersAt = 0, ownersPending = null, ownerEpoch = 0;
  let teams = [], members = [], rosterAllowed = false, rosterAllowedFor = null, rosterAccessVersion = 0, editor = null, modalReturnFocus = null;
  const custom = new Map();
  const pendingCustom = new Map();

  async function checked(query) {
    const r = await query;
    if (r.error) throw r.error;
    return r.data;
  }
  async function read(query) {
    let timer;
    try {
      return await Promise.race([checked(query),new Promise((_,reject) => { timer=setTimeout(() => reject(new Error('Сервер не ответил. Обновите страницу и попробуйте ещё раз.')),20000); })]);
    } finally { clearTimeout(timer); }
  }
  function errorText(err) {
    if (err?.code === '23505') return 'Запись уже изменена или капитан этой команды уже назначен. Обновите состав и проверьте данные.';
    if (err?.code === '42501') return 'Нет прав на сохранение. Проверьте, что вы вошли в нужный аккаунт.';
    if (err?.code === 'PGRST205' || err?.code === 'PGRST202' || err?.code === '42P01') return 'Обновление базы ещё не установлено. Обратитесь к администратору.';
    return err?.message || 'Не удалось сохранить изменения. Попробуйте ещё раз.';
  }
  async function loadOwners(force = false) {
    if (!client()) return;
    if (!force && Date.now() - ownersAt < 30000) return;
    if (ownersPending) return force ? ownersPending.then(() => loadOwners(true)) : ownersPending;
    const epoch = ownerEpoch;
    ownersPending = Promise.all([
      read(client().from('character_owners').select('character_id,user_id')),
      read(client().from('profiles').select('id,nickname,display_name'))
    ]).then(([o,p]) => {
      if (epoch !== ownerEpoch) return;
      owners = o || []; profiles = p || []; ownersAt = Date.now();
      decorateCards();
    }).finally(() => { ownersPending = null; });
    return ownersPending;
  }
  function owner(id) {
    return profiles.find(p => p.id === owners.find(o => o.character_id === id)?.user_id);
  }
  function cardCharacter(id) {
    return character(id) || (window.ATLAS_CARD_ONLY || []).find(c => c.id === id);
  }
  function staticPlayer(c) {
    const record = (window.ATLAS_CHARACTER_DIRECTORY || []).find(r => r.id === c.id);
    const candidates = [c.player, c.profile?.player, c.owner, c.profile?.owner, record?.player];
    for (const item of candidates) {
      if (!item) continue;
      if (typeof item === 'string') {
        const raw = item.trim();
        if (!raw) continue;
        const tagged = raw.match(/^(.*?)\s*[·•\-–—,/]\s*@([\w.-]+)$/u);
        if (tagged) {
          return {name: tagged[1].trim(), nickname: tagged[2].trim().replace(/^@+/, ''), url: ''};
        }
        if (raw.startsWith('@')) return {name: '', nickname: raw.replace(/^@+/, ''), url: ''};
        return {name: raw, nickname: '', url: ''};
      }
      const name = String(item.name || item.display_name || '').trim();
      const nickname = String(item.nickname || item.id || '').trim().replace(/^@+/, '');
      const url = String(item.url || '').trim();
      if (name || nickname) return {name, nickname, url};
    }
    return null;
  }
  function playerInlineParts(name, nickname) {
    const safeName = String(name || '').trim();
    const safeNick = String(nickname || '').trim().replace(/^@+/, '');
    const bits = [];
    if (safeName) bits.push('<span class="atlas-card-player-name">'+esc(safeName)+'</span>');
    if (safeName && safeNick) bits.push('<span class="atlas-card-player-sep">·</span>');
    if (safeNick) bits.push('<span class="atlas-card-player-nick">@'+esc(safeNick)+'</span>');
    return bits.join('');
  }
  function compactFaculty(value) {
    const raw = String(value || '').trim();
    const key = raw.toLowerCase();
    const map = [
      [/спортивной аналитики, управления, права и агентской деятельности/i,'аналитика и менеджмент'],
      [/спортивной аналитики и менеджмента/i,'аналитика и менеджмент'],
      [/спортивной аналитики$/i,'спортивная аналитика'],
      [/спортивной журналистики и медиа/i,'журналистика и медиа'],
      [/спортивной медицины и реабилитации/i,'медицина и реабилитация'],
      [/спортивной психологии/i,'спортивная психология'],
      [/индивидуальных видов спорта/i,'индивидуальные виды спорта'],
      [/(?:тактики и )?игровых видов спорта/i,'игровые виды спорта'],
      [/(?:тактики и )?командных видов спорта/i,'командные виды спорта']
    ];
    for (const [rx,label] of map) if (rx.test(key)) return label;
    return raw.replace(/^факультет\s+/i,'');
  }
  function compactDepartment(value) {
    const raw = String(value || '').trim();
    const key = raw.toLowerCase();
    const map = [
      [/спортивного права и агентской деятельности/i,'спортправо и агентство'],
      [/спортивной аналитики и статистики/i,'аналитика и статистика'],
      [/спортивной журналистики/i,'спортивная журналистика'],
      [/цифровых медиа и\s*smm/i,'digital / SMM'],
      [/физиотерапии и реабилитации/i,'физиотерапия и реабилитация'],
      [/спортивной травматологии и ортопедии/i,'травматология и ортопедия'],
      [/клинической спортивной психологии/i,'клиническая спортпсихология'],
      [/гимнастики и акробатики/i,'гимнастика и акробатика'],
      [/легкой атлетики|лёгкой атлетики/i,'лёгкая атлетика']
    ];
    for (const [rx,label] of map) if (rx.test(key)) return label;
    return raw.replace(/^кафедра\s+/i,'');
  }
  function sportMeta(value) {
    const key = String(value || '').toLowerCase();
    if (/футбол/.test(key)) return {label:'футбол',cls:'football'};
    if (/баскетбол/.test(key)) return {label:'баскетбол',cls:'basketball'};
    if (/хокке/.test(key)) return {label:'хоккей',cls:'hockey'};
    if (/волейбол/.test(key)) return {label:'волейбол',cls:'volleyball'};
    if (/теннис/.test(key)) return {label:'теннис',cls:'tennis'};
    if (/фигурн|figure skating/.test(key)) return {label:'фигурное катание',cls:'skating'};
    if (/плаван/.test(key)) return {label:'плавание',cls:'swimming'};
    if (/водн/.test(key)) return {label:'водные виды спорта',cls:'swimming'};
    return null;
  }
  function cardDetails(c) {
    const info = c.profile?.overview?.mainInfo || {};
    const student = c.category === 'estudiantes' || /^student_/.test(c.type || '');
    let faculty = String(info.faculty || c.faculty || '').trim();
    let department = String(info.department || c.department || '').trim();
    const split = faculty.match(/^(.*?)[,;]\s*(кафедра(?:\s|$).*)$/i);
    if (split) { faculty = split[1].trim(); department = department || split[2].trim(); }
    const course = String(info.course || info.year || c.course || c.year || '').trim();
    const numbered = course.match(/^([1-4])(?:\s*курс)?$/i);
    const coach = c.category === 'entrenadores';
    const explicitSports = [info.sport, info.specialization, c.sport, c.specialization, ...(c.tags || [])];
    const sport = student ? (sportMeta(department) || (!department || /зимних индивидуальных видов спорта/i.test(department) ? explicitSports.map(sportMeta).find(Boolean) : null) || null) : null;
    const badge = student ? (numbered ? numbered[1]+' КУРС' : course) :
      (coach ? 'тренер' : (c.card?.tag || c.role || ''));
    const badges = [];
    if (student && course) badges.push({label:badge, cls:'course'});
    if (sport) badges.push({label:sport.label, cls:'sport-'+sport.cls});
    if (coach) badges.push({label:badge,cls:'staff'});
    if (!student && c.category === 'castelmara') badges.push({label:'академи',cls:'academy'});
    const subtitle = String(c.cardSubtitle || c.subtitle || c.role || '').trim();
    const lines = student ? [faculty, department].filter(Boolean) :
      [subtitle.startsWith('/') ? (c.subtitle || c.role || '') : subtitle].filter(Boolean);
    let displayLines;
    if (student) {
      displayLines = [compactFaculty(faculty)];
      if (!sport && department) displayLines.push(compactDepartment(department));
    } else if (c.category === 'castelmara') {
      displayLines = [c.activity || '', c.secondaryActivity || '', department ? compactDepartment(department) : ''].filter(Boolean);
      if (!displayLines.length && subtitle) displayLines = [subtitle.startsWith('/') ? (c.subtitle || c.role || '') : subtitle];
    } else {
      displayLines = coach ? [] : lines.slice();
    }
    return {student, badge, badges, sportBadge:sport?.label || '', lines:displayLines.filter(Boolean), displayLines:displayLines.filter(Boolean)};
  }
  function badgesHtml(items, insideText) {
    if (!items || !items.length) return '';
    return '<span class="atlas-character-card-badges'+(insideText?' is-inline':'')+'">'+items.map(item =>
      '<span class="atlas-character-card-badge '+esc(item.cls || '')+'">'+esc(item.label)+'</span>'
    ).join('')+'</span>';
  }
  function cardDetailsHtml(c) {
    const details = cardDetails(c);
    const topBadges = details.student ? badgesHtml(details.badges,false) : '';
    const inlineBadges = details.student ? '' : badgesHtml(details.badges,true);
    return topBadges+'<span class="atlas-character-card-text">'+inlineBadges+'<h3>'+esc(c.cardName || c.name || c.fullName || c.id)+'</h3>'+
      details.displayLines.map(line => '<p>'+esc(line)+'</p>').join('')+'</span>';
  }
  window.atlasCardDetailsHtml = cardDetailsHtml;
  function cardPlayerHtml(c) {
    const p = owner(c.id);
    if (p) {
      const label = playerInlineParts(p.display_name || '', p.nickname || '');
      const finalLabel = label || '<span class="atlas-card-player-name">профиль игрока</span>';
      return '<button type="button" class="atlas-community-link atlas-card-player-link" data-community-player="'+esc(p.id)+'">'+finalLabel+'</button>';
    }
    const fallback = staticPlayer(c);
    if (!fallback) return '';
    const label = playerInlineParts(fallback.name || '', fallback.nickname || '');
    if (!label) return '';
    return '<span class="atlas-card-player-fallback">'+label+'</span>';
  }
  function decoratePlayerBlock(container, c) {
    const html = cardPlayerHtml(c);
    let block = container.querySelector('.atlas-community-owner');
    if (!block && html) {
      block = document.createElement('div'); block.className = 'atlas-community-owner'; container.appendChild(block);
    }
    if (block) {
      if (block.dataset.playerHtml !== html) { block.innerHTML = html; block.dataset.playerHtml = html; }
      block.hidden = !html;
    }
  }
  function decorateCards() {
    document.querySelectorAll('.atlas-entrenador-card').forEach(card => {
      const c = cardCharacter(card.dataset.atlasEntrenadorId || card.dataset.communityCharacter);
      if (!c) return;
      let wrap = card.closest('.atlas-community-coach-wrap');
      if (!wrap) { wrap=document.createElement('div'); wrap.className='atlas-community-coach-wrap'; card.before(wrap); wrap.appendChild(card); }
      decoratePlayerBlock(wrap,c);
    });
    document.querySelectorAll('[data-community-character], .atlas-card-only-wrapper').forEach(card => {
      if (card.classList.contains('atlas-entrenador-card')) return;
      const id = card.dataset.communityCharacter || card.id.replace(/^card-only-/, '');
      const c = cardCharacter(id);
      if (!c) return;
      const details = card.querySelector('.atlas-character-card-details');
      const html = cardDetailsHtml(c);
      if (details && details.dataset.detailsHtml !== html) { details.innerHTML = html; details.dataset.detailsHtml = html; }
      decoratePlayerBlock(card,c);
    });
  }
  window.atlasCommunityCards = function () { decorateCards(); loadOwners().catch(() => {}); };

  async function loadCustom(id, force = false) {
    if (!force && custom.has(id)) return custom.get(id);
    if (pendingCustom.has(id)) return pendingCustom.get(id);
    const request = read(client().from('atlas_character_customizations').select('*').eq('character_id',id).maybeSingle())
      .then(data => { custom.set(id,data || null); return data; }).finally(() => pendingCustom.delete(id));
    pendingCustom.set(id,request);
    return request;
  }
  function relationsHtml(relations) {
    return Object.entries(groups).map(([key,title]) => {
      const items = relations?.[key]?.items;
      if (!Array.isArray(items) || !items.length) return '';
      return '<section class="atlas-profile-card"><h3>'+esc(title)+'</h3>'+items.map(item => {
        const target = character(item.targetId);
        return '<div class="atlas-community-relation">'+(target ? '<button type="button" class="atlas-community-link" data-atlas-profile-id="'+esc(target.id)+'">'+esc(name(target))+'</button>' : '<strong>'+esc(item.name || '')+'</strong>')+'<small>'+esc(item.relation || '')+'</small><p>'+esc(item.text || '')+'</p></div>';
      }).join('')+'</section>';
    }).join('') || '<div class="atlas-profile-empty">связи пока не добавлены.</div>';
  }
  function originalPhoto(c) { return c?.avatar || c?.profile?.avatar || c?.cardImage || c?.card?.image || ''; }
  function originalBanner(c) { return c?.banner || c?.heroImage || c?.profile?.heroImage || originalPhoto(c); }
  function ownerCard(c) {
    const p = owner(c.id), box = document.querySelector('#atlasCharacterProfileRoot .atlas-player-meta-card');
    if (!box || !p) return;
    const others = p ? owners.filter(o => o.user_id === p.id && o.character_id !== c.id).map(o => allCharacters().find(x => x.id === o.character_id)).filter(Boolean) : [];
    box.innerHTML = '<h3>игрок</h3>'+link(p)+(others.length ? '<div class="atlas-player-character-list">'+others.map(x => window.atlasRenderCharacterChip(x)).join('')+'</div>' : '');
  }
  window.atlasHydrateCommunityCharacter = async function (id) {
    const root = document.getElementById('atlasCharacterProfileRoot'), c = character(id);
    if (!root || !c || !client()) return;
    root.dataset.communityId = id;
    const epoch = ownerEpoch;
    const results = await Promise.allSettled([loadOwners(),loadCustom(id),read(client().rpc('atlas_can_edit_character',{p_character:id}))]);
    if (root.dataset.communityId !== id || epoch !== ownerEpoch) return;
    ownerCard(c);
    const data = results[1].status === 'fulfilled' ? results[1].value : null;
    const hero = root.querySelector('.atlas-profile-hero');
    if (hero && data?.banner_url) hero.style.setProperty('--character-banner','url('+JSON.stringify(data.banner_url)+')');
    const overview = root.querySelector('[data-character-tab-panel="overview"]');
    let photo = overview?.querySelector('.atlas-community-portrait');
    if (!photo) {
      photo = document.createElement('figure');
      photo.className = 'atlas-community-portrait';
      overview?.querySelector('.atlas-profile-overview-left')?.prepend(photo);
    }
    const photoUrl = data?.photo_url || originalPhoto(c);
    photo.innerHTML = photoUrl ? '<img src="'+esc(photoUrl)+'" alt="'+esc(name(c))+'" loading="lazy">' : '';
    photo.hidden = !photoUrl;
    if (data?.relations) root.querySelector('[data-character-tab-panel="relations"]').innerHTML = relationsHtml(data.relations);
    root.querySelector('[data-community-edit]')?.remove();
    if (results[2].status === 'fulfilled' && results[2].value === true) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'atlas-community-edit'; button.dataset.communityEdit = id; button.textContent = 'редактировать анкету'; hero?.appendChild(button);
    }
    hydrateSocial(overview?.querySelector('.atlas-profile-overview-left'),'character',id);
  };

  async function hydrateSocial(container,type,id) {
    if (!container || !client()) return;
    let section = container.querySelector('.atlas-community-social');
    if (!section) { section = document.createElement('section'); section.className = 'atlas-profile-card atlas-community-social'; container.appendChild(section); }
    const token = type+':'+id; section.dataset.target = token;
    section.innerHTML = '<p>загружаем заметки и счётчик…</p>';
    try {
      const [count, notes] = await Promise.all([
        read(client().rpc('atlas_favorite_count',{p_type:type,p_id:id})),
        read(client().from('atlas_notes').select('id,title,body,user_id,created_at').eq('target_type',type).eq('target_id',id).eq('is_public',true).order('created_at',{ascending:false}).limit(100))
      ]);
      await loadOwners();
      if (!section.isConnected || section.dataset.target !== token) return;
      section.innerHTML = '<div class="atlas-community-count">♥ в избранном у '+Number(count || 0)+' игроков <small>анонимно</small></div><h3>публичные заметки</h3>'+(notes?.length ? notes.map(n => '<article class="atlas-community-public-note">'+link(profiles.find(p => p.id === n.user_id))+'<strong>'+esc(n.title || 'заметка')+'</strong><p>'+esc(n.body)+'</p></article>').join('') : '<p>публичных заметок пока нет.</p>')+(notes?.length === 100 ? '<small>показаны последние 100 заметок.</small>' : '');
    } catch (err) { if (section.isConnected) section.innerHTML = '<p>'+esc(errorText(err))+'</p>'; }
  }
  window.atlasHydrateCommunityPlayer = function (id) { hydrateSocial(document.querySelector('#atlasPlayerProfileRoot [data-player-tab-panel="overview"]'),'player',id); };
  window.atlasCommunityRefreshSocial = function () {
    document.querySelectorAll('.atlas-community-social').forEach(s => {
      const [type,id] = s.dataset.target.split(':'); hydrateSocial(s.parentElement,type,id);
    });
  };

  function closeModal() {
    if (editor?.saving) return;
    if (editor?.urls) editor.urls.forEach(u => URL.revokeObjectURL(u));
    document.getElementById('atlasCommunityDialog')?.remove();
    editor = null; modalReturnFocus?.focus?.({preventScroll:true});
  }
  function dialog(title,html) {
    closeModal(); modalReturnFocus = document.activeElement;
    const modal = document.createElement('dialog'); modal.id = 'atlasCommunityDialog';
    modal.innerHTML = '<div class="atlas-community-modal-head"><h2>'+esc(title)+'</h2><button type="button" data-community-close aria-label="закрыть">×</button></div>'+html+'<p id="atlasCommunityStatus" role="status"></p>';
    (document.getElementById('atlas-app') || document.body).appendChild(modal);
    modal.addEventListener('cancel',e => { e.preventDefault(); closeModal(); });
    modal.showModal(); return modal;
  }
  function status(message) { const el = document.getElementById('atlasCommunityStatus'); if (el) el.textContent = message; }
  function lock(on) { if (editor) editor.saving = on; document.querySelectorAll('#atlasCommunityDialog button, #atlasCommunityDialog input, #atlasCommunityDialog select, #atlasCommunityDialog textarea').forEach(x => x.disabled = on); }
  function relationRow(key,item = {}) {
    return '<div class="atlas-community-relation-row"><label>раздел<select name="relation_group">'+Object.entries(groups).map(([k,t]) => '<option value="'+k+'"'+(k===key?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label><label>персонаж<select name="relation_target"><option value="">вписать имя вручную</option>'+(window.ATLAS_CHARACTERS || []).filter(c => c.id !== editor?.id).map(c => '<option value="'+esc(c.id)+'"'+(c.id===item.targetId?' selected':'')+'>'+esc(name(c))+'</option>').join('')+'</select></label><label>имя<input name="relation_name" maxlength="120" value="'+esc(item.name || '')+'"></label><label>связь<input name="relation_label" maxlength="240" value="'+esc(item.relation || '')+'" placeholder="друг, сестра, соперник…"></label><label class="atlas-community-wide">описание<textarea name="relation_text" maxlength="3000">'+esc(item.text || '')+'</textarea></label><button type="button" data-community-relation-remove>убрать связь</button></div>';
  }
  async function openCharacterEditor(id) {
    const c = character(id); if (!c || !uid()) return;
    const modal = dialog('редактировать анкету','<p>загружаем анкету…</p>');
    editor = {kind:'character',id,user:uid(),urls:[],saving:false}; const state = editor;
    try {
      const [data,canEdit] = await Promise.all([loadCustom(id,true),read(client().rpc('atlas_can_edit_character',{p_character:id}))]);
      if (editor !== state) return;
      if (!canEdit) throw new Error('Эта анкета не привязана к вашему аккаунту.');
      state.original = data;
      modal.querySelector('p').remove();
      const form = document.createElement('form'); form.id = 'atlasCharacterCustomizeForm';
      form.innerHTML = '<p>Здесь меняются фото, баннер и связи внутри анкеты. Фото в каталоге выбирает администратор.</p><div class="atlas-community-media-grid">'+['photo','banner'].map(k => '<label>'+ (k==='photo'?'фотокарточка':'баннер')+'<img data-community-preview="'+k+'" src="'+esc(data?.[k+'_url'] || (k==='photo'?originalPhoto(c):originalBanner(c)))+'" alt="предпросмотр"><input type="file" name="'+k+'" accept="image/jpeg,image/png,image/webp,image/gif"><span><input type="checkbox" name="reset_'+k+'"> вернуть исходное изображение</span><small>JPG, PNG, WEBP или GIF, до 8 МБ.</small></label>').join('')+'</div><h3>связи</h3><div id="atlasCommunityRelations"></div><button type="button" data-community-relation-add>+ добавить связь</button><div class="atlas-community-form-actions"><button type="button" data-community-close>отмена</button><button type="submit">сохранить</button></div>';
      modal.insertBefore(form,modal.querySelector('#atlasCommunityStatus'));
      const relations = data?.relations ?? c.profile?.relations ?? c.relations ?? {};
      form.querySelector('#atlasCommunityRelations').innerHTML = Object.keys(groups).flatMap(k => (relations[k]?.items || []).map(x => relationRow(k,x))).join('');
    } catch (err) { status(errorText(err)); }
  }
  function validateImage(file) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('Выберите изображение JPG, PNG, WEBP или GIF.');
    if (file.size > 8*1024*1024) throw new Error('Размер изображения должен быть не больше 8 МБ.');
  }
  async function uploadImage(file,state,kind) {
    validateImage(file);
    const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type];
    const path = state.user+'/characters/'+state.id+'/'+kind+'-'+crypto.randomUUID()+'.'+ext;
    await checked(client().storage.from('atlas-media').upload(path,file,{contentType:file.type,upsert:false}));
    state.uploaded.push(path);
    return client().storage.from('atlas-media').getPublicUrl(path).data.publicUrl;
  }
  async function saveCharacter(form) {
    const state = editor; if (!state || state.saving) return;
    const fields = new FormData(form), relations = {};
    try {
      if (uid() !== state.user) throw new Error('Аккаунт изменился. Откройте редактор заново.');
      form.querySelectorAll('.atlas-community-relation-row').forEach(row => {
        const value = n => row.querySelector('[name="'+n+'"]').value.trim();
        const key = value('relation_group'), targetId = value('relation_target'), target = character(targetId);
        const personName = target ? name(target) : value('relation_name');
        if (!personName) throw new Error('У каждой связи должно быть имя или выбранный персонаж.');
        (relations[key] ||= {title:groups[key],items:[]}).items.push({name:personName,targetId,relation:value('relation_label'),text:value('relation_text')});
      });
      if (form.querySelectorAll('.atlas-community-relation-row').length > 100) throw new Error('Можно сохранить не больше 100 связей.');
      if (new TextEncoder().encode(JSON.stringify(relations)).length > 98000) throw new Error('Описания связей слишком длинные. Сократите их перед сохранением.');
      ['photo','banner'].forEach(k => { const f = fields.get(k); if (f?.size && !fields.has('reset_'+k)) validateImage(f); });
      lock(true); status('сохраняем…'); state.uploaded = [];
      const row = {character_id:state.id,relations};
      for (const k of ['photo','banner']) {
        const f = fields.get(k);
        row[k+'_url'] = fields.has('reset_'+k) ? null : f?.size ? await uploadImage(f,state,k) : state.original?.[k+'_url'] || null;
      }
      if (uid() !== state.user) throw new Error('Аккаунт изменился. Изменения не сохранены.');
      const query = state.original
        ? client().from('atlas_character_customizations').update(row).eq('character_id',state.id).eq('updated_at',state.original.updated_at).select('*')
        : client().from('atlas_character_customizations').insert(row).select('*');
      const saved = await checked(query);
      if (!saved?.length) throw new Error('Анкету уже изменили в другом окне. Закройте редактор и откройте заново.');
      custom.set(state.id,saved[0]); state.uploaded = [];
      const id = state.id; lock(false); closeModal();
      const root = document.getElementById('atlasCharacterProfileRoot');
      if (root?.dataset.communityId === id) window.atlasOpenCharacter(id);
    } catch (err) {
      if (state.uploaded?.length) await client().storage.from('atlas-media').remove(state.uploaded);
      if (editor === state) { lock(false); status(errorText(err)); }
    }
  }

  function renderRosterActions() {
    const profile = window.ATLAS_CURRENT_PROFILE;
    const allowed = !!uid() && (rosterAllowedFor === uid() ? rosterAllowed : profile?.id === uid() && profile.role === 'superadmin');
    ['atlasRosterHeroActions','atlasRosterToolbar'].forEach(id => {
      const toolbar = document.getElementById(id); if (!toolbar) return;
      toolbar.hidden = !allowed;
      if (allowed && !toolbar.querySelector('[data-community-roster-edit]')) toolbar.innerHTML = '<button type="button" class="atlas-community-edit" data-community-roster-edit>редактировать составы и группы поддержки</button>';
      if (!allowed) toolbar.innerHTML = '';
    });
    if (typeof markEditableRosterSlots === 'function') markEditableRosterSlots();
  }
  async function refreshRosterAccess() {
    const startedFor = uid(), version = ++rosterAccessVersion;
    if (rosterAllowedFor !== startedFor) { rosterAllowed = false; rosterAllowedFor = null; }
    renderRosterActions();
    if (!client()) return false;
    const allowed = await read(client().rpc('atlas_can_manage_rosters'));
    if (uid() !== startedFor || version !== rosterAccessVersion) return false;
    rosterAllowed = allowed === true; rosterAllowedFor = startedFor;
    renderRosterActions();
    return rosterAllowed;
  }
  window.atlasRenderEquipos = function () {
    renderRosterActions();
    refreshRosterAccess().catch(() => {});
  };
  window.atlasLoadRoster = async function () {
    if (!client()) throw new Error('Нет подключения к ATLAS.');
    const startedFor = uid();
    const result = await Promise.all([
      read(client().from('atlas_teams').select('*').order('name')),
      read(client().from('atlas_team_members').select('*')),
      refreshRosterAccess(),
      read(client().from('atlas_character_catalog').select('id,name').eq('active',true))
    ]);
    if (uid() !== startedFor) throw new Error('Аккаунт изменился. Обновите составы.');
    teams = result[0] || []; members = result[1] || [];
    rosterCatalog = result[3] || [];
    return members.filter(m => m.kind === 'athlete').map(m => {
      const c = allCharacters().find(x => x.id === m.character_id);
      return {id:m.character_id, name:rosterName(c)||m.character_id, profile:m.character_id, team:teams.find(t => t.id === m.team_id)?.name || '', position:m.position,captaincy:m.captaincy,visible_in_roster:m.visible?'yes':'no'};
    });
  };
  function characterLink(c) {
    const full = character(c?.id);
    return full ? '<button class="atlas-community-cheer-chip is-clickable" type="button" data-community-character-open="'+esc(c?.id || '')+'">'+esc(rosterName(c))+'</button>' : '<span class="atlas-community-cheer-chip">'+esc(rosterName(c))+'</span>';
  }
  window.atlasDecorateRosters = function () {
    renderRosterActions();
    const holder = document.getElementById('atlas-team-rosters-holder'); if (!holder) return;
    let toolbar = document.getElementById('atlasRosterToolbar');
    if (!toolbar) { toolbar = document.createElement('div'); toolbar.id = 'atlasRosterToolbar'; holder.before(toolbar); }
    renderRosterActions();
    holder.querySelectorAll('.atlas-team-roster-card').forEach(card => {
      card.querySelector('.atlas-community-cheer')?.remove();
      const title = card.querySelector('h5')?.textContent?.trim().toLowerCase();
      const team = teams.find(t => t.name.toLowerCase() === title); if (!team) return;
      const cheer = members.filter(m => m.team_id === team.id && m.kind === 'cheer' && m.visible);
      const section = document.createElement('section'); section.className = 'atlas-community-cheer';
      section.innerHTML = '<h6>группа поддержки</h6>'+(cheer.length ? '<div class="atlas-community-cheer-list">'+cheer.map(m => {
        const c = allCharacters().find(x => x.id === m.character_id);
        const role = m.captaincy==='captain'?'<span class="atlas-community-captain">капитан</span>':m.captaincy==='vice-captain'?'<span class="atlas-community-captain is-vice">заместитель</span>':'';
        return '<span class="atlas-community-cheer-item">'+characterLink(c)+role+'</span>';
      }).join('')+'</div>' : '<small>состав не указан</small>');
      card.appendChild(section);
    });
  };
  function rosterCanManage() {
    const profile = window.ATLAS_CURRENT_PROFILE;
    return !!uid() && (rosterAllowedFor === uid() ? rosterAllowed : profile?.id === uid() && profile.role === 'superadmin');
  }
  function markEditableRosterSlots() {
    document.querySelectorAll('[data-community-roster-empty]').forEach(slot => {
      const allowed = rosterCanManage();
      slot.classList.toggle('is-editable', allowed);
      slot.title = allowed ? 'назначить персонажа' : '';
    });
  }
  async function openRosterSlotPicker(teamName, position) {
    if (!rosterCanManage()) return;
    const team = teams.find(t => String(t.name).toLowerCase() === String(teamName || '').toLowerCase());
    if (!team) return;
    const occupiedIds = new Set(members.filter(m => m.kind === 'athlete').map(m => m.character_id));
    const choices = allCharacters().filter(c => c?.id && !occupiedIds.has(c.id)).sort((a,b) => rosterName(a).localeCompare(rosterName(b),'ru'));
    dialog('назначить на позицию','<form id="atlasRosterSlotForm"><label>персонаж<select name="character_id" required><option value="">выбери персонажа</option>'+choices.map(c => '<option value="'+esc(c.id)+'">'+esc(rosterName(c))+'</option>').join('')+'</select></label><div class="atlas-community-slot-meta"><strong>'+esc(team.name)+'</strong><span>'+esc(position)+'</span></div><div class="atlas-community-form-actions"><button type="submit">назначить</button></div></form>');
    editor = {kind:'roster-slot',user:uid(),saving:false,teamId:team.id,position};
  }
  async function saveRosterSlot(form) {
    const state = editor; if (!state || state.kind !== 'roster-slot' || state.saving) return;
    const characterId = form.elements.character_id.value;
    if (!characterId) return;
    try {
      lock(true); status('сохраняем…');
      await checked(client().from('atlas_team_members').insert({character_id:characterId,kind:'athlete',team_id:state.teamId,position:state.position,captaincy:'none',visible:true}).select('*'));
      await reloadRoster(); lock(false); closeModal();
    } catch (err) { if (editor === state) { lock(false); status(errorText(err)); } }
  }
  async function reloadRoster() {
    const rows = await window.atlasLoadRoster(); window.atlasApplyRoster?.(rows); window.atlasDecorateRosters(); markEditableRosterSlots();
  }
  const positions = {
    football:[['goalkeeper','вратарь'],['centre-back','центральный защитник'],['right-back','правый защитник'],['left-back','левый защитник'],['defensive midfielder','опорный полузащитник'],['central midfielder','центральный полузащитник'],['attacking midfielder','атакующий полузащитник'],['forward','центральный нападающий'],['winger','крайний нападающий'],['striker','нападающий']],
    hockey:[['goalkeeper','вратарь'],['left defense','левый защитник'],['right defense','правый защитник'],['centre','центральный нападающий'],['left wing','левый крайний'],['right wing','правый крайний']],
    basketball:[['point guard','разыгрывающий'],['shooting guard','атакующий защитник'],['small forward','лёгкий форвард'],['power forward','тяжёлый форвард'],['center basketball','центровой']],
    volleyball:[['setter','связующий'],['outside hitter left','левый доигровщик'],['outside hitter right','правый доигровщик'],['opposite','диагональный'],['middle blocker left','левый блокирующий'],['middle blocker right','правый блокирующий'],['libero','либеро']]
  };
  function positionOptions(form,value = '') {
    const team = teams.find(t => t.id === form.elements.team_id.value), cheer = form.elements.kind.value === 'cheer';
    const values = cheer ? [['','участница группы поддержки']] : positions[team?.sport] || [];
    form.elements.position.innerHTML = (value && !values.some(x => x[0] === value) ? '<option value="'+esc(value)+'">текущая позиция</option>' : '')+values.map(([v,l]) => '<option value="'+v+'">'+l+'</option>').join('');
    if (value) form.elements.position.value = value;
  }
  function rosterRows() {
    const box = document.getElementById('atlasRosterEditorRows'); if (!box) return;
    box.innerHTML = members.map((m,i) => '<div class="atlas-community-roster-row"><span>'+esc(rosterName(allCharacters().find(c => c.id===m.character_id)) || m.character_id)+'<small>'+esc(teams.find(t => t.id===m.team_id)?.name)+' · '+(m.kind==='cheer'?'группа поддержки':'команда')+(m.captaincy==='captain'?' · капитан':'')+(!m.visible?' · скрыт':'')+'</small></span><button type="button" data-community-roster-row="'+i+'">изменить</button><button type="button" data-community-roster-remove="'+i+'">убрать</button></div>').join('');
  }
  function rosterCharacterOptions() {
    return allCharacters().slice().sort((a,b) => rosterName(a).localeCompare(rosterName(b),'ru')).map(c => '<option value="'+esc(rosterName(c))+'" data-id="'+esc(c.id)+'">'+esc(c.id)+'</option>').join('');
  }
  function resolveRosterCharacterValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.toLowerCase();
    const found = allCharacters().find(c => c.id === raw || rosterName(c).toLowerCase() === normalized || String(c.name || '').toLowerCase() === normalized || String(c.cardName || '').toLowerCase() === normalized || String(c.fullName || '').toLowerCase() === normalized);
    return found ? found.id : raw;
  }
  function rosterCharacterDisplay(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const found = allCharacters().find(c => c.id === raw || rosterName(c) === raw || String(c.name || '') === raw || String(c.cardName || '') === raw || String(c.fullName || '') === raw);
    return found ? rosterName(found) : raw;
  }
  async function openRosterEditor() {
    dialog('составы команд','<p>загружаем составы…</p>'); editor = {kind:'roster',user:uid(),saving:false,selected:null}; const state = editor;
    try {
      await reloadRoster(); if (editor !== state) return;
      if (!rosterAllowed || rosterAllowedFor !== uid()) throw new Error('Редактор доступен пасс и суперадминистратору.');
      const modal = document.getElementById('atlasCommunityDialog'); modal.querySelector('p').remove();
      const form = document.createElement('form'); form.id = 'atlasRosterEditorForm';
      form.innerHTML = '<label>персонаж<input name="character_id" type="text" list="atlasRosterCharacterList" placeholder="выбери персонажа из списка или впиши имя вручную" autocomplete="off" required><datalist id="atlasRosterCharacterList">'+rosterCharacterOptions()+'</datalist></label><label>раздел<select name="kind"><option value="athlete">команда</option><option value="cheer">группа поддержки</option></select></label><label>команда<select name="team_id">'+teams.map(t => '<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('')+'</select></label><label>позиция<select name="position"></select></label><label>роль<select name="captaincy"><option value="none">участник / участница</option><option value="captain">капитан</option><option value="vice-captain">заместитель капитана</option><option value="reserve captain">резервный капитан</option></select></label><label><input type="checkbox" name="visible" checked> показывать в составе</label><div class="atlas-community-form-actions"><button type="button" data-community-roster-new>новая запись</button><button type="submit">сохранить</button></div><small>можно выбрать персонажа из выпадающего списка или вписать имя вручную. при смене капитана сначала снимите эту роль с предыдущего.</small>';
      modal.insertBefore(form,modal.querySelector('#atlasCommunityStatus')); positionOptions(form);
      const rows = document.createElement('div'); rows.id = 'atlasRosterEditorRows'; modal.appendChild(rows); rosterRows();
    } catch (err) { status(errorText(err)); }
  }
  function selectRoster(index) {
    const form = document.getElementById('atlasRosterEditorForm'); if (!form) return;
    const row = members[index]; editor.selected = row || null;
    if (!row) form.reset(); else {
      form.elements.character_id.value = rosterCharacterDisplay(row.character_id);
      ['kind','team_id','captaincy'].forEach(k => form.elements[k].value = row[k]);
    }
    positionOptions(form,row?.position || ''); form.elements.visible.checked = row ? row.visible : true;
    form.elements.character_id.disabled = !!row; form.elements.kind.disabled = !!row;
    form.scrollIntoView({block:'start',behavior:'smooth'}); status('');
  }
  async function saveRoster(form) {
    const state = editor; if (!state || state.saving) return;
    const row = {};
    row.character_id = resolveRosterCharacterValue(form.elements.character_id.value);
    ['kind','team_id','position','captaincy'].forEach(k => row[k] = form.elements[k].value);
    if (!row.character_id) throw new Error('Укажите персонажа или впишите имя вручную.');
    row.visible = form.elements.visible.checked;
    try {
      if (state.user !== uid()) throw new Error('Аккаунт изменился. Откройте редактор заново.');
      lock(true); status('сохраняем…');
      const query = state.selected ? client().from('atlas_team_members').update(row).eq('character_id',row.character_id).eq('kind',row.kind).eq('updated_at',state.selected.updated_at).select('*') : client().from('atlas_team_members').insert(row).select('*');
      const saved = await checked(query); if (!saved?.length) throw new Error('Состав изменён в другом окне. Откройте редактор заново.');
      await reloadRoster(); if (editor !== state) return;
      lock(false); rosterRows(); selectRoster(-1); status('состав сохранён');
    } catch (err) { if (editor === state) { lock(false); if (state.selected) { form.elements.character_id.disabled = true; form.elements.kind.disabled = true; } status(errorText(err)); } }
  }
  async function removeRoster(index) {
    if (editor?.saving) return; const row = members[index]; if (!row) return;
    if (!confirm('Убрать '+rosterName(allCharacters().find(c => c.id === row.character_id))+' из этого состава?')) return;
    const state = editor;
    try {
      lock(true); const deleted = await checked(client().from('atlas_team_members').delete().eq('character_id',row.character_id).eq('kind',row.kind).eq('updated_at',row.updated_at).select('character_id'));
      if (!deleted?.length) throw new Error('Запись уже изменилась. Откройте редактор заново.');
      await reloadRoster(); if (editor !== state) return; lock(false); rosterRows(); selectRoster(-1); status('запись убрана');
    } catch (err) { if (editor === state) { lock(false); status(errorText(err)); } }
  }

  document.addEventListener('click',e => {
    const emptySlot = e.target.closest('[data-community-roster-empty]');
    if (emptySlot && rosterCanManage()) {
      e.preventDefault(); e.stopPropagation();
      openRosterSlotPicker(emptySlot.dataset.rosterTeam || '', emptySlot.dataset.rosterPosition || '');
      return;
    }
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-community-player')) window.atlasOpenPlayerProfile?.(b.dataset.communityPlayer);
    if (b.hasAttribute('data-community-character-open')) {
      const id = b.dataset.communityCharacterOpen;
      if (character(id)) window.atlasOpenCharacter?.(id);
      else { const c = allCharacters().find(x => x.id===id); window.atlasOpenPage?.('personajes-'+(c?.category || 'estudiantes')); setTimeout(() => document.getElementById('card-only-'+id)?.scrollIntoView({block:'center'}),100); }
    }
    if (b.hasAttribute('data-community-edit')) openCharacterEditor(b.dataset.communityEdit);
    if (b.hasAttribute('data-community-close')) closeModal();
    if (b.hasAttribute('data-community-relation-remove')) b.closest('.atlas-community-relation-row').remove();
    if (b.hasAttribute('data-community-relation-add')) document.getElementById('atlasCommunityRelations').insertAdjacentHTML('beforeend',relationRow('friends'));
    if (b.hasAttribute('data-community-roster-edit')) openRosterEditor();
    if (b.hasAttribute('data-community-roster-row')) selectRoster(Number(b.dataset.communityRosterRow));
    if (b.hasAttribute('data-community-roster-new')) selectRoster(-1);
    if (b.hasAttribute('data-community-roster-remove')) removeRoster(Number(b.dataset.communityRosterRemove));
  });
  document.addEventListener('change',e => {
    const form = e.target.closest('#atlasCharacterCustomizeForm');
    if (form && ['photo','banner'].includes(e.target.name)) {
      const file = e.target.files?.[0]; if (!file) return;
      try { validateImage(file); const url = URL.createObjectURL(file); editor.urls.push(url); form.querySelector('[data-community-preview="'+e.target.name+'"]').src = url; form.elements['reset_'+e.target.name].checked = false; status(''); }
      catch (err) { e.target.value = ''; status(errorText(err)); }
    }
    if (form && e.target.name.startsWith('reset_')) {
      const k = e.target.name.slice(6), c = character(editor.id);
      if (e.target.checked) { form.elements[k].value = ''; form.querySelector('[data-community-preview="'+k+'"]').src = k==='photo'?originalPhoto(c):originalBanner(c); }
    }
    const roster = e.target.closest('#atlasRosterEditorForm'); if (roster && ['team_id','kind'].includes(e.target.name)) positionOptions(roster);
  });
  document.addEventListener('submit',e => {
    if (e.target.id === 'atlasCharacterCustomizeForm') { e.preventDefault(); saveCharacter(e.target); }
    if (e.target.id === 'atlasRosterEditorForm') { e.preventDefault(); saveRoster(e.target); }
    if (e.target.id === 'atlasRosterSlotForm') { e.preventDefault(); saveRosterSlot(e.target); }
  });
  window.addEventListener('atlasPlayerAuthReady',() => {
    ownerEpoch++; ownersAt = 0; custom.clear();
    rosterAccessVersion++; rosterAllowed = false; rosterAllowedFor = null;
    renderRosterActions();
    document.querySelector('[data-community-edit]')?.remove();
    if (editor && editor.user !== uid()) { editor.saving = false; closeModal(); }
    loadOwners(true).then(() => { const id = document.getElementById('atlasCharacterProfileRoot')?.dataset.communityId; if (id) window.atlasHydrateCommunityCharacter(id); }).catch(() => {});
    reloadRoster().catch(() => {});
  });
  window.addEventListener('atlasCharactersReady',window.atlasCommunityCards);
  window.addEventListener('atlasCharacterOwnersChanged',() => { ownersAt=0; loadOwners(true).catch(() => {}); });
  document.addEventListener('DOMContentLoaded',() => { window.atlasCommunityCards(); window.atlasRenderEquipos(); });
})();
