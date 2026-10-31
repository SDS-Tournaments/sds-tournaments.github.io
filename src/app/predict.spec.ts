import { describe, expect, it } from 'vitest';
import { countsFor } from './predict';
describe('countsFor', () => {
  const rows = [
    { profile_id: 'a', attempt: 1, battle_id: null, pick: '90', n: 3 },
    { profile_id: null, attempt: null, battle_id: 7, pick: 'leader', n: 4 },
    { profile_id: null, attempt: null, battle_id: 7, pick: 'chaser', n: 2 },
  ];
  it('берёт только свою дуэль (старые голоса за заезды квалификации не считаются)', () => {
    expect(countsFor(rows, 7).get('leader')).toBe(4);
    expect(countsFor(rows, 7).get('chaser')).toBe(2);
    expect(countsFor(rows, 7).has('90')).toBe(false);
    expect(countsFor(rows, 8).size).toBe(0);
  });
});
