-- Run as the migration/database owner. Uses two existing accounts, rolls back all fixture writes.
begin;
select set_config('atlas.test_a', (select id::text from auth.users order by id limit 1), true);
select set_config('atlas.test_b', (select id::text from auth.users order by id offset 1 limit 1), true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('atlas.test_a'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.atlas_player_personality_results(user_id,test_version,primary_type,answers)
values(current_setting('atlas.test_a')::uuid,'personality_test_v1','captain',to_jsonb(array_fill('A'::text,array[24])));
update public.atlas_player_personality_results set answers=to_jsonb(array_fill('B'::text,array[24])),primary_type='ghost'
where user_id=current_setting('atlas.test_a')::uuid;
do $$ begin
 if not exists(select 1 from public.atlas_player_personality_results where user_id=current_setting('atlas.test_a')::uuid and primary_type='ghost') then raise exception 'owner retake failed'; end if;
 begin
  update public.atlas_player_personality_results set answers='[null]'::jsonb where user_id=current_setting('atlas.test_a')::uuid;
  raise exception 'invalid answers accepted';
 exception when check_violation then null; end;
 begin
  insert into public.atlas_player_personality_results(user_id,test_version,primary_type,answers)
  values(current_setting('atlas.test_b')::uuid,'personality_test_v1','ghost',to_jsonb(array_fill('A'::text,array[24])));
  raise exception 'foreign insert accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('atlas.test_b'),'role','authenticated')::text,true);
do $$ declare n int; begin
 if not exists(select 1 from public.atlas_player_personality_results where user_id=current_setting('atlas.test_a')::uuid) then raise exception 'B cannot read A'; end if;
 update public.atlas_player_personality_results set primary_type='spark' where user_id=current_setting('atlas.test_a')::uuid;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'B updated A'; end if;
 begin
  delete from public.atlas_player_personality_results where user_id=current_setting('atlas.test_a')::uuid;
  raise exception 'delete allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 if not exists(select 1 from public.atlas_player_personality_results where user_id=current_setting('atlas.test_a')::uuid and primary_type='ghost') then raise exception 'guest read failed'; end if;
 begin
  update public.atlas_player_personality_results set primary_type='spark';
  raise exception 'guest write allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS owner insert/retake, public/guest read, foreign insert/update denial, guest write denial, invalid answers rejected; all test writes rolled back' as result;
