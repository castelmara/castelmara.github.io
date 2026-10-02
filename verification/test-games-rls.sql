begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','33e969bf-ae9a-4f22-ac13-096809e53c63',true);
do $$ declare m public.atlas_ttt_matches; begin
 m:=public.atlas_ttt_action('invite',p_opponent=>'c8e46ed6-7024-467e-914b-f74b57f20f9c');
 perform set_config('atlas.test_game',m.id::text,true);
 assert m.status='invited';
 begin perform public.atlas_ttt_action('move',m.id,p_cell=>0,p_revision=>0);raise exception 'test failure' using errcode='XX999';exception when raise_exception then null;end;
end $$;
select set_config('request.jwt.claim.sub','c8e46ed6-7024-467e-914b-f74b57f20f9c',true);
do $$ declare m public.atlas_ttt_matches;begin
 m:=public.atlas_ttt_action('accept',current_setting('atlas.test_game')::uuid,p_revision=>0);assert m.status='active';
 begin perform public.atlas_ttt_action('move',m.id,p_cell=>0,p_revision=>1);raise exception 'test failure' using errcode='XX999';exception when raise_exception then null;end;
end $$;
select set_config('request.jwt.claim.sub','08d0ec10-de59-4a09-892d-c63df468a832',true);
do $$ begin
 assert not exists(select 1 from public.atlas_ttt_matches where id=current_setting('atlas.test_game')::uuid);
 begin perform public.atlas_ttt_action('move',current_setting('atlas.test_game')::uuid,p_cell=>0,p_revision=>1);raise exception 'test failure' using errcode='XX999';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','33e969bf-ae9a-4f22-ac13-096809e53c63',true);
select public.atlas_ttt_action('move',current_setting('atlas.test_game')::uuid,p_cell=>0,p_revision=>1);
do $$ begin
 begin perform public.atlas_ttt_action('move',current_setting('atlas.test_game')::uuid,p_cell=>1,p_revision=>1);raise exception 'test failure' using errcode='XX999';exception when raise_exception then null;end;
 begin update public.atlas_ttt_matches set result='X';raise exception 'test failure' using errcode='XX999';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','c8e46ed6-7024-467e-914b-f74b57f20f9c',true);
select public.atlas_ttt_action('move',current_setting('atlas.test_game')::uuid,p_cell=>3,p_revision=>2);
select set_config('request.jwt.claim.sub','33e969bf-ae9a-4f22-ac13-096809e53c63',true);
select public.atlas_ttt_action('move',current_setting('atlas.test_game')::uuid,p_cell=>1,p_revision=>3);
select set_config('request.jwt.claim.sub','c8e46ed6-7024-467e-914b-f74b57f20f9c',true);
select public.atlas_ttt_action('move',current_setting('atlas.test_game')::uuid,p_cell=>4,p_revision=>4);
select set_config('request.jwt.claim.sub','33e969bf-ae9a-4f22-ac13-096809e53c63',true);
do $$ declare m public.atlas_ttt_matches;begin
 m:=public.atlas_ttt_action('move',current_setting('atlas.test_game')::uuid,p_cell=>2,p_revision=>5);
 assert m.result='X' and m.status='finished' and m.revision=6;
 begin perform public.atlas_ttt_action('move',m.id,p_cell=>8,p_revision=>6);raise exception 'test failure' using errcode='XX999';exception when raise_exception then null;end;
end $$;
rollback;
