# База данных (Supabase Postgres)

Полная история — `supabase/migrations/`. `docs/staging-setup.sql` — сборная схема для создания тестовой базы
(создана до 0017; новые миграции на staging накатывать отдельно).

## Перечисления (enum)
| Тип | Значения |
|---|---|
| `app_role` | admin, staff, pilot |
| `season_status` | draft, active, finished (активный сезон один — индекс `one_active_season`) |
| `stage_status` | draft, registration, qualifying, **qual_done** (0016), battles, finished |
| `reg_status` | registered, withdrawn, dq |
| `member_status` | pending, approved |
| `battle_round` | r32, r16, qf, sf, third, final |
| `battle_status` | pending, running, done |
| `battle_result` | normal, tech_loss, bye, qual_tiebreak, **contact** (0015) |
| `judge_slot` | angle, style, line |
| `vote_kind` | leader, chaser, omt |
| `sanction_type` | warning, dq, ban |
| `sponsor_tier` | general, partner |
| `protest_status` | pending, rejected, reversed, rerun |

## Таблицы
| Таблица | Ключевые поля | Чтение / запись |
|---|---|---|
| `profiles` | id(=auth.uid), steam_id (17 цифр; тестовые `test-N`), nickname, avatar_url, role, start_number (unique 1–999), livery_url, car, engine, gearbox, power_hp, bio_ru/en, legacy jsonb | все / сам (триггер ограничивает поля) или admin |
| `pilot_contacts` (0019) | profile_id, discord (2–64), updated_at | **сам и штаб** / сам или admin. Ник Discord — приватный, поэтому не в profiles |
| `seasons` | number, title, status, qual_points, battle_points (jsonb, RDS 2024), team_counted=3, champion_pilot_id/team_id | все (кроме draft) / admin |
| `stages` | season_id, ord, **track_map_url**, **zones** [{name, line, angle, style}] (0021), title_ru/en, description_ru/en, track, **starts_at** (день 1, квала), **battles_at** (день 2, Top 32), status, weights {angle,style,line} (сумма 100), judges, bracket_size (auto/32/16/8), sponsor_id, twitch_channel | все (0006) / staff |
| `registrations` | (stage_id, profile_id), team_id (снимок), group_no, queue_order, status | все / пилот сам (insert, отмена) или staff |
| `qual_runs` | stage_id, profile_id, attempt 0–2 (0 — прогрев), angle/style/line (шаг 0.5), spin, **fail** (spin/crash/straight/offtrack, 0014), total (generated: spin → 0) | все / staff |
| `battles` | stage_id, round, slot, leader_id, chaser_id, winner_id, omt_count 0–2, status, result, decided_at | все / staff |
| `battle_votes` | (battle_id, try 0–2, judge), vote | все / staff |
| `stage_results` | stage_id, profile_id, team_id, qual_place, battle_place, stage_place, qual_points, battle_points, total | все / staff |
| `achievements` | (profile_id, code, stage_id) | все / staff |
| `teams` | name (2–40, unique), logo_url, captain_id | все / создатель-капитан, admin |
| `team_members` | (season_id, profile_id), team_id, status, **invited** (0013) | все / заявка, приглашение, принятие (0013), admin |
| `sanctions` | profile_id, stage_id, type, reason | staff / staff (insert), admin (delete) |
| `sponsors` | name, logo_url, url, tier, active, starts_at, ends_at, on_overlay, sort | активные — все / admin |
| `protests` (0003) | battle_id, stage_id, profile_id, video_url, reason, status, admin_comment, resolved_*, notified_at (0008) | сам и штаб / пилот (insert), admin |
| `overlay_state` | id=1, state jsonb (см. [overlay.md](overlay.md)) | все / staff |
| `app_settings` | id=1, twitch_channel, regulation_ru/en, regulation_version, **discord_invite** (0017) | все / admin |
| `private_settings` | id=1, discord_webhook_url (RU), **discord_webhook_en** (0018) | admin / admin |

