create table public.atlas_questionnaire_submissions (
 id uuid primary key default gen_random_uuid(),
 character_id text not null references public.atlas_character_catalog(id),
 actor_id uuid not null references public.profiles(id),
 content jsonb not null default '{}' check(jsonb_typeof(content)='object'),
 file_path text,
 file_name text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 review_note text not null default '',
 reviewer_id uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create unique index questionnaire_one_pending on public.atlas_questionnaire_submissions(character_id) where status='pending';
create index questionnaire_actor on public.atlas_questionnaire_submissions(actor_id,created_at desc);
create index questionnaire_reviewer on public.atlas_questionnaire_submissions(reviewer_id);
create table public.atlas_questionnaire_publications (
 character_id text primary key references public.atlas_character_catalog(id),
 submission_id uuid not null references public.atlas_questionnaire_submissions(id),
 content jsonb not null,
 file_path text,
 file_name text not null,
 published_at timestamptz not null default now()
);
create index questionnaire_publication_submission on public.atlas_questionnaire_publications(submission_id);
alter table public.atlas_questionnaire_submissions enable row level security;
alter table public.atlas_questionnaire_publications enable row level security;
revoke all on public.atlas_questionnaire_submissions,public.atlas_questionnaire_publications from anon,authenticated;
grant select,insert on public.atlas_questionnaire_submissions to authenticated;
grant select on public.atlas_questionnaire_publications to anon,authenticated;
create policy questionnaire_read on public.atlas_questionnaire_submissions for select to authenticated using (
 actor_id=(select auth.uid()) or exists(select 1 from public.profiles where id=(select auth.uid()) and role='superadmin')
);
create policy questionnaire_submit on public.atlas_questionnaire_submissions for insert to authenticated with check (
 actor_id=(select auth.uid()) and status='pending' and reviewer_id is null and reviewed_at is null and review_note=''
 and exists(select 1 from public.character_owners co join public.atlas_character_catalog c on c.id=co.character_id and c.active
 where co.user_id=(select auth.uid()) and co.character_id=atlas_questionnaire_submissions.character_id)
);
create policy questionnaire_public_read on public.atlas_questionnaire_publications for select to anon,authenticated using(true);

insert into storage.buckets(id,name,public,allowed_mime_types) values('atlas-questionnaires','atlas-questionnaires',false,
 array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
create policy questionnaire_file_insert on storage.objects for insert to authenticated with check (
 bucket_id='atlas-questionnaires' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.profiles where id=(select auth.uid()))
);
create policy questionnaire_file_read on storage.objects for select to anon,authenticated using (
 bucket_id='atlas-questionnaires' and (
 split_part(name,'/',1)=(select auth.uid())::text or
 exists(select 1 from public.profiles where id=(select auth.uid()) and role='superadmin') or
 exists(select 1 from public.atlas_questionnaire_publications p where p.file_path=name)
 ));

create function private.atlas_validate_questionnaire() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from jsonb_each(new.content) x where x.key not in
 ('fullName','originalName','birthDate','age','faculty','specialization','biography','personality','motivation','extra') or jsonb_typeof(x.value)<>'string') then
 raise exception 'Неверный формат анкеты'; end if;
 if new.file_path is null and not exists(select 1 from jsonb_each_text(new.content) x where length(btrim(x.value))>0) then
 raise exception 'Заполните анкету или прикрепите файл'; end if;
 if new.file_path is not null and (new.file_path not like auth.uid()::text||'/%' or not exists(
 select 1 from storage.objects where bucket_id='atlas-questionnaires' and name=new.file_path)) then
 raise exception 'Файл не принадлежит вашему аккаунту'; end if;
 new.created_at:=clock_timestamp();
 return new;
end $$;
revoke all on function private.atlas_validate_questionnaire() from public,anon,authenticated;
create trigger validate_questionnaire before insert on public.atlas_questionnaire_submissions for each row execute function private.atlas_validate_questionnaire();

-- The private function is the only writer of review decisions and published versions.
create function private.atlas_review_questionnaire(p_id uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare entry public.atlas_questionnaire_submissions;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='superadmin') then
 raise exception 'Только суперадмин может проверять анкеты'; end if;
 if p_decision not in ('approved','rejected') or p_decision is null then raise exception 'Неверное решение'; end if;
 select * into entry from public.atlas_questionnaire_submissions where id=p_id for update;
 if not found then raise exception 'Заявка не найдена'; end if;
 if entry.status<>'pending' then raise exception 'Заявка уже рассмотрена'; end if;
 if p_decision='rejected' and length(btrim(coalesce(p_note,'')))=0 then raise exception 'Укажите причину отклонения'; end if;
 if p_decision='approved' then
   perform 1 from public.character_owners where user_id=entry.actor_id and character_id=entry.character_id for update;
   if not found then raise exception 'Персонаж больше не принадлежит автору заявки'; end if;
   if not exists(select 1 from public.atlas_character_catalog where id=entry.character_id and active) then raise exception 'Персонаж неактивен'; end if;
   insert into public.atlas_questionnaire_publications(character_id,submission_id,content,file_path,file_name)
   values(entry.character_id,entry.id,entry.content,entry.file_path,entry.file_name)
   on conflict(character_id) do update set submission_id=excluded.submission_id,content=excluded.content,
     file_path=excluded.file_path,file_name=excluded.file_name,published_at=clock_timestamp();
 end if;
 update public.atlas_questionnaire_submissions set status=p_decision,review_note=coalesce(p_note,''),reviewer_id=auth.uid(),reviewed_at=clock_timestamp() where id=p_id;
end $$;
revoke all on function private.atlas_review_questionnaire(uuid,text,text) from public,anon;
grant execute on function private.atlas_review_questionnaire(uuid,text,text) to authenticated;
create function public.atlas_review_questionnaire(p_id uuid,p_decision text,p_note text default '') returns void
language sql security invoker set search_path=''
begin atomic
 select private.atlas_review_questionnaire(p_id,p_decision,p_note);
end;
revoke all on function public.atlas_review_questionnaire(uuid,text,text) from public,anon;
grant execute on function public.atlas_review_questionnaire(uuid,text,text) to authenticated;
