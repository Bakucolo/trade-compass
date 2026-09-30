import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoldMacroRegimeDashboard } from '../components/macro/GoldMacroRegimeDashboard';

// Mock the React Query hooks from goldMacroService
vi.mock('@/services/goldMacroService', async () => {
  const actual = await vi.importActual<any>('@/services/goldMacroService');
  return {
    ...actual,
    useGoldMacroRegime: () => ({
      data: {
        timestamp: '2026-09-29T06:00:00.000Z',
        goldPrice: {
          current: 4155.20,
          change1D: 18.40,
          changePercent1D: 0.44,
          change1M: 3.82,
          change3M: 11.20,
          change12M: 38.45,
          symbol: 'GC=F',
          source: 'COMEX Gold Futures',
          lastUpdated: '2026-09-29T06:00:00.000Z'
        },
        goldMacroScore: 46,
        confidenceScore: 82,
        structuralRegime: 'NEUTRAL',
        structuralRegimeLabel: 'Structural: Neutral',
        tacticalPressure: 'MODERATE_HEADWIND',
        tacticalPressureScore: -24,
        tacticalPressureLabel: 'Tactical: Moderate Headwind',
        fiscalPressureScore: 85,
        fiscalPressureCategory: 'EXTREME',
        stagflationPressureScore: 65,
        stagflationPressureCategory: 'HIGH',
        pillars: [
          {
            id: 'real_rates',
            name: 'Real Rates (TIPS Yields)',
            weight: 0.25,
            effectiveWeight: 0.25,
            rawScore: -86,
            contribution: -21.5,
            stance: 'STRONG_HEADWIND',
            keyVariables: ['10Y TIPS Yield'],
            summary: '10Y TIPS real yield is at 2.83% (94th percentile).',
            metrics: [
              {
                id: 'DFII10',
                name: '10Y TIPS Real Yield',
                currentValue: 2.83,
                prevValue: 2.80,
                change1M: 0.15,
                change3M: 0.65,
                change12M: 1.10,
                percentile5Y: 94,
                percentile10Y: 94,
                zScore5Y: 2.1,
                trend: 'rising',
                normalizedPillarScore: -86,
                metadata: {
                  source: 'FRED',
                  seriesId: 'DFII10',
                  name: '10Y TIPS Real Yield',
                  frequency: 'daily',
                  units: '%',
                  lastObservationDate: '2026-09-25',
                  dataAgeDays: 4,
                  isStale: false,
                  stalenessWarning: '✓ Updated'
                }
              }
            ]
          },
          {
            id: 'fiscal_treasury',
            name: 'Fiscal & Treasury Stress',
            weight: 0.25,
            effectiveWeight: 0.25,
            rawScore: 65,
            contribution: 16.3,
            stance: 'STRONG_TAILWIND',
            keyVariables: ['10Y ACM Term Premium', 'Total Debt'],
            summary: 'Fiscal pressure is EXTREME (85/100).',
            metrics: []
          },
          {
            id: 'inflation_stagflation',
            name: 'Inflation / Stagflation Shock',
            weight: 0.20,
            effectiveWeight: 0.20,
            rawScore: -40,
            contribution: -8.0,
            stance: 'MODERATE_HEADWIND',
            keyVariables: ['10Y Breakeven', 'Brent Crude'],
            summary: '10Y Breakeven at 2.34% and Brent at $114.89.',
            metrics: []
          },
          {
            id: 'usd',
            name: 'U.S. Dollar Index',
            weight: 0.15,
            effectiveWeight: 0.15,
            rawScore: 11,
            contribution: 1.6,
            stance: 'NEUTRAL_MIXED',
            keyVariables: ['Trade-Weighted USD'],
            summary: 'Broad USD index at 120.33.',
            metrics: []
          },
          {
            id: 'liquidity_conditions',
            name: 'Liquidity & Financial Conditions',
            weight: 0.15,
            effectiveWeight: 0.15,
            rawScore: 24,
            contribution: 3.6,
            stance: 'MODERATE_TAILWIND',
            keyVariables: ['NFCI', 'VIX'],
            summary: 'NFCI at -0.55.',
            metrics: []
          }
        ],
        whyUnderPressureOrSupported: 'Gold is navigating a transitional cross-current regime with elevated real rates and expanding term premia.',
        whatIsHurtingGold: [
          {
            title: 'Elevated and Rising Real Yields',
            detail: '10Y TIPS real yield is 2.83%, raising opportunity costs.',
            impactBpsOrPct: '+65 bps / 3M'
          }
        ],
        whatIsSupportingGold: [
          {
            title: 'Persistent Fiscal Dominance & Issuance Strain',
            detail: 'Total U.S. public debt has reached $40.09T.',
            impactBpsOrPct: 'Fiscal Score: 85/100'
          }
        ],
        signalConflict: {
          hasConflict: true,
          bullishFactors: ['Fiscal / Treasury Pressure (EXTREME)'],
          bearishFactors: ['High 10Y TIPS Real Yields (2.83%)'],
          interpretation: 'Monetary policy tightening conflicts with rising fiscal dominance.'
        },
        whatWouldChangeMyMind: [
          {
            direction: 'BULLISH',
            condition: '10Y real yield falls below its 12-month average',
            targetMetric: '10Y TIPS (DFII10)',
            currentValue: '2.83%',
            triggerThreshold: '< 2.38%',
            economicRationale: 'Eliminates opportunity cost.'
          }
        ],
        fiscalTelemetry: {
          debtToPennyTrillions: 40.09,
          debtObservationDate: '2026-09-25',
          recentAuctions: [
            {
              date: '2026-09-24',
              term: '10-Year',
              bidToCover: 2.38,
              highYield: 5.12,
              totalAcceptedBillions: 44.0,
              demandQuality: 'AVERAGE'
            }
          ],
          termPremium10Y: 0.76,
          termPremium3MChange: 0.25,
          termPremiumPercentile: 82
        },
        alerts: [],
        aiNarrative: {
          enabled: false,
          cached: false
        }
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn()
    }),
    useGoldMacroHistory: () => ({
      data: [
        {
          date: '2026-09-01',
          formattedDate: 'Sep 26',
          goldPrice: 4155.20,
          goldMacroScore: 46,
          realRatesScore: -86,
          usdScore: 11,
          inflationScore: -40,
          fiscalScore: 65,
          liquidityScore: 24,
          structuralRegime: 'NEUTRAL'
        }
      ],
      isLoading: false
    }),
    useGoldMacroBacktest: () => ({
      data: {
        generatedAt: '2026-09-29T06:00:00.000Z',
        startDate: '2016-01-01',
        endDate: '2026-09-28',
        totalTradingDays: 520,
        conditions: [
          {
            conditionName: '10Y Real Yield > 90th Percentile',
            description: 'Gold performance when TIPS real yields were in the top 10%.',
            sampleSize: 48,
            avgReturn1M: -1.8,
            avgReturn3M: -4.2,
            avgReturn6M: -6.5,
            avgReturn12M: -3.8,
            winRate1M: 38,
            winRate3M: 32,
            winRate6M: 29,
            winRate12M: 40
          }
        ]
      },
      isLoading: false
    }),
    useGenerateGoldMacroAiNarrative: () => ({
      mutateAsync: vi.fn(),
      isPending: false
    })
  };
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('GoldMacroRegimeDashboard Component', () => {
  it('renders the top card with Gold Macro Score, spot price, and 4 regime labels', () => {
    renderWithClient(<GoldMacroRegimeDashboard />);

    expect(screen.getByText('Gold Macro Regime Dashboard')).toBeDefined();
    expect(screen.getByText('46')).toBeDefined();
    expect(screen.getByText('/ 100')).toBeDefined();
    expect(screen.getByText('$4,155.2')).toBeDefined();

    // 4 Regimes
    expect(screen.getByText('Structural Gold Regime')).toBeDefined();
    expect(screen.getByText('Tactical Gold Pressure')).toBeDefined();
    expect(screen.getByText('Fiscal Dominance Pressure')).toBeDefined();
    expect(screen.getByText('Stagflation Pressure')).toBeDefined();
    expect(screen.getByText('EXTREME (85/100)')).toBeDefined();
    expect(screen.getByText('HIGH (65/100)')).toBeDefined();
  });

  it('renders driver contribution bars, why panel, and hurting vs supporting sections', () => {
    renderWithClient(<GoldMacroRegimeDashboard />);

    // Contribution bars
    expect(screen.getByText('What is Driving Gold? (Pillar Contribution Breakdown)')).toBeDefined();
    expect(screen.getByText('Real Rates (TIPS Yields)')).toBeDefined();
    expect(screen.getByText('Fiscal & Treasury Stress')).toBeDefined();

    // Why panel
    expect(screen.getByText('Why Is Gold Behaving This Way?')).toBeDefined();
    expect(screen.getByText(/Gold is navigating a transitional cross-current regime/i)).toBeDefined();

    // Hurting vs Supporting
    expect(screen.getByText('What is Hurting Gold?')).toBeDefined();
    expect(screen.getByText('Elevated and Rising Real Yields')).toBeDefined();
    expect(screen.getByText('+65 bps / 3M')).toBeDefined();

    expect(screen.getByText('What is Supporting Gold?')).toBeDefined();
    expect(screen.getByText('Persistent Fiscal Dominance & Issuance Strain')).toBeDefined();
    expect(screen.getByText('Fiscal Score: 85/100')).toBeDefined();
  });

  it('renders signal conflict alert when monetary and fiscal signals disagree', () => {
    renderWithClient(<GoldMacroRegimeDashboard />);

    expect(screen.getByText(/Signal Conflict Detected/i)).toBeDefined();
    expect(screen.getByText(/Monetary policy tightening conflicts with rising fiscal dominance/i)).toBeDefined();
  });

  it('renders dynamic pivot levels in What Would Change My Mind table', () => {
    renderWithClient(<GoldMacroRegimeDashboard />);

    expect(screen.getByText('What Would Change My Mind? (Dynamic Pivot Levels)')).toBeDefined();
    expect(screen.getByText('10Y TIPS (DFII10)')).toBeDefined();
    expect(screen.getByText('< 2.38%')).toBeDefined();
  });

  it('opens and closes the Methodology modal on button click', () => {
    renderWithClient(<GoldMacroRegimeDashboard />);

    const methodologyButton = screen.getByRole('button', { name: /Methodology/i });
    fireEvent.click(methodologyButton);

    expect(screen.getByText('Institutional Gold Macro Regime Methodology')).toBeDefined();
    expect(screen.getByText('100% Deterministic')).toBeDefined();
    expect(screen.getByText('Mathematical Scoring Engine')).toBeDefined();
  });
});
