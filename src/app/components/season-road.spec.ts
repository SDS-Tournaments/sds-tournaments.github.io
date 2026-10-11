import { roadProgress } from './season-road';

const D = 86_400_000;
const T0 = Date.parse('2026-11-01T18:00:00Z');
const iso = (t: number) => new Date(t).toISOString();
const st = (status: string, at: number | null) => ({ status, starts_at: at === null ? null : iso(at) });

describe('огонёк дороги сезона', () => {
  // 3 этапа: первый пройден 1 ноября, второй через 30 дней, третий без даты → 2 участка по 50% линии
  const season = (s2 = 'registration') => [st('finished', T0), st(s2, T0 + 30 * D), st('draft', null)];

  it('сразу после этапа — уже на 20% участка, холодный', () => {
    expect(roadProgress(season(), T0)).toEqual({ fill: 10, heat: 0 });
  });

  it('на полпути по времени — на 60% участка (20% + половина остатка), жар 0.5', () => {
    const r = roadProgress(season(), T0 + 15 * D);
    expect(r.fill).toBeCloseTo(30);
    expect(r.heat).toBeCloseTo(0.5);
  });

  it('в день старта — на этапе и максимально красный', () => {
    expect(roadProgress(season(), T0 + 30 * D)).toEqual({ fill: 50, heat: 1 });
  });

  it('этап идёт — на этапе, жар максимальный', () => {
    expect(roadProgress(season('battles'), T0 + 1 * D)).toEqual({ fill: 50, heat: 1 });
  });

  it('у следующего этапа нет даты — на 20% участка, холодный', () => {
    expect(roadProgress([st('finished', T0), st('draft', null)], T0 + 3 * D)).toEqual({ fill: 20, heat: 0 });
  });

  it('у пройденного этапа нет даты — отсчёт за 30 дней до старта', () => {
    // до этапа 2 осталось 2 дня из 30
    const r = roadProgress([st('finished', null), st('registration', T0 + 2 * D)], T0);
    expect(r.heat).toBeCloseTo(28 / 30);
    expect(r.fill).toBeCloseTo((0.2 + 0.8 * (28 / 30)) * 100);
  });

  it('первый этап сезона — на старте, краснеем за 30 дней до него', () => {
    const r = roadProgress([st('registration', T0 + 7 * D), st('draft', null)], T0);
    expect(r.fill).toBe(0);
    expect(r.heat).toBeCloseTo(23 / 30);
  });

  it('все этапы пройдены — линия до конца', () => {
    expect(roadProgress([st('finished', T0), st('finished', T0 + D)], T0 + 2 * D)).toEqual({ fill: 100, heat: 0 });
  });
});
