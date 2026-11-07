-- «Снять с эфира» (2026-11-08): этап идёт (квала/парные), но трансляции сейчас нет — на сайте без LIVE.
-- Ставится вручную в админке этапа; при переходе в «Квалификацию» или «Парные» сбрасывается.
alter table public.stages add column if not exists off_air boolean not null default false;
