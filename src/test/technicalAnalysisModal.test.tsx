import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TechnicalAnalysisModal } from '../components/graphs/TechnicalAnalysisModal';
import * as techService from '../services/technicalAnalysisService';

const mockAnalysis: techService.StockTechnicalAnalysis = {
  symbol: 'NVDA',
  name: 'NVIDIA Corporation',
  currency: 'USD',
  currentPrice: 130.0,
  previousClose: 128.0,
  dayChange: 2.0,
  dayChangePercent: 1.56,
  asOf: '2026-09-09T06:00:00.000Z',
  levels: [
    {
      id: 'DAILY_RESISTANCE_13500',
      price: 135.0,
      type: 'RESISTANCE',
      timeframe: 'DAILY',
      strength: 'MAJOR',
      touchCount: 3,
      distancePercent: 3.85,
      distanceDollar: 5.0,
      label: 'Daily Resistance 1',
      description: 'Major local swing high cluster',
      isImmediate: true,
    },
    {
      id: 'DAILY_SUPPORT_12500',
      price: 125.0,
      type: 'SUPPORT',
      timeframe: 'DAILY',
      strength: 'MAJOR',
      touchCount: 4,
      distancePercent: -3.85,
      distanceDollar: -5.0,
      label: 'Daily Support 1',
      description: 'Major confirmed swing low defense floor',
      isImmediate: true,
    },
  ],
  immediateResistance: {
    id: 'DAILY_RESISTANCE_13500',
    price: 135.0,
    type: 'RESISTANCE',
    timeframe: 'DAILY',
    strength: 'MAJOR',
    touchCount: 3,
    distancePercent: 3.85,
    distanceDollar: 5.0,
    label: 'Daily Resistance 1',
    description: 'Immediate overhead ceiling',
    isImmediate: true,
  },
  immediateSupport: {
    id: 'DAILY_SUPPORT_12500',
    price: 125.0,
    type: 'SUPPORT',
    timeframe: 'DAILY',
    strength: 'MAJOR',
    touchCount: 4,
    distancePercent: -3.85,
    distanceDollar: -5.0,
    label: 'Daily Support 1',
    description: 'Immediate defense support floor',
    isImmediate: true,
  },
  pivotPoints: {
    classic: { pp: 129.0, r1: 132.0, r2: 135.0, r3: 138.0, s1: 126.0, s2: 123.0, s3: 120.0 },
    fibonacci: {
      level0: 100.0,
      level236: 109.44,
      level382: 115.28,
      level500: 120.0,
      level618: 124.72,
      level786: 131.44,
      level1000: 140.0,
    },
  },
  marketPhase: {
    stage: 'STAGE_2_MARKUP',
    stageName: 'Stage 2: Markup Phase (Uptrend)',
    subPhase: 'MID_STAGE_ADVANCE',
    subPhaseName: 'Mid-Stage Sustained Advance',
    confidenceScore: 92,
    phaseAgeEstimate: 'Healthy (2 to 4 months)',
    summary: 'NVDA is progressing smoothly through a classic Stage 2 markup with higher highs and higher lows.',
    keyCharacteristics: ['Orderly higher highs and higher lows', '20 EMA dynamic trend support'],
    diagnosticDetails: 'Stan Weinstein Stage 2 confirms an established bull market cycle.',
  },
  trend: {
    shortTerm: { direction: 'BULLISH', label: 'Bullish (Above 20 EMA)', description: 'Short-term tactical' },
    mediumTerm: { direction: 'BULLISH', label: 'Bullish (Above Rising 50 SMA)', description: 'Medium-term intermediate' },
    longTerm: { direction: 'BULLISH', label: 'Bullish (Above 200 SMA)', description: 'Long-term macro' },
    primaryTrend: 'BULLISH',
    trendStrengthScore: 88,
    adx: 34,
    movingAverageAlignment: 'BULLISH_STACK',
    alignmentDescription: 'Perfect Bullish Stack: Price > 20 EMA > 50 SMA > 200 SMA',
    isGoldenCross: true,
    isDeathCross: false,
  },
  movingAverages: {
    dma20: 126.5,
    dma50: 121.0,
    dma200: 108.0,
    dma20DistPct: 2.77,
    dma50DistPct: 7.44,
    dma200DistPct: 20.37,
    slope50: 'RISING',
    slope200: 'RISING',
  },
  oscillators: {
    rsi14: 64.2,
    rsiCondition: 'BULLISH_MOMENTUM',
    rsiInterpretation: 'Healthy bullish momentum (55-70)',
    macd: {
      macdLine: 3.2,
      signalLine: 2.4,
      histogram: 0.8,
      crossover: 'BULLISH_CROSS',
      interpretation: 'MACD line is above signal with positive histogram',
    },
    bollingerBands: {
      upper: 134.0,
      middle: 126.5,
      lower: 119.0,
      bandwidthPct: 11.85,
      percentB: 0.73,
      isSqueeze: false,
    },
    atr14: 4.5,
    atrPercent: 3.46,
    relativeVolume: 1.35,
    volumeCondition: 'ABOVE_AVERAGE',
    fiftyTwoWeek: {
      high: 140.76,
      low: 75.6,
      distHighPct: -7.64,
      distLowPct: 71.96,
    },
  },
  blueprint: {
    verdict: 'BUY_ON_PULLBACK',
    verdictTitle: 'Buy on Pullback to Dynamic Support',
    bias: 'BULLISH',
    idealEntryZone: { low: 126.5, high: 128.0, rationale: 'Test of 20 EMA' },
    invalidationStop: { price: 121.25, distancePct: -6.73, rationale: 'Below structural support' },
    targets: [{ label: 'Target 1', price: 135.0, distancePct: 3.85, rationale: 'Immediate resistance' }],
    riskRewardRatio: 2.4,
    playbookGuidance: 'Trend is healthy and rising. Let price come to you on pullbacks.',
  },
};

