create or replace function public.atlas_save_character_owners(p_user uuid, p_characters text[], p_expected text[])
returns void language plpgsql security invoker set search_path = '' as $$
declare current_ids text[]; selected_id text; item_order integer := 0;
begin
  if not exists (
    select 1 from public.profiles viewer
    where viewer.id=auth.uid() and (
      viewer.role='superadmin' or (viewer.role='admin' and exists(
        select 1 from public.profiles target where target.id=p_user and target.role='player'
      ))
    )
  ) then
    raise exception 'Нет прав менять персонажей этого аккаунта.' using errcode='42501';
  end if;
  if p_characters is null or p_expected is null or array_position(p_characters,null) is not null
     or cardinality(p_characters) <> (select count(distinct x) from unnest(p_characters) x) then
    raise exception 'Некорректный список персонажей.';
  end if;
  -- One short transaction prevents partial removal and concurrent reassignment.
  lock table public.character_owners in share row exclusive mode;
  select coalesce(array_agg(character_id order by character_id),array[]::text[])
    into current_ids from public.character_owners where user_id=p_user;
  if current_ids is distinct from array(select x from unnest(p_expected) x order by x) then
    raise exception 'Привязки уже изменились. Закройте редактор и откройте заново.';
  end if;
  foreach selected_id in array p_characters loop
    if exists(select 1 from public.character_owners where character_id=selected_id and user_id<>p_user) then
      raise exception 'Персонаж % уже принадлежит другому игроку.',selected_id;
    end if;
    if not (selected_id=any(current_ids)) and not exists(
      select 1 from public.atlas_character_catalog where id=selected_id and active
    ) then
      raise exception 'Персонаж % недоступен для назначения.',selected_id;
    end if;
  end loop;
  delete from public.character_owners where user_id=p_user and not(character_id=any(p_characters));
  foreach selected_id in array p_characters loop
    item_order := item_order+1;
    if selected_id=any(current_ids) then
      update public.character_owners set display_order=item_order where character_id=selected_id and user_id=p_user;
    else
      insert into public.character_owners(character_id,user_id,display_order) values(selected_id,p_user,item_order);
    end if;
  end loop;
end;
$$;
revoke all on function public.atlas_save_character_owners(uuid,text[],text[]) from public,anon;
grant execute on function public.atlas_save_character_owners(uuid,text[],text[]) to authenticated;
