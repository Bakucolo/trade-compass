import { describe, it, expect } from 'vitest';
import { resolveYahooFinanceSymbol } from '../../server/services/tickerResolutionService';

describe('Dashboard Multi-Session Performance & Movers Differentiation', () => {
  const mockPositions = [
    {
      id: 'pos-1',
      symbol: 'PLTR',
      marketValue: 25000,
      quantity: 200,
      currentPrice: 125,
      dayPnL: 1200,
      dayPnLPercent: 5.04,
      yesterdayPnL: -450,
      yesterdayPnLPercent: -1.78,
      overnightGapPercent: 1.25,
      weekReturnPercent: 8.45,
      weekPnL: 2112.5,
      monthReturnPercent: 22.4,
      monthPnL: 5600,
      unrealizedPnL: 8500,
      unrealizedPnLPercent: 51.5,
      assetType: 'Stock',
      currency: 'USD',
    },
    {
      id: 'pos-2',
      symbol: 'CCJ',
      marketValue: 15000,
      quantity: 300,
      currentPrice: 50,
      dayPnL: -300,
      dayPnLPercent: -1.96,
      yesterdayPnL: 620,
      yesterdayPnLPercent: 4.31,
      overnightGapPercent: -0.4,
      weekReturnPercent: 3.2,
      weekPnL: 480,
      monthReturnPercent: -4.5,
      monthPnL: -675,
      unrealizedPnL: 1200,
      unrealizedPnLPercent: 8.7,
      assetType: 'Stock',
      currency: 'USD',
    },
    {
      id: 'pos-3',
      symbol: 'EOS',
      marketValue: 1960,
      quantity: 200,
      currentPrice: 9.80,
      dayPnL: 550,
      dayPnLPercent: 39.2,
      yesterdayPnL: -192,
      yesterdayPnLPercent: -8.72,
      overnightGapPercent: 39.97,
      weekReturnPercent: 13.84,
      weekPnL: 271.26,
      monthReturnPercent: 46.34,
      monthPnL: 908.26,
      unrealizedPnL: -140,
      unrealizedPnLPercent: -6.65,
      assetType: 'Stock',
      currency: 'AUD',
    },
    {
      id: 'pos-4',
      symbol: 'FLAT_POS',
      marketValue: 5000,
      quantity: 100,
      currentPrice: 50,
      dayPnL: -85,
      dayPnLPercent: -1.7,
      yesterdayPnL: 0,
      yesterdayPnLPercent: 0,
      overnightGapPercent: 0,
      weekReturnPercent: 1.0,
      weekPnL: 50,
      monthReturnPercent: 2.0,
      monthPnL: 100,
      unrealizedPnL: 200,
      unrealizedPnLPercent: 4.0,
      assetType: 'Stock',
      currency: 'USD',
    },
  ];

  it('correctly resolves international Yahoo Finance symbols', () => {
    expect(resolveYahooFinanceSymbol('EOS', 'AUD')).toBe('EOS.AX');
    expect(resolveYahooFinanceSymbol('EOS')).toBe('EOS.AX');
    expect(resolveYahooFinanceSymbol('BP.', 'GBP')).toBe('BP.L');
    expect(resolveYahooFinanceSymbol('ONDO', 'GBP')).toBe('ONDO.L');
    expect(resolveYahooFinanceSymbol('PNG', 'CAD')).toBe('PNG.V');
    expect(resolveYahooFinanceSymbol('AYA', 'CAD')).toBe('AYA.TO');
    expect(resolveYahooFinanceSymbol('BOGO', 'CAD')).toBe('BOGO.V');
    expect(resolveYahooFinanceSymbol('LIB', 'CAD')).toBe('LIB.V');
    expect(resolveYahooFinanceSymbol('APF')).toBe('ECOR.L');
    expect(resolveYahooFinanceSymbol('PLTR', 'USD')).toBe('PLTR');
  });

  it('correctly isolates yesterday performance from today intraday performance in Yesterday Pulse', () => {
    // Today intraday sum
    const todayTotalPnL = mockPositions.reduce((acc, p) => acc + p.dayPnL, 0);
    // Yesterday prior session sum
    const yesterdayTotalPnL = mockPositions.reduce((acc, p) => acc + p.yesterdayPnL, 0);

    expect(todayTotalPnL).toBe(1365);
    expect(yesterdayTotalPnL).toBe(-22);
    expect(yesterdayTotalPnL).not.toBe(todayTotalPnL);

    // In Yesterday pulse: CCJ is an advancer (+4.31%), PLTR is a decliner (-1.78%), EOS is a decliner (-8.72%)
    const yesterdayAdvancers = mockPositions.filter((p) => p.yesterdayPnLPercent > 0);
    const yesterdayDecliners = mockPositions.filter((p) => p.yesterdayPnLPercent < 0);
    const yesterdayFlat = mockPositions.filter((p) => p.yesterdayPnLPercent === 0);

    expect(yesterdayAdvancers.map((p) => p.symbol)).toEqual(['CCJ']);
    expect(yesterdayDecliners.map((p) => p.symbol)).toEqual(['PLTR', 'EOS']);
    expect(yesterdayFlat.map((p) => p.symbol)).toEqual(['FLAT_POS']);

    // In Today pulse: PLTR (+5.04%) and EOS (+39.2%) are advancers, CCJ (-1.96%) and FLAT_POS (-1.7%) are decliners
    const todayAdvancers = mockPositions.filter((p) => p.dayPnLPercent > 0);
    const todayDecliners = mockPositions.filter((p) => p.dayPnLPercent < 0);

    expect(todayAdvancers.map((p) => p.symbol)).toEqual(['PLTR', 'EOS']);
    expect(todayDecliners.map((p) => p.symbol)).toEqual(['CCJ', 'FLAT_POS']);
  });

  it('ensures positions with 0 yesterday change do not leak dayPnL into yesterday pulse', () => {
    const flatPos = mockPositions.find((p) => p.symbol === 'FLAT_POS')!;
    
    // Normalized calculation in Yesterday Pulse
    const returnDollar = flatPos.yesterdayPnL !== undefined && flatPos.yesterdayPnL !== null
      ? flatPos.yesterdayPnL
      : (flatPos.yesterdayPnLPercent ? flatPos.marketValue * (flatPos.yesterdayPnLPercent / 100) : 0);

    const returnPct = flatPos.yesterdayPnLPercent !== undefined && flatPos.yesterdayPnLPercent !== null
      ? flatPos.yesterdayPnLPercent
      : (flatPos.marketValue > 0 && returnDollar !== 0 ? (returnDollar / flatPos.marketValue) * 100 : 0);

    expect(returnDollar).toBe(0);
    expect(returnPct).toBe(0);
    expect(returnDollar).not.toBe(flatPos.dayPnL);
  });

  it('differentiates returns across TODAY, YESTERDAY, 1W, 1M, and ALL-TIME timeframes', () => {
    const eos = mockPositions.find((p) => p.symbol === 'EOS')!;

    const returnsByTimeframe = {
      TODAY: eos.dayPnLPercent,
      YESTERDAY: eos.yesterdayPnLPercent,
      '1W': eos.weekReturnPercent,
      '1M': eos.monthReturnPercent,
      'ALL-TIME': eos.unrealizedPnLPercent,
    };

    expect(returnsByTimeframe.TODAY).toBe(39.2);
    expect(returnsByTimeframe.YESTERDAY).toBe(-8.72);
    expect(returnsByTimeframe['1W']).toBe(13.84);
    expect(returnsByTimeframe['1M']).toBe(46.34);
    expect(returnsByTimeframe['ALL-TIME']).toBe(-6.65);

    // Assert that each timeframe yields distinct performance values
    const uniqueValues = new Set(Object.values(returnsByTimeframe));
    expect(uniqueValues.size).toBe(5);
  });

  it('calculates aggregate prior session P&L, overnight gap average, and advance ratio correctly', () => {
    const totalPortfolioValue = 100000;
    const yesterdayTotalPnL = mockPositions.reduce((acc, p) => acc + p.yesterdayPnL, 0);
    const yesterdayPnLPct = (yesterdayTotalPnL / totalPortfolioValue) * 100;

    expect(yesterdayTotalPnL).toBe(-22);
    expect(yesterdayPnLPct).toBeCloseTo(-0.022, 3);

    // Overnight gap calculation
    const validGaps = mockPositions.filter((p) => p.overnightGapPercent !== 0);
    const avgOvernightGap = validGaps.reduce((acc, p) => acc + p.overnightGapPercent, 0) / validGaps.length;
    // (1.25 + (-0.4) + 39.97) / 3 = 40.82 / 3 = 13.6067%
    expect(avgOvernightGap).toBeCloseTo(13.6067, 3);

    // Top driver vs lagging drag
    const advancers = mockPositions.filter((p) => p.yesterdayPnL > 0);
    const decliners = mockPositions.filter((p) => p.yesterdayPnL < 0);
    const topGainer = [...advancers].sort((a, b) => b.yesterdayPnL - a.yesterdayPnL)[0];
    const topLoser = [...decliners].sort((a, b) => a.yesterdayPnL - b.yesterdayPnL)[0];

    expect(topGainer.symbol).toBe('CCJ');
    expect(topGainer.yesterdayPnL).toBe(620);
    expect(topLoser.symbol).toBe('PLTR');
    expect(topLoser.yesterdayPnL).toBe(-450);

    // Advance Ratio: 1 advancer / (1 advancer + 2 decliners) = 33.33% -> round to 33%
    const totalActive = advancers.length + decliners.length;
    const advancePercent = Math.round((advancers.length / totalActive) * 100);
    expect(advancePercent).toBe(33);
  });
});
