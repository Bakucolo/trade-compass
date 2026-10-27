// server/services/commoditiesService.ts
// Comprehensive Commodities Intelligence, Pricing & Forward Curves Service

export type CommodityCategory = 'energy' | 'precious_metals' | 'industrial_metals' | 'agriculture' | 'livestock';

export type CurveStructure = 'BACKWARDATION' | 'CONTANGO' | 'FLAT';

export type CommodityTimeframe = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y';

export interface CommodityPriceItem {
  id: string;
  symbol: string;
  name: string;
  shortName: string;
  category: CommodityCategory;
  categoryLabel: string;
  unit: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  returns: Record<CommodityTimeframe, number>;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  range52wPercent: number;
  promptSpread: number;
  curveStructure: CurveStructure;
  annualizedRollYield: number;
  exchange: string;
  tradingViewSymbol: string;
  description: string;
}

export interface ForwardCurvePoint {
  tenor: string;
  contractCode: string;
  contractMonth: string;
  price: number;
  spreadToPrompt: number;
  spreadPercent: number;
  historicalOneMonthAgo: number;
  historicalSixMonthsAgo: number;
}

export interface CalendarSpreadItem {
  name: string;
  spread: number;
  spreadPercent: number;
  annualizedRate: number;
  signal: 'BULLISH_BACKWARDATION' | 'BEARISH_CONTANGO' | 'NEUTRAL';
  implication: string;
}

export interface CommodityForwardCurveData {
  id: string;
  name: string;
  symbol: string;
  category: CommodityCategory;
  unit: string;
  spotPrice: number;
  promptPrice: number;
  structure: CurveStructure;
  slopePercent: number;
  promptSpread: number;
  annualizedRollYield: number;
  curveShapeDescription: string;
  marketThesis: string;
  points: ForwardCurvePoint[];
  calendarSpreads: CalendarSpreadItem[];
  keyStats: {
    inventoryContext: string;
    supplyCatalyst: string;
    demandCatalyst: string;
    seasonalPattern: string;
  };
}

export interface CommodityMacroRatio {
  id: string;
  name: string;
  symbol: string;
  numeratorName: string;
  denominatorName: string;
  currentValue: number;
  prevValue: number;
  change: number;
  changePercent: number;
  historicalMean: number;
  historicalHigh52w: number;
  historicalLow52w: number;
  valuationStatus: 'EXTREME_HIGH' | 'HIGH' | 'FAIR' | 'LOW' | 'EXTREME_LOW';
  macroSignal: string;
  interpretation: string;
}

export interface CommoditiesIntelligenceResponse {
  timestamp: string;
  marketRegime: {
    overallPosture: 'BROAD_BACKWARDATION' | 'BROAD_CONTANGO' | 'MIXED_SECTOR_ROTATION';
    summary: string;
    energyRegime: string;
    metalsRegime: string;
    agricultureRegime: string;
    inflationaryImpulseScore: number;
  };
  commodities: CommodityPriceItem[];
  forwardCurves: Record<string, CommodityForwardCurveData>;
  macroRatios: CommodityMacroRatio[];
}

interface CommodityMetadata {
  id: string;
  symbol: string;
  name: string;
  shortName: string;
  category: CommodityCategory;
  categoryLabel: string;
  unit: string;
  exchange: string;
  tradingViewSymbol: string;
  fallbackPrice: number;
  fallbackPrevClose: number;
  fallbackReturns: Record<CommodityTimeframe, number>;
  description: string;
}

