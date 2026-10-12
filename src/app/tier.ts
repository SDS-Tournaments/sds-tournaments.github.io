// Уровень карточки пилота — отдельно от компонента карточки, чтобы темы сайта не тянули её (и html-to-image) в стартовый бандл
export type Tier = 'bronze' | 'silver' | 'gold' | 'elite' | 'legend';

/** Уровень карточки по рейтингу: <75 бронза, 75–82 серебро, 83–89 золото, 90–94 элита, 95+ легенда */
export function tierOf(overall: number | null): Tier {
  const o = overall ?? 0;
  return o >= 95 ? 'legend' : o >= 90 ? 'elite' : o >= 83 ? 'gold' : o >= 75 ? 'silver' : 'bronze';
}
