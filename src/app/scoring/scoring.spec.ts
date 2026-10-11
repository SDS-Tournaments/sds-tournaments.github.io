import {
  battleOutcome,
  bracketSize,
  Finish,
  firstRound,
  nextSlot,
  orderPair,
  qualStandings,
  seasonStandings,
  seedOrder,
  stagePlaces,
  stagePoints,
  teamSeason,
  teamStage,
} from './scoring';

const runs = (...totals: number[]) => totals.map((total, attempt) => ({ attempt, total }));

describe('квалификация', () => {
  it('прогрев не идёт в зачёт, берётся лучшая из двух', () => {
    const [r] = qualStandings([{ id: 'a', queueOrder: 1, runs: runs(99, 60, 75) }]);
    expect(r).toEqual({ id: 'a', place: 1, best: 75, worst: 60 });
  });

  it('ничья: выше худшая попытка, затем порядок в очереди', () => {
    const rows = qualStandings([
      { id: 'late', queueOrder: 3, runs: runs(0, 80, 70) },
      { id: 'weak2nd', queueOrder: 1, runs: runs(0, 80, 50) },
      { id: 'early', queueOrder: 2, runs: runs(0, 70, 80) },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['early', 'late', 'weak2nd']);
  });

  it('без зачётных попыток пилот не классифицирован', () => {
    expect(qualStandings([{ id: 'a', queueOrder: 1, runs: runs(50) }])).toEqual([]);
  });
});

describe('сетка', () => {
  it('размер по числу пилотов и ручная настройка', () => {
    expect([bracketSize(40), bracketSize(17), bracketSize(16), bracketSize(9), bracketSize(8), bracketSize(3)]).toEqual([32, 32, 16, 16, 8, 8]);
    expect(bracketSize(40, '16')).toBe(16);
  });

  it('классический посев', () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const s32 = seedOrder(32);
    expect(s32.slice(0, 4)).toEqual([1, 32, 16, 17]);
    expect(new Set(s32).size).toBe(32);
    // 1 и 2 в разных половинах
    expect(s32.indexOf(1) < 16).not.toBe(s32.indexOf(2) < 16);
  });

  it('при нехватке пилотов лидеры квалификации проходят по баю', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `p${i + 1}`);
    const pairs = firstRound(ids, 32);
    expect(pairs).toHaveLength(16);
    expect(pairs[0]).toEqual({ round: 'r32', slot: 0, leader: 'p1', chaser: null });
    const byes = pairs.filter((p) => p.chaser === null).map((p) => p.leader);
    expect(byes.sort()).toEqual(['p1', 'p10', 'p11', 'p12', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'].sort());
    expect(pairs.find((p) => p.leader === 'p16')?.chaser).toBe('p17');
  });

  it('победитель идёт в следующий раунд, лидер — лучший по квалификации', () => {
    expect(nextSlot('r32', 5)).toEqual({ round: 'r16', slot: 2 });
    expect(nextSlot('sf', 1)).toEqual({ round: 'final', slot: 0 });
    expect(nextSlot('final', 0)).toBeNull();
    expect(orderPair('b', 'a', new Map([['a', 3], ['b', 7]]))).toEqual(['a', 'b']);
  });
});

describe('дуэль', () => {
  it('2 из 3 голосов — победа', () => {
    expect(battleOutcome(['leader', 'chaser', 'leader'], 0)).toBe('leader');
    expect(battleOutcome(['chaser', 'chaser', 'omt'], 1)).toBe('chaser');
  });

  it('нет большинства — OMT, после второго OMT — лидер по квалификации', () => {
    expect(battleOutcome(['leader', 'chaser', 'omt'], 0)).toBe('omt');
    expect(battleOutcome(['omt', 'omt', 'leader'], 1)).toBe('omt');
    expect(battleOutcome(['omt', 'leader', 'chaser'], 2)).toBe('tiebreak');
  });

  it('пока не все судьи проголосовали — нет решения', () => {
    expect(battleOutcome(['leader', 'leader'], 0)).toBeNull();
  });
});

