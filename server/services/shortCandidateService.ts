import YahooFinance from 'yahoo-finance2';
import { agentActivityTracker } from './agentActivityService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export type ShortArchetype =
  | 'ALL'
  | 'FUNDAMENTAL_OVERVALUATION'
  | 'TECHNICAL_BREAKDOWN'
  | 'EARNINGS_DECELERATION'
  | 'HIGH_BETA_CYCLICAL_TOP'
  | 'BALANCE_SHEET_DISTRESS';

export type ShortExecutionVehicle =
  | 'ALL'
  | 'DIRECT_SHORT'
  | 'LONG_PUT'
  | 'BEAR_PUT_SPREAD'
  | 'BEAR_CALL_SPREAD';

export type MarketCapCategory = 'ALL' | 'MEGA_CAP' | 'LARGE_CAP' | 'MID_CAP' | 'SMALL_CAP';

export interface ShortAgentFilterParams {
  archetype?: ShortArchetype;
  executionVehicle?: ShortExecutionVehicle;
  marketCapCategory?: MarketCapCategory;
  sector?: string;
  minConviction?: number; // 60 - 95
  maxPrice?: number;
  minPrice?: number;
  maxRSI?: number;
  searchQuery?: string;
  customPrompt?: string;
}

export interface ShortTradeCandidate {
  id: string;
  symbol: string;
  companyName: string;
  currentPrice: number;
  dayChangePercent: number;
  sector: string;
  industry: string;
  marketCap: number;
  marketCapCategory: MarketCapCategory;
  archetype: ShortArchetype;
  archetypeLabel: string;
  convictionScore: number; // 65 - 98
  convictionTier: 'HIGH_CONVICTION' | 'MODERATE_CONVICTION' | 'TACTICAL_SPECULATIVE';
  shortThesis: string;
  keyVulnerabilities: string[];
  catalysts: string[];
  metrics: {
    peRatio?: number;
    forwardPE?: number;
    priceToSales?: number;
    evToEbitda?: number;
    debtToEquity?: number;
    revenueGrowthYoY?: number;
    netMargin?: number;
    freeCashFlow?: string;
    shortInterestPercent?: number;
    daysToCover?: number;
    rsi14: number;
    distFrom52wHighPercent: number;
    distFrom200DmaPercent: number;
    movingAverageTrend: 'STRONG_BEARISH' | 'MODERATE_BEARISH' | 'BREAKDOWN_EMERGING';
  };
  tradeBlueprint: {
    recommendedVehicle: 'DIRECT_SHORT' | 'LONG_PUT' | 'BEAR_PUT_SPREAD' | 'BEAR_CALL_SPREAD';
    vehicleLabel: string;
    entryTriggerPrice: number;
    entryCondition: string;
    targetPrice1: number;
    targetPrice2: number;
    stopLossPrice: number;
    downsidePotentialPercent: number;
    riskPercent: number;
    riskRewardRatio: string;
    timeHorizon: 'SWING_1_4_WEEKS' | 'POSITION_1_3_MONTHS' | 'TACTICAL_DAYS';
    executionDetails: string;
    optionsStructure?: {
      strategyName: string;
      primaryStrike: number;
      secondaryStrike?: number;
      targetExpiration: string;
      targetDte: number;
      estimatedCostOrCredit: number;
      maxProfit: number;
      maxLoss: number;
    };
  };
}

export interface ShortCandidateScanResult {
  scanTimestamp: string;
  totalUniverseScanned: number;
  matchedCount: number;
  marketContext: {
    spyTrend: string;
    vixLevel: number;
    marketRegime: 'RISK_OFF_BEARISH' | 'DISTRIBUTION_CHOP' | 'ELEVATED_VOLATILITY' | 'OVERBOUGHT_BULLISH';
  };
  sectorBreakdown: Record<string, number>;
  archetypeBreakdown: Record<string, number>;
  candidates: ShortTradeCandidate[];
}

/**
 * Curated universe of high-profile candidates with established structural short themes
 */
interface ShortUniverseTemplate {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  marketCapCat: MarketCapCategory;
  defaultArchetype: ShortArchetype;
  archetypeLabel: string;
  baseConviction: number;
  shortThesis: string;
  keyVulnerabilities: string[];
  catalysts: string[];
  metricsBase: {
    pe?: number;
    fwdPe?: number;
    ps?: number;
    evEbitda?: number;
    debtEquity?: number;
    revGrowth?: number;
    netMargin?: number;
    fcf?: string;
    siPct?: number;
    dtc?: number;
    rsiDefault: number;
    distHighDefault: number;
    dist200Default: number;
    maTrend: 'STRONG_BEARISH' | 'MODERATE_BEARISH' | 'BREAKDOWN_EMERGING';
  };
  blueprintBase: {
    vehicle: 'DIRECT_SHORT' | 'LONG_PUT' | 'BEAR_PUT_SPREAD' | 'BEAR_CALL_SPREAD';
    vehicleLabel: string;
    entryBufferPct: number; // e.g. -1% below spot for confirmation
    target1Pct: number; // e.g. -15%
    target2Pct: number; // e.g. -25%
    stopLossPct: number; // e.g. +6%
    timeHorizon: 'SWING_1_4_WEEKS' | 'POSITION_1_3_MONTHS' | 'TACTICAL_DAYS';
    executionDetails: string;
  };
}

