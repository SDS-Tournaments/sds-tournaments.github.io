-- Регистрация на этап: команда подставляется из состава сезона, нужен стартовый номер, бан не пускает
create function public.prepare_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
declare season bigint;
begin
  select season_id into season from public.stages where id = new.stage_id;
  new.team_id := (
    select team_id from public.team_members
    where season_id = season and profile_id = new.profile_id and status = 'approved'
  );
  if public.is_staff() then return new; end if;
  if (select start_number from public.profiles where id = new.profile_id) is null then
    raise exception 'Сначала выберите стартовый номер в личном кабинете';
  end if;
  if exists (select 1 from public.sanctions where profile_id = new.profile_id and type = 'ban') then
    raise exception 'Регистрация недоступна: у вас бан на турниры SDS';
  end if;
  return new;
end $$;
create trigger registrations_prepare before insert on public.registrations
  for each row execute function public.prepare_registration();
