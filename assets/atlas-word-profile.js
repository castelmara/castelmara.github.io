(function(){
 'use strict';
 window.atlasLoadWordStats=async function(id){
  const targets=[...document.querySelectorAll('[data-word-profile]')].filter(el=>el.dataset.wordProfile===id);
  if(!targets.length||!window.ATLAS_SUPABASE)return;
  try{
   const r=await window.ATLAS_SUPABASE.from('atlas_word_stats').select('solved').eq('user_id',id).maybeSingle();
   targets.forEach(el=>{if(el.isConnected)el.textContent=r.error?'—':String(r.data?.solved||0)});
  }catch(_){targets.forEach(el=>{if(el.isConnected)el.textContent='—'})}
 };
 window.addEventListener('atlasWordScoreChanged',()=>{document.querySelectorAll('[data-word-profile]').forEach(el=>window.atlasLoadWordStats(el.dataset.wordProfile))});
 document.querySelectorAll('[data-word-profile]').forEach(el=>window.atlasLoadWordStats(el.dataset.wordProfile));
})();
