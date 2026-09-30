-- NULL character_id denotes a Direct-only persona, never a catalog character.
alter table public.atlas_personas alter column character_id drop not null;

create function private.atlas_can_manage_custom_personas(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=p_user and
    (p.role='superadmin' or (p.role='admin' and p.id='c8e46ed6-7024-467e-914b-f74b57f20f9c'::uuid)));
$$;
revoke all on function private.atlas_can_manage_custom_personas(uuid) from public;
grant execute on function private.atlas_can_manage_custom_personas(uuid) to authenticated;

create function public.atlas_can_manage_custom_personas()
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.atlas_can_manage_custom_personas(auth.uid());
$$;
revoke all on function public.atlas_can_manage_custom_personas() from public;
grant execute on function public.atlas_can_manage_custom_personas() to authenticated;

create or replace function private.atlas_prepare_persona()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if tg_op='UPDATE' and new.character_id is distinct from old.character_id then
    raise exception 'персонажа atlas persona менять нельзя';
  end if;
  new.display_name := trim(new.display_name);
  new.nickname := lower(regexp_replace(trim(new.nickname),'^@+',''));
  new.avatar_url := nullif(trim(coalesce(new.avatar_url,'')),'');
  new.status_text := nullif(trim(coalesce(new.status_text,'')),'');
  if new.character_id is null then
    if not private.atlas_can_manage_custom_personas(auth.uid()) then
      raise exception 'нет прав на служебные аккаунты ATLAS' using errcode='42501';
    end if;
    if tg_op='INSERT' then new.owner_user_id := auth.uid();
    else new.owner_user_id := old.owner_user_id; end if;
  else
    select co.user_id into v_owner from public.character_owners co where co.character_id=new.character_id;
    if tg_op='INSERT' and v_owner is null then raise exception 'сначала закрепи персонажа за игроком'; end if;
    new.owner_user_id := v_owner;
  end if;
  if tg_op='UPDATE' then new.updated_at := now(); end if;
  return new;
end;
$$;

drop policy "atlas personas insert" on public.atlas_personas;
create policy "atlas personas insert" on public.atlas_personas for insert to authenticated with check (
  case when character_id is null then private.atlas_can_manage_custom_personas(auth.uid())
  else private.atlas_can_manage_persona(owner_user_id) and exists(select 1 from public.character_owners co where co.character_id=atlas_personas.character_id and co.user_id=atlas_personas.owner_user_id) end
);
drop policy "atlas personas update" on public.atlas_personas;
create policy "atlas personas update" on public.atlas_personas for update to authenticated using (
  case when character_id is null then private.atlas_can_manage_custom_personas(auth.uid()) else private.atlas_can_manage_persona(owner_user_id) end
) with check (
  case when character_id is null then private.atlas_can_manage_custom_personas(auth.uid())
  else private.atlas_can_manage_persona(owner_user_id) and (owner_user_id is null or exists(select 1 from public.character_owners co where co.character_id=atlas_personas.character_id and co.user_id=atlas_personas.owner_user_id)) end
);

create or replace function private.atlas_can_use_persona(p_persona uuid,p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.atlas_personas ap where ap.id=p_persona and
    case when ap.character_id is null then private.atlas_can_manage_custom_personas(p_user)
    else ap.owner_user_id=p_user or private.atlas_is_superadmin(p_user) end);
$$;

-- Service identities do not count as character personas for achievements.
create or replace function private.atlas_secret_persona_achievements()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if new.owner_user_id is null or new.character_id is null then return new; end if;
  select count(*) into v_count from public.atlas_personas ap where ap.owner_user_id=new.owner_user_id and ap.character_id is not null;
  if v_count>=3 then perform private.atlas_award(new.owner_user_id,'secret_split_personality'); end if;
  if v_count>=10 then perform private.atlas_award(new.owner_user_id,'secret_circus_left'); end if;
  return new;
end;
$$;
