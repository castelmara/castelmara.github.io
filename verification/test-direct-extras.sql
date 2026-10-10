begin;
do $test$
declare actor uuid;persona uuid;chat uuid;msg uuid;photo uuid;outsider uuid;blocked boolean;
begin
select p.owner_user_id,p.id,c.id into actor,persona,chat from public.atlas_personas p join public.direct_chat_members d on d.persona_id=p.id join public.direct_chats c on c.id=d.chat_id where p.character_id is not null and not p.is_archived and not c.is_archived limit 1;
assert actor is not null;
perform set_config('request.jwt.claim.sub',actor::text,true);
msg:=public.send_direct_voice_message(chat,persona,'тестовая расшифровка',null,null,jsonb_build_array(jsonb_build_object('storage_path',actor||'/direct/'||chat||'/test.jpg','public_url','https://example.invalid/test.jpg','file_name','test.jpg','mime_type','image/jpeg','file_size',100)));
assert (select message_kind='voice' and body='тестовая расшифровка' from public.direct_messages where id=msg);
select id into photo from public.direct_message_attachments where message_id=msg;
perform public.set_direct_photo_reaction(photo,'❤️');
perform public.set_direct_photo_reaction(photo,'🔥');
assert (select count(*)=1 and min(emoji)='🔥' from public.direct_photo_reactions where attachment_id=photo);
perform public.set_direct_photo_reaction(photo,null);
assert not exists(select 1 from public.direct_photo_reactions where attachment_id=photo);
blocked:=false;
begin perform public.set_direct_photo_reaction(photo,'bad');exception when others then blocked:=true;end;
assert blocked,'Invalid emoji rejected';
select id into outsider from auth.users u where not private.atlas_can_access_direct_chat(chat,u.id) limit 1;
assert outsider is not null;
perform set_config('request.jwt.claim.sub',outsider::text,true);
blocked:=false;
begin perform public.set_direct_photo_reaction(photo,'❤️');exception when others then blocked:=true;end;
assert blocked,'Nonparticipant rejected';
perform set_config('request.jwt.claim.sub',actor::text,true);
perform public.delete_direct_message(msg);
blocked:=false;
begin perform public.set_direct_photo_reaction(photo,'❤️');exception when others then blocked:=true;end;
assert blocked,'Deleted message rejected';
end;
$test$;
rollback;

-- Run the browser's SELECT as its actual database role, not the migration owner.
begin;
set local role authenticated;
select id,chat_id,persona_id,body,message_kind,reply_to,rp_datetime,created_at,edited_at,deleted_at
from public.direct_messages limit 0;
do $$ begin
  assert not has_column_privilege('authenticated','public.direct_messages','actor_user_id','SELECT'), 'Actor identity must remain private';
end $$;
rollback;
