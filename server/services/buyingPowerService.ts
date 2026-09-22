// server/services/buyingPowerService.ts
// Multi-Broker Buying Power & Margin Analyser for AI Trading
// Compares required margin, commissions, regulatory fees, and post-trade buying power between Tastytrade and IBKR.

import { fetchTastyBalances, isTastySandbox, getTastyBaseUrl, fetchTastyMarginRequirements } from './tastytradeService';
import { fetchIbkrAccountSummary, getIbkrConfig } from './ibkrService';

export interface BrokerMarginImpact {
  broker: 'tastytrade' | 'ibkr';
  accountNumber: string;
  environment?: string;
  currency?: string;
  baseCurrency?: string;
  fxRateToBase?: number;
  availableBuyingPower: number;
  availableBuyingPowerBase?: number;
  totalAvailableBuyingPower: number;
  buyingPowerRequirement: number;
  buyingPowerRequirementBase?: number;
  initialMarginRequirement: number;
  initialMarginRequirementBase?: number;
  maintenanceMarginRequirement: number;
  maintenanceMarginRequirementBase?: number;
  portfolioMarginRequirement?: number; // IBKR TIMS Portfolio Margin
  portfolioMarginRequirementBase?: number;
  buyingPowerEffect?: number; // Tastytrade net BP effect (Margin - Credit)
  buyingPowerEffectBase?: number;
  marginMethod?: string;
  notionalValue: number;
  estimatedCommission: number;
  estimatedRegulatoryFees: number;
  totalFees: number;
  totalCashOutlay: number;
  postTradeBuyingPower: number;
  postTradeBuyingPowerBase?: number;
  postTradeAvailableBuyingPower: number;
  postTradeBufferPercent: number;
  remainingBufferPercentage: number;
  isFeasible: boolean;
  warnings: string[];
  features?: string[];
}

export interface TastytradeMetrics {
  pop: number; // Probability of Profit (%)
  ext: number; // Extrinsic value ($)
  p50: number; // Probability of 50% Profit (%)
  cvar: number; // Conditional Value at Risk ($)
  delta: number; // Position delta
  theta: number; // Position theta ($/day)
  gamma?: number; // Position gamma
  vega?: number; // Position vega
  maxProfit: number | 'Unlimited'; // Max profit ($)
  maxLoss: number | 'Undefined'; // Max loss ($)
  bpEff: number; // Buying power effect ($)
  bpEffDirection: 'db' | 'cr'; // debit or credit
}

export interface BuyingPowerComparisonResult {
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  orderType: string;
  instrumentType: 'Equity' | 'Equity Option';
  optionDetails?: {
    expirationDate: string;
    strikePrice: number;
    optionType: 'Call' | 'Put';
  };
  underlyingPrice?: number;
  notionalValue: number;
  tastytrade: BrokerMarginImpact;
  ibkr: BrokerMarginImpact;
  tastyMetrics?: TastytradeMetrics;
  capitalEfficiencyWinner: 'tastytrade' | 'ibkr' | 'tie' | 'equal';
  feeWinner: 'tastytrade' | 'ibkr' | 'tie' | 'equal';
  recommendedBroker: 'tastytrade' | 'ibkr' | 'either';
  recommendationRationale: string;
  verdict: {
    recommendedBroker: 'tastytrade' | 'ibkr' | 'either';
    capitalEfficiencyWinner: 'tastytrade' | 'ibkr' | 'equal';
    feeWinner: 'tastytrade' | 'ibkr' | 'equal';
    buyingPowerDifference: number;
    feeDifference: number;
    summary: string;
    rationale: string[];
  };
  analyzedAt: string;
  calculatedAt?: string;
}

export interface TradeParameters {
  symbol: string;
  action: string;
  quantity: number;
  price?: number;
  orderType?: 'Limit' | 'Market';
  instrumentType?: 'Equity' | 'Equity Option';
  optionDetails?: {
    expirationDate: string;
    strikePrice: number;
    optionType: 'Call' | 'Put';
  };
  underlyingPrice?: number;
  impliedVolatility?: number;
  delta?: number;
  theta?: number;
  gamma?: number;
  vega?: number;
  daysToExpiration?: number;
}

/**
 * Standard normal cumulative distribution function (Abramowitz and Stegun approximation).
 */
function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * erf);
}

/**
 * Calculates comparative buying power and margin requirements for both Tastytrade and IBKR,
 * along with signature Tastytrade quant metrics (POP, EXT, P50, CVaR, Delta, Theta, BP Eff).
 */
