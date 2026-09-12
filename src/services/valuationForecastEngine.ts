export interface ValuationInputs {
  startingPrice: number;
  startingRevenue: number; // in billions or millions (matching startingShares / netIncome scale)
  startingMargin: number; // percentage, e.g. 30.0 for 30%
  startingShares: number; // in billions or millions
  revenueGrowthRate: number; // percentage CAGR, e.g. 12.0 for 12%
  targetMargin: number; // percentage, e.g. 32.0 for 32%
  exitMultiple: number; // P/E or P/FCF multiple, e.g. 25.0
  discountRate: number; // required annual return / WACC %, e.g. 10.0
  annualShareChangePct: number; // percentage change, e.g. -1.5 for buybacks, +1.0 for dilution
  horizonYears: number; // 3, 5, 7, or 10
}

export interface ForecastYearPoint {
  year: number; // 0, 1, 2, ...
  yearLabel: string; // "Current (Y0)", "Year 1", "Year 2"...
  revenue: number;
  margin: number;
  earningsOrFcf: number;
  shares: number;
  epsOrFcfPerShare: number;
  projectedPrice: number;
  discountedValue: number; // present value of that projected price
  cumulativeReturnPct: number;
  annualizedCagrPct: number;
}

export interface ValuationSensitivityCell {
  growthRate: number;
  multiple: number;
  projectedPrice: number;
  totalReturnPct: number;
  annualizedCagrPct: number;
  isBaseCase: boolean;
}

export interface ValuationForecastResult {
  inputs: ValuationInputs;
  path: ForecastYearPoint[];
  bearPath: ForecastYearPoint[];
  bullPath: ForecastYearPoint[];

  projectedTargetPrice: number;
  totalReturnPct: number;
  annualizedCagrPct: number;

  discountedFairValue: number;
  marginOfSafetyPct: number; // positive = undervalued (discount), negative = overvalued (premium)
  isUndervalued: boolean;

  terminalEarnings: number;
  terminalRevenue: number;
  terminalShares: number;
  terminalEps: number;

  sensitivityMatrix: {
    growthRates: number[];
    multiples: number[];
    cells: ValuationSensitivityCell[][];
  };
}

export type ScenarioPresetType = 'BEAR' | 'BASE' | 'BULL';

/**
 * Generate sensible presets tailored to a company's baseline
 */
export function getScenarioPresets(baseInputs: ValuationInputs): Record<ScenarioPresetType, ValuationInputs> {
  const g = baseInputs.revenueGrowthRate;
  const m = baseInputs.targetMargin;
  const pe = baseInputs.exitMultiple;

  return {
    BEAR: {
      ...baseInputs,
      revenueGrowthRate: Math.max(-5, Number((g * 0.6).toFixed(1))),
      targetMargin: Math.max(5, Number((m * 0.8).toFixed(1))),
      exitMultiple: Math.max(8, Number((pe * 0.75).toFixed(1))),
      annualShareChangePct: Math.min(2.5, baseInputs.annualShareChangePct + 1.0),
    },
    BASE: {
      ...baseInputs,
    },
    BULL: {
      ...baseInputs,
      revenueGrowthRate: Number((g * 1.4).toFixed(1)),
      targetMargin: Math.min(70, Number((m * 1.15).toFixed(1))),
      exitMultiple: Number((pe * 1.25).toFixed(1)),
      annualShareChangePct: Math.max(-4.0, baseInputs.annualShareChangePct - 0.5),
    },
  };
}

/**
 * Core deterministic engine: Computes year-by-year stock price path from assumptions
 */