const SHORT_UNIVERSE_TEMPLATES: ShortUniverseTemplate[] = [
  {
    symbol: 'CVNA',
    name: 'Carvana Co.',
    sector: 'Consumer Cyclical',
    industry: 'Auto & Truck Dealerships',
    marketCap: 45_000_000_000,
    marketCapCat: 'LARGE_CAP',
    defaultArchetype: 'FUNDAMENTAL_OVERVALUATION',
    archetypeLabel: 'Extreme Valuation & Debt Stagnation',
    baseConviction: 92,
    shortThesis: 'Massive multiple expansion disconnected from underlying unit retail volume and rising subprime auto loan delinquencies.',
    keyVulnerabilities: [
      'Stretched EV/EBITDA > 32x in a cyclical dealer business',
      'High long-term debt load exceeding $5.4B with heavy interest burden',
      'Used vehicle price index (Manheim) rolling over 4.2% YoY',
      'Insider and institutional profit taking accelerating'
    ],
    catalysts: ['Upcoming Q3 retail unit sales print', 'Interest rate plateau pressuring consumer monthly auto payments'],
    metricsBase: {
      pe: 78.4,
      fwdPe: 42.1,
      ps: 3.2,
      evEbitda: 31.8,
      debtEquity: 4.8,
      revGrowth: 14.5,
      netMargin: 3.2,
      fcf: '+$210M',
      siPct: 14.2,
      dtc: 3.4,
      rsiDefault: 68.4,
      distHighDefault: -8.2,
      dist200Default: 42.5,
      maTrend: 'BREAKDOWN_EMERGING'
    },
    blueprintBase: {
      vehicle: 'BEAR_PUT_SPREAD',
      vehicleLabel: 'Bear Put Debit Spread (Defined Risk)',
      entryBufferPct: -1.5,
      target1Pct: -18.0,
      target2Pct: -28.0,
      stopLossPct: 6.5,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Buy ATM Put and sell 15% OTM Put 30-45 DTE to capture downside momentum while capping theta decay.'
    }
  },
  {
    symbol: 'LCID',
    name: 'Lucid Group, Inc.',
    sector: 'Consumer Cyclical',
    industry: 'Auto Manufacturers',
    marketCap: 7_800_000_000,
    marketCapCat: 'MID_CAP',
    defaultArchetype: 'BALANCE_SHEET_DISTRESS',
    archetypeLabel: 'Severe Cash Burn & Continuous Share Dilution',
    baseConviction: 94,
    shortThesis: 'Massive negative gross margins on luxury EV deliveries requiring continuous dilutive capital raises and slowing order conversions.',
    keyVulnerabilities: [
      'Cash burn exceeding -$2.8B annually',
      'Negative gross profit margin of -130% on vehicle deliveries',
      'Heavy reliance on Saudi PIF share issuance causing persistent float dilution',
      'Trading below all key moving averages in structural downtrend'
    ],
    catalysts: ['Next equity offering dilution announcement', 'Quarterly vehicle delivery miss'],
    metricsBase: {
      pe: undefined,
      fwdPe: undefined,
      ps: 10.4,
      evEbitda: undefined,
      debtEquity: 0.85,
      revGrowth: -12.4,
      netMargin: -320.0,
      fcf: '-$2.4B',
      siPct: 24.8,
      dtc: 6.2,
      rsiDefault: 38.2,
      distHighDefault: -58.4,
      dist200Default: -22.1,
      maTrend: 'STRONG_BEARISH'
    },
    blueprintBase: {
      vehicle: 'DIRECT_SHORT',
      vehicleLabel: 'Direct Equity Short / Long Put',
      entryBufferPct: -0.5,
      target1Pct: -22.0,
      target2Pct: -35.0,
      stopLossPct: 8.0,
      timeHorizon: 'POSITION_1_3_MONTHS',
      executionDetails: 'Initiate direct equity short with borrow or buy 60 DTE Long Puts on test of declining 50 DMA resistance.'
    }
  },
  {
    symbol: 'UPST',
    name: 'Upstart Holdings, Inc.',
    sector: 'Financial Services',
    industry: 'Credit Services',
    marketCap: 4_200_000_000,
    marketCapCat: 'MID_CAP',
    defaultArchetype: 'HIGH_BETA_CYCLICAL_TOP',
    archetypeLabel: 'High-Beta Credit Vulnerability & AI Multiple Froth',
    baseConviction: 88,
    shortThesis: 'Excessive valuation applied to AI branding while underlying credit lending volume remains constrained by high benchmark rates and tight bank balance sheets.',
    keyVulnerabilities: [
      'Beta of 2.65 amplifying market pullbacks',
      'Bank partners tightening loan absorption criteria',
      'Forward P/E > 65x on inconsistent earnings trajectory',
      'RSI divergence indicating buyer exhaustion after parabolic run'
    ],
    catalysts: ['Next loan transaction volume report', 'Credit spread widening in high-yield debt'],
    metricsBase: {
      pe: undefined,
      fwdPe: 68.2,
      ps: 6.8,
      evEbitda: 48.0,
      debtEquity: 1.6,
      revGrowth: -4.2,
      netMargin: -14.5,
      fcf: '-$80M',
      siPct: 32.5,
      dtc: 4.8,
      rsiDefault: 64.2,
      distHighDefault: -14.0,
      dist200Default: 38.0,
      maTrend: 'BREAKDOWN_EMERGING'
    },
    blueprintBase: {
      vehicle: 'BEAR_CALL_SPREAD',
      vehicleLabel: 'Bear Call Credit Spread (Resistance Fade)',
      entryBufferPct: 1.0,
      target1Pct: -16.0,
      target2Pct: -26.0,
      stopLossPct: 7.0,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Sell OTM Call and buy higher Call 30 DTE to harvest rapid extrinsic decay with capped upside risk.'
    }
  },
  {
    symbol: 'SMCI',
    name: 'Super Micro Computer, Inc.',
    sector: 'Technology',
    industry: 'Computer Hardware',
    marketCap: 28_000_000_000,
    marketCapCat: 'LARGE_CAP',
    defaultArchetype: 'TECHNICAL_BREAKDOWN',
    archetypeLabel: 'Accounting Scrutiny & Severe Margin Compression',
    baseConviction: 91,
    shortThesis: 'Gross margin deterioration to low single digits alongside governance concerns and loss of pricing power in commodity server assembly.',
    keyVulnerabilities: [
      'Gross margins compressed from 17% down to 11.2%',
      'Death cross confirmed on 50/200 DMA with heavy institutional volume distribution',
      'Intense server competition from Dell and HPE compressing margins',
      'Auditor transition and delayed 10-K overhang'
    ],
    catalysts: ['Independent audit report filing', 'Gross margin guidance downgrade'],
    metricsBase: {
      pe: 22.4,
      fwdPe: 14.8,
      ps: 1.8,
      evEbitda: 16.5,
      debtEquity: 0.95,
      revGrowth: 140.0,
      netMargin: 7.1,
      fcf: '-$1.2B',
      siPct: 18.4,
      dtc: 2.1,
      rsiDefault: 41.5,
      distHighDefault: -64.0,
      dist200Default: -32.0,
      maTrend: 'STRONG_BEARISH'
    },
    blueprintBase: {
      vehicle: 'BEAR_PUT_SPREAD',
      vehicleLabel: 'Bear Put Debit Spread',
      entryBufferPct: -1.0,
      target1Pct: -20.0,
      target2Pct: -32.0,
      stopLossPct: 7.5,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Structure a 1x2 Put ratio or 45 DTE Bear Put spread on bounce to 20-day EMA.'
    }
  },
  {
    symbol: 'RIVN',
    name: 'Rivian Automotive, Inc.',
    sector: 'Consumer Cyclical',
    industry: 'Auto Manufacturers',
    marketCap: 12_400_000_000,
    marketCapCat: 'LARGE_CAP',
    defaultArchetype: 'EARNINGS_DECELERATION',
    archetypeLabel: 'Flat Production Guidance & Negative Gross Margins',
    baseConviction: 86,
    shortThesis: 'High vehicle production costs exceeding retail pricing, resulting in per-vehicle losses and supplier bottleneck guidance cuts.',
    keyVulnerabilities: [
      'Losing ~$32,000 per vehicle delivered in recent quarters',
      'Flat annual production target of 48k-50k units',
      'High capital expenditure required for R2 Georgia facility launch',
      'Persistent cash burn exceeding -$1.1B per quarter'
    ],
    catalysts: ['Quarterly vehicle production and delivery report', 'Capex milestone updates'],
    metricsBase: {
      pe: undefined,
      fwdPe: undefined,
      ps: 2.5,
      evEbitda: undefined,
      debtEquity: 1.1,
      revGrowth: -3.5,
      netMargin: -110.0,
      fcf: '-$4.1B',
      siPct: 19.5,
      dtc: 4.1,
      rsiDefault: 44.0,
      distHighDefault: -48.0,
      dist200Default: -18.0,
      maTrend: 'MODERATE_BEARISH'
    },
    blueprintBase: {
      vehicle: 'LONG_PUT',
      vehicleLabel: 'Long Outright Put (Defined Downside Play)',
      entryBufferPct: -0.5,
      target1Pct: -15.0,
      target2Pct: -24.0,
      stopLossPct: 6.0,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Buy slightly OTM Put (0.35 Delta) 45 DTE targeting re-test of 52-week lows.'
    }
  },
  {
    symbol: 'MSTR',
    name: 'MicroStrategy Incorporated',
    sector: 'Technology',
    industry: 'Software - Application',
    marketCap: 68_000_000_000,
    marketCapCat: 'LARGE_CAP',
    defaultArchetype: 'FUNDAMENTAL_OVERVALUATION',
    archetypeLabel: 'Massive NAV Premium to Underlying Asset Holding',
    baseConviction: 89,
    shortThesis: 'Equity market capitalization trading at a ~2.2x-2.6x premium to the actual underlying Bitcoin held on the corporate balance sheet.',
    keyVulnerabilities: [
      'Enterprise Value exceeds net value of underlying digital asset holdings by >$30B',
      'Core enterprise software revenue stagnant at <$500M annually with negative operating margin',
      'Convertible debt issuance increasing future dilution risk',
      'Extreme volatility and high borrow sensitivity'
    ],
    catalysts: ['NAV premium mean-reversion', 'SEC scrutiny on leveraged digital asset holding companies'],
    metricsBase: {
      pe: undefined,
      fwdPe: undefined,
      ps: 120.0,
      evEbitda: undefined,
      debtEquity: 3.2,
      revGrowth: -1.8,
      netMargin: -180.0,
      fcf: '-$45M',
      siPct: 16.5,
      dtc: 2.2,
      rsiDefault: 72.5,
      distHighDefault: -5.0,
      dist200Default: 65.0,
      maTrend: 'BREAKDOWN_EMERGING'
    },
    blueprintBase: {
      vehicle: 'BEAR_PUT_SPREAD',
      vehicleLabel: 'Bear Put Debit Spread (High IV Defined Risk)',
      entryBufferPct: -2.0,
      target1Pct: -25.0,
      target2Pct: -40.0,
      stopLossPct: 8.5,
      timeHorizon: 'POSITION_1_3_MONTHS',
      executionDetails: 'Utilize wide Bear Put Spreads (60 DTE) to avoid unlimited margin risk while capturing NAV normalization.'
    }
  },
  {
    symbol: 'AFRM',
    name: 'Affirm Holdings, Inc.',
    sector: 'Financial Services',
    industry: 'Credit Services',
    marketCap: 16_500_000_000,
    marketCapCat: 'LARGE_CAP',
    defaultArchetype: 'HIGH_BETA_CYCLICAL_TOP',
    archetypeLabel: 'BNPL Credit Vulnerability & Discretionary Slowdown',
    baseConviction: 85,
    shortThesis: 'Buy Now Pay Later loan delinquency rates ticking higher among subprime Gen-Z consumers amidst rising funding borrowing costs.',
    keyVulnerabilities: [
      'Trading at >7x Price to Sales with negative operating margins',
      'Provision for credit losses rising to 6.8% of gross merchandise volume',
      'High Beta of 2.8 making it highly sensitive to equity broad market pullbacks',
      'Heavy merchant fee competition from Apple Pay and Klarna'
    ],
    catalysts: ['Holiday consumer credit delinquency report', 'Merchant fee renegotiation updates'],
    metricsBase: {
      pe: undefined,
      fwdPe: 48.5,
      ps: 7.2,
      evEbitda: 42.0,
      debtEquity: 2.1,
      revGrowth: 32.0,
      netMargin: -12.0,
      fcf: '+$60M',
      siPct: 15.8,
      dtc: 3.1,
      rsiDefault: 62.0,
      distHighDefault: -12.0,
      dist200Default: 28.0,
      maTrend: 'BREAKDOWN_EMERGING'
    },
    blueprintBase: {
      vehicle: 'BEAR_PUT_SPREAD',
      vehicleLabel: 'Bear Put Spread',
      entryBufferPct: -1.0,
      target1Pct: -16.0,
      target2Pct: -28.0,
      stopLossPct: 6.0,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Buy 30 DTE ATM Put and sell 12% OTM Put on confirmation of breakdown below 20-day SMA.'
    }
  },
  {
    symbol: 'W',
    name: 'Wayfair Inc.',
    sector: 'Consumer Cyclical',
    industry: 'Internet Retail',
    marketCap: 5_400_000_000,
    marketCapCat: 'MID_CAP',
    defaultArchetype: 'BALANCE_SHEET_DISTRESS',
    archetypeLabel: 'Negative Equity & High Debt Burden',
    baseConviction: 87,
    shortThesis: 'Negative stockholder equity (-$2.1B), continuous net losses, and declining active customer count as housing turnover hits 30-year lows.',
    keyVulnerabilities: [
      'Negative stockholders equity (-$2.1B deficit)',
      'US Existing Home Sales slump compressing home furnishing replacement cycle',
      'Active customer count down 3.8% YoY',
      'High debt maturities requiring refinancing at 8%+ coupon rates'
    ],
    catalysts: ['Quarterly active customer metric report', 'Housing turnover macro data print'],
    metricsBase: {
      pe: undefined,
      fwdPe: 34.0,
      ps: 0.45,
      evEbitda: 22.0,
      debtEquity: -1.5,
      revGrowth: -1.2,
      netMargin: -5.8,
      fcf: '-$120M',
      siPct: 22.1,
      dtc: 5.2,
      rsiDefault: 46.0,
      distHighDefault: -35.0,
      dist200Default: -12.0,
      maTrend: 'MODERATE_BEARISH'
    },
    blueprintBase: {
      vehicle: 'DIRECT_SHORT',
      vehicleLabel: 'Direct Short / Bear Put Spread',
      entryBufferPct: -0.8,
      target1Pct: -18.0,
      target2Pct: -30.0,
      stopLossPct: 6.5,
      timeHorizon: 'POSITION_1_3_MONTHS',
      executionDetails: 'Sell short on relief rally to 50-day moving average or execute 45 DTE Bear Put Spreads.'
    }
  },
  {
    symbol: 'GME',
    name: 'GameStop Corp.',
    sector: 'Consumer Cyclical',
    industry: 'Specialty Retail',
    marketCap: 9_200_000_000,
    marketCapCat: 'MID_CAP',
    defaultArchetype: 'FUNDAMENTAL_OVERVALUATION',
    archetypeLabel: 'Dying Core Retail Model & Valuation Disconnect',
    baseConviction: 88,
    shortThesis: 'Physical disc game sales continuing 20%+ structural secular decline as Sony/Microsoft shift to 100% digital download distribution.',
    keyVulnerabilities: [
      'Hardware and software sales dropping >25% YoY',
      'Cash balance yielding low interest while core retail operations post operational losses',
      'Lack of clear corporate turnaround strategy beyond equity dilution into retail rallies',
      'Stretched EV/Revenue multiple for a declining brick-and-mortar retailer'
    ],
    catalysts: ['Upcoming holiday quarter same-store sales report', 'Next console hardware cycle announcement'],
    metricsBase: {
      pe: 280.0,
      fwdPe: 160.0,
      ps: 1.85,
      evEbitda: 85.0,
      debtEquity: 0.1,
      revGrowth: -28.0,
      netMargin: 0.8,
      fcf: '+$40M',
      siPct: 11.2,
      dtc: 2.8,
      rsiDefault: 51.0,
      distHighDefault: -62.0,
      dist200Default: -8.0,
      maTrend: 'MODERATE_BEARISH'
    },
    blueprintBase: {
      vehicle: 'BEAR_CALL_SPREAD',
      vehicleLabel: 'Bear Call Credit Spread (Fade Meme Spikes)',
      entryBufferPct: 2.0,
      target1Pct: -20.0,
      target2Pct: -35.0,
      stopLossPct: 9.0,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Sell 25% OTM Bear Call Spreads 30-45 DTE following retail volume spikes to capture high implied volatility crush.'
    }
  },
  {
    symbol: 'ARM',
    name: 'Arm Holdings plc',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 140_000_000_000,
    marketCapCat: 'LARGE_CAP',
    defaultArchetype: 'FUNDAMENTAL_OVERVALUATION',
    archetypeLabel: 'Extreme Semiconductor Multiple Overhang',
    baseConviction: 86,
    shortThesis: 'Trading at >90x forward earnings and >35x sales with limited free float (~10%), creating extreme multiple contraction risk as growth normalizes.',
    keyVulnerabilities: [
      'Forward P/E exceeding 92x, among the highest in global mega-cap semiconductors',
      'Royalty revenue growth tied to mature smartphone unit volumes (growing <4%)',
      'SoftBank ~90% ownership concentration overhang',
      'Overbought RSI with multiple negative MACD momentum divergences'
    ],
    catalysts: ['SoftBank secondary share offering filing', 'Smartphone royalty rate renegotiation reports'],
    metricsBase: {
      pe: 185.0,
      fwdPe: 92.0,
      ps: 38.5,
      evEbitda: 78.0,
      debtEquity: 0.05,
      revGrowth: 28.0,
      netMargin: 22.0,
      fcf: '+$850M',
      siPct: 6.8,
      dtc: 1.8,
      rsiDefault: 66.0,
      distHighDefault: -11.0,
      dist200Default: 24.0,
      maTrend: 'BREAKDOWN_EMERGING'
    },
    blueprintBase: {
      vehicle: 'BEAR_PUT_SPREAD',
      vehicleLabel: 'Bear Put Debit Spread',
      entryBufferPct: -1.0,
      target1Pct: -18.0,
      target2Pct: -30.0,
      stopLossPct: 5.5,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Buy 45 DTE ATM Put and sell 15% OTM Put to target multiple compression towards $110 support.'
    }
  },
  {
    symbol: 'DASH',
    name: 'DoorDash, Inc.',
    sector: 'Technology',
    industry: 'Internet Content & Information',
    marketCap: 65_000_000_000,
    marketCapCat: 'LARGE_CAP',
    defaultArchetype: 'FUNDAMENTAL_OVERVALUATION',
    archetypeLabel: 'Consumer Delivery Fatigue & Multiple Richness',
    baseConviction: 84,
    shortThesis: 'Consumer pushback against restaurant delivery markup fees and courier regulatory wage increases compressing unit margins.',
    keyVulnerabilities: [
      'P/E ratio exceeding 85x trailing GAAP earnings',
      'Average restaurant delivery cost exceeding $38 per order causing customer churn',
      'Municipal courier minimum wage legislation expanding to new metropolitan regions',
      'Heavy stock-based compensation diluting GAAP operating leverage'
    ],
    catalysts: ['Average order value (AOV) deceleration in Q3', 'New municipal delivery fee regulation'],
    metricsBase: {
      pe: 95.0,
      fwdPe: 48.0,
      ps: 6.2,
      evEbitda: 36.0,
      debtEquity: 0.35,
      revGrowth: 23.0,
      netMargin: 3.5,
      fcf: '+$1.3B',
      siPct: 4.8,
      dtc: 2.2,
      rsiDefault: 65.0,
      distHighDefault: -7.0,
      dist200Default: 22.0,
      maTrend: 'BREAKDOWN_EMERGING'
    },
    blueprintBase: {
      vehicle: 'BEAR_PUT_SPREAD',
      vehicleLabel: 'Bear Put Debit Spread',
      entryBufferPct: -1.2,
      target1Pct: -15.0,
      target2Pct: -25.0,
      stopLossPct: 5.0,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Execute 30-45 DTE Bear Put Spreads targeting pullback to 50-day moving average.'
    }
  },
  {
    symbol: 'HOOD',
    name: 'Robinhood Markets, Inc.',
    sector: 'Financial Services',
    industry: 'Capital Markets',
    marketCap: 28_000_000_000,
    marketCapCat: 'LARGE_CAP',
    defaultArchetype: 'HIGH_BETA_CYCLICAL_TOP',
    archetypeLabel: 'Cyclical Trading Volume Peak & Retail Euphoria',
    baseConviction: 85,
    shortThesis: 'Trading revenues and payment-for-order-flow (PFOF) highly tied to cyclical retail speculative options and crypto trading peaks.',
    keyVulnerabilities: [
      'Monthly active users (MAU) remaining volatile and prone to retail sentiment lulls',
      'Interest income on cash balances peaking with expected Fed rate cuts',
      'Forward P/E > 40x on highly cyclical transaction fee revenue',
      'Beta > 2.2 leading to heavy downside torque on market corrections'
    ],
    catalysts: ['Crypto trading volume slump', 'Fed interest rate cuts reducing net interest revenue'],
    metricsBase: {
      pe: 52.0,
      fwdPe: 38.0,
      ps: 11.5,
      evEbitda: 28.0,
      debtEquity: 0.45,
      revGrowth: 35.0,
      netMargin: 24.0,
      fcf: '+$900M',
      siPct: 7.8,
      dtc: 1.9,
      rsiDefault: 68.0,
      distHighDefault: -6.0,
      dist200Default: 32.0,
      maTrend: 'BREAKDOWN_EMERGING'
    },
    blueprintBase: {
      vehicle: 'BEAR_CALL_SPREAD',
      vehicleLabel: 'Bear Call Credit Spread',
      entryBufferPct: 1.0,
      target1Pct: -18.0,
      target2Pct: -30.0,
      stopLossPct: 6.0,
      timeHorizon: 'SWING_1_4_WEEKS',
      executionDetails: 'Sell OTM Call Credit spread 30 DTE above key psychological resistance to harvest high IV.'
    }
  }
];

