-- Players manage only their own links; existing staff policies remain intact.
create policy "character owners self insert" on public.character_owners
for insert to authenticated with check (
  user_id=(select auth.uid()) and exists (
    select 1 from public.atlas_character_catalog c where c.id=character_id and c.active
  )
);
create policy "character owners self delete" on public.character_owners
for delete to authenticated using (user_id=(select auth.uid()));
create policy "character owners self update" on public.character_owners
for update to authenticated using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

-- Keep the atomic save operation and its occupied-character/conflict checks.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.atlas_save_character_owners(uuid,text[],text[])'::regprocedure) into definition;
  if position('viewer.role=''superadmin'' or' in definition)=0 then
    raise exception 'Unexpected atlas_save_character_owners definition';
  end if;
  definition:=replace(definition,'viewer.role=''superadmin'' or',
    'viewer.id=p_user or viewer.role=''superadmin'' or');
  execute definition;
end;
$$;
