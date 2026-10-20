import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryFetch } from './boot';

describe('retryFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('повторяет GET после обрыва связи', async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', f);
    const r = await retryFetch('https://x/rest', undefined, 0);
    expect(await r.text()).toBe('ok');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('сдаётся после 3 попыток', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    await expect(retryFetch('https://x/rest', undefined, 0)).rejects.toThrow('Failed to fetch');
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('не повторяет POST (запись, вход)', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    await expect(retryFetch('https://x/auth', { method: 'POST' }, 0)).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
