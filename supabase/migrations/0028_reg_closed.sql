-- Закрыть регистрацию, не меняя статус этапа (2026-11-01).
-- Закрыта: записаться (и записаться снова после снятия) нельзя, сняться — можно. Штаб записывает вручную как раньше.
alter table public.stages add column if not exists reg_closed boolean not null default false;

drop policy if exists "pilot registers" on public.registrations;
create policy "pilot registers" on public.registrations for insert
  with check (
    profile_id = (select auth.uid()) and status = 'registered' and group_no is null and queue_order is null
    and exists (select 1 from public.stages s where s.id = stage_id and s.status = 'registration' and not s.reg_closed)
  );

drop policy if exists "pilot withdraws" on public.registrations;
create policy "pilot withdraws" on public.registrations for update
  using (profile_id = (select auth.uid()) and exists (select 1 from public.stages s where s.id = stage_id and s.status = 'registration'))
  with check (
    profile_id = (select auth.uid()) and group_no is null and queue_order is null
    and (status = 'withdrawn' or (status = 'registered' and exists (select 1 from public.stages s where s.id = stage_id and not s.reg_closed)))
  );
