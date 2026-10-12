// Правила подсчёта SDS — spec §5. Чистые функции, без обращения к базе.

export type Round = 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';
export type Vote = 'leader' | 'chaser' | 'omt';
/** Чем закончился этап для пилота в сетке */
export type Finish = 'win' | 'final' | 'third-win' | 'third-loss' | 'qf' | 'r16' | 'r32';

export interface QualRun {
  attempt: number; // 0 = прогрев
  total: number; // спин уже даёт 0 (считает база)
}
export interface QualEntry {
  id: string;
  queueOrder: number;
  runs: QualRun[];
}
export interface QualRow {
  id: string;
  place: number;
  best: number;
  worst: number;
}

/** §5.1 Лучшая из попыток 1–2; ничья → выше худшая попытка → раньше в очереди. Без зачётных попыток — не классифицирован. */
export function qualStandings(entries: QualEntry[]): QualRow[] {
  const rows = entries.flatMap((e) => {
    const scored = e.runs.filter((r) => r.attempt > 0).map((r) => r.total);
    if (!scored.length) return [];
    const best = Math.max(...scored);
    const worst = scored.length > 1 ? Math.min(...scored) : 0;
    return [{ id: e.id, q: e.queueOrder, best, worst }];
  });
  rows.sort((a, b) => b.best - a.best || b.worst - a.worst || a.q - b.q);
  return rows.map((r, i) => ({ id: r.id, place: i + 1, best: r.best, worst: r.worst }));
}

/** Разбивка на группы по `size` в заданном порядке → номер группы (с 1) и сквозной порядок в очереди (с 1) */
export function assignGroups<T>(items: T[], size = 10): { item: T; group: number; queue: number }[] {
  return items.map((item, i) => ({ item, group: Math.floor(i / size) + 1, queue: i + 1 }));
}

/** §5.2 Размер сетки: auto → 32 при 17+, 16 при 9–16, 8 при ≤ 8 */
export function bracketSize(qualified: number, setting: 'auto' | '32' | '16' | '8' = 'auto'): 32 | 16 | 8 {
  if (setting !== 'auto') return Number(setting) as 32 | 16 | 8;
  return qualified >= 17 ? 32 : qualified >= 9 ? 16 : 8;
}

/** Классический посев: 1 и 2 встречаются только в финале. size=8 → [1,8,4,5,2,7,3,6] */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((s) => [s, sum - s]);
  }
  return order;
}

export const FIRST_ROUND: Record<32 | 16 | 8, Round> = { 32: 'r32', 16: 'r16', 8: 'qf' };
const NEXT: Partial<Record<Round, Round>> = { r32: 'r16', r16: 'qf', qf: 'sf', sf: 'final' };

export interface Pair {
  round: Round;
  slot: number;
  leader: string | null;
  chaser: string | null; // null → бай: лидер проходит без дуэли
}

/** Первый раунд по местам квалификации (ids[0] — 1-е место). Лидер — лучший по квалификации. */
export function firstRound(ids: string[], size: 32 | 16 | 8): Pair[] {
  const order = seedOrder(size);
  return Array.from({ length: size / 2 }, (_, slot) => {
    const [a, b] = [order[2 * slot], order[2 * slot + 1]];
    return {
      round: FIRST_ROUND[size],
      slot,
      leader: ids[Math.min(a, b) - 1] ?? null,
      chaser: ids[Math.max(a, b) - 1] ?? null,
    };
  });
}

/** Куда идёт победитель: следующий раунд и слот. Проигравшие полуфиналов — в 'third' слот 0. */
export function nextSlot(round: Round, slot: number): { round: Round; slot: number } | null {
  const next = NEXT[round];
  return next ? { round: next, slot: slot >> 1 } : null;
}

/** Раунды сетки по порядку проведения (дуэль за 3-е — перед финалом) и число пар в каждом */
export function roundsFor(size: 32 | 16 | 8): { round: Round; slots: number }[] {
  const all: { round: Round; slots: number }[] = [
    { round: 'r32', slots: 16 },
    { round: 'r16', slots: 8 },
    { round: 'qf', slots: 4 },
    { round: 'sf', slots: 2 },
    { round: 'third', slots: 1 },
    { round: 'final', slots: 1 },
  ];
  return all.filter((r) => r.slots < size);
}

