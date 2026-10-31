import { vi } from 'vitest';
import { batched, LITE_POLL_MS, litePoll } from './lite';

describe('litePoll', () => {
  it('опрашивает примерно раз в интервал со случайным сдвигом, останавливается', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const stop = litePoll(fn);
    vi.advanceTimersByTime(LITE_POLL_MS * 0.5 - 1);
    expect(fn).not.toHaveBeenCalled(); // не раньше половины интервала
    vi.advanceTimersByTime(LITE_POLL_MS * 1.0 + 2);
    expect(fn).toHaveBeenCalledTimes(1); // первый — до 1.5 интервала
    vi.advanceTimersByTime(LITE_POLL_MS * 10);
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(9); // дальше ~раз в интервал (±20%)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(14);
    const n = fn.mock.calls.length;
    stop();
    vi.advanceTimersByTime(LITE_POLL_MS * 5);
    expect(fn).toHaveBeenCalledTimes(n);
    vi.useRealTimers();
  });
});

describe('batched', () => {
  it('пачка вызовов — один запуск, следующая пачка — ещё один', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const go = batched(fn, 1000);
    for (let i = 0; i < 140; i++) go();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    go();
    go();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