## Функции и триггеры
- `my_role()`, `is_admin()`, `is_staff()` — security definer (без рекурсии RLS). staff = admin или staff.
- `guard_profile` (последняя версия 0011): не-admin меняет только номер, ливрею, «о себе», машину; номер — пока не записан
  ни на один этап активного сезона (включая снятые заявки). Сервер (`current_user` не authenticated/anon) — без ограничений.
- `prepare_registration` (последняя версия **0019**, `before insert or update`): подставляет команду из подтверждённого состава сезона;
  для пилота проверяет: аккаунт Steam (`steam_id ~ '^[0-9]{17}$'`), стартовый номер, ник Discord в `pilot_contacts`, нет бана.
  На update срабатывает только при переходе в `registered` (повторная запись после отмены). Штаб и сервер (`auth.role()` не authenticated/anon) — без проверок.
- `guard_protest` (0003): подаёт только проигравший, ≤ 5 мин после `decided_at`, этап в `battles`, ≤ 2 за этап.
- `captain_joins` (0005/0013): капитан сразу в составе; кто создал строку — определяет `invited`. Триггер назван `a_…`, чтобы идти раньше проверки размера.
- `guard_member_update` (0013): не-admin при принятии меняет только статус.
- Команда ≤ 8 подтверждённых пилотов за сезон; пилот — в одной команде за сезон.

## Хранилище (Storage, публичное чтение)
| Бакет | Лимит | Запись |
|---|---|---|
| `liveries` | 1 МБ, jpeg/png/webp | пилот — только в папку `<uid>/`, admin |
| `team-logos` | 512 КБ | капитан своей команды (политика исправлена в 0012), admin |
| `sponsors` | 512 КБ, + svg | admin |
| `tracks` (0021) | 2 МБ, jpeg/png/webp | штаб; путь `<stage_id>/map.webp` |

## Realtime
Публикация `supabase_realtime`: stages, registrations, qual_runs, battles, battle_votes, overlay_state, protests.

## Миграции
| № | Что |
|---|---|
| 0001 | Начальная схема: типы, таблицы, RLS, хранилище, Realtime, генеральный спонсор CarX |
| 0002 | Машина пилота (car, engine, gearbox, power_hp) |
| 0003 | Протесты + `battles.decided_at` + `guard_protest` |
| 0004 | `prepare_registration` (команда, номер, бан) |
| 0005 | Команды: капитан сразу в составе |
| 0006 | Черновики этапов видны всем (дорога сезона) |
| 0007 | Регламент SDS v2.0 RU+EN в `app_settings` |
| 0008 | `protests.notified_at` (не слать в Discord дважды) |
| 0009 | Номер раз за сезон (заменено 0011) |
| 0010 | `profiles.legacy` — статистика до сайта (вносит admin) |
| 0011 | Номер меняется свободно до первой записи на этап сезона |
| 0012 | Политика логотипа команды (капитан снова может загружать) |
| 0013 | Принятие в команду без организатора (`invited`) |
| 0014 | `qual_runs.fail` — причина нулевой попытки |
| 0015 | `battle_result` 'contact' (ачивка «Божественное касание») |
| 0016 | Двухдневные этапы: `qual_done`, `stages.battles_at` |
| 0017 | `app_settings.discord_invite` |
| 0018 | `private_settings.discord_webhook_en` |
| 0019 | `pilot_contacts` + новая `prepare_registration` (Steam + Discord, и на update) |
| 0020 | Регламент 2.1: мод NeXT (партнёр) разрешён — п. 10.5–10.6, RU+EN (`replace` по тексту) |
| 0021 | Трасса этапа: `stages.track_map_url`, `stages.zones` (jsonb), бакет `tracks` (пишет штаб) |

Статус: 0021 на проде выполнена (2026-10-25); 0020 — ждёт запуска владельцем. 0001–0019 на **проде** выполнены (0019 — таблица точно есть; триггер — если владелец запускал SQL целиком).
На **staging** 0017–0019 — не подтверждено, проверить перед прогоном.
