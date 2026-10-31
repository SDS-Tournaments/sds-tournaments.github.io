-- Голоса зрителей больше не идут через Realtime: пульт комментатора и плашка стрима опрашивают итоги раз в 3 с.
-- Каждый голос был сообщением каждому подписчику — сотни в секунду при лимите Free 100/с (2026-10-31).
alter publication supabase_realtime drop table public.predictions;

-- Прогнозы — только на парные (2026-11-01): голос за заезд квалификации база больше не принимает.
drop policy if exists "vote" on public.predictions;
create policy "vote" on public.predictions for insert with check (battle_id is not null);
