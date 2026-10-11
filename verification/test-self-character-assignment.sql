begin;
set local role authenticated;
do $test$
declare actor uuid; other_user uuid; free_id text; taken_id text; original text[]; blocked boolean;
begin
select id into actor from public.profiles where nickname='noah_arden';
assert actor is not null;
perform set_config('request.jwt.claim.sub',actor::text,true);
select coalesce(array_agg(character_id order by character_id),array[]::text[]) into original from public.character_owners where user_id=actor;
select id into free_id from public.atlas_character_catalog c where active and not exists(select 1 from public.character_owners o where o.character_id=c.id) limit 1;
assert free_id is not null;
perform public.atlas_save_character_owners(actor,array_append(original,free_id),original);
assert exists(select 1 from public.character_owners where user_id=actor and character_id=free_id),'Self assignment failed';
select user_id,character_id into other_user,taken_id from public.character_owners where user_id<>actor limit 1;
blocked:=false;
begin perform public.atlas_save_character_owners(actor,array_append(array_append(original,free_id),taken_id),array_append(original,free_id)); exception when others then blocked:=true; end;
assert blocked,'Occupied character must be rejected';
blocked:=false;
begin perform public.atlas_save_character_owners(other_user,array[]::text[],array[]::text[]); exception when others then blocked:=true; end;
assert blocked,'Other account must be protected';
update public.character_owners set user_id=actor where character_id=taken_id;
assert not found,'Direct reassignment must be blocked by RLS';
perform public.atlas_save_character_owners(actor,original,array_append(original,free_id));
assert not exists(select 1 from public.character_owners where character_id=free_id),'Self unlink failed';
end;
$test$;
rollback;
