-- Remove application caps; preserve authorization, required content and file-type checks.
do $migration$
declare
  definition text;
  count_check text := E'  if v_count > 6 then\n    raise exception ''можно прикрепить не больше 6 файлов'';\n  end if;';
  text_check text := E'  if length(v_body) > 4000 then\n    raise exception ''сообщение слишком длинное'';\n  end if;';
  signature text;
begin
  select replace(pg_get_functiondef('public.send_direct_message_v3(uuid,uuid,text,uuid,timestamp without time zone,jsonb)'::regprocedure), E'\r\n', E'\n') into definition;
  if position(count_check in definition) = 0 then
    raise exception 'Expected attachment-count check not found; review the current function before applying';
  end if;
  if position(text_check in definition) = 0 or position('v_size < 0 or v_size > 10485760' in definition) = 0 then
    raise exception 'Expected message/file-size checks not found';
  end if;
  definition := replace(definition, count_check, '  -- Attachment count is not capped.');
  definition := replace(definition, text_check, '  -- Message length is not capped.');
  definition := replace(definition, 'v_size < 0 or v_size > 10485760', 'v_size < 0');
  definition := replace(definition, 'файл превышает лимит 10 МБ', 'неверный размер вложения');
  execute definition;
  foreach signature in array array[
    'public.send_direct_message(uuid,uuid,text,uuid,timestamp without time zone)',
    'public.edit_direct_message(uuid,text)'
  ] loop
    select pg_get_functiondef(signature::regprocedure) into definition;
    if position('length(trim(p_body)) not between 1 and 4000' in definition) = 0 then
      raise exception 'Expected text limit not found in %', signature;
    end if;
    execute replace(definition, 'length(trim(p_body)) not between 1 and 4000', 'length(trim(p_body)) < 1');
  end loop;
end;
$migration$;

alter table public.direct_messages drop constraint direct_messages_body_check;
alter table public.direct_messages add constraint direct_messages_body_check check (length(trim(body)) >= 1);
alter table public.direct_message_attachments drop constraint direct_message_attachments_file_size_check;
alter table public.direct_message_attachments add constraint direct_message_attachments_file_size_check check (file_size >= 0);
