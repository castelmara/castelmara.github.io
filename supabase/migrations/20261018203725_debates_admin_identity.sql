alter policy debates_owned_characters on public.atlas_social_entries
with check (
 kind not in ('topic','reply') or
 (author_kind='character' and exists (
  select 1 from public.character_owners co
  join public.atlas_character_catalog c on c.id=co.character_id and c.active
  where co.user_id=(select auth.uid()) and co.character_id=atlas_social_entries.character_id
 )) or
 (author_kind='atlas' and exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','superadmin')
 ))
);