/** Поставить пилота в пару следующего раунда: свободное место, лидер — лучший по квалификации */
export function seatInto(
  pair: { leader: string | null; chaser: string | null },
  pilot: string,
  qualPlace: Map<string, number>,
): { leader: string | null; chaser: string | null } {
  const other = pair.leader && pair.leader !== pilot ? pair.leader : pair.chaser && pair.chaser !== pilot ? pair.chaser : null;
  if (!other) return { leader: pilot, chaser: null };
  const [leader, chaser] = orderPair(pilot, other, qualPlace);
  return { leader, chaser };
}

export interface BracketRow {
  round: Round;
  slot: number;
  leader: string | null;
  chaser: string | null;
  winner: string | null;
  done: boolean;
  bye: boolean;
}

/**
 * §5.2 Вся сетка сразу: первый раунд по посеву, остальные пустые.
 * Пара без соперника закрывается баем (пустая — без победителя) раунд за раундом,
 * пока обе пары, из которых она собирается, решены — иначе ручной Top 32 на 10 пилотов застрянет.
 */
export function buildBracket(ids: string[], size: 32 | 16 | 8, qualPlace: Map<string, number>): BracketRow[] {
  const rows: BracketRow[] = roundsFor(size).flatMap(({ round, slots }) =>
    Array.from({ length: slots }, (_, slot) => ({ round, slot, leader: null, chaser: null, winner: null, done: false, bye: false })),
  );
  const find = (round: Round, slot: number) => rows.find((r) => r.round === round && r.slot === slot)!;
  for (const p of firstRound(ids, size)) Object.assign(find(p.round, p.slot), { leader: p.leader, chaser: p.chaser });

  const order = roundsFor(size)
    .map((r) => r.round)
    .filter((r) => r !== 'third');
  order.forEach((round, i) => {
    for (const row of rows.filter((r) => r.round === round)) {
      const fed = i === 0 || [2 * row.slot, 2 * row.slot + 1].every((s) => find(order[i - 1], s).done);
      if (!fed || (row.leader && row.chaser)) continue;
      row.done = true;
      if (!row.leader) continue;
      Object.assign(row, { winner: row.leader, bye: true });
      const next = nextSlot(round, row.slot);
      if (!next) continue;
      const target = find(next.round, next.slot);
      Object.assign(target, seatInto(target, row.leader, qualPlace));
    }
  });
  return rows;
}

/** Лидер пары в следующих раундах — у кого лучше место квалификации */
export function orderPair(a: string, b: string, qualPlace: Map<string, number>): [leader: string, chaser: string] {
  return (qualPlace.get(a) ?? Infinity) <= (qualPlace.get(b) ?? Infinity) ? [a, b] : [b, a];
}

/**
 * §5.3 Итог голосования одной попытки (3 судьи).
 * ≥ 2 голоса за пилота → победа; иначе OMT; после второго OMT → победа лидера (лучший по квалификации).
 * null — проголосовали ещё не все.
 */
export function battleOutcome(votes: Vote[], omtCount: number): 'leader' | 'chaser' | 'omt' | 'tiebreak' | null {
  if (votes.length < 3) return null;
  const n = (v: Vote) => votes.filter((x) => x === v).length;
  if (n('leader') >= 2) return 'leader';
  if (n('chaser') >= 2) return 'chaser';
  return omtCount < 2 ? 'omt' : 'tiebreak';
}

/** Чем закончилась дуэль для проигравшего */
export const LOSER_FINISH: Record<Round, Finish | null> = {
  r32: 'r32',
  r16: 'r16',
  qf: 'qf',
  sf: null, // идёт в дуэль за 3-е
  third: 'third-loss',
  final: 'final',
};

export interface BattleResult {
  round: Round;
  leader: string | null;
  chaser: string | null;
  winner: string | null;
  bye: boolean;
}

/** Стадия вылета каждого пилота по решённым дуэлям (баи не считаются) */
export function finishesFrom(battles: BattleResult[]): Map<string, Finish> {
  const m = new Map<string, Finish>();
  for (const b of battles) {
    if (!b.winner || b.bye) continue;
    const loser = b.winner === b.leader ? b.chaser : b.leader;
    if (b.round === 'final') {
      m.set(b.winner, 'win');
      if (loser) m.set(loser, 'final');
    } else if (b.round === 'third') {
      m.set(b.winner, 'third-win');
      if (loser) m.set(loser, 'third-loss');
    } else {
      const f = LOSER_FINISH[b.round];
      if (f && loser) m.set(loser, f);
    }
  }
  return m;
}

/** Причина нулевой попытки (qual_runs.fail): спин, авария, выпрямление, вылет (4 колеса за трассой) */
export const FAILS = ['spin', 'crash', 'straight', 'offtrack'] as const;
export type Fail = (typeof FAILS)[number];

