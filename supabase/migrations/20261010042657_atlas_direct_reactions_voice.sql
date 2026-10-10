alter table public.direct_messages add column message_kind text not null default 'text' check (message_kind in ('text','voice'));

create table public.direct_photo_reactions (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.direct_message_attachments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','🔥','😍','😂','😮','👍')),
  unique (attachment_id,user_id)
);
create index direct_photo_reactions_user_idx on public.direct_photo_reactions(user_id);
alter table public.direct_photo_reactions enable row level security;
-- Only chat participants and Direct staff can read reactions.
create policy direct_photo_reactions_read on public.direct_photo_reactions for select to authenticated
using (exists (select 1 from public.direct_message_attachments a join public.direct_messages m on m.id=a.message_id where a.id=attachment_id and m.deleted_at is null and private.atlas_can_access_direct_chat(a.chat_id,(select auth.uid()))));
revoke all on public.direct_photo_reactions from anon, authenticated;
grant select on public.direct_photo_reactions to authenticated;

create function public.set_direct_photo_reaction(p_attachment uuid,p_emoji text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_chat uuid;
begin
  if v_user is null then raise exception 'authentication required';end if;
  if p_emoji is not null and p_emoji not in ('❤️','🔥','😍','😂','😮','👍') then raise exception 'неизвестная реакция';end if;
  select a.chat_id into v_chat from public.direct_message_attachments a
  join public.direct_messages m on m.id=a.message_id
  join public.direct_chats c on c.id=a.chat_id
  where a.id=p_attachment and a.mime_type like 'image/%' and m.deleted_at is null and not c.is_archived
  for share of m,c;
  if v_chat is null or not private.atlas_can_access_direct_chat(v_chat,v_user)
     or not exists (select 1 from public.direct_chat_members d where d.chat_id=v_chat and private.atlas_can_use_persona(d.persona_id,v_user))
  then raise exception 'нет прав реагировать на это фото';end if;
  if p_emoji is null then
    delete from public.direct_photo_reactions where attachment_id=p_attachment and user_id=v_user;
  else
    insert into public.direct_photo_reactions(attachment_id,user_id,emoji) values(p_attachment,v_user,p_emoji)
    on conflict (attachment_id,user_id) do update set emoji=excluded.emoji;
  end if;
end;
$$;
revoke all on function public.set_direct_photo_reaction(uuid,text) from public,anon;
grant execute on function public.set_direct_photo_reaction(uuid,text) to authenticated;

create function public.send_direct_voice_message(p_chat uuid,p_persona uuid,p_body text default '',p_reply_to uuid default null,p_rp_datetime timestamp without time zone default null,p_attachments jsonb default '[]')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if length(trim(coalesce(p_body,'')))=0 then raise exception 'добавь расшифровку голосового сообщения';end if;
  -- Reuse all established sender, membership, attachment and date validations.
  v_id:=public.send_direct_message_v3(p_chat,p_persona,p_body,p_reply_to,p_rp_datetime,p_attachments);
  update public.direct_messages set message_kind='voice' where id=v_id;
  return v_id;
end;
$$;
revoke all on function public.send_direct_voice_message(uuid,uuid,text,uuid,timestamp without time zone,jsonb) from public,anon;
grant execute on function public.send_direct_voice_message(uuid,uuid,text,uuid,timestamp without time zone,jsonb) to authenticated;
