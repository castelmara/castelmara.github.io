begin;
select set_config('atlas.test_other_admin',(select id::text from public.profiles where role='admin' and id<>'c8e46ed6-7024-467e-914b-f74b57f20f9c' limit 1),true);
select set_config('atlas.test_player',(select id::text from public.profiles where role='player' limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','c8e46ed6-7024-467e-914b-f74b57f20f9c',true);
do $$ declare p uuid; chat uuid; msg uuid; begin
  assert public.atlas_can_manage_custom_personas();
  insert into public.atlas_personas(character_id,display_name,nickname) values(null,'Test administration','test_'||substr(gen_random_uuid()::text,1,18)) returning id into p;
  perform set_config('atlas.test_persona',p::text,true);
  chat:=public.create_direct_chat('TEST rollback',current_date,'12:00',p);
  msg:=public.send_direct_message_v3(chat,p,'TEST rollback');
  assert msg is not null;
  perform set_config('atlas.test_chat',chat::text,true);
end $$;
select set_config('request.jwt.claim.sub','33e969bf-ae9a-4f22-ac13-096809e53c63',true);
do $$ begin
  assert public.atlas_can_manage_custom_personas();
  update public.atlas_personas set display_name='Shared administration' where id=current_setting('atlas.test_persona')::uuid;
  assert found;
  perform public.send_direct_message_v3(current_setting('atlas.test_chat')::uuid,current_setting('atlas.test_persona')::uuid,'Superadmin test');
end $$;
do $$ declare viewer text; begin
  foreach viewer in array array[current_setting('atlas.test_player'),current_setting('atlas.test_other_admin')] loop
    assert viewer is not null and viewer<>'';
    perform set_config('request.jwt.claim.sub',viewer,true);
    assert not public.atlas_can_manage_custom_personas();
    update public.atlas_personas set display_name='Not allowed' where id=current_setting('atlas.test_persona')::uuid;
    assert not found;
    begin
      insert into public.atlas_personas(character_id,display_name,nickname) values(null,'Denied','denied_test');
      raise exception 'permission test failed';
    exception when insufficient_privilege then null; end;
    begin
      perform public.send_direct_message_v3(current_setting('atlas.test_chat')::uuid,current_setting('atlas.test_persona')::uuid,'Denied');
      raise exception 'SEND SHOULD FAIL' using errcode='XX999';
    exception when raise_exception then null; end;
  end loop;
end $$;
rollback;