export const ACHIEVEMENTS = [
  'win', 'first_win', 'back_to_back', 'hat_trick', 'flawless', 'podium', 'underdog',
  'qual_king', 'perfect_100', 'omt2', 'regicide', 'giant_slayer', 'debut',
  'revenge', 'last_wagon', 'marathon', 'sniper', 'wooden', 'spinner', 'throw_322',
  'straight2', 'offtrack2', 'crash2',
] as const;
export type Achievement = (typeof ACHIEVEMENTS)[number];

type ZeroRun = { total: number; spin: boolean; fail?: Fail | null };

/** Ачивка за пару зачётных попыток квалификации: «Снайпер» или два одинаковых нуля (старые записи без причины — спин) */
export function pairAchievement(runs: ZeroRun[]): Achievement | null {
  if (runs.length !== 2) return null;
  if (runs.every((x) => !x.spin && x.total > 0) && Math.abs(runs[0].total - runs[1].total) <= 0.5) return 'sniper';
  const f = runs[0].fail ?? 'spin';
  if (!runs.every((x) => x.spin && (x.fail ?? 'spin') === f)) return null;
  return ({ spin: 'spinner', straight: 'straight2', offtrack: 'offtrack2', crash: 'crash2' } as const)[f];
}

/**
 * Ачивки, которые заезд приносит прямо сейчас (показываются на стриме под оценкой).
 * Те же правила, что при подведении итогов: «Идеальные 100» — первая сотня на этапе, парные — после 2-й попытки.
 */
export function liveRunAchievements(run: ZeroRun & { attempt: number }, pilotRuns: (ZeroRun & { attempt: number })[]): Achievement[] {
  const out: Achievement[] = [];
  const scored = pilotRuns.filter((x) => x.attempt > 0);
  if (!run.spin && run.total >= 100 && !scored.some((x) => x.attempt < run.attempt && !x.spin && x.total >= 100)) out.push('perfect_100');
  if (run.attempt === 2) {
    const pair = pairAchievement([...scored].sort((a, b) => a.attempt - b.attempt));
    if (pair) out.push(pair);
  }
  return out;
}

/** Решённая дуэль этапа (без баев) */
export interface Duel {
  winner: string;
  loser: string;
  omt: number;
}

/** Доп. данные этапа для достижений: участники сетки, дуэли прошлого этапа сезона */
export interface AchContext {
  bracket?: string[];
  prevDuels?: Duel[];
}

/**
 * Достижения за этап. `prevWinners` — победители предыдущих этапов сезона (последний — в конце),
 * `everWon` — кто уже побеждал на этапах раньше, `duels` — дуэли этапа, `veterans` — кто уже ездил этапы раньше.
 */
export function stageAchievements(
  rows: { id: string; stagePlace: number; qualPlace: number; best: number; runs?: { total: number; spin: boolean; fail?: Fail | null }[] }[],
  prevWinners: string[],
  everWon: Set<string>,
  duels: Duel[],
  veterans: Set<string>,
  ctx: AchContext = {},
): { id: string; code: Achievement }[] {
  const qualOf = new Map(rows.map((r) => [r.id, r.qualPlace]));
  const champ = prevWinners.at(-1);
  // последний номер посева в сетке
  const seeded = (ctx.bracket ?? []).filter((id) => qualOf.has(id));
  const lastSeed = seeded.length >= 4 ? seeded.reduce((a, b) => (qualOf.get(b)! > qualOf.get(a)! ? b : a)) : null;
  const out: { id: string; code: Achievement }[] = [];
  for (const r of rows) {
    const add = (code: Achievement) => out.push({ id: r.id, code });
    const won = duels.filter((d) => d.winner === r.id);
    if (r.stagePlace === 1) {
      add('win');
      if (!everWon.has(r.id)) add('first_win');
      if (champ === r.id) add('back_to_back');
      if (prevWinners.length >= 2 && prevWinners.slice(-2).every((w) => w === r.id)) add('hat_trick');
      if (won.length && won.every((d) => d.omt === 0)) add('flawless');
    }
    if (r.stagePlace <= 3) add('podium');
    if (r.stagePlace <= 3 && r.qualPlace >= 9) add('underdog');
    if (r.qualPlace === 1) add('qual_king');
    if (r.best >= 100) add('perfect_100');
    if (won.some((d) => d.omt >= 2)) add('omt2');
    if (champ && champ !== r.id && won.some((d) => d.loser === champ)) add('regicide');
    if (won.some((d) => r.qualPlace - (qualOf.get(d.loser) ?? r.qualPlace) >= 8)) add('giant_slayer');
    if (!veterans.has(r.id)) add('debut');
    // кто выбил тебя на прошлом этапе — того ты выбил сейчас
    const nemesis = new Set((ctx.prevDuels ?? []).filter((d) => d.loser === r.id).map((d) => d.winner));
    if (won.some((d) => nemesis.has(d.loser))) add('revenge');
    if (r.id === lastSeed && won.length) add('last_wagon');
    if (duels.filter((d) => d.winner === r.id || d.loser === r.id).reduce((s, d) => s + d.omt, 0) >= 3) add('marathon');
    const runs = r.runs ?? [];
    const pair = pairAchievement(runs);
    if (pair === 'sniper') add('sniper');
    if (r.stagePlace === 4 && seeded.length >= 4) add('wooden');
    if (pair && pair !== 'sniper') add(pair);
    // «322»: первый квалификации вылетает от последнего номера посева
    if (r.qualPlace === 1 && lastSeed && duels.some((d) => d.loser === r.id && d.winner === lastSeed)) add('throw_322');
  }
  return out;
}