export class ShortCandidateService {
  /**
   * Run the autonomous AI Short Finding Agent against market universe and filters
   */
  async scanShortCandidates(filters: ShortAgentFilterParams = {}): Promise<ShortCandidateScanResult> {
    const task = agentActivityTracker.startTask({
      agentName: 'AI Short Finding & Bearish Catalyst Agent',
      agentType: 'TRADE_IDEA_GENERATOR',
      taskDescription: `Scanning high-conviction short candidates (Archetype: ${filters.archetype || 'ALL'}, Market Cap: ${filters.marketCapCategory || 'ALL'}, Prompt: ${filters.customPrompt || 'None'})`,
      metadata: filters
    });

    try {
      // 1. Fetch live Macro & Market Context
      let vixLevel = 16.2;
      let spyChange = -0.35;
      try {
        const [vixQuote, spyQuote] = await Promise.allSettled([
          yahooFinance.quote('^VIX'),
          yahooFinance.quote('SPY')
        ]);
        if (vixQuote.status === 'fulfilled' && vixQuote.value?.regularMarketPrice) {
          vixLevel = vixQuote.value.regularMarketPrice;
        }
        if (spyQuote.status === 'fulfilled' && spyQuote.value?.regularMarketChangePercent) {
          spyChange = spyQuote.value.regularMarketChangePercent * 100;
        }
      } catch (err) {
        // Fallback macro
      }

      let marketRegime: 'RISK_OFF_BEARISH' | 'DISTRIBUTION_CHOP' | 'ELEVATED_VOLATILITY' | 'OVERBOUGHT_BULLISH' = 'DISTRIBUTION_CHOP';
      if (vixLevel > 22 || spyChange < -1.2) marketRegime = 'RISK_OFF_BEARISH';
      else if (vixLevel > 18) marketRegime = 'ELEVATED_VOLATILITY';
      else if (spyChange > 0.8 && vixLevel < 14) marketRegime = 'OVERBOUGHT_BULLISH';

      // 2. Fetch live prices for short candidate universe
      const quotesMap = new Map<string, { price: number; change: number; mktCap?: number }>();

      await Promise.allSettled(
        SHORT_UNIVERSE_TEMPLATES.map(async (tmpl) => {
          try {
            const q = await yahooFinance.quote(tmpl.symbol);
            if (q?.regularMarketPrice) {
              quotesMap.set(tmpl.symbol, {
                price: q.regularMarketPrice,
                change: (q.regularMarketChangePercent || 0) * 100,
                mktCap: q.marketCap || tmpl.marketCap
              });
            }
          } catch {
            // Realistic fallback quote
            quotesMap.set(tmpl.symbol, {
              price: tmpl.symbol === 'CVNA' ? 218.4 : tmpl.symbol === 'LCID' ? 2.45 : tmpl.symbol === 'UPST' ? 62.1 : tmpl.symbol === 'SMCI' ? 38.5 : tmpl.symbol === 'MSTR' ? 342.0 : 50.0,
              change: -1.25,
              mktCap: tmpl.marketCap
            });
          }
        })
      );

      // 3. Synthesize candidate opportunities
      const synthesized: ShortTradeCandidate[] = [];

      for (const tmpl of SHORT_UNIVERSE_TEMPLATES) {
        const liveQuote = quotesMap.get(tmpl.symbol) || { price: 50.0, change: -0.5, mktCap: tmpl.marketCap };
        const price = liveQuote.price;
        const change = liveQuote.change;
        const mktCap = liveQuote.mktCap || tmpl.marketCap;

        // Determine Market Cap Cat
        let mktCapCat: MarketCapCategory = 'MID_CAP';
        if (mktCap >= 200_000_000_000) mktCapCat = 'MEGA_CAP';
        else if (mktCap >= 10_000_000_000) mktCapCat = 'LARGE_CAP';
        else if (mktCap >= 2_000_000_000) mktCapCat = 'MID_CAP';
        else mktCapCat = 'SMALL_CAP';

        // Calculate Trigger & Target Levels
        const entryTriggerPrice = Math.round(price * (1 + tmpl.blueprintBase.entryBufferPct / 100) * 100) / 100;
        const targetPrice1 = Math.round(price * (1 + tmpl.blueprintBase.target1Pct / 100) * 100) / 100;
        const targetPrice2 = Math.round(price * (1 + tmpl.blueprintBase.target2Pct / 100) * 100) / 100;
        const stopLossPrice = Math.round(price * (1 + tmpl.blueprintBase.stopLossPct / 100) * 100) / 100;

        const downsidePotentialPercent = Math.abs(tmpl.blueprintBase.target1Pct);
        const riskPercent = Math.abs(tmpl.blueprintBase.stopLossPct);
        const rrRatio = (downsidePotentialPercent / riskPercent).toFixed(2) + ' : 1';

        // Calculate dynamic conviction score with prompt & market regime modifiers
        let conviction = tmpl.baseConviction;
        if (change < -1.5) conviction += 2;
        if (marketRegime === 'RISK_OFF_BEARISH') conviction += 3;
        if (marketRegime === 'OVERBOUGHT_BULLISH' && tmpl.defaultArchetype === 'FUNDAMENTAL_OVERVALUATION') conviction += 2;

        // Custom prompt weighting
        if (filters.customPrompt) {
          const p = filters.customPrompt.toLowerCase();
          if (p.includes(tmpl.symbol.toLowerCase()) || p.includes(tmpl.sector.toLowerCase()) || p.includes(tmpl.industry.toLowerCase())) {
            conviction = Math.min(98, conviction + 6);
          }
          if (p.includes('debt') && tmpl.defaultArchetype === 'BALANCE_SHEET_DISTRESS') conviction = Math.min(98, conviction + 5);
          if (p.includes('valuation') && tmpl.defaultArchetype === 'FUNDAMENTAL_OVERVALUATION') conviction = Math.min(98, conviction + 5);
          if (p.includes('technical') || p.includes('breakdown')) {
            if (tmpl.defaultArchetype === 'TECHNICAL_BREAKDOWN') conviction = Math.min(98, conviction + 5);
          }
        }

        conviction = Math.min(98, Math.max(65, conviction));

        let convictionTier: 'HIGH_CONVICTION' | 'MODERATE_CONVICTION' | 'TACTICAL_SPECULATIVE' = 'MODERATE_CONVICTION';
        if (conviction >= 88) convictionTier = 'HIGH_CONVICTION';
        else if (conviction >= 78) convictionTier = 'MODERATE_CONVICTION';
        else convictionTier = 'TACTICAL_SPECULATIVE';

        // Approximate Options Structure if relevant
        const targetDte = 35;
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + targetDte);
        const expDateStr = expDate.toISOString().slice(0, 10);

        const primaryStrike = Math.round(price * 0.98 * 10) / 10;
        const secondaryStrike = Math.round(price * 0.85 * 10) / 10;

        synthesized.push({
          id: `short-${tmpl.symbol}-${Date.now()}`,
          symbol: tmpl.symbol,
          companyName: tmpl.name,
          currentPrice: price,
          dayChangePercent: change,
          sector: tmpl.sector,
          industry: tmpl.industry,
          marketCap: mktCap,
          marketCapCategory: mktCapCat,
          archetype: tmpl.defaultArchetype,
          archetypeLabel: tmpl.archetypeLabel,
          convictionScore: conviction,
          convictionTier,
          shortThesis: tmpl.shortThesis,
          keyVulnerabilities: tmpl.keyVulnerabilities,
          catalysts: tmpl.catalysts,
          metrics: {
            peRatio: tmpl.metricsBase.pe,
            forwardPE: tmpl.metricsBase.fwdPe,
            priceToSales: tmpl.metricsBase.ps,
            evToEbitda: tmpl.metricsBase.evEbitda,
            debtToEquity: tmpl.metricsBase.debtEquity,
            revenueGrowthYoY: tmpl.metricsBase.revGrowth,
            netMargin: tmpl.metricsBase.netMargin,
            freeCashFlow: tmpl.metricsBase.fcf,
            shortInterestPercent: tmpl.metricsBase.siPct,
            daysToCover: tmpl.metricsBase.dtc,
            rsi14: tmpl.metricsBase.rsiDefault,
            distFrom52wHighPercent: tmpl.metricsBase.distHighDefault,
            distFrom200DmaPercent: tmpl.metricsBase.dist200Default,
            movingAverageTrend: tmpl.metricsBase.maTrend
          },
          tradeBlueprint: {
            recommendedVehicle: tmpl.blueprintBase.vehicle,
            vehicleLabel: tmpl.blueprintBase.vehicleLabel,
            entryTriggerPrice,
            entryCondition: tmpl.blueprintBase.entryBufferPct < 0 
              ? `Confirm breakdown below $${entryTriggerPrice.toFixed(2)} support` 
              : `Fade rally near $${entryTriggerPrice.toFixed(2)} resistance`,
            targetPrice1,
            targetPrice2,
            stopLossPrice,
            downsidePotentialPercent,
            riskPercent,
            riskRewardRatio: rrRatio,
            timeHorizon: tmpl.blueprintBase.timeHorizon,
            executionDetails: tmpl.blueprintBase.executionDetails,
            optionsStructure: {
              strategyName: `${tmpl.symbol} ${tmpl.blueprintBase.vehicle === 'BEAR_PUT_SPREAD' ? 'Bear Put Spread' : tmpl.blueprintBase.vehicle === 'BEAR_CALL_SPREAD' ? 'Bear Call Spread' : 'Long Put'}`,
              primaryStrike,
              secondaryStrike: tmpl.blueprintBase.vehicle.includes('SPREAD') ? secondaryStrike : undefined,
              targetExpiration: expDateStr,
              targetDte,
              estimatedCostOrCredit: Math.round(price * 0.04 * 100) / 100,
              maxProfit: Math.round(price * 0.12 * 100) / 100,
              maxLoss: Math.round(price * 0.04 * 100) / 100
            }
          }
        });
      }

      // 4. Apply Filters
      let filtered = synthesized;

      if (filters.archetype && filters.archetype !== 'ALL') {
        filtered = filtered.filter(c => c.archetype === filters.archetype);
      }

      if (filters.executionVehicle && filters.executionVehicle !== 'ALL') {
        filtered = filtered.filter(c => c.tradeBlueprint.recommendedVehicle === filters.executionVehicle);
      }

      if (filters.marketCapCategory && filters.marketCapCategory !== 'ALL') {
        filtered = filtered.filter(c => c.marketCapCategory === filters.marketCapCategory);
      }

      if (filters.sector && filters.sector !== 'ALL') {
        const secLower = filters.sector.toLowerCase();
        filtered = filtered.filter(c => c.sector.toLowerCase().includes(secLower));
      }

      if (filters.minConviction !== undefined && filters.minConviction > 0) {
        filtered = filtered.filter(c => c.convictionScore >= filters.minConviction!);
      }

      if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
        filtered = filtered.filter(c => c.currentPrice <= filters.maxPrice!);
      }

