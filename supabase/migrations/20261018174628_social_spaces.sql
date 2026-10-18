-- Shared social spaces. Existing Direct and player-profile posts are unchanged.
create table public.atlas_social_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('chat','feed','topic','reply')),
  parent_id uuid references public.atlas_social_entries(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  author_kind text not null check (author_kind in ('player','character','atlas')),
  character_id text references public.atlas_character_catalog(id),
  title text not null default '',
  body text not null default '',
  images text[] not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  edited_at timestamptz,
  constraint social_six_photos check (cardinality(images) <= 6),
  constraint social_content check (length(btrim(body)) > 0 or cardinality(images) > 0),
  constraint social_title check ((kind = 'topic' and length(btrim(title)) between 1 and 160) or (kind <> 'topic' and title = '')),
  constraint social_identity check (
    (kind = 'chat' and author_kind = 'player' and character_id is null and parent_id is null) or
    (kind = 'feed' and author_kind = 'character' and character_id is not null and parent_id is null) or
    (kind = 'topic' and author_kind = 'atlas' and character_id is null and parent_id is null) or
    (kind = 'reply' and parent_id is not null and
      ((author_kind = 'character' and character_id is not null) or (author_kind = 'atlas' and character_id is null)))
  )
);
create index atlas_social_stream on public.atlas_social_entries(kind,created_at desc,id desc);
create index atlas_social_thread on public.atlas_social_entries(parent_id,created_at,id) where parent_id is not null;
create index atlas_social_actor on public.atlas_social_entries(actor_id);
create index atlas_social_character on public.atlas_social_entries(character_id) where character_id is not null;

alter table public.atlas_social_entries enable row level security;
revoke all on public.atlas_social_entries from anon, authenticated;
grant select, insert, delete on public.atlas_social_entries to authenticated;
grant update(body,title) on public.atlas_social_entries to authenticated;
create policy social_read on public.atlas_social_entries for select to authenticated using (true);
create policy social_insert on public.atlas_social_entries for insert to authenticated
with check (actor_id = (select auth.uid()) and (
  author_kind = 'player' or
  (author_kind = 'character' and exists(select 1 from public.character_owners co where co.user_id = (select auth.uid()) and co.character_id = atlas_social_entries.character_id)) or
  (author_kind = 'atlas' and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','superadmin')))
));
create policy social_edit on public.atlas_social_entries for update to authenticated
using (actor_id = (select auth.uid())) with check (actor_id = (select auth.uid()));
create policy social_delete on public.atlas_social_entries for delete to authenticated
using (actor_id = (select auth.uid()) or exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','superadmin')));

create function private.atlas_validate_social_entry() returns trigger
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
  if new.parent_id is not null and not exists(select 1 from public.atlas_social_entries where id=new.parent_id and kind='topic') then
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
revoke all on function private.atlas_validate_social_entry() from public,anon,authenticated;
create trigger validate_social_entry before insert or update on public.atlas_social_entries
for each row execute function private.atlas_validate_social_entry();

-- Realtime subscribes only while one of the new spaces is visible.
alter publication supabase_realtime add table public.atlas_social_entries;
