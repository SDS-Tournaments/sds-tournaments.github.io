import { vi } from 'vitest';
import { appendNew, batched, LITE_POLL_MS, litePoll } from './lite';

describe('litePoll', () => {
  it('опрашивает примерно раз в интервал со случайным сдвигом, останавливается', () => {
    vi.useFakeTimers();
    // самый ранний сдвиг: первый опрос через 0.5 интервала, дальше каждые 0.8
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0);
    const fn = vi.fn();
    const stop = litePoll(fn);
    vi.advanceTimersByTime(LITE_POLL_MS * 0.5 - 1);
    expect(fn).not.toHaveBeenCalled(); // не раньше половины интервала
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(LITE_POLL_MS * 8);
    expect(fn).toHaveBeenCalledTimes(11); // 8 / 0.8 = ещё 10 — интервал не сжимается со временем
    rnd.mockRestore();
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

describe('appendNew', () => {
  it('добавляет только неизвестные, без новых — тот же список', () => {
    const list = [{ id: 1 }, { id: 2 }];
    expect(appendNew(list, [{ id: 2 }, { id: 3 }])).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(appendNew(list, [{ id: 1 }])).toBe(list);
    expect(appendNew(list, [])).toBe(list);
  });
});
