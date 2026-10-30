-- Тестовый канал Discord: проверить все объявления, не трогая настоящие каналы.
-- discord_test_mode — пока включено, всё, что сайт шлёт в Discord, уходит только в тестовый канал (RU и EN подряд).
alter table public.private_settings add column if not exists discord_webhook_test text;
alter table public.private_settings add column if not exists discord_test_mode boolean not null default false;
