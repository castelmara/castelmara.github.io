alter table public.profile_private drop constraint profile_private_cursor_style_check;
alter table public.profile_private add constraint profile_private_cursor_style_check check (cursor_style in ('classic','flower','football','puck','heart','star','butterfly','tennis','basketball','sparkles','crab','cat','frog','cherries','jellyfish','planet'));
