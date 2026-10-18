// Isolated browser fixture: no Supabase requests or real publications.
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const mock = function () {
  window.ATLAS_CURRENT_SESSION={user:{id:'preview-player'}};
  document.getElementById('atlas-dark-loader')?.remove();
  const profile={id:'preview-player',nickname:'atlas_preview',display_name:'Игрок',role:'admin'};
  window.ATLAS_CURRENT_PROFILE=profile;
  const friend={id:'preview-friend',nickname:'martina',display_name:'Мартина',avatar_url:new URL('assets/characters/vanessa-moreno.jpg',document.baseURI).href};
  const members=[{user_id:profile.id,profile},{user_id:friend.id,profile:friend}];
  const rooms=[{id:'general',kind:'general',title:'Общий чат игроков',members:[],created_at:'2026-10-18'}, {id:'dm',kind:'dm',title:'',members,created_at:'2026-10-18'}, {id:'group',kind:'group',title:'Вечерние разговоры',creator_id:profile.id,members,created_at:'2026-10-18'}];
  let messages=[];let reads=[];
  const character={id:'preview-character',name:'Martina Chávez Romero',image:new URL('assets/characters/vanessa-moreno.jpg',document.baseURI).href};
  window.ATLAS_CHARACTERS=[character];
  let records=[];
  if(new URLSearchParams(location.search).has('mediaTest')){
    records=[{id:'test-post',kind:'feed',actor_id:profile.id,author_kind:'character',character_id:character.id,character,player:profile,body:'Вечер в Кастельмаре.',images:['assets/characters/vanessa-moreno.jpg'],created_at:'2026-10-18T18:00:00Z',story_at:'2024-10-10T18:30:00'}, {id:'friend-post',kind:'feed',actor_id:friend.id,author_kind:'character',character_id:character.id,character,player:friend,body:'До встречи на тренировке.',images:[],created_at:'2026-10-17T18:00:00Z'}];
    messages=[{id:'test-message',room_id:'dm',sender_id:profile.id,body:'Привет!',images:[],created_at:'2026-10-18T18:00:00Z',player:profile}];
    reads=[{room_id:'dm',user_id:friend.id,read_at:'2026-10-18T18:01:00Z'}];
    // Exercise the real MediaRecorder with a generated tone, never the user's microphone.
    navigator.mediaDevices.getUserMedia=async()=>{const ctx=new AudioContext();await ctx.resume();const tone=ctx.createOscillator(),dest=ctx.createMediaStreamDestination();tone.connect(dest);tone.start();const track=dest.stream.getAudioTracks()[0],stop=track.stop.bind(track);track.stop=()=>{stop();tone.stop();ctx.close()};return dest.stream};
  }
  const uploadedPhotos=new Map();
  window.ATLAS_SUPABASE={
    from(table){let filters=[],limit=30,mode='read',payload,single=false,order=false;
      const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},neq(k,v){filters.push(r=>r[k]!==v);return q},in(){return q},or(){return q},order(k,opts){if(k==='created_at')order=opts.ascending;return q},limit(n){limit=n;return q},single(){single=true;return q},insert(p){mode='insert';payload=p;return q},update(p){mode='update';payload=p;return q},delete(){mode='delete';return q},then(ok){
        let rows=table==='profiles'?[profile,friend]:table==='atlas_player_rooms'?rooms:table==='atlas_player_messages'?messages:table==='atlas_player_reads'?reads:table==='character_owners'?[{character_id:character.id,user_id:profile.id}]:table==='atlas_character_catalog'?[{...character,active:true}]:records;
        rows=rows.filter(r=>filters.every(f=>f(r)));
        if(mode==='insert'){const r={...payload,id:crypto.randomUUID(),created_at:new Date().toISOString(),player:profile,character};(table==='atlas_player_messages'?messages:table==='atlas_player_reads'?reads:records).unshift(r);rows=[r]}
        if(mode==='update'){rows.forEach(r=>Object.assign(r,payload,{edited_at:new Date().toISOString()}))}
        if(mode==='delete'){if(table==='atlas_player_messages')messages=messages.filter(r=>!rows.includes(r));else records=records.filter(r=>!rows.includes(r))}
        rows=rows.slice().sort((a,b)=>order?String(a.created_at).localeCompare(String(b.created_at)):String(b.created_at).localeCompare(String(a.created_at))).slice(0,limit);
        return Promise.resolve({data:single?rows[0]:rows}).then(ok);
      }};return q;
    },
    storage:{from(){return {async createSignedUrls(paths){return {data:paths.map(path=>({path,signedUrl:uploadedPhotos.get(path)}))}},getPublicUrl(path){return {data:{publicUrl:uploadedPhotos.get(path)||new URL(path,document.baseURI).href}}},async upload(path,file){uploadedPhotos.set(path,URL.createObjectURL(file));return {data:{path}}},async remove(paths){paths.forEach(p=>{URL.revokeObjectURL(uploadedPhotos.get(p));uploadedPhotos.delete(p)});return {data:[]}}}}},
    channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},
    rpc(fn,args){if(fn==='atlas_mark_player_read'){const msg=messages.find(m=>m.id===args.p_message);if(msg)reads=[...reads.filter(r=>r.user_id!==profile.id||r.room_id!==args.p_room),{room_id:args.p_room,user_id:profile.id,read_at:msg.created_at}];return Promise.resolve({data:null})}if(!args.p_users.length)return Promise.resolve({error:{message:'Выбери участников'}});if(args.p_kind==='dm')return Promise.resolve({data:'dm'});const room={id:crypto.randomUUID(),kind:'group',title:args.p_title,creator_id:profile.id,members,created_at:new Date().toISOString()};rooms.push(room);return Promise.resolve({data:room.id})}
  };
  const app=document.getElementById('atlas-app');app.dataset.theme='dark';
  function route(page){if(!['charla','muro','debates'].includes(page))return;const holder=document.getElementById('atlas-pages-holder');holder.innerHTML='';holder.appendChild(document.querySelector('template[data-atlas-page-template="'+page+'"]').content.cloneNode(true));holder.firstElementChild.classList.add('active');document.querySelectorAll('[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===page));history.replaceState(null,'',location.pathname+location.search+'#'+page);window.atlasRenderSocial?.(page,true)}
  document.addEventListener('click',e=>{const nav=e.target.closest('[data-page]');if(nav)route(nav.dataset.page)});
  route(location.hash.slice(1)||'muro');
};
fs.writeFileSync('verification/social-preview.html',html.replace('<head>','<head><base href="../">').replace('</body>','<script>('+mock.toString()+')()</script><script src="assets/atlas-social.js?v=20261018-clean-copy"></script><script src="assets/atlas-voice-recorder.js"></script><script src="assets/atlas-player-messenger.js"></script><script src="assets/atlas-direct-emoji.js"></script><script src="assets/atlas-media-viewer.js"></script></body>'));
console.log('Created isolated social-preview.html');
