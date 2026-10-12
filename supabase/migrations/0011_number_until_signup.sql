-- Номер остаётся за пилотом между сезонами. Пилот меняет его свободно, пока не записался
-- ни на один этап активного сезона; после первой записи — только организатор (до конца сезона).
-- Заменяет правило 0009 «один выбор за сезон».
create or replace function public.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.steam_id is distinct from old.steam_id
     or new.nickname is distinct from old.nickname
     or new.avatar_url is distinct from old.avatar_url
     or new.legacy is distinct from old.legacy then
    raise exception 'Можно менять только номер, ливрею и описание';
  end if;
  -- снятая заявка тоже считается: иначе «записался → снялся → сменил номер» между этапами
  if new.start_number is distinct from old.start_number and exists (
    select 1 from public.registrations r
    join public.stages s on s.id = r.stage_id
    join public.seasons se on se.id = s.season_id
    where r.profile_id = new.id and se.status = 'active'
  ) then
    raise exception 'Вы уже записались на этап этого сезона — номер сменит только администратор';
  end if;
  return new;
end $$;

alter table public.profiles drop column number_season_id;
