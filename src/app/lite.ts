/**
 * Облегчённый режим (2026-10-31: база на Free упала в наплыв).
 * У зрителей — без Realtime: данные эфира перечитываются раз в LITE_POLL_MS, пока вкладку видно.
 * Судьи, комментатор и плашка стрима работают как раньше.
 * На Free не выключать: лимит Realtime — 100 сообщений/с на проект, а каждое изменение уходит каждому зрителю
 * отдельным сообщением — при 100+ зрителях упирается уже одна оценка; плюс прогноз раз в 4 с у каждого.
 */
export const LITE = true;
export const LITE_POLL_MS = 45_000;
/**
 * Редкий опрос: то, что по ходу эфира почти не меняется (очередь, группы), и полная сверка оценок.
 * Трафик Free — 5 ГБ/мес: список участников с аватарками ~10 КБ, оценки к концу квалы ~12 КБ (сжатые).
 */
export const SLOW_POLL_MS = 120_000;

/**
 * Опрос примерно раз в ms, только когда вкладка видна; возвращает функцию остановки.
 * У каждого зрителя свой случайный сдвиг и разброс ±20% — запросы не приходят в базу пачкой в одну секунду.
 */
export function litePoll(fn: () => unknown, ms = LITE_POLL_MS): () => void {
  let t: ReturnType<typeof setTimeout>;
  const next = (delay: number) => {
    t = setTimeout(() => {
      if (document.visibilityState === 'visible') fn();
      next(ms * (0.8 + Math.random() * 0.4));
    }, delay);
  };
  // первый опрос — в случайный момент от 0.5 до 1.5 интервала после открытия (данные только что загружены)
  next(ms * (0.5 + Math.random()));
  return () => clearTimeout(t);
}

/**
 * Пачку событий Realtime — в одну перезагрузку: не чаще раза в ms.
 * Сохранение групп = ~140 событий подряд; без этого пульт перечитывал всё 140 раз.
 */
export function batched(fn: () => unknown, ms = 1000): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => {
    t ??= setTimeout(() => {
      t = undefined;
      fn();
    }, ms);
  };
}

/** Добавить новые записи из частого опроса, не задваивая уже известные (полная сверка могла принести их раньше) */
export function appendNew<T extends { id: number }>(list: T[], fresh: T[]): T[] {
  const known = new Set(list.map((x) => x.id));
  const add = fresh.filter((x) => !known.has(x.id));
  return add.length ? [...list, ...add] : list;
}
