-- Карта трассы этапа и баллы по зонам: картинка от дизайнера + таблица «сколько баллов каждого критерия разыгрывается в зоне».
-- zones: [{ "name": "TGZ1", "line": 12, "angle": 8, "style": 8 }, …] — по порядку прохождения трассы; сумма по критерию = вес этапа.
alter table public.stages
  add column if not exists track_map_url text,
  add column if not exists zones jsonb not null default '[]'::jsonb;

-- Картинки трасс: читают все, загружает штаб (настройки этапа)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tracks', 'tracks', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "track map" on storage.objects;
create policy "track map" on storage.objects for all to authenticated
  using (bucket_id = 'tracks' and public.is_staff())
  with check (bucket_id = 'tracks' and public.is_staff());
