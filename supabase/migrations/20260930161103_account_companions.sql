create table public.atlas_player_companions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pet text not null default 'sprout' check (pet in ('sprout','frog','duck','catbox','book','codercat','axolotl','spider','raven','dragon','kitsune','bat','ghost')),
  visible boolean not null default true,
  names jsonb not null default '{}'::jsonb check (jsonb_typeof(names) = 'object')
);
alter table public.atlas_player_companions enable row level security;
revoke all on public.atlas_player_companions from anon, authenticated;
grant select, insert, update on public.atlas_player_companions to authenticated;
create policy companion_read on public.atlas_player_companions for select to authenticated using ((select auth.uid()) = user_id);
create policy companion_insert on public.atlas_player_companions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy companion_update on public.atlas_player_companions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
