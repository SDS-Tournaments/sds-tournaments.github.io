import { roadProgress } from './season-road';

const D = 86_400_000;
const T0 = Date.parse('2026-11-01T18:00:00Z');
const iso = (t: number) => new Date(t).toISOString();
const st = (status: string, at: number | null) => ({ status, starts_at: at === null ? null : iso(at) });

describe('огонёк дороги сезона', () => {
  // 3 этапа: первый пройден 1 ноября, второй 11 ноября, третий без даты → 2 участка по 50%
  const season = (s2 = 'registration') => [st('finished', T0), st(s2, T0 + 10 * D), st('draft', null)];

  it('сразу после этапа — у пройденного, холодный', () => {
    expect(roadProgress(season(), T0)).toEqual({ fill: 0, heat: 0 });
  });

  it('на полпути по времени — посередине между этапами, наполовину красный', () => {
    expect(roadProgress(season(), T0 + 5 * D)).toEqual({ fill: 25, heat: 0.5 });
  });

  it('в день старта — на этапе и максимально красный', () => {
    expect(roadProgress(season(), T0 + 10 * D)).toEqual({ fill: 50, heat: 1 });
  });

  it('этап идёт — на этапе, жар максимальный', () => {
    expect(roadProgress(season('battles'), T0 + 1 * D)).toEqual({ fill: 50, heat: 1 });
  });

  it('у следующего этапа нет даты — стоим у пройденного', () => {
    expect(roadProgress([st('finished', T0), st('draft', null)], T0 + 3 * D)).toEqual({ fill: 0, heat: 0 });
  });

  it('первый этап сезона — краснеем за 2 недели до старта', () => {
    const r = roadProgress([st('registration', T0 + 7 * D), st('draft', null)], T0);
    expect(r.fill).toBe(0);
    expect(r.heat).toBeCloseTo(0.5);
  });

  it('все этапы пройдены — линия до конца', () => {
    expect(roadProgress([st('finished', T0), st('finished', T0 + D)], T0 + 2 * D)).toEqual({ fill: 100, heat: 0 });
  });
});
