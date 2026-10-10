-- Run only after the limits migration. Test messages and achievements roll back.
begin;
do $test$
declare
  actor uuid;
  persona uuid;
  chat uuid;
  message uuid;
  attachments jsonb;
  stamp text := gen_random_uuid()::text;
begin
  select p.owner_user_id,p.id,c.id into actor,persona,chat
  from public.atlas_personas p
  join public.direct_chat_members m on m.persona_id=p.id
  join public.direct_chats c on c.id=m.chat_id
  where p.character_id is not null and not p.is_archived and not c.is_archived
  limit 1;
  assert actor is not null, 'Need an existing participant in an active chat';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select jsonb_agg(jsonb_build_object(
    'storage_path',actor||'/direct/'||chat||'/'||stamp||'-'||i||'.jpg',
    'public_url','https://example.invalid/'||stamp||'-'||i||'.jpg',
    'file_name',i||'.jpg','mime_type','image/jpeg','file_size',12582912
  )) into attachments from generate_series(1,20) i;
  message := public.send_direct_message_v3(chat,persona,repeat('я',12000),null,null,attachments);
  assert (select length(body) from public.direct_messages where id=message)=12000;
  assert (select count(*) from public.direct_message_attachments where message_id=message)=20;
  perform public.edit_direct_message(message,repeat('а',24000));
  assert (select length(body) from public.direct_messages where id=message)=24000;
  message := public.send_direct_message(chat,persona,repeat('б',12000),null,null);
  assert (select length(body) from public.direct_messages where id=message)=12000;
end;
$test$;
rollback;
