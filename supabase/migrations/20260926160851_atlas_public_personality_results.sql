create table public.atlas_player_personality_results (
  user_id uuid primary key references auth.users(id) on delete cascade,
  test_version text not null check (test_version = 'personality_test_v1'),
  primary_type text not null check (primary_type in ('captain','wildcard','anchor','prodigy','ghost','spark')),
  secondary_type text check (secondary_type in ('captain','wildcard','anchor','prodigy','ghost','spark') and secondary_type <> primary_type),
  answers jsonb not null check (
    jsonb_typeof(answers) = 'array'
    and jsonb_array_length(answers) = 24
    and not jsonb_path_exists(answers, '$[*] ? (@ != "A" && @ != "B" && @ != "C" && @ != "D")')
  ),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.atlas_player_personality_results enable row level security;
revoke all on public.atlas_player_personality_results from public, anon, authenticated;
grant select on public.atlas_player_personality_results to anon, authenticated;
grant insert, update on public.atlas_player_personality_results to authenticated;
create policy "Public completed personality results"
  on public.atlas_player_personality_results for select to anon, authenticated using (true);
create policy "Player inserts own completed result"
  on public.atlas_player_personality_results for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Player replaces own completed result"
  on public.atlas_player_personality_results for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create function public.atlas_personality_result_timestamp()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.completed_at := statement_timestamp();
  new.updated_at := new.completed_at;
  return new;
end;
$$;
revoke all on function public.atlas_personality_result_timestamp() from public, anon, authenticated;
create trigger atlas_personality_result_timestamp
before insert or update on public.atlas_player_personality_results
for each row execute function public.atlas_personality_result_timestamp();
