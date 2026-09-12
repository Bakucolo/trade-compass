/**
 * Options Greeks & Portfolio Theta Analytics Utility
 * Provides Black-Scholes pricing and aggregate Theta decay / time-income calculations
 * across individual option contracts and unified multi-broker portfolios.
 */

// Standard Normal CDF approximation (Abramowitz & Stegun)
export function normalCdf(x: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (x >= 0.0) {
    const k = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp(-x * x / 2.0) * k *
      (k * (k * (k * (k * b5 + b4) + b3) + b2) + b1);
  } else {
    const k = 1.0 / (1.0 - p * x);
    return c * Math.exp(-x * x / 2.0) * k *
      (k * (k * (k * (k * b5 + b4) + b3) + b2) + b1);
  }
}

// Standard Normal PDF
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number; // 1-day decay per contract share in dollars (negative by standard Black-Scholes definition)
  vega: number;
}

/**
 * Calculate Black-Scholes option Greeks including 1-day Theta decay
 *
 * @param spot Current underlying spot price
 * @param strike Option strike price
 * @param dte Days to expiration (minimum 0.5 day)
 * @param ivDecimal Implied volatility (e.g. 0.35 for 35% IV)
 * @param type Option type ('CALL' | 'PUT')
 * @param r Risk-free rate (e.g. 0.045 for 4.5%)
 */
export function calculateGreeks(
  spot: number,
  strike: number,
  dte: number,
  ivDecimal: number = 0.35,
  type: 'CALL' | 'PUT' = 'CALL',
  r: number = 0.045
): OptionGreeks {
  if (spot <= 0 || strike <= 0 || dte <= 0) {
    return { delta: type === 'CALL' ? 0.5 : -0.5, gamma: 0, theta: 0, vega: 0 };
  }

  const T = Math.max(0.001, dte / 365.0);
  const sigma = Math.max(0.05, Math.min(3.0, ivDecimal));
  const sqrtT = Math.sqrt(T);

  const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2.0) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const nd1 = normalCdf(d1);
  const nd2 = normalCdf(d2);
  const npdfD1 = normalPdf(d1);

  let delta = 0;
  if (type === 'CALL') {
    delta = nd1;
  } else {
    delta = nd1 - 1.0;
  }

  // Gamma is identical for call and put
  const gamma = npdfD1 / (spot * sigma * sqrtT);

  // Theta (1 day decay in dollars per contract share)
  let theta = 0;
  const term1 = -(spot * npdfD1 * sigma) / (2 * sqrtT);
  if (type === 'CALL') {
    theta = (term1 - r * strike * Math.exp(-r * T) * nd2) / 365.0;
  } else {
    theta = (term1 + r * strike * Math.exp(-r * T) * normalCdf(-d2)) / 365.0;
  }

  // Vega (dollar change per 1% change in IV)
  const vega = (spot * sqrtT * npdfD1) / 100.0;

  return {
    delta: Number(delta.toFixed(3)),
    gamma: Number(gamma.toFixed(4)),
    theta: Number(theta.toFixed(4)),
    vega: Number(vega.toFixed(3)),
  };
}

/**
 * Helper to parse Days to Expiration (DTE) from an option expiry string
 */
export function parseDteFromExpiry(expiryStr?: string): number {
  if (!expiryStr) return 30; // Default 30 DTE fallback

  try {
    let expDate: Date;
    const clean = String(expiryStr).trim();

    if (/^\d{8}$/.test(clean)) {
      // YYYYMMDD
      const y = Number(clean.substring(0, 4));
      const m = Number(clean.substring(4, 6)) - 1;
      const d = Number(clean.substring(6, 8));
      expDate = new Date(y, m, d, 16, 0, 0);
    } else {
      expDate = new Date(clean);
    }

    if (isNaN(expDate.getTime())) return 30;

    const now = new Date();
    const diffMs = expDate.getTime() - now.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  } catch {
    return 30;
  }
}

