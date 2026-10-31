/**
 * Аварийный облегчённый режим (2026-10-31: база на Free упала от нехватки памяти в наплыв).
 * У зрителей — без Realtime: данные эфира перечитываются раз в LITE_POLL_MS, пока вкладку видно.
 * Судьи, комментатор и плашка стрима работают как раньше. Выключить — LITE = false.
 */
export const LITE = true;
export const LITE_POLL_MS = 45_000;

/**
 * Опрос примерно раз в LITE_POLL_MS, только когда вкладка видна; возвращает функцию остановки.
 * У каждого зрителя свой случайный сдвиг и разброс ±20% — запросы не приходят в базу пачкой в одну секунду.
 */
export function litePoll(fn: () => unknown): () => void {
  let t: ReturnType<typeof setTimeout>;
  const next = (ms: number) => {
    t = setTimeout(() => {
      if (document.visibilityState === 'visible') fn();
      next(LITE_POLL_MS * (0.8 + Math.random() * 0.4));
    }, ms);
  };
  // первый опрос — в случайный момент от 0.5 до 1.5 интервала после открытия (данные только что загружены)
  next(LITE_POLL_MS * (0.5 + Math.random()));
  return () => clearTimeout(t);
}
