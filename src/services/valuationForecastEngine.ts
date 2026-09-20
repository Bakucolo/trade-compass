export type ValuationMetricType = 'PE' | 'PS';

export interface ValuationInputs {
  startingPrice: number;
  startingRevenue: number; // in billions (e.g. 0.0319 for $31.9M) or millions
  startingMargin: number; // percentage, e.g. 30.0 for 30% (can be negative for early-stage companies)
  startingShares: number; // in billions (e.g. 0.1432 for 143.2M) or millions
  revenueGrowthRate: number; // percentage CAGR, e.g. 12.0 for 12%
  targetMargin: number; // percentage, e.g. 20.0 for mature margin
  exitMultiple: number; // P/E (or P/S if valuationMetric === 'PS')
  discountRate: number; // required annual return / WACC %, e.g. 10.0
  annualShareChangePct: number; // percentage change, e.g. -1.5 for buybacks, +1.0 for dilution
  horizonYears: number; // 3, 5, 7, or 10
  valuationMetric?: ValuationMetricType; // 'PE' (default) or 'PS' (Price-to-Sales for high growth / pre-profit)
}

export interface ForecastYearPoint {
  year: number; // 0, 1, 2, ...
  yearLabel: string; // "Current (Y0)", "Year 1", "Year 2"...
  revenue: number;
  margin: number;
  earningsOrFcf: number;
  shares: number;
  epsOrFcfPerShare: number;
  revenuePerShare: number;
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
  terminalRevPerShare: number;

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
  const g = typeof baseInputs.revenueGrowthRate === 'number' && !isNaN(baseInputs.revenueGrowthRate) ? baseInputs.revenueGrowthRate : 10.0;
  const m = typeof baseInputs.targetMargin === 'number' && !isNaN(baseInputs.targetMargin) ? baseInputs.targetMargin : 15.0;
  const pe = Math.max(1.0, Math.abs(baseInputs.exitMultiple) || 20.0);
  const isPs = baseInputs.valuationMetric === 'PS';
  const shareChange = typeof baseInputs.annualShareChangePct === 'number' && !isNaN(baseInputs.annualShareChangePct) ? baseInputs.annualShareChangePct : 0.0;

  return {
    BEAR: {
      ...baseInputs,
      exitMultiple: Math.max(isPs ? 1.5 : 8.0, Number((pe * 0.75).toFixed(1))),
      revenueGrowthRate: Math.max(-10, Number((g * 0.6).toFixed(1))),
      targetMargin: isPs ? m : Math.max(5, Number((m * 0.8).toFixed(1))),
      annualShareChangePct: Math.min(3.0, shareChange + 1.0),
    },
    BASE: {
      ...baseInputs,
      exitMultiple: pe,
    },
    BULL: {
      ...baseInputs,
      exitMultiple: Number((pe * 1.25).toFixed(1)),
      revenueGrowthRate: Number((g * 1.4).toFixed(1)),
      targetMargin: isPs ? m : Math.min(70, Number((m * 1.15).toFixed(1))),
      annualShareChangePct: Math.max(-4.0, shareChange - 0.5),
    },
  };
}

/**
 * Precision format helpers: ensure small-caps with < $1B revenue/shares don't truncate to 0.00
 */
const formatRev = (v: number): number => Number(v < 1 ? v.toFixed(4) : v.toFixed(2));
const formatShares = (v: number): number => Number(v < 1 ? v.toFixed(4) : v.toFixed(3));
const formatEps = (v: number): number => Number(Math.abs(v) < 0.1 ? v.toFixed(3) : v.toFixed(2));

/**
 * Core deterministic engine: Computes year-by-year stock price path from assumptions
 */