export interface PositionThetaResult {
  symbol: string;
  underlyingSymbol: string;
  strike?: number;
  expiry?: string;
  optionType: 'CALL' | 'PUT';
  quantity: number;
  isShort: boolean;
  dte: number;
  thetaPerShare: number;
  dailyDollarTheta: number; // Positive = income/gain per day; Negative = cost/decay per day
  monthlyDollarTheta: number;
  broker?: string;
  brokerName?: string;
  currentPrice?: number;
  averageCost?: number;
  marketValue?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  underlyingPrice?: number;
  description?: string;
  rawPosition?: any;
}

export interface PortfolioThetaSummary {
  totalDailyTheta: number; // Net $ / day (+ = income, - = decay)
  totalMonthlyTheta: number; // Net $ / month (+ = income, - = decay)
  annualizedThetaYieldPercent: number; // (totalDailyTheta * 365 / netLiq) * 100
  shortOptionsTheta: number; // Total positive cash flow collected from short options ($/day)
  longOptionsTheta: number; // Total negative decay paid on long options ($/day)
  shortOptionsCount: number;
  longOptionsCount: number;
  totalOptionsCount: number;
  positionsTheta: PositionThetaResult[];
  regime: 'POSITIVE_INCOME' | 'BALANCED' | 'THETA_DRAG' | 'NO_OPTIONS';
}

/**
 * Calculate Theta telemetry for an individual position
 */
export function calculatePositionTheta(pos: any): PositionThetaResult | null {
  if (!pos) return null;

  const isOption = pos.assetType === 'Option' || pos.assetType === 'OPTION';
  if (!isOption) return null;

  const qty = Number(pos.quantity ?? pos.shares ?? 0);
  if (qty === 0) return null;

  const isShort = qty < 0;

  // Determine option type
  let optionType: 'CALL' | 'PUT' = 'CALL';
  const rawOptType = String(pos.optionType || '').toUpperCase();
  if (rawOptType.startsWith('P') || pos.symbol?.includes('P') || pos.description?.includes(' PUT')) {
    optionType = 'PUT';
  } else if (rawOptType.startsWith('C') || pos.symbol?.includes('C') || pos.description?.includes(' CALL')) {
    optionType = 'CALL';
  }

  const strike = Number(pos.strikePrice || pos.strike || 0);
  const expiry = pos.expiryDate || pos.expiry || '';
  const dte = pos.dte ? Number(pos.dte) : parseDteFromExpiry(expiry);

  // Spot price of underlying
  const spot = Number(
    pos.underlyingPrice ||
    (strike > 0 ? strike : 100)
  );

  const cleanStrike = strike > 0 ? strike : (spot > 0 ? spot : 100);

  // Use broker provided theta if available, otherwise compute Black-Scholes
  let thetaPerShare = 0;
  if (pos.theta !== undefined && pos.theta !== null && pos.theta !== 0) {
    thetaPerShare = Number(pos.theta);
    // Ensure standard negative sign for per-share decay
    if (thetaPerShare > 0) thetaPerShare = -thetaPerShare;
  } else {
    const greeks = calculateGreeks(spot, cleanStrike, dte, 0.35, optionType);
    thetaPerShare = greeks.theta;
  }

  // 1 Contract = 100 shares
  // For short positions (qty < 0): you collect theta time decay -> positive cash flow (+$/day)
  // For long positions (qty > 0): you pay theta decay -> negative cash flow (-$/day)
  const multiplier = 100;
  const contractThetaDaily = thetaPerShare * multiplier; // negative per contract e.g. -$13.26/day
  const dailyDollarTheta = qty * contractThetaDaily; // (-2) * (-13.26) = +$26.52/day for short; (+1) * (-13.26) = -$13.26/day for long
  const monthlyDollarTheta = dailyDollarTheta * 30;

  return {
    symbol: pos.symbol || '',
    underlyingSymbol: pos.underlyingSymbol || pos.symbol || '',
    strike: cleanStrike,
    expiry,
    optionType,
    quantity: qty,
    isShort,
    dte,
    thetaPerShare: Number(thetaPerShare.toFixed(4)),
    dailyDollarTheta: Number(dailyDollarTheta.toFixed(2)),
    monthlyDollarTheta: Number(monthlyDollarTheta.toFixed(2)),
    broker: pos.broker || pos.brokerName || (pos.brokerId === 'ibkr' ? 'IBKR' : pos.brokerId === 'tastytrade' ? 'Tastytrade' : undefined),
    brokerName: pos.brokerName || pos.broker,
    currentPrice: pos.currentPrice !== undefined ? Number(pos.currentPrice) : undefined,
    averageCost: pos.averageCost !== undefined ? Number(pos.averageCost) : undefined,
    marketValue: pos.marketValue !== undefined ? Number(pos.marketValue) : undefined,
    unrealizedPnL: pos.unrealizedPnL !== undefined ? Number(pos.unrealizedPnL) : (pos.unrealizedPL !== undefined ? Number(pos.unrealizedPL) : (pos.totalPnL !== undefined ? Number(pos.totalPnL) : undefined)),
    unrealizedPnLPercent: pos.unrealizedPnLPercent !== undefined ? Number(pos.unrealizedPnLPercent) : (pos.unrealizedPLPercent !== undefined ? Number(pos.unrealizedPLPercent) : (pos.totalPnLPercent !== undefined ? Number(pos.totalPnLPercent) : undefined)),
    underlyingPrice: spot,
    description: pos.description || undefined,
    rawPosition: pos,
  };
}