export function calculateValuationForecast(inputs: ValuationInputs): ValuationForecastResult {
  const {
    startingPrice,
    startingRevenue,
    startingMargin,
    startingShares,
    revenueGrowthRate,
    targetMargin,
    exitMultiple,
    discountRate,
    annualShareChangePct,
    horizonYears,
  } = inputs;

  const validHorizon = Math.max(1, Math.min(15, horizonYears || 5));
  const safeStartingPrice = Math.max(0.01, startingPrice);
  const safeStartingShares = Math.max(0.001, startingShares);
  const safeStartingRevenue = Math.max(0.01, startingRevenue);

  const g = revenueGrowthRate / 100;
  const r = discountRate / 100;
  const shareChange = annualShareChangePct / 100;

  // Generate Year-by-Year path
  const path: ForecastYearPoint[] = [];

  for (let t = 0; t <= validHorizon; t++) {
    if (t === 0) {
      // Baseline Year 0
      const earnings0 = safeStartingRevenue * (startingMargin / 100);
      const eps0 = earnings0 / safeStartingShares;
      path.push({
        year: 0,
        yearLabel: 'Current (Y0)',
        revenue: Number(safeStartingRevenue.toFixed(2)),
        margin: Number(startingMargin.toFixed(1)),
        earningsOrFcf: Number(earnings0.toFixed(2)),
        shares: Number(safeStartingShares.toFixed(3)),
        epsOrFcfPerShare: Number(eps0.toFixed(2)),
        projectedPrice: Number(safeStartingPrice.toFixed(2)),
        discountedValue: Number(safeStartingPrice.toFixed(2)),
        cumulativeReturnPct: 0.0,
        annualizedCagrPct: 0.0,
      });
      continue;
    }

    // Projected Revenue
    const rev_t = safeStartingRevenue * Math.pow(1 + g, t);

    // Dynamic margin transition (linear glide from starting to target margin over the horizon)
    const margin_t = startingMargin + (targetMargin - startingMargin) * (t / validHorizon);

    // Projected Earnings / Free Cash Flow
    const earnings_t = rev_t * (margin_t / 100);

    // Projected Shares Outstanding
    const shares_t = safeStartingShares * Math.pow(1 + shareChange, t);

    // Projected EPS / FCF per Share
    const eps_t = shares_t > 0 ? earnings_t / shares_t : 0;

    // Projected Stock Price: Price_t = EPS_t * ExitMultiple
    const projectedPrice_t = Math.max(0.01, eps_t * exitMultiple);

    // Discounted Present Value
    const discountedValue_t = projectedPrice_t / Math.pow(1 + r, t);

    // Cumulative Return % from Current Price
    const cumulativeReturnPct = ((projectedPrice_t - safeStartingPrice) / safeStartingPrice) * 100;

    // Annualized Return (IRR / CAGR %)
    const annualizedCagrPct = (Math.pow(projectedPrice_t / safeStartingPrice, 1 / t) - 1) * 100;

    path.push({
      year: t,
      yearLabel: `Year ${t}`,
      revenue: Number(rev_t.toFixed(2)),
      margin: Number(margin_t.toFixed(1)),
      earningsOrFcf: Number(earnings_t.toFixed(2)),
      shares: Number(shares_t.toFixed(3)),
      epsOrFcfPerShare: Number(eps_t.toFixed(2)),
      projectedPrice: Number(projectedPrice_t.toFixed(2)),
      discountedValue: Number(discountedValue_t.toFixed(2)),
      cumulativeReturnPct: Number(cumulativeReturnPct.toFixed(1)),
      annualizedCagrPct: Number(annualizedCagrPct.toFixed(1)),
    });
  }

  // Summary Metrics at Horizon Year N
  const terminalPoint = path[path.length - 1];
  const projectedTargetPrice = terminalPoint.projectedPrice;
  const totalReturnPct = terminalPoint.cumulativeReturnPct;
  const annualizedCagrPct = terminalPoint.annualizedCagrPct;

  // Implied Intrinsic Value Today (Discounted value of terminal price + intermediate cash flows)
  // Standard terminal DCF fair value:
  const discountedFairValue = Number((terminalPoint.projectedPrice / Math.pow(1 + r, validHorizon)).toFixed(2));
  const marginOfSafetyPct = Number((((discountedFairValue - safeStartingPrice) / discountedFairValue) * 100).toFixed(1));
  const isUndervalued = marginOfSafetyPct > 0;

  // Generate Bear and Bull paths for corridor visualization
  const presets = getScenarioPresets(inputs);
  const bearResult = calculateSimplePath(presets.BEAR, validHorizon);
  const bullResult = calculateSimplePath(presets.BULL, validHorizon);

  // Generate 2D Sensitivity Grid
  const sensitivityMatrix = generateSensitivityMatrix(inputs, validHorizon);

  return {
    inputs,
    path,
    bearPath: bearResult,
    bullPath: bullResult,
    projectedTargetPrice,
    totalReturnPct,
    annualizedCagrPct,
    discountedFairValue,
    marginOfSafetyPct,
    isUndervalued,
    terminalEarnings: terminalPoint.earningsOrFcf,
    terminalRevenue: terminalPoint.revenue,
    terminalShares: terminalPoint.shares,
    terminalEps: terminalPoint.epsOrFcfPerShare,
    sensitivityMatrix,
  };
}

