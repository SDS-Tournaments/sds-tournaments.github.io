-- Исправление 0001: в подзапросе по teams «name» означало название команды, а не путь файла,
-- поэтому капитан не мог загрузить логотип (проходил только admin). Путь — явно objects.name.
drop policy "team logo" on storage.objects;
create policy "team logo" on storage.objects for all to authenticated
  using (bucket_id = 'team-logos' and (public.is_admin() or exists (
    select 1 from public.teams t where t.id::text = (storage.foldername(objects.name))[1] and t.captain_id = (select auth.uid()))))
  with check (bucket_id = 'team-logos' and (public.is_admin() or exists (
    select 1 from public.teams t where t.id::text = (storage.foldername(objects.name))[1] and t.captain_id = (select auth.uid()))));
