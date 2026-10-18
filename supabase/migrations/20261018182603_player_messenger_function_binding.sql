-- Bind private helpers at definition time; no schema-USAGE grant is needed.
create or replace function public.atlas_create_player_room(p_kind text,p_title text default '',p_users uuid[] default '{}') returns uuid
language sql security invoker set search_path=''
begin atomic
 select private.atlas_create_player_room(p_kind,p_title,p_users);
end;
create or replace function private.atlas_player_file_access(p_path text) returns boolean
language sql stable security invoker set search_path=''
begin atomic
 select case when split_part(p_path,'/',2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then private.atlas_player_room_access(split_part(p_path,'/',2)::uuid) else false end;
end;
