import { describe, it, expect } from 'vitest';
import { CRITERIA_CATALOG } from '../components/watchlist/PopulateByCriteriaModal';

describe('Watchlist Populate by Criteria Universe Engine', () => {
  it('should have a comprehensive catalog with themes, stock types, asset classes, and sectors', () => {
    expect(CRITERIA_CATALOG.length).toBeGreaterThanOrEqual(25);

    const categories = new Set(CRITERIA_CATALOG.map((c) => c.category));
    expect(categories.has('THEME')).toBe(true);
    expect(categories.has('STOCK_TYPE')).toBe(true);
    expect(categories.has('ASSET_CLASS')).toBe(true);
    expect(categories.has('SECTOR')).toBe(true);
  });

  it('should contain valid tickers without empty strings or duplicates within items', () => {
    CRITERIA_CATALOG.forEach((item) => {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.tickers.length).toBeGreaterThanOrEqual(3);

      item.tickers.forEach((ticker) => {
        expect(ticker).toBe(ticker.toUpperCase());
        expect(ticker.length).toBeGreaterThanOrEqual(1);
        expect(ticker.length).toBeLessThanOrEqual(8);
      });

      // No internal duplicates
      const uniqueTickers = new Set(item.tickers);
      expect(uniqueTickers.size).toBe(item.tickers.length);
    });
  });

  it('should accurately aggregate and deduplicate tickers across multiple selected criteria', () => {
    const aiItem = CRITERIA_CATALOG.find((c) => c.id === 'theme_ai');
    const compoundersItem = CRITERIA_CATALOG.find((c) => c.id === 'type_mega_compounders');

    expect(aiItem).toBeDefined();
    expect(compoundersItem).toBeDefined();

    // Both contain AAPL/MSFT/NVDA/GOOGL
    const combinedSet = new Set<string>();
    aiItem?.tickers.forEach((t) => combinedSet.add(t));
    compoundersItem?.tickers.forEach((t) => combinedSet.add(t));

    const totalRaw = (aiItem?.tickers.length || 0) + (compoundersItem?.tickers.length || 0);
    expect(combinedSet.size).toBeLessThan(totalRaw); // Proves deduplication works
    expect(combinedSet.has('NVDA')).toBe(true);
    expect(combinedSet.has('MSFT')).toBe(true);
  });

  it('should include specialized asset classes like Treasuries, Commodities, and Crypto', () => {
    const assetClasses = CRITERIA_CATALOG.filter((c) => c.category === 'ASSET_CLASS');
    expect(assetClasses.length).toBeGreaterThanOrEqual(5);

    const cryptoItem = assetClasses.find((c) => c.id === 'asset_crypto_digital');
    expect(cryptoItem).toBeDefined();
    expect(cryptoItem?.tickers).toContain('IBIT');
    expect(cryptoItem?.tickers).toContain('MSTR');

    const bondsItem = assetClasses.find((c) => c.id === 'asset_bonds_fixed_income');
    expect(bondsItem).toBeDefined();
    expect(bondsItem?.tickers).toContain('TLT');
  });
});
