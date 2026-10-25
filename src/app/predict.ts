// Прогнозы зрителей (0022): квалификация — сколько наберёт пилот на трассе, парные — кто победит в дуэли.
// Общая логика для сайта (блок эфира) и плашки стрима.
import { supabase } from './auth';

export const RUN_PICKS = ['lt80', '80', '85', '90', '95', '100'] as const;
export type RunPick = (typeof RUN_PICKS)[number];
export type BattlePick = 'leader' | 'chaser';
export const RUN_PICK_LABEL: Record<RunPick, string> = { lt80: '<80', '80': '80+', '85': '85+', '90': '90+', '95': '95+', '100': '100' };

/** В какой вариант попала итоговая оценка заезда (нулевая попытка — «<80») */
export function pickOfScore(total: number, spin = false): RunPick {
  if (spin || total < 80) return 'lt80';
  return total >= 100 ? '100' : total >= 95 ? '95' : total >= 90 ? '90' : total >= 85 ? '85' : '80';
}

/** Цель голосования в квалификации: пилот на трассе (первый в очереди без 3 заездов) и его ближайшая зачётная попытка */
export function runTarget(
  regs: { profile_id: string; queue_order: number | null }[],
  runs: { profile_id: string; attempt: number }[],
): { profileId: string; attempt: 1 | 2 } | null {
  const queue = [...regs].sort((a, b) => (a.queue_order ?? 1e9) - (b.queue_order ?? 1e9));
  for (const r of queue) {
    const done = new Set(runs.filter((x) => x.profile_id === r.profile_id).map((x) => x.attempt));
    if (done.size >= 3) continue;
    // во время прогрева голосуем уже за 1-ю зачётную
    return { profileId: r.profile_id, attempt: !done.has(1) ? 1 : 2 };
  }
  return null;
}

export interface PredictionCount {
  profile_id: string | null;
  attempt: number | null;
  battle_id: number | null;
  pick: string;
  n: number;
}

export async function loadPredictionCounts(stageId: number): Promise<PredictionCount[]> {
  const { data } = await supabase.rpc('prediction_counts', { p_stage: stageId });
  return ((data ?? []) as PredictionCount[]).map((r) => ({ ...r, n: Number(r.n) }));
}

/** Голоса за конкретный заезд или дуэль: вариант → число */
export function countsFor(rows: PredictionCount[], t: { profileId: string; attempt: number } | { battleId: number }): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const hit = 'battleId' in t ? r.battle_id === t.battleId : !r.battle_id && r.profile_id === t.profileId && r.attempt === t.attempt;
    if (hit) m.set(r.pick, (m.get(r.pick) ?? 0) + r.n);
  }
  return m;
}

/** Случайный id браузера: один голос на заезд/дуэль с устройства (вход не нужен) */
let memVoter: string | null = null;
export function voterId(): string {
  try {
    let v = localStorage.getItem('sds-voter');
    if (!v) localStorage.setItem('sds-voter', (v = crypto.randomUUID()));
    return v;
  } catch {
    return (memVoter ??= crypto.randomUUID());
  }
}

/** Свой голос — помним в браузере, чтобы показать «ваш прогноз» после перезагрузки */
export function myPick(key: string): string | null {
  try {
    return localStorage.getItem('sds-pick:' + key);
  } catch {
    return null;
  }
}
export function rememberPick(key: string, pick: string) {
  try {
    localStorage.setItem('sds-pick:' + key, pick);
  } catch {
    /* приватный режим — просто не запомним */
  }
}
