create table public.atlas_chess_matches (
 id uuid primary key default gen_random_uuid(),
 white_user uuid not null references public.profiles(id),
 black_user uuid not null references public.profiles(id),
 pgn text not null default '',
 fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
 turn text not null default 'w' check(turn in ('w','b')),
 status text not null default 'invited' check(status in ('invited','active','finished','declined')),
 result text check(result in ('w','b','draw')),
 revision integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(white_user<>black_user)
);
create index atlas_chess_white on public.atlas_chess_matches(white_user,updated_at desc);
create index atlas_chess_black on public.atlas_chess_matches(black_user,updated_at desc);
create unique index atlas_chess_open_pair on public.atlas_chess_matches(least(white_user,black_user),greatest(white_user,black_user)) where status in ('invited','active');
alter table public.atlas_chess_matches enable row level security;
revoke all on public.atlas_chess_matches from public,anon,authenticated;
grant select on public.atlas_chess_matches to authenticated;
grant all on public.atlas_chess_matches to service_role;
create policy participants_read on public.atlas_chess_matches for select to authenticated using((select auth.uid()) in (white_user,black_user));

-- Only the authenticated Edge endpoint calls this using its server-only key.
-- No SECURITY DEFINER: service_role already has the explicit required privileges.
create function public.atlas_chess_write(p_actor uuid,p_action text,p_match uuid default null,p_opponent uuid default null,p_revision integer default null,p_state jsonb default null)
returns public.atlas_chess_matches language plpgsql security invoker set search_path='' as $$
declare m public.atlas_chess_matches;
begin
 if p_actor is null then raise exception 'Войди в аккаунт.' using errcode='42501';end if;
 if p_action='invite' then
  if p_opponent is null or p_actor=p_opponent or not exists(select 1 from public.profiles where id=p_opponent) then raise exception 'Выбери другого игрока.';end if;
  perform 1 from public.profiles where id=p_actor for update;
  if not found then raise exception 'Аккаунт не найден.';end if;
  if (select count(*) from public.atlas_chess_matches where white_user=p_actor and status in ('invited','active'))>=10 then raise exception 'Сначала заверши или отмени другие партии.';end if;
  insert into public.atlas_chess_matches(white_user,black_user) values(p_actor,p_opponent) returning * into m;return m;
 end if;
 select * into m from public.atlas_chess_matches where id=p_match for update;
 if not found or p_actor not in(m.white_user,m.black_user) then raise exception 'Нет доступа к партии.' using errcode='42501';end if;
 if p_revision is distinct from m.revision then raise exception 'Партия обновилась. Обнови её и повтори действие.' using errcode='40001';end if;
 if p_action='accept' and m.status='invited' and p_actor=m.black_user then m.status:='active';
 elsif p_action='decline' and m.status='invited' then m.status:='declined';
 elsif p_action='resign' and m.status='active' then m.status:='finished';m.result:=case when p_actor=m.white_user then 'b' else 'w' end;
 elsif p_action='move' and m.status='active' then
  if p_actor<>(case when m.turn='w' then m.white_user else m.black_user end) then raise exception 'Сейчас ход соперника.';end if;
  if p_state is null or p_state->>'pgn' is null or p_state->>'fen' is null or p_state->>'turn' not in ('w','b') then raise exception 'Некорректный ход.';end if;
  m.pgn:=p_state->>'pgn';m.fen:=p_state->>'fen';m.turn:=p_state->>'turn';m.result:=p_state->>'result';
  if m.result is not null then m.status:='finished';end if;
 else raise exception 'Действие недоступно.';end if;
 update public.atlas_chess_matches set pgn=m.pgn,fen=m.fen,turn=m.turn,status=m.status,result=m.result,revision=revision+1,updated_at=now() where id=m.id returning * into m;
 return m;
end;
$$;
revoke all on function public.atlas_chess_write(uuid,text,uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_chess_write(uuid,text,uuid,uuid,integer,jsonb) to service_role;
