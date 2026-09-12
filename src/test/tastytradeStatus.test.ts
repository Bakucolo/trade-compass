import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTastytradeStatus } from '../services/tastytrade';

describe('Tastytrade Status Service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns connected: false when backend returns connected: false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ connected: false }),
    } as any);

    const status = await fetchTastytradeStatus();
    expect(status.connected).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith('/api/tastytrade/status');
  });

  it('returns connected: true when backend returns active session or oauth', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connected: true,
        accountNumber: '5WT67220',
      }),
    } as any);

    const status = await fetchTastytradeStatus();
    expect(status.connected).toBe(true);
    expect(status.accountNumber).toBe('5WT67220');
  });

  it('gracefully returns connected: false when backend returns non-200 or network error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    const status = await fetchTastytradeStatus();
    expect(status.connected).toBe(false);
  });
});
