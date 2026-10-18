begin;
set local role authenticated;
do $test$
declare actor uuid; owned text; foreign_char text; topic uuid; blocked boolean; admin_id uuid;
begin
 select co.user_id,co.character_id into actor,owned from public.character_owners co join public.atlas_character_catalog c on c.id=co.character_id and c.active limit 1;
 assert actor is not null,'Need owned character fixture';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.atlas_social_entries(kind,actor_id,author_kind,character_id,title,body)
 values('topic',actor,'character',owned,'Permission test','test') returning id into topic;
 insert into public.atlas_social_entries(kind,parent_id,actor_id,author_kind,character_id,body)
 values('reply',topic,actor,'character',owned,'test');
 select c.id into foreign_char from public.atlas_character_catalog c where c.active and not exists(select 1 from public.character_owners co where co.user_id=actor and co.character_id=c.id) limit 1;
 assert foreign_char is not null;
 blocked:=false;
 begin
 insert into public.atlas_social_entries(kind,parent_id,actor_id,author_kind,character_id,body) values('reply',topic,actor,'character',foreign_char,'test');
 exception when others then blocked:=true;end;
 assert blocked,'Foreign character rejected';
 select id into admin_id from public.profiles where role='player' limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 blocked:=false;
 begin
 insert into public.atlas_social_entries(kind,parent_id,actor_id,author_kind,body) values('reply',topic,admin_id,'atlas','test');
 exception when others then blocked:=true;end;
 assert blocked,'Player cannot impersonate ATLAS';
 for admin_id in select id from public.profiles where role in ('admin','superadmin') loop
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.atlas_social_entries(kind,actor_id,author_kind,title,body) values('topic',admin_id,'atlas','Admin test','test');
 insert into public.atlas_social_entries(kind,parent_id,actor_id,author_kind,body) values('reply',topic,admin_id,'atlas','test');
 end loop;
end $test$;
rollback;
select 'owned topic/reply allowed; foreign character and player ATLAS blocked; staff ATLAS allowed; rolled back' as result;
