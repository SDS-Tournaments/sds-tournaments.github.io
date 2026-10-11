-- Чтобы протест не ушёл в Discord дважды
alter table public.protests add column notified_at timestamptz;
