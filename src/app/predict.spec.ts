import { describe, expect, it } from 'vitest';
import { countsFor, pickOfScore, runTarget } from './predict';

describe('pickOfScore', () => {
  it('раскладывает оценку по вариантам', () => {
    expect(pickOfScore(79.5)).toBe('lt80');
    expect(pickOfScore(80)).toBe('80');
    expect(pickOfScore(84.5)).toBe('80');
    expect(pickOfScore(85)).toBe('85');
    expect(pickOfScore(94.5)).toBe('90');
    expect(pickOfScore(95)).toBe('95');
    expect(pickOfScore(100)).toBe('100');
  });
  it('нулевая попытка — «<80»', () => expect(pickOfScore(0, true)).toBe('lt80'));
});

describe('runTarget', () => {
  const regs = [
    { profile_id: 'b', queue_order: 2 },
    { profile_id: 'a', queue_order: 1 },
  ];
  it('прогрев — голосуем за 1-ю попытку первого в очереди', () => {
    expect(runTarget(regs, [])).toEqual({ profileId: 'a', attempt: 1 });
    expect(runTarget(regs, [{ profile_id: 'a', attempt: 0 }])).toEqual({ profileId: 'a', attempt: 1 });
  });
  it('после 1-й — за 2-ю, после всех трёх — следующий пилот', () => {
    const r = [0, 1].map((attempt) => ({ profile_id: 'a', attempt }));
    expect(runTarget(regs, r)).toEqual({ profileId: 'a', attempt: 2 });
    expect(runTarget(regs, [...r, { profile_id: 'a', attempt: 2 }])).toEqual({ profileId: 'b', attempt: 1 });
  });
  it('без прогрева — после двух зачётных следующий пилот', () => {
    const r = [1, 2].map((attempt) => ({ profile_id: 'a', attempt }));
    expect(runTarget(regs, r)).toEqual({ profileId: 'b', attempt: 1 });
  });
  it('все проехали — голосования нет', () => {
    const all = ['a', 'b'].flatMap((p) => [0, 1, 2].map((attempt) => ({ profile_id: p, attempt })));
    expect(runTarget(regs, all)).toBeNull();
  });
});

describe('countsFor', () => {
  const rows = [
    { profile_id: 'a', attempt: 1, battle_id: null, pick: '90', n: 3 },
    { profile_id: 'a', attempt: 2, battle_id: null, pick: '90', n: 5 },
    { profile_id: null, attempt: null, battle_id: 7, pick: 'leader', n: 4 },
  ];
  it('берёт только свой заезд или дуэль', () => {
    expect(countsFor(rows, { profileId: 'a', attempt: 1 }).get('90')).toBe(3);
    expect(countsFor(rows, { battleId: 7 }).get('leader')).toBe(4);
    expect(countsFor(rows, { battleId: 8 }).size).toBe(0);
  });
});
