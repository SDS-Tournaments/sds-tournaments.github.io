import { supabase } from '../auth';
import { nextSlot, qualStandings, Round, seatInto } from '../scoring/scoring';

export interface BattleRef {
  id: number;
  round: Round;
  slot: number;
  leader_id: string | null;
  chaser_id: string | null;
  winner_id: string | null;
  status: 'pending' | 'running' | 'done';
  omt_count: number;
}

/** Места квалификации этапа (как в пульте) — нужны, чтобы определить лидера пары */
export async function qualPlaces(stageId: number): Promise<Map<string, number>> {
  const [regs, runs] = await Promise.all([
    supabase.from('registrations').select('profile_id, queue_order').eq('stage_id', stageId).eq('status', 'registered'),
    supabase.from('qual_runs').select('profile_id, attempt, total').eq('stage_id', stageId),
  ]);
  const rows = qualStandings(
    (regs.data ?? []).map((r) => ({
      id: r.profile_id,
      queueOrder: r.queue_order ?? 1e9,
      runs: (runs.data ?? []).filter((x) => x.profile_id === r.profile_id),
    })),
  );
  return new Map(rows.map((r) => [r.id, r.place]));
}

/** Пара, куда уходит победитель, и (для полуфинала) пара за 3-е, куда уходит проигравший */
export function targetsOf(b: BattleRef, all: BattleRef[]) {
  const next = nextSlot(b.round, b.slot);
  return {
    next: next ? all.find((x) => x.round === next.round && x.slot === next.slot) : undefined,
    third: b.round === 'sf' ? all.find((x) => x.round === 'third') : undefined,
  };
}

/** Заменить пилота в паре (newPid = null — убрать) с пересортировкой лидер/чейзер по квалификации */
export function reseat(t: BattleRef, oldPid: string | null, newPid: string | null, q: Map<string, number>) {
  const rest = [t.leader_id, t.chaser_id].filter((x): x is string => !!x && x !== oldPid);
  let pair: { leader: string | null; chaser: string | null } = { leader: rest[0] ?? null, chaser: null };
  if (newPid) pair = seatInto(pair, newPid, q);
  return supabase.from('battles').update({ leader_id: pair.leader, chaser_id: pair.chaser }).eq('id', t.id);
}

/** Решение можно менять, пока пары, куда ушли пилоты, ещё не начались */
export function canChange(b: BattleRef, all: BattleRef[]) {
  const { next, third } = targetsOf(b, all);
  return [next, third].every((t) => !t || t.status === 'pending');
}
