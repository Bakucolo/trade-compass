import { describe, it, expect } from 'vitest';
import { SCANNER_UNIVERSE } from '../../server/services/stockScannerService';

describe('Multi-Factor Stock Scanner Universe & Filters', () => {
  it('should maintain a comprehensive universe of equities across diverse sectors and themes', () => {
    expect(SCANNER_UNIVERSE.length).toBeGreaterThanOrEqual(40);

    const sectors = new Set(SCANNER_UNIVERSE.map((s) => s.sector));
    expect(sectors.has('Technology')).toBe(true);
    expect(sectors.has('Healthcare')).toBe(true);
    expect(sectors.has('Energy')).toBe(true);
    expect(sectors.has('Financials')).toBe(true);
    expect(sectors.has('Industrials')).toBe(true);
    expect(sectors.has('Consumer Staples')).toBe(true);
    expect(sectors.has('Materials')).toBe(true);
  });

  it('should have unique ticker symbols in the scanner universe', () => {
    const symbols = SCANNER_UNIVERSE.map((s) => s.symbol);
    const uniqueSymbols = new Set(symbols);
    expect(uniqueSymbols.size).toBe(symbols.length);
  });

  it('should include high-priority themes like AI & Compute, Nuclear Energy, Cybersecurity, and Dividend Aristocrats', () => {
    const allThemes = new Set<string>();
    SCANNER_UNIVERSE.forEach((item) => {
      item.themes.forEach((t) => allThemes.add(t));
    });

    expect(allThemes.has('AI & Compute')).toBe(true);
    expect(allThemes.has('Nuclear Energy')).toBe(true);
    expect(allThemes.has('Cybersecurity')).toBe(true);
    expect(allThemes.has('Dividend Aristocrat')).toBe(true);
  });

  it('should map symbols correctly to their respective sectors and themes', () => {
    const nvda = SCANNER_UNIVERSE.find((s) => s.symbol === 'NVDA');
    expect(nvda).toBeDefined();
    expect(nvda?.sector).toBe('Technology');
    expect(nvda?.themes).toContain('AI & Compute');

    const ccj = SCANNER_UNIVERSE.find((s) => s.symbol === 'CCJ');
    expect(ccj).toBeDefined();
    expect(ccj?.sector).toBe('Energy');
    expect(ccj?.themes).toContain('Nuclear Energy');
  });
});
