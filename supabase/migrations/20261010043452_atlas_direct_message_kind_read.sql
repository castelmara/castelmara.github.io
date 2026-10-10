-- Match the existing column-level read grants; keep actor_user_id private.
grant select (message_kind) on public.direct_messages to authenticated;
