import { describe, it, expect, vi } from 'vitest';
import { researchThematicStocks } from '../../server/services/thematicWatchlistService';

describe('Thematic Watchlist AI Agent Service', () => {
  it('should reject empty or whitespace-only topics', async () => {
    await expect(researchThematicStocks({ topic: '   ' })).rejects.toThrow(
      'Watchlist topic or name cannot be empty.'
    );
  });

  it('should research and return high-conviction thematic candidates for "Semiconductors"', async () => {
    const result = await researchThematicStocks({
      topic: 'Semiconductors',
      count: 6,
    });

    expect(result).toBeDefined();
    expect(result.topic).toBe('Semiconductors');
    expect(result.refinedTopicName).toBeTruthy();
    expect(result.themeDescription).toBeTruthy();
    expect(result.keyDrivers.length).toBeGreaterThanOrEqual(2);
    expect(result.stocks.length).toBeGreaterThanOrEqual(4);

    // Verify stock structure
    result.stocks.forEach((stock) => {
      expect(stock.symbol).toMatch(/^[A-Z0-9.-]+$/);
      expect(stock.companyName).toBeTruthy();
      expect(stock.thesis).toBeTruthy();
      expect(stock.isAlreadyInWatchlist).toBe(false);
    });

    // Known semiconductor leaders should be present
    const symbols = result.stocks.map((s) => s.symbol);
    const hasCoreSemi = symbols.includes('NVDA') || symbols.includes('TSM') || symbols.includes('ASML') || symbols.includes('AMD');
    expect(hasCoreSemi).toBe(true);
  });

  it('should research and return candidates for "Nuclear Energy"', async () => {
    const result = await researchThematicStocks({
      topic: 'Nuclear Energy',
      count: 6,
    });

    expect(result).toBeDefined();
    expect(result.stocks.length).toBeGreaterThanOrEqual(4);

    const symbols = result.stocks.map((s) => s.symbol);
    const hasNuclear = symbols.includes('CCJ') || symbols.includes('CEG') || symbols.includes('SMR') || symbols.includes('VST');
    expect(hasNuclear).toBe(true);
  });

  it('should flag existing symbols as isAlreadyInWatchlist', async () => {
    const existing = ['NVDA', 'TSM'];
    const result = await researchThematicStocks({
      topic: 'Semiconductors',
      existingSymbols: existing,
    });

    result.stocks.forEach((stock) => {
      if (existing.includes(stock.symbol)) {
        expect(stock.isAlreadyInWatchlist).toBe(true);
      } else {
        expect(stock.isAlreadyInWatchlist).toBe(false);
      }
    });
  });

  it('should return valid data for novel themes via fallback knowledge base or LLM', async () => {
    const result = await researchThematicStocks({
      topic: 'Cybersecurity & Zero Trust',
      count: 5,
    });

    expect(result.stocks.length).toBeGreaterThanOrEqual(3);
    const symbols = result.stocks.map((s) => s.symbol);
    const hasCyber = symbols.includes('CRWD') || symbols.includes('PANW') || symbols.includes('FTNT') || symbols.includes('ZS');
    expect(hasCyber).toBe(true);
  });
});
