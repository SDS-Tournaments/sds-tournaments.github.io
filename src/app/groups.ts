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
