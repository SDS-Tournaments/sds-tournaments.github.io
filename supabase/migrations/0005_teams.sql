-- Команды: один пилот — капитан не больше одной команды; капитан сразу в составе
create unique index one_team_per_captain on public.teams (captain_id) where captain_id is not null;

create function public.captain_joins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.teams where id = new.team_id and captain_id = new.profile_id) then
    new.status := 'approved';
  end if;
  return new;
end $$;
-- имя с «a_», чтобы сработал раньше проверки размера команды (триггеры идут по алфавиту)
create trigger a_team_members_captain before insert on public.team_members
  for each row execute function public.captain_joins();

-- RLS проверяет строку уже после триггера: капитану своей команды можно сразу «approved»
drop policy "request or invite" on public.team_members;
create policy "request or invite" on public.team_members for insert
  with check (
    public.is_admin()
    or (status = 'approved' and profile_id = (select auth.uid())
        and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid())))
    or (status = 'pending' and (
        profile_id = (select auth.uid())
        or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid()))))
  );
