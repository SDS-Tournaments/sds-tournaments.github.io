/** Строка сравнения двух пилотов: длина полосок (0–100) и кто сильнее */
export interface CompareRow {
  key: string;
  a: number | null;
  b: number | null;
  /** доля полоски у каждого: лучший = 100, другой — пропорционально */
  wa: number;
  wb: number;
  better: 'a' | 'b' | null;
}

/** lowerIsBetter — для мест (1-е лучше 5-го) */
export function compareRow(key: string, a: number | null, b: number | null, lowerIsBetter = false): CompareRow {
  if (a === null || b === null || a === b) {
    const w = a === null && b === null ? 0 : 100;
    return { key, a, b, wa: a === null ? 0 : w, wb: b === null ? 0 : w, better: null };
  }
  const aBetter = lowerIsBetter ? a < b : a > b;
  // сила: для мест — обратная величина, чтобы 1-е место давало длинную полоску
  const sa = lowerIsBetter ? 1 / a : a;
  const sb = lowerIsBetter ? 1 / b : b;
  const max = Math.max(sa, sb) || 1;
  return { key, a, b, wa: Math.round((sa / max) * 100), wb: Math.round((sb / max) * 100), better: aBetter ? 'a' : 'b' };
}
