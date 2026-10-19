begin;
set local role authenticated;
do $test$
declare a uuid;b uuid;general uuid;dm uuid;m uuid;reply jsonb;initial jsonb;i integer;
begin
 select id into a from public.profiles where role='player' limit 1;
 select id into b from public.profiles where role='player' and id<>a limit 1;
 perform set_config('request.jwt.claim.sub',a::text,true);
 select id into general from public.atlas_player_rooms where kind='general';
 dm:=public.atlas_create_player_room('dm','',array[b]);
 insert into public.atlas_player_messages(room_id,sender_id,body,bot_reply) values(general,a,'обычное сообщение','{"text":"forged bot"}') returning bot_reply into reply;
 assert reply is null,'Client cannot forge bot text';
 insert into public.atlas_player_messages(room_id,sender_id,body) values(dm,a,'инфа что завтра солнце') returning bot_reply into reply;
 assert reply is null,'Bot stays out of private conversations';
 for i in 1..15 loop
   insert into public.atlas_player_messages(room_id,sender_id,body) values(general,a,'ИНФА что завтра солнце') returning id,bot_reply into m,reply;
   assert reply->>'kind'='percent' and (reply->>'value')::integer between 0 and 100,'Percent range and case-insensitive recognition';
 end loop;
 initial:=reply;
 update public.atlas_player_messages set body='ИНФА что завтра солнце' where id=m returning bot_reply into reply;
 assert reply=initial,'No reroll on unchanged edit';
 perform set_config('request.jwt.claim.sub',b::text,true);
 assert (select bot_reply=initial from public.atlas_player_messages where id=m),'Other players see the same answer';
 perform set_config('request.jwt.claim.sub',a::text,true);
 update public.atlas_player_messages set body='Другая формулировка' where id=m returning bot_reply into reply;
 assert reply is null,'Do not display an old answer against an edited question';
 insert into public.atlas_player_messages(room_id,sender_id,body) values(general,a,'@atlas кубик') returning bot_reply into reply;
 assert reply->>'kind'='dice' and (reply->>'value')::integer between 1 and 6;
 insert into public.atlas_player_messages(room_id,sender_id,body) values(general,a,'атлас монетка') returning bot_reply into reply;
 assert reply->>'text' in ('Орёл.','Решка.');
 insert into public.atlas_player_messages(room_id,sender_id,body) values(general,a,'атлас выбери Море или Горы') returning bot_reply into reply;
 assert reply->>'text' in ('Выбираю: Море','Выбираю: Горы'),'Choice preserves original case';
 insert into public.atlas_player_messages(room_id,sender_id,body) values(general,a,'атлас выбери | |') returning bot_reply into reply;
 assert reply->>'kind'='help','Malformed choices get guidance';
 insert into public.atlas_player_messages(room_id,sender_id,body) values(general,a,'атлас как дела?') returning bot_reply into reply;
 assert reply->>'kind'='help','No fake AI answers';
end $test$;
rollback;
