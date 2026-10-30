# Edge Functions (Supabase, Deno)

Код — `supabase/functions/<name>/index.ts`. Деплоит владелец (см. [workflow.md](workflow.md#edge-функции)).
Общие секреты: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (ставит Supabase), `SITE_URLS` — разрешённые адреса сайта
через запятую (первый — основной; на staging есть `http://127.0.0.1:4201`).

## steam-auth
Вход через Steam (OpenID 2.0) → сессия Supabase. Деплой **с `--no-verify-jwt`**. Секрет `STEAM_API_KEY` (ставит владелец).
1. `Auth.login()` → `…/functions/v1/steam-auth?redirect=<site>/auth/callback` → Steam.
2. Steam возвращает на сайт `/auth/steam` (`SteamReturn`), тот пересылает параметры функции; функция проверяет
   (`check_authentication`), берёт SteamID64, ник и аватар (`GetPlayerSummaries`).
3. Создаёт/находит пользователя `<steamid>@steam.sds`, обновляет `profiles` (ник/аватар — каждый вход, кроме заданных организатором: `custom_nickname` / `custom_avatar`, 0023).
4. Генерирует magic-link и отправляет на `/auth/callback#token_hash=…`; фронт — `verifyOtp` (`Auth.finishLogin`).

## discord-notify
Оповещения в Discord. Вызов с фронта — `notify(type, id)` (фоном) или из админки (тест).
- Типы: `registration`, `stage_start`, `battles_start`, `groups` (квала: какая группа едет и какая готовится — считает на сервере по очереди и qual_runs 1–2; подписи групп как `groupLabel`), `results` (подиум + лидер сезона), `protest`, `test` (+ `lang`).
- `groups` шлётся: сразу после `stage_start`; с пульта главного судьи, когда на трассу выходит новая группа; кнопкой «📣 Группы в Discord». Пилотов не пингует (вебхук умеет только по Discord ID).
- Два канала: `private_settings.discord_webhook_url` (RU) и `discord_webhook_en` (EN). Объявления этапов уходят в оба,
  каждый на своём языке (EN: `title_en`, время «31 Oct, 20:30 MSK (UTC+3)»). Протесты — только RU (дело штаба). Пустой вебхук — канал пропускается.
- Права: штаб — любые события; пилот — только свой протест младше 10 минут (и только один раз — `notified_at`).
- Сообщение: embed с логотипом сайта, ссылкой на этап/кабинет/админку, Twitch из ссылки или имени канала.
- **Статус деплоя двуязычной версии на проде не подтверждён** (владелец должен был выполнить команду после 2026-10-21).

## test-pilots
Только admin. Тестовые пилоты (`steam_id = test-N`, почта `test-N@test.sds`): создать N (по умолчанию 24, до 120, пачками) / удалить всех;
удалить настоящих пилотов по одному или всех между сезонами (штаб и организаторы не удаляются).
Нужна, потому что SQL Editor не может писать в `auth.users`. Кнопки — в «Участники этапа» и «Пилоты» (тестовые — только локально).
Записи тестовых пилотов на этап идут от сервера → триггер регистрации их пропускает.
