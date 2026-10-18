alter table public.atlas_social_entries drop constraint social_identity;
alter table public.atlas_social_entries add constraint social_identity check (
 (kind='chat' and author_kind='player' and character_id is null and parent_id is null) or
 (kind='feed' and author_kind='character' and character_id is not null and parent_id is null) or
 (kind in ('topic','reply') and ((kind='topic' and parent_id is null) or (kind='reply' and parent_id is not null)) and
   ((author_kind='atlas' and character_id is null) or (author_kind='character' and character_id is not null)))
);
alter table public.atlas_social_entries drop constraint social_content;
alter table public.atlas_social_entries add constraint social_content check(kind='topic' or length(btrim(body))>0 or cardinality(images)>0);

create table public.atlas_player_rooms (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('general','dm','group')),
 title text not null default '',
 creator_id uuid references public.profiles(id),
 dm_key text unique,
 created_at timestamptz not null default clock_timestamp()
);
create unique index atlas_one_player_general on public.atlas_player_rooms(kind) where kind='general';
create index atlas_player_rooms_creator on public.atlas_player_rooms(creator_id);
create table public.atlas_player_room_members (
 room_id uuid not null references public.atlas_player_rooms(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 primary key(room_id,user_id)
);
create index atlas_player_members_user on public.atlas_player_room_members(user_id,room_id);
create table public.atlas_player_messages (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.atlas_player_rooms(id) on delete cascade,
 sender_id uuid not null references public.profiles(id),
 body text not null default '',
 images text[] not null default '{}',
 created_at timestamptz not null default clock_timestamp(),
 edited_at timestamptz,
 check(length(btrim(body))>0 or cardinality(images)>0),
 check(cardinality(images)<=6)
);
create index atlas_player_messages_room_time on public.atlas_player_messages(room_id,created_at desc,id desc);
create index atlas_player_messages_sender on public.atlas_player_messages(sender_id);
alter table public.atlas_player_rooms enable row level security;
alter table public.atlas_player_room_members enable row level security;
alter table public.atlas_player_messages enable row level security;
revoke all on public.atlas_player_rooms,public.atlas_player_room_members,public.atlas_player_messages from anon,authenticated;
grant select on public.atlas_player_rooms,public.atlas_player_room_members to authenticated;
grant select,insert,delete on public.atlas_player_messages to authenticated;
grant update(body) on public.atlas_player_messages to authenticated;

-- Private helpers avoid recursive membership policies. Every entry checks auth.uid().
create function private.atlas_player_room_access(p_room uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.atlas_player_rooms r where r.id=p_room and
 (r.kind='general' or exists(select 1 from public.atlas_player_room_members m where m.room_id=r.id and m.user_id=auth.uid())))
$$;
revoke all on function private.atlas_player_room_access(uuid) from public,anon;
grant execute on function private.atlas_player_room_access(uuid) to authenticated;
create policy player_rooms_read on public.atlas_player_rooms for select to authenticated using(private.atlas_player_room_access(id));
create policy player_members_read on public.atlas_player_room_members for select to authenticated using(private.atlas_player_room_access(room_id));
create policy player_messages_read on public.atlas_player_messages for select to authenticated using(private.atlas_player_room_access(room_id));
create policy player_messages_insert on public.atlas_player_messages for insert to authenticated with check(sender_id=(select auth.uid()) and private.atlas_player_room_access(room_id));
create policy player_messages_update on public.atlas_player_messages for update to authenticated using(sender_id=(select auth.uid()) and private.atlas_player_room_access(room_id)) with check(sender_id=(select auth.uid()) and private.atlas_player_room_access(room_id));
create policy player_messages_delete on public.atlas_player_messages for delete to authenticated using(private.atlas_player_room_access(room_id) and
 (sender_id=(select auth.uid()) or exists(select 1 from public.atlas_player_rooms r where r.id=room_id and
 ((r.kind='group' and r.creator_id=(select auth.uid())) or (r.kind='general' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','superadmin')))))));

create function private.atlas_create_player_room(p_kind text,p_title text,p_users uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); members uuid[]; new_room uuid; key text;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor) then raise exception 'Войди в аккаунт' using errcode='42501'; end if;
 if p_kind not in ('dm','group') or p_kind is null then raise exception 'Неизвестный тип чата'; end if;
 select array_agg(distinct u order by u) into members from unnest(array_append(coalesce(p_users,'{}'),actor)) u where u is not null;
 if cardinality(members)<2 or (p_kind='dm' and cardinality(members)<>2) then raise exception 'Выбери участников'; end if;
 if exists(select 1 from unnest(members) u where not exists(select 1 from public.profiles where id=u)) then raise exception 'Игрок не найден'; end if;
 if p_kind='group' and (p_title is null or length(btrim(p_title)) not between 1 and 120) then raise exception 'Укажи название чата (до 120 символов)'; end if;
 if p_kind='dm' then
   key:=array_to_string(members,':');
   -- Canonical pair plus unique constraint makes simultaneous DM creation idempotent.
   insert into public.atlas_player_rooms(kind,creator_id,dm_key) values('dm',actor,key)
   on conflict(dm_key) do update set dm_key=excluded.dm_key returning id into new_room;
 else
   insert into public.atlas_player_rooms(kind,title,creator_id) values('group',btrim(p_title),actor) returning id into new_room;
 end if;
 insert into public.atlas_player_room_members(room_id,user_id) select new_room,unnest(members) on conflict do nothing;
 return new_room;
end $$;
revoke all on function private.atlas_create_player_room(text,text,uuid[]) from public,anon;
grant execute on function private.atlas_create_player_room(text,text,uuid[]) to authenticated;
create function public.atlas_create_player_room(p_kind text,p_title text default '',p_users uuid[] default '{}') returns uuid
language sql security invoker set search_path='' as $$ select private.atlas_create_player_room(p_kind,p_title,p_users) $$;
revoke all on function public.atlas_create_player_room(text,text,uuid[]) from public,anon;
grant execute on function public.atlas_create_player_room(text,text,uuid[]) to authenticated;

insert into public.atlas_player_rooms(kind,title) values('general','Общий чат игроков');
-- Preserve any messages sent during preview rollout.
insert into public.atlas_player_messages(id,room_id,sender_id,body,created_at,edited_at)
select e.id,r.id,e.actor_id,e.body,e.created_at,e.edited_at from public.atlas_social_entries e
cross join public.atlas_player_rooms r where e.kind='chat' and r.kind='general' and cardinality(e.images)=0;

insert into storage.buckets(id,name,public,allowed_mime_types) values('atlas-player-chat','atlas-player-chat',false,array['image/jpeg','image/png','image/webp','image/gif','image/avif']);
create function private.atlas_player_file_access(p_path text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
begin
 if split_part(p_path,'/',2) !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
 return private.atlas_player_room_access(split_part(p_path,'/',2)::uuid);
end $$;
revoke all on function private.atlas_player_file_access(text) from public,anon;
grant execute on function private.atlas_player_file_access(text) to authenticated;
create policy player_chat_files_read on storage.objects for select to authenticated using(bucket_id='atlas-player-chat' and private.atlas_player_file_access(name));
create policy player_chat_files_insert on storage.objects for insert to authenticated with check(bucket_id='atlas-player-chat' and split_part(name,'/',1)=(select auth.uid())::text and private.atlas_player_file_access(name));
create policy player_chat_files_delete on storage.objects for delete to authenticated using(bucket_id='atlas-player-chat' and split_part(name,'/',1)=(select auth.uid())::text and private.atlas_player_file_access(name));

create function private.atlas_validate_player_message() returns trigger
language plpgsql security invoker set search_path='' as $$
declare path text;
begin
 if auth.uid() is null or new.sender_id<>auth.uid() then raise exception 'Можно писать только от своего лица' using errcode='42501'; end if;
 if tg_op='INSERT' then
   new.created_at:=clock_timestamp(); new.edited_at:=null;
   foreach path in array new.images loop
     if path is null or path not like auth.uid()::text||'/'||new.room_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='atlas-player-chat' and name=path and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp','image/gif','image/avif')) then raise exception 'Фотография не принадлежит этому чату'; end if;
   end loop;
 else new.edited_at:=clock_timestamp(); end if;
 return new;
end $$;
revoke all on function private.atlas_validate_player_message() from public,anon,authenticated;
create trigger validate_player_message before insert or update on public.atlas_player_messages for each row execute function private.atlas_validate_player_message();
alter publication supabase_realtime add table public.atlas_player_rooms,public.atlas_player_room_members,public.atlas_player_messages;
