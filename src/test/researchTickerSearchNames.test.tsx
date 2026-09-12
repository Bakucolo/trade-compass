import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketDataService } from '../services/marketData';
import { searchKnownTickers, getKnownCompanyName, KNOWN_COMPANY_NAMES } from '../services/commonTickers';

describe('Research Section Ticker Search with Company Names', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly maps known symbols to their official institutional names', () => {
    expect(getKnownCompanyName('AAPL')).toBe('Apple Inc.');
    expect(getKnownCompanyName('KVYO')).toBe('Klaviyo, Inc.');
    expect(getKnownCompanyName('TSLA')).toBe('Tesla, Inc.');
    expect(getKnownCompanyName('CCJ')).toBe('Cameco Corporation');
    expect(getKnownCompanyName('PLTR')).toBe('Palantir Technologies Inc.');
    expect(getKnownCompanyName('SMR')).toBe('NuScale Power Corporation');
    expect(getKnownCompanyName('NVDA')).toBe('NVIDIA Corporation');
  });

  it('performs instant keyword matching across company names and symbol prefixes', () => {
    // Search by partial company name
    const klavMatches = searchKnownTickers('klav');
    expect(klavMatches.length).toBeGreaterThan(0);
    expect(klavMatches[0].symbol).toBe('KVYO');
    expect(klavMatches[0].name).toBe('Klaviyo, Inc.');

    // Search by ticker prefix
    const nvdaMatches = searchKnownTickers('NVD');
    expect(nvdaMatches.length).toBeGreaterThan(0);
    expect(nvdaMatches[0].symbol).toBe('NVDA');
    expect(nvdaMatches[0].name).toBe('NVIDIA Corporation');

    // Search by name "Tesla"
    const teslaMatches = searchKnownTickers('Tesla');
    expect(teslaMatches.length).toBeGreaterThan(0);
    expect(teslaMatches[0].symbol).toBe('TSLA');
    expect(teslaMatches[0].name).toBe('Tesla, Inc.');
  });

  it('marketDataService.searchSymbols enriches results with company names', async () => {
    // Mock fetch returning items without names or with symbol as name
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { symbol: 'KVYO', name: 'KVYO', currency: 'USD', stockExchange: 'US', exchangeShortName: 'US' },
        { symbol: 'AAPL', name: '', currency: 'USD', stockExchange: 'US', exchangeShortName: 'US' },
        { symbol: 'TSLA', name: 'Tesla, Inc.', currency: 'USD', stockExchange: 'NASDAQ', exchangeShortName: 'NASDAQ' }
      ]
    });
    global.fetch = mockFetch;

    const results = await marketDataService.searchSymbols('test-query');
    expect(results.length).toBe(3);

    // KVYO had name='KVYO', should be enriched to Klaviyo, Inc.
    const kvyo = results.find(r => r.symbol === 'KVYO');
    expect(kvyo?.name).toBe('Klaviyo, Inc.');

    // AAPL had name='', should be enriched to Apple Inc.
    const aapl = results.find(r => r.symbol === 'AAPL');
    expect(aapl?.name).toBe('Apple Inc.');

    // TSLA already had good name, should be preserved
    const tsla = results.find(r => r.symbol === 'TSLA');
    expect(tsla?.name).toBe('Tesla, Inc.');
  });

  it('falls back to known company universe when backend returns empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });
    global.fetch = mockFetch;

    const results = await marketDataService.searchSymbols('Cameco');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe('CCJ');
    expect(results[0].name).toBe('Cameco Corporation');
  });
});
