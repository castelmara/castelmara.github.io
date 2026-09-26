(function() {
  'use strict';
  const table='atlas_player_personality_results';
  const client=()=>window.ATLAS_SUPABASE;
  const viewerId=()=>window.ATLAS_CURRENT_SESSION?.user?.id || '';
  function decode(row) {
    const engine=window.AtlasPersonalityEngine;
    if(!row || row.test_version!==engine.version || !engine.validateAnswers(row.answers)) return null;
    return {...row,...engine.scoreAnswers(row.answers)};
  }
  async function load(userId) {
    if(!client()) throw new Error('Supabase ещё загружается.');
    const {data,error}=await client().from(table).select('*').eq('user_id',userId).maybeSingle();
    if(error) throw error;
    return decode(data);
  }
  async function complete(userId,answers,version) {
    const engine=window.AtlasPersonalityEngine;
    if(!userId || viewerId()!==userId) throw new Error('Аккаунт изменился. Открой тест из своего профиля.');
    if(version!==engine.version || !engine.validateAnswers(answers)) throw new Error('Нужны ответы на все 24 вопроса.');
    const c=client();
    if(!c) throw new Error('Supabase ещё загружается.');
    const session=await c.auth.getSession();
    if(session.error || session.data?.session?.user?.id!==userId || viewerId()!==userId) throw new Error('Войди в аккаунт, с которого начат тест.');
    const scored=engine.scoreAnswers(answers);
    const {data,error}=await c.from(table).upsert({user_id:userId,test_version:version,answers:answers.slice(),primary_type:scored.primary_type,secondary_type:scored.secondary_type},{onConflict:'user_id'}).select('*').single();
    if(error) throw error;
    if(viewerId()!==userId) throw new Error('Аккаунт изменился. Результат сохранён для исходного игрока.');
    const result=decode(data);
    if(!result) throw new Error('Не удалось прочитать сохранённый результат.');
    window.dispatchEvent(new CustomEvent('atlasPersonalitySaved',{detail:{userId,result}}));
    return result;
  }
  window.AtlasPersonalityStore=Object.freeze({viewerId,load,complete});
})();
