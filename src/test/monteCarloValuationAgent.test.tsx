import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { generateValuationScenarios } from '../../server/services/monteCarloAgentService';
import { MonteCarloSimulationModal } from '../components/research/MonteCarloSimulationModal';
import * as monteCarloService from '../services/monteCarloService';

describe('AI Valuation Scenario Agent Backend Service', () => {
  it('generates highest-probability valuation scenarios with justifications for a stock', async () => {
    const result = await generateValuationScenarios({
      ticker: 'AAPL',
      currentPrice: 225.0,
      horizonYears: 5,
    });

    expect(result).toBeDefined();
    expect(result.ticker).toBe('AAPL');
    expect(result.highestProbabilityCase).toBe('BASE');

    // Scenarios verification
    const { base, bull, bear } = result.scenarios;
    expect(base).toBeDefined();
    expect(bull).toBeDefined();
    expect(bear).toBeDefined();

    // Check probability calibration
    expect(base.probability).toBeGreaterThan(0.4);
    expect(bull.probability).toBeGreaterThan(0.1);
    expect(bear.probability).toBeGreaterThan(0.1);
    const sumProb = base.probability + bull.probability + bear.probability;
    expect(sumProb).toBeCloseTo(1.0, 1);

    // Check value relationships: Bull growth >= Base growth >= Bear growth
    expect(bull.revenueGrowthRate).toBeGreaterThanOrEqual(base.revenueGrowthRate);
    expect(base.revenueGrowthRate).toBeGreaterThanOrEqual(bear.revenueGrowthRate);

    // Check value relationships: Bull margin >= Base margin >= Bear margin
    expect(bull.targetMargin).toBeGreaterThanOrEqual(base.targetMargin);
    expect(base.targetMargin).toBeGreaterThanOrEqual(bear.targetMargin);

    // Check value relationships: Bull multiple >= Base multiple >= Bear multiple
    expect(bull.exitMultiple).toBeGreaterThanOrEqual(base.exitMultiple);
    expect(base.exitMultiple).toBeGreaterThanOrEqual(bear.exitMultiple);

    // Check that justifications are detailed and non-empty
    expect(result.justifications).toBeDefined();
    expect(result.justifications.revenueGrowth.length).toBeGreaterThan(15);
    expect(result.justifications.targetMargin.length).toBeGreaterThan(15);
    expect(result.justifications.exitMultiple.length).toBeGreaterThan(15);
    expect(result.justifications.discountRate.length).toBeGreaterThan(15);
    expect(result.justifications.annualShareChange.length).toBeGreaterThan(15);
    expect(result.justifications.horizon.length).toBeGreaterThan(10);

    // Recommended inputs check
    expect(result.recommendedInputs).toBeDefined();
    expect(result.recommendedInputs.revenueGrowthRate).toBe(base.revenueGrowthRate);
    expect(result.recommendedInputs.targetMargin).toBe(base.targetMargin);
    expect(result.recommendedInputs.exitMultiple).toBe(base.exitMultiple);
    expect(result.recommendedInputs.horizonYears).toBe(5);
  }, 20000);
});

