-- Free game commands run once inside the message transaction, without external APIs.
-- The response is attached to its request; it cannot impersonate a player account.
alter table public.atlas_player_messages add column bot_reply jsonb;
create function private.atlas_player_game_command() returns trigger
language plpgsql security invoker set search_path='' as $$
declare command text; subject text; answer text; options text[]; result integer; command_kind text;
begin
 if tg_op='UPDATE' then
   -- Editing a question removes its old answer, never silently rerolls it.
   new.bot_reply:=case when new.body is not distinct from old.body then old.bot_reply else null end;
   return new;
 end if;
 new.bot_reply:=null;
 if auth.uid() is null or new.sender_id<>auth.uid() then return new; end if;
 if not exists(select 1 from public.atlas_player_rooms where id=new.room_id and kind='general') then return new; end if;
 command:=btrim(new.body);
 if command !~* '^((@?атлас|@?atlas|/atlas)([[:space:]:,]+|$)|/?инфа[[:space:]]+что([[:space:]]+|$))' then return new; end if;
 command:=btrim(regexp_replace(command,'^(@?атлас|@?atlas|/atlas)[[:space:]:,]*','','i'));
 if command ~* '^/?инфа[[:space:]]+что[[:space:]]+[^[:space:]]' then
   subject:=btrim(regexp_replace(command,'^/?инфа[[:space:]]+что[[:space:]]+','','i'));
   result:=floor(random()*101)::integer;command_kind:='percent';
   answer:='Инфа: '||result||'% · '||subject;
 elsif command ~* '^/?(кубик|dice)[[:space:]!.?]*$' then
   result:=1+floor(random()*6)::integer;command_kind:='dice';answer:='На кубике: '||result||' из 6.';
 elsif command ~* '^/?(монетка|монета|coin)[[:space:]!.?]*$' then
   command_kind:='coin';answer:=case when random()<0.5 then 'Орёл.' else 'Решка.' end;
 elsif command ~* '^/?(выбери|choose)[[:space:]]+' then
   subject:=regexp_replace(command,'^/?(выбери|choose)[[:space:]]+','','i');
   select array_agg(btrim(v)) into options from unnest(regexp_split_to_array(subject,'[[:space:]]+или[[:space:]]+|[|]','i')) v where btrim(v)<>'';
   if coalesce(cardinality(options),0)>=2 then
     command_kind:='choose';answer:='Выбираю: '||options[1+floor(random()*cardinality(options))::integer];
   else command_kind:='help';answer:='Напиши: «атлас выбери море или горы». Варианты можно разделить словом «или» или символом |.';end if;
 else
   command_kind:='help';
   answer:=E'Игровые команды:\n• инфа что завтра будет солнце\n• атлас кубик\n• атлас монетка\n• атлас выбери море или горы\n\nЯ игровой бот: проценты и выбор случайные. Свободные ответы ИИ пока не подключены.';
 end if;
 new.bot_reply:=jsonb_build_object('kind',command_kind,'text',answer,'value',result);
 return new;
end $$;
revoke all on function private.atlas_player_game_command() from public,anon,authenticated;
create trigger player_game_command before insert or update on public.atlas_player_messages for each row execute function private.atlas_player_game_command();
