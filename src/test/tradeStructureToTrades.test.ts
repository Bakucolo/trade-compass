import { describe, it, expect } from 'vitest';
import { buildTradesFromApproach } from '@/components/TradeStructureModal';
import { StructuredTradeApproach } from '@/services/ideaService';

describe('buildTradesFromApproach', () => {
  it('converts OUTRIGHT STOCK approach into equity trade', () => {
    const stockApproach: StructuredTradeApproach = {
      id: 'app_stock_1',
      category: 'STOCK',
      title: 'Core Stock Accumulation',
      subtitle: 'Spot equity entry with trailing stop',
      suitability: 'Balanced Core',
      sentiment: 'BULLISH',
      primaryEntry: 125.50,
      scaledEntryMin: 122.00,
      scaledEntryMax: 125.50,
      targetPrice: 150.00,
      target2Price: 165.00,
      stopLoss: 115.00,
      capitalRequiredEstimate: '$12,550',
      maxProfit: '$2,450',
      maxRisk: '$1,050',
      riskRewardRatio: '2.3:1',
      winProbabilityEstimate: 68,
      executionRules: ['Scale into 100 shares at support'],
      invalidationTrigger: 'Close below $115',
      profitTakingPlan: 'Take 50% profit at $150',
    };

    const trades = buildTradesFromApproach(stockApproach, 'NVDA', 'AI Semiconductor Thesis');

    expect(trades).toHaveLength(1);
    const trade = trades[0];
    expect(trade.symbol).toBe('NVDA');
    expect(trade.assetType).toBe('EQUITY');
    expect(trade.side).toBe('BUY');
    expect(trade.action).toBe('BUY');
    expect(trade.positionEffect).toBe('LONG');
    expect(trade.price).toBe(125.50);
    expect(trade.quantity).toBe(100);
    expect(trade.broker).toBe('Manual');
    expect(trade.description).toContain('Core Stock Accumulation');
    expect(trade.description).toContain('Target: $150');
  });

  it('converts OPTIONS_LONG LEAP Call approach into option trade record', () => {
    const leapCallApproach: StructuredTradeApproach = {
      id: 'app_leap_1',
      category: 'OPTIONS_LONG',
      title: 'Deep In-The-Money LEAP Call',
      subtitle: 'High delta 180 DTE replacement for stock',
      suitability: 'Capital Efficient / Leveraged',
      sentiment: 'BULLISH',
      primaryEntry: 125.00,
      scaledEntryMin: 120.00,
      scaledEntryMax: 125.00,
      targetPrice: 160.00,
      stopLoss: 110.00,
      optionDetails: {
        strategyName: 'LEAP Call (0.80 Delta)',
        recommendedDte: 180,
        expiryDescription: '~6 Months (180 DTE)',
        longStrike: 110.00,
        estimatedCost: 22.50,
        isCredit: false,
        breakEvenPrice: 132.50,
      },
      capitalRequiredEstimate: '$2,250',
      maxProfit: 'Uncapped',
      maxRisk: '$2,250',
      riskRewardRatio: '3.5:1',
      winProbabilityEstimate: 72,
      executionRules: ['Buy 110 Strike Call'],
      invalidationTrigger: 'Spot break below $110',
      profitTakingPlan: 'Scale out at $160 spot',
    };

    const trades = buildTradesFromApproach(leapCallApproach, 'NVDA');

    expect(trades).toHaveLength(1);
    const trade = trades[0];
    expect(trade.underlyingSymbol).toBe('NVDA');
    expect(trade.assetType).toBe('OPTION');
    expect(trade.optionType).toBe('CALL');
    expect(trade.strikePrice).toBe(110.00);
    expect(trade.side).toBe('BUY');
    expect(trade.action).toBe('BUY_TO_OPEN');
    expect(trade.positionEffect).toBe('LONG');
    expect(trade.price).toBe(22.50);
    expect(trade.totalValue).toBe(2250);
    expect(trade.valueEffect).toBe('DEBIT');
    expect(trade.description).toContain('Deep In-The-Money LEAP Call');
  });

  it('converts SHORT_PUT Cash-Secured Put into credit option trade record', () => {
    const cspApproach: StructuredTradeApproach = {
      id: 'app_csp_1',
      category: 'SHORT_PUT',
      title: 'Cash-Secured Put Income',
      subtitle: 'Collect premium or acquire shares at discount',
      suitability: 'Conservative / Income',
      sentiment: 'BULLISH',
      primaryEntry: 30.00,
      scaledEntryMin: 28.00,
      scaledEntryMax: 30.00,
      targetPrice: 35.00,
      stopLoss: 24.00,
      optionDetails: {
        strategyName: '30-45 DTE Cash Secured Put',
        recommendedDte: 45,
        expiryDescription: '45 DTE',
        putStrike: 27.50,
        estimatedCost: 1.85,
        isCredit: true,
        breakEvenPrice: 25.65,
      },
      capitalRequiredEstimate: '$2,750',
      maxProfit: '$185',
      maxRisk: '$2,565',
      riskRewardRatio: 'N/A',
      winProbabilityEstimate: 80,
      executionRules: ['Sell $27.50 Put'],
      invalidationTrigger: 'Fundamental collapse',
      profitTakingPlan: 'Buy to close at 50% max profit ($0.92)',
    };

    const trades = buildTradesFromApproach(cspApproach, 'OSCR');

    expect(trades).toHaveLength(1);
    const trade = trades[0];
    expect(trade.underlyingSymbol).toBe('OSCR');
    expect(trade.assetType).toBe('OPTION');
    expect(trade.optionType).toBe('PUT');
    expect(trade.strikePrice).toBe(27.50);
    expect(trade.side).toBe('SELL');
    expect(trade.action).toBe('SELL_TO_OPEN');
    expect(trade.positionEffect).toBe('SHORT');
    expect(trade.quantity).toBe(-1);
    expect(trade.price).toBe(1.85);
    expect(trade.totalValue).toBe(185);
    expect(trade.valueEffect).toBe('CREDIT');
  });

  it('converts COVERED_CALL into 2 legs (Stock + Short Call)', () => {
    const ccApproach: StructuredTradeApproach = {
      id: 'app_cc_1',
      category: 'COVERED_CALL',
      title: 'Buy-Write Covered Call',
      subtitle: '100 shares + 30 DTE OTM Call sale',
      suitability: 'Conservative / Income',
      sentiment: 'BULLISH',
      primaryEntry: 50.00,
      scaledEntryMin: 48.00,
      scaledEntryMax: 50.00,
      targetPrice: 55.00,
      stopLoss: 44.00,
      optionDetails: {
        strategyName: 'Covered Call (Buy-Write)',
        recommendedDte: 30,
        expiryDescription: '30 DTE',
        callStrike: 55.00,
        estimatedCost: 1.60,
        isCredit: true,
        breakEvenPrice: 48.40,
      },
      capitalRequiredEstimate: '$5,000',
      maxProfit: '$660',
      maxRisk: '$4,840',
      riskRewardRatio: '1.2:1',
      winProbabilityEstimate: 75,
      executionRules: ['Buy 100 shares', 'Sell 1x $55 Call'],
      invalidationTrigger: 'Stop loss at $44',
      profitTakingPlan: 'Hold to expiration or roll call',
    };

    const trades = buildTradesFromApproach(ccApproach, 'CCJ');

    expect(trades).toHaveLength(2);
    // Leg 1: Stock
    expect(trades[0].assetType).toBe('EQUITY');
    expect(trades[0].side).toBe('BUY');
    expect(trades[0].quantity).toBe(100);
    expect(trades[0].price).toBe(50.00);

    // Leg 2: Short Call
    expect(trades[1].assetType).toBe('OPTION');
    expect(trades[1].optionType).toBe('CALL');
    expect(trades[1].strikePrice).toBe(55.00);
    expect(trades[1].side).toBe('SELL');
    expect(trades[1].action).toBe('SELL_TO_OPEN');
    expect(trades[1].positionEffect).toBe('SHORT');
    expect(trades[1].quantity).toBe(-1);
    expect(trades[1].price).toBe(1.60);
    expect(trades[1].valueEffect).toBe('CREDIT');
  });

  it('converts COLLAR into 3 legs (Stock + Long Put Floor + Short Call Ceiling)', () => {
    const collarApproach: StructuredTradeApproach = {
      id: 'app_col_1',
      category: 'COLLAR',
      title: 'Full Capital Preservation Collar',
      subtitle: 'Stock with funded zero-cost protective put floor',
      suitability: 'Defined Risk / Hedged',
      sentiment: 'BULLISH',
      primaryEntry: 100.00,
      scaledEntryMin: 98.00,
      scaledEntryMax: 100.00,
      targetPrice: 110.00,
      stopLoss: 90.00,
      optionDetails: {
        strategyName: 'Collar (Zero-Cost / Defined Risk)',
        recommendedDte: 60,
        expiryDescription: '60 DTE',
        putStrike: 92.00,
        callStrike: 108.00,
        estimatedCost: 0,
        isCredit: false,
        breakEvenPrice: 100.00,
      },
      capitalRequiredEstimate: '$10,000',
      maxProfit: '$800',
      maxRisk: '$800',
      riskRewardRatio: '1:1',
      winProbabilityEstimate: 65,
      executionRules: ['Buy 100 shares', 'Buy $92 Put', 'Sell $108 Call'],
      invalidationTrigger: 'Put exercised at $92 floor',
      profitTakingPlan: 'Shares called away at $108',
    };

    const trades = buildTradesFromApproach(collarApproach, 'AAPL');

    expect(trades).toHaveLength(3);
    // Leg 1: Long Stock
    expect(trades[0].assetType).toBe('EQUITY');
    expect(trades[0].quantity).toBe(100);

    // Leg 2: Long Put Floor
    expect(trades[1].assetType).toBe('OPTION');
    expect(trades[1].optionType).toBe('PUT');
    expect(trades[1].strikePrice).toBe(92.00);
    expect(trades[1].side).toBe('BUY');
    expect(trades[1].action).toBe('BUY_TO_OPEN');

    // Leg 3: Short Call Ceiling
    expect(trades[2].assetType).toBe('OPTION');
    expect(trades[2].optionType).toBe('CALL');
    expect(trades[2].strikePrice).toBe(108.00);
    expect(trades[2].side).toBe('SELL');
    expect(trades[2].action).toBe('SELL_TO_OPEN');
  });

  it('converts SPREAD into 2 option legs (Long Leg + Short Leg)', () => {
    const spreadApproach: StructuredTradeApproach = {
      id: 'app_spr_1',
      category: 'SPREAD',
      title: 'Bull Call Vertical Spread',
      subtitle: 'Defined risk debit spread for leveraged upside',
      suitability: 'Defined Risk / Hedged',
      sentiment: 'BULLISH',
      primaryEntry: 130.00,
      scaledEntryMin: 128.00,
      scaledEntryMax: 130.00,
      targetPrice: 145.00,
      stopLoss: 122.00,
      optionDetails: {
        strategyName: 'Bull Call Debit Spread',
        recommendedDte: 45,
        expiryDescription: '45 DTE',
        longStrike: 130.00,
        shortStrike: 145.00,
        estimatedCost: 4.50,
        isCredit: false,
        breakEvenPrice: 134.50,
      },
      capitalRequiredEstimate: '$450',
      maxProfit: '$1,050',
      maxRisk: '$450',
      riskRewardRatio: '2.3:1',
      winProbabilityEstimate: 62,
      executionRules: ['Buy $130 Call', 'Sell $145 Call'],
      invalidationTrigger: 'Break below $122',
      profitTakingPlan: 'Close spread at 80% max profit ($12.00 value)',
    };

    const trades = buildTradesFromApproach(spreadApproach, 'NVDA');

    expect(trades).toHaveLength(2);
    // Long Leg
    expect(trades[0].assetType).toBe('OPTION');
    expect(trades[0].optionType).toBe('CALL');
    expect(trades[0].strikePrice).toBe(130.00);
    expect(trades[0].action).toBe('BUY_TO_OPEN');
    expect(trades[0].side).toBe('BUY');

    // Short Leg
    expect(trades[1].assetType).toBe('OPTION');
    expect(trades[1].optionType).toBe('CALL');
    expect(trades[1].strikePrice).toBe(145.00);
    expect(trades[1].action).toBe('SELL_TO_OPEN');
    expect(trades[1].side).toBe('SELL');
  });
});
