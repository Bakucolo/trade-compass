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
    expect(switched.accountNumber).toBe('DU1234567');
    expect(switched.buyingPowerComparison).toBeDefined();
    expect(switched.dryRunResult?.estimatedCommission).toBe(1.0); // IBKR min commission $1.00
    expect(switched.dryRunResult?.warnings.some(w => w.includes('Re-routed to IBKR'))).toBe(true);

    // Staged drafts registry reflects the change
    const retrieved = getDraftOrder(draft.draftId);
    expect(retrieved?.broker).toBe('ibkr');
  });
});
