-- Этап идёт в два дня: день 1 — квалификация (starts_at), день 2 — парные заезды Top 32 (battles_at).
-- Между ними статус «Квалификация завершена» (qual_done): сайт не горит LIVE, отсчёт идёт до парных.
-- Парные можно поставить и на другие выходные — это просто дата.
alter type public.stage_status add value if not exists 'qual_done' after 'qualifying';

alter table public.stages add column if not exists battles_at timestamptz;

update public.stages set battles_at = starts_at + interval '1 day' where battles_at is null and starts_at is not null;
