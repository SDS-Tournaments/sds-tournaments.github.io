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
  battles: 'Парные заезды',
  finished: 'Завершён',
};

export const STAGE_FLOW = ['draft', 'registration', 'qualifying', 'battles', 'finished'] as const;

/** ISO из базы → значение для <input type="datetime-local"> (локальное время) */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}
