-- Группы квалификации: буфер-группы и их названия, по номеру группы ([0] — группа 1)
alter table public.stages add column if not exists group_meta jsonb not null default '[]'::jsonb;
