/** Молния уровня X: координаты 0…100 слоя ×2.2 вокруг карточки (карточка — квадрат 27.3…72.7). lv: 0 — канал, 1–2 — отростки */
export interface Bolt {
  id: number;
  paths: { d: string; lv: number }[];
}

type P = [number, number];
export const CARD_A = 27.3;
export const CARD_B = 72.7;

/** ломаная между a и b: середина смещается поперёк, рекурсивно — как у настоящей молнии */
function zig(a: P, b: P, rough: number, depth: number, rnd: () => number): P[] {
  if (!depth) return [a, b];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const off = (rnd() - 0.5) * rough;
  const mid: P = [(a[0] + b[0]) / 2 - dy * off, (a[1] + b[1]) / 2 + dx * off];
  return [...zig(a, mid, rough, depth - 1, rnd), ...zig(mid, b, rough, depth - 1, rnd).slice(1)];
}

const d = (pts: P[]) => 'M' + pts.map((p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L');

/** Удар молнии от случайной точки края карточки наружу: канал + отростки + мелкие отростки */
export function makeBolt(id: number, rnd: () => number = Math.random): Bolt {
  const side = Math.floor(rnd() * 4);
  const t = CARD_A + (CARD_B - CARD_A) * (0.05 + 0.9 * rnd());
  const start: P = side === 0 ? [t, CARD_A] : side === 1 ? [CARD_B, t] : side === 2 ? [t, CARD_B] : [CARD_A, t];
  const out = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
  const paths: Bolt['paths'] = [];
  const branch = (from: P, ang: number, len: number, lv: number) => {
    const to: P = [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len];
    const pts = zig(from, to, 0.55, lv ? 4 : 6, rnd);
    paths.push({ d: d(pts), lv });
    if (lv >= 2) return;
    const n = lv ? 3 + Math.floor(rnd() * 3) : 10 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const at = 0.1 + rnd() * 0.75;
      const p = pts[Math.floor(at * (pts.length - 1))];
      const side = rnd() < 0.5 ? -1 : 1;
      branch(p, ang + side * (0.35 + rnd() * 0.8), len * (0.3 + rnd() * 0.4) * (1.1 - at * 0.6), lv + 1);
    }
  };
  branch(start, Math.atan2(out[1], out[0]) + (rnd() - 0.5) * 1.1, 22 + rnd() * 20, 0);
  return { id, paths };
}
