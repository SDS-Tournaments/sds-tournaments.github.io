import { currentDuel } from './state';

const b = (id: number, round: string, slot: number, status = 'pending', leader_id: string | null = 'a', chaser_id: string | null = 'b') => ({ id, round, slot, status, leader_id, chaser_id });

describe('currentDuel', () => {
  it('первая нерешённая по раундам и слотам', () => {
    expect(currentDuel([b(3, 'qf', 0), b(2, 'r16', 1), b(1, 'r16', 0, 'done')])?.id).toBe(2);
  });
  it('отложенная пара — после остальных своего раунда, но до следующего раунда', () => {
    const late = { ...b(1, 'r16', 0), deferred_at: '2026-12-05T18:00:00Z' };
    expect(currentDuel([late, b(2, 'r16', 1), b(3, 'qf', 0)])?.id).toBe(2);
    expect(currentDuel([late, b(2, 'r16', 1, 'done'), b(3, 'qf', 0)])?.id).toBe(1);
  });
  it('пропускает пару без соперника, всё решено — null', () => {
    expect(currentDuel([b(1, 'r16', 0, 'pending', 'a', null), b(2, 'r16', 1)])?.id).toBe(2);
    expect(currentDuel([b(1, 'final', 0, 'done')])).toBeNull();
  });
});
