create table public.atlas_ttt_matches(
  id uuid primary key default gen_random_uuid(),
  x_user uuid not null references public.profiles(id),
  o_user uuid not null references public.profiles(id),
  board text[] not null default array['','','','','','','','',''],
  turn text not null default 'X',
  status text not null default 'invited' check(status in ('invited','active','finished','declined')),
  result text check(result in ('X','O','draw')),
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(x_user<>o_user)
);
create index atlas_ttt_x on public.atlas_ttt_matches(x_user,updated_at desc);
create index atlas_ttt_o on public.atlas_ttt_matches(o_user,updated_at desc);
create unique index atlas_ttt_open_pair on public.atlas_ttt_matches(least(x_user,o_user),greatest(x_user,o_user)) where status in ('invited','active');
alter table public.atlas_ttt_matches enable row level security;
revoke all on public.atlas_ttt_matches from anon,authenticated;
grant select on public.atlas_ttt_matches to authenticated;
create policy participants_read on public.atlas_ttt_matches for select to authenticated using ((select auth.uid()) in (x_user,o_user));

create function public.atlas_ttt_action(p_action text,p_match uuid default null,p_opponent uuid default null,p_cell integer default null,p_revision integer default null)
returns public.atlas_ttt_matches language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); m public.atlas_ttt_matches; mark text; line integer[];
begin
  if me is null then raise exception 'Войди в аккаунт.' using errcode='42501'; end if;
  if p_action='invite' then
    if p_opponent is null or p_opponent=me or not exists(select 1 from public.profiles where id=p_opponent) then raise exception 'Выбери другого игрока.'; end if;
    -- Serialize invitation checks for the creator, so concurrent clicks cannot flood invites.
    perform 1 from public.profiles where id=me for update;
    if exists(select 1 from public.atlas_ttt_matches where status in ('invited','active') and ((x_user=me and o_user=p_opponent) or (x_user=p_opponent and o_user=me))) then raise exception 'У вас уже есть приглашение или незавершённая партия.'; end if;
    if (select count(*) from public.atlas_ttt_matches where x_user=me and status='invited')>=10 then raise exception 'Сначала заверши или отмени другие приглашения.'; end if;
    insert into public.atlas_ttt_matches(x_user,o_user) values(me,p_opponent) returning * into m;return m;
  end if;
  select * into m from public.atlas_ttt_matches where id=p_match for update;
  if not found or me not in (m.x_user,m.o_user) then raise exception 'Нет доступа к партии.' using errcode='42501'; end if;
  if p_revision is distinct from m.revision then raise exception 'Партия уже обновилась. Повтори действие.'; end if;
  if p_action='accept' and m.status='invited' and me=m.o_user then m.status:='active';
  elsif p_action='decline' and m.status='invited' then m.status:='declined';
  elsif p_action='resign' and m.status='active' then m.status:='finished';m.result:=case when me=m.x_user then 'O' else 'X' end;
  elsif p_action='move' and m.status='active' then
    mark:=case when me=m.x_user then 'X' else 'O' end;
    if mark<>m.turn then raise exception 'Сейчас ход соперника.'; end if;
    if p_cell is null or p_cell<0 or p_cell>8 or m.board[p_cell+1]<>'' then raise exception 'Выбери свободную клетку.'; end if;
    m.board[p_cell+1]:=mark;
    foreach line slice 1 in array array[[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9],[3,5,7]] loop
      if m.board[line[1]]=mark and m.board[line[2]]=mark and m.board[line[3]]=mark then m.result:=mark;exit; end if;
    end loop;
    if m.result is not null then m.status:='finished';
    elsif not (''=any(m.board)) then m.status:='finished';m.result:='draw';
    else m.turn:=case when mark='X' then 'O' else 'X' end;end if;
  else raise exception 'Это действие сейчас недоступно.';end if;
  update public.atlas_ttt_matches set board=m.board,turn=m.turn,status=m.status,result=m.result,revision=revision+1,updated_at=now() where id=m.id returning * into m;
  return m;
end;
$$;
revoke all on function public.atlas_ttt_action(text,uuid,uuid,integer,integer) from public;
grant execute on function public.atlas_ttt_action(text,uuid,uuid,integer,integer) to authenticated;
