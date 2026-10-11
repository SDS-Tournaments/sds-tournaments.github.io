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
