import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzePortfolioCoveredCalls } from '../../server/services/coveredCallService';

describe('Covered Call Harvester - Active Call Positions & Real Capacity Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly reports 1 real remaining capacity when holding 200 shares with 1 active short call', async () => {
    const mockHoldings = [
      // 200 shares of AAPL in Tastytrade
      {
        id: 'h1',
        brokerId: 'b-tasty',
        symbol: 'AAPL',
        assetType: 'EQUITY',
        brokerSpecificId: 'tasty-1',
        quantity: 200,
        averageCost: 150,
        currentPrice: 180,
        marketValue: 36000,
        dayPnL: 200,
        dayPnLPercent: 0.5,
        unrealizedPnL: 6000,
        unrealizedPnLPercent: 20,
        broker: { id: 'b-tasty', name: 'Tastytrade' },
      },
      // 1 short call on AAPL (commits 100 shares)
      {
        id: 'h2',
        brokerId: 'b-tasty',
        symbol: 'AAPL  241018C00190000',
        underlyingSymbol: 'AAPL',
        assetType: 'OPTION',
        optionType: 'CALL',
        strikePrice: 190,
        expiryDate: '2024-10-18',
        brokerSpecificId: 'tasty-opt-1',
        quantity: -1, // Short 1 contract
        averageCost: 3.5,
        currentPrice: 2.1,
        marketValue: -210,
        dayPnL: 50,
        dayPnLPercent: 19.2,
        unrealizedPnL: 140,
        unrealizedPnLPercent: 40,
        broker: { id: 'b-tasty', name: 'Tastytrade' },
      },
    ];

    const mockPrisma: any = {
      holding: {
        findMany: vi.fn().mockResolvedValue(mockHoldings),
      },
    };

    const result = await analyzePortfolioCoveredCalls(mockPrisma);

    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];

    expect(candidate.symbol).toBe('AAPL');
    expect(candidate.shareCount).toBe(200);
    expect(candidate.totalCapacity).toBe(2); // 200 shares / 100 = 2 contracts gross
    expect(candidate.shortCallsCount).toBe(1); // 1 active call open
    expect(candidate.coveredSharesCount).toBe(100); // 100 shares pledged
    expect(candidate.uncoveredSharesCount).toBe(100); // 100 shares free
    expect(candidate.coveredCallCapacity).toBe(1); // REAL capacity is 1 contract!
    expect(candidate.hasActiveCalls).toBe(true);
    expect(candidate.coverageStatus).toBe('PARTIALLY_COVERED');

    // Verify active call details
    expect(candidate.activeCoveredCalls).toHaveLength(1);
    expect(candidate.activeCoveredCalls[0].strike).toBe(190);
    expect(candidate.activeCoveredCalls[0].expiration).toBe('2024-10-18');
    expect(candidate.activeCoveredCalls[0].quantity).toBe(1);
    expect(candidate.activeCoveredCalls[0].unrealizedPL).toBe(140);
  });

  it('correctly reports 0 real remaining capacity (Fully Covered) when holding 100 shares with 1 active call', async () => {
    const mockHoldings = [
      // 100 shares of PLTR
      {
        id: 'h1',
        brokerId: 'b-tasty',
        symbol: 'PLTR',
        assetType: 'EQUITY',
        brokerSpecificId: 'tasty-1',
        quantity: 100,
        averageCost: 20,
        currentPrice: 30,
        marketValue: 3000,
        dayPnL: 50,
        dayPnLPercent: 1.6,
        unrealizedPnL: 1000,
        unrealizedPnLPercent: 50,
        broker: { id: 'b-tasty', name: 'Tastytrade' },
      },
      // 1 short call covering the 100 shares
      {
        id: 'h2',
        brokerId: 'b-tasty',
        symbol: 'PLTR  241018C00035000',
        underlyingSymbol: 'PLTR',
        assetType: 'OPTION',
        optionType: 'CALL',
        strikePrice: 35,
        expiryDate: '2024-10-18',
        brokerSpecificId: 'tasty-opt-2',
        quantity: -1,
        averageCost: 1.2,
        currentPrice: 0.8,
        marketValue: -80,
        dayPnL: 10,
        dayPnLPercent: 11.1,
        unrealizedPnL: 40,
        unrealizedPnLPercent: 33.3,
        broker: { id: 'b-tasty', name: 'Tastytrade' },
      },
    ];

    const mockPrisma: any = {
      holding: {
        findMany: vi.fn().mockResolvedValue(mockHoldings),
      },
    };

    const result = await analyzePortfolioCoveredCalls(mockPrisma);

    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];

    expect(candidate.symbol).toBe('PLTR');
    expect(candidate.shareCount).toBe(100);
    expect(candidate.totalCapacity).toBe(1);
    expect(candidate.shortCallsCount).toBe(1);
    expect(candidate.coveredSharesCount).toBe(100);
    expect(candidate.uncoveredSharesCount).toBe(0);
    expect(candidate.coveredCallCapacity).toBe(0); // Real capacity is 0!
    expect(candidate.hasActiveCalls).toBe(true);
    expect(candidate.coverageStatus).toBe('FULLY_COVERED');
  });

  it('correctly reports 100% real capacity and no active calls when unhedged', async () => {
    const mockHoldings = [
      // 300 shares of NVDA in IBKR GIA with no short calls
      {
        id: 'h1',
        brokerId: 'b-ibkr',
        symbol: 'NVDA',
        assetType: 'EQUITY',
        brokerSpecificId: 'U15491236-NVDA',
        quantity: 300,
        averageCost: 110,
        currentPrice: 125,
        marketValue: 37500,
        dayPnL: 500,
        dayPnLPercent: 1.3,
        unrealizedPnL: 4500,
        unrealizedPnLPercent: 13.6,
        broker: { id: 'b-ibkr', name: 'Interactive Brokers' },
      },
    ];

    const mockPrisma: any = {
      holding: {
        findMany: vi.fn().mockResolvedValue(mockHoldings),
      },
    };

    const result = await analyzePortfolioCoveredCalls(mockPrisma);

    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];

    expect(candidate.symbol).toBe('NVDA');
    expect(candidate.shareCount).toBe(300);
    expect(candidate.totalCapacity).toBe(3);
    expect(candidate.shortCallsCount).toBe(0);
    expect(candidate.coveredSharesCount).toBe(0);
    expect(candidate.uncoveredSharesCount).toBe(300);
    expect(candidate.coveredCallCapacity).toBe(3);
    expect(candidate.hasActiveCalls).toBe(false);
    expect(candidate.activeCoveredCalls).toHaveLength(0);
    expect(candidate.coverageStatus).toBe('UNCOVERED_OPPORTUNITY');
  });

  it('prevents fake naked capacity when holding 150 shares with 1 active call', async () => {
    const mockHoldings = [
      // 150 shares of TSLA with 1 short call
      {
        id: 'h1',
        brokerId: 'b-tasty',
        symbol: 'TSLA',
        assetType: 'EQUITY',
        brokerSpecificId: 'tasty-tsla',
        quantity: 150,
        averageCost: 210,
        currentPrice: 220,
        marketValue: 33000,
        dayPnL: 100,
        dayPnLPercent: 0.3,
        unrealizedPnL: 1500,
        unrealizedPnLPercent: 4.8,
        broker: { id: 'b-tasty', name: 'Tastytrade' },
      },
      {
        id: 'h2',
        brokerId: 'b-tasty',
        symbol: 'TSLA  241018C00250000',
        underlyingSymbol: 'TSLA',
        assetType: 'OPTION',
        optionType: 'CALL',
        strikePrice: 250,
        expiryDate: '2024-10-18',
        brokerSpecificId: 'tasty-opt-tsla',
        quantity: -1,
        averageCost: 4.0,
        currentPrice: 2.5,
        marketValue: -250,
        dayPnL: 20,
        dayPnLPercent: 7.4,
        unrealizedPnL: 150,
        unrealizedPnLPercent: 37.5,
        broker: { id: 'b-tasty', name: 'Tastytrade' },
      },
    ];

    const mockPrisma: any = {
      holding: {
        findMany: vi.fn().mockResolvedValue(mockHoldings),
      },
    };

    const result = await analyzePortfolioCoveredCalls(mockPrisma);

    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];

    expect(candidate.symbol).toBe('TSLA');
    expect(candidate.shareCount).toBe(150);
    expect(candidate.totalCapacity).toBe(1); // 150 / 100 = 1 contract
    expect(candidate.shortCallsCount).toBe(1);
    expect(candidate.coveredSharesCount).toBe(100);
    expect(candidate.uncoveredSharesCount).toBe(50); // 50 shares cannot cover a new call
    expect(candidate.coveredCallCapacity).toBe(0); // Real capacity is 0! (No fake naked call!)
    expect(candidate.coverageStatus).toBe('FULLY_COVERED');
  });
});