function calculateSimplePath(inputs: ValuationInputs, horizon: number): ForecastYearPoint[] {
  const g = inputs.revenueGrowthRate / 100;
  const shareChange = inputs.annualShareChangePct / 100;
  const points: ForecastYearPoint[] = [];

  for (let t = 0; t <= horizon; t++) {
    if (t === 0) {
      points.push({
        year: 0,
        yearLabel: 'Current (Y0)',
        revenue: inputs.startingRevenue,
        margin: inputs.startingMargin,
        earningsOrFcf: inputs.startingRevenue * (inputs.startingMargin / 100),
        shares: inputs.startingShares,
        epsOrFcfPerShare: (inputs.startingRevenue * (inputs.startingMargin / 100)) / inputs.startingShares,
        projectedPrice: inputs.startingPrice,
        discountedValue: inputs.startingPrice,
        cumulativeReturnPct: 0,
        annualizedCagrPct: 0,
      });
      continue;
    }

    const rev = inputs.startingRevenue * Math.pow(1 + g, t);
    const margin = inputs.startingMargin + (inputs.targetMargin - inputs.startingMargin) * (t / horizon);
    const earnings = rev * (margin / 100);
    const shares = inputs.startingShares * Math.pow(1 + shareChange, t);
    const eps = shares > 0 ? earnings / shares : 0;
    const price = Math.max(0.01, eps * inputs.exitMultiple);
    const cumRet = ((price - inputs.startingPrice) / inputs.startingPrice) * 100;
    const cagr = (Math.pow(price / inputs.startingPrice, 1 / t) - 1) * 100;

    points.push({
      year: t,
      yearLabel: `Year ${t}`,
      revenue: Number(rev.toFixed(2)),
      margin: Number(margin.toFixed(1)),
      earningsOrFcf: Number(earnings.toFixed(2)),
      shares: Number(shares.toFixed(3)),
      epsOrFcfPerShare: Number(eps.toFixed(2)),
      projectedPrice: Number(price.toFixed(2)),
      discountedValue: Number((price / Math.pow(1 + inputs.discountRate / 100, t)).toFixed(2)),
      cumulativeReturnPct: Number(cumRet.toFixed(1)),
      annualizedCagrPct: Number(cagr.toFixed(1)),
    });
  }

  return points;
}

/**
 * 2D Valuation Sensitivity Grid: Growth Rate (rows) vs Multiples (columns)
 */
function generateSensitivityMatrix(
  inputs: ValuationInputs,
  horizon: number
): {
  growthRates: number[];
  multiples: number[];
  cells: ValuationSensitivityCell[][];
} {
  const gBase = inputs.revenueGrowthRate;
  const mBase = inputs.exitMultiple;

  // 5 growth steps around base
  const growthRates = [
    Number((gBase - 6).toFixed(1)),
    Number((gBase - 3).toFixed(1)),
    Number(gBase.toFixed(1)),
    Number((gBase + 3).toFixed(1)),
    Number((gBase + 6).toFixed(1)),
  ];

  // 5 multiple steps around base
  const multiples = [
    Math.max(5, Number((mBase - 6).toFixed(1))),
    Math.max(6, Number((mBase - 3).toFixed(1))),
    Number(mBase.toFixed(1)),
    Number((mBase + 3).toFixed(1)),
    Number((mBase + 6).toFixed(1)),
  ];

  const cells: ValuationSensitivityCell[][] = [];

  for (let r = 0; r < growthRates.length; r++) {
    const row: ValuationSensitivityCell[] = [];
    const g = growthRates[r];

    for (let c = 0; c < multiples.length; c++) {
      const mult = multiples[c];

      const rev_n = inputs.startingRevenue * Math.pow(1 + g / 100, horizon);
      const earnings_n = rev_n * (inputs.targetMargin / 100);
      const shares_n = inputs.startingShares * Math.pow(1 + inputs.annualShareChangePct / 100, horizon);
      const eps_n = shares_n > 0 ? earnings_n / shares_n : 0;
      const projPrice = Math.max(0.01, Number((eps_n * mult).toFixed(2)));

      const totReturn = Number((((projPrice - inputs.startingPrice) / inputs.startingPrice) * 100).toFixed(1));
      const cagr = Number(((Math.pow(projPrice / inputs.startingPrice, 1 / horizon) - 1) * 100).toFixed(1));

      row.push({
        growthRate: g,
        multiple: mult,
        projectedPrice: projPrice,
        totalReturnPct: totReturn,
        annualizedCagrPct: cagr,
        isBaseCase: r === 2 && c === 2,
      });
    }
    cells.push(row);
  }

  return { growthRates, multiples, cells };
}
