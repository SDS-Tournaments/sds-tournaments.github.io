/**
 * Аварийный облегчённый режим (2026-10-31: база на Free упала от нехватки памяти в наплыв).
 * У зрителей — без Realtime: данные эфира перечитываются раз в LITE_POLL_MS, пока вкладку видно.
 * Судьи, комментатор и плашка стрима работают как раньше. Выключить — LITE = false.
 */
export const LITE = true;
export const LITE_POLL_MS = 30_000;

/** опрос раз в LITE_POLL_MS, только когда вкладка видна; возвращает функцию остановки */
export function litePoll(fn: () => unknown): () => void {
  const id = setInterval(() => document.visibilityState === 'visible' && fn(), LITE_POLL_MS);
  return () => clearInterval(id);
}
