-- Больше возможностей в админке: прогрев отключается на этапе, ник и аватар пилота можно задать вручную.

-- Прогревочный заезд в квалификации (выключен — у пилота сразу 2 зачётные попытки)
alter table public.stages add column if not exists warmup boolean not null default true;

-- Ник / аватар, заданные организатором: вход через Steam их больше не перезаписывает
alter table public.profiles
  add column if not exists custom_nickname boolean not null default false,
  add column if not exists custom_avatar boolean not null default false;

-- Аватары от организатора: avatars/<profile_id>/avatar.webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
drop policy if exists "avatar admin" on storage.objects;
create policy "avatar admin" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and public.is_admin())
  with check (bucket_id = 'avatars' and public.is_admin());