/**
 * Calculate the overall Aggregate Theta metric across the entire portfolio
 *
 * @param positions List of all portfolio holdings (unified across brokers)
 * @param netLiquidatingValue Total portfolio net liquidation for yield calculation
 */
export function calculatePortfolioTheta(
  positions: any[] = [],
  netLiquidatingValue: number = 0
): PortfolioThetaSummary {
  if (!positions || positions.length === 0) {
    return {
      totalDailyTheta: 0,
      totalMonthlyTheta: 0,
      annualizedThetaYieldPercent: 0,
      shortOptionsTheta: 0,
      longOptionsTheta: 0,
      shortOptionsCount: 0,
      longOptionsCount: 0,
      totalOptionsCount: 0,
      positionsTheta: [],
      regime: 'NO_OPTIONS',
    };
  }

  const results: PositionThetaResult[] = [];
  let shortThetaSum = 0;
  let longThetaSum = 0;
  let shortCount = 0;
  let longCount = 0;

  for (const pos of positions) {
    const pt = calculatePositionTheta(pos);
    if (!pt) continue;

    results.push(pt);

    if (pt.isShort) {
      shortThetaSum += pt.dailyDollarTheta; // Positive income
      shortCount += Math.abs(pt.quantity);
    } else {
      longThetaSum += pt.dailyDollarTheta; // Negative decay
      longCount += Math.abs(pt.quantity);
    }
  }

  const totalDailyTheta = Number((shortThetaSum + longThetaSum).toFixed(2));
  const totalMonthlyTheta = Number((totalDailyTheta * 30).toFixed(2));
  const netLiq = netLiquidatingValue > 0 ? netLiquidatingValue : 1;
  const annualizedThetaYieldPercent = Number(((totalDailyTheta * 365 / netLiq) * 100).toFixed(2));

  let regime: PortfolioThetaSummary['regime'] = 'NO_OPTIONS';
  if (results.length > 0) {
    if (totalDailyTheta > 5) {
      regime = 'POSITIVE_INCOME';
    } else if (totalDailyTheta < -5) {
      regime = 'THETA_DRAG';
    } else {
      regime = 'BALANCED';
    }
  }

  return {
    totalDailyTheta,
    totalMonthlyTheta,
    annualizedThetaYieldPercent,
    shortOptionsTheta: Number(shortThetaSum.toFixed(2)),
    longOptionsTheta: Number(longThetaSum.toFixed(2)),
    shortOptionsCount: shortCount,
    longOptionsCount: longCount,
    totalOptionsCount: results.length,
    positionsTheta: results,
    regime,
  };
}