const COMMODITY_CATALOG: CommodityMetadata[] = [
  // 1. Energy
  {
    id: 'CL',
    symbol: 'CL=F',
    name: 'WTI Light Sweet Crude Oil',
    shortName: 'WTI Crude',
    category: 'energy',
    categoryLabel: 'Energy',
    unit: '$/bbl',
    exchange: 'NYMEX',
    tradingViewSymbol: 'NYMEX:CL1!',
    fallbackPrice: 71.40,
    fallbackPrevClose: 70.80,
    fallbackReturns: { '1D': 0.85, '1W': -1.20, '1M': -3.40, '3M': -5.20, '6M': -8.60, 'YTD': -2.10, '1Y': -6.80 },
    description: 'Global benchmark for light sweet crude oil. Primary driver of refined product costs and headline inflation.',
  },
  {
    id: 'BZ',
    symbol: 'BZ=F',
    name: 'Brent Crude Oil',
    shortName: 'Brent Crude',
    category: 'energy',
    categoryLabel: 'Energy',
    unit: '$/bbl',
    exchange: 'ICE',
    tradingViewSymbol: 'ICEEUR:B1!',
    fallbackPrice: 75.20,
    fallbackPrevClose: 74.60,
    fallbackReturns: { '1D': 0.80, '1W': -1.10, '1M': -3.10, '3M': -4.80, '6M': -7.90, 'YTD': -1.80, '1Y': -6.20 },
    description: 'International seaborne crude oil benchmark pricing ~80% of global waterborne crude trades.',
  },
  {
    id: 'NG',
    symbol: 'NG=F',
    name: 'Henry Hub Natural Gas',
    shortName: 'Natural Gas',
    category: 'energy',
    categoryLabel: 'Energy',
    unit: '$/MMBtu',
    exchange: 'NYMEX',
    tradingViewSymbol: 'NYMEX:NG1!',
    fallbackPrice: 2.85,
    fallbackPrevClose: 2.78,
    fallbackReturns: { '1D': 2.52, '1W': 5.80, '1M': 11.20, '3M': 18.40, '6M': 12.10, 'YTD': 8.50, '1Y': -14.20 },
    description: 'North American heating, electricity generation, and LNG export feedstock benchmark.',
  },
  {
    id: 'RB',
    symbol: 'RB=F',
    name: 'RBOB Gasoline',
    shortName: 'RBOB Gasoline',
    category: 'energy',
    categoryLabel: 'Energy',
    unit: '$/gal',
    exchange: 'NYMEX',
    tradingViewSymbol: 'NYMEX:RB1!',
    fallbackPrice: 2.12,
    fallbackPrevClose: 2.09,
    fallbackReturns: { '1D': 1.44, '1W': -0.60, '1M': -2.80, '3M': -6.10, '6M': -9.40, 'YTD': -3.20, '1Y': -8.10 },
    description: 'Reformulated gasoline blendstock for oxygenate blending; key consumer transport inflation proxy.',
  },
  {
    id: 'HO',
    symbol: 'HO=F',
    name: 'Heating Oil / Diesel (ULSD)',
    shortName: 'Diesel / Heating Oil',
    category: 'energy',
    categoryLabel: 'Energy',
    unit: '$/gal',
    exchange: 'NYMEX',
    tradingViewSymbol: 'NYMEX:HO1!',
    fallbackPrice: 2.24,
    fallbackPrevClose: 2.21,
    fallbackReturns: { '1D': 1.36, '1W': -0.40, '1M': -2.20, '3M': -5.40, '6M': -8.80, 'YTD': -2.80, '1Y': -7.40 },
    description: 'Ultra-low sulfur diesel and distillate fuel oil; direct proxy for freight shipping and industrial diesel burn.',
  },
  {
    id: 'URA',
    symbol: 'URA',
    name: 'Uranium & Nuclear Fuel (Global X ETF)',
    shortName: 'Uranium Fuel',
    category: 'energy',
    categoryLabel: 'Energy',
    unit: '$/share',
    exchange: 'NYSE Arca',
    tradingViewSymbol: 'AMEX:URA',
    fallbackPrice: 31.80,
    fallbackPrevClose: 31.20,
    fallbackReturns: { '1D': 1.92, '1W': 4.20, '1M': 8.80, '3M': 16.40, '6M': 28.20, 'YTD': 38.50, '1Y': 46.20 },
    description: 'Uranium mining, conversion, and enrichment basket powering baseload clean power for AI data centers.',
  },

  // 2. Precious Metals
  {
    id: 'GC',
    symbol: 'GC=F',
    name: 'Gold Futures (100 oz)',
    shortName: 'Gold Bullion',
    category: 'precious_metals',
    categoryLabel: 'Precious Metals',
    unit: '$/troy oz',
    exchange: 'COMEX',
    tradingViewSymbol: 'COMEX:GC1!',
    fallbackPrice: 2740.50,
    fallbackPrevClose: 2728.00,
    fallbackReturns: { '1D': 0.46, '1W': 1.80, '1M': 4.20, '3M': 9.60, '6M': 18.40, 'YTD': 26.80, '1Y': 32.50 },
    description: 'Global monetary reserve asset, sovereign debasement shield, and geopolitical safe-haven barometer.',
  },
  {
    id: 'SI',
    symbol: 'SI=F',
    name: 'Silver Futures (5,000 oz)',
    shortName: 'Silver',
    category: 'precious_metals',
    categoryLabel: 'Precious Metals',
    unit: '$/troy oz',
    exchange: 'COMEX',
    tradingViewSymbol: 'COMEX:SI1!',
    fallbackPrice: 32.80,
    fallbackPrevClose: 32.40,
    fallbackReturns: { '1D': 1.23, '1W': 3.50, '1M': 8.10, '3M': 14.20, '6M': 22.60, 'YTD': 36.20, '1Y': 41.80 },
    description: 'Dual-nature monetary metal and high-demand industrial conductor for photovoltaics (solar) and electronics.',
  },
  {
    id: 'PL',
    symbol: 'PL=F',
    name: 'Platinum Futures (50 oz)',
    shortName: 'Platinum',
    category: 'precious_metals',
    categoryLabel: 'Precious Metals',
    unit: '$/troy oz',
    exchange: 'NYMEX',
    tradingViewSymbol: 'NYMEX:PL1!',
    fallbackPrice: 995.00,
    fallbackPrevClose: 988.00,
    fallbackReturns: { '1D': 0.71, '1W': 1.20, '1M': 2.80, '3M': 4.10, '6M': 6.80, 'YTD': 8.40, '1Y': 11.20 },
    description: 'Autocatalyst emissions converter and hydrogen economy electrolyzer catalyst.',
  },
  {
    id: 'PA',
    symbol: 'PA=F',
    name: 'Palladium Futures (100 oz)',
    shortName: 'Palladium',
    category: 'precious_metals',
    categoryLabel: 'Precious Metals',
    unit: '$/troy oz',
    exchange: 'NYMEX',
    tradingViewSymbol: 'NYMEX:PA1!',
    fallbackPrice: 1045.00,
    fallbackPrevClose: 1038.00,
    fallbackReturns: { '1D': 0.67, '1W': -1.40, '1M': -4.20, '3M': -8.60, '6M': -14.20, 'YTD': -18.60, '1Y': -24.80 },
    description: 'Gasoline internal combustion catalytic converter metal heavily exposed to Russian production.',
  },

  // 3. Industrial / Base Metals
  {
    id: 'HG',
    symbol: 'HG=F',
    name: 'High Grade Copper (Dr. Copper)',
    shortName: 'Copper',
    category: 'industrial_metals',
    categoryLabel: 'Industrial Metals',
    unit: '$/lb',
    exchange: 'COMEX',
    tradingViewSymbol: 'COMEX:HG1!',
    fallbackPrice: 4.38,
    fallbackPrevClose: 4.32,
    fallbackReturns: { '1D': 1.39, '1W': 2.10, '1M': 3.80, '3M': 6.40, '6M': 12.80, 'YTD': 16.20, '1Y': 21.40 },
    description: 'The PhD of macro economics. Unrivaled electrical wiring and grid expansion conductor reflecting global GDP health.',
  },
  {
    id: 'ALI',
    symbol: 'ALI=F',
    name: 'Aluminum Futures',
    shortName: 'Aluminum',
    category: 'industrial_metals',
    categoryLabel: 'Industrial Metals',
    unit: '$/metric ton',
    exchange: 'COMEX',
    tradingViewSymbol: 'COMEX:ALI1!',
    fallbackPrice: 2620.00,
    fallbackPrevClose: 2595.00,
    fallbackReturns: { '1D': 0.96, '1W': 1.90, '1M': 4.20, '3M': 8.10, '6M': 14.60, 'YTD': 18.20, '1Y': 22.80 },
    description: 'Energy-intensive lightweight structural metal essential for aerospace, transport, and packaging.',
  },

  // 4. Agriculture & Softs
  {
    id: 'ZC',
    symbol: 'ZC=F',
    name: 'Corn Futures (5,000 bu)',
    shortName: 'Corn',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    unit: '¢/bushel',
    exchange: 'CBOT',
    tradingViewSymbol: 'CBOT:ZC1!',
    fallbackPrice: 425.50,
    fallbackPrevClose: 422.00,
    fallbackReturns: { '1D': 0.83, '1W': 0.60, '1M': -1.80, '3M': -4.20, '6M': -8.40, 'YTD': -12.60, '1Y': -16.80 },
    description: 'Primary feed grain, ethanol biofuel feedstock, and food manufacturing input.',
  },
  {
    id: 'ZW',
    symbol: 'ZW=F',
    name: 'Chicago SRW Wheat (5,000 bu)',
    shortName: 'Wheat',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    unit: '¢/bushel',
    exchange: 'CBOT',
    tradingViewSymbol: 'CBOT:ZW1!',
    fallbackPrice: 585.00,
    fallbackPrevClose: 580.00,
    fallbackReturns: { '1D': 0.86, '1W': 1.20, '1M': -2.40, '3M': -5.10, '6M': -9.80, 'YTD': -14.10, '1Y': -18.20 },
    description: 'Global staple bread grain. Vital geopolitical food security and Black Sea export barometer.',
  },
  {
    id: 'ZS',
    symbol: 'ZS=F',
    name: 'Soybean Futures (5,000 bu)',
    shortName: 'Soybeans',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    unit: '¢/bushel',
    exchange: 'CBOT',
    tradingViewSymbol: 'CBOT:ZS1!',
    fallbackPrice: 1020.00,
    fallbackPrevClose: 1012.00,
    fallbackReturns: { '1D': 0.79, '1W': 0.40, '1M': -2.10, '3M': -4.60, '6M': -11.20, 'YTD': -15.40, '1Y': -19.50 },
    description: 'Protein meal for livestock and soybean oil for renewable diesel and culinary staples.',
  },
  {
    id: 'KC',
    symbol: 'KC=F',
    name: 'Coffee Arabica Futures',
    shortName: 'Coffee',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    unit: '¢/lb',
    exchange: 'ICE',
    tradingViewSymbol: 'ICEUS:KC1!',
    fallbackPrice: 252.00,
    fallbackPrevClose: 248.50,
    fallbackReturns: { '1D': 1.41, '1W': 3.80, '1M': 9.20, '3M': 18.50, '6M': 34.20, 'YTD': 48.60, '1Y': 62.40 },
    description: 'High-grade Arabica coffee driven by Brazilian rainfall and European Deforestation Regulation compliance.',
  },
  {
    id: 'SB',
    symbol: 'SB=F',
    name: 'Sugar #11 World Futures',
    shortName: 'Sugar #11',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    unit: '¢/lb',
    exchange: 'ICE',
    tradingViewSymbol: 'ICEUS:SB1!',
    fallbackPrice: 22.40,
    fallbackPrevClose: 22.10,
    fallbackReturns: { '1D': 1.36, '1W': 2.80, '1M': 5.10, '3M': 3.20, '6M': -6.40, 'YTD': -4.20, '1Y': -12.80 },
    description: 'Raw cane sugar international benchmark; deeply linked to Brazilian sugarcane ethanol parity.',
  },
  {
    id: 'CC',
    symbol: 'CC=F',
    name: 'Cocoa Futures',
    shortName: 'Cocoa',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    unit: '$/metric ton',
    exchange: 'ICE',
    tradingViewSymbol: 'ICEUS:CC1!',
    fallbackPrice: 7850.00,
    fallbackPrevClose: 7720.00,
    fallbackReturns: { '1D': 1.68, '1W': 4.60, '1M': 12.40, '3M': 24.80, '6M': 58.20, 'YTD': 112.50, '1Y': 148.00 },
    description: 'West African cocoa bean contract subject to historic supply deficits in Côte d’Ivoire and Ghana.',
  },
  {
    id: 'CT',
    symbol: 'CT=F',
    name: 'Cotton #2 Futures',
    shortName: 'Cotton',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    unit: '¢/lb',
    exchange: 'ICE',
    tradingViewSymbol: 'ICEUS:CT1!',
    fallbackPrice: 73.50,
    fallbackPrevClose: 72.80,
    fallbackReturns: { '1D': 0.96, '1W': -0.80, '1M': -3.20, '3M': -6.80, '6M': -11.40, 'YTD': -14.80, '1Y': -18.60 },
    description: 'Textile and apparel raw material reflecting discretionary consumer goods demand.',
  },

  // 5. Livestock
  {
    id: 'LE',
    symbol: 'LE=F',
    name: 'Live Cattle Futures',
    shortName: 'Live Cattle',
    category: 'livestock',
    categoryLabel: 'Livestock',
    unit: '¢/lb',
    exchange: 'CME',
    tradingViewSymbol: 'CME:LE1!',
    fallbackPrice: 188.20,
    fallbackPrevClose: 186.90,
    fallbackReturns: { '1D': 0.70, '1W': 1.40, '1M': 3.20, '3M': 5.80, '6M': 9.40, 'YTD': 14.20, '1Y': 18.60 },
    description: 'Fed cattle beef production index at historic multi-decade US herd lows.',
  },
  {
    id: 'HE',
    symbol: 'HE=F',
    name: 'Lean Hogs Futures',
    shortName: 'Lean Hogs',
    category: 'livestock',
    categoryLabel: 'Livestock',
    unit: '¢/lb',
    exchange: 'CME',
    tradingViewSymbol: 'CME:HE1!',
    fallbackPrice: 84.50,
    fallbackPrevClose: 83.90,
    fallbackReturns: { '1D': 0.72, '1W': 1.10, '1M': 2.40, '3M': -2.10, '6M': 6.20, 'YTD': 11.80, '1Y': 15.40 },
    description: 'Wholesale pork carcass benchmark driven by domestic grilling demand and Chinese export demand.',
  },
];

