/**
 * Молния уровня X: координаты 0…100 слоя ×2.2 вокруг карточки (карточка — квадрат 27.3…72.7).
 * lv: 0 — канал, 1–2 — отростки; dl/du — когда отросток начинает прорастать и сколько растёт (с):
 * сначала пробивается канал, отростки раскатываются, когда канал дошёл до места, откуда они растут.
 * power 0…1 — сила удара (под силу прыжка карточки): длина, толщина, число отростков, яркость.
 */
export interface Bolt {
  id: number;
  power: number;
  /** сколько живёт, с */
  dur: number;
  paths: { d: string; lv: number; dl: number; du: number; w: number }[];
}

type P = [number, number];
export const CARD_A = 27.3;
export const CARD_B = 72.7;
/** канал начинается под карточкой — видно, как молния выходит из-под неё, без обрубка на краю */
export const UNDER = 4;
const GROW = [0.3, 0.4, 0.3];

/** ломаная между a и b: середина смещается поперёк, рекурсивно — как у настоящей молнии */
function zig(a: P, b: P, rough: number, depth: number, rnd: () => number): P[] {
  if (!depth) return [a, b];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const off = (rnd() - 0.5) * rough;
  const mid: P = [(a[0] + b[0]) / 2 - dy * off, (a[1] + b[1]) / 2 + dx * off];
  return [...zig(a, mid, rough * 0.9, depth - 1, rnd), ...zig(mid, b, rough * 0.9, depth - 1, rnd).slice(1)];
}

const d = (pts: P[]) => 'M' + pts.map((p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L');

/** Удар молнии из-под случайного края карточки наружу; side — с какой стороны (0 верх, 1 право, 2 низ, 3 лево) */
export function makeBolt(id: number, power = 1, rnd: () => number = Math.random, side = Math.floor(rnd() * 4)): Bolt {
  const t = CARD_A + (CARD_B - CARD_A) * (0.05 + 0.9 * rnd());
  const A = CARD_A + UNDER, B = CARD_B - UNDER;
  const start: P = side === 0 ? [t, A] : side === 1 ? [B, t] : side === 2 ? [t, B] : [A, t];
  const out = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
  // толщина: канал заметно толще отростков, у сильного удара — ещё толще
  const W = [0.3 + 0.32 * power, 0.09 + 0.05 * power, 0.05];
  const paths: Bolt['paths'] = [];
  const branch = (from: P, ang: number, len: number, lv: number, dl: number) => {
    const to: P = [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len];
    // отростки — ровнее и короче изломы, чтобы не было «вермишели»
    const pts = zig(from, to, lv ? 0.32 : 0.5, lv ? 3 : 6, rnd);
    const du = GROW[lv];
    paths.push({ d: d(pts), lv, dl: +dl.toFixed(3), du, w: W[lv] });
    if (lv >= 2 || (lv === 1 && power < 0.7)) return;
    const n = lv ? 1 + Math.floor(rnd() * 2) : Math.round(2 + 5 * power + rnd() * 2);
    for (let k = 0; k < n; k++) {
      const at = 0.15 + rnd() * 0.7;
      const p = pts[Math.floor(at * (pts.length - 1))];
      const s = rnd() < 0.5 ? -1 : 1;
      branch(p, ang + s * (0.35 + rnd() * 0.6), len * (0.3 + rnd() * 0.35) * (1.1 - at * 0.6), lv + 1, dl + du * at);
    }
  };
  branch(start, Math.atan2(out[1], out[0]) + (rnd() - 0.5) * 1.0, 14 + 32 * power + rnd() * 8, 0, 0);
  return { id, power, dur: 1.2 + 1.3 * power, paths };
}
