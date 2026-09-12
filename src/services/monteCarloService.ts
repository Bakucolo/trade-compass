import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MonteCarloScenario {
  name: string;
  probability: number;
  intrinsic_value: number;
  upside_downside_pct: number;
  description: string;
}

export interface HistogramBucket {
  bin_index: number;
  bin_start: number;
  bin_end: number;
  bin_midpoint: number;
  count: number;
  density: number;
  cumulative_probability: number;
}

export interface MonteCarloSimulationResult {
  ticker: string;
  current_market_price: number;
  median_intrinsic_value: number;
  mean_intrinsic_value: number;
  std_intrinsic_value: number;
  confidence_interval_90: {
    p05: number;
    p95: number;
  };
  confidence_interval_80: {
    p10: number;
    p90: number;
  };
  scenarios: {
    bear: MonteCarloScenario;
    base: MonteCarloScenario;
    bull: MonteCarloScenario;
  };
  prob_undervalued: number;
  expected_margin_of_safety_pct: number;
  raw_distribution: HistogramBucket[];
  factor_sensitivities: {
    sensitivity_to_revenue_growth: number;
    sensitivity_to_operating_margin: number;
    sensitivity_to_interest_rates: number;
    sensitivity_to_inflation: number;
  };
  simulated_paths_count: number;
  execution_duration_ms: number;
  macro_baselines: {
    risk_free_rate: number;
    implied_inflation: number;
    long_term_rfr_mean: number;
    rfr_mean_reversion_speed: number;
    rfr_volatility: number;
    long_term_inflation_mean: number;
    equity_risk_premium: number;
    source: string;
  };
  company_baselines: {
    ticker: string;
    current_price: number;
    shares_outstanding: number;
    free_cash_flow: number;
    revenue: number;
    operating_margin: number;
    total_debt: number;
    cash_and_equivalents: number;
    historical_rev_growth_cagr: number;
    rev_growth_std: number;
    beta: number;
    source: string;
  };
}

export interface MonteCarloSimulateParams {
  ticker: string;
  trials?: number;
  horizon?: number;
  seed?: number;
  noCache?: boolean;
}

export interface CompanyBaselinesData {
  ticker: string;
  name: string;
  currency: string;
  currentPrice: number;
  revenue: number;
  revenueBillions: number;
  operatingMargin: number;
  profitMargin: number;
  sharesOutstanding: number;
  sharesOutstandingBillions: number;
  freeCashFlow: number;
  fcfBillions: number;
  trailingPE: number;
  forwardPE: number;
  revenueGrowth: number;
  beta: number;
  marketCap: number;
}

