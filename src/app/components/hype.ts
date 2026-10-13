/** Пороги регистраций для уровней «хайпа» этапа: до 5 — уровень 0, 100+ — максимум (10) */
export const HYPE_STEPS = [5, 10, 15, 20, 30, 40, 50, 65, 80, 100];

/** Уровень этапа по числу записавшихся, сколько до следующего уровня и прогресс внутри текущего (0..1) */
export function hype(registered: number): { level: number; max: number; toNext: number | null; progress: number } {
  const level = HYPE_STEPS.filter((s) => registered >= s).length;
  const max = HYPE_STEPS.length;
  if (level === max) return { level, max, toNext: null, progress: 1 };
  const from = level ? HYPE_STEPS[level - 1] : 0;
  const to = HYPE_STEPS[level];
  return { level, max, toNext: to - registered, progress: (registered - from) / (to - from) };
}
