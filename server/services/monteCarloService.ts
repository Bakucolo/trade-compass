import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import YahooFinance from 'yahoo-finance2';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';

export interface CompanyBaselines {
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

const baselinesCache = new Map<string, { data: CompanyBaselines; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 mins

export async function getCompanyBaselines(ticker: string): Promise<CompanyBaselines> {
  const cleanTicker = ticker.trim().toUpperCase();
  const cached = baselinesCache.get(cleanTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const querySym = resolveYahooFinanceSymbol(cleanTicker) || cleanTicker;
  const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

  const summary = await yahooFinance.quoteSummary(querySym, {
    modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData']
  }, { validateResult: false }).catch(() => null);

  const priceModule = summary?.price;
  const detailModule = summary?.summaryDetail;
  const statsModule = summary?.defaultKeyStatistics;
  const financialsModule = summary?.financialData;

  const currentPrice = Number(priceModule?.regularMarketPrice || detailModule?.previousClose || 100);
  const marketCap = Number(priceModule?.marketCap || detailModule?.marketCap || 0);
  const sharesOutstanding = Number(statsModule?.sharesOutstanding || (marketCap > 0 && currentPrice > 0 ? marketCap / currentPrice : 1e9));
  const revenue = Number(financialsModule?.totalRevenue || 0);
  const fcf = Number(financialsModule?.freeCashflow || 0);
  const operatingMargin = financialsModule?.operatingMargins != null ? Number(financialsModule.operatingMargins) * 100 : 20.0;
  const profitMargin = financialsModule?.profitMargins != null ? Number(financialsModule.profitMargins) * 100 : 15.0;
  const revGrowth = financialsModule?.revenueGrowth != null ? Number(financialsModule.revenueGrowth) * 100 : 10.0;
  const trailingPE = detailModule?.trailingPE != null ? Number(detailModule.trailingPE) : (detailModule?.forwardPE != null ? Number(detailModule.forwardPE) : 22.0);
  const forwardPE = detailModule?.forwardPE != null ? Number(detailModule.forwardPE) : trailingPE;
  const beta = Number(statsModule?.beta || 1.0);
  const name = priceModule?.shortName || priceModule?.longName || cleanTicker;
  const currency = priceModule?.currency || 'USD';

  // If revenue is in billions, provide shares in billions so units align nicely
  const revenueBillions = Number((revenue / 1e9).toFixed(2));
  const sharesOutstandingBillions = Number((sharesOutstanding / 1e9).toFixed(3));
  const fcfBillions = Number((fcf / 1e9).toFixed(2));

  const result: CompanyBaselines = {
    ticker: cleanTicker,
    name,
    currency,
    currentPrice: Number(currentPrice.toFixed(2)),
    revenue,
    revenueBillions,
    operatingMargin: Number(operatingMargin.toFixed(1)),
    profitMargin: Number(profitMargin.toFixed(1)),
    sharesOutstanding,
    sharesOutstandingBillions,
    freeCashFlow: fcf,
    fcfBillions,
    trailingPE: Number(trailingPE.toFixed(1)),
    forwardPE: Number(forwardPE.toFixed(1)),
    revenueGrowth: Number(revGrowth.toFixed(1)),
    beta: Number(beta.toFixed(2)),
    marketCap,
  };

  baselinesCache.set(cleanTicker, { data: result, timestamp: Date.now() });
  return result;
}

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

export interface MonteCarloOptions {
  trials?: number;
  horizon?: number;
  seed?: number;
  noCache?: boolean;
}

function getPythonExecutable(): string {
  const venvPython = process.platform === 'win32'
    ? path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe')
    : path.resolve(process.cwd(), '.venv', 'bin', 'python');

  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export async function runMonteCarloSimulation(
  ticker: string,
  options: MonteCarloOptions = {}
): Promise<MonteCarloSimulationResult> {
  const cleanTicker = ticker.trim().toUpperCase();
  const pythonCmd = getPythonExecutable();

  const trials = options.trials || 10000;
  const horizon = options.horizon || 5;

  const args: string[] = [
    '-m',
    'server.quant.monte_carlo.cli',
    cleanTicker,
    '--trials',
    String(trials),
    '--horizon',
    String(horizon),
    '--json',
  ];

  if (options.seed !== undefined) {
    args.push('--seed', String(options.seed));
  }
  if (options.noCache) {
    args.push('--no-cache');
  }

  return new Promise((resolve, reject) => {
    let stdoutBuffer = '';
    let stderrBuffer = '';

    const proc = spawn(pythonCmd, args, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8');
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString('utf-8');
    });

    proc.on('close', (code: number) => {
      if (code !== 0) {
        return reject(
          new Error(
            `Monte Carlo Python process exited with code ${code}: ${stderrBuffer || stdoutBuffer}`
          )
        );
      }

      try {
        const jsonStart = stdoutBuffer.indexOf('{');
        const jsonEnd = stdoutBuffer.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error(`Failed to locate JSON payload in output: ${stdoutBuffer}`);
        }
        const jsonStr = stdoutBuffer.slice(jsonStart, jsonEnd + 1);
        const parsed: MonteCarloSimulationResult = JSON.parse(jsonStr);
        resolve(parsed);
      } catch (err: any) {
        reject(
          new Error(`Failed to parse Monte Carlo simulation output: ${err.message}. Raw: ${stdoutBuffer.slice(0, 300)}`)
        );
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}
