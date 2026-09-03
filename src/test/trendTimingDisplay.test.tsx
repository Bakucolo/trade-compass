import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { formatTrendDate, TrendFinderCard } from '../components/macro/TrendFinderCard';
import * as trendFinderModule from '../services/trendFinderService';

describe('Macro Trend Finder Lifecycle Timing Display', () => {
  it('formats trend date correctly regardless of timezone', () => {
    expect(formatTrendDate('2026-08-28')).toContain('Aug 28, 2026');
    expect(formatTrendDate('2026-01-15')).toContain('Jan 15, 2026');
    expect(formatTrendDate(undefined)).toBe('Recent');
  });

  it('renders starting, ongoing, and exhaustion timing correctly in Grid Mode', () => {
    const mockSummary: trendFinderModule.TrendFinderSummary = {
      startingCount: 1,
      ongoingCount: 1,
      exhaustedCount: 1,
      bullishCount: 2,
      bearishCount: 1,
      topOpportunities: {
        startingBreakouts: [],
        strongestTrends: [],
        exhaustionReversals: [],
      },
      fetchedAt: new Date().toISOString(),
      items: [
        {
          symbol: 'QQQ',
          name: 'Invesco QQQ Trust',
          shortName: 'Nasdaq 100',
          scope: 'ASSET_CLASS',
          subCategory: 'US Equities',
          description: 'Tech ETF',
          price: 480.5,
          prevClose: 475.2,
          change: 5.3,
          changePercent: 1.11,
          returns: { '1D': 1.11, '1W': 2.3, '1M': 4.5, '3M': 9.8, 'YTD': 18.2 },
          stage: 'STARTING',
          direction: 'BULLISH',
          trendStrengthScore: 78,
          exhaustionRiskScore: 18,
          dma20: 472,
          dma50: 468,
          dma200: 440,
          dist20DmaPct: 1.8,
          dist50DmaPct: 2.6,
          dist200DmaPct: 9.2,
          rsi14: 58.2,
          isGoldenCross: true,
          isDeathCross: false,
          signals: ['50-DMA Breakout Inflection'],
          macroDriver: 'AI hardware capex acceleration',
          actionablePlaybook: 'Enter pullbacks',
          trendStartDate: '2026-08-29',
          daysInTrend: 5,
        },
        {
          symbol: 'SPY',
          name: 'SPDR S&P 500 ETF',
          shortName: 'S&P 500',
          scope: 'ASSET_CLASS',
          subCategory: 'US Equities',
          description: 'Large cap index',
          price: 550.0,
          prevClose: 548.0,
          change: 2.0,
          changePercent: 0.36,
          returns: { '1D': 0.36, '1W': 1.2, '1M': 3.1, '3M': 7.4, 'YTD': 14.5 },
          stage: 'ONGOING',
          direction: 'BULLISH',
          trendStrengthScore: 84,
          exhaustionRiskScore: 32,
          dma20: 544,
          dma50: 538,
          dma200: 510,
          dist20DmaPct: 1.1,
          dist50DmaPct: 2.2,
          dist200DmaPct: 7.8,
          rsi14: 63.5,
          isGoldenCross: false,
          isDeathCross: false,
          signals: ['Riding 20 EMA Support'],
          macroDriver: 'Resilient corporate earnings',
          actionablePlaybook: 'Hold core long exposure',
          trendStartDate: '2026-07-15',
          daysInTrend: 50,
        },
        {
          symbol: 'GLD',
          name: 'SPDR Gold Shares',
          shortName: 'Gold Bullion',
          scope: 'ASSET_CLASS',
          subCategory: 'Precious Metals',
          description: 'Physical gold trust',
          price: 235.0,
          prevClose: 236.0,
          change: -1.0,
          changePercent: -0.42,
          returns: { '1D': -0.42, '1W': 0.8, '1M': 8.2, '3M': 16.5, 'YTD': 22.0 },
          stage: 'EXHAUSTED',
          direction: 'BULLISH',
          trendStrengthScore: 82,
          exhaustionRiskScore: 88,
          dma20: 228,
          dma50: 218,
          dma200: 195,
          dist20DmaPct: 3.0,
          dist50DmaPct: 7.8,
          dist200DmaPct: 20.5,
          rsi14: 78.4,
          isGoldenCross: false,
          isDeathCross: false,
          signals: ['Severe RSI Overbought (78)'],
          macroDriver: 'Central bank gold reserve buying',
          actionablePlaybook: 'Take partial profits',
          trendStartDate: '2026-06-20',
          daysInTrend: 75,
          exhaustionStartDate: '2026-08-25',
          daysExhausted: 9,
        },
      ],
    };

    vi.spyOn(trendFinderModule, 'useTrendFinder').mockReturnValue({
      data: mockSummary,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<TrendFinderCard />);

    // 1. STARTING Trend timing check:
    expect(screen.getByText(/Trend Started:/i)).toBeInTheDocument();
    expect(screen.getByText(/Aug 29, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/\(5d in trend\)/i)).toBeInTheDocument();

    // 2. ONGOING Trend timing check:
    expect(screen.getByText(/In Trend:/i)).toBeInTheDocument();
    expect(screen.getByText(/50 days/i)).toBeInTheDocument();
    expect(screen.getByText(/\(Started Aug 29, 2026\)|\(Started Jul 15, 2026\)/i)).toBeInTheDocument();

    // 3. EXHAUSTED Trend timing check:
    expect(screen.getByText(/Exhaustion Began:/i)).toBeInTheDocument();
    expect(screen.getByText(/Aug 25, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/9d ago • 75d trend/i)).toBeInTheDocument();
  });
});
