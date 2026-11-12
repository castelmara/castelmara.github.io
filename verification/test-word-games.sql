-- Every test is rolled back: no player history, score or daily answer is changed.
begin;
do $$
declare u uuid;v uuid;g jsonb;h jsonb;secret text;first_word text;baseline integer;n integer;lev text;denied boolean;
begin
 select id into u from public.profiles order by created_at limit 1;
 select id into v from public.profiles where id<>u order by created_at limit 1;
 assert private.word_grade('касса','маска')=array['present','correct','correct','absent','correct'];
 assert not has_table_privilege('authenticated','private.word_games','select');
 assert not has_table_privilege('authenticated','public.atlas_word_stats','update');
 assert not has_function_privilege('anon','public.atlas_word_start(text,integer,text,boolean)','execute');
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 g:=public.atlas_word_start('daily',5,'normal',false);
 assert g->>'answer' is null;
 h:=public.atlas_word_start('daily',5,'normal',true);
 assert g->>'id'=h->>'id';
 execute 'reset role';
 select word into first_word from private.word_games where id=(g->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',v::text,true);
 execute 'set local role authenticated';
 h:=public.atlas_word_start('daily',5,'normal',false);
 denied:=false;
 begin perform public.atlas_word_play((g->>'id')::uuid,'',0,true);exception when raise_exception then denied:=true;end;
 assert denied;
 execute 'reset role';
 assert first_word=(select word from private.word_games where id=(h->>'id')::uuid);
 perform set_config('request.jwt.claim.sub',u::text,true);
 baseline:=coalesce((select solved from public.atlas_word_stats where user_id=u),0);
 for n in 4..8 loop
  foreach lev in array array['easy','normal','hard'] loop
   execute 'set local role authenticated';
   g:=public.atlas_word_start('practice',n,lev,true);
   assert (g->>'length')::integer=n;
   assert (g->>'max_attempts')::integer=case lev when 'easy' then 8 when 'hard' then 5 else 6 end;
   h:=public.atlas_word_start('practice',n,lev,true);
   assert g->>'id'=h->>'id';
   denied:=false;
   begin perform public.atlas_word_play((g->>'id')::uuid,repeat('ъ',n),0,false);exception when raise_exception then denied:=true;end;
   assert denied;
   execute 'reset role';
   select word into secret from private.word_games where id=(g->>'id')::uuid;
   assert secret<>first_word;
   execute 'set local role authenticated';
   h:=public.atlas_word_play((g->>'id')::uuid,secret,0,false);
   assert h->>'status'='won';
   perform public.atlas_word_play((g->>'id')::uuid,secret,0,false);
   execute 'reset role';
  end loop;
 end loop;
 assert (select solved from public.atlas_word_stats where user_id=u)=baseline+15;
 assert not exists(select word from private.word_games where user_id=u group by word having count(*)>1);
 perform set_config('request.jwt.claim.sub','',true);
 denied:=false;
 begin perform public.atlas_word_start('practice',5,'normal',false);exception when raise_exception then denied:=true;end;
 assert denied;
end $$;
rollback;
select 'word game checks passed; test changes rolled back' as result;