export function calculateValuationForecast(inputs: ValuationInputs): ValuationForecastResult {
  const safeStartingPrice = Math.max(0.01, typeof inputs.startingPrice === 'number' && !isNaN(inputs.startingPrice) ? inputs.startingPrice : 1.0);
  const safeStartingShares = Math.max(0.0001, typeof inputs.startingShares === 'number' && !isNaN(inputs.startingShares) ? inputs.startingShares : 0.1);
  const safeStartingRevenue = Math.max(0.0001, typeof inputs.startingRevenue === 'number' && !isNaN(inputs.startingRevenue) ? inputs.startingRevenue : 0.1);
  const safeTargetMargin = typeof inputs.targetMargin === 'number' && !isNaN(inputs.targetMargin) ? inputs.targetMargin : 15.0;
  const safeStartingMargin = typeof inputs.startingMargin === 'number' && !isNaN(inputs.startingMargin) ? inputs.startingMargin : safeTargetMargin;
  const safeRevenueGrowthRate = typeof inputs.revenueGrowthRate === 'number' && !isNaN(inputs.revenueGrowthRate) ? inputs.revenueGrowthRate : 10.0;
  const safeDiscountRate = typeof inputs.discountRate === 'number' && !isNaN(inputs.discountRate) ? inputs.discountRate : 10.0;
  const safeAnnualShareChangePct = typeof inputs.annualShareChangePct === 'number' && !isNaN(inputs.annualShareChangePct) ? inputs.annualShareChangePct : 0.0;
  const validHorizon = Math.max(1, Math.min(15, inputs.horizonYears || 5));
  const isPsMode = inputs.valuationMetric === 'PS';
  const defaultMult = isPsMode ? 4.0 : 20.0;
  const safeExitMultiple = Math.max(0.5, Math.abs(inputs.exitMultiple) || defaultMult);

  const cleanInputs: ValuationInputs = {
    ...inputs,
    startingPrice: safeStartingPrice,
    startingShares: safeStartingShares,
    startingRevenue: safeStartingRevenue,
    startingMargin: safeStartingMargin,
    targetMargin: safeTargetMargin,
    revenueGrowthRate: safeRevenueGrowthRate,
    discountRate: safeDiscountRate,
    annualShareChangePct: safeAnnualShareChangePct,
    horizonYears: validHorizon,
    exitMultiple: safeExitMultiple,
    valuationMetric: inputs.valuationMetric || 'PE',
  };

  const g = safeRevenueGrowthRate / 100;
  const r = safeDiscountRate / 100;
  const shareChange = safeAnnualShareChangePct / 100;

  // Generate Year-by-Year path
  const path: ForecastYearPoint[] = [];

  for (let t = 0; t <= validHorizon; t++) {
    if (t === 0) {
      // Baseline Year 0
      const earnings0 = safeStartingRevenue * (safeStartingMargin / 100);
      const eps0 = earnings0 / safeStartingShares;
      const revPerShare0 = safeStartingRevenue / safeStartingShares;

      path.push({
        year: 0,
        yearLabel: 'Current (Y0)',
        revenue: formatRev(safeStartingRevenue),
        margin: Number(safeStartingMargin.toFixed(1)),
        earningsOrFcf: formatRev(earnings0),
        shares: formatShares(safeStartingShares),
        epsOrFcfPerShare: formatEps(eps0),
        revenuePerShare: Number(revPerShare0.toFixed(2)),
        projectedPrice: Number(safeStartingPrice.toFixed(2)),
        discountedValue: Number(safeStartingPrice.toFixed(2)),
        cumulativeReturnPct: 0.0,
        annualizedCagrPct: 0.0,
      });
      continue;
    }

    // Projected Revenue
    const rev_t = safeStartingRevenue * Math.pow(1 + g, t);

    // Dynamic margin transition (linear glide from starting to target margin over horizon)
    const margin_t = safeStartingMargin + (safeTargetMargin - safeStartingMargin) * (t / validHorizon);

    // Projected Earnings / Free Cash Flow
    const earnings_t = rev_t * (margin_t / 100);

    // Projected Shares Outstanding
    const shares_t = safeStartingShares * Math.pow(1 + shareChange, t);

    // Projected EPS & Revenue per Share
    const eps_t = shares_t > 0 ? earnings_t / shares_t : 0;
    const revPerShare_t = shares_t > 0 ? rev_t / shares_t : 0;

    // Projected Stock Price:
    let projectedPrice_t = 0.01;
    if (isPsMode) {
      // Price-to-Sales methodology (ideal for growth / pre-profit companies)
      projectedPrice_t = Math.max(0.01, revPerShare_t * safeExitMultiple);
    } else {
      // P/E or P/FCF methodology
      if (eps_t > 0) {
        projectedPrice_t = Math.max(0.01, eps_t * safeExitMultiple);
      } else {
        // Pre-profit safeguard: If earnings are negative in early transition years,
        // use an implied revenue multiple floor so price doesn't absurdly crash to $0.01
        const impliedPs = Math.max(0.5, safeExitMultiple * 0.12);
        projectedPrice_t = Math.max(0.01, revPerShare_t * impliedPs);
      }
    }

    // Discounted Present Value
    const discountedValue_t = projectedPrice_t / Math.pow(1 + r, t);

    // Cumulative Return % from Current Price
    const cumulativeReturnPct = ((projectedPrice_t - safeStartingPrice) / safeStartingPrice) * 100;

    // Annualized Return (IRR / CAGR %)
    const annualizedCagrPct = (Math.pow(projectedPrice_t / safeStartingPrice, 1 / t) - 1) * 100;

    path.push({
      year: t,
      yearLabel: `Year ${t}`,
      revenue: formatRev(rev_t),
      margin: Number(margin_t.toFixed(1)),
      earningsOrFcf: formatRev(earnings_t),
      shares: formatShares(shares_t),
      epsOrFcfPerShare: formatEps(eps_t),
      revenuePerShare: Number(revPerShare_t.toFixed(2)),
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

  // Implied Intrinsic Value Today (Discounted value of terminal price at discountRate)
  const discountedFairValue = Number((terminalPoint.projectedPrice / Math.pow(1 + r, validHorizon)).toFixed(2));
  // Standard financial Margin of Safety: ((FairValue - CurrentPrice) / CurrentPrice) * 100
  const marginOfSafetyPct = Number((((discountedFairValue - safeStartingPrice) / safeStartingPrice) * 100).toFixed(1));
  const isUndervalued = marginOfSafetyPct > 0;

  // Generate Bear and Bull paths for corridor visualization
  const presets = getScenarioPresets(cleanInputs);
  const bearResult = calculateSimplePath(presets.BEAR, validHorizon);
  const bullResult = calculateSimplePath(presets.BULL, validHorizon);

  // Generate 2D Sensitivity Grid
  const sensitivityMatrix = generateSensitivityMatrix(cleanInputs, validHorizon);

  return {
    inputs: cleanInputs,
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
    terminalRevPerShare: terminalPoint.revenuePerShare,
    sensitivityMatrix,
  };
}

function calculateSimplePath(inputs: ValuationInputs, horizon: number): ForecastYearPoint[] {
  const g = (inputs.revenueGrowthRate ?? 10) / 100;
  const shareChange = (inputs.annualShareChangePct ?? 0) / 100;
  const isPs = inputs.valuationMetric === 'PS';
  const defaultMult = isPs ? 4.0 : 20.0;
  const safeExitMultiple = Math.max(0.5, Math.abs(inputs.exitMultiple) || defaultMult);
  const safeStartingPrice = Math.max(0.01, inputs.startingPrice ?? 1.0);
  const safeStartingShares = Math.max(0.0001, inputs.startingShares ?? 0.1);
  const safeStartingRevenue = Math.max(0.0001, inputs.startingRevenue ?? 0.1);
  const targetMargin = typeof inputs.targetMargin === 'number' && !isNaN(inputs.targetMargin) ? inputs.targetMargin : 15.0;
  const startingMargin = typeof inputs.startingMargin === 'number' && !isNaN(inputs.startingMargin) ? inputs.startingMargin : targetMargin;

  const points: ForecastYearPoint[] = [];

  for (let t = 0; t <= horizon; t++) {
    if (t === 0) {
      points.push({
        year: 0,
        yearLabel: 'Current (Y0)',
        revenue: formatRev(safeStartingRevenue),
        margin: Number(startingMargin.toFixed(1)),
        earningsOrFcf: formatRev(safeStartingRevenue * (startingMargin / 100)),
        shares: formatShares(safeStartingShares),
        epsOrFcfPerShare: formatEps((safeStartingRevenue * (startingMargin / 100)) / safeStartingShares),
        revenuePerShare: Number((safeStartingRevenue / safeStartingShares).toFixed(2)),
        projectedPrice: safeStartingPrice,
        discountedValue: safeStartingPrice,
        cumulativeReturnPct: 0,
        annualizedCagrPct: 0,
      });
      continue;
    }

    const rev = safeStartingRevenue * Math.pow(1 + g, t);
    const margin = startingMargin + (targetMargin - startingMargin) * (t / horizon);
    const earnings = rev * (margin / 100);
    const shares = safeStartingShares * Math.pow(1 + shareChange, t);
    const eps = shares > 0 ? earnings / shares : 0;
    const revPerShare = shares > 0 ? rev / shares : 0;

    let price = 0.01;
    if (isPs) {
      price = Math.max(0.01, revPerShare * safeExitMultiple);
    } else {
      if (eps > 0) {
        price = Math.max(0.01, eps * safeExitMultiple);
      } else {
        const impliedPs = Math.max(0.5, safeExitMultiple * 0.12);
        price = Math.max(0.01, revPerShare * impliedPs);
      }
    }

    const cumRet = ((price - safeStartingPrice) / safeStartingPrice) * 100;
    const cagr = (Math.pow(price / safeStartingPrice, 1 / t) - 1) * 100;

    points.push({
      year: t,
      yearLabel: `Year ${t}`,
      revenue: formatRev(rev),
      margin: Number(margin.toFixed(1)),
      earningsOrFcf: formatRev(earnings),
      shares: formatShares(shares),
      epsOrFcfPerShare: formatEps(eps),
      revenuePerShare: Number(revPerShare.toFixed(2)),
      projectedPrice: Number(price.toFixed(2)),
      discountedValue: Number((price / Math.pow(1 + (inputs.discountRate ?? 10) / 100, t)).toFixed(2)),
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
  const gBase = inputs.revenueGrowthRate ?? 10.0;
  const isPs = inputs.valuationMetric === 'PS';
  const defaultMult = isPs ? 4.0 : 20.0;
  const mBase = Math.max(0.5, Math.abs(inputs.exitMultiple) || defaultMult);
  const safeStartingPrice = Math.max(0.01, inputs.startingPrice ?? 1.0);
  const safeStartingShares = Math.max(0.0001, inputs.startingShares ?? 0.1);
  const safeStartingRevenue = Math.max(0.0001, inputs.startingRevenue ?? 0.1);
  const targetMargin = typeof inputs.targetMargin === 'number' && !isNaN(inputs.targetMargin) ? inputs.targetMargin : 15.0;
  const annualShareChangePct = inputs.annualShareChangePct ?? 0.0;

  // 5 growth steps around base
  const growthRates = [
    Number((gBase - 6).toFixed(1)),
    Number((gBase - 3).toFixed(1)),
    Number(gBase.toFixed(1)),
    Number((gBase + 3).toFixed(1)),
    Number((gBase + 6).toFixed(1)),
  ];

  // 5 multiple steps around base
  const step = isPs ? Math.max(0.5, Number((mBase * 0.15).toFixed(1))) : 3.0;
  const minMult = isPs ? 1.0 : 6.0;
  const multiples = [
    Math.max(minMult, Number((mBase - step * 2).toFixed(1))),
    Math.max(minMult, Number((mBase - step).toFixed(1))),
    Number(mBase.toFixed(1)),
    Number((mBase + step).toFixed(1)),
    Number((mBase + step * 2).toFixed(1)),
  ];

  const cells: ValuationSensitivityCell[][] = [];

  for (let r = 0; r < growthRates.length; r++) {
    const row: ValuationSensitivityCell[] = [];
    const g = growthRates[r];

    for (let c = 0; c < multiples.length; c++) {
      const mult = multiples[c];

      const rev_n = safeStartingRevenue * Math.pow(1 + g / 100, horizon);
      const shares_n = safeStartingShares * Math.pow(1 + annualShareChangePct / 100, horizon);
      const revPerShare_n = shares_n > 0 ? rev_n / shares_n : 0;

      let projPrice = 0.01;
      if (isPs) {
        projPrice = Math.max(0.01, Number((revPerShare_n * mult).toFixed(2)));
      } else {
        const earnings_n = rev_n * (targetMargin / 100);
        const eps_n = shares_n > 0 ? earnings_n / shares_n : 0;
        if (eps_n > 0) {
          projPrice = Math.max(0.01, Number((eps_n * mult).toFixed(2)));
        } else {
          const impliedPs = Math.max(0.5, mult * 0.12);
          projPrice = Math.max(0.01, Number((revPerShare_n * impliedPs).toFixed(2)));
        }
      }

      const totReturn = Number((((projPrice - safeStartingPrice) / safeStartingPrice) * 100).toFixed(1));
      const cagr = Number(((Math.pow(projPrice / safeStartingPrice, 1 / horizon) - 1) * 100).toFixed(1));

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
