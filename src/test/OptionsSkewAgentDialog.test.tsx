import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OptionsSkewAgentDialog } from '../components/research/OptionsSkewAgentDialog';
import { OptionsSkewAgentResponse } from '../services/optionsChainService';

const mockSkewData: OptionsSkewAgentResponse = {
  symbol: 'NVDA',
  companyName: 'NVIDIA Corporation',
  timestamp: new Date().toISOString(),
  metrics: {
    spotPrice: 130.0,
    selectedExpiration: '2026-10-16',
    selectedDte: 32,
    atmIv: 45.0,
    delta25CallStrike: 140,
    delta25CallIv: 48.5,
    delta25PutStrike: 120,
    delta25PutIv: 42.0,
    delta25RiskReversal: 6.5,
    delta10CallStrike: 155,
    delta10CallIv: 55.0,
    delta10PutStrike: 110,
    delta10PutIv: 46.0,
    delta10TailSkew: 9.0,
    butterfly25Delta: 0.25,
    averageIvSkewDiff: 5.8,
    maxPainStrike: 135,
    maxPainDistancePercent: 3.8,
    callWallStrike: 150,
    putWallStrike: 115,
    putCallOiRatio: 0.72,
    putCallVolumeRatio: 0.65,
    arePutsAndCallsEquidistant: false,
    equidistanceVerdict: 'CALL_SKEWED_UPSIDE_HEAVY',
    isImplyingUpside: true,
    impliedDirectionalBias: 'STRONGLY_BULLISH_UPSIDE',
    directionalConfidenceScore: 88,
    skewRegime: 'CALL_SKEW_BULLISH_UPSIDE',
  },
  equidistantPairs: [
    {
      targetDistancePercent: 5,
      callStrike: 136.5,
      callActualDistancePercent: 5.0,
      callImpliedVol: 47.0,
      callMidPrice: 4.8,
      callDelta: 0.38,
      callVolume: 12000,
      callOpenInterest: 25000,
      putStrike: 123.5,
      putActualDistancePercent: 5.0,
      putImpliedVol: 43.0,
      putMidPrice: 3.2,
      putDelta: -0.32,
      putVolume: 8000,
      putOpenInterest: 18000,
      ivSkewDiff: 4.0,
      ivRatio: 1.09,
      priceRatio: 1.5,
      isCallHigherIv: true,
      skewDescription: 'Call Skew (+4.0% IV): Upside calls priced at volatility premium',
    },
    {
      targetDistancePercent: 10,
      callStrike: 143.0,
      callActualDistancePercent: 10.0,
      callImpliedVol: 50.0,
      callMidPrice: 2.9,
      callDelta: 0.22,
      callVolume: 18000,
      callOpenInterest: 40000,
      putStrike: 117.0,
      putActualDistancePercent: 10.0,
      putImpliedVol: 44.0,
      putMidPrice: 1.7,
      putDelta: -0.18,
      putVolume: 6000,
      putOpenInterest: 15000,
      ivSkewDiff: 6.0,
      ivRatio: 1.14,
      priceRatio: 1.71,
      isCallHigherIv: true,
      skewDescription: 'Call Skew (+6.0% IV): Upside calls priced at volatility premium',
    },
  ],
  directAnswers: {
    arePutsAndCallsEquidistant: {
      answer: false,
      badgeText: 'NO: Call-Skewed Upside Heavy',
      headline: 'Calls trade at an abnormal +5.8% IV premium over equidistant puts.',
      explanation: 'Traders are bidding up upside calls aggressively compared to equidistant downside puts. This upside skew asymmetry indicates call buyers are paying inflated premiums for upside convexity.',
    },
    areOptionsImplyingUpside: {
      answer: true,
      badgeText: 'YES: Bullish Call Skew',
      headline: 'Options pricing strongly implies institutional anticipation of stock upside.',
      explanation: 'The 25-Delta Risk Reversal is positive at +6.5%, an uncommon market anomaly where OTM calls are more expensive than OTM puts.',
    },
  },
  agentSynthesis: {
    executiveSummary: 'NVDA options reflect strong bullish call skew with 25-Delta Risk Reversal at +6.5%.',
    volatilitySmileAnalysis: 'Comparing equidistant strikes across the chain reveals an average IV spread of +5.8%.',
    institutionalTailRisk: 'Deep out-of-the-money 10-Delta tail skew is +9.0%.',
    optimalDerivativesStrategies: [
      {
        strategyName: 'Bull Call Debit Vertical Spread',
        category: 'BULLISH',
        actionVerdict: 'Exploit Call Skew',
        rationale: 'Selling high-IV upside calls subsidizes the long ATM call.',
        suggestedSetup: 'Buy ATM $130 Call / Sell OTM $150 Call',
        skewEdge: 'Short leg sells overvalued call IV.',
      },
    ],
    catalystsAndRisks: ['Earnings & Macro Catalysts', 'Pinning Pressure around Max Pain $135'],
    source: 'QUANTITATIVE_ENGINE',
  },
};

vi.mock('@/services/optionsChainService', async (importOriginal) => {
  const original = await importOriginal<Record<string, any>>();
  return {
    ...original,
    useOptionsSkewAnalysis: vi.fn(() => ({
      data: mockSkewData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    })),
  };
});

describe('OptionsSkewAgentDialog UI Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it('renders direct answers to user questions accurately', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OptionsSkewAgentDialog
          isOpen={true}
          onClose={vi.fn()}
          symbol="NVDA"
          selectedExpiration="2026-10-16"
        />
      </QueryClientProvider>
    );

    // Header checks
    expect(screen.getByText(/NVDA Options Skew Analysis/i)).toBeInTheDocument();

    // Direct Answer 1: Are Puts & Calls Equidistant?
    expect(screen.getByText(/1\. Are Puts & Calls Equidistant\?/i)).toBeInTheDocument();
    expect(screen.getByText(/NO: Call-Skewed Upside Heavy/i)).toBeInTheDocument();
    expect(screen.getByText(/Calls trade at an abnormal \+5\.8% IV premium over equidistant puts\./i)).toBeInTheDocument();

    // Direct Answer 2: Are Options Implying Upside?
    expect(screen.getByText(/2\. Are Options Implying Upside\?/i)).toBeInTheDocument();
    expect(screen.getByText(/YES: Bullish Call Skew/i)).toBeInTheDocument();
    expect(screen.getByText(/Options pricing strongly implies institutional anticipation of stock upside\./i)).toBeInTheDocument();
  });

  it('renders equidistant strike matrix table and tactical strategies', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OptionsSkewAgentDialog
          isOpen={true}
          onClose={vi.fn()}
          symbol="NVDA"
          selectedExpiration="2026-10-16"
        />
      </QueryClientProvider>
    );

    // Equidistant strike offsets
    expect(screen.getByText(/±5%/i)).toBeInTheDocument();
    expect(screen.getByText(/±10%/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\+4\.0% IV/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+6\.0% IV/i).length).toBeGreaterThan(0);

    // Tactical strategy
    expect(screen.getByText(/Bull Call Debit Vertical Spread/i)).toBeInTheDocument();
    expect(screen.getByText(/Exploit Call Skew/i)).toBeInTheDocument();
    expect(screen.getByText(/Short leg sells overvalued call IV\./i)).toBeInTheDocument();
  });
});
