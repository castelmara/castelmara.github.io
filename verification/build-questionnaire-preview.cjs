const fs=require('fs');
const cursorStyle=[...fs.readFileSync('index.html','utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].find(m=>m[1].includes('html.atlas-cursor-enabled'))?.[1]||'';
function mock(){
 document.documentElement.classList.add('atlas-cursor-enabled');const cursor=document.createElement('div');cursor.id='atlas-theme-cursor';cursor.className='is-visible';document.body.appendChild(cursor);document.addEventListener('mousemove',e=>{cursor.style.translate=e.clientX+'px '+e.clientY+'px'});
 const profile={id:'fixture-user',role:'superadmin'},character={id:'fixture-character',name:'Мартина Чавес Ромеро',active:true};
 window.ATLAS_CURRENT_SESSION={user:{id:profile.id}};window.ATLAS_CHARACTERS=[{...character,profile:{}}];
 const sample='Раздел I. Личное дело кандидата\n\nИмя: Мартина Чавес Ромеро\n\n\n\nБиография\n\nМартина выросла у моря. Это первый абзац её истории.\n\nВторой абзац сохраняет авторский текст и обычный интервал.\n\nХарактер\n\nРешительная и внимательная.';
 const submissions=[{id:'fixture-request',character_id:character.id,actor_id:profile.id,content:{fullName:character.name,faculty:'Факультет индивидуальных видов спорта',faceclaim:'laetitiafrt'},status:'pending',created_at:new Date().toISOString(),edited_text:sample,file_path:'fixture.txt',file_name:'Анкета.txt'}],publications=[],files=new Map([['fixture.txt',new Blob([sample],{type:'text/plain'})]]);
 window.ATLAS_SUPABASE={
  from(table){
   let filters=[],payload=null,single=false,start=0,end=999;
   const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(){return q},order(){return q},range(a,b){start=a;end=b;return q},single(){single=true;return q},insert(p){payload=p;return q},then(ok){
    let rows=table==='profiles'?[profile]:table==='character_owners'?[{user_id:profile.id,character_id:character.id}]:table==='atlas_character_catalog'?[character]:table==='atlas_questionnaire_submissions'?submissions:publications;
    if(payload)rows.unshift({...payload,id:crypto.randomUUID(),status:'pending',created_at:new Date().toISOString()});
    const data=rows.filter(r=>filters.every(f=>f(r))).slice(start,end+1);return Promise.resolve({data:single?data[0]:data}).then(ok);
   }};return q;
  },
  rpc(fn,p){const row=submissions.find(r=>r.id===p.p_id);if(fn==='atlas_save_questionnaire_text'){row.edited_text=p.p_text;row.edit_revision=(row.edit_revision||0)+1;return Promise.resolve({data:row.edit_revision})}row.edited_text=p.p_text;row.document_text=p.p_text;row.status=p.p_decision;row.review_note=p.p_note;if(row.status==='approved')publications.push({...row,submission_id:row.id});return Promise.resolve({data:null})},
  storage:{from(){return {upload:async(path,blob)=>{files.set(path,blob);return {data:{}}},download:async(path)=>({data:files.get(path)})}}}
 };
}
fs.writeFileSync('verification/questionnaire-preview.html','<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../assets/atlas-questionnaires.css"><style>'+cursorStyle+'</style><style>body{background:#090c10;color:white;font-family:Arial;margin:30px}</style></head><body><main id="atlas-app"><section id="atlas-page-mi-atlas"><div class="atlas-page-shell"><h1>mi atlas</h1></div></section></main><script>('+mock.toString()+')()</script><script src="../assets/atlas-questionnaires.js"></script></body></html>');
