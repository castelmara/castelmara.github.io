-- Apply together with the frontend and local icon. No schema or role changes.
begin;
do $$ begin
  if not exists(select 1 from public.profiles where id='c8e46ed6-7024-467e-914b-f74b57f20f9c' and nickname='passion') then
    raise exception 'Expected passion account not found';
  end if;
end $$;
insert into public.achievements(code,title,description,icon,category,is_secret,personal_user_id)
values('personal_passion_visca_barca','visca el barça!','спасибо богу что я не мадридиста','assets/achievements/barcelona.png','personal',false,'c8e46ed6-7024-467e-914b-f74b57f20f9c')
on conflict(code) do nothing;
do $$ begin
  if not exists(select 1 from public.achievements where code='personal_passion_visca_barca' and personal_user_id='c8e46ed6-7024-467e-914b-f74b57f20f9c') then
    raise exception 'Achievement belongs to another account';
  end if;
end $$;
insert into public.user_achievements(user_id,achievement_id)
select 'c8e46ed6-7024-467e-914b-f74b57f20f9c',id from public.achievements where code='personal_passion_visca_barca'
on conflict do nothing;
commit;
