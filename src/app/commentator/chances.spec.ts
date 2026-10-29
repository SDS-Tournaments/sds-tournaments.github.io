import { duelChances, DuelSide, qualChances, qualTargets } from './chances';

const codes = (c: { code: string }[]) => c.map((x) => x.code);

describe('qualChances', () => {
  it('1-я попытка: сотня и лидерство', () => {
    const c = qualChances({ attempt: 1, runs: [], leaderBest: 92.5, debut: true });
    expect(codes(c)).toEqual(['debut', 'perfect_100', 'qual_king']);
    expect(c[2].when).toContain('92,5');
  });
  it('2-я после оценки — «Снайпер» в пределах 0,5', () => {
    const c = qualChances({ attempt: 2, runs: [{ attempt: 1, total: 88, spin: false, fail: null }], leaderBest: null, debut: false });
    expect(c.find((x) => x.code === 'sniper')?.when).toBe('Попытка 2 от 87,5 до 88,5');
  });
  it('2-я после вылета — та же антиачивка', () => {
    const c = qualChances({ attempt: 2, runs: [{ attempt: 1, total: 0, spin: true, fail: 'offtrack' }], leaderBest: 90, debut: false });
    expect(c.find((x) => x.code === 'offtrack2')?.warn).toBe(true);
  });
  it('уже сотня — «без сдачи» не предлагаем; обе проехал — только дебют', () => {
    expect(codes(qualChances({ attempt: 2, runs: [{ attempt: 1, total: 100, spin: false, fail: null }], leaderBest: 99, debut: false }))).not.toContain('perfect_100');
    expect(qualChances({ attempt: null, runs: [], leaderBest: 99, debut: false })).toEqual([]);
  });
});

describe('qualTargets', () => {
  const st = [{ id: 'a', best: 95 }, { id: 'b', best: 90 }, { id: 'c', best: 80 }];
  it('лидер и порог без самого пилота', () => {
    expect(qualTargets(st, 'a', 2)).toEqual({ leader: 90, cutLine: 80 });
    expect(qualTargets(st, 'z', 4)).toEqual({ leader: 95, cutLine: null });
  });
});

describe('duelChances', () => {
  const s = (id: string, qualPlace: number, extra: Partial<DuelSide> = {}): DuelSide => ({ id, qualPlace, wins: 0, winsClean: true, omtSoFar: 0, lastSeed: false, everWon: true, ...extra });
  it('Давид и Голиаф, 322, последний вагон', () => {
    const r = duelChances({ round: 'r32', omt: 0, leader: s('a', 1), chaser: s('b', 32, { lastSeed: true }), prevWinners: [], prevDuels: [] });
    expect(codes(r.chaser)).toEqual(['giant_slayer', 'last_wagon']);
    expect(codes(r.leader)).toEqual(['throw_322']);
  });
  it('реванш и цареубийство', () => {
    const r = duelChances({ round: 'qf', omt: 0, leader: s('a', 3), chaser: s('b', 5), prevWinners: ['a'], prevDuels: [{ winner: 'a', loser: 'b' }] });
    expect(codes(r.chaser)).toEqual(['regicide', 'revenge']);
  });
  it('финал: первая победа, «все ещё достоин», чистая победа', () => {
    const r = duelChances({ round: 'final', omt: 0, leader: s('a', 1), chaser: s('b', 12, { everWon: false, winsClean: false }), prevWinners: ['a'], prevDuels: [] });
    expect(codes(r.leader)).toEqual(['win', 'back_to_back', 'flawless']);
    expect(codes(r.chaser)).toEqual(['giant_slayer', 'regicide', 'win', 'first_win']);
  });
  it('за 3-е: подиум, андердог и деревянная медаль', () => {
    const r = duelChances({ round: 'third', omt: 2, leader: s('a', 2, { omtSoFar: 1 }), chaser: s('b', 10), prevWinners: [], prevDuels: [] });
    expect(codes(r.chaser)).toEqual(['giant_slayer', 'omt2', 'marathon', 'podium', 'underdog', 'wooden']);
    expect(codes(r.leader)).toEqual(['omt2', 'marathon', 'podium', 'wooden']);
  });
});