describe('MonteCarloSimulationModal AI Auto-Populate & Justifications Integration', () => {
  let queryClient: QueryClient;

  const mockAiResponse: monteCarloService.ValuationAgentScenarioResponse = {
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    currentPrice: 120.0,
    executiveSummary: 'AI hardware datacenter monopoly transitioning into high-margin enterprise AI software ecosystem.',
    highestProbabilityCase: 'BASE',
    scenarios: {
      base: {
        name: 'Base Case (Highest Probability)',
        probability: 0.60,
        revenueGrowthRate: 18.5,
        targetMargin: 52.0,
        exitMultiple: 32.0,
        discountRate: 9.5,
        annualShareChangePct: -1.5,
        horizonYears: 5,
        description: 'Sustained hyperscaler compute buildout with steady 50%+ operating margins.',
      },
      bull: {
        name: 'Bull Scenario (P90)',
        probability: 0.25,
        revenueGrowthRate: 28.0,
        targetMargin: 58.0,
        exitMultiple: 40.0,
        discountRate: 9.0,
        annualShareChangePct: -2.5,
        horizonYears: 5,
        description: 'Sovereign AI adoption and CUDA software subscription acceleration.',
      },
      bear: {
        name: 'Bear Scenario (P10)',
        probability: 0.15,
        revenueGrowthRate: 8.0,
        targetMargin: 42.0,
        exitMultiple: 22.0,
        discountRate: 10.5,
        annualShareChangePct: 0.0,
        horizonYears: 5,
        description: 'Custom ASIC silicon competition and digestion phase in cloud CapEx.',
      },
    },
    justifications: {
      revenueGrowth: '18.5% CAGR balances sovereign AI demand with high-base law of large numbers.',
      targetMargin: '52% margin reflects premium pricing power and sticky CUDA software moat.',
      exitMultiple: '32x exit multiple aligns with large-cap semiconductor leadership premium.',
      discountRate: '9.5% WACC reflects 4.2% Treasury base plus moderate operational volatility.',
      annualShareChange: '-1.5%/yr share reduction reflects massive free cash flow buyback deployment.',
      horizon: '5-year horizon spans the transition to Blackwell and next-gen Rubin architectures.',
    },
    keyCatalysts: ['Blackwell architectural ramp', 'Enterprise AI software monetization'],
    keyRisks: ['Cloud provider custom silicon (TPU/Trainium)', 'Geopolitical export constraints'],
    recommendedInputs: {
      startingPrice: 120.0,
      startingRevenue: 96.0,
      startingMargin: 54.0,
      startingShares: 24.5,
      revenueGrowthRate: 18.5,
      targetMargin: 52.0,
      exitMultiple: 32.0,
      discountRate: 9.5,
      annualShareChangePct: -1.5,
      horizonYears: 5,
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  it('renders AI Auto-Populate buttons and auto-fills simulation inputs with justifications when clicked', async () => {
    // Mock global.fetch for API endpoints
    global.fetch = vi.fn().mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/quant/monte-carlo/agent-scenarios')) {
        return {
          ok: true,
          json: async () => mockAiResponse,
        };
      }
      if (urlStr.includes('/api/quant/monte-carlo/baselines')) {
        return {
          ok: true,
          json: async () => ({
            ticker: 'NVDA',
            name: 'NVIDIA Corporation',
            currency: 'USD',
            currentPrice: 120.0,
            revenue: 96e9,
            revenueBillions: 96.0,
            operatingMargin: 54.0,
            sharesOutstandingBillions: 24.5,
            trailingPE: 32.0,
            revenueGrowth: 20.0,
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as any;

    render(
      <QueryClientProvider client={queryClient}>
        <MonteCarloSimulationModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="NVDA"
          currentPrice={120.0}
        />
      </QueryClientProvider>
    );

    // Verify AI Auto-Populate button exists in header
    const aiHeaderBtn = screen.getAllByRole('button', { name: /AI Auto-Populate/i })[0];
    expect(aiHeaderBtn).toBeDefined();

    // Verify AI Invite banner exists before running
    expect(screen.getByText(/AI Institutional Valuation Modeler/i)).toBeDefined();

    // Click the AI Auto-Populate button
    fireEvent.click(aiHeaderBtn);

    // Wait for the AI scenario report and justifications card to appear
    await waitFor(() => {
      expect(screen.getByText(/AI Valuation Intelligence & Parameter Justifications/i)).toBeDefined();
    });

    // Check that executive summary is displayed
    expect(screen.getByText(/AI hardware datacenter monopoly/i)).toBeDefined();

    // Check that all parameter justifications are rendered
    expect(screen.getByText(/18.5% CAGR balances sovereign AI demand/i)).toBeDefined();
    expect(screen.getByText(/52% margin reflects premium pricing power/i)).toBeDefined();
    expect(screen.getByText(/32x exit multiple aligns with large-cap/i)).toBeDefined();
    expect(screen.getByText(/9.5% WACC reflects 4.2% Treasury base/i)).toBeDefined();
    expect(screen.getByText(/-1.5%\/yr share reduction reflects massive free cash flow/i)).toBeDefined();

    // Check that inputs are filled with AI recommended values
    const growthInput = screen.getByDisplayValue('18.5');
    expect(growthInput).toBeDefined();

    const marginInput = screen.getByDisplayValue('52');
    expect(marginInput).toBeDefined();

    const exitMultipleInput = screen.getByDisplayValue('32');
    expect(exitMultipleInput).toBeDefined();

    // Check 1-click toggling to Bull scenario
    const bullScenarioBtn = screen.getByRole('button', { name: /Bull Case/i });
    fireEvent.click(bullScenarioBtn);

    // Inputs should update to Bull values (28% growth, 58% margin, 40x multiple)
    await waitFor(() => {
      expect(screen.getByDisplayValue('28')).toBeDefined();
      expect(screen.getByDisplayValue('58')).toBeDefined();
      expect(screen.getByDisplayValue('40')).toBeDefined();
    });

    // Check 1-click toggling to Bear scenario
    const bearScenarioBtn = screen.getByRole('button', { name: /Bear Case/i });
    fireEvent.click(bearScenarioBtn);

    // Inputs should update to Bear values (8% growth, 42% margin, 22x multiple)
    await waitFor(() => {
      expect(screen.getByDisplayValue('8')).toBeDefined();
      expect(screen.getByDisplayValue('42')).toBeDefined();
      expect(screen.getByDisplayValue('22')).toBeDefined();
    });
  });
});
