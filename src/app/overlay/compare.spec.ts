import { compareRow } from './compare';

describe('сравнение пилотов в карточках дуэли', () => {
  it('больше — лучше: полоска лидера 100, другая пропорционально', () => {
    expect(compareRow('ovr', 90, 72)).toEqual({ key: 'ovr', a: 90, b: 72, wa: 100, wb: 80, better: 'a' });
  });

  it('для места меньше — лучше: 1-е место против 4-го', () => {
    const r = compareRow('qual', 4, 1, true);
    expect(r.better).toBe('b');
    expect([r.wa, r.wb]).toEqual([25, 100]);
  });

  it('равенство и нет данных — без победителя', () => {
    expect(compareRow('x', 5, 5).better).toBeNull();
    expect(compareRow('x', null, 3)).toMatchObject({ wa: 0, wb: 100, better: null });
  });
});
