// Подписи статусов для админки (RU)
export const SEASON_STATUS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Идёт',
  finished: 'Завершён',
};

export const STAGE_STATUS: Record<string, string> = {
  draft: 'Черновик',
  registration: 'Регистрация',
  qualifying: 'Квалификация',
  qual_done: 'Квала завершена',
  battles: 'Парные заезды',
  finished: 'Завершён',
};

export const STAGE_FLOW = ['draft', 'registration', 'qualifying', 'qual_done', 'battles', 'finished'] as const;

/** день 2 (парные) по умолчанию — через сутки после квалификации */
export function plusDay(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  d.setDate(d.getDate() + 1);
  return toLocalInput(d.toISOString());
}

/** ISO из базы → значение для <input type="datetime-local"> (локальное время) */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}