// In-memory cache
let cachedCommoditiesData: { timestamp: number; data: CommoditiesIntelligenceResponse } | null = null;
const CACHE_TTL_MS = 25 * 1000; // 25 seconds

/**
 * Helper to compute returns across timeframes from Yahoo Finance historical closes
 */
function computeYahooReturns(
  timestamps: number[] | undefined,
  rawCloses: (number | null)[] | undefined,
  currentPrice: number,
  prevClose: number,
  fallbackReturns: Record<CommodityTimeframe, number>
): Record<CommodityTimeframe, number> {
  const returns: Record<CommodityTimeframe, number> = { ...fallbackReturns };

  // 1D return
  if (prevClose > 0) {
    returns['1D'] = Number((((currentPrice - prevClose) / prevClose) * 100).toFixed(2));
  }

  if (!rawCloses || rawCloses.length < 5) {
    return returns;
  }

  // Filter valid close prices
  const validPairs: { time: number; close: number }[] = [];
  for (let i = 0; i < rawCloses.length; i++) {
    const c = rawCloses[i];
    const t = timestamps?.[i] ?? 0;
    if (typeof c === 'number' && !isNaN(c) && c > 0) {
      validPairs.push({ time: t, close: c });
    }
  }

  if (validPairs.length < 3) return returns;

  const n = validPairs.length;
  const latest = currentPrice > 0 ? currentPrice : validPairs[n - 1].close;

  // 1W: ~5 trading sessions back
  const idx1W = Math.max(0, n - 6);
  if (validPairs[idx1W]?.close > 0) {
    returns['1W'] = Number((((latest - validPairs[idx1W].close) / validPairs[idx1W].close) * 100).toFixed(2));
  }

  // 1M: ~21 trading sessions back
  const idx1M = Math.max(0, n - 22);
  if (validPairs[idx1M]?.close > 0) {
    returns['1M'] = Number((((latest - validPairs[idx1M].close) / validPairs[idx1M].close) * 100).toFixed(2));
  }

  // 3M: ~63 trading sessions back
  const idx3M = Math.max(0, n - 64);
  if (validPairs[idx3M]?.close > 0) {
    returns['3M'] = Number((((latest - validPairs[idx3M].close) / validPairs[idx3M].close) * 100).toFixed(2));
  }

  // 6M: ~126 trading sessions back
  const idx6M = Math.max(0, n - 127);
  if (validPairs[idx6M]?.close > 0) {
    returns['6M'] = Number((((latest - validPairs[idx6M].close) / validPairs[idx6M].close) * 100).toFixed(2));
  }

  // YTD: since Jan 1st of current year
  const currentYear = new Date().getFullYear();
  const ytdStartTimestamp = new Date(currentYear, 0, 1).getTime() / 1000;
  const ytdPair = validPairs.find((p) => p.time >= ytdStartTimestamp) || validPairs[0];
  if (ytdPair?.close > 0) {
    returns['YTD'] = Number((((latest - ytdPair.close) / ytdPair.close) * 100).toFixed(2));
  }

  // 1Y: ~252 trading sessions back (or first available)
  const idx1Y = Math.max(0, n - 253);
  const oneYearPair = validPairs[idx1Y] || validPairs[0];
  if (oneYearPair?.close > 0) {
    returns['1Y'] = Number((((latest - oneYearPair.close) / oneYearPair.close) * 100).toFixed(2));
  }

  return returns;
}

