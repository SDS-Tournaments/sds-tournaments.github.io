-- Приглашение на Discord-сервер: ссылка в подвале сайта, меняется в Админке → Настройки
alter table public.app_settings add column if not exists discord_invite text;
