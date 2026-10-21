-- Второй канал объявлений в Discord — на английском, для зарубежных пилотов
alter table public.private_settings add column if not exists discord_webhook_en text;
