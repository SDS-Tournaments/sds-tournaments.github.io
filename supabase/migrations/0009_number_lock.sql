-- Стартовый номер пилот выбирает один раз за сезон; менять дальше может только админ
alter table public.profiles add column number_season_id bigint references public.seasons on delete set null;

create or replace function public.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_season bigint;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.steam_id is distinct from old.steam_id
     or new.nickname is distinct from old.nickname
     or new.avatar_url is distinct from old.avatar_url then
    raise exception 'Можно менять только номер, ливрею и описание';
  end if;
  new.number_season_id := old.number_season_id; -- пилот сам это поле не трогает
  if new.start_number is distinct from old.start_number then
    select id into v_season from public.seasons where status = 'active';
    -- null = null тоже «тот же сезон»: номер, выбранный вне сезона, до старта сезона не меняется
    if old.start_number is not null and old.number_season_id is not distinct from v_season then
      raise exception 'Номер уже выбран в этом сезоне — сменить его может администратор';
    end if;
    new.number_season_id := v_season;
  end if;
  return new;
end $$;
