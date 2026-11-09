-- «Отложить пару» (2026-11-09): пилоты не готовы — пара уходит в конец своего раунда, пульт, плашки, комментатор и сайт переходят к следующей.
alter table public.battles add column if not exists deferred_at timestamptz;
