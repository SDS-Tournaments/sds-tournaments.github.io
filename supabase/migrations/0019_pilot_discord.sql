-- Ник пилота в Discord — для связи со штабом. Отдельная таблица: в профилях всё публичное, а контакт видят только сам пилот и штаб.
create table if not exists public.pilot_contacts (
  profile_id uuid primary key references public.profiles on delete cascade,
  discord text not null check (char_length(btrim(discord)) between 2 and 64),
  updated_at timestamptz not null default now()
);
alter table public.pilot_contacts enable row level security;
grant select, insert, update on public.pilot_contacts to authenticated;

create policy "own or staff" on public.pilot_contacts for select
  using (profile_id = (select auth.uid()) or public.is_staff());
create policy "own insert" on public.pilot_contacts for insert
  with check (profile_id = (select auth.uid()) or public.is_admin());
create policy "own update" on public.pilot_contacts for update
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

-- Запись на этап: + только аккаунт Steam и указан Discord. Проверка срабатывает и при повторной записи
-- (после отмены строка не вставляется заново, а обновляется — раньше это обходило проверки).
create or replace function public.prepare_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
declare season bigint;
begin
  -- обновление без перехода в «записан» (отмена, группы и очередь от штаба) — не трогаем
  if tg_op = 'UPDATE' and (new.status <> 'registered' or old.status = 'registered') then return new; end if;
  select season_id into season from public.stages where id = new.stage_id;
  new.team_id := (
    select team_id from public.team_members
    where season_id = season and profile_id = new.profile_id and status = 'approved'
  );
  -- штаб и сервер (тестовые пилоты) записывают без проверок
  if public.is_staff() or coalesce((select auth.role()), '') not in ('authenticated', 'anon') then return new; end if;
  if (select steam_id from public.profiles where id = new.profile_id) !~ '^[0-9]{17}$' then
    raise exception 'Записаться на этап можно только с аккаунтом Steam';
  end if;
  if (select start_number from public.profiles where id = new.profile_id) is null then
    raise exception 'Сначала выберите стартовый номер в личном кабинете';
  end if;
  if not exists (select 1 from public.pilot_contacts where profile_id = new.profile_id) then
    raise exception 'Укажите ник в Discord в личном кабинете';
  end if;
  if exists (select 1 from public.sanctions where profile_id = new.profile_id and type = 'ban') then
    raise exception 'Регистрация недоступна: у вас бан на турниры SDS';
  end if;
  return new;
end $$;

drop trigger if exists registrations_prepare on public.registrations;
create trigger registrations_prepare before insert or update on public.registrations
  for each row execute function public.prepare_registration();