describe('TechnicalAnalysisModal UI Component', () => {
  it('renders symbol, market phase badge, and immediate S/R levels', () => {
    vi.spyOn(techService, 'useTechnicalAnalysis').mockReturnValue({
      data: mockAnalysis,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);

    render(
      <TechnicalAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        symbol="NVDA"
        onSetAlert={vi.fn()}
      />
    );

    // Verify symbol and company name
    expect(screen.getByText('NVDA')).toBeDefined();
    expect(screen.getByText('NVIDIA Corporation')).toBeDefined();

    // Verify Market Phase
    expect(screen.getAllByText(/Stage 2: Markup Phase/i).length).toBeGreaterThan(0);

    // Verify Immediate Resistance and Support prices
    expect(screen.getByText('$135.00')).toBeDefined();
    expect(screen.getByText('$125.00')).toBeDefined();
  });

  it('switches between tabs: Phase, Levels, Trend, and Oscillators', () => {
    vi.spyOn(techService, 'useTechnicalAnalysis').mockReturnValue({
      data: mockAnalysis,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);

    render(
      <TechnicalAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        symbol="NVDA"
        onSetAlert={vi.fn()}
      />
    );

    // Click "Support & Resistance" tab
    const levelsTab = screen.getByRole('button', { name: /Support & Resistance/i });
    fireEvent.click(levelsTab);

    // Check that Support & Resistance levels are visible
    expect(screen.getByText('Daily Resistance 1')).toBeDefined();
    expect(screen.getByText('Daily Support 1')).toBeDefined();

    // Click "Moving Averages & Trend" tab
    const trendTab = screen.getByRole('button', { name: /Moving Averages & Trend/i });
    fireEvent.click(trendTab);

    // Check moving averages
    expect(screen.getByText(/20-Day EMA/i)).toBeDefined();
    expect(screen.getByText(/50-Day SMA/i)).toBeDefined();
    expect(screen.getByText(/200-Day SMA/i)).toBeDefined();

    // Click "Oscillators & Volatility" tab
    const oscTab = screen.getByRole('button', { name: /Oscillators & Volatility/i });
    fireEvent.click(oscTab);

    // Check RSI and MACD
    expect(screen.getByText(/Relative Strength Index/i)).toBeDefined();
    expect(screen.getByText('64.2')).toBeDefined();
    expect(screen.getByText(/MACD Momentum/i)).toBeDefined();
  });

  it('calls onSetAlert when the user clicks an Alert button on a support or resistance level', () => {
    const handleSetAlert = vi.fn();

    vi.spyOn(techService, 'useTechnicalAnalysis').mockReturnValue({
      data: mockAnalysis,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);

    render(
      <TechnicalAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        symbol="NVDA"
        onSetAlert={handleSetAlert}
      />
    );

    // Go to Levels tab
    const levelsTab = screen.getByRole('button', { name: /Support & Resistance/i });
    fireEvent.click(levelsTab);

    // Find and click the Alert button on the resistance row
    const alertButtons = screen.getAllByRole('button', { name: /Alert/i });
    expect(alertButtons.length).toBeGreaterThan(0);

    fireEvent.click(alertButtons[0]);

    // Verify onSetAlert callback was fired
    expect(handleSetAlert).toHaveBeenCalled();
  });
});