export async function fetchCompanyBaselines(ticker: string): Promise<CompanyBaselinesData> {
  const cleanTicker = ticker.trim().toUpperCase();
  const res = await fetch(`/api/quant/monte-carlo/baselines/${cleanTicker}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error || `Failed to fetch company baselines (${res.status})`);
  }
  return res.json();
}

export function useCompanyBaselines(ticker?: string, enabled: boolean = true) {
  const cleanTicker = (ticker || '').trim().toUpperCase();
  return useQuery<CompanyBaselinesData, Error>({
    queryKey: ['companyBaselines', cleanTicker],
    queryFn: () => fetchCompanyBaselines(cleanTicker),
    enabled: Boolean(cleanTicker) && enabled,
    staleTime: 15 * 60 * 1000, // 15 mins
    refetchOnWindowFocus: false,
  });
}

/**
 * Execute a multi-factor Monte Carlo simulation for a given ticker
 */
export async function runMonteCarloSimulation(params: MonteCarloSimulateParams): Promise<MonteCarloSimulationResult> {
  const res = await fetch('/api/quant/monte-carlo/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: params.ticker.toUpperCase(),
      trials: params.trials ?? 10000,
      horizon: params.horizon ?? 5,
      seed: params.seed,
      noCache: Boolean(params.noCache),
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error || `Monte Carlo simulation failed (${res.status})`);
  }

  return res.json();
}

/**
 * Query hook for Monte Carlo simulation result
 */
export function useMonteCarloSimulation(
  ticker?: string,
  options: { trials?: number; horizon?: number; enabled?: boolean; noCache?: boolean } = {}
) {
  const { trials = 10000, horizon = 5, enabled = false, noCache = false } = options;
  const cleanTicker = (ticker || '').trim().toUpperCase();

  return useQuery<MonteCarloSimulationResult, Error>({
    queryKey: ['monteCarloSimulation', cleanTicker, trials, horizon, noCache],
    queryFn: () => runMonteCarloSimulation({ ticker: cleanTicker, trials, horizon, noCache }),
    enabled: Boolean(cleanTicker) && enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Mutation hook to re-run simulation with custom parameters or bust cache
 */
export function useRunMonteCarloSimulation() {
  const queryClient = useQueryClient();

  return useMutation<MonteCarloSimulationResult, Error, MonteCarloSimulateParams>({
    mutationFn: runMonteCarloSimulation,
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['monteCarloSimulation', data.ticker.toUpperCase(), data.simulated_paths_count, 5, false],
        data
      );
    },
  });
}

export interface ValuationScenarioParameters {
  revenueGrowthRate: number;      // % CAGR over the horizon
  targetMargin: number;           // % operating or FCF margin
  exitMultiple: number;           // P/E or P/FCF terminal multiple
  discountRate: number;           // % required annual return / WACC
  annualShareChangePct: number;   // % / yr share count change
  horizonYears: number;           // forecast duration in years
  probability: number;            // 0.0 to 1.0 (e.g. 0.60 for 60%)
  intrinsicValue?: number;
  expectedReturnPct?: number;
}

export interface ValuationAgentScenarioResponse {
  ticker: string;
  companyName: string;
  currentPrice: number;
  executiveSummary: string;
  highestProbabilityCase: 'BASE' | 'BULL' | 'BEAR';
  scenarios: {
    base: ValuationScenarioParameters & {
      name: string;
      description: string;
    };
    bull: ValuationScenarioParameters & {
      name: string;
      description: string;
    };
    bear: ValuationScenarioParameters & {
      name: string;
      description: string;
    };
  };
  justifications: {
    revenueGrowth: string;       // Summary justifying chosen revenue growth rate
    targetMargin: string;        // Summary justifying chosen target margin
    exitMultiple: string;        // Summary justifying chosen exit valuation multiple
    discountRate: string;        // Summary justifying chosen discount rate / WACC
    annualShareChange: string;   // Summary justifying chosen share change (buybacks/dilution)
    horizon: string;             // Summary justifying chosen time horizon
  };
  keyCatalysts: string[];
  keyRisks: string[];
  recommendedInputs: {
    startingPrice: number;
    startingRevenue: number;
    startingMargin: number;
    startingShares: number;
    revenueGrowthRate: number;
    targetMargin: number;
    exitMultiple: number;
    discountRate: number;
    annualShareChangePct: number;
    horizonYears: number;
  };
}

export interface FetchValuationAgentScenariosParams {
  ticker: string;
  currentPrice?: number;
  horizonYears?: number;
}

/**
 * Call the AI Valuation Scenario Agent to research the stock and synthesize
 * highest-probability parameters with full justifications.
 */
export async function fetchValuationAgentScenarios(
  params: FetchValuationAgentScenariosParams
): Promise<ValuationAgentScenarioResponse> {
  const res = await fetch('/api/quant/monte-carlo/agent-scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: params.ticker.toUpperCase(),
      currentPrice: params.currentPrice,
      horizonYears: params.horizonYears ?? 5,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error || `Failed to generate AI valuation scenarios (${res.status})`);
  }

  return res.json();
}

/**
 * Mutation hook to invoke the AI Valuation Scenario Agent
 */
export function useValuationAgentScenarios() {
  const queryClient = useQueryClient();

  return useMutation<ValuationAgentScenarioResponse, Error, FetchValuationAgentScenariosParams>({
    mutationFn: fetchValuationAgentScenarios,
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['valuationAgentScenarios', data.ticker.toUpperCase(), data.recommendedInputs.horizonYears],
        data
      );
    },
  });
}
