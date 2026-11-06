-- Аварийный сайт (2026-11-06): Админка → Настройки → «Аварийный сайт» — зрителям только трансляция и группы.
-- Читают все (политика read на app_settings), меняет admin.
alter table public.app_settings add column if not exists emergency boolean not null default false;
