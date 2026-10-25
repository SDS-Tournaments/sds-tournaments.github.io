// Состояние плашек трансляции — хранится в overlay_state.state (одна строка, Realtime)

export const WIDGETS = ['stage', 'onTrack', 'score', 'qualTable', 'duel', 'matchup', 'bracket', 'podium', 'sponsors', 'protest', 'poll'] as const;
export type Widget = (typeof WIDGETS)[number];

export interface OverlayState {
  /** auto — плашки сами меняют язык RU ⇄ EN каждые LANG_SWAP_MS */
  lang: 'ru' | 'en' | 'auto';
  stageId: number | null;
  visible: Partial<Record<Widget, boolean>>;
  /** оценка заезда сама появляется на 10 с после каждой новой оценки */
  autoScore: boolean;
  /** «Тестовые данные»: превью и OBS показывают вымышленный этап (mock.ts) вместо настоящего */
  mock?: boolean;
  /** стиль плашек (overlay.scss: .screen[data-skin=…]) */
  skin?: Skin;
}

export const SKINS = ['classic', 'arena', 'race', 'hud'] as const;
export type Skin = (typeof SKINS)[number];
export const SKIN_LABEL: Record<Skin, string> = { classic: 'Классика', arena: 'Арена', race: 'Гонка', hud: 'HUD' };

export const LANG_SWAP_MS = 8000;
/** полноэкранные плашки (сетка, подиум, представление пары) меняют язык чаще */
export const LANG_SWAP_FULL_MS = 4000;

export const DEFAULT_STATE: OverlayState = { lang: 'ru', stageId: null, visible: {}, autoScore: true, skin: 'hud' };

export const WIDGET_LABEL: Record<Widget, string> = {
  stage: 'Стадия этапа (угол)',
  onTrack: 'На трассе',
  score: 'Оценка заезда',
  qualTable: 'Таблица квалификации',
  duel: 'Дуэль',
  matchup: 'Карточки дуэли (сравнение)',
  bracket: 'Сетка (весь экран)',
  podium: 'Подиум (весь экран)',
  sponsors: 'Спонсоры',
  protest: 'Протест на рассмотрении',
  poll: 'Прогноз зрителей',
};

/** Тексты на самих плашках — язык выбирается в пульте, независимо от сайта */
export const OVERLAY_TEXT = {
  ru: {
    stage: 'Этап',
    qualifying: 'Квалификация',
    qual_done: 'Квалификация завершена',
    battles: 'Парные заезды',
    registration: 'Регистрация',
    finished: 'Итоги',
    draft: 'Скоро',
    warmup: 'Прогрев',
    run: 'Попытка',
    group: 'Группа',
    angle: 'Угол',
    style: 'Стиль',
    line: 'Траектория',
    total: 'Итог',
    spin: 'СПИН',
    fail: { spin: 'СПИН', crash: 'АВАРИЯ', straight: 'ВЫПРЯМЛЕНИЕ', offtrack: 'ВЫЛЕТ' },
    leader: 'Лидер',
    chaser: 'Чейзер',
    win: 'Победа',
    qual: 'Квалификация',
    noScores: 'Оценок пока нет',
    noScoresHint: 'Таблица оживёт после первого заезда',
    protest: 'Протест на рассмотрении',
    protestSub: 'Организатор изучает видео',
    pollTitle: 'Прогноз зрителей',
    pollBattle: 'Кто победит?',
    pollVotes: 'Голосов',
    pollGuessed: 'Угадали',
    pollHint: 'Голосуйте на сайте',
    podium: 'Подиум этапа',
    partners: 'Партнёры',
    pair: 'Пара',
    ovr: 'Рейтинг',
    wins: 'Победы на этапах',
    qualPlace: 'Место в квалификации',
    newLeader: 'Новый лидер',
    achievement: 'Достижение',
    bestRun: 'Лучший заезд',
    r32: 'Top 32', r16: 'Top 16', qf: 'Top 8', sf: 'Полуфинал', third: 'За 3-е место', final: 'Финал',
  },
  en: {
    stage: 'Round',
    qualifying: 'Qualifying',
    qual_done: 'Qualifying done',
    battles: 'Battles',
    registration: 'Registration',
    finished: 'Results',
    draft: 'Soon',
    warmup: 'Warm-up',
    run: 'Run',
    group: 'Group',
    angle: 'Angle',
    style: 'Style',
    line: 'Line',
    total: 'Total',
    spin: 'SPIN',
    fail: { spin: 'SPIN', crash: 'CRASH', straight: 'STRAIGHTENED', offtrack: 'OFF TRACK' },
    leader: 'Leader',
    chaser: 'Chaser',
    win: 'Winner',
    qual: 'Qualifying',
    noScores: 'No scores yet',
    noScoresHint: 'The table comes alive after the first run',
    protest: 'Protest under review',
    protestSub: 'The organizer is reviewing the footage',
    pollTitle: 'Viewers predict',
    pollBattle: 'Who wins?',
    pollVotes: 'Votes',
    pollGuessed: 'Guessed',
    pollHint: 'Vote on the website',
    podium: 'Round podium',
    partners: 'Partners',
    pair: 'Pair',
    ovr: 'Rating',
    wins: 'Round wins',
    qualPlace: 'Qualifying place',
    newLeader: 'New leader',
    achievement: 'Achievement',
    bestRun: 'Best run',
    r32: 'Top 32', r16: 'Top 16', qf: 'Top 8', sf: 'Semi-final', third: '3rd place', final: 'Final',
  },
};
export type OverlayText = (typeof OVERLAY_TEXT)['ru'];
