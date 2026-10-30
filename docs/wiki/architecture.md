# Архитектура фронтенда

## Папки `src/app`
| Папка/файл | Что |
|---|---|
| `app.ts`, `app.html`, `app.scss` | Оболочка: шапка-«острова» (лого SDS, меню, RU/EN, тема, вход, колокольчик протестов), подвал, плашка-напоминание Discord, бейдж staging |
| `app.routes.ts` | Роуты; публичные с `data: { preload: true }` |
| `app.config.ts` | Роутер (scroll top, input binding, `PublicPreload`), Transloco, TitleStrategy |
| `auth.ts` | `supabase` клиент (fetch = `trackedFetch`), сервис `Auth` (session, profile + discord, ready), `staffGuard` |
| `boot.ts` | Загрузочный экран «SAD» (разметка в `index.html`), заливка по ответам базы; `retryFetch` — повтор GET/HEAD до 2 раз при обрыве |
| `live.ts` | Сервис «этап идёт»: классы `html.live` / `html.pulse`. **Без Realtime** — опрос раз в минуту и при возврате на вкладку (лимит подключений Free = 200); `pulse()` вызывает блок эфира |
| `theme.ts`, `tier.ts` | Темы сайта (NOIR + 5 уровней), уровень карточки по рейтингу |
| `i18n.ts` | Transloco-лоадер (переводы собираются с кодом, имя с хешем — не застревают в кэше), выбор языка запоминается |
| `title.ts` | Заголовок вкладки + canonical/og:url/og:title |
| `preload.ts` | Предзагрузка публичных страниц через 2 с (не на 2G/saveData) |
| `reveal.ts` | Директива `reveal`: fade+rise при прокрутке, один раз |
| `notify.ts` | `notify(type, id)` — фоновый вызов `discord-notify` |
| `image.ts` | Сжатие картинок в WebP (ливреи, логотипы) |
| `catalog.ts` | Машины / двигатели / коробки CarX DRO2 (реальные, со скриншотов) |
| `data/standings.ts` | Сезоны (`publicSeasons`, `currentSeason`), зачёт (`loadStandings`) с кэшем на минуту; `clearStandingsCache` |
| `data/skills.ts` | Оценки пилота для «паутинки» |
| `scoring/scoring.ts` | Чистые функции подсчёта (квала, сетка, дуэли, места, очки, ачивки, сезон) + тесты |
| `pages/` | Публичные страницы (см. [pages.md](pages.md)) |
| `admin/` | Админка и пульт судьи (см. [admin.md](admin.md)) |
| `overlay/` | Плашки OBS и пульт трансляции (см. [overlay.md](overlay.md)) |
| `components/` | Общие компоненты (ниже) |

## Компоненты
`loader` (машинка-«пончик»), `next-stage` (карточка ближайшего этапа + хайп), `hype` (пороги), `season-road` (дорога сезона),
`live-stage` (эфир на главной: Twitch + квала/дуэль), `stage-signup` (билет записи на этап), `my-team`, `my-protests`,
`protest-bell`, `number-picker`, `pilot-card` (FIFA-карточка, 5 уровней + чемпион), `pilot-showcase` (паутинка + карточка),
`radar` (паутинка), `achievement-shelf`, `bracket-tree` (дерево сетки), `content-rules` (предупреждение о контенте),
`scroll-rail` (своя полоса прокрутки), `theme-picker`, `shark-scene` (Three.js-акулы).

## Паттерны
- **Загрузка без мелькания:** страница держит `ready = signal(false)`; пока false — `<app-loader />`, потом контент целиком
  (класс `page-in`). Внутри — `loading` + `<app-loader [inline]="true" />`. Лоадер появляется через 200 мс.
  `ready` ставить в `finally`, чтобы при ошибке не висел вечный лоадер. Главная ждёт этап + счётчик + дорогу + лидеров.
- **Нагрузка (Supabase Free: 200 подключений, 100 сообщений/с, 5 ГБ трафика/мес):** Realtime только у зрителей эфира; блок эфира (`live-stage`) применяет изменения `qual_runs`/`battles` прямо из сообщения (без перекачки; `total` считает сам — генерируемый столбец), группы берут его данные (`[data]`); прогнозы — опрос итогов текущей цели раз в 4 с (`prediction_counts` с фильтром по результату RPC), без рассылки каждого голоса. Потолок ~200 зрителей эфира.
- **Данные:** прямые запросы `supabase.from(...)` в компонентах; Realtime-каналы снимаются в `DestroyRef.onDestroy`.
- **RLS молчит:** update без прав не даёт ошибку, а меняет 0 строк — после сохранения проверять `.select('id')` и длину.
- **Ошибки сети:** `retryFetch` повторяет только чтение; запись/вход не повторяются (одноразовый токен).
- **Анимации:** CSS + `animate.enter`; всегда `@media (prefers-reduced-motion: reduce)`. Тяжёлое (WebGL) — пауза вне экрана.
- **Анимация custom properties:** `@property --x { syntax… }` в стилях компонента работает (билеты этапов).
- **Ссылки-карточки:** глобальный стиль `a` (бирюзовый цвет + линия-подчёркивание снизу) надо гасить: `color: var(--ink); background: none` и на `:hover`.
- **Переход с анимацией:** не `routerLink` (он навигирует сразу), а `[attr.href]` + `(click)`: модификаторы/средняя кнопка — как обычная ссылка, иначе `preventDefault` → анимация → `router.navigate`.
- **Скрыть элемент, лежащий в зоне свечения:** не только `opacity: 0`, но и `visibility: hidden` (иначе след в `filter: drop-shadow`).
- **Тексты:** всё пользовательское — через ключи Transloco в обоих файлах. Админка — по-русски в коде.
- **Комментарии в коде** — по-русски, «почему», а не «что».

## Стили
- Токены из `DESIGN.md` («Tiffany Noir») в `src/styles.scss`: `--primary`, `--ink*`, `--surface-1..3`, `--hairline(-strong)`,
  `--accent-rgb`, `--r-*`, `--base`/`--fast`, `--ease-*`, `--font` (Inter), `--mono` (JetBrains Mono). Russo One — для «агрессивных» надписей.
- Темы меняют токены через `html[data-theme=…]`; компоненты берут цвета только из токенов.
- Бюджет стилей компонента 24 КБ (overlay.scss уже превышает — предупреждение, не ошибка).
