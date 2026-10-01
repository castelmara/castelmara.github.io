(function(){
  'use strict';

  const client=()=>window.ATLAS_SUPABASE||null;
  const uid=()=>window.ATLAS_CURRENT_SESSION?.user?.id||'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let modal=null,rows=[],saving=false,account='',version=0,bodyOverflow='';

  function checked(query){
    return Promise.resolve(query).then(r=>{
      if(r?.error)throw r.error;
      return r?.data;
    });
  }

  function ensureStyle(){
    if(document.getElementById('atlasCustomPersonasStyle'))return;
    const style=document.createElement('style');
    style.id='atlasCustomPersonasStyle';
    style.textContent=`
      #atlasCustomPersonasModal{position:fixed;inset:0;z-index:2147483000;display:none;place-items:center;padding:18px;box-sizing:border-box;pointer-events:none}
      #atlasCustomPersonasModal.is-open{display:grid;pointer-events:auto}
      #atlasCustomPersonasModal .atlas-custom-personas-overlay{position:absolute;inset:0;background:rgba(5,7,10,.72);backdrop-filter:blur(7px);pointer-events:auto}
      #atlasCustomPersonasModal .atlas-custom-personas-window{position:relative;z-index:1;width:min(760px,100%);max-height:min(820px,calc(100dvh - 36px));overflow:auto;box-sizing:border-box;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:#11161d;color:#f4f1ed;box-shadow:0 28px 90px rgba(0,0,0,.5);padding:22px;pointer-events:auto;font-family:"Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal button,#atlasCustomPersonasModal input,#atlasCustomPersonasModal textarea{pointer-events:auto!important}
      #atlasCustomPersonasModal .atlas-custom-personas-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
      #atlasCustomPersonasModal .atlas-custom-personas-head small{display:block;color:#d45858;font:900 9px/1 "Montserrat",Arial,sans-serif;text-transform:uppercase;letter-spacing:.09em;margin-bottom:6px}
      #atlasCustomPersonasModal .atlas-custom-personas-head h2{margin:0;color:#fff;font:950 26px/1 "Montserrat",Arial,sans-serif;letter-spacing:-.035em}
      #atlasCustomPersonasModal .atlas-custom-personas-head p{margin:7px 0 0;color:#9199a4;font:650 10px/1.5 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-close{width:36px;height:36px;flex:0 0 36px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:#1b222b;color:#c7ccd2;cursor:pointer;font-size:20px;line-height:1}
      #atlasCustomPersonasModal .atlas-custom-personas-layout{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(0,1.35fr);gap:16px;align-items:start}
      #atlasCustomPersonasModal .atlas-custom-personas-listbox,#atlasCustomPersonasModal .atlas-custom-personas-editor{border:1px solid rgba(255,255,255,.09);border-radius:18px;background:#0c1117;padding:12px;min-width:0}
      #atlasCustomPersonasModal .atlas-custom-personas-list-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      #atlasCustomPersonasModal .atlas-custom-personas-list-head strong{color:#eef0f2;font:900 11px/1 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-new{border:0;border-radius:999px;background:#c53030;color:#fff;padding:8px 10px;cursor:pointer;font:900 8px/1 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-list{display:grid;gap:7px}
      #atlasCustomPersonasModal .atlas-custom-persona-card{width:100%;display:grid;grid-template-columns:38px minmax(0,1fr);gap:9px;align-items:center;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:#151b23;color:inherit;padding:8px;text-align:left;cursor:pointer}
      #atlasCustomPersonasModal .atlas-custom-persona-card:hover,#atlasCustomPersonasModal .atlas-custom-persona-card.is-active{border-color:rgba(213,88,88,.5);background:#1a2029}
      #atlasCustomPersonasModal .atlas-custom-persona-avatar{width:38px;height:38px;border-radius:11px;overflow:hidden;background:#252c36;display:grid;place-items:center;color:#fff;font:900 13px/1 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-persona-avatar img{width:100%;height:100%;object-fit:cover;display:block}
      #atlasCustomPersonasModal .atlas-custom-persona-card span:last-child{min-width:0}
      #atlasCustomPersonasModal .atlas-custom-persona-card strong,#atlasCustomPersonasModal .atlas-custom-persona-card small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #atlasCustomPersonasModal .atlas-custom-persona-card strong{color:#f1eeeb;font:850 10px/1.25 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-persona-card small{margin-top:4px;color:#888f99;font:650 8px/1.2 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-empty{padding:16px 8px;color:#818993;text-align:center;font:650 9px/1.5 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-form{display:grid;gap:12px}
      #atlasCustomPersonasModal .atlas-custom-personas-field{display:grid;gap:6px}
      #atlasCustomPersonasModal .atlas-custom-personas-field>span{color:#929aa4;font:850 8px/1 "Montserrat",Arial,sans-serif;text-transform:lowercase}
      #atlasCustomPersonasModal .atlas-custom-personas-field input{width:100%;height:42px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:#161d25;color:#fff;padding:0 11px;outline:0;font:700 11px/1 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-field input:focus{border-color:#c65c5c;box-shadow:0 0 0 3px rgba(197,48,48,.12)}
      #atlasCustomPersonasModal .atlas-custom-personas-avatar-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      #atlasCustomPersonasModal .atlas-custom-personas-preview{width:58px;height:58px;border-radius:15px;overflow:hidden;background:#232a34;color:#fff;display:grid;place-items:center;font:900 18px/1 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-preview img{width:100%;height:100%;object-fit:cover;display:block}
      #atlasCustomPersonasModal .atlas-custom-personas-file{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:#1a212a;color:#d0d4da;padding:9px 11px;cursor:pointer;font:850 8px/1 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-file input{display:none}
      #atlasCustomPersonasModal .atlas-custom-personas-clear{display:flex;align-items:center;gap:6px;color:#999fa8;font:700 8px/1 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-clear input{width:auto;height:auto}
      #atlasCustomPersonasModal .atlas-custom-personas-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:2px}
      #atlasCustomPersonasModal .atlas-custom-personas-save{border:0;border-radius:999px;background:#c53030;color:#fff;padding:10px 14px;cursor:pointer;font:900 9px/1 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-save:disabled{opacity:.5;cursor:wait}
      #atlasCustomPersonasModal .atlas-custom-personas-status{min-height:16px;margin:9px 2px 0;color:#9199a3;font:700 9px/1.4 "Montserrat",Arial,sans-serif}
      #atlasCustomPersonasModal .atlas-custom-personas-status.is-error{color:#ff7777}
      #atlasCustomPersonasModal .atlas-custom-personas-status.is-ok{color:#78c98a}

      #atlas-app .atlas-direct-picker-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
      #atlas-app .atlas-direct-picker-tools>span{color:#9aa0a9;font:700 9px/1 "Montserrat",Arial,sans-serif}
      #atlas-app .atlas-direct-custom-open{border:1px solid #e1c0c0;border-radius:999px;background:#fff7f7;color:#b83737;padding:7px 9px;cursor:pointer;font:900 8px/1 "Montserrat",Arial,sans-serif;white-space:nowrap}
      #atlas-app .atlas-direct-custom-open:hover{background:#c53030;border-color:#c53030;color:#fff}
      #atlas-app .atlas-direct-persona-choice.is-service{border-color:#ead4d4;background:#fff9f9}
      #atlas-app .atlas-direct-persona-choice.is-service:hover{border-color:#dda8a8;background:#fff4f4}
      #atlas-app .atlas-direct-service-badge{display:inline-flex!important;margin:0 0 0 5px!important;padding:3px 5px;border-radius:999px;background:#f3dddd;color:#ad3838;font:900 6.5px/1 "Montserrat",Arial,sans-serif;font-style:normal;vertical-align:middle;text-transform:uppercase}
      #atlas-app[data-theme="dark"] .atlas-direct-custom-open{background:#211719;border-color:rgba(213,88,88,.32);color:#ee8d8d}
      #atlas-app[data-theme="dark"] .atlas-direct-persona-choice.is-service{background:#171316;border-color:rgba(213,88,88,.2)}

      @media(max-width:620px){
        #atlasCustomPersonasModal{padding:8px}
        #atlasCustomPersonasModal .atlas-custom-personas-window{max-height:calc(100dvh - 16px);padding:16px;border-radius:18px}
        #atlasCustomPersonasModal .atlas-custom-personas-layout{grid-template-columns:1fr}
        #atlasCustomPersonasModal .atlas-custom-personas-listbox{max-height:220px;overflow:auto}
        #atlas-app .atlas-direct-service-picker-head{align-items:flex-start}
        #atlas-app .atlas-direct-picker-tools{justify-content:flex-end}
      }
    `;
    document.head.appendChild(style);
  }

  function initial(p){
    return String(p?.display_name||p?.nickname||'A').trim().charAt(0).toUpperCase()||'A';
  }

  function avatarHtml(p,cls){
    return '<span class="'+cls+'">'+(p?.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="">':esc(initial(p)))+'</span>';
  }

  function status(text,type){
    const el=modal?.querySelector('[data-custom-status]');
    if(!el)return;
    el.textContent=text||'';
    el.className='atlas-custom-personas-status'+(type==='error'?' is-error':type==='ok'?' is-ok':'');
  }

  function setOpen(open){
    if(!modal)return;
    modal.classList.toggle('is-open',open);
    modal.setAttribute('aria-hidden',String(!open));
    if(open){
      bodyOverflow=document.body.style.overflow;
      document.body.style.overflow='hidden';
    }else{
      document.body.style.overflow=bodyOverflow;
    }
  }

  function close(){
    if(saving)return;
    version++;
    setOpen(false);
  }

  function ensureModal(){
    ensureStyle();
    if(modal&&document.body.contains(modal))return modal;

    modal=document.createElement('div');
    modal.id='atlasCustomPersonasModal';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=
      '<div class="atlas-custom-personas-overlay" data-custom-close></div>'+
      '<section class="atlas-custom-personas-window" role="dialog" aria-modal="true" aria-labelledby="atlasCustomPersonasTitle">'+
        '<header class="atlas-custom-personas-head">'+
          '<div><small>direct / official</small><h2 id="atlasCustomPersonasTitle">служебные аккаунты</h2><p>общие аккаунты для ролевых переписок. доступны только уполномоченным администраторам.</p></div>'+
          '<button class="atlas-custom-personas-close" type="button" data-custom-close aria-label="закрыть">×</button>'+
        '</header>'+
        '<div class="atlas-custom-personas-layout">'+
          '<aside class="atlas-custom-personas-listbox">'+
            '<div class="atlas-custom-personas-list-head"><strong>аккаунты</strong><button class="atlas-custom-personas-new" type="button" data-custom-new>＋ новый</button></div>'+
            '<div class="atlas-custom-personas-list" data-custom-list></div>'+
          '</aside>'+
          '<div class="atlas-custom-personas-editor" data-custom-editor></div>'+
        '</div>'+
        '<div class="atlas-custom-personas-status" data-custom-status role="status" aria-live="polite"></div>'+
      '</section>';

    document.body.appendChild(modal);

    modal.addEventListener('click',e=>{
      const closeBtn=e.target.closest('[data-custom-close]');
      if(closeBtn){e.preventDefault();e.stopPropagation();close();return;}

      const create=e.target.closest('[data-custom-new]');
      if(create){e.preventDefault();e.stopPropagation();edit('');return;}

      const card=e.target.closest('[data-custom-edit]');
      if(card){e.preventDefault();e.stopPropagation();edit(card.getAttribute('data-custom-edit')||'');return;}
    });

    modal.addEventListener('submit',e=>{
      const form=e.target.closest('[data-custom-form]');
      if(!form)return;
      e.preventDefault();
      e.stopPropagation();
      save(form);
    });

    modal.addEventListener('change',e=>{
      if(e.target?.name!=='avatar')return;
      const file=e.target.files?.[0];
      if(!file)return;
      const preview=modal.querySelector('[data-custom-preview]');
      if(!preview)return;
      if(!String(file.type||'').startsWith('image/')){status('выбери изображение.','error');return;}
      const url=URL.createObjectURL(file);
      preview.innerHTML='<img src="'+esc(url)+'" alt="">';
      status('');
    });

    return modal;
  }

  function renderList(activeId){
    const list=modal?.querySelector('[data-custom-list]');
    if(!list)return;
    if(!rows.length){
      list.innerHTML='<div class="atlas-custom-personas-empty">служебных аккаунтов пока нет.</div>';
      return;
    }
    list.innerHTML=rows.map(p=>
      '<button type="button" class="atlas-custom-persona-card'+(p.id===activeId?' is-active':'')+'" data-custom-edit="'+esc(p.id)+'">'+
        avatarHtml(p,'atlas-custom-persona-avatar')+
        '<span><strong>'+esc(p.display_name||p.nickname||'служебный аккаунт')+'</strong><small>@'+esc(p.nickname||'account')+'</small></span>'+
      '</button>'
    ).join('');
  }

  function edit(id){
    const p=rows.find(x=>x.id===id)||{};
    renderList(p.id||'');
    const editor=modal?.querySelector('[data-custom-editor]');
    if(!editor)return;

    editor.innerHTML=
      '<form class="atlas-custom-personas-form" data-custom-form autocomplete="off">'+
        '<input type="hidden" name="id" value="'+esc(p.id||'')+'">'+
        '<label class="atlas-custom-personas-field"><span>имя</span><input name="display_name" maxlength="80" required value="'+esc(p.display_name||'')+'" placeholder="Castelmara Administration"></label>'+
        '<label class="atlas-custom-personas-field"><span>никнейм</span><input name="nickname" minlength="2" maxlength="32" required value="'+esc(p.nickname||'')+'" placeholder="administration"></label>'+
        '<label class="atlas-custom-personas-field"><span>статус</span><input name="status_text" maxlength="160" value="'+esc(p.status_text||'')+'" placeholder="официальный аккаунт"></label>'+
        '<div class="atlas-custom-personas-avatar-row">'+
          '<div class="atlas-custom-personas-preview" data-custom-preview>'+(p.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="">':esc(initial(p)))+'</div>'+
          '<label class="atlas-custom-personas-file">выбрать аватар<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>'+
          (p.avatar_url?'<label class="atlas-custom-personas-clear"><input type="checkbox" name="clear_avatar"> убрать текущий</label>':'')+
        '</div>'+
        '<div class="atlas-custom-personas-actions"><button class="atlas-custom-personas-save" type="submit">'+(p.id?'сохранить':'создать аккаунт')+'</button></div>'+
      '</form>';
    status('');
  }

  async function reload(){
    const data=await checked(
      client().from('atlas_personas')
        .select('id,character_id,owner_user_id,display_name,nickname,avatar_url,status_text,created_at,updated_at,is_archived')
        .is('character_id',null)
        .order('display_name')
    );
    rows=(data||[]).filter(x=>!x.is_archived);
  }

  async function open(){
    if(saving||!uid()||!client())return;
    const viewer=uid();
    account=viewer;
    const token=++version;

    try{
      const allowed=await checked(client().rpc('atlas_can_manage_custom_personas'));
      if(!allowed)throw new Error('Нет доступа к служебным аккаунтам.');
      await reload();
      if(token!==version||uid()!==viewer)return;

      ensureModal();
      renderList('');
      edit('');
      setOpen(true);
      requestAnimationFrame(()=>modal?.querySelector('input[name="display_name"]')?.focus());
    }catch(e){
      if(uid()===viewer)window.alert(e?.message||'Не удалось открыть служебные аккаунты.');
    }
  }

  async function save(form){
    if(saving||uid()!==account||!client())return;

    const viewer=account;
    const token=version;
    const f=new FormData(form);
    const id=String(f.get('id')||'');
    const old=rows.find(p=>p.id===id)||null;
    const file=f.get('avatar');
    let uploaded='';

    const displayName=String(f.get('display_name')||'').trim();
    const nickname=String(f.get('nickname')||'').trim().replace(/^@+/,'').toLowerCase();
    const statusText=String(f.get('status_text')||'').trim();

    if(!displayName){status('укажи имя.','error');return;}
    if(nickname.length<2){status('никнейм должен быть минимум из двух символов.','error');return;}
    if(/\s/.test(nickname)){status('в никнейме не должно быть пробелов.','error');return;}

    saving=true;
    modal?.querySelectorAll('input,button').forEach(x=>x.disabled=true);
    status('сохраняем…');

    try{
      const allowed=await checked(client().rpc('atlas_can_manage_custom_personas'));
      if(!allowed)throw new Error('Нет доступа.');

      let avatar=f.has('clear_avatar')?null:(old?.avatar_url||null);

      if(file?.size){
        const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[file.type];
        if(!ext||file.size>8*1024*1024)throw new Error('Выбери PNG, JPG, WEBP или GIF до 8 МБ.');
        uploaded=viewer+'/custom-personas/'+crypto.randomUUID()+'.'+ext;
        await checked(client().storage.from('atlas-media').upload(uploaded,file,{contentType:file.type}));
        avatar=client().storage.from('atlas-media').getPublicUrl(uploaded).data.publicUrl;
      }

      if(uid()!==viewer||version!==token)throw new Error('Аккаунт изменился.');

      const payload={
        display_name:displayName,
        nickname,
        status_text:statusText,
        avatar_url:avatar
      };

      let result;
      if(id){
        let q=client().from('atlas_personas')
          .update(payload)
          .eq('id',id)
          .is('character_id',null);
        if(old?.updated_at)q=q.eq('updated_at',old.updated_at);
        result=await q.select('*').single();
      }else{
        result=await client().from('atlas_personas')
          .insert({...payload,character_id:null})
          .select('*')
          .single();
      }
      if(result.error)throw result.error;

      uploaded='';
      await reload();
      if(uid()!==viewer||version!==token)return;

      const savedId=result.data?.id||id;
      renderList(savedId);
      edit(savedId);
      status(id?'изменения сохранены.':'служебный аккаунт создан.','ok');
      window.dispatchEvent(new CustomEvent('atlasCustomPersonasChanged',{detail:{id:savedId}}));
    }catch(e){
      if(uploaded){
        try{await client().storage.from('atlas-media').remove([uploaded]);}catch(_){}
      }
      if(uid()===viewer&&version===token){
        status(e?.code==='23505'?'Этот никнейм уже занят.':(e?.message||'Не удалось сохранить.'),'error');
      }
    }finally{
      saving=false;
      modal?.querySelectorAll('input,button').forEach(x=>x.disabled=false);
    }
  }

  /* Capture phase makes the control reliable even inside the Direct form. */
  document.addEventListener('click',e=>{
    const trigger=e.target?.closest?.('[data-direct-custom-personas]');
    if(!trigger)return;
    e.preventDefault();
    e.stopPropagation();
    open();
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&modal?.classList.contains('is-open')){
      e.preventDefault();
      close();
    }
  });

  window.addEventListener('atlasPlayerAuthReady',()=>{
    if(account&&uid()!==account){
      saving=false;
      close();
      account='';
    }
  });

  window.atlasOpenCustomPersonas=open;
})();