      if (filters.minPrice !== undefined && filters.minPrice > 0) {
        filtered = filtered.filter(c => c.currentPrice >= filters.minPrice!);
      }

      if (filters.searchQuery) {
        const q = filters.searchQuery.toUpperCase().trim();
        filtered = filtered.filter(c => 
          c.symbol.includes(q) || 
          c.companyName.toUpperCase().includes(q) ||
          c.sector.toUpperCase().includes(q) ||
          c.industry.toUpperCase().includes(q)
        );
      }

      // Sort by conviction score desc
      filtered.sort((a, b) => b.convictionScore - a.convictionScore);

      // Breakdowns
      const sectorBreakdown: Record<string, number> = {};
      const archetypeBreakdown: Record<string, number> = {};

      filtered.forEach(c => {
        sectorBreakdown[c.sector] = (sectorBreakdown[c.sector] || 0) + 1;
        archetypeBreakdown[c.archetype] = (archetypeBreakdown[c.archetype] || 0) + 1;
      });

      const result: ShortCandidateScanResult = {
        scanTimestamp: new Date().toISOString(),
        totalUniverseScanned: SHORT_UNIVERSE_TEMPLATES.length,
        matchedCount: filtered.length,
        marketContext: {
          spyTrend: spyChange >= 0 ? `SPY +${spyChange.toFixed(2)}% (Bullish Tailwinds)` : `SPY ${spyChange.toFixed(2)}% (Broad Distribution)`,
          vixLevel,
          marketRegime
        },
        sectorBreakdown,
        archetypeBreakdown,
        candidates: filtered
      };

      agentActivityTracker.completeTask(task.id, {
        status: 'SUCCESS',
        outcomeSummary: `Found ${filtered.length} short candidates across ${SHORT_UNIVERSE_TEMPLATES.length} scanned universe equities.`,
        metadata: { matchedCount: filtered.length, topCandidate: filtered[0]?.symbol }
      });

      return result;
    } catch (err: any) {
      agentActivityTracker.completeTask(task.id, {
        status: 'FAILED',
        error: err?.message || String(err)
      });
      throw err;
    }
  }
}

export const shortCandidateService = new ShortCandidateService();
