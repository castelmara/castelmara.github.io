begin;
-- Existing account IDs are used only inside a rolled-back verification transaction.
set local role service_role;
select set_config('atlas.chess_test_id',(public.atlas_chess_write('33e969bf-ae9a-4f22-ac13-096809e53c63','invite',null,'c8e46ed6-7024-467e-914b-f74b57f20f9c')).id::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','08d0ec10-de59-4a09-892d-c63df468a832',true);
do $$ begin
 if exists(select 1 from public.atlas_chess_matches where id=current_setting('atlas.chess_test_id')::uuid) then raise exception 'Outsider can read match';end if;
 begin perform public.atlas_chess_write('33e969bf-ae9a-4f22-ac13-096809e53c63','resign',current_setting('atlas.chess_test_id')::uuid,null,0);raise exception 'Forged actor accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','33e969bf-ae9a-4f22-ac13-096809e53c63',true);
do $$ begin
 if not exists(select 1 from public.atlas_chess_matches where id=current_setting('atlas.chess_test_id')::uuid) then raise exception 'Participant cannot read';end if;
 begin update public.atlas_chess_matches set turn='b' where id=current_setting('atlas.chess_test_id')::uuid;raise exception 'Direct write accepted';exception when insufficient_privilege then null;end;
end $$;
set local role service_role;
do $$ declare m public.atlas_chess_matches;id uuid:=current_setting('atlas.chess_test_id')::uuid;begin
 begin perform public.atlas_chess_write('33e969bf-ae9a-4f22-ac13-096809e53c63','accept',id,null,0);raise exception 'Inviter accepted own invitation';exception when raise_exception then if sqlerrm='Inviter accepted own invitation' then raise;end if;end;
 m:=public.atlas_chess_write('c8e46ed6-7024-467e-914b-f74b57f20f9c','accept',id,null,0);
 if m.status<>'active' or m.revision<>1 then raise exception 'Accept failed';end if;
 begin perform public.atlas_chess_write('08d0ec10-de59-4a09-892d-c63df468a832','resign',id,null,1);raise exception 'Outsider action accepted';exception when insufficient_privilege then null;end;
 begin perform public.atlas_chess_write('33e969bf-ae9a-4f22-ac13-096809e53c63','resign',id,null,0);raise exception 'Stale action accepted';exception when serialization_failure then null;end;
 m:=public.atlas_chess_write('33e969bf-ae9a-4f22-ac13-096809e53c63','resign',id,null,1);
 if m.status<>'finished' or m.result<>'b' then raise exception 'Resign failed';end if;
end $$;
rollback;
