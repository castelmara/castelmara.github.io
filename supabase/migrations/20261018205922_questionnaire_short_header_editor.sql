alter table public.atlas_questionnaire_submissions
 add column edited_text text,
 add column edit_revision integer not null default 0,
 add column edited_by uuid references public.profiles(id),
 add column edited_at timestamptz;
create index questionnaire_editor on public.atlas_questionnaire_submissions(edited_by);
alter table public.atlas_questionnaire_publications add column document_text text;
-- Prevent clients from forging an editorial draft at submission time.
alter policy questionnaire_submit on public.atlas_questionnaire_submissions with check (
 actor_id=(select auth.uid()) and status='pending' and reviewer_id is null and reviewed_at is null and review_note=''
 and edited_text is null and edit_revision=0 and edited_by is null and edited_at is null
 and exists(select 1 from public.character_owners co join public.atlas_character_catalog c on c.id=co.character_id and c.active
 where co.user_id=(select auth.uid()) and co.character_id=atlas_questionnaire_submissions.character_id)
);
create or replace function private.atlas_validate_questionnaire() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from jsonb_each(new.content) x where x.key not in ('fullName','faculty','faceclaim') or jsonb_typeof(x.value)<>'string') then raise exception 'Заполните только короткую шапку анкеты'; end if;
 if length(btrim(coalesce(new.content->>'fullName','')))=0 or length(btrim(coalesce(new.content->>'faculty','')))=0 or length(btrim(coalesce(new.content->>'faceclaim','')))=0 then raise exception 'Укажите имя, факультет и внешность'; end if;
 if new.file_path is null or new.file_path not like auth.uid()::text||'/%' or not exists(
 select 1 from storage.objects where bucket_id='atlas-questionnaires' and name=new.file_path
 and metadata->>'mimetype' in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')) then raise exception 'Прикрепите свой файл анкеты в формате PDF, DOCX или TXT'; end if;
 new.created_at:=clock_timestamp();return new;
end $$;

create function private.atlas_save_questionnaire_text(p_id uuid,p_text text,p_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare entry public.atlas_questionnaire_submissions;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='superadmin') then raise exception 'Только суперадмин может редактировать анкету'; end if;
 select * into entry from public.atlas_questionnaire_submissions where id=p_id for update;
 if not found or entry.status<>'pending' then raise exception 'Заявка уже рассмотрена или не найдена'; end if;
 if p_revision is distinct from entry.edit_revision then raise exception 'Другой суперадмин уже изменил текст. Откройте заявку заново'; end if;
 if p_text is null then raise exception 'Текст не передан'; end if;
 update public.atlas_questionnaire_submissions set edited_text=p_text,edited_by=auth.uid(),edited_at=clock_timestamp(),edit_revision=edit_revision+1 where id=p_id;
 return entry.edit_revision+1;
end $$;
revoke all on function private.atlas_save_questionnaire_text(uuid,text,integer) from public,anon;
grant execute on function private.atlas_save_questionnaire_text(uuid,text,integer) to authenticated;
create function public.atlas_save_questionnaire_text(p_id uuid,p_text text,p_revision integer) returns integer language sql security invoker set search_path=''
begin atomic select private.atlas_save_questionnaire_text(p_id,p_text,p_revision); end;
revoke all on function public.atlas_save_questionnaire_text(uuid,text,integer) from public,anon;
grant execute on function public.atlas_save_questionnaire_text(uuid,text,integer) to authenticated;

create function private.atlas_decide_questionnaire(p_id uuid,p_decision text,p_note text,p_text text,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare entry public.atlas_questionnaire_submissions; note text; final_text text;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='superadmin') then raise exception 'Только суперадмин может проверять анкеты'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'Неверное решение'; end if;
 select * into entry from public.atlas_questionnaire_submissions where id=p_id for update;
 if not found or entry.status<>'pending' then raise exception 'Заявка уже рассмотрена или не найдена'; end if;
 if p_revision is not null and p_revision<>entry.edit_revision then raise exception 'Другой суперадмин уже изменил текст. Откройте заявку заново'; end if;
 note:=btrim(coalesce(p_note,''));final_text:=coalesce(p_text,entry.edited_text);
 if p_decision='rejected' and note='' then raise exception 'Перечислите необходимые исправления'; end if;
 if p_decision='approved' then
   perform 1 from public.character_owners where user_id=entry.actor_id and character_id=entry.character_id for update;
   if not found then raise exception 'Персонаж больше не принадлежит автору заявки'; end if;
   if not exists(select 1 from public.atlas_character_catalog where id=entry.character_id and active) then raise exception 'Персонаж неактивен'; end if;
   if note='' then note:='Анкета принята. Персонаж «'||coalesce(entry.content->>'fullName',entry.character_id)||'» успешно зарегистрирован в системе АТЛАС. Добро пожаловать в Кастельмару!'; end if;
   insert into public.atlas_questionnaire_publications(character_id,submission_id,content,file_path,file_name,document_text)
   values(entry.character_id,entry.id,entry.content,entry.file_path,entry.file_name,final_text)
   on conflict(character_id) do update set submission_id=excluded.submission_id,
   content=atlas_questionnaire_publications.content||excluded.content,file_path=excluded.file_path,file_name=excluded.file_name,
   document_text=excluded.document_text,published_at=clock_timestamp();
 end if;
 update public.atlas_questionnaire_submissions set status=p_decision,review_note=note,reviewer_id=auth.uid(),reviewed_at=clock_timestamp(),
 edited_text=final_text,edit_revision=edit_revision+case when p_text is null then 0 else 1 end,
 edited_by=case when p_text is null then edited_by else auth.uid() end,
 edited_at=case when p_text is null then edited_at else clock_timestamp() end where id=p_id;
end $$;
revoke all on function private.atlas_decide_questionnaire(uuid,text,text,text,integer) from public,anon;
grant execute on function private.atlas_decide_questionnaire(uuid,text,text,text,integer) to authenticated;
create function public.atlas_decide_questionnaire(p_id uuid,p_decision text,p_note text,p_text text,p_revision integer) returns void language sql security invoker set search_path=''
begin atomic select private.atlas_decide_questionnaire(p_id,p_decision,p_note,p_text,p_revision); end;
revoke all on function public.atlas_decide_questionnaire(uuid,text,text,text,integer) from public,anon;
grant execute on function public.atlas_decide_questionnaire(uuid,text,text,text,integer) to authenticated;
-- Compatibility for older clients: approvals still use the saved editorial version.
create or replace function private.atlas_review_questionnaire(p_id uuid,p_decision text,p_note text) returns void language sql security invoker set search_path=''
begin atomic select private.atlas_decide_questionnaire(p_id,p_decision,p_note,null,null); end;