const FINISH_RANK: Record<Finish, number> = { win: 1, final: 2, 'third-win': 3, 'third-loss': 4, qf: 5, r16: 9, r32: 17 };

export interface StageRow {
  id: string;
  qualPlace: number;
  finish: Finish | null;
  stagePlace: number;
}

/** §5.4 Места на этапе: сначала сетка по стадии вылета, внутри — по квалификации; дальше не попавшие в сетку. DQ не классифицируется. */
export function stagePlaces(qual: QualRow[], finishes: Map<string, Finish>, dq: Set<string> = new Set()): StageRow[] {
  return qual
    .filter((q) => !dq.has(q.id))
    .map((q) => ({ id: q.id, qualPlace: q.place, finish: finishes.get(q.id) ?? null }))
    .sort((a, b) => (a.finish ? FINISH_RANK[a.finish] : 99) - (b.finish ? FINISH_RANK[b.finish] : 99) || a.qualPlace - b.qualPlace)
    .map((r, i) => ({ ...r, stagePlace: i + 1 }));
}

export interface PointsTable {
  qual: { places: number[]; to32: number; rest: number };
  battle: Record<string, number>; // ключ — худшее место диапазона: 1, 2, 3, 4, 8, 16
}

/** RDS GP 2024 — значения по умолчанию (как в seasons) */
export const RDS_2024: PointsTable = {
  qual: { places: [22, 19, 17, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3], to32: 2, rest: 1 },
  battle: { 1: 250, 2: 180, 3: 145, 4: 120, 8: 70, 16: 30 },
};

const FINISH_KEY: Record<Finish, string | null> = {
  win: '1',
  final: '2',
  'third-win': '3',
  'third-loss': '4',
  qf: '8',
  r16: '16',
  r32: null,
};

/** §5.5 Очки пилота за этап */
export function stagePoints(qualPlace: number, finish: Finish | null, t: PointsTable = RDS_2024) {
  const qual = qualPlace <= t.qual.places.length ? t.qual.places[qualPlace - 1] : qualPlace <= 32 ? t.qual.to32 : t.qual.rest;
  const key = finish && FINISH_KEY[finish];
  const battle = key ? (t.battle[key] ?? 0) : 0;
  return { qual, battle, total: qual + battle };
}

export interface SkillRun {
  attempt: number;
  angle: number | null;
  style: number | null;
  line: number | null;
  spin: boolean;
  weights: { angle: number; style: number; line: number };
}

/**
 * Навыки пилота для «паутинки» и FIFA-карточки: средний % от максимума по каждому критерию
 * и общий рейтинг — средний итог зачётной попытки (0–100). Прогрев и спины не учитываются.
 */
export function skills(runs: SkillRun[]): { angle: number; style: number; line: number; overall: number; runs: number } | null {
  const ok = runs.filter((r) => r.attempt > 0 && !r.spin && r.angle !== null && r.style !== null && r.line !== null);
  if (!ok.length) return null;
  const pct = (k: 'angle' | 'style' | 'line') => Math.round((ok.reduce((s, r) => s + r[k]! / (r.weights[k] || 1), 0) / ok.length) * 100);
  const overall = Math.round(ok.reduce((s, r) => s + r.angle! + r.style! + r.line!, 0) / ok.length);
  return { angle: pct('angle'), style: pct('style'), line: pct('line'), overall, runs: ok.length };
}

