-- Принятие в команду без организатора:
-- заявку пилота (invited = false) принимает капитан, приглашение капитана (invited = true) — сам пилот.
alter table public.team_members add column invited boolean not null default false;

-- Кто создал строку: если не сам пилот — это приглашение. Ставит база, не клиент.
create or replace function public.captain_joins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.invited := new.profile_id is distinct from auth.uid();
  if exists (select 1 from public.teams where id = new.team_id and captain_id = new.profile_id) then
    new.status := 'approved';
    new.invited := false;
  end if;
  return new;
end $$;

-- Не-организатор при принятии меняет только статус
create function public.guard_member_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.team_id is distinct from old.team_id or new.season_id is distinct from old.season_id
     or new.profile_id is distinct from old.profile_id or new.invited is distinct from old.invited then
    raise exception 'Можно только принять заявку или приглашение';
  end if;
  return new;
end $$;
create trigger team_members_guard_update before update on public.team_members
  for each row execute function public.guard_member_update();

create policy "accept" on public.team_members for update
  using (
    status = 'pending' and (
      (invited and profile_id = (select auth.uid()))
      or (not invited and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid())))
    )
  )
  with check (
    status = 'approved' and (
      (invited and profile_id = (select auth.uid()))
      or (not invited and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid())))
    )
  );