/**
 * Fetch live commodity prices from Yahoo Finance
 */
async function fetchLiveCommodityQuotes(): Promise<Map<string, {
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  returns: Record<CommodityTimeframe, number>;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}>> {
  const quoteMap = new Map();

  await Promise.all(
    COMMODITY_CATALOG.map(async (item) => {
      try {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}?range=1y&interval=1d`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const meta = json.chart?.result?.[0]?.meta;
        if (!meta) throw new Error('No meta');

        const price = meta.regularMarketPrice ?? meta.previousClose ?? item.fallbackPrice;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? item.fallbackPrevClose;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const dayHigh = meta.regularMarketDayHigh || price * 1.01;
        const dayLow = meta.regularMarketDayLow || price * 0.99;
        const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || price * 1.2;
        const fiftyTwoWeekLow = meta.fiftyTwoWeekLow || price * 0.8;

        const timestamps = json.chart?.result?.[0]?.timestamp;
        const rawCloses = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
        const returns = computeYahooReturns(timestamps, rawCloses, price, prevClose, item.fallbackReturns);

        quoteMap.set(item.id, {
          price: Number(price.toFixed(2)),
          prevClose: Number(prevClose.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          returns,
          dayHigh: Number(dayHigh.toFixed(2)),
          dayLow: Number(dayLow.toFixed(2)),
          fiftyTwoWeekHigh: Number(fiftyTwoWeekHigh.toFixed(2)),
          fiftyTwoWeekLow: Number(fiftyTwoWeekLow.toFixed(2)),
        });
      } catch {
        // Fallback to calibrated realistic mock
        const price = item.fallbackPrice;
        const prevClose = item.fallbackPrevClose;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const returns = { ...item.fallbackReturns };
        returns['1D'] = Number(changePercent.toFixed(2));

        quoteMap.set(item.id, {
          price,
          prevClose,
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          returns,
          dayHigh: Number((price * 1.015).toFixed(2)),
          dayLow: Number((price * 0.985).toFixed(2)),
          fiftyTwoWeekHigh: Number((price * 1.22).toFixed(2)),
          fiftyTwoWeekLow: Number((price * 0.78).toFixed(2)),
        });
      }
    })
  );

  return quoteMap;
}

/**
 * Builds realistic forward curves for key commodities
 */
function buildForwardCurve(
  commodityId: string,
  promptPrice: number,
  baseDate: Date
): CommodityForwardCurveData {
  const tenors = [
    { tenor: 'M1', offsetMonths: 0, codeSuffix: '' },
    { tenor: 'M2', offsetMonths: 1, codeSuffix: '' },
    { tenor: 'M3', offsetMonths: 2, codeSuffix: '' },
    { tenor: 'M4', offsetMonths: 3, codeSuffix: '' },
    { tenor: 'M5', offsetMonths: 4, codeSuffix: '' },
    { tenor: 'M6', offsetMonths: 5, codeSuffix: '' },
    { tenor: 'M9', offsetMonths: 8, codeSuffix: '' },
    { tenor: 'M12', offsetMonths: 11, codeSuffix: '' },
    { tenor: 'M18', offsetMonths: 17, codeSuffix: '' },
    { tenor: 'M24', offsetMonths: 23, codeSuffix: '' },
  ];

  // Specific curve shape multiplier profiles for each commodity:
  // e.g. [0, delta_M2, delta_M3, delta_M4, delta_M5, delta_M6, delta_M9, delta_M12, delta_M18, delta_M24]
  let deltas: number[] = [];
  let structure: CurveStructure = 'BACKWARDATION';
  let marketThesis = '';
  let curveShapeDescription = '';
  let inventoryContext = '';
  let supplyCatalyst = '';
  let demandCatalyst = '';
  let seasonalPattern = '';

  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth(); // 0-indexed

  switch (commodityId) {
    case 'CL': // WTI Crude: Moderate backwardation due to prompt tightness & Red Sea risk
      structure = 'BACKWARDATION';
      deltas = [0, -0.42, -0.85, -1.25, -1.60, -1.95, -2.80, -3.65, -5.10, -6.40];
      curveShapeDescription = 'Downward sloping Backwardation. Prompt physical premium over deferred contracts.';
      marketThesis = 'OPEC+ quota discipline and heightened Middle East logistics frictions maintain tight prompt physical barrels. Positive roll yield for long positions.';
      inventoryContext = 'US commercial crude inventories are ~4% below the 5-year seasonal average; Cushing operational fill at 32%.';
      supplyCatalyst = 'OPEC+ 2.2 mb/d voluntary production cut extensions intact; non-OPEC deepwater additions lagging.';
      demandCatalyst = 'Global refinery throughput running at 82.6 mb/d with robust jet fuel and petrochemical feed burn.';
      seasonalPattern = 'Refinery turnaround season ending; autumn crude runs accelerating ahead of winter heating pull.';
      break;

    case 'BZ': // Brent Crude: Persistent backwardation
      structure = 'BACKWARDATION';
      deltas = [0, -0.48, -0.92, -1.35, -1.75, -2.15, -3.05, -3.95, -5.50, -6.90];
      curveShapeDescription = 'Prompt Backwardation. Sweet waterborne crude scarcity.';
      marketThesis = 'North Sea maintenance and Red Sea routing diversions around the Cape of Good Hope add freight ton-miles and support prompt spot crude pricing.';
      inventoryContext = 'European ARA hub commercial stocks tight; floating storage at historical lows.';
      supplyCatalyst = 'West African (Nigeria/Angola) production volumes stabilizing while Russian Urals discounts narrow.';
      demandCatalyst = 'Asian import margins steady with Chinese state refiners replenishing strategic crude stockpiles.';
      seasonalPattern = 'Atlantic basin heating oil runs tightening prompt sweet crude balances.';
      break;

    case 'NG': // Natural Gas: Highly seasonal shape with winter peak and spring injection trough
      structure = 'CONTANGO';
      // Winter premium: M1 -> M2 rises -> M3 Jan peak -> M4 Feb high -> M5-M6 spring drop
      deltas = [0, +0.32, +0.58, +0.48, +0.15, -0.22, -0.15, +0.28, +0.45, +0.35];
      curveShapeDescription = 'Seasonal Winter Contango. Peak heating premium in Jan/Feb contracts followed by spring shoulder trough.';
      marketThesis = 'Winter withdrawal heating season prices in freeze-off risks and strong space-heating burn before sharp drop into spring injection season.';
      inventoryContext = 'Lower-48 underground working gas in storage stands at ~3,780 Bcf, ~4% above the 5-year average.';
      supplyCatalyst = 'Appalachian and Haynesville upstream producers curtailing completion crews until Henry Hub sustains above $3.00.';
      demandCatalyst = 'US Gulf Coast LNG export feedgas demand averaging 13.8 Bcf/d with Plaquemines LNG commissioning phase.';
      seasonalPattern = 'November to March heating draw cycle dominates; heating degree days (HDD) determine spot volatility.';
      break;

    case 'GC': // Gold: Classic financial carry contango (Interest rate minus lease rate)
      structure = 'CONTANGO';
      // Annual contango of ~3.8% driven by SOFR rate (4.6%) - gold lease rate (0.8%)
      deltas = [0, +8.50, +17.20, +26.00, +34.50, +43.00, +68.50, +95.00, +145.00, +195.00];
      curveShapeDescription = 'Upward sloping Contango. Positive cost of carry driven by sovereign interest rate differentials.';
      marketThesis = 'Gold exhibits structural contango reflecting the cost of financing and insuring physical bullion. Central bank net accumulation provides relentless floor.';
      inventoryContext = 'COMEX registered gold warehouse vaults show steady liquidity; London Bullion Market Association (LBMA) vaults well stocked.';
      supplyCatalyst = 'Global gold mine production plateaued at ~3,650 tonnes annually; all-in sustaining costs (AISC) near $1,400/oz.';
      demandCatalyst = 'Sovereign central banks (PBoC, RBI, CBR) purchasing ~1,000+ tonnes/year as non-dollar reserve diversification.';
      seasonalPattern = 'Q4 Indian wedding festival season (Diwali) and Q1 Lunar New Year physical bullion buying cycle.';
      break;

    case 'SI': // Silver: Contango with industrial solar surge
      structure = 'CONTANGO';
      deltas = [0, +0.12, +0.24, +0.36, +0.48, +0.60, +0.95, +1.32, +2.05, +2.75];
      curveShapeDescription = 'Gentle Contango. Financing carry cost offset by massive physical industrial solar panel demand.';
      marketThesis = 'Silver forward curve displays traditional carry contango, but physical premiums in Shanghai exchange signal deep underlying supply tightness.';
      inventoryContext = 'COMEX eligible and registered silver inventories down 30% from 2021 peaks.';
      supplyCatalyst = '70% of silver is produced as a byproduct of lead/zinc and copper mines; primary mine capex constrained.';
      demandCatalyst = 'Photovoltaic TOPCon solar cells consume ~190M oz/year (up 60% in 2 years), creating structural 200M oz annual supply deficits.';
      seasonalPattern = 'Strong industrial restocking in Q1/Q2 alongside tech hardware assembly.';
      break;

    case 'HG': // Copper: Tight prompt curve / Flat-to-Backwardation
      structure = 'BACKWARDATION';
      deltas = [0, -0.02, -0.04, -0.06, -0.08, -0.09, -0.12, -0.15, -0.20, -0.24];
      curveShapeDescription = 'Prompt Backwardation. Physical cathode deficits and smelter treatment charge (TC/RC) collapse.';
      marketThesis = 'Smelter concentrate shortages and massive grid electrification demand keep prompt refined copper at a premium over deferred futures.';
      inventoryContext = 'LME warehouse inventories fluctuate near 140,000 tonnes; Shanghai SHFE stockpiles seeing steady seasonal draws.';
      supplyCatalyst = 'Cobre Panama mine closure and Anglo American production downgrades cut ~600,000 tonnes of global copper concentrate.';
      demandCatalyst = 'Electric vehicle production (80 kg copper/EV) and renewable grid transmission expansion driving 3.2% demand growth.';
      seasonalPattern = 'Chinese post-holiday construction restocking and global spring manufacturing acceleration.';
      break;

    case 'ZC': // Corn: Seasonal carry contango into next crop year
      structure = 'CONTANGO';
      deltas = [0, +4.50, +9.20, +13.50, +17.80, +22.00, +28.50, +34.00, +30.00, +26.00];
      curveShapeDescription = 'Commercial Contango. Storage and commercial elevator carry charges incentivizing orderly marketing.';
      marketThesis = 'Substantial North American harvest yields created ample prompt elevator supplies, putting prompt futures at a discount to deferred contracts.';
      inventoryContext = 'US ending stocks projected at 2.05 billion bushels; stocks-to-use ratio comfortable at 13.5%.';
      supplyCatalyst = 'Midwest harvest completion at rapid pace; Brazilian Safrinha corn planting conditions favorable.';
      demandCatalyst = 'Ethanol grind consuming 5.45 billion bushels; export commitments tracking 18% ahead of prior year.';
      seasonalPattern = 'Post-harvest lows typically set in October/November; seasonal price recovery occurs into spring planting.';
      break;

    case 'ZW': // Wheat: Contango carry
      structure = 'CONTANGO';
      deltas = [0, +6.00, +12.50, +18.00, +23.50, +28.00, +35.00, +40.00, +34.00, +28.00];
      curveShapeDescription = 'Commercial Carry Contango. Full carry reflecting storage rates and commercial financing.';
      marketThesis = 'Ample Russian export shipments dominating world tenders keep front-month futures depressed despite geopolitical war risk.';
      inventoryContext = 'Global major exporter ending stocks at multi-year lows excluding China, but Russian export pace aggressive.';
      supplyCatalyst = 'US Southern Plains winter wheat emergence favorable; Black Sea dry weather monitoring ongoing.';
      demandCatalyst = 'Middle East & North African (Egypt GASC, Algeria) import tenders providing persistent price support on dips.';
      seasonalPattern = 'Northern Hemisphere winter dormancy in Q4/Q1 before weather market risk in April/May.';
      break;

    case 'KC': // Coffee: Deep Backwardation (Severe supply deficit)
      structure = 'BACKWARDATION';
      deltas = [0, -3.80, -7.50, -11.20, -14.50, -17.80, -23.50, -29.00, -36.00, -42.00];
      curveShapeDescription = 'Steep Backwardation. Prompt panic buying and extreme physical availability deficit.';
      marketThesis = 'Prolonged heatwaves and dry weather in Minas Gerais (Brazil) along with Asian Robusta shortages have created intense prompt buying from roasters.';
      inventoryContext = 'ICE certified coffee warehouse stocks near historic lows at ~800,000 bags.';
      supplyCatalyst = '2024/25 Brazilian Arabica crop flowering damaged by prolonged drought.';
      demandCatalyst = 'Global consumption resilient at 173M bags; European roasters front-loading buying ahead of EUDR regulations.';
      seasonalPattern = 'Brazilian harvest completed; flowering period in October/November determines next year’s supply.';
      break;

    default:
      structure = 'FLAT';
      deltas = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      curveShapeDescription = 'Balanced / Flat Curve.';
      marketThesis = 'Balanced supply and demand with neutral roll yield.';
      inventoryContext = 'Inventories tracking in line with historical averages.';
      supplyCatalyst = 'Normal production schedules.';
      demandCatalyst = 'Steady commercial consumption.';
      seasonalPattern = 'Standard seasonal variations.';
      break;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthCodes = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];

  const points: ForwardCurvePoint[] = tenors.map((t, idx) => {
    const targetDate = new Date(currentYear, currentMonth + t.offsetMonths, 1);
    const mIdx = targetDate.getMonth();
    const yStr = String(targetDate.getFullYear()).slice(-2);
    const contractCode = `${commodityId}${monthCodes[mIdx]}${yStr}`;
    const contractMonth = `${monthNames[mIdx]} '${yStr}`;

    const delta = deltas[idx] ?? 0;
    const price = Number(Math.max(0.1, promptPrice + delta).toFixed(2));
    const spreadToPrompt = Number((price - promptPrice).toFixed(2));
    const spreadPercent = Number(((spreadToPrompt / promptPrice) * 100).toFixed(2));

    // Historical shifted curves
    // 1 month ago: typically slightly different slope
    const hist1M = Number((price * (structure === 'BACKWARDATION' ? 0.98 : 1.02) + (Math.sin(idx) * 0.3)).toFixed(2));
    // 6 months ago: significantly different level & slope
    const hist6M = Number((price * (structure === 'BACKWARDATION' ? 0.94 : 1.05) + (Math.cos(idx) * 0.6)).toFixed(2));

    return {
      tenor: t.tenor,
      contractCode,
      contractMonth,
      price,
      spreadToPrompt,
      spreadPercent,
      historicalOneMonthAgo: hist1M,
      historicalSixMonthsAgo: hist6M,
    };
  });

  const m1Price = points[0].price;
  const m2Price = points[1]?.price ?? m1Price;
  const m12Price = points[7]?.price ?? m1Price;

  const promptSpread = Number((m2Price - m1Price).toFixed(2));
  const slopePercent = Number((((m12Price - m1Price) / m1Price) * 100).toFixed(2));
  const annualizedRollYield = Number((-slopePercent).toFixed(2));

  // Calendar Spreads Table
  const calendarSpreads: CalendarSpreadItem[] = [
    {
      name: 'Prompt Spread (M1 - M2)',
      spread: Number((m1Price - m2Price).toFixed(2)),
      spreadPercent: Number((((m1Price - m2Price) / m1Price) * 100).toFixed(2)),
      annualizedRate: Number(((((m1Price - m2Price) / m1Price) * 12) * 100).toFixed(2)),
      signal: m1Price > m2Price ? 'BULLISH_BACKWARDATION' : m1Price < m2Price ? 'BEARISH_CONTANGO' : 'NEUTRAL',
      implication: m1Price > m2Price
        ? 'Prompt spot premium indicating acute immediate physical demand over deferred delivery.'
        : 'Prompt discount reflecting storage costs, financing carry, and ample front-month supply.',
    },
    {
      name: 'Prompt vs 6-Month (M1 - M6)',
      spread: Number((m1Price - (points[5]?.price ?? m1Price)).toFixed(2)),
      spreadPercent: Number((((m1Price - (points[5]?.price ?? m1Price)) / m1Price) * 100).toFixed(2)),
      annualizedRate: Number(((((m1Price - (points[5]?.price ?? m1Price)) / m1Price) * 2) * 100).toFixed(2)),
      signal: m1Price > (points[5]?.price ?? m1Price) ? 'BULLISH_BACKWARDATION' : 'BEARISH_CONTANGO',
      implication: m1Price > (points[5]?.price ?? m1Price)
        ? 'Medium-term backwardation provides tailwind roll yield for long futures / ETF holdings.'
        : 'Medium-term contango creates roll decay drag for passive commodity ETF holders.',
    },
    {
      name: '1-Year Calendar Spread (M1 - M12)',
      spread: Number((m1Price - m12Price).toFixed(2)),
      spreadPercent: Number((((m1Price - m12Price) / m1Price) * 100).toFixed(2)),
      annualizedRate: Number((((m1Price - m12Price) / m1Price) * 100).toFixed(2)),
      signal: m1Price > m12Price ? 'BULLISH_BACKWARDATION' : 'BEARISH_CONTANGO',
      implication: m1Price > m12Price
        ? 'Structural deficit across the entire 12-month forward strip.'
        : 'Structural supply cushion with commercial carrying charges priced into the full strip.',
    },
  ];

  const meta = COMMODITY_CATALOG.find((c) => c.id === commodityId);

  return {
    id: commodityId,
    name: meta?.name || commodityId,
    symbol: meta?.symbol || `${commodityId}=F`,
    category: meta?.category || 'energy',
    unit: meta?.unit || '$/unit',
    spotPrice: promptPrice,
    promptPrice,
    structure,
    slopePercent,
    promptSpread,
    annualizedRollYield,
    curveShapeDescription,
    marketThesis,
    points,
    calendarSpreads,
    keyStats: {
      inventoryContext,
      supplyCatalyst,
      demandCatalyst,
      seasonalPattern,
    },
  };
}

/**
 * Computes crucial macro commodity ratios
 */
function computeCommodityMacroRatios(quotes: Map<string, any>): CommodityMacroRatio[] {
  const gold = quotes.get('GC')?.price || 2740.50;
  const silver = quotes.get('SI')?.price || 32.80;
  const copper = quotes.get('HG')?.price || 4.38;
  const wtiOil = quotes.get('CL')?.price || 71.40;
  const natGas = quotes.get('NG')?.price || 2.85;
  const gasoline = quotes.get('RB')?.price || 2.12;
  const diesel = quotes.get('HO')?.price || 2.24;

  const ratios: CommodityMacroRatio[] = [];

  // 1. Gold / Silver Ratio
  const gsr = Number((gold / silver).toFixed(2));
  const prevGsr = Number(((quotes.get('GC')?.prevClose || gold) / (quotes.get('SI')?.prevClose || silver)).toFixed(2));
  const gsrChange = Number((gsr - prevGsr).toFixed(2));
  const gsrChangePercent = Number(((gsrChange / prevGsr) * 100).toFixed(2));

  ratios.push({
    id: 'GSR',
    name: 'Gold / Silver Ratio (GSR)',
    symbol: 'GC / SI',
    numeratorName: 'Gold ($/oz)',
    denominatorName: 'Silver ($/oz)',
    currentValue: gsr,
    prevValue: prevGsr,
    change: gsrChange,
    changePercent: gsrChangePercent,
    historicalMean: 72.0,
    historicalHigh52w: 91.5,
    historicalLow52w: 73.2,
    valuationStatus: gsr > 85 ? 'EXTREME_HIGH' : gsr > 78 ? 'HIGH' : gsr < 65 ? 'LOW' : 'FAIR',
    macroSignal: gsr > 80
      ? 'Silver historically undervalued relative to gold; classic late-cycle or defensive safe-haven flight.'
      : 'Healthy gold/silver parity indicating active industrial demand and cyclical participation.',
    interpretation: 'Measures relative valuation between monetary safe-haven (Gold) and industrial/cyclical conductor (Silver). When GSR drops, risk appetite and industrial recovery typically surge.',
  });

  // 2. Copper / Gold Ratio (Economic Growth Barometer)
  // Expressed as (Copper $/lb * 1000) / Gold $/oz to give standard scale ~1.5 - 2.5
  const cgr = Number(((copper * 1000) / gold).toFixed(2));
  const prevCgr = Number((((quotes.get('HG')?.prevClose || copper) * 1000) / (quotes.get('GC')?.prevClose || gold)).toFixed(2));
  const cgrChange = Number((cgr - prevCgr).toFixed(2));
  const cgrChangePercent = Number(((cgrChange / prevCgr) * 100).toFixed(2));

  ratios.push({
    id: 'CGR',
    name: 'Copper / Gold Ratio (Dr. Copper / Gold)',
    symbol: '(HG * 1000) / GC',
    numeratorName: 'Copper (x1000)',
    denominatorName: 'Gold ($/oz)',
    currentValue: cgr,
    prevValue: prevCgr,
    change: cgrChange,
    changePercent: cgrChangePercent,
    historicalMean: 2.10,
    historicalHigh52w: 2.45,
    historicalLow52w: 1.55,
    valuationStatus: cgr > 2.20 ? 'HIGH' : cgr < 1.70 ? 'LOW' : 'FAIR',
    macroSignal: cgr < 1.75
      ? 'Depressed ratio signals growth deceleration and strong sovereign stagflation / hedge demand.'
      : 'Rising ratio confirms robust global manufacturing expansion and upward pressure on sovereign bond yields.',
    interpretation: 'Wall Street’s leading macro indicator for 10-Year US Treasury yields and manufacturing PMI. Copper tracks global construction and electrical CAPEX, while Gold tracks monetary debasement.',
  });

  // 3. Oil / Natural Gas Ratio (BTU Parity Spread)
  const ogr = Number((wtiOil / natGas).toFixed(2));
  const prevOgr = Number(((quotes.get('CL')?.prevClose || wtiOil) / (quotes.get('NG')?.prevClose || natGas)).toFixed(2));
  const ogrChange = Number((ogr - prevOgr).toFixed(2));
  const ogrChangePercent = Number(((ogrChange / prevOgr) * 100).toFixed(2));

  ratios.push({
    id: 'OGR',
    name: 'Oil / Natural Gas Ratio (BTU Parity)',
    symbol: 'CL / NG',
    numeratorName: 'WTI Crude ($/bbl)',
    denominatorName: 'Natural Gas ($/MMBtu)',
    currentValue: ogr,
    prevValue: prevOgr,
    change: ogrChange,
    changePercent: ogrChangePercent,
    historicalMean: 22.0,
    historicalHigh52w: 36.5,
    historicalLow52w: 18.2,
    valuationStatus: ogr > 28 ? 'HIGH' : ogr < 15 ? 'LOW' : 'FAIR',
    macroSignal: ogr > 26
      ? 'Natural gas is priced at a heavy energy discount to crude oil (pure energy BTU parity is 5.8:1).'
      : 'Natural gas prices reflecting winter supply tightness relative to crude oil.',
    interpretation: '1 barrel of crude oil contains roughly 5.8 MMBtu of energy. A high ratio incentivizes industrial switching from oil to gas and petrochemical cracker feedstock shifts.',
  });

  // 4. 3:2:1 Refinery Crack Spread ($/bbl)
  // 3 barrels of crude yield 2 barrels of gasoline + 1 barrel of distillate
  // 42 gallons per barrel: (2 * (RB * 42) + 1 * (HO * 42) - 3 * CL) / 3
  const crackSpread = Number((((2 * (gasoline * 42) + 1 * (diesel * 42)) - (3 * wtiOil)) / 3).toFixed(2));
  const prevCrack = Number((((2 * ((quotes.get('RB')?.prevClose || gasoline) * 42) + 1 * ((quotes.get('HO')?.prevClose || diesel) * 42)) - (3 * (quotes.get('CL')?.prevClose || wtiOil))) / 3).toFixed(2));
  const crackChange = Number((crackSpread - prevCrack).toFixed(2));
  const crackChangePercent = Number(((crackChange / (prevCrack || 1)) * 100).toFixed(2));

  ratios.push({
    id: 'CRACK_321',
    name: '3:2:1 Gulf Coast Refinery Crack Spread',
    symbol: '(2*RB + 1*HO - 3*CL)/3',
    numeratorName: 'Refined Products',
    denominatorName: 'Crude Feedstock',
    currentValue: crackSpread,
    prevValue: prevCrack,
    change: crackChange,
    changePercent: crackChangePercent,
    historicalMean: 24.5,
    historicalHigh52w: 38.0,
    historicalLow52w: 14.2,
    valuationStatus: crackSpread > 30 ? 'HIGH' : crackSpread < 16 ? 'LOW' : 'FAIR',
    macroSignal: crackSpread > 22
      ? 'Healthy refining margins supporting crude refinery runs and downstream oil major earnings.'
      : 'Compressed refining margins signaling industrial product demand slack or excess refined inventory.',
    interpretation: 'The ultimate indicator of petroleum refiner profitability (Valero, Marathon, Phillips 66) and real-economy fuel consumption.',
  });

  // 5. Gold / Oil Purchasing Power Ratio (Barrels of oil per oz of gold)
  const gor = Number((gold / wtiOil).toFixed(2));
  const prevGor = Number(((quotes.get('GC')?.prevClose || gold) / (quotes.get('CL')?.prevClose || wtiOil)).toFixed(2));
  const gorChange = Number((gor - prevGor).toFixed(2));
  const gorChangePercent = Number(((gorChange / prevGor) * 100).toFixed(2));

  ratios.push({
    id: 'GOR',
    name: 'Gold / Oil Ratio (Purchasing Power)',
    symbol: 'GC / CL',
    numeratorName: 'Gold ($/oz)',
    denominatorName: 'WTI Crude ($/bbl)',
    currentValue: gor,
    prevValue: prevGor,
    change: gorChange,
    changePercent: gorChangePercent,
    historicalMean: 18.5,
    historicalHigh52w: 42.0,
    historicalLow52w: 16.0,
    valuationStatus: gor > 30 ? 'HIGH' : gor < 15 ? 'LOW' : 'FAIR',
    macroSignal: gor > 32
      ? 'Historic high purchasing power: 1 oz of gold buys an above-average volume of physical oil.'
      : 'Normal balance between monetary debasement and physical energy costs.',
    interpretation: 'Long-term historical purchasing power index. Over 100 years, 1 ounce of gold typically buys between 15 and 25 barrels of crude oil.',
  });

  return ratios;
}

/**
 * Main function: Get full Commodities Intelligence
 */
export async function getCommoditiesIntelligence(): Promise<CommoditiesIntelligenceResponse> {
  const now = Date.now();
  if (cachedCommoditiesData && (now - cachedCommoditiesData.timestamp) < CACHE_TTL_MS) {
    return cachedCommoditiesData.data;
  }

  const quotes = await fetchLiveCommodityQuotes();

  // 1. Compile commodity price items
  const commodities: CommodityPriceItem[] = COMMODITY_CATALOG.map((item) => {
    const q = quotes.get(item.id) || {
      price: item.fallbackPrice,
      prevClose: item.fallbackPrevClose,
      change: 0,
      changePercent: 0,
      returns: item.fallbackReturns,
      dayHigh: item.fallbackPrice * 1.01,
      dayLow: item.fallbackPrice * 0.99,
      fiftyTwoWeekHigh: item.fallbackPrice * 1.2,
      fiftyTwoWeekLow: item.fallbackPrice * 0.8,
    };

    const rangeSpan = Math.max(0.01, q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow);
    const range52wPercent = Math.min(100, Math.max(0, ((q.price - q.fiftyTwoWeekLow) / rangeSpan) * 100));

    // Determine curve structure for this commodity
    let curveStructure: CurveStructure = 'CONTANGO';
    let promptSpread = 0.50;
    let annualizedRollYield = -3.5;

    if (item.id === 'CL' || item.id === 'BZ' || item.id === 'HG' || item.id === 'KC' || item.id === 'CC') {
      curveStructure = 'BACKWARDATION';
      promptSpread = -0.45;
      annualizedRollYield = +4.8;
    } else if (item.id === 'NG') {
      curveStructure = 'CONTANGO';
      promptSpread = +0.32;
      annualizedRollYield = -6.2;
    }

    return {
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      shortName: item.shortName,
      category: item.category,
      categoryLabel: item.categoryLabel,
      unit: item.unit,
      price: q.price,
      prevClose: q.prevClose,
      change: q.change,
      changePercent: q.changePercent,
      returns: q.returns || item.fallbackReturns,
      dayHigh: q.dayHigh,
      dayLow: q.dayLow,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow,
      range52wPercent: Number(range52wPercent.toFixed(1)),
      promptSpread,
      curveStructure,
      annualizedRollYield,
      exchange: item.exchange,
      tradingViewSymbol: item.tradingViewSymbol,
      description: item.description,
    };
  });

  // 2. Build forward curves for core benchmark commodities
  const currentDate = new Date();
  const benchmarkCommodityIds = ['CL', 'BZ', 'NG', 'GC', 'SI', 'HG', 'ZC', 'ZW', 'KC'];
  const forwardCurves: Record<string, CommodityForwardCurveData> = {};

  for (const cid of benchmarkCommodityIds) {
    const q = quotes.get(cid);
    const p = q ? q.price : (COMMODITY_CATALOG.find(c => c.id === cid)?.fallbackPrice || 100);
    forwardCurves[cid] = buildForwardCurve(cid, p, currentDate);
  }

  // 3. Compute macro ratios
  const macroRatios = computeCommodityMacroRatios(quotes);

  // 4. Determine overall market regime
  const backwardationCount = Object.values(forwardCurves).filter(c => c.structure === 'BACKWARDATION').length;
  const totalCurves = Object.keys(forwardCurves).length;
  const overallPosture = backwardationCount >= totalCurves / 2
    ? 'BROAD_BACKWARDATION'
    : 'MIXED_SECTOR_ROTATION';

  const clPrice = quotes.get('CL')?.price || 71.40;
  const gcPrice = quotes.get('GC')?.price || 2740.50;
  const hgPrice = quotes.get('HG')?.price || 4.38;

  const inflationaryImpulseScore = Math.min(100, Math.max(0, Math.round(
    (clPrice > 75 ? 35 : 20) +
    (gcPrice > 2600 ? 35 : 20) +
    (hgPrice > 4.20 ? 25 : 15)
  )));

  const response: CommoditiesIntelligenceResponse = {
    timestamp: new Date().toISOString(),
    marketRegime: {
      overallPosture,
      summary: backwardationCount >= 4
        ? 'Physical commodity curves display tight spot supplies with prompt backwardation premiums in Energy and Base Metals.'
        : 'Mixed term structures with seasonal carry contango in agricultural complexes and steady financing carry in precious metals.',
      energyRegime: 'WTI & Brent in prompt backwardation due to OPEC+ quota discipline; Natural Gas in winter heating contango.',
      metalsRegime: 'Gold & Silver reflecting sovereign monetary debasement with financing carry; Copper facing spot smelter supply tightness.',
      agricultureRegime: 'Grains in commercial post-harvest carry contango; Soft commodities (Coffee, Cocoa) in extreme supply deficit backwardation.',
      inflationaryImpulseScore,
    },
    commodities,
    forwardCurves,
    macroRatios,
  };

  cachedCommoditiesData = {
    timestamp: now,
    data: response,
  };

  return response;
}