describe('места и очки этапа', () => {
  const qual = qualStandings(
    Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, queueOrder: i, runs: runs(0, 100 - i) })),
  );
  const finishes = new Map<string, Finish>([
    ['p3', 'win'],
    ['p1', 'final'],
    ['p2', 'third-win'],
    ['p5', 'third-loss'],
    ['p8', 'qf'],
    ['p4', 'qf'],
    ['p6', 'qf'],
    ['p7', 'qf'],
  ]);

  it('сначала сетка по стадии вылета, внутри — по квалификации, затем остальные', () => {
    const rows = stagePlaces(qual, finishes);
    expect(rows.map((r) => r.id)).toEqual(['p3', 'p1', 'p2', 'p5', 'p4', 'p6', 'p7', 'p8', 'p9', 'p10']);
  });

  it('DQ не классифицируется', () => {
    expect(stagePlaces(qual, finishes, new Set(['p3'])).map((r) => r.id)[0]).toBe('p1');
  });

  it('очки по таблицам RDS GP 2024', () => {
    expect(stagePoints(3, 'win')).toEqual({ qual: 17, battle: 250, total: 267 });
    expect(stagePoints(1, 'final').total).toBe(22 + 180);
    expect(stagePoints(12, 'qf').total).toBe(7 + 70);
    expect(stagePoints(20, 'r16').total).toBe(2 + 30);
    expect(stagePoints(25, 'r32').total).toBe(2);
    expect(stagePoints(40, null).total).toBe(1);
  });
});

describe('командный зачёт этапа', () => {
  it('сумма трёх лучших, ничья — у кого пилот выше', () => {
    const rows = teamStage([
      { teamId: 'A', total: 100, stagePlace: 3 },
      { teamId: 'A', total: 50, stagePlace: 6 },
      { teamId: 'A', total: 40, stagePlace: 7 },
      { teamId: 'A', total: 30, stagePlace: 8 }, // 4-й не считается
      { teamId: 'B', total: 190, stagePlace: 2 },
      { teamId: null, total: 300, stagePlace: 1 },
    ]);
    expect(rows).toEqual([
      { teamId: 'B', points: 190, bestPlace: 2, place: 1 },
      { teamId: 'A', points: 190, bestPlace: 3, place: 2 },
    ]);
  });
});

describe('сезон', () => {
  const r = (id: string, total: number, stagePlace: number, qualPlace = 5) => ({ id, total, stagePlace, qualPlace });

  it('сумма очков за этапы', () => {
    const rows = seasonStandings([[r('a', 100, 2), r('b', 50, 3)], [r('b', 200, 1)]]);
    expect(rows).toEqual([
      { id: 'b', points: 250, place: 1 },
      { id: 'a', points: 100, place: 2 },
    ]);
  });

  it('ничья → больше высоких мест', () => {
    const rows = seasonStandings([[r('a', 100, 1), r('b', 100, 2)], [r('a', 50, 5), r('b', 50, 3)]]);
    expect(rows.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('ничья по местам → больше побед в квалификации → выше на последнем этапе', () => {
    const byQual = seasonStandings([[r('a', 100, 2, 4), r('b', 100, 2, 1)]]);
    expect(byQual.map((x) => x.id)).toEqual(['b', 'a']);
    const byLast = seasonStandings([[r('a', 100, 2), r('b', 100, 3)], [r('b', 100, 2), r('a', 100, 3)]]);
    expect(byLast.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('командный зачёт: сумма, ничья — у кого лучший пилот выше', () => {
    const rows = teamSeason(
      [[{ teamId: 'A', points: 100, bestPlace: 1, place: 1 }, { teamId: 'B', points: 100, bestPlace: 2, place: 2 }]],
      new Map([['A', ['a1']], ['B', ['b1']]]),
      [{ id: 'b1', points: 300, place: 1 }, { id: 'a1', points: 200, place: 2 }],
    );
    expect(rows.map((x) => x.id)).toEqual(['B', 'A']);
  });
});
