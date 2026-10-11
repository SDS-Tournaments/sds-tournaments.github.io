-- Черновики этапов видны всем как «запланированные» (дорога сезона на главной)
drop policy "read" on public.stages;
create policy "read" on public.stages for select using (true);
