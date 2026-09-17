import { describe, it, expect, beforeEach } from 'vitest';
import { aiTradingGuardrails } from '../../server/services/aiTradingGuardrails';

describe('aiTradingGuardrails - Strict User Position Sizing Enforcement', () => {
  beforeEach(() => {
    aiTradingGuardrails.saveSettings({
      masterKillSwitch: false,
      sizingMode: 'FIXED_DOLLAR',
      fixedDollarAmount: 1000,
      portfolioPercent: 5.0,
      fixedShares: 10,
      maxSinglePositionDollar: 5000,
      maxOpenPositions: 5,
      defaultStopLossPercent: 3.0,
      defaultTakeProfitPercent: 6.0,
      executionMode: 'MANUAL_APPROVAL',
      accountMode: 'PAPER',
    });
  });

  it('calculates correct share sizing for fixed dollar mode', () => {
    // $1,000 target / $200 stock price = 5 shares ($1,000 total)
    const result = aiTradingGuardrails.calculateOrderSizing({
      symbol: 'AAPL',
      currentPrice: 200,
      portfolioValue: 100000,
      buyingPower: 400000,
      currentOpenPositionsCount: 1,
    });

    expect(result.allowed).toBe(true);
    expect(result.shares).toBe(5);
    expect(result.estimatedDollarValue).toBe(1000);
    expect(result.stopLossPrice).toBe(194); // 200 * (1 - 0.03)
    expect(result.takeProfitPrice).toBe(212); // 200 * (1 + 0.06)
  });

  it('clamps order dollar value if user fixed size exceeds maxSinglePositionDollar', () => {
    aiTradingGuardrails.saveSettings({
      sizingMode: 'FIXED_DOLLAR',
      fixedDollarAmount: 8000,
      maxSinglePositionDollar: 5000,
    });

    const result = aiTradingGuardrails.calculateOrderSizing({
      symbol: 'NVDA',
      currentPrice: 100,
      portfolioValue: 100000,
      buyingPower: 400000,
      currentOpenPositionsCount: 0,
    });

    expect(result.allowed).toBe(true);
    // Should be clamped to max ceiling $5,000 -> 50 shares
    expect(result.shares).toBe(50);
    expect(result.estimatedDollarValue).toBe(5000);
    expect(result.sizingRuleApplied).toContain('Clamped to Max Ceiling');
  });

  it('calculates sizing based on percent of portfolio mode', () => {
    aiTradingGuardrails.saveSettings({
      sizingMode: 'PERCENT_OF_PORTFOLIO',
      portfolioPercent: 4.0, // 4% of $100,000 = $4,000
    });

    const result = aiTradingGuardrails.calculateOrderSizing({
      symbol: 'MSFT',
      currentPrice: 400,
      portfolioValue: 100000,
      buyingPower: 200000,
      currentOpenPositionsCount: 2,
    });

    expect(result.allowed).toBe(true);
    expect(result.shares).toBe(10); // $4,000 / $400 = 10 shares
    expect(result.estimatedDollarValue).toBe(4000);
  });

  it('strictly blocks orders when Master Kill Switch is active', () => {
    aiTradingGuardrails.saveSettings({
      masterKillSwitch: true,
    });

    const result = aiTradingGuardrails.calculateOrderSizing({
      symbol: 'AAPL',
      currentPrice: 200,
      portfolioValue: 100000,
      buyingPower: 400000,
      currentOpenPositionsCount: 0,
    });

    expect(result.allowed).toBe(false);
    expect(result.shares).toBe(0);
    expect(result.reason).toContain('Master Kill Switch is ACTIVE');
  });

  it('blocks new positions when maxOpenPositions is reached', () => {
    aiTradingGuardrails.saveSettings({
      maxOpenPositions: 3,
    });

    const result = aiTradingGuardrails.calculateOrderSizing({
      symbol: 'TSLA',
      currentPrice: 250,
      portfolioValue: 100000,
      buyingPower: 400000,
      currentOpenPositionsCount: 3,
      isExistingPosition: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Max open positions limit reached');
  });

  it('allows order if already an existing position even if maxOpenPositions is reached', () => {
    aiTradingGuardrails.saveSettings({
      maxOpenPositions: 3,
    });

    const result = aiTradingGuardrails.calculateOrderSizing({
      symbol: 'TSLA',
      currentPrice: 250,
      portfolioValue: 100000,
      buyingPower: 400000,
      currentOpenPositionsCount: 3,
      isExistingPosition: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.shares).toBeGreaterThan(0);
  });
});
