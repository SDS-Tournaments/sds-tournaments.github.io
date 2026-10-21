# Обзор проекта

## Что это
**Sad Drift Series (SDS)** — сайт онлайн-чемпионата по дрифту в CarX Drift Racing Online 2.
Три роли сайта: витрина лиги для пилотов и зрителей, пульт судейства для штаба, источник плашек для стрима (OBS).

- Прод: **https://sds-tournaments.github.io** (GitHub Pages, репозиторий `SDS-Tournaments/sds-tournaments.github.io`, ветка `main`).
- Код: `Z:\dev\sds`.
- Сезон «SDS 2.0», 4 этапа; первый этап — 31.10 (квала) и 01.11 (Top 32), 20:30 МСК.

## Владелец
- Русскоязычный владелец продукта, **не разработчик**. Общаемся только по-русски, без жаргона, объясняем простыми словами.
- Ждёт, что Claude — эксперт: сам принимает технические решения, предлагает, проверяет. Ценит внимательность
  (замечал пропуски: ширина корешка, срез венка) — проверять визуал тщательно.
- Сам делает: запуск миграций в Supabase SQL Editor, деплой edge-функций, аккаунты (Steam API key, Yandex, Sketchfab),
  всё, что требует его логина.
- Даёт команду на прод словом **«заливай»**.

## Стек
| Часть | Что |
|---|---|
| Фронт | Angular 22 (standalone, signals, `@if/@for/@defer`, `animate.enter`), SCSS, без UI-библиотек |
| i18n | Transloco, `public/i18n/ru.json` / `en.json`; RU по умолчанию, EN переключателем. Админка и пульты — только RU |
| Бэкенд | Supabase: Postgres + RLS, Auth, Realtime, Storage, Edge Functions (Deno) |
| Хостинг | GitHub Pages через GitHub Actions (`.github/workflows/pages.yml`) |
| Вход | только Steam (OpenID 2.0 → edge-функция `steam-auth` → magic-link сессия Supabase) |
| Прочее | `three` (3D-акулы на /attack-shark), `html-to-image` (скачивание FIFA-карточки), `marked` (регламент), `@angular/cdk` (drag&drop групп), vitest |

## Окружения
| | Прод | Тест (staging) |
|---|---|---|
| Supabase ref | `dghjrbxffsmmdalzdycz` | `oqmepaxnccxqupemvewy` |
| Publishable key | `sb_publishable_WneCg6RjW4ypf5IzJw1ujw_oJ8v7RXd` | `sb_publishable_Yo2OQDrA0hvk0CYPvPpDKg_LdtmLXBM` |
| Конфиг | `src/app/supabase.config.ts` | `src/app/supabase.config.staging.ts` (fileReplacements) |
| Локально | `npx ng serve --host 127.0.0.1 --port 4200` | `npx ng serve --configuration staging --host 127.0.0.1 --port 4201` (бейдж «ТЕСТОВАЯ БАЗА») |

- Локальный `:4200` ходит в **боевую базу** — осторожно с записью. Для прогонов этапа — `:4201` (staging).
- `SITE_URLS` (секрет функций) на staging включает `http://127.0.0.1:4201`.
- Publishable-ключи публичные (в коде можно), защита — RLS.

## Секреты и безопасность — не нарушать
- **Никогда** не класть в код/вики/коммиты `sb_secret_…` и service_role ключ — только в секреты Edge Functions.
- Steam API key ставит владелец сам, не просить. Пароль от БД не просить и не хранить.
- Не входить под аккаунтом владельца и не вводить креды; аккаунты заводит он.
- Не ослаблять `staffGuard` и RLS. Фронт только прячет кнопки — права проверяет база.

## Внешние сервисы
- Google Search Console — подтверждён (`public/google54a4e28697b1c8fa.html`).
- Яндекс.Вебмастер — права подтверждены (`public/yandex_ecbf3a7d4ebf63fc.html`); sitemap ещё не добавлен (у Яндекса был сбой).
- Discord: приглашение на сервер и вебхуки RU/EN — в «Админка → Discord». Настройка самого сервера ведётся отдельно — папка `Z:\dev\sds-discord` (свои CLAUDE.md и notes.md).
- Twitch-канал по умолчанию — «Админка → Настройки», у этапа может быть свой.
- Спонсоры: генеральный — CarX Technologies (из таблицы `sponsors`); партнёр Attack Shark — пока только на `/attack-shark`.
