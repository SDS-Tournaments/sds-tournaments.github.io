// Прогнозы зрителей (0022): кто победит в дуэли. Только парные — на квалификацию убрали 2026-11-01.
// Общая логика для сайта (блок эфира), пульта комментатора и плашки стрима.
import { supabase } from './auth';

export interface PredictionCount {
  profile_id: string | null;
  attempt: number | null;
  battle_id: number | null;
  pick: string;
  n: number;
}

/** battleId — только эта дуэль: зрителям не нужен весь этап (в разы меньше трафика при опросе) */
export async function loadPredictionCounts(stageId: number, battleId?: number): Promise<PredictionCount[]> {
  let q = supabase.rpc('prediction_counts', { p_stage: stageId }, { get: true });
  if (battleId) q = q.eq('battle_id', battleId);
  const { data } = await q;
  return ((data ?? []) as PredictionCount[]).map((r) => ({ ...r, n: Number(r.n) }));
}

/** Голоса за дуэль: вариант (leader / chaser) → число */
export function countsFor(rows: PredictionCount[], battleId: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) if (r.battle_id === battleId) m.set(r.pick, (m.get(r.pick) ?? 0) + r.n);
  return m;
}

/** Случайный id браузера: один голос на дуэль с устройства (вход не нужен) */
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
