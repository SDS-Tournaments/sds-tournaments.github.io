import { hype } from './hype';

describe('уровень хайпа этапа', () => {
  it('до 5 пилотов — уровень 0, считаем до пятого', () => {
    expect(hype(0)).toEqual({ level: 0, max: 7, toNext: 5, progress: 0 });
    expect(hype(3)).toEqual({ level: 0, max: 7, toNext: 2, progress: 0.6 });
  });
  it('пороги 5, 10, 15, 20, 30, 40, 50', () => {
    expect([4, 5, 9, 10, 15, 20, 29, 30, 40, 49].map((n) => hype(n).level)).toEqual([0, 1, 1, 2, 3, 4, 4, 5, 6, 6]);
    expect(hype(25)).toMatchObject({ level: 4, toNext: 5, progress: 0.5 });
  });
  it('50 и больше — максимальный уровень', () => {
    expect(hype(50)).toEqual({ level: 7, max: 7, toNext: null, progress: 1 });
    expect(hype(80).level).toBe(7);
  });
});
