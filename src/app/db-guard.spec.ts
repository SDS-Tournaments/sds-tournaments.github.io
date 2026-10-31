import { vi } from 'vitest';
import { dbBusyUntil, guardedFetch, resetGuard } from './db-guard';

const URL_DB = 'https://x.supabase.co/rest/v1/stages?select=id';
const res = (status: number) => Promise.resolve(new Response('[]', { status }));

describe('db-guard', () => {
  beforeEach(() => resetGuard());

  it('3 ошибки базы подряд — пауза, запросы не уходят; после паузы и успеха — снова открыто', async () => {
    const next = vi.fn(() => res(522));
    for (let i = 0; i < 3; i++) await guardedFetch(URL_DB, undefined, next);
    expect(dbBusyUntil()).toBeGreaterThan(Date.now());
    await expect(guardedFetch(URL_DB, undefined, next)).rejects.toThrow();
    expect(next).toHaveBeenCalledTimes(3); // четвёртый не ушёл в сеть
    dbBusyUntil.set(Date.now() - 1); // пауза прошла
    await guardedFetch(URL_DB, undefined, () => res(200));
    expect(dbBusyUntil()).toBe(0);
  });

  it('после паузы одна неудача снова закрывает — и пауза длиннее', async () => {
    const bad = () => res(503);
    for (let i = 0; i < 3; i++) await guardedFetch(URL_DB, undefined, bad);
    const first = dbBusyUntil() - Date.now();
    dbBusyUntil.set(Date.now() - 1);
    await guardedFetch(URL_DB, undefined, bad);
    expect(dbBusyUntil() - Date.now()).toBeGreaterThan(first);
  });

  it('вход и функции не ограничиваем', async () => {
    for (let i = 0; i < 3; i++) await guardedFetch(URL_DB, undefined, () => res(522));
    const next = vi.fn(() => res(200));
    await guardedFetch('https://x.supabase.co/auth/v1/token', undefined, next);
    expect(next).toHaveBeenCalled();
  });
});
