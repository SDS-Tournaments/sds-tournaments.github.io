import { signal } from '@angular/core';

/**
 * Аварийное заграждение: база не отвечает (522/503/таймаут) — зрители перестают слать ей запросы и ждут,
 * чтобы не добивать её повторами (2026-10-31 база на Free легла в наплыв, браузеры набили 25 тыс. ошибок).
 * Штаб (админка, пульты, плашка стрима) не ограничиваем — им база нужна в первую очередь.
 * Пауза растёт: 30 с → 1 → 2 → 4 → 5 мин, у каждого зрителя со своим сдвигом ±20%, чтобы после паузы не ударить разом.
 */
export const dbBusyUntil = signal(0);

const TIMEOUT_MS = 12_000;
const FAILS_TO_OPEN = 3;
const BASE_PAUSE = 30_000;
const MAX_PAUSE = 300_000;
let fails = 0;
let pause = 0;

/** запросы штаба идут всегда */
const priority = () => /^\/(admin|judge|commentator|broadcast|overlay)/.test(location.pathname);
/** к самой базе — данные (REST); вход и функции не трогаем */
const isDb = (url: string) => url.includes('/rest/v1/');
const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);

function failed() {
  fails++;
  // после паузы хватает одной неудачи, чтобы снова закрыться (база ещё не поднялась)
  if (fails < FAILS_TO_OPEN && !pause) return;
  pause = Math.min(pause ? pause * 2 : BASE_PAUSE, MAX_PAUSE);
  dbBusyUntil.set(Date.now() + pause * (0.8 + Math.random() * 0.4));
}

function ok() {
  fails = 0;
  pause = 0;
  if (dbBusyUntil()) dbBusyUntil.set(0);
}

/** Обёртка над fetch: таймаут, учёт ошибок базы, отказ без сети, пока заграждение закрыто */
export async function guardedFetch(input: RequestInfo | URL, init: RequestInit | undefined, next: (i: RequestInfo | URL, n?: RequestInit) => Promise<Response>): Promise<Response> {
  if (!isDb(urlOf(input)) || priority()) return next(input, init);
  if (Date.now() < dbBusyUntil()) throw new TypeError('Сервер перегружен — пауза');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => ctl.abort());
  try {
    const res = await next(input, { ...init, signal: ctl.signal });
    if (res.status >= 500) failed();
    else ok();
    return res;
  } catch (e) {
    if (!init?.signal?.aborted) failed();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** для тестов */
export function resetGuard() {
  fails = 0;
  pause = 0;
  dbBusyUntil.set(0);
}
