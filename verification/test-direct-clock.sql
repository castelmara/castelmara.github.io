begin;
do $test$
declare actor uuid; persona uuid; chat uuid; first_msg uuid; bad_msg uuid; next_msg uuid; clock_before timestamp;
begin
select p.owner_user_id,p.id into actor,persona from public.atlas_personas p where p.owner_user_id is not null and not p.is_archived limit 1;
assert actor is not null;
perform set_config('request.jwt.claim.sub',actor::text,true);
insert into public.direct_chats(title,rp_date,next_rp_time,created_by_user_id,created_by_persona_id) values ('clock regression test','2024-10-01','12:00',actor,persona) returning id into chat;
insert into public.direct_chat_members(chat_id,persona_id) values(chat,persona);
first_msg:=public.send_direct_message_v3(chat,persona,'October',null,'2024-10-01 12:00');
bad_msg:=public.send_direct_message_v3(chat,persona,'Wrong November',null,'2024-11-01 12:00');
perform public.delete_direct_message(bad_msg);
assert (select rp_date+next_rp_time=timestamp '2024-10-01 12:01' from public.direct_chats where id=chat),'Clock must return to October';
next_msg:=public.send_direct_message_v3(chat,persona,'Correct October',null,'2024-10-02 12:00');
assert (select rp_datetime=timestamp '2024-10-02 12:00' from public.direct_messages where id=next_msg),'October must be accepted';
select rp_date+next_rp_time into clock_before from public.direct_chats where id=chat;
perform public.delete_direct_message(first_msg);
assert (select rp_date+next_rp_time=clock_before from public.direct_chats where id=chat),'Deleting older message must not change clock';
perform public.delete_direct_message(next_msg);
next_msg:=public.send_direct_message_v3(chat,persona,'Empty reset',null,'2024-09-01 12:00');
assert (select rp_datetime=timestamp '2024-09-01 12:00' from public.direct_messages where id=next_msg),'Empty chat must accept corrected date';
perform public.delete_direct_message(bad_msg);
assert (select deleted_at is null from public.direct_messages where id=next_msg),'Repeated delete must not affect other messages';
end;
$test$;
rollback;
