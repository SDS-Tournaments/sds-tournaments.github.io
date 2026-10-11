import { tierOf } from './pilot-card';

describe('уровень FIFA-карточки', () => {
  it('границы: <75 бронза, 75–82 серебро, 83–89 золото, 90–94 элита, 95+ легенда', () => {
    expect([null, 0, 74, 75, 82, 83, 89, 90, 94, 95, 100].map(tierOf)).toEqual([
      'bronze', 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'elite', 'elite', 'legend', 'legend',
    ]);
  });
});
