(function(){
  'use strict';
  const client=()=>window.ATLAS_SUPABASE;
  const uid=()=>window.ATLAS_CURRENT_SESSION?.user?.id;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let modal,account,rows=[],saving=false,version=0;
  async function checked(query){const r=await query;if(r.error)throw r.error;return r.data;}
  function close(){if(saving)return;version++;modal?.remove();modal=null;}
  function status(text){const el=modal?.querySelector('[role="status"]');if(el)el.textContent=text;}
  function edit(id){
    const p=rows.find(x=>x.id===id)||{};
    modal.querySelector('[data-form]').innerHTML='<form autocomplete="off"><input type="hidden" name="id" value="'+esc(p.id)+'">'+
      '<label>имя<input name="display_name" maxlength="80" required value="'+esc(p.display_name)+'"></label>'+
      '<label>никнейм<input name="nickname" minlength="2" maxlength="32" required value="'+esc(p.nickname)+'"></label>'+
      '<label>статус<input name="status_text" maxlength="160" value="'+esc(p.status_text)+'"></label>'+
      '<label>аватар<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>'+
      (p.avatar_url?'<img width="64" height="64" style="object-fit:cover;border-radius:50%" src="'+esc(p.avatar_url)+'" alt="аватар"><label><input type="checkbox" name="clear_avatar"> убрать аватар</label>':'')+
      '<button type="submit">'+(p.id?'сохранить':'создать')+'</button></form>';
    status('');
  }
  async function open(){
    if(saving||!uid()||!client())return;
    close();const token=++version;account=uid();const viewer=account;
    try{
      if(!await checked(client().rpc('atlas_can_manage_custom_personas')))throw new Error('Нет доступа к служебным аккаунтам.');
      const data=await checked(client().from('atlas_personas').select('*').is('character_id',null).order('display_name'));
      if(token!==version||uid()!==viewer)return;
      rows=data||[];modal=document.createElement('dialog');modal.className='atlas-custom-personas';
      modal.innerHTML='<style>.atlas-custom-personas{width:min(520px,90vw);max-height:85vh;overflow:auto;border:1px solid #45454b;border-radius:20px;background:#15191f;color:#eee;padding:24px}.atlas-custom-personas::backdrop{background:#0009}.atlas-custom-personas label{display:block;margin:14px 0}.atlas-custom-personas input:not([type="checkbox"]){display:block;box-sizing:border-box;width:100%;margin-top:6px;padding:10px;background:#222831;color:inherit;border:1px solid #555;border-radius:8px}.atlas-custom-personas button,.atlas-custom-personas select{padding:9px;margin:5px;border-radius:8px;max-width:100%}</style>'+
        '<button type="button" data-close>закрыть</button><h2>служебные аккаунты</h2><p>Только для переписок, без анкеты персонажа.</p><select aria-label="аккаунт"><option value="">＋ новый аккаунт</option>'+rows.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.display_name)+' · @'+esc(p.nickname)+'</option>').join('')+'</select><div data-form></div><p role="status"></p>';
      document.body.appendChild(modal);modal.showModal();edit('');
      modal.querySelector('[data-close]').onclick=close;
      modal.querySelector('select').onchange=e=>edit(e.target.value);
      modal.addEventListener('cancel',e=>{e.preventDefault();close()});
      modal.addEventListener('submit',e=>{e.preventDefault();save(e.target)});
    }catch(e){if(uid()===viewer)window.alert(e.message||'Не удалось открыть аккаунты.');}
  }
  async function save(form){
    if(saving||uid()!==account)return;
    const viewer=account,token=version,f=new FormData(form),id=String(f.get('id')||'');
    const old=rows.find(p=>p.id===id),file=f.get('avatar');let uploaded;
    saving=true;modal.querySelectorAll('input,select,button').forEach(x=>x.disabled=true);status('сохраняем…');
    try{
      if(!await checked(client().rpc('atlas_can_manage_custom_personas')))throw new Error('Нет доступа.');
      let avatar=f.has('clear_avatar')?null:old?.avatar_url||null;
      if(file?.size){
        const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[file.type];
        if(!ext||file.size>8*1024*1024)throw new Error('Выбери PNG, JPG, WEBP или GIF до 8 МБ.');
        uploaded=viewer+'/custom-personas/'+crypto.randomUUID()+'.'+ext;
        await checked(client().storage.from('atlas-media').upload(uploaded,file,{contentType:file.type}));
        avatar=client().storage.from('atlas-media').getPublicUrl(uploaded).data.publicUrl;
      }
      if(uid()!==viewer||version!==token)throw new Error('Аккаунт изменился.');
      const payload={display_name:String(f.get('display_name')||'').trim(),nickname:String(f.get('nickname')||'').trim().replace(/^@+/,''),status_text:String(f.get('status_text')||'').trim(),avatar_url:avatar};
      const query=id?client().from('atlas_personas').update(payload).eq('id',id).is('character_id',null).eq('updated_at',old.updated_at):client().from('atlas_personas').insert({...payload,character_id:null});
      await checked(query.select('id').single());uploaded=null;
      if(uid()!==viewer||version!==token)return;
      saving=false;close();window.dispatchEvent(new CustomEvent('atlasCustomPersonasChanged'));
    }catch(e){
      if(uploaded)await client().storage.from('atlas-media').remove([uploaded]);
      if(uid()===viewer&&version===token)status(e.code==='23505'?'Этот никнейм уже занят.':e.message||'Не удалось сохранить.');
    }finally{saving=false;modal?.querySelectorAll('input,select,button').forEach(x=>x.disabled=false);}
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-direct-custom-personas]'))open()});
  window.addEventListener('atlasPlayerAuthReady',()=>{if(account&&uid()!==account){saving=false;close();}});
})();
