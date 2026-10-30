import { CARD_A, CARD_B, makeBolt, UNDER } from './lightning';

describe('makeBolt', () => {
  it('канал начинается под краем карточки, отростки растут после канала', () => {
    for (let i = 0; i < 20; i++) {
      const b = makeBolt(i);
      const main = b.paths.find((p) => p.lv === 0)!;
      const [x, y] = main.d.slice(1).split(' L')[0].split(' ').map(Number);
      const inside = [x, y].every((v) => v >= CARD_A && v <= CARD_B);
      const nearEdge = [x, y].some((v) => Math.abs(v - (CARD_A + UNDER)) < 0.01 || Math.abs(v - (CARD_B - UNDER)) < 0.01);
      expect(inside && nearEdge).toBe(true);
      expect(main.dl).toBe(0);
      expect(b.paths.filter((p) => p.lv > 0).every((p) => p.dl > 0 && p.w < main.w)).toBe(true);
    }
  });

  it('слабый удар — меньше отростков, тоньше и короче живёт, чем сильный', () => {
    const avg = (power: number) => {
      let n = 0;
      for (let i = 0; i < 30; i++) n += makeBolt(i, power).paths.length;
      return n / 30;
    };
    expect(avg(0.35)).toBeLessThan(avg(1));
    expect(makeBolt(1, 0.35).paths[0].w).toBeLessThan(makeBolt(1, 1).paths[0].w);
    expect(makeBolt(1, 0.35).dur).toBeLessThan(makeBolt(1, 1).dur);
  });
});
