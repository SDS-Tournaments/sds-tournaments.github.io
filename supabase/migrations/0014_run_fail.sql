-- Причина нулевой попытки квалификации: спин, авария, выпрямление (проехал на прямых), вылет (4 колеса за трассой).
-- spin = true по-прежнему означает «попытка = 0» (на нём держится total), fail уточняет, что случилось.
alter table public.qual_runs
  add column if not exists fail text check (fail in ('spin', 'crash', 'straight', 'offtrack'));

update public.qual_runs set fail = 'spin' where spin and fail is null;
