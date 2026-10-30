import { CARD_A, CARD_B, makeBolt } from './lightning';

describe('makeBolt', () => {
  it('канал начинается на краю карточки и уходит наружу, есть отростки', () => {
    for (let i = 0; i < 20; i++) {
      const b = makeBolt(i);
      const main = b.paths.find((p) => p.lv === 0)!;
      const [x, y] = main.d.slice(1).split(' L')[0].split(' ').map(Number);
      const onEdge = [x, y].some((v) => Math.abs(v - CARD_A) < 0.01 || Math.abs(v - CARD_B) < 0.01);
      expect(onEdge).toBe(true);
      expect(b.paths.filter((p) => p.lv === 1).length).toBeGreaterThanOrEqual(7);
      expect(b.paths.some((p) => p.lv === 2)).toBe(true);
    }
  });
});
