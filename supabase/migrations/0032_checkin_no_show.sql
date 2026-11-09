-- Подтверждение участия и неявки (2026-11-09).
-- Этап 1: записались 140, приехали 75 — на выяснение, кто есть, ушло много времени.

-- Неявка: пилот остаётся в своей группе и на своём месте, но в очередь не попадает. Значение не используется в этой же миграции.
alter type public.reg_status add value if not exists 'no_show';

-- Вернуть опоздавшего в конец идущей группы = записать одну строку (место между двумя соседними), а не сдвигать всю очередь
-- Postgres не меняет тип колонки, которая есть в правилах доступа: снимаем два правила и возвращаем их без изменений (как в 0028)
drop policy if exists "pilot registers" on public.registrations;
drop policy if exists "pilot withdraws" on public.registrations;
alter table public.registrations alter column queue_order type double precision;
create policy "pilot registers" on public.registrations for insert
  with check (
    profile_id = (select auth.uid()) and status = 'registered' and group_no is null and queue_order is null
    and exists (select 1 from public.stages s where s.id = stage_id and s.status = 'registration' and not s.reg_closed)
  );
create policy "pilot withdraws" on public.registrations for update
  using (profile_id = (select auth.uid()) and exists (select 1 from public.stages s where s.id = stage_id and s.status = 'registration'))
  with check (
    profile_id = (select auth.uid()) and group_no is null and queue_order is null
    and (status = 'withdrawn' or (status = 'registered' and exists (select 1 from public.stages s where s.id = stage_id and not s.reg_closed)))
  );

-- Окно подтверждения: открывается за час до starts_at, закрывает админ или старт квалификации
alter table public.stages
  add column if not exists checkin_closed boolean not null default false,
  add column if not exists checkin_notified_at timestamptz;

-- Отдельная таблица и не в Realtime: нажатие «Я буду» не рассылает событие открытым пультам
create table if not exists public.stage_checkins (
  stage_id bigint not null references public.stages on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (stage_id, profile_id)
);
create index if not exists stage_checkins_profile on public.stage_checkins (profile_id);
alter table public.stage_checkins enable row level security;

drop policy if exists "read" on public.stage_checkins;
create policy "read" on public.stage_checkins for select using (profile_id = (select auth.uid()) or public.is_staff());
drop policy if exists "staff" on public.stage_checkins;
create policy "staff" on public.stage_checkins for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "pilot confirms" on public.stage_checkins;
create policy "pilot confirms" on public.stage_checkins for insert with check (
  profile_id = (select auth.uid())
  and exists (select 1 from public.registrations r where r.stage_id = stage_checkins.stage_id and r.profile_id = (select auth.uid()) and r.status = 'registered')
  and exists (select 1 from public.stages s where s.id = stage_id and s.status = 'registration' and not s.checkin_closed and now() >= s.starts_at - interval '1 hour')
);
drop policy if exists "pilot cancels" on public.stage_checkins;
create policy "pilot cancels" on public.stage_checkins for delete using (
  profile_id = (select auth.uid())
  and exists (select 1 from public.stages s where s.id = stage_id and s.status = 'registration' and not s.checkin_closed and now() >= s.starts_at - interval '1 hour')
);

-- Сообщение в Discord за час до старта: таймер базы вызывает discord-notify, функция сверяет этот секрет
alter table public.private_settings add column if not exists cron_secret text default gen_random_uuid()::text;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.send_checkin_open() returns void
language plpgsql security definer set search_path = '' as $$
declare
  st record;
  secret text;
begin
  select cron_secret into secret from public.private_settings where id = 1;
  -- отметка ставится сразу: следующий запуск таймера этот этап уже не возьмёт
  for st in
    update public.stages set checkin_notified_at = now()
    where status = 'registration' and not checkin_closed and checkin_notified_at is null
      and starts_at > now() and starts_at <= now() + interval '1 hour'
    returning id
  loop
    -- адрес прода: на staging вызов получит 401 из-за другого секрета
    perform net.http_post(
      url := 'https://dghjrbxffsmmdalzdycz.supabase.co/functions/v1/discord-notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
      body := jsonb_build_object('type', 'checkin_open', 'id', st.id)
    );
  end loop;
  delete from cron.job_run_details where end_time < now() - interval '7 days';
end $$;
revoke all on function public.send_checkin_open() from public, anon, authenticated;

select cron.schedule('sds-checkin-open', '*/5 * * * *', 'select public.send_checkin_open()');
