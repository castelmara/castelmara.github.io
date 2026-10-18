-- Original timestamps remain immutable; the displayed fictional date is separate.
alter table public.atlas_social_entries add column story_at timestamp;
grant update(story_at) on public.atlas_social_entries to authenticated;
create or replace function private.atlas_validate_social_entry() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare path text;
begin
  if auth.uid() is null or new.actor_id <> auth.uid() then
    raise exception 'Можно публиковать только со своего аккаунта' using errcode='42501';
  end if;
  if new.author_kind = 'atlas' and not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','superadmin')) then
    raise exception 'Публикации от АТЛАСА доступны только администрации' using errcode='42501';
  end if;
  if new.author_kind = 'character' and not exists(select 1 from public.character_owners co join public.atlas_character_catalog c on c.id=co.character_id where co.user_id=auth.uid() and co.character_id=new.character_id and c.active) then
    raise exception 'Выбери своего активного персонажа' using errcode='42501';
  end if;
  if new.parent_id is not null and not exists(select 1 from public.atlas_social_entries where id=new.parent_id and kind in ('topic','feed')) then
    raise exception 'Тема обсуждения не найдена';
  end if;
  if tg_op='UPDATE' then
    new.edited_at := clock_timestamp();
  else
    new.created_at := clock_timestamp();
    new.edited_at := null;
    foreach path in array new.images loop
      if path is null or path not like auth.uid()::text || '/social/%'
         or not exists(select 1 from storage.objects where bucket_id='atlas-media' and name=path and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp','image/gif','image/avif')) then
        raise exception 'Изображение не загружено или принадлежит другому аккаунту';
      end if;
    end loop;
  end if;
  return new;
end $$;

-- Replies can also be comments on a feed post; the existing ownership policies apply.
alter table public.atlas_player_messages add column audio_path text;
alter table public.atlas_player_messages add column audio_seconds integer;
alter table public.atlas_player_messages drop constraint atlas_player_messages_check;
alter table public.atlas_player_messages add constraint player_message_content check(length(btrim(body))>0 or cardinality(images)>0 or audio_path is not null);
alter table public.atlas_player_messages add constraint player_message_audio check((audio_path is null and audio_seconds is null) or (audio_path is not null and audio_seconds>0));
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','image/avif','audio/webm','audio/mp4','audio/ogg','audio/aac','audio/wav'] where id='atlas-player-chat';
create function private.atlas_validate_player_audio() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.audio_path is not null and (new.audio_path not like auth.uid()::text||'/'||new.room_id::text||'/%' or not exists(
 select 1 from storage.objects where bucket_id='atlas-player-chat' and name=new.audio_path and metadata->>'mimetype' in ('audio/webm','audio/mp4','audio/ogg','audio/aac','audio/wav'))) then
 raise exception 'Голосовое не принадлежит этому чату' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.atlas_validate_player_audio() from public,anon,authenticated;
create trigger validate_player_audio before insert on public.atlas_player_messages for each row execute function private.atlas_validate_player_audio();

create table public.atlas_player_reads (
 room_id uuid not null references public.atlas_player_rooms(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 read_at timestamptz not null,
 primary key(room_id,user_id)
);
create index atlas_player_reads_user on public.atlas_player_reads(user_id);
alter table public.atlas_player_reads enable row level security;
revoke all on public.atlas_player_reads from public,anon,authenticated;
grant select on public.atlas_player_reads to authenticated;
create policy player_reads_visible on public.atlas_player_reads for select to authenticated using(private.atlas_player_room_access(room_id));
-- Only a real message in an accessible room may move the caller's read cursor.
create function private.atlas_mark_player_read(p_room uuid,p_message uuid) returns void
language plpgsql security definer set search_path='' as $$
declare stamp timestamptz;
begin
 if auth.uid() is null or not private.atlas_player_room_access(p_room) then raise exception 'Нет доступа к переписке' using errcode='42501'; end if;
 select created_at into stamp from public.atlas_player_messages where id=p_message and room_id=p_room;
 if stamp is null then return; end if;
 insert into public.atlas_player_reads(room_id,user_id,read_at) values(p_room,auth.uid(),stamp)
 on conflict(room_id,user_id) do update set read_at=greatest(atlas_player_reads.read_at,excluded.read_at);
end $$;
revoke all on function private.atlas_mark_player_read(uuid,uuid) from public,anon;
grant execute on function private.atlas_mark_player_read(uuid,uuid) to authenticated;
create function public.atlas_mark_player_read(p_room uuid,p_message uuid) returns void
language sql security invoker set search_path='' begin atomic;
 select private.atlas_mark_player_read(p_room,p_message);
end;
revoke all on function public.atlas_mark_player_read(uuid,uuid) from public,anon;
grant execute on function public.atlas_mark_player_read(uuid,uuid) to authenticated;
alter publication supabase_realtime add table public.atlas_player_reads;
