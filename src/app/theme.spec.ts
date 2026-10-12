import { rankOf, THEMES, unlocked } from './theme';

describe('стили сайта по уровню карточки', () => {
  const open = (tier: Parameters<typeof rankOf>[0]) => THEMES.filter((t) => unlocked(t.tier, rankOf(tier))).map((t) => t.id);

  it('без рейтинга (и гостю) — только NOIR', () => {
    expect(open(null)).toEqual(['noir']);
  });
  it('ELITE — всё, кроме LEGEND', () => {
    expect(open('elite')).toEqual(['noir', 'bronze', 'silver', 'gold', 'elite']);
  });
  it('LEGEND — все стили', () => {
    expect(open('legend')).toEqual(THEMES.map((t) => t.id));
  });
  it('BRONZE — NOIR и BRONZE', () => {
    expect(open('bronze')).toEqual(['noir', 'bronze']);
  });
});
