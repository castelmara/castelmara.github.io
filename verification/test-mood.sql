-- Run against a migrated database. Every fixture and assignment rolls back.
begin;
do $test$
declare
  users uuid[];
  pool uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  picked uuid[];
  existing uuid;
  actual uuid;
  i integer;
begin
  select array_agg(id) into users from (select id from auth.users order by id limit 4) u;
  assert cardinality(users) = 4, 'Need four existing accounts for the rollback-only test';
  assert (select count(*) from public.daily_phrases where active and btrim(explanation) <> '') >= 371;
  assert not has_function_privilege('anon', 'public.get_today_random()', 'execute');
  assert not has_function_privilege('anon', 'public.atlas_today_mood()', 'execute');
  assert has_function_privilege('authenticated', 'public.atlas_today_mood()', 'execute');

  -- A stored result survives the new algorithm unchanged.
  select phrase_id into existing from public.daily_randoms
  where user_id = users[1] and random_date = (now() at time zone 'Europe/Madrid')::date;
  perform set_config('request.jwt.claim.sub', users[1]::text, true);
  select phrase_id into actual from public.get_today_random();
  if existing is not null then assert actual = existing; end if;
  select phrase_id into existing from public.get_today_random();
  assert existing = actual, 'Reload / another device must reuse the same row';

  -- Isolated three-card pool; no production change survives this transaction.
  update public.daily_phrases set active = false;
  for i in 1..3 loop
    insert into public.daily_phrases(id, phrase, explanation, active)
    values(pool[i], 'mood-test-' || pool[i], 'Test explanation', true);
  end loop;
  delete from public.daily_randoms
  where user_id = any(users) and random_date = (now() at time zone 'Europe/Madrid')::date;
  insert into public.daily_randoms(user_id, random_date, phrase_id)
  values(users[1], (now() at time zone 'Europe/Madrid')::date - 15, pool[1])
  on conflict (user_id, random_date) do update set phrase_id = excluded.phrase_id;

  for i in 1..4 loop
    perform set_config('request.jwt.claim.sub', users[i]::text, true);
    select phrase_id into actual from public.get_today_random();
    if i = 1 then assert actual <> pool[1], 'Avoid a result from 15 days ago'; end if;
    if i <= 3 then
      assert not (actual = any(coalesce(picked, array[]::uuid[]))), 'Draw unused moods before duplicates';
    end if;
    picked := array_append(picked, actual);
    select phrase_id into existing from public.get_today_random();
    assert existing = actual, 'Repeated call cannot reroll';
    assert (select explanation from public.atlas_today_mood()) = 'Test explanation';
  end loop;
  assert (select count(distinct x) from unnest(picked) x) = 3, 'Exhausted pool still returns a result';
  -- If the entire active pool is recent, a new day still gets a result.
  update public.daily_phrases set active = (id = pool[1]);
  delete from public.daily_randoms
  where user_id = users[1] and random_date = (now() at time zone 'Europe/Madrid')::date;
  perform set_config('request.jwt.claim.sub', users[1]::text, true);
  select phrase_id into actual from public.get_today_random();
  assert actual = pool[1], 'Small-pool fallback';
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.get_today_random();
    raise exception 'Guest unexpectedly received a mood';
  exception when raise_exception then
    if sqlerrm <> 'Сначала войдите в аккаунт' then raise; end if;
  end;
end;
$test$;
rollback;
