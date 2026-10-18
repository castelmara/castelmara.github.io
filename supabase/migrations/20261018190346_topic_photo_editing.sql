grant update(images) on public.atlas_social_entries to authenticated;
create function private.atlas_validate_topic_photo_edit() returns trigger
language plpgsql security invoker set search_path='' as $$
declare path text;
begin
 if new.images is not distinct from old.images then return new; end if;
 if new.kind <> 'topic' or auth.uid() is null or new.actor_id<>auth.uid() then
   raise exception 'Можно менять фотографии только в своей теме' using errcode='42501';
 end if;
 foreach path in array new.images loop
   if path=any(old.images) then continue; end if;
   if path is null or path not like auth.uid()::text||'/social/%' or
     not exists(select 1 from storage.objects where bucket_id='atlas-media' and name=path and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp','image/gif','image/avif')) then
     raise exception 'Фотография не загружена или принадлежит другому игроку';
   end if;
 end loop;
 return new;
end $$;
revoke all on function private.atlas_validate_topic_photo_edit() from public,anon,authenticated;
create trigger validate_topic_photo_edit before update of images on public.atlas_social_entries for each row execute function private.atlas_validate_topic_photo_edit();
