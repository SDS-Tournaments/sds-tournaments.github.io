/** Настройки групп этапа (stages.group_meta), по номеру группы: [0] — группа 1. Буфер — запасная группа со своим названием. */
export interface GroupMeta {
  buffer?: boolean;
  name?: string | null;
}

/** Подпись группы: буфер — своё название (или «Буфер»), обычные — по порядку без учёта буферов */
export function groupLabel(no: number | null, meta: GroupMeta[] | null | undefined, words = { group: 'Группа', buffer: 'Буфер' }): string {
  if (!no) return `${words.group} —`;
  const m = meta ?? [];
  if (m[no - 1]?.buffer) return m[no - 1].name?.trim() || words.buffer;
  const n = no - m.slice(0, no - 1).filter((x) => x?.buffer).length;
  return `${words.group} ${n}`;
}

/** Подтвердившие — вперёд, порядок внутри обеих частей сохраняется */
export function confirmedFirst<T>(list: T[], yes: (x: T) => boolean): T[] {
  return [...list.filter(yes), ...list.filter((x) => !yes(x))];
}

interface Slot {
  profile_id: string;
  group_no: number | null;
  queue_order: number | null;
  status: string;
}

/**
 * Куда вернуть пилота с неявкой. Его место ещё впереди или оценок нет — остаётся там же.
 * Очередь уже прошла его место — в конец идущей группы: иначе он сразу стал бы текущим и сбил судей посреди чужого заезда.
 */
export function restoreSpot(regs: Slot[], runs: { profile_id: string; attempt: number }[], pid: string): { group_no: number | null; queue_order: number | null } {
  const me = regs.find((r) => r.profile_id === pid)!;
  const stay = { group_no: me.group_no, queue_order: me.queue_order };
  if (!runs.length || me.queue_order === null) return stay;
  const scored = new Map<string, number>();
  for (const r of runs) if (r.attempt === 1 || r.attempt === 2) scored.set(r.profile_id, (scored.get(r.profile_id) ?? 0) + 1);
  const placed = regs.filter((r) => r.queue_order !== null && r.profile_id !== pid);
  const active = placed
    .filter((r) => r.status === 'registered')
    .sort((a, b) => a.queue_order! - b.queue_order!)
    .find((r) => (scored.get(r.profile_id) ?? 0) < 2);
  if (!active || me.queue_order > active.queue_order!) return stay;
  const last = Math.max(...placed.filter((r) => r.group_no === active.group_no).map((r) => r.queue_order!));
  const next = Math.min(...placed.filter((r) => r.queue_order! > last).map((r) => r.queue_order!));
  return { group_no: active.group_no, queue_order: Number.isFinite(next) ? (last + next) / 2 : last + 1 };
}
