import { describe, it, expect } from 'vitest';
import {
  calculateShortOptionDefenseLevels,
  parseOccSymbol,
  extractShortOptionDetails,
} from '../../server/services/shortOptionAlertService';

describe('Short Option Defense Proximity Alerts Engine', () => {
  describe('calculateShortOptionDefenseLevels', () => {
    it('should calculate 5% and 10% below strike triggers for Short Put positions', () => {
      // Strike = $100 Put
      // Danger is when stock price drops down towards strike
      // 10% warning trigger: $100 * 1.10 = $110.00 (Condition: BELOW)
      // 5% critical trigger: $100 * 1.05 = $105.00 (Condition: BELOW)
      const levels = calculateShortOptionDefenseLevels(100, 'PUT');

      expect(levels.strikePrice).toBe(100);
      expect(levels.optionType).toBe('PUT');

      expect(levels.warning10Pct.targetPrice).toBe(110);
      expect(levels.warning10Pct.condition).toBe('BELOW');
      expect(levels.warning10Pct.bufferPct).toBe(10);

      expect(levels.critical5Pct.targetPrice).toBe(105);
      expect(levels.critical5Pct.condition).toBe('BELOW');
      expect(levels.critical5Pct.bufferPct).toBe(5);
    });

    it('should calculate 5% and 10% above strike triggers for Short Call positions', () => {
      // Strike = $200 Call
      // Danger is when stock price rises up towards strike
      // 10% warning trigger: $200 * 0.90 = $180.00 (Condition: ABOVE)
      // 5% critical trigger: $200 * 0.95 = $190.00 (Condition: ABOVE)
      const levels = calculateShortOptionDefenseLevels(200, 'CALL');

      expect(levels.strikePrice).toBe(200);
      expect(levels.optionType).toBe('CALL');

      expect(levels.warning10Pct.targetPrice).toBe(180);
      expect(levels.warning10Pct.condition).toBe('ABOVE');
      expect(levels.warning10Pct.bufferPct).toBe(10);

      expect(levels.critical5Pct.targetPrice).toBe(190);
      expect(levels.critical5Pct.condition).toBe('ABOVE');
      expect(levels.critical5Pct.bufferPct).toBe(5);
    });

    it('should handle fractional strikes and round to 2 decimal places correctly', () => {
      // Strike = $12.50 Put
      // 10% target = 12.5 * 1.10 = 13.75
      // 5% target = 12.5 * 1.05 = 13.125 -> 13.13
      const putLevels = calculateShortOptionDefenseLevels(12.5, 'P');
      expect(putLevels.warning10Pct.targetPrice).toBe(13.75);
      expect(putLevels.critical5Pct.targetPrice).toBe(13.13);
      expect(putLevels.warning10Pct.condition).toBe('BELOW');

      // Strike = $33.33 Call
      // 10% target = 33.33 * 0.90 = 29.997 -> 30.00
      // 5% target = 33.33 * 0.95 = 31.6635 -> 31.66
      const callLevels = calculateShortOptionDefenseLevels(33.33, 'C');
      expect(callLevels.warning10Pct.targetPrice).toBe(30);
      expect(callLevels.critical5Pct.targetPrice).toBe(31.66);
      expect(callLevels.warning10Pct.condition).toBe('ABOVE');
    });
  });

  describe('parseOccSymbol', () => {
    it('should parse standard OCC option ticker strings accurately', () => {
      const parsedPut = parseOccSymbol('FLNC  260821P00013000');
      expect(parsedPut.underlying).toBe('FLNC');
      expect(parsedPut.expiryDate).toBe('2026-08-21');
      expect(parsedPut.optionType).toBe('PUT');
      expect(parsedPut.strikePrice).toBe(13);

      const parsedCall = parseOccSymbol('NVDA260918C00125500');
      expect(parsedCall.underlying).toBe('NVDA');
      expect(parsedCall.expiryDate).toBe('2026-09-18');
      expect(parsedCall.optionType).toBe('CALL');
      expect(parsedCall.strikePrice).toBe(125.5);
    });
  });

  describe('extractShortOptionDetails', () => {
    it('should return null for long options (quantity > 0)', () => {
      const holding = {
        assetType: 'OPTION',
        quantity: 2,
        symbol: 'AAPL 260918C240',
        strikePrice: 240,
        optionType: 'CALL'
      };
      expect(extractShortOptionDetails(holding)).toBeNull();
    });

    it('should return null for equity positions', () => {
      const holding = {
        assetType: 'EQUITY',
        quantity: -100,
        symbol: 'TSLA'
      };
      expect(extractShortOptionDetails(holding)).toBeNull();
    });

    it('should extract parameters from normalized short option holding', () => {
      const holding = {
        assetType: 'OPTION',
        quantity: -1,
        symbol: 'NVDA',
        underlyingSymbol: 'NVDA',
        strikePrice: 120,
        optionType: 'PUT',
        expiryDate: '2026-08-21'
      };

      const extracted = extractShortOptionDetails(holding);
      expect(extracted).not.toBeNull();
      expect(extracted?.underlyingSymbol).toBe('NVDA');
      expect(extracted?.strikePrice).toBe(120);
      expect(extracted?.optionType).toBe('PUT');
      expect(extracted?.expiryDate).toBe('2026-08-21');
    });

    it('should fallback to OCC symbol parsing when option fields are in raw symbol string', () => {
      const holding = {
        assetType: 'OPTION',
        quantity: -3,
        symbol: 'PLTR  261016C00035000',
        brokerSpecificId: 'PLTR  261016C00035000'
      };

      const extracted = extractShortOptionDetails(holding);
      expect(extracted).not.toBeNull();
      expect(extracted?.underlyingSymbol).toBe('PLTR');
      expect(extracted?.strikePrice).toBe(35);
      expect(extracted?.optionType).toBe('CALL');
    });
  });
});
