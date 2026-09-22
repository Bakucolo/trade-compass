// src/test/buyingPowerAnalyser.test.ts
// Unit test suite for Buying Power & Margin Analysis Service (Tastytrade vs. IBKR)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateBuyingPowerComparison } from '../../server/services/buyingPowerService';
import { stageDraftOrder, switchDraftBroker, getDraftOrder } from '../../server/services/tastytradeToolService';

describe('Buying Power & Margin Calculation Engine (Tastytrade vs IBKR)', () => {
  it('calculates buying power for stock purchases: 50 shares of AAPL at $200', async () => {
    const result = await calculateBuyingPowerComparison({
      symbol: 'AAPL',
      action: 'BUY',
      quantity: 50,
      price: 200.0,
      orderType: 'Limit',
      instrumentType: 'Equity'
    });

    // Notional = 50 * 200 = 10,000
    // Reg-T Margin = 50% = 5,000
    // Maintenance = 25% = 2,500
    expect(result.symbol).toBe('AAPL');
    expect(result.quantity).toBe(50);
    expect(result.tastytrade.buyingPowerRequirement).toBe(5000);
    expect(result.tastytrade.initialMarginRequirement).toBe(5000);
    expect(result.tastytrade.maintenanceMarginRequirement).toBe(2500);
    expect(result.tastytrade.estimatedCommission).toBe(0.0); // Tastytrade stock is $0

    expect(result.ibkr.buyingPowerRequirement).toBe(5000);
    expect(result.ibkr.initialMarginRequirement).toBe(5000);
    expect(result.ibkr.maintenanceMarginRequirement).toBe(2500);
    // IBKR stock commission: 50 * $0.005 = $0.25, minimum $1.00
    expect(result.ibkr.estimatedCommission).toBe(1.0);

    // Tastytrade is the fee winner on equity purchases
    expect(result.verdict.feeWinner).toBe('tastytrade');
    expect(result.verdict.feeDifference).toBeLessThan(0); // tasty is cheaper
  });

  it('calculates buying power for small options order (5 contracts): IBKR is fee winner', async () => {
    const result = await calculateBuyingPowerComparison({
      symbol: 'SPY',
      action: 'BUY_TO_OPEN',
      quantity: 5,
      price: 3.0,
      orderType: 'Limit',
      instrumentType: 'Equity Option',
      optionDetails: {
        expirationDate: '2026-10-16',
        strikePrice: 560,
        optionType: 'Call'
      }
    });

    // Notional = 5 * 3.0 * 100 = $1,500. Long options are 100% cash requirement
    expect(result.tastytrade.buyingPowerRequirement).toBe(1500);
    expect(result.ibkr.buyingPowerRequirement).toBe(1500);

    // Commission comparison:
    // Tastytrade: 5 * $1.00 = $5.00 open ($0 close)
    // IBKR: 5 * $0.65 = $3.25 open
    expect(result.tastytrade.estimatedCommission).toBe(5.0);
    expect(result.ibkr.estimatedCommission).toBe(3.25);
    expect(result.verdict.feeWinner).toBe('ibkr');
  });

  it('calculates buying power for large options order (15 contracts): Tastytrade $10 leg cap applies', async () => {
    const result = await calculateBuyingPowerComparison({
      symbol: 'TSLA',
      action: 'BUY_TO_OPEN',
      quantity: 15,
      price: 2.50,
      orderType: 'Limit',
      instrumentType: 'Equity Option'
    });

    // 15 contracts:
    // Tastytrade: $1.00 per contract capped at $10.00 max per leg
    expect(result.tastytrade.estimatedCommission).toBe(10.0);

    // IBKR: 15 * $0.65 = $9.75 open.
    // However, roundtrip Tasty is $10.00 total ($0 to close), whereas IBKR is $9.75 + $9.75 = $19.50.
    // Open fee difference is $10 - $9.75 = $0.25, but summary notes the $10 cap benefit
    expect(result.tastytrade.warnings.some(w => w.includes('cap applies'))).toBe(true);
    expect(result.verdict.rationale.some(r => r.includes('cap'))).toBe(true);
  });

  it('stages draft order with attached buyingPowerComparison telemetry', async () => {
    const draft = await stageDraftOrder({
      symbol: 'AAPL',
      action: 'BUY',
      quantity: 20,
      orderType: 'Limit',
      price: 220.0,
      broker: 'tastytrade'
    });

    expect(draft.draftId).toBeDefined();
    expect(draft.buyingPowerComparison).toBeDefined();
    expect(draft.buyingPowerComparison?.symbol).toBe('AAPL');
    expect(draft.buyingPowerComparison?.tastytrade.buyingPowerRequirement).toBe(2200); // 50% of 4400
    expect(draft.buyingPowerComparison?.ibkr.buyingPowerRequirement).toBe(2200);
  });

  it('switches draft broker from tastytrade to ibkr and recalculates margin impact', async () => {
    const draft = await stageDraftOrder({
      symbol: 'NVDA',
      action: 'BUY',
      quantity: 10,
      orderType: 'Limit',
      price: 120.0,
      broker: 'tastytrade'
    });

    expect(draft.broker).toBe('tastytrade');
    expect(draft.accountNumber).toBe('5WT67220');

    // Switch broker to IBKR
    const switched = await switchDraftBroker(draft.draftId, 'ibkr');

    expect(switched.broker).toBe('ibkr');
    expect(switched.accountNumber).toBe('U15491236');
    expect(switched.buyingPowerComparison).toBeDefined();
    expect(switched.dryRunResult?.estimatedCommission).toBe(1.0); // IBKR min commission $1.00
    expect(switched.dryRunResult?.warnings.some(w => w.includes('Re-routed to IBKR'))).toBe(true);

    // Staged drafts registry reflects the change
    const retrieved = getDraftOrder(draft.draftId);
    expect(retrieved?.broker).toBe('ibkr');
  });

  it('accurately calculates exact Tastytrade $6,776.00 BP Effect and IBKR margin for AAPL 340 Put STO @ $3.00', async () => {
    const result = await calculateBuyingPowerComparison({
      symbol: 'AAPL',
      action: 'SELL_TO_OPEN',
      quantity: 1,
      price: 3.00,
      orderType: 'Limit',
      instrumentType: 'Equity Option',
      optionDetails: {
        expirationDate: '2026-09-23',
        strikePrice: 340.00,
        optionType: 'Put'
      },
      underlyingPrice: 338.80,
      daysToExpiration: 2,
      delta: -0.5744,
      theta: -0.65055
    });

    // 1. Tastytrade Buying Power Effect
    // Underlying = $338.80, Strike = $340.00 (Put is ITM, OTM = 0)
    // Rule 1: 0.20 * 338.80 * 100 + 300 = 6,776.00 + 300 = 7,076.00
    // Rule 2: 0.10 * 340.00 * 100 + 300 = 3,400.00 + 300 = 3,700.00
    // Margin Requirement = $7,076.00
    // Buying Power Effect = Margin - Premium = 7,076.00 - 300.00 = $6,776.00 db
    expect(result.tastytrade.buyingPowerRequirement).toBe(6776.00);
    expect(result.tastytrade.initialMarginRequirement).toBe(7076.00);
    expect(result.tastytrade.buyingPowerEffect).toBe(6776.00);
    expect(result.tastytrade.estimatedCommission).toBe(1.00);

    // 2. IBKR Margin (Initial Margin upfront, Maint & Portfolio Margin)
    expect(result.ibkr.accountNumber).toBe('U15491236');
    expect(result.ibkr.environment).toBe('Live Margin');
    expect(result.ibkr.baseCurrency).toBe('GBP');
    expect(result.ibkr.buyingPowerRequirement).toBe(7076.00);
    expect(result.ibkr.initialMarginRequirement).toBe(7076.00);
    expect(result.ibkr.initialMarginRequirementBase).toBe(Math.round(7076 / 1.3351));
    expect(result.ibkr.maintenanceMarginRequirement).toBe(3688.00); // 10% spot (3,388) + 300
    expect(result.ibkr.portfolioMarginRequirement).toBe(5082.00); // 15% spot (5,082)
    expect(result.ibkr.estimatedCommission).toBe(0.65);

    // 3. Signature Tastytrade Quantitative Metrics
    expect(result.tastyMetrics).toBeDefined();
    expect(result.tastyMetrics?.bpEff).toBe(6776.00);
    expect(result.tastyMetrics?.bpEffDirection).toBe('db');
    expect(result.tastyMetrics?.maxProfit).toBe(300);
    expect(result.tastyMetrics?.maxLoss).toBe(33700);
    expect(result.tastyMetrics?.delta).toBe(57.44); // Short put has positive shares delta
    expect(result.tastyMetrics?.theta).toBe(65.055); // Short put has positive carry
    expect(result.tastyMetrics?.pop).toBeGreaterThanOrEqual(55); // ~60-65%
    expect(result.tastyMetrics?.p50).toBeGreaterThanOrEqual(40); // ~43-48%
  });

  it('accurately calculates exact IBKR 5,667 GBP margin impact for 1 AAPL Oct16 26 340 Put STO @ $7.90 matching live order preview', async () => {
    const result = await calculateBuyingPowerComparison({
      symbol: 'AAPL',
      action: 'SELL_TO_OPEN',
      quantity: 1,
      price: 7.90,
      orderType: 'Limit',
      instrumentType: 'Equity Option',
      optionDetails: {
        expirationDate: '2026-10-16',
        strikePrice: 340.00,
        optionType: 'Put'
      },
      underlyingPrice: 338.80,
      daysToExpiration: 24,
      delta: -0.58,
      theta: -0.42
    });

    // Verify IBKR Live Margin Account & Base Currency
    expect(result.ibkr.accountNumber).toBe('U15491236');
    expect(result.ibkr.environment).toBe('Live Margin');
    expect(result.ibkr.baseCurrency).toBe('GBP');

    // Reg-T Margin in USD = 0.20 * 338.80 * 100 + 790 = 6,776 + 790 = $7,566.00 USD
    expect(result.ibkr.initialMarginRequirement).toBe(7566.00);

    // Margin in Base Currency (GBP @ FX 1.3351) = Math.round(7566 / 1.3351) = 5,667 GBP!
    // Matches user IBKR Order Preview: "Initial Margin Change: 5,667"
    expect(result.ibkr.initialMarginRequirementBase).toBe(5667);
    expect(result.ibkr.estimatedCommission).toBe(0.65);
  });

  it('accurately calculates exact Tastytrade $2,390.00 BP Effect and metrics for FSLY 25 Put STO @ $1.10 (100% margin symbol)', async () => {
    const result = await calculateBuyingPowerComparison({
      symbol: 'FSLY',
      action: 'SELL_TO_OPEN',
      quantity: 1,
      price: 1.10,
      orderType: 'Limit',
      instrumentType: 'Equity Option',
      optionDetails: {
        expirationDate: '2026-10-16',
        strikePrice: 25.00,
        optionType: 'Put'
      },
      underlyingPrice: 27.41,
      impliedVolatility: 0.92,
      daysToExpiration: 25,
      delta: -0.303,
      theta: -0.04394
    });

    // 1. Tastytrade Buying Power Effect for FSLY (100% margin rate in Apex Clearing)
    // Strike = $25.00, Spot = $27.41, Credit = $1.10
    // Max Strike Capital = $2,500.00
    // Initial Margin Req = $2,500.00
    // Buying Power Effect = $2,500.00 - $110.00 = $2,390.00 db
    expect(result.tastytrade.buyingPowerRequirement).toBe(2390.00);
    expect(result.tastytrade.initialMarginRequirement).toBe(2500.00);
    expect(result.tastytrade.buyingPowerEffect).toBe(2390.00);
    expect(result.tastytrade.estimatedCommission).toBe(1.00);

    // 2. Tastytrade Quant Ribbon Metrics
    expect(result.tastyMetrics).toBeDefined();
    expect(result.tastyMetrics?.bpEff).toBe(2390.00);
    expect(result.tastyMetrics?.bpEffDirection).toBe('db');
    expect(result.tastyMetrics?.maxProfit).toBe(110.00);
    expect(result.tastyMetrics?.maxLoss).toBe(2390.00);
    expect(result.tastyMetrics?.ext).toBe(110.00);
    expect(result.tastyMetrics?.pop).toBe(67);
    expect(result.tastyMetrics?.p50).toBe(78);
    expect(result.tastyMetrics?.delta).toBe(30.3);
    expect(result.tastyMetrics?.theta).toBe(4.394);
    expect(result.tastyMetrics?.cvar).toBeCloseTo(-684.31, 0);
  });
});