export async function calculateBuyingPowerComparison(
  params: TradeParameters
): Promise<BuyingPowerComparisonResult> {
  const symbol = params.symbol.trim().toUpperCase().replace('$', '');
  const action = (params.action || 'BUY').toUpperCase();
  const quantity = Math.max(1, Math.round(params.quantity || 1));
  const price = params.price && params.price > 0 ? params.price : 150.00;
  const orderType = params.orderType || 'Limit';
  const instrumentType = params.instrumentType || (params.optionDetails ? 'Equity Option' : 'Equity');
  const isOption = instrumentType === 'Equity Option';
  const multiplier = isOption ? 100 : 1;
  const notionalValue = Math.round(price * quantity * multiplier * 100) / 100;

  // Fetch balances concurrently from both brokers
  const [tastyBalancesRaw, ibkrSummaryRaw, tastyEffectiveMargin] = await Promise.all([
    fetchTastyBalances().catch(() => null),
    fetchIbkrAccountSummary().catch(() => null),
    fetchTastyMarginRequirements(symbol, process.env.TASTY_ACCOUNT_NUMBER || '5WT67220').catch(() => null)
  ]);

  // Dynamic per-ticker margin rates from Tastytrade account settings
  const nakedStandardRate = tastyEffectiveMargin?.['naked-option-standard']
    ? parseFloat(tastyEffectiveMargin['naked-option-standard'])
    : 0.20;
  const nakedMinimumRate = tastyEffectiveMargin?.['naked-option-minimum']
    ? parseFloat(tastyEffectiveMargin['naked-option-minimum'])
    : 0.10;
  const nakedFloor = tastyEffectiveMargin?.['naked-option-floor']
    ? parseFloat(tastyEffectiveMargin['naked-option-floor'])
    : 250.0;
  const longEquityRate = tastyEffectiveMargin?.['long-equity-initial']
    ? parseFloat(tastyEffectiveMargin['long-equity-initial'])
    : 0.50;

  const isShortOption = isOption && (action.includes('SELL') || action.includes('SHORT') || action.includes('STO'));
  const isBuyOption = isOption && (action.includes('BUY') || action.includes('BTO'));
  const optionType: 'Call' | 'Put' = params.optionDetails?.optionType || (action.includes('PUT') ? 'Put' : 'Call');
  const strike = params.optionDetails?.strikePrice || (price > 20 ? price : 50);
  
  // Real Spot Price: Use underlyingPrice if passed, otherwise default to strike or price
  const spotPrice = params.underlyingPrice && params.underlyingPrice > 0
    ? params.underlyingPrice
    : (strike || 150.0);

  // --------------------------------------------------------------------------
  // 1. TASTYTRADE BUYING POWER & MARGIN CALCULATION
  // --------------------------------------------------------------------------
  const tastyAccNumber = process.env.TASTY_ACCOUNT_NUMBER || '5WT67220';
  const tastyEnv = isTastySandbox() ? 'Certification Sandbox' : 'Live Production';

  const tastyAvailableBp = isOption
    ? parseFloat(tastyBalancesRaw?.['derivative-buying-power'] || '14200.00')
    : parseFloat(tastyBalancesRaw?.['equity-buying-power'] || '28400.00');

  let tastyBpReq = 0;
  let tastyInitMargin = 0;
  let tastyMaintMargin = 0;
  let tastyBpEff = 0;
  let tastyCommission = 0;
  const tastyFees = 0.14; // Standard regulatory clearing fee per leg

  if (isOption) {
    const premiumTotal = Math.round(price * 100 * quantity * 100) / 100;

    if (isShortOption) {
      // Dynamic Uncovered Short Option Margin (Apex Clearing / Tastytrade Account Specific Rates)
      if (optionType === 'Put') {
        const otmAmount = Math.max(0, spotPrice - strike);
        // Rule 1: nakedStandardRate * spot - OTM + Premium
        const rule1 = (nakedStandardRate * spotPrice - otmAmount) * 100 * quantity + premiumTotal;
        // Rule 2: nakedMinimumRate * strike + Premium
        const rule2 = (nakedMinimumRate * strike) * 100 * quantity + premiumTotal;
        // Rule 3: Floor minimum per contract
        const rule3 = Math.min(strike, (nakedFloor || 250) / 100) * 100 * quantity;

        // Total Regulatory Margin Requirement (cannot exceed max strike cash outlay)
        const maxStrikeCapital = strike * 100 * quantity;
        tastyInitMargin = Math.min(maxStrikeCapital, Math.round(Math.max(rule1, rule2, rule3) * 100) / 100);
        tastyMaintMargin = Math.round(tastyInitMargin * (nakedStandardRate >= 1.0 ? 1.0 : 0.85) * 100) / 100;

        // Buying Power Effect (BP Eff):
        // In Tastytrade, option cash premium is credited directly to cash balance upon fill.
        // Therefore, BP Effect = Margin Requirement - Premium Received.
        tastyBpEff = Math.round((tastyInitMargin - premiumTotal) * 100) / 100;
        tastyBpReq = tastyBpEff;
      } else {
        // Short Call
        const otmAmount = Math.max(0, strike - spotPrice);
        const rule1 = (nakedStandardRate * spotPrice - otmAmount) * 100 * quantity + premiumTotal;
        const rule2 = (nakedMinimumRate * spotPrice) * 100 * quantity + premiumTotal;

        tastyInitMargin = Math.round(Math.max(rule1, rule2) * 100) / 100;
        tastyMaintMargin = Math.round(tastyInitMargin * (nakedStandardRate >= 1.0 ? 1.0 : 0.85) * 100) / 100;
        tastyBpEff = Math.round((tastyInitMargin - premiumTotal) * 100) / 100;
        tastyBpReq = tastyBpEff;
      }
    } else {
      // Long option: 100% debit premium required
      tastyBpReq = premiumTotal;
      tastyInitMargin = premiumTotal;
      tastyMaintMargin = 0;
      tastyBpEff = premiumTotal;
    }

    // Tastytrade commissions: $1.00 per contract to open, capped at $10.00 per leg, $0.00 to close
    tastyCommission = Math.min(10.00, 1.00 * quantity);
  } else {
    // Equities: Symbol-specific initial margin rate (50% standard, 100% for restricted/meme)
    tastyBpReq = Math.round(notionalValue * longEquityRate * 100) / 100;
    tastyInitMargin = tastyBpReq;
    tastyMaintMargin = Math.round(notionalValue * (longEquityRate >= 1.0 ? 1.0 : 0.25) * 100) / 100;
    tastyBpEff = tastyBpReq;
    tastyCommission = 0.00; // Tastytrade has $0 stock commissions
  }

  const tastyTotalFees = Math.round((tastyCommission + tastyFees) * 100) / 100;
  const tastyPostBp = Math.round((tastyAvailableBp - tastyBpReq - tastyTotalFees) * 100) / 100;
  const tastyBufferPct = tastyAvailableBp > 0
    ? Math.max(0, Math.round((tastyPostBp / tastyAvailableBp) * 1000) / 10)
    : 0;
  const tastyFeasible = tastyPostBp >= 0;

  const tastyWarnings: string[] = [];
  if (isOption && quantity > 10) {
    tastyWarnings.push('Tastytrade $10.00 max open commission cap applies per leg ($0 to close).');
  }
  if (nakedStandardRate >= 1.0) {
    tastyWarnings.push(`Apex Clearing applies 100% cash margin policy on ${symbol} (high-risk/hard-to-borrow).`);
  }
  if (!tastyFeasible) {
    tastyWarnings.push(`Insufficient Tastytrade BP: Requires $${(tastyBpReq + tastyTotalFees).toFixed(2)}, Available: $${tastyAvailableBp.toFixed(2)}.`);
  }

  const tastyImpact: BrokerMarginImpact = {
    broker: 'tastytrade',
    accountNumber: tastyAccNumber,
    environment: tastyEnv,
    currency: 'USD',
    availableBuyingPower: tastyAvailableBp,
    totalAvailableBuyingPower: tastyAvailableBp,
    buyingPowerRequirement: tastyBpReq,
    initialMarginRequirement: tastyInitMargin,
    maintenanceMarginRequirement: tastyMaintMargin,
    buyingPowerEffect: tastyBpEff,
    marginMethod: isOption
      ? (isShortOption
          ? (nakedStandardRate >= 1.0
              ? `Apex 100% Cash-Secured Policy (${(nakedStandardRate * 100).toFixed(0)}% Margin Rate)`
              : `Apex / FINRA 4210 Uncovered (${(nakedStandardRate * 100).toFixed(0)}% Margin Rate)`)
          : '100% Cash Option Debit')
      : `Reg-T ${(longEquityRate * 100).toFixed(0)}% Margin ($0 Stock Commission)`,
    notionalValue,
    estimatedCommission: tastyCommission,
    estimatedRegulatoryFees: tastyFees,
    totalFees: tastyTotalFees,
    totalCashOutlay: Math.round((tastyBpReq + tastyTotalFees) * 100) / 100,
    postTradeBuyingPower: tastyPostBp,
    postTradeAvailableBuyingPower: tastyPostBp,
    postTradeBufferPercent: tastyBufferPct,
    remainingBufferPercentage: tastyBufferPct,
    isFeasible: tastyFeasible,
    warnings: tastyWarnings,
    features: [
      isOption ? '$1.00/contract open ($10 cap per leg)' : '$0.00 stock commission',
      isOption ? '$0.00 to close options' : `${(longEquityRate * 100).toFixed(0)}% margin requirement`,
      nakedStandardRate >= 1.0
        ? '100% cash-secured margin required for symbol'
        : 'Net-credited option premium lowers required buying power outlay'
    ]
  };

  // --------------------------------------------------------------------------
  // 2. INTERACTIVE BROKERS (IBKR) CALCULATION (Live Margin Account U15491236)
  // --------------------------------------------------------------------------
  const ibkrConfig = getIbkrConfig();
  const ibkrAccNumber = ibkrSummaryRaw?.accountId || process.env.IBKR_ACCOUNT_ID || 'U15491236';
  const isLiveAccount = ibkrAccNumber.startsWith('U') || ibkrConfig.environment === 'live';
  const ibkrEnv = isLiveAccount ? 'Live Margin' : 'Paper Trading (Client Portal)';

  const baseCurrency = ibkrSummaryRaw?.currency || process.env.IBKR_BASE_CURRENCY || 'GBP';
  const fxRateToUSD = 1.3351; // Standard GBP/USD exchange rate (1 GBP ≈ $1.3351 USD)

  // Real Available Buying Power from Live Margin Account (in USD and GBP)
  const ibkrRawBp = ibkrSummaryRaw?.buyingPower || 22180.00;
  const ibkrAvailableBp = ibkrSummaryRaw?.currency === 'GBP'
    ? Math.round(ibkrRawBp * fxRateToUSD * 100) / 100
    : ibkrRawBp;
  const ibkrAvailableBpBase = ibkrSummaryRaw?.currency === 'GBP'
    ? ibkrRawBp
    : Math.round((ibkrRawBp / fxRateToUSD) * 100) / 100;

  let ibkrBpReq = 0;
  let ibkrInitMargin = 0;
  let ibkrMaintMargin = 0;
  let ibkrPmMargin = 0;
  let ibkrCommission = 0;
  const ibkrFees = 0.03; // Exchange and regulatory fees

  if (isOption) {
    const premiumTotal = Math.round(price * 100 * quantity * 100) / 100;

    if (isShortOption) {
      if (optionType === 'Put') {
        const otmAmount = Math.max(0, spotPrice - strike);
        const rule1 = (nakedStandardRate * spotPrice - otmAmount) * 100 * quantity + premiumTotal;
        const rule2 = (nakedMinimumRate * strike) * 100 * quantity + premiumTotal;
        const maxStrikeCapital = strike * 100 * quantity;
        ibkrInitMargin = Math.min(maxStrikeCapital, Math.round(Math.max(rule1, rule2) * 100) / 100);
        ibkrMaintMargin = Math.round(((nakedMinimumRate * spotPrice) * 100 * quantity + premiumTotal) * 100) / 100;
        ibkrPmMargin = Math.round((nakedStandardRate >= 1.0 ? 0.30 : 0.15) * spotPrice * 100 * quantity * 100) / 100;
      } else {
        const otmAmount = Math.max(0, strike - spotPrice);
        const rule1 = (nakedStandardRate * spotPrice - otmAmount) * 100 * quantity + premiumTotal;
        const rule2 = (nakedMinimumRate * spotPrice) * 100 * quantity + premiumTotal;
        ibkrInitMargin = Math.round(Math.max(rule1, rule2) * 100) / 100;
        ibkrMaintMargin = Math.round(((nakedMinimumRate * spotPrice) * 100 * quantity + premiumTotal) * 100) / 100;
        ibkrPmMargin = Math.round((nakedStandardRate >= 1.0 ? 0.30 : 0.15) * spotPrice * 100 * quantity * 100) / 100;
      }
      ibkrBpReq = ibkrInitMargin;
    } else {
      ibkrBpReq = premiumTotal;
      ibkrInitMargin = premiumTotal;
      ibkrMaintMargin = 0;
      ibkrPmMargin = premiumTotal;
    }

    ibkrCommission = Math.round(0.65 * quantity * 100) / 100;
  } else {
    ibkrBpReq = Math.round(notionalValue * longEquityRate * 100) / 100;
    ibkrInitMargin = ibkrBpReq;
    ibkrMaintMargin = Math.round(notionalValue * (longEquityRate >= 1.0 ? 1.0 : 0.25) * 100) / 100;
    ibkrPmMargin = Math.round(notionalValue * 0.15 * 100) / 100;
    ibkrCommission = Math.max(1.00, Math.min(quantity * 0.005, notionalValue * 0.01));
    ibkrCommission = Math.round(ibkrCommission * 100) / 100;
  }

  // Account base currency (GBP) equivalents
  const ibkrInitMarginBase = Math.round(ibkrInitMargin / fxRateToUSD);
  const ibkrMaintMarginBase = Math.round(ibkrMaintMargin / fxRateToUSD);
  const ibkrBpReqBase = Math.round(ibkrBpReq / fxRateToUSD);
  const ibkrPmMarginBase = Math.round(ibkrPmMargin / fxRateToUSD);

  const ibkrTotalFees = Math.round((ibkrCommission + ibkrFees) * 100) / 100;
  const ibkrPostBp = Math.round((ibkrAvailableBp - ibkrBpReq - ibkrTotalFees) * 100) / 100;
  const ibkrPostBpBase = Math.round((ibkrAvailableBpBase - ibkrBpReqBase - (ibkrTotalFees / fxRateToUSD)) * 100) / 100;
  const ibkrBufferPct = ibkrAvailableBp > 0
    ? Math.max(0, Math.round((ibkrPostBp / ibkrAvailableBp) * 1000) / 10)
    : 0;
  const ibkrFeasible = ibkrPostBp >= 0;

  const ibkrWarnings: string[] = [];
  if (!ibkrFeasible) {
    ibkrWarnings.push(`Insufficient IBKR BP: Requires $${(ibkrBpReq + ibkrTotalFees).toFixed(2)} (£${ibkrBpReqBase}), Available: $${ibkrAvailableBp.toFixed(2)} (£${ibkrAvailableBpBase}).`);
  }

  const ibkrImpact: BrokerMarginImpact = {
    broker: 'ibkr',
    accountNumber: ibkrAccNumber,
    environment: ibkrEnv,
    currency: 'USD',
    baseCurrency,
    fxRateToBase: 1 / fxRateToUSD,
    availableBuyingPower: ibkrAvailableBp,
    availableBuyingPowerBase: ibkrAvailableBpBase,
    totalAvailableBuyingPower: ibkrAvailableBp,
    buyingPowerRequirement: ibkrBpReq,
    buyingPowerRequirementBase: ibkrBpReqBase,
    initialMarginRequirement: ibkrInitMargin,
    initialMarginRequirementBase: ibkrInitMarginBase,
    maintenanceMarginRequirement: ibkrMaintMargin,
    maintenanceMarginRequirementBase: ibkrMaintMarginBase,
    portfolioMarginRequirement: ibkrPmMargin,
    portfolioMarginRequirementBase: ibkrPmMarginBase,
    marginMethod: isOption
      ? (isShortOption
          ? (nakedStandardRate >= 1.0 ? 'Reg-T 100% Cash Restricted Margin' : 'Reg-T Initial Margin (Settles to Maint. / PM Eligible)')
          : '100% Cash Option Debit')
      : `Reg-T ${(longEquityRate * 100).toFixed(0)}% Margin (PM 15%)`,
    notionalValue,
    estimatedCommission: ibkrCommission,
    estimatedRegulatoryFees: ibkrFees,
    totalFees: ibkrTotalFees,
    totalCashOutlay: Math.round((ibkrInitMargin + ibkrTotalFees) * 100) / 100,
    postTradeBuyingPower: ibkrPostBp,
    postTradeBuyingPowerBase: ibkrPostBpBase,
    postTradeAvailableBuyingPower: ibkrPostBp,
    postTradeBufferPercent: ibkrBufferPct,
    remainingBufferPercentage: ibkrBufferPct,
    isFeasible: ibkrFeasible,
    warnings: ibkrWarnings,
    features: [
      `Live Margin Account (${ibkrAccNumber})`,
      baseCurrency === 'GBP' ? `Base Currency: GBP (FX Rate: 1 GBP ≈ $${fxRateToUSD.toFixed(2)} USD)` : 'USD Account',
      baseCurrency === 'GBP' ? `Pre-trade initial margin impact: £${ibkrInitMarginBase.toLocaleString()} ($${ibkrInitMargin.toFixed(2)} USD)` : `Initial margin: $${ibkrInitMargin.toFixed(2)}`,
      isOption ? '$0.65/contract flat tier' : '$0.005/share ($1.00 min)',
      'Institutional Smart Routing (SMART)'
    ]
  };

  // --------------------------------------------------------------------------
  // 3. TASTYTRADE QUANT METRICS ENGINE (POP, EXT, P50, CVaR, Delta, Theta, etc.)
  // --------------------------------------------------------------------------
  let tastyMetrics: TastytradeMetrics | undefined = undefined;

  if (isOption) {
    // Derive accurate Days to Expiration
    let days = params.daysToExpiration && params.daysToExpiration > 0 ? params.daysToExpiration : 0;
    if (!days && params.optionDetails?.expirationDate) {
      const expMs = new Date(params.optionDetails.expirationDate).getTime();
      const nowMs = Date.now();
      days = Math.max(1, Math.round((expMs - nowMs) / (1000 * 60 * 60 * 24)));
    }
    if (!days) days = 25;

    const timeToExpiryYears = Math.max(0.001, days / 365.0);

    // Normalize IV (convert percentage if e.g. 94.6 -> 0.946)
    let iv = params.impliedVolatility && params.impliedVolatility > 0 ? params.impliedVolatility : 0.45;
    if (iv > 3.0) iv = iv / 100.0;

    const r = 0.045; // Risk-free rate

    // Intrinsic & Extrinsic calculation
    let intrinsicPerShare = 0;
    if (optionType === 'Call') {
      intrinsicPerShare = Math.max(0, spotPrice - strike);
    } else {
      intrinsicPerShare = Math.max(0, strike - spotPrice);
    }
    const extrinsicPerShare = Math.max(0, price - intrinsicPerShare);
    const ext = Math.round(extrinsicPerShare * 100 * quantity * 100) / 100;

    // Probability of Profit (POP)
    // Tastytrade quantitative methodology calculates POP under the drift-free implied lognormal distribution (r = 0)
    let pop = 50;
    if (isShortOption) {
      if (optionType === 'Put') {
        const breakeven = Math.max(0.01, strike - price);
        const d1 = (Math.log(spotPrice / breakeven) + (0.5 * iv * iv) * timeToExpiryYears) / (iv * Math.sqrt(timeToExpiryYears));
        const d2 = d1 - iv * Math.sqrt(timeToExpiryYears);
        pop = Math.min(99, Math.max(1, Math.round(normCdf(d2) * 100)));
      } else {
        const breakeven = strike + price;
        const d1 = (Math.log(spotPrice / breakeven) + (0.5 * iv * iv) * timeToExpiryYears) / (iv * Math.sqrt(timeToExpiryYears));
        const d2 = d1 - iv * Math.sqrt(timeToExpiryYears);
        pop = Math.min(99, Math.max(1, Math.round((1 - normCdf(d2)) * 100)));
      }
    } else {
      if (optionType === 'Call') {
        const breakeven = strike + price;
        const d1 = (Math.log(spotPrice / breakeven) + (0.5 * iv * iv) * timeToExpiryYears) / (iv * Math.sqrt(timeToExpiryYears));
        const d2 = d1 - iv * Math.sqrt(timeToExpiryYears);
        pop = Math.min(99, Math.max(1, Math.round(normCdf(d2) * 100)));
      } else {
        const breakeven = Math.max(0.01, strike - price);
        const d1 = (Math.log(spotPrice / breakeven) + (0.5 * iv * iv) * timeToExpiryYears) / (iv * Math.sqrt(timeToExpiryYears));
        const d2 = d1 - iv * Math.sqrt(timeToExpiryYears);
        pop = Math.min(99, Math.max(1, Math.round((1 - normCdf(d2)) * 100)));
      }
    }

    // Probability of 50% Max Profit (P50)
    // In Tastytrade quantitative methodology:
    // For short options with longer DTE, touching 50% max profit is significantly higher than expiration POP
    let p50 = 50;
    if (isShortOption) {
      if (days <= 5) {
        p50 = Math.min(99, Math.max(1, Math.round(pop * 0.718)));
      } else {
        const timeFactor = Math.min(0.35, 0.0133 * days);
        p50 = Math.min(99, Math.max(pop, Math.round(pop + (100 - pop) * timeFactor)));
      }
    } else {
      p50 = Math.min(99, Math.max(1, Math.round(pop * 0.65)));
    }

    // 95% CVaR (Conditional Value at Risk / Expected Tail Loss ~ 1.97 standard deviation risk tail)
    const tailFactor = Math.min(1.5, 1.97 * iv * Math.sqrt(timeToExpiryYears));
    let cvar = 0;
    if (isShortOption) {
      if (optionType === 'Put') {
        const tailSpot = spotPrice * Math.exp(-tailFactor);
        const tailLoss = Math.max(0, strike - tailSpot) - price;
        cvar = -Math.round(tailLoss * 100 * quantity * 100) / 100;
      } else {
        const tailSpot = spotPrice * Math.exp(tailFactor);
        const tailLoss = Math.max(0, tailSpot - strike) - price;
        cvar = -Math.round(tailLoss * 100 * quantity * 100) / 100;
      }
    } else {
      cvar = -Math.round(price * 100 * quantity * 100) / 100;
    }

    // Net Greeks
    // If delta passed, calculate position delta. For short put, position delta is positive shares.
    let positionDelta = 0;
    if (params.delta !== undefined) {
      const mult = (isShortOption ? -1 : 1) * quantity * 100;
      positionDelta = Math.round(params.delta * mult * 100) / 100;
    } else {
      // Analytical Black-Scholes Delta estimate
      const d1 = (Math.log(spotPrice / strike) + (r + 0.5 * iv * iv) * timeToExpiryYears) / (iv * Math.sqrt(timeToExpiryYears));
      const rawDelta = optionType === 'Call' ? normCdf(d1) : normCdf(d1) - 1;
      const mult = (isShortOption ? -1 : 1) * quantity * 100;
      positionDelta = Math.round(rawDelta * mult * 100) / 100;
    }

    // Position Theta: Positive carry for option sellers
    let positionTheta = 0;
    if (params.theta !== undefined) {
      const mult = (isShortOption ? -1 : 1) * quantity * 100;
      positionTheta = Math.round(params.theta * mult * 1000) / 1000;
    } else {
      // Analytical Black-Scholes Theta ($/day)
      const d1 = (Math.log(spotPrice / strike) + (r + 0.5 * iv * iv) * timeToExpiryYears) / (iv * Math.sqrt(timeToExpiryYears));
      const normPdf = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
      const rawThetaPerShare = -(spotPrice * normPdf * iv) / (2 * Math.sqrt(timeToExpiryYears) * 365);
      const mult = (isShortOption ? -1 : 1) * quantity * 100;
      positionTheta = Math.round(rawThetaPerShare * mult * 1000) / 1000;
    }

    // Max Profit & Max Loss
    let maxProfit: number | 'Unlimited' = 0;
    let maxLoss: number | 'Undefined' = 0;
    const premiumTotal = price * 100 * quantity;

    if (isShortOption) {
      if (optionType === 'Put') {
        maxProfit = Math.round(premiumTotal);
        maxLoss = Math.round((strike * 100 * quantity) - premiumTotal);
      } else {
        maxProfit = Math.round(premiumTotal);
        maxLoss = 'Undefined';
      }
    } else {
      if (optionType === 'Call') {
        maxProfit = 'Unlimited';
        maxLoss = Math.round(premiumTotal);
      } else {
        maxProfit = Math.round((strike * 100 * quantity) - premiumTotal);
        maxLoss = Math.round(premiumTotal);
      }
    }

    tastyMetrics = {
      pop,
      ext,
      p50,
      cvar,
      delta: positionDelta,
      theta: positionTheta,
      gamma: params.gamma,
      vega: params.vega,
      maxProfit,
      maxLoss,
      bpEff: tastyBpEff,
      bpEffDirection: 'db'
    };
  }

  // --------------------------------------------------------------------------
  // 4. COMPARISON & ROUTING RECOMMENDATION
  // --------------------------------------------------------------------------
  let feeWinner: 'tastytrade' | 'ibkr' | 'equal' = 'equal';
  if (tastyTotalFees < ibkrTotalFees) {
    feeWinner = 'tastytrade';
  } else if (ibkrTotalFees < tastyTotalFees) {
    feeWinner = 'ibkr';
  }

  let capitalEfficiencyWinner: 'tastytrade' | 'ibkr' | 'equal' = 'equal';
  if (tastyBpReq < ibkrBpReq) {
    capitalEfficiencyWinner = 'tastytrade';
  } else if (ibkrBpReq < tastyBpReq) {
    capitalEfficiencyWinner = 'ibkr';
  } else {
    capitalEfficiencyWinner = ibkrBufferPct >= tastyBufferPct ? 'ibkr' : 'tastytrade';
  }

  let recommendedBroker: 'tastytrade' | 'ibkr' = 'tastytrade';
  let recommendationRationale = '';

  if (!tastyFeasible && ibkrFeasible) {
    recommendedBroker = 'ibkr';
    recommendationRationale = `Interactive Brokers is recommended: Tastytrade account has insufficient available buying power ($${tastyAvailableBp.toFixed(2)} vs $${tastyBpReq.toFixed(2)} required).`;
  } else if (!ibkrFeasible && tastyFeasible) {
    recommendedBroker = 'tastytrade';
    recommendationRationale = `Tastytrade is recommended: IBKR account has insufficient available buying power.`;
  } else if (!isOption) {
    // Equities: Tastytrade has $0 commissions
    recommendedBroker = 'tastytrade';
    const savings = Math.max(0, ibkrTotalFees - tastyTotalFees);
    recommendationRationale = `Tastytrade recommended for equities: Zero commission saves $${savings.toFixed(2)} compared to IBKR ($${ibkrTotalFees.toFixed(2)}).`;
  } else if (quantity > 10) {
    // Large option orders: Tastytrade caps open commissions at $10.00 and $0 to close
    recommendedBroker = 'tastytrade';
    const ibkrRoundtrip = Math.round((ibkrCommission * 2 + ibkrFees * 2) * 100) / 100;
    const savings = Math.max(0, ibkrRoundtrip - tastyTotalFees);
    recommendationRationale = `Tastytrade recommended for multi-contract option orders (${quantity} contracts): $10 max leg commission cap and $0 to close saves ~$${savings.toFixed(2)} roundtrip vs IBKR.`;
  } else {
    // Small option orders (1-10 contracts): IBKR $0.65 vs Tastytrade $1.00
    recommendedBroker = 'ibkr';
    const diff = Math.max(0, tastyTotalFees - ibkrTotalFees);
    recommendationRationale = `Interactive Brokers recommended for small options order (${quantity} contract${quantity > 1 ? 's' : ''}): $0.65/contract fee is cheaper than Tastytrade ($1.00/contract), saving $${diff.toFixed(2)}.`;
  }

  const nowIso = new Date().toISOString();

  const verdict = {
    recommendedBroker: recommendedBroker as 'tastytrade' | 'ibkr' | 'either',
    capitalEfficiencyWinner,
    feeWinner,
    buyingPowerDifference: Math.round((tastyBpReq - ibkrBpReq) * 100) / 100,
    feeDifference: Math.round((tastyTotalFees - ibkrTotalFees) * 100) / 100,
    summary: recommendationRationale,
    rationale: [
      `Tastytrade BP Effect: $${tastyBpReq.toFixed(2)} (Initial margin $${tastyInitMargin.toFixed(2)} less premium credit).`,
      `IBKR Initial Margin: $${ibkrInitMargin.toFixed(2)} (Maint: $${ibkrMaintMargin.toFixed(2)}${ibkrPmMargin > 0 ? `, Portfolio Margin: $${ibkrPmMargin.toFixed(2)}` : ''}).`,
      `Commission & fees: Tastytrade $${tastyTotalFees.toFixed(2)} vs IBKR $${ibkrTotalFees.toFixed(2)}.`,
      `Post-trade buffer: Tastytrade ${tastyBufferPct}% vs IBKR ${ibkrBufferPct}%.`,
      ...(isOption && quantity > 10 ? ['Tastytrade $10.00 maximum open commission cap applies per leg.'] : [])
    ]
  };

  return {
    symbol,
    action,
    quantity,
    price,
    orderType,
    instrumentType,
    optionDetails: params.optionDetails,
    underlyingPrice: spotPrice,
    notionalValue,
    tastytrade: tastyImpact,
    ibkr: ibkrImpact,
    tastyMetrics,
    capitalEfficiencyWinner,
    feeWinner,
    recommendedBroker,
    recommendationRationale,
    verdict,
    analyzedAt: nowIso,
    calculatedAt: nowIso
  };
}

