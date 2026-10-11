-- Keep the chat clock consistent with the remaining messages.
create or replace function public.delete_direct_message(p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid; v_chat uuid; v_deleted timestamptz;
  v_rp timestamp; v_clock timestamp; v_next timestamp;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select chat_id into v_chat from public.direct_messages where id=p_message;
  if not found then raise exception 'сообщение не найдено'; end if;
  -- Same lock order as sending: chat first, message second.
  select rp_date + next_rp_time into v_clock
    from public.direct_chats where id=v_chat for update;
  select actor_user_id,rp_datetime,deleted_at into v_actor,v_rp,v_deleted
    from public.direct_messages where id=p_message for update;
  if auth.uid() <> v_actor and not private.atlas_is_direct_staff() then
    raise exception 'нет прав удалить это сообщение';
  end if;
  if v_deleted is not null then return; end if;
  update public.direct_messages set deleted_at=now() where id=p_message;
  select max(rp_datetime) + interval '1 minute' into v_next
    from public.direct_messages where chat_id=v_chat and deleted_at is null;
  if v_next is not null and v_clock=v_rp + interval '1 minute' then
    update public.direct_chats set rp_date=v_next::date,next_rp_time=v_next::time,updated_at=now()
      where id=v_chat;
  end if;
end;
$$;

-- An empty chat with deleted messages must allow a corrected first date.
-- Preserve the existing send function, including all permission checks.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.send_direct_message_v3(uuid,uuid,text,uuid,timestamp without time zone,jsonb)'::regprocedure) into definition;
  if position('v_floor := v_date + v_time;' in definition)=0 then
    raise exception 'Unexpected send_direct_message_v3 definition';
  end if;
  definition:=replace(definition,'v_floor := v_date + v_time;',
    'v_floor := v_date + v_time;
  if p_rp_datetime is not null
     and not exists (select 1 from public.direct_messages where chat_id=p_chat and deleted_at is null)
     and exists (select 1 from public.direct_messages where chat_id=p_chat and deleted_at is not null) then
    v_floor := p_rp_datetime;
  end if;');
  execute definition;
end;
$$;

-- Repair clocks left behind by previously deleted final messages.
with clocks as (
  select chat_id,max(rp_datetime) filter (where deleted_at is null) + interval '1 minute' as live_next,
    max(rp_datetime) filter (where deleted_at is not null) + interval '1 minute' as deleted_next
  from public.direct_messages group by chat_id
)
update public.direct_chats c set rp_date=x.live_next::date,next_rp_time=x.live_next::time,updated_at=now()
from clocks x where c.id=x.chat_id and x.live_next is not null
  and c.rp_date+c.next_rp_time=x.deleted_next and x.live_next<x.deleted_next;
