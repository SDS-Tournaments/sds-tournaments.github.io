// Состояние плашек трансляции — хранится в overlay_state.state (одна строка, Realtime)

export const WIDGETS = ['stage', 'onTrack', 'score', 'qualTable', 'duel', 'bracket', 'podium', 'sponsors', 'protest'] as const;
export type Widget = (typeof WIDGETS)[number];

export interface OverlayState {
  lang: 'ru' | 'en';
  stageId: number | null;
  visible: Partial<Record<Widget, boolean>>;
  /** оценка заезда сама появляется на 10 с после каждой новой оценки */
  autoScore: boolean;
}

export const DEFAULT_STATE: OverlayState = { lang: 'ru', stageId: null, visible: {}, autoScore: true };

export const WIDGET_LABEL: Record<Widget, string> = {
  stage: 'Стадия этапа (угол)',
  onTrack: 'На трассе',
  score: 'Оценка заезда',
  qualTable: 'Таблица квалификации',
  duel: 'Дуэль',
  bracket: 'Сетка (весь экран)',
  podium: 'Подиум (весь экран)',
  sponsors: 'Спонсоры',
  protest: 'Протест на рассмотрении',
};

/** Тексты на самих плашках — язык выбирается в пульте, независимо от сайта */
export const OVERLAY_TEXT = {
  ru: {
    stage: 'Этап',
    qualifying: 'Квалификация',
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
    leader: 'Лидер',
    chaser: 'Чейзер',
    win: 'Победа',
    qual: 'Квалификация',
    protest: 'Протест на рассмотрении',
    protestSub: 'Организатор изучает видео',
    podium: 'Подиум этапа',
    partners: 'Партнёры',
    r32: 'Top 32', r16: 'Top 16', qf: 'Top 8', sf: 'Полуфинал', third: 'За 3-е место', final: 'Финал',
  },
  en: {
    stage: 'Round',
    qualifying: 'Qualifying',
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
    leader: 'Leader',
    chaser: 'Chaser',
    win: 'Winner',
    qual: 'Qualifying',
    protest: 'Protest under review',
    protestSub: 'The organizer is reviewing the footage',
    podium: 'Round podium',
    partners: 'Partners',
    r32: 'Top 32', r16: 'Top 16', qf: 'Top 8', sf: 'Semi-final', third: '3rd place', final: 'Final',
  },
};
export type OverlayText = (typeof OVERLAY_TEXT)['ru'];
