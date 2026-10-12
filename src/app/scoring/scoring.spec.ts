import {
  assignGroups,
  battleOutcome,
  bracketSize,
  buildBracket,
  Finish,
  finishesFrom,
  firstRound,
  Round,
  stageAchievements,
  nextSlot,
  orderPair,
  qualStandings,
  roundsFor,
  seasonStandings,
  seatInto,
  skills,
  mergeSkills,
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

describe('группы', () => {
  it('по 10 пилотов, очередь сквозная', () => {
    const rows = assignGroups(Array.from({ length: 23 }, (_, i) => i));
    expect(rows.filter((r) => r.group === 1)).toHaveLength(10);
    expect(rows.filter((r) => r.group === 3)).toHaveLength(3);
    expect(rows[22]).toEqual({ item: 22, group: 3, queue: 23 });
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

  const pilots = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
  const places = (ids: string[]) => new Map(ids.map((id, i) => [id, i + 1]));

  it('Top 32 на 20 пилотов: 4 настоящие дуэли, 12 лидеров уже в Top 16', () => {
    const ids = pilots(20);
    const rows = buildBracket(ids, 32, places(ids));
    const r32 = rows.filter((r) => r.round === 'r32');
    expect(r32.filter((r) => !r.done)).toHaveLength(4);
    expect(r32.filter((r) => r.bye)).toHaveLength(12);
    const r16 = rows.filter((r) => r.round === 'r16');
    expect(r16.flatMap((r) => [r.leader, r.chaser]).filter(Boolean)).toHaveLength(12);
    // p1 ждёт победителя пары 16–17
    expect(r16[0]).toMatchObject({ leader: 'p1', chaser: null, done: false });
  });

  it('ручной Top 32 на 10 пилотов не застревает: пустые пары закрываются', () => {
    const ids = pilots(10);
    const rows = buildBracket(ids, 32, places(ids));
    expect(rows.filter((r) => r.round === 'r32').every((r) => r.done)).toBe(true);
    // Застрявших нет: каждая незакрытая неполная пара ждёт хотя бы одну ещё не решённую дуэль
    const order = ['r32', 'r16', 'qf', 'sf', 'final'] as const;
    const find = (round: string, slot: number) => rows.find((r) => r.round === round && r.slot === slot)!;
    for (const r of rows.filter((x) => !x.done && x.round !== 'third' && !(x.leader && x.chaser))) {
      const prev = order[order.indexOf(r.round as (typeof order)[number]) - 1];
      expect([find(prev, 2 * r.slot), find(prev, 2 * r.slot + 1)].some((f) => !f.done)).toBe(true);
    }
    // и настоящие дуэли есть
    expect(rows.some((r) => !r.done && r.leader && r.chaser)).toBe(true);
  });

  it('полная сетка Top 8 без баев', () => {
    const ids = pilots(8);
    const rows = buildBracket(ids, 8, places(ids));
    expect(rows.filter((r) => r.round === 'qf').map((r) => [r.leader, r.chaser])).toEqual([
      ['p1', 'p8'], ['p4', 'p5'], ['p2', 'p7'], ['p3', 'p6'],
    ]);
    expect(rows.some((r) => r.done)).toBe(false);
  });

  it('раунды по размеру сетки', () => {
    expect(roundsFor(8).map((r) => r.round)).toEqual(['qf', 'sf', 'third', 'final']);
    expect(roundsFor(32).map((r) => r.slots)).toEqual([16, 8, 4, 2, 1, 1]);
  });

  it('пилот садится в следующую пару: первый — лидером, второй — по квалификации', () => {
    const q = new Map([['a', 5], ['b', 2]]);
    const one = seatInto({ leader: null, chaser: null }, 'a', q);
    expect(one).toEqual({ leader: 'a', chaser: null });
    expect(seatInto(one, 'b', q)).toEqual({ leader: 'b', chaser: 'a' });
    // повторная постановка того же пилота ничего не ломает
    expect(seatInto({ leader: 'b', chaser: 'a' }, 'a', q)).toEqual({ leader: 'b', chaser: 'a' });
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

describe('итоги этапа', () => {
  const B = (round: Round, leader: string, chaser: string | null, winner: string, bye = false) => ({ round, leader, chaser, winner, bye });

  it('стадия вылета из решённых дуэлей, баи пропускаются', () => {
    const f = finishesFrom([
      B('qf', 'a', null, 'a', true),
      B('qf', 'b', 'c', 'b'),
      B('sf', 'a', 'b', 'a'),
      B('third', 'b', 'd', 'd'),
      B('final', 'a', 'e', 'e'),
    ]);
    expect(Object.fromEntries(f)).toEqual({ c: 'qf', d: 'third-win', b: 'third-loss', e: 'win', a: 'final' });
  });

  it('достижения: победа, первая победа, хет-трик, подиум, король квалификации, 100, два OMT', () => {
    const rows = [
      { id: 'a', stagePlace: 1, qualPlace: 3, best: 92 },
      { id: 'b', stagePlace: 2, qualPlace: 1, best: 100 },
      { id: 'c', stagePlace: 5, qualPlace: 2, best: 95 },
    ];
    const got = stageAchievements(rows, ['x', 'a', 'a'], new Set(['a']), [{ winner: 'c', loser: 'z', omt: 2 }], new Set(['a', 'b', 'c']));
    expect(got).toEqual([
      { id: 'a', code: 'win' },
      { id: 'a', code: 'back_to_back' },
      { id: 'a', code: 'hat_trick' },
      { id: 'a', code: 'podium' },
      { id: 'b', code: 'podium' },
      { id: 'b', code: 'qual_king' },
      { id: 'b', code: 'perfect_100' },
      { id: 'c', code: 'omt2' },
    ]);
    expect(stageAchievements([rows[0]], [], new Set(), [], new Set(['a'])).map((x) => x.code)).toContain('first_win');
  });

  it('достижения: король пал, Давид и Голиаф, из низов, чистая победа, дебют', () => {
    const rows = [
      { id: 'u', stagePlace: 1, qualPlace: 12, best: 80 },
      { id: 'k', stagePlace: 4, qualPlace: 1, best: 90 },
      { id: 'm', stagePlace: 2, qualPlace: 5, best: 85 },
    ];
    const duels = [
      { winner: 'u', loser: 'k', omt: 0 },
      { winner: 'u', loser: 'm', omt: 0 },
    ];
    const got = stageAchievements(rows, ['k'], new Set(['k']), duels, new Set(['u', 'k']));
    const of = (id: string) => got.filter((a) => a.id === id).map((a) => a.code);
    expect(of('u')).toEqual(['win', 'first_win', 'flawless', 'podium', 'underdog', 'regicide', 'giant_slayer']);
    expect(of('m')).toEqual(['podium', 'debut']);
    expect(of('k')).toEqual(['qual_king']);
  });
});

describe('навыки пилота', () => {
  const w = { angle: 40, style: 30, line: 30 };
  it('средний % по критериям и общий рейтинг; прогрев и спины не считаются', () => {
    const s = skills([
      { attempt: 0, angle: null, style: null, line: null, spin: false, weights: w },
      { attempt: 1, angle: 40, style: 15, line: 30, spin: false, weights: w },
      { attempt: 2, angle: 20, style: 30, line: 15, spin: false, weights: w },
      { attempt: 2, angle: null, style: null, line: null, spin: true, weights: w },
    ]);
    expect(s).toEqual({ angle: 75, style: 75, line: 75, overall: 75, runs: 2 });
  });
  it('нет зачётных попыток — нет навыков', () => {
    expect(skills([])).toBeNull();
  });
  it('данные до сайта смешиваются с сайтом пропорционально заездам', () => {
    const site = { angle: 90, style: 60, line: 80, overall: 80, runs: 2 };
    const legacy = { runs: 6, angle: 70, style: 80, line: 60, overall: 68, wins: 3 };
    expect(mergeSkills(site, legacy)).toEqual({ angle: 75, style: 75, line: 65, overall: 71, runs: 8 });
    expect(mergeSkills(null, legacy)).toEqual({ angle: 70, style: 80, line: 60, overall: 68, runs: 6 });
    expect(mergeSkills(site, null)).toBe(site);
    expect(mergeSkills(site, { runs: 0, angle: 99 })).toBe(site);
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
