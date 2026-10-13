// Загрузочный экран «SAD» (разметка и стили — в index.html, чтобы он был виден ещё до загрузки кода).
// Надпись заливается по мере ответов базы; когда страница открыта и запросы затихли — доливается и исчезает.

let started = 0;
let done = 0;
let onChange: (() => void) | null = null;

/** fetch для supabase-js: считает запросы, чтобы двигать заливку */
export const trackedFetch: typeof fetch = (input, init) => {
  started++;
  onChange?.();
  return fetch(input, init).finally(() => {
    done++;
    onChange?.();
  });
};

/** Запустить после первой навигации: экран уходит, когда запросы стихли на 300 мс (но не позже 10 с) */
export function finishBoot() {
  const el = document.getElementById('boot');
  if (!el) return;
  const set = (p: number) => el.style.setProperty('--p', `${p}%`);
  let idle: ReturnType<typeof setTimeout> | undefined;
  const close = () => {
    onChange = null;
    clearTimeout(idle);
    clearTimeout(cap);
    set(100);
    setTimeout(() => el.classList.add('done'), 450);
    setTimeout(() => el.remove(), 1100);
  };
  const cap = setTimeout(close, 10_000);
  const tick = () => {
    // 45% — код загружен; дальше доля ответивших запросов, до 95% пока ждём остальные
    set(45 + (started ? (done / started) * 50 : 50));
    clearTimeout(idle);
    if (done >= started) idle = setTimeout(close, 300);
  };
  onChange = tick;
  tick();
}
