-- The browser role cannot access private schema; this read-only RPC uses public profiles.
create or replace function public.atlas_can_manage_custom_personas()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and
    (p.role='superadmin' or (p.role='admin' and p.id='c8e46ed6-7024-467e-914b-f74b57f20f9c'::uuid)));
$$;
