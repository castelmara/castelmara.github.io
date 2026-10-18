begin;
set local role authenticated;
do $test$
declare actor uuid; other_actor uuid; admin_id uuid; owned text; foreign_character text;
chat_id uuid; feed_id uuid; topic_id uuid; reply_id uuid; blocked boolean; photo text; paths text[];
begin
  select p.id, co.character_id into actor,owned from public.profiles p
  join public.character_owners co on co.user_id=p.id join public.atlas_character_catalog c on c.id=co.character_id
  where p.role='player' and c.active limit 1;
  select p.id, co.character_id into other_actor,foreign_character from public.profiles p
  join public.character_owners co on co.user_id=p.id where p.id<>actor and p.role='player' limit 1;
  select id into admin_id from public.profiles where role='admin' limit 1;
  assert actor is not null and other_actor is not null and admin_id is not null;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.atlas_social_entries(kind,actor_id,author_kind,body)
  values('chat',actor,'player','Hello CAPS') returning id into chat_id;
  insert into public.atlas_social_entries(kind,actor_id,author_kind,character_id,body)
  values('feed',actor,'character',owned,'  paragraph 1'||chr(10)||chr(10)||'**paragraph 2**') returning id into feed_id;
  update public.atlas_social_entries set body='Edited CAPS' where id=chat_id;
  assert (select body='Edited CAPS' and edited_at is not null from public.atlas_social_entries where id=chat_id);
  blocked:=false;
  begin insert into public.atlas_social_entries(kind,actor_id,author_kind,character_id,body) values('chat',actor,'character',owned,'bad'); exception when others then blocked:=true; end;
  assert blocked,'Chat must be player-only';
  blocked:=false;
  begin insert into public.atlas_social_entries(kind,actor_id,author_kind,body) values('chat',other_actor,'player','bad'); exception when others then blocked:=true; end;
  assert blocked,'Player impersonation must fail';
  blocked:=false;
  begin insert into public.atlas_social_entries(kind,actor_id,author_kind,character_id,body) values('feed',actor,'character',foreign_character,'bad'); exception when others then blocked:=true; end;
  assert blocked,'Foreign character must fail';
  blocked:=false;
  begin insert into public.atlas_social_entries(kind,actor_id,author_kind,title,body) values('topic',actor,'atlas','bad','bad'); exception when others then blocked:=true; end;
  assert blocked,'Player cannot post as ATLAS';
  blocked:=false;
  begin update public.atlas_social_entries set actor_id=other_actor where id=chat_id; exception when others then blocked:=true; end;
  assert blocked,'Author cannot be changed';

  photo:=actor::text||'/social/permission-test.jpg';
  insert into storage.objects(bucket_id,name,metadata) values('atlas-media',photo,'{"mimetype":"image/jpeg"}');
  paths:=array_fill(photo,array[6]);
  insert into public.atlas_social_entries(kind,actor_id,author_kind,character_id,images) values('feed',actor,'character',owned,paths);
  blocked:=false;
  begin insert into public.atlas_social_entries(kind,actor_id,author_kind,character_id,images) values('feed',actor,'character',owned,array_append(paths,photo)); exception when others then blocked:=true; end;
  assert blocked,'Seventh photo must fail';
  blocked:=false;
  begin insert into public.atlas_social_entries(kind,actor_id,author_kind,character_id,images) values('feed',actor,'character',owned,array[other_actor::text||'/social/stolen.jpg']); exception when others then blocked:=true; end;
  assert blocked,'Foreign image path must fail';

  perform set_config('request.jwt.claim.sub',other_actor::text,true);
  delete from public.atlas_social_entries where id=chat_id;
  assert not found,'Other player cannot delete';
  update public.atlas_social_entries set body='bad' where id=chat_id;
  assert not found,'Other player cannot edit';
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  insert into public.atlas_social_entries(kind,actor_id,author_kind,title,body) values('topic',admin_id,'atlas','Test topic','  Intro'||chr(10)||'**bold**') returning id into topic_id;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.atlas_social_entries(kind,parent_id,actor_id,author_kind,character_id,body) values('reply',topic_id,actor,'character',owned,'Roleplay') returning id into reply_id;
  blocked:=false;
  begin insert into public.atlas_social_entries(kind,parent_id,actor_id,author_kind,character_id,body) values('reply',chat_id,actor,'character',owned,'bad'); exception when others then blocked:=true; end;
  assert blocked,'Reply parent must be a topic';
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  delete from public.atlas_social_entries where id=chat_id;
  assert found,'Admin can moderate';
  delete from public.atlas_social_entries where id=topic_id;
  assert not exists(select 1 from public.atlas_social_entries where id=reply_id),'Topic deletion cascades';
end $test$;
rollback;
