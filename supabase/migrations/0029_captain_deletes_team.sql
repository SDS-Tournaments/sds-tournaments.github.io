-- Капитан может удалить свою команду (2026-11-02) — только пока у неё нет истории:
-- результатов этапов и титула чемпиона сезона (иначе команда пропала бы из прошлых итогов). Остальное — admin, как раньше.
-- Состав (team_members) удаляется каскадом.
drop policy if exists "captain deletes" on public.teams;
create policy "captain deletes" on public.teams for delete
  using (
    captain_id = (select auth.uid())
    and not exists (select 1 from public.stage_results r where r.team_id = teams.id)
    and not exists (select 1 from public.seasons s where s.champion_team_id = teams.id)
  );