export type Skills = NonNullable<ReturnType<typeof skills>>;
/** Статистика до сайта, которую вписал организатор (profiles.legacy) */
export interface Legacy {
  runs?: number | null;
  angle?: number | null;
  style?: number | null;
  line?: number | null;
  overall?: number | null;
  wins?: number | null;
}

/** Навыки до сайта + навыки с сайта: среднее, взвешенное по числу зачётных заездов */
export function mergeSkills(site: Skills | null, legacy: Legacy | null | undefined): Skills | null {
  const n = legacy?.runs ?? 0;
  if (n <= 0) return site;
  const old: Skills = { angle: legacy!.angle ?? 0, style: legacy!.style ?? 0, line: legacy!.line ?? 0, overall: legacy!.overall ?? 0, runs: n };
  if (!site) return old;
  const m = site.runs;
  const mix = (k: 'angle' | 'style' | 'line' | 'overall') => Math.round((old[k] * n + site[k] * m) / (n + m));
  return { angle: mix('angle'), style: mix('style'), line: mix('line'), overall: mix('overall'), runs: n + m };
}

export interface TeamStageInput {
  teamId: string | null;
  total: number;
  stagePlace: number;
}
export interface TeamRow {
  teamId: string;
  points: number;
  bestPlace: number;
  place: number;
}

/** §5.5 Команда за этап: сумма `counted` лучших; ничья → у кого пилот выше на этапе */
export function teamStage(results: TeamStageInput[], counted = 3): TeamRow[] {
  const byTeam = new Map<string, TeamStageInput[]>();
  for (const r of results) if (r.teamId) byTeam.set(r.teamId, [...(byTeam.get(r.teamId) ?? []), r]);
  return [...byTeam]
    .map(([teamId, rs]) => ({
      teamId,
      points: rs
        .map((r) => r.total)
        .sort((a, b) => b - a)
        .slice(0, counted)
        .reduce((s, x) => s + x, 0),
      bestPlace: Math.min(...rs.map((r) => r.stagePlace)),
    }))
    .sort((a, b) => b.points - a.points || a.bestPlace - b.bestPlace)
    .map((r, i) => ({ ...r, place: i + 1 }));
}

export interface SeasonStageResult {
  id: string;
  total: number;
  stagePlace: number;
  qualPlace: number;
}
export interface SeasonRow {
  id: string;
  points: number;
  place: number;
}

/**
 * §5.6 Личный зачёт сезона. `stages` — итоги этапов по порядку.
 * Ничья → больше 1-х мест, затем 2-х… → больше побед в квалификации → выше на последнем этапе.
 */
export function seasonStandings(stages: SeasonStageResult[][]): SeasonRow[] {
  const acc = new Map<string, { points: number; places: number[]; qualWins: number; last: number }>();
  for (const stage of stages)
    for (const r of stage) {
      const a = acc.get(r.id) ?? { points: 0, places: [], qualWins: 0, last: Infinity };
      a.points += r.total;
      a.places.push(r.stagePlace);
      if (r.qualPlace === 1) a.qualWins++;
      acc.set(r.id, a);
    }
  for (const r of stages.at(-1) ?? []) acc.get(r.id)!.last = r.stagePlace;

  // Отсортированные по возрастанию места сравниваются поэлементно: у кого раньше место лучше — у того больше высоких мест
  const byPlaces = (x: number[], y: number[]) => {
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] ?? Infinity) - (y[i] ?? Infinity);
      if (d) return d;
    }
    return 0;
  };
  return [...acc]
    .map(([id, a]) => ({ id, ...a, places: a.places.sort((p, q) => p - q) }))
    .sort((a, b) => b.points - a.points || byPlaces(a.places, b.places) || b.qualWins - a.qualWins || a.last - b.last)
    .map((r, i) => ({ id: r.id, points: r.points, place: i + 1 }));
}

/** §5.6 Командный зачёт сезона: сумма командных очков; ничья → у кого лучший пилот выше в личном зачёте */
export function teamSeason(stageTeams: TeamRow[][], members: Map<string, string[]>, personal: SeasonRow[]): SeasonRow[] {
  const rank = new Map(personal.map((p) => [p.id, p.place]));
  const pts = new Map<string, number>();
  for (const stage of stageTeams) for (const t of stage) pts.set(t.teamId, (pts.get(t.teamId) ?? 0) + t.points);
  const best = (team: string) => Math.min(...(members.get(team) ?? []).map((id) => rank.get(id) ?? Infinity));
  return [...pts]
    .sort(([a, x], [b, y]) => y - x || best(a) - best(b))
    .map(([id, points], i) => ({ id, points, place: i + 1 }));
}
