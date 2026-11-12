-- Secrets and played-word history are never exposed through the Data API.
create table private.word_dictionary(word text primary key check(word ~ '^[а-я]{4,8}$'), daily boolean not null default false, answerable boolean not null default true);
create table private.word_days(day date primary key, word text not null unique references private.word_dictionary);
create table private.word_games(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 word text not null references private.word_dictionary, mode text not null check(mode in ('daily','practice')),
 day date, level text not null check(level in ('easy','normal','hard')), max_attempts integer not null,
 guesses text[] not null default '{}', status text not null default 'playing' check(status in ('playing','won','lost','skipped')),
 created_at timestamptz not null default now(), unique(user_id,word),unique(user_id,day)
);
create unique index word_one_practice on private.word_games(user_id) where mode='practice' and status='playing';
create index word_games_recent on private.word_games(user_id,mode,created_at desc);
alter table private.word_dictionary enable row level security;
alter table private.word_days enable row level security;
alter table private.word_games enable row level security;
revoke all on private.word_dictionary,private.word_days,private.word_games from public,anon,authenticated;
create table public.atlas_word_stats(user_id uuid primary key references public.profiles(id) on delete cascade, solved integer not null default 0, daily_solved integer not null default 0);
alter table public.atlas_word_stats enable row level security;
create policy word_stats_read on public.atlas_word_stats for select to anon,authenticated using(true);
revoke all on public.atlas_word_stats from public,anon,authenticated;
grant select on public.atlas_word_stats to anon,authenticated;

create function private.word_grade(g text,s text) returns text[] language plpgsql immutable set search_path='' as $$
declare marks text[]:=array_fill('absent'::text,array[char_length(s)]); rest text:=s; i integer; pos integer;
begin
 for i in 1..char_length(s) loop
  if substr(g,i,1)=substr(s,i,1) then marks[i]:='correct';rest:=overlay(rest placing '_' from i for 1);end if;
 end loop;
 for i in 1..char_length(s) loop
  if marks[i]='correct' then continue;end if;
  pos:=strpos(rest,substr(g,i,1));
  if pos>0 then marks[i]:='present';rest:=overlay(rest placing '_' from pos for 1);end if;
 end loop;
 return marks;
end $$;
create function private.word_state(g private.word_games) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',g.id,'mode',g.mode,'day',g.day,'length',char_length(g.word),'level',g.level,'max_attempts',g.max_attempts,'guesses',g.guesses,'status',g.status,
 'marks',coalesce((select jsonb_agg(private.word_grade(x,g.word) order by n) from unnest(g.guesses) with ordinality a(x,n)),'[]'::jsonb),
 'answer',case when g.status<>'playing' then g.word end,
 'solved',coalesce((select solved from public.atlas_word_stats where user_id=g.user_id),0));
$$;
create function private.word_start(p_mode text,p_length integer,p_level text,p_next boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); d date:=(now() at time zone 'Europe/Madrid')::date; g private.word_games; secret text;
begin
 if u is null then raise exception 'Войди в аккаунт, чтобы играть.';end if;
 if p_mode is null or p_mode not in ('daily','practice') or p_length is null or p_length not between 4 and 8 or p_level is null or p_level not in ('easy','normal','hard') or p_next is null then raise exception 'Некорректные настройки.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,121));
 if p_mode='daily' then
  select * into g from private.word_games where user_id=u and day=d;
  if found then return private.word_state(g);end if;
  perform pg_advisory_xact_lock(12112026);
  select word into secret from private.word_days where day=d;
  if secret is null then
   select w.word into secret from private.word_dictionary w where w.daily and w.answerable and not exists(select 1 from private.word_days wd where wd.word=w.word) order by random() limit 1;
   if secret is null then raise exception 'Ежедневный набор закончился. Новые слова появятся после обновления словаря.';end if;
   insert into private.word_days values(d,secret);
  end if;
  p_level:='normal';
 else
  select * into g from private.word_games where user_id=u and mode='practice' and status='playing';
  if found then return private.word_state(g);end if;
  if not p_next then
   select * into g from private.word_games where user_id=u and mode='practice' and char_length(word)=p_length and level=p_level order by created_at desc limit 1;
   if found then return private.word_state(g);end if;
  end if;
  select w.word into secret from private.word_dictionary w where not w.daily and w.answerable and char_length(w.word)=p_length and not exists(select 1 from private.word_games played where played.user_id=u and played.word=w.word) order by random() limit 1;
  if secret is null then raise exception 'Ты уже сыграл все слова этой длины. Выбери другое количество букв — повторять слова не будем.';end if;
 end if;
 insert into private.word_games(user_id,word,mode,day,level,max_attempts) values(u,secret,p_mode,case when p_mode='daily' then d end,p_level,case p_level when 'easy' then 8 when 'hard' then 5 else 6 end) returning * into g;
 return private.word_state(g);
end $$;
create function private.word_play(p_id uuid,p_guess text,p_expected integer,p_skip boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();g private.word_games;guess text:=replace(lower(btrim(p_guess)),'ё','е');
begin
 if u is null then raise exception 'Войди в аккаунт.';end if;
 select * into g from private.word_games where id=p_id and user_id=u for update;
 if not found then raise exception 'Партия не найдена.';end if;
 if g.status<>'playing' then return private.word_state(g);end if;
 if p_expected is distinct from cardinality(g.guesses) then return private.word_state(g);end if;
 if p_skip is true then g.status:='skipped';
 else
  if guess is null or char_length(guess)<>char_length(g.word) then raise exception 'Проверь количество букв.';end if;
  if not exists(select 1 from private.word_dictionary where word=guess) then raise exception 'Такого существительного нет в игровом словаре.';end if;
  if guess=any(g.guesses) then raise exception 'Это слово уже проверено.';end if;
  g.guesses:=array_append(g.guesses,guess);
  if guess=g.word then g.status:='won';elsif cardinality(g.guesses)>=g.max_attempts then g.status:='lost';end if;
 end if;
 update private.word_games set guesses=g.guesses,status=g.status where id=g.id;
 if g.status='won' then
  insert into public.atlas_word_stats(user_id,solved,daily_solved) values(u,1,case when g.mode='daily' then 1 else 0 end)
  on conflict(user_id) do update set solved=atlas_word_stats.solved+1,daily_solved=atlas_word_stats.daily_solved+excluded.daily_solved;
 end if;
 return private.word_state(g);
end $$;
-- Public invoker wrappers only reach authenticated, narrowly scoped entry points.
create function public.atlas_word_start(p_mode text default 'daily',p_length integer default 5,p_level text default 'normal',p_next boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.word_start(p_mode,p_length,p_level,p_next) $$;
create function public.atlas_word_play(p_id uuid,p_guess text default '',p_expected integer default 0,p_skip boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.word_play(p_id,p_guess,p_expected,p_skip) $$;
revoke all on function private.word_grade(text,text),private.word_state(private.word_games),private.word_start(text,integer,text,boolean),private.word_play(uuid,text,integer,boolean),public.atlas_word_start(text,integer,text,boolean),public.atlas_word_play(uuid,text,integer,boolean) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.word_start(text,integer,text,boolean),private.word_play(uuid,text,integer,boolean),public.atlas_word_start(text,integer,text,boolean),public.atlas_word_play(uuid,text,integer,boolean) to authenticated;
