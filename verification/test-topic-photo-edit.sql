begin;
set local role authenticated;
do $test$
declare actor uuid; photo text; topic uuid; blocked boolean;
begin
select id into actor from public.profiles where role='superadmin' limit 1;
perform set_config('request.jwt.claim.sub',actor::text,true);
photo:=actor::text||'/social/topic-photo-test.jpg';
insert into storage.objects(bucket_id,name,metadata) values('atlas-media',photo,'{"mimetype":"image/jpeg"}');
insert into public.atlas_social_entries(kind,actor_id,author_kind,title,body) values('topic',actor,'atlas','Photo test','') returning id into topic;
update public.atlas_social_entries set images=array[photo] where id=topic;
assert (select cardinality(images)=1 from public.atlas_social_entries where id=topic);
update public.atlas_social_entries set images=array_fill(photo,array[6]) where id=topic;
blocked:=false;
begin update public.atlas_social_entries set images=array_fill(photo,array[7]) where id=topic;exception when others then blocked:=true;end;
assert blocked,'Seventh photo blocked';
blocked:=false;
begin update public.atlas_social_entries set images=array['foreign/social/test.jpg'] where id=topic;exception when others then blocked:=true;end;
assert blocked,'Foreign image blocked';
update public.atlas_social_entries set images='{}' where id=topic;
assert (select cardinality(images)=0 from public.atlas_social_entries where id=topic);
end $test$;
rollback;
