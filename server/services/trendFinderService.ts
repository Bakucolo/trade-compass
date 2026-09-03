import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type TrendStage = 'STARTING' | 'ONGOING' | 'EXHAUSTED';
export type TrendDirection = 'BULLISH' | 'BEARISH';
export type TrendScope = 'ASSET_CLASS' | 'SECTOR' | 'INDUSTRY_THEME';

export interface TrendItem {
  symbol: string;
  name: string;
  shortName: string;
  scope: TrendScope;
  subCategory: string; // e.g. 'Equities', 'Commodities', 'Fixed Income', 'Currencies', 'Tech', 'Clean Energy'
  description: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number; // 1D

  // Multi-Timeframe Performance (%)
  returns: {
    '1D': number;
    '1W': number;
    '1M': number;
    '3M': number;
    'YTD': number;
  };

  // Trend Lifecycle & Technicals
  stage: TrendStage;
  direction: TrendDirection;
  trendStrengthScore: number; // 0 to 100
  exhaustionRiskScore: number; // 0 to 100
  
  // Moving Averages & Momentum
  dma20: number;
  dma50: number;
  dma200: number;
  dist20DmaPct: number; // % above/below 20 EMA
  dist50DmaPct: number; // % above/below 50 SMA
  dist200DmaPct: number; // % above/below 200 SMA
  rsi14: number;
  isGoldenCross: boolean; // 50 > 200 or 20 > 50 fresh cross
  isDeathCross: boolean;

  // Visual Tags & Badges
  signals: string[];
  macroDriver: string;
  actionablePlaybook: string;

  // Trend Timing & Durations
  trendStartDate?: string;       // e.g. "2026-08-28" (date when trend began)
  daysInTrend?: number;          // e.g. 6, 42 (how many days in trend)
  exhaustionStartDate?: string;  // e.g. "2026-08-25" (when exhaustion began)
  daysExhausted?: number;        // e.g. 9 (how many days since exhaustion began)
}

export interface TrendFinderSummary {
  startingCount: number;
  ongoingCount: number;
  exhaustedCount: number;
  bullishCount: number;
  bearishCount: number;
  topOpportunities: {
    startingBreakouts: TrendItem[];
    strongestTrends: TrendItem[];
    exhaustionReversals: TrendItem[];
  };
  items: TrendItem[];
  fetchedAt: string;
}

// Universe definition of 45+ core macro assets, 11 sectors, and key thematic industries
const TREND_UNIVERSE = [
  // 1. ASSET CLASSES - EQUITIES & REGIONS
  { symbol: 'SPY', name: 'S&P 500 Large Cap', shortName: 'S&P 500', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'US Equities', description: 'US Large-Cap Equity benchmark index tracking top 500 corporations.' },
  { symbol: 'QQQ', name: 'Nasdaq 100 Tech', shortName: 'Nasdaq 100', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'US Equities', description: 'Top 100 non-financial tech-heavy growth leaders on Nasdaq.' },
  { symbol: 'IWM', name: 'Russell 2000 Small Cap', shortName: 'Small Caps', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'US Equities', description: 'US Small-Cap Equities sensitive to domestic growth and regional rate cycles.' },
  { symbol: 'EEM', name: 'iShares Emerging Markets', shortName: 'Emerging Mkts', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Global Equities', description: 'Emerging market equities across China, Taiwan, India, Brazil, and Korea.' },
  { symbol: 'VGK', name: 'Vanguard FTSE Europe', shortName: 'European Mkts', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Global Equities', description: 'Broad European equities spanning UK, Germany, France, and Switzerland.' },
  { symbol: 'EWJ', name: 'iShares MSCI Japan', shortName: 'Japan Equities', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Global Equities', description: 'Japanese corporate equity index driven by corporate governance reforms and yen.' },

  // 2. ASSET CLASSES - FIXED INCOME & RATES
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond', shortName: '20Y+ Treasuries', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Fixed Income', description: 'Long-duration sovereign US Treasuries, highly sensitive to interest rate policy.' },
  { symbol: 'IEF', name: 'iShares 7-10 Year Treasury Bond', shortName: '7-10Y Treasuries', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Fixed Income', description: 'Intermediate benchmark US 10-year Treasury note duration.' },
  { symbol: 'SHY', name: 'iShares 1-3 Year Treasury Bond', shortName: '1-3Y Short Rates', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Fixed Income', description: 'Short-duration Treasury bills reflecting immediate Federal Reserve policy rate.' },
  { symbol: 'HYG', name: 'iShares High Yield Corporate Bond', shortName: 'High Yield Credit', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Credit & Spreads', description: 'US high yield junk bonds reflecting default risk and corporate liquidity spreads.' },
  { symbol: 'LQD', name: 'iShares Investment Grade Corporate', shortName: 'IG Corporate Bonds', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Credit & Spreads', description: 'High-grade corporate debt from blue-chip corporations.' },

  // 3. ASSET CLASSES - COMMODITIES & METALS
  { symbol: 'GLD', name: 'SPDR Gold Shares', shortName: 'Gold Bullion', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Precious Metals', description: 'Physical gold bullion, primary monetary hedge against fiat debasement.' },
  { symbol: 'SLV', name: 'iShares Silver Trust', shortName: 'Silver', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Precious Metals', description: 'Silver bullion with dual monetary store and solar/electronics industrial demand.' },
  { symbol: 'CPER', name: 'United States Copper Index', shortName: 'Doctor Copper', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Industrial Metals', description: 'Copper futures barometer reflecting global grid electrification and manufacturing.' },
  { symbol: 'USO', name: 'United States Oil Fund', shortName: 'WTI Crude Oil', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Energy Commodities', description: 'Light sweet crude oil futures reflecting OPEC supply and global transportation demand.' },
  { symbol: 'UNG', name: 'United States Natural Gas', shortName: 'Natural Gas', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Energy Commodities', description: 'Henry Hub natural gas futures driven by heating, cooling, and LNG power demand.' },
  { symbol: 'URA', name: 'Global X Uranium ETF', shortName: 'Uranium & Nuclear', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Energy Commodities', description: 'Uranium mining and nuclear fuel cycle for baseload AI power.' },
  { symbol: 'DBA', name: 'Invesco DB Agriculture Fund', shortName: 'Agriculture Commodities', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Agriculture', description: 'Agricultural futures basket covering wheat, corn, soybeans, sugar, and coffee.' },

  // 4. ASSET CLASSES - CURRENCIES & CRYPTO
  { symbol: 'UUP', name: 'Invesco DB US Dollar Index Bullish', shortName: 'US Dollar (DXY)', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Currencies', description: 'US Dollar relative to trade-weighted basket of foreign currencies (EUR, JPY, GBP).' },
  { symbol: 'FXE', name: 'Invesco CurrencyShares Euro Trust', shortName: 'Euro Currency', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Currencies', description: 'Euro currency valuation relative to the US dollar.' },
  { symbol: 'FXY', name: 'Invesco CurrencyShares Japanese Yen', shortName: 'Japanese Yen', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Currencies', description: 'Japanese Yen currency tracker, central to global carry trade unwinds.' },
  { symbol: 'BTC-USD', name: 'Bitcoin (Crypto Digital Gold)', shortName: 'Bitcoin', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Digital Assets', description: 'Decentralized digital monetary asset and global liquidity barometer.' },
  { symbol: 'ETH-USD', name: 'Ethereum Network', shortName: 'Ethereum', scope: 'ASSET_CLASS' as TrendScope, subCategory: 'Digital Assets', description: 'Smart-contract computational platform and DeFi liquidity backbone.' },

  // 5. 11 SPDR S&P 500 SECTORS
  { symbol: 'XLK', name: 'Technology Select Sector SPDR', shortName: 'Information Tech', scope: 'SECTOR' as TrendScope, subCategory: 'Technology', description: 'Hardware, software, semiconductor, and IT services giants.' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR', shortName: 'Financials', scope: 'SECTOR' as TrendScope, subCategory: 'Financials', description: 'Money center banks, insurance underwriters, brokerages, and payment networks.' },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR', shortName: 'Health Care', scope: 'SECTOR' as TrendScope, subCategory: 'Healthcare', description: 'Pharmaceuticals, medical device makers, biotechnology, and managed care.' },
  { symbol: 'XLY', name: 'Consumer Discretionary SPDR', shortName: 'Consumer Disc.', scope: 'SECTOR' as TrendScope, subCategory: 'Cyclicals', description: 'E-commerce, automotive, retail, leisure, and home improvement.' },
  { symbol: 'XLI', name: 'Industrial Select Sector SPDR', shortName: 'Industrials', scope: 'SECTOR' as TrendScope, subCategory: 'Cyclicals', description: 'Aerospace, defense, machinery, railroads, and industrial logistics.' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR', shortName: 'Energy', scope: 'SECTOR' as TrendScope, subCategory: 'Commodities', description: 'Integrated oil majors, exploration & production, and refining corporations.' },
  { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR', shortName: 'Consumer Staples', scope: 'SECTOR' as TrendScope, subCategory: 'Defensives', description: 'Food & beverage, household goods, discount retail, and personal products.' },
  { symbol: 'XLU', name: 'Utilities Select Sector SPDR', shortName: 'Utilities & Power', scope: 'SECTOR' as TrendScope, subCategory: 'Defensives', description: 'Regulated electric utilities, renewable power producers, and AI data center energy.' },
  { symbol: 'XLB', name: 'Materials Select Sector SPDR', shortName: 'Basic Materials', scope: 'SECTOR' as TrendScope, subCategory: 'Cyclicals', description: 'Chemicals, industrial metals, packaging, and construction materials.' },
  { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR', shortName: 'Real Estate / REITs', scope: 'SECTOR' as TrendScope, subCategory: 'Rate-Sensitives', description: 'Commercial real estate, data center REITs, cell towers, and residential trusts.' },
  { symbol: 'XLC', name: 'Communication Services SPDR', shortName: 'Communication', scope: 'SECTOR' as TrendScope, subCategory: 'Growth & Media', description: 'Interactive media, digital advertising, entertainment, and telecom carriers.' },

  // 6. HIGH-CONVICTION INDUSTRIES & THEMATICS
  { symbol: 'SMH', name: 'VanEck Semiconductor ETF', shortName: 'Semiconductors', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Tech & Hardware', description: 'AI GPU accelerators, wafer foundries, and lithography chip equipment makers.' },
  { symbol: 'IGV', name: 'iShares Expanded Tech-Software', shortName: 'Cloud & Software', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Tech & Cloud', description: 'Enterprise SaaS, database infrastructure, and cloud application vendors.' },
  { symbol: 'XBI', name: 'SPDR S&P Biotech ETF', shortName: 'Biotechnology', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Healthcare', description: 'High-beta clinical-stage drug developers and genomic therapeutics.' },
  { symbol: 'ITA', name: 'iShares US Aerospace & Defense', shortName: 'Defense & Aerospace', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Industrials', description: 'Defense contractors, missile systems, fighter aircraft, and naval shipbuilders.' },
  { symbol: 'ITB', name: 'iShares US Home Construction', shortName: 'Homebuilders', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Housing', description: 'Residential home builders and building materials suppliers.' },
  { symbol: 'KRE', name: 'SPDR S&P Regional Banking ETF', shortName: 'Regional Banks', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Financials', description: 'Mid-sized community and regional deposit institutions.' },
  { symbol: 'OIH', name: 'VanEck Oil Services ETF', shortName: 'Oil Equipment & Drilling', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Energy', description: 'Offshore drillers, well-head completion, and seismic service providers.' },
  { symbol: 'BOTZ', name: 'Global X Robotics & AI ETF', shortName: 'Robotics & Automation', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'AI & Automation', description: 'Industrial automation robots, medical robotic surgery, and autonomous systems.' },
  { symbol: 'CIBR', name: 'First Trust NASDAQ Cybersecurity', shortName: 'Cybersecurity', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Cyber Defense', description: 'Zero-trust network architecture, endpoint protection, and identity security.' },
  { symbol: 'TAN', name: 'Invesco Solar ETF', shortName: 'Solar & Clean Tech', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Clean Energy', description: 'Photovoltaic inverters, solar panels, and commercial installations.' },
  { symbol: 'IYT', name: 'iShares US Transportation ETF', shortName: 'Transport & Freight', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Macro Logistics', description: 'Freight trucking, Class-1 railroads, airlines, and courier logistics.' },
  { symbol: 'COPX', name: 'Global X Copper Miners ETF', shortName: 'Copper Miners', scope: 'INDUSTRY_THEME' as TrendScope, subCategory: 'Mining', description: 'Pure-play copper extraction and smelting mining companies.' },
];

// In-memory cache with 60 seconds TTL
let trendCache: { timestamp: number; data: TrendFinderSummary } | null = null;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Calculate standard 14-period RSI from price series
 */
function calculateRSI(prices: number[], period: number = 14): number {
  if (!prices || prices.length <= period) return 50.0;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100.0 - 100.0 / (1.0 + rs);
  return Number(rsi.toFixed(1));
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number {
  if (!prices || prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / period).toFixed(2));
}

/**
 * Calculate Exponential Moving Average
 */
function calculateEMA(prices: number[], period: number): number {
  if (!prices || prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = calculateSMA(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return Number(ema.toFixed(2));
}

export class TrendFinderService {
  /**
   * Scan entire macro universe, compute multi-timeframe indicators,
   * and classify trends into STARTING, ONGOING, and EXHAUSTED lifecycle stages.
   */
  async getTrendFinderOverview(): Promise<TrendFinderSummary> {
    if (trendCache && Date.now() - trendCache.timestamp < CACHE_TTL_MS) {
      return trendCache.data;
    }

    const items: TrendItem[] = [];

    // Process universe instruments in batches
    const BATCH_SIZE = 8;
    for (let i = 0; i < TREND_UNIVERSE.length; i += BATCH_SIZE) {
      const batch = TREND_UNIVERSE.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (def) => {
          return this.analyzeSingleInstrument(def);
        })
      );

      for (const res of batchResults) {
        if (res.status === 'fulfilled' && res.value) {
          items.push(res.value);
        }
      }
    }

    // Sort items by absolute trend strength and conviction
    items.sort((a, b) => {
      // Prioritize Exhausted or Starting breakouts, then Ongoing trends
      if (a.stage === 'EXHAUSTED' && b.stage !== 'EXHAUSTED') return -1;
      if (b.stage === 'EXHAUSTED' && a.stage !== 'EXHAUSTED') return 1;
      return b.trendStrengthScore - a.trendStrengthScore;
    });

    const startingItems = items.filter((x) => x.stage === 'STARTING');
    const ongoingItems = items.filter((x) => x.stage === 'ONGOING');
    const exhaustedItems = items.filter((x) => x.stage === 'EXHAUSTED');

    const bullishCount = items.filter((x) => x.direction === 'BULLISH').length;
    const bearishCount = items.filter((x) => x.direction === 'BEARISH').length;

    const summary: TrendFinderSummary = {
      startingCount: startingItems.length,
      ongoingCount: ongoingItems.length,
      exhaustedCount: exhaustedItems.length,
      bullishCount,
      bearishCount,
      topOpportunities: {
        startingBreakouts: startingItems.slice(0, 6),
        strongestTrends: ongoingItems.slice(0, 6),
        exhaustionReversals: exhaustedItems.slice(0, 6),
      },
      items,
      fetchedAt: new Date().toISOString(),
    };

    trendCache = { timestamp: Date.now(), data: summary };
    return summary;
  }

  /**
   * Detailed analysis for a single instrument
   */
  private async analyzeSingleInstrument(def: typeof TREND_UNIVERSE[0]): Promise<TrendItem | null> {
    try {
      const isCrypto = def.symbol.includes('-USD');
      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);

      // Fetch 1-year historical bars
      let chartData: any = null;
      try {
        chartData = await yahooFinance.chart(def.symbol, {
          period1: oneYearAgo,
          period2: now,
          interval: '1d',
        });
      } catch (e: any) {
        // Fallback for missing historical chart
      }

      const quotes = chartData?.quotes || [];
      const closePrices = quotes
        .map((q: any) => q.close || q.adjclose)
        .filter((p: any) => typeof p === 'number' && !isNaN(p) && p > 0);

      // Fallback quote if history is unavailable
      let curPrice = closePrices.length > 0 ? closePrices[closePrices.length - 1] : 100;
      let prevClose = closePrices.length > 1 ? closePrices[closePrices.length - 2] : curPrice;

      try {
        const quote = await yahooFinance.quote(def.symbol);
        if (quote) {
          curPrice = quote.regularMarketPrice || curPrice;
          prevClose = quote.regularMarketPreviousClose || prevClose;
        }
      } catch {
        // Ignore live quote error
      }

      const change = Number((curPrice - prevClose).toFixed(2));
      const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

      // Multi-timeframe returns
      const p1W = closePrices.length >= 6 ? closePrices[closePrices.length - 6] : prevClose;
      const p1M = closePrices.length >= 22 ? closePrices[closePrices.length - 22] : p1W;
      const p3M = closePrices.length >= 65 ? closePrices[closePrices.length - 65] : p1M;
      const pYtd = closePrices.length >= 1 ? closePrices[0] : p3M;

      const r1W = p1W > 0 ? Number((((curPrice - p1W) / p1W) * 100).toFixed(2)) : changePercent;
      const r1M = p1M > 0 ? Number((((curPrice - p1M) / p1M) * 100).toFixed(2)) : r1W;
      const r3M = p3M > 0 ? Number((((curPrice - p3M) / p3M) * 100).toFixed(2)) : r1M;
      const rYtd = pYtd > 0 ? Number((((curPrice - pYtd) / pYtd) * 100).toFixed(2)) : r3M;

      // Technical Indicators
      const rsi14 = closePrices.length >= 15 ? calculateRSI(closePrices, 14) : 50.0;
      const dma20 = closePrices.length >= 20 ? calculateEMA(closePrices, 20) : curPrice;
      const dma50 = closePrices.length >= 50 ? calculateSMA(closePrices, 50) : curPrice;
      const dma200 = closePrices.length >= 200 ? calculateSMA(closePrices, 200) : dma50;

      const dist20DmaPct = dma20 > 0 ? Number((((curPrice - dma20) / dma20) * 100).toFixed(2)) : 0;
      const dist50DmaPct = dma50 > 0 ? Number((((curPrice - dma50) / dma50) * 100).toFixed(2)) : 0;
      const dist200DmaPct = dma200 > 0 ? Number((((curPrice - dma200) / dma200) * 100).toFixed(2)) : 0;

      const isGoldenCross = dma50 > dma200 && (closePrices.length < 60 || closePrices[closePrices.length - 20] < dma200);
      const isDeathCross = dma50 < dma200 && (closePrices.length < 60 || closePrices[closePrices.length - 20] > dma200);

      // Trend Direction Determination
      const isBullish = curPrice >= dma50 && (r1M >= -1.0 || r3M >= 0);
      const direction: TrendDirection = isBullish ? 'BULLISH' : 'BEARISH';

      // Lifecycle Stage Classification Engine
      let stage: TrendStage = 'ONGOING';
      const signals: string[] = [];
      let exhaustionRiskScore = 20;
      let trendStrengthScore = 50;

      if (direction === 'BULLISH') {
        // --- 1. BULLISH EXHAUSTED ---
        // Overbought climax: RSI > 74, or extended > 15% above 200 DMA, or 1M return > 25%
        if (rsi14 >= 74 || dist200DmaPct >= 18 || (dist20DmaPct >= 7.5 && r1M > 18)) {
          stage = 'EXHAUSTED';
          exhaustionRiskScore = Math.min(98, Math.round(50 + (rsi14 - 70) * 2 + Math.max(0, dist200DmaPct - 15) * 2));
          trendStrengthScore = 80;

          if (rsi14 >= 75) signals.push(`Severe RSI Overbought (${rsi14})`);
          if (dist200DmaPct >= 15) signals.push(`Overextended +${dist200DmaPct}% > 200 DMA`);
          if (dist20DmaPct >= 6) signals.push(`Rubber-Band Stretch +${dist20DmaPct}% > 20 EMA`);
          signals.push('Reversal / Pullback Vulnerable');
        }
        // --- 2. BULLISH STARTING ---
        // Emerging: price just crossed above 50 SMA (dist50 within 0-4%), or fresh 20/50 cross, or RSI broke out 50-60
        else if (
          (dist50DmaPct >= 0 && dist50DmaPct <= 4.5 && r1M >= 2.0) ||
          (rsi14 >= 50 && rsi14 <= 62 && r1W > 0 && r3M < 10) ||
          isGoldenCross
        ) {
          stage = 'STARTING';
          trendStrengthScore = Math.round(55 + r1M * 1.5 + (rsi14 - 50));
          exhaustionRiskScore = 15;

          if (isGoldenCross) signals.push('Fresh Golden Cross');
          if (dist50DmaPct >= 0 && dist50DmaPct <= 4.5) signals.push('50-DMA Breakout Inflection');
          signals.push('Early Stage Momentum');
          signals.push(`RSI Accelerating (${rsi14})`);
        }
        // --- 3. BULLISH ONGOING ---
        // Established uptrend: Price > 20 EMA > 50 SMA > 200 SMA, healthy RSI (55-72)
        else {
          stage = 'ONGOING';
          trendStrengthScore = Math.min(95, Math.round(60 + r3M * 0.8 + (curPrice > dma20 ? 10 : 0)));
          exhaustionRiskScore = Math.round(25 + Math.max(0, rsi14 - 60) * 1.5);

          signals.push('Healthy Moving Average Alignment');
          if (curPrice > dma20) signals.push('Riding 20 EMA Support');
          signals.push(`Sustained Trend (3M: +${r3M}%)`);
        }
      } else {
        // --- 1. BEARISH EXHAUSTED (Oversold Capitulation / Bottoming) ---
        if (rsi14 <= 28 || dist200DmaPct <= -20 || (dist20DmaPct <= -8 && r1M < -15)) {
          stage = 'EXHAUSTED';
          exhaustionRiskScore = Math.min(95, Math.round(50 + (30 - rsi14) * 2.5 + Math.max(0, -dist200DmaPct - 15) * 1.5));
          trendStrengthScore = 30;

          if (rsi14 <= 30) signals.push(`Severe RSI Oversold (${rsi14})`);
          if (dist200DmaPct <= -18) signals.push(`Deep Value -${Math.abs(dist200DmaPct)}% < 200 DMA`);
          signals.push('Capitulation Bottom Imminent');
        }
        // --- 2. BEARISH STARTING (Breakdown / Death Cross) ---
        else if (
          (dist50DmaPct <= 0 && dist50DmaPct >= -4.5 && r1M <= -2.0) ||
          (rsi14 <= 48 && rsi14 >= 38 && r1W < 0) ||
          isDeathCross
        ) {
          stage = 'STARTING';
          trendStrengthScore = Math.round(60 + Math.abs(r1M) * 1.5);
          exhaustionRiskScore = 15;

          if (isDeathCross) signals.push('Death Cross Breakdown');
          signals.push('50-DMA Breakdown Support Lost');
          signals.push(`RSI Breaking Lower (${rsi14})`);
        }
        // --- 3. BEARISH ONGOING ---
        else {
          stage = 'ONGOING';
          trendStrengthScore = Math.min(90, Math.round(60 + Math.abs(r3M) * 0.8));
          exhaustionRiskScore = Math.round(25 + Math.max(0, 45 - rsi14) * 1.2);

          signals.push('Downward Moving Average Pressure');
          signals.push(`Sustained Downtrend (3M: ${r3M}%)`);
        }
      }

      // Calculate Trend Lifecycle Timestamps & Durations
      let trendStartDate: string = new Date().toISOString().slice(0, 10);
      let daysInTrend = 1;
      let exhaustionStartDate: string | undefined = undefined;
      let daysExhausted: number | undefined = undefined;

      const oneDayMs = 1000 * 60 * 60 * 24;

      if (quotes.length >= 20) {
        // Calculate historical crossover point to find when current trend began
        let crossIndex = -1;
        for (let i = quotes.length - 1; i >= 1; i--) {
          const p = quotes[i].close || quotes[i].adjclose;
          const prevP = quotes[i - 1].close || quotes[i - 1].adjclose;
          if (direction === 'BULLISH') {
            const ma = i >= 20 ? calculateSMA(closePrices.slice(0, i + 1), Math.min(50, i + 1)) : p;
            if (p >= ma && prevP < ma) {
              crossIndex = i;
              break;
            }
          } else {
            const ma = i >= 20 ? calculateSMA(closePrices.slice(0, i + 1), Math.min(50, i + 1)) : p;
            if (p <= ma && prevP > ma) {
              crossIndex = i;
              break;
            }
          }
        }

        if (crossIndex >= 0 && quotes[crossIndex]?.date) {
          const crossDate = new Date(quotes[crossIndex].date);
          const diffDays = Math.max(1, Math.round((now.getTime() - crossDate.getTime()) / oneDayMs));
          daysInTrend = diffDays;
          trendStartDate = crossDate.toISOString().slice(0, 10);
        } else {
          // If no recent crossover, estimate from lifecycle stage & performance
          if (stage === 'STARTING') {
            daysInTrend = Math.min(12, Math.max(2, Math.round(quotes.length >= 10 ? 5 : 3)));
          } else if (stage === 'ONGOING') {
            daysInTrend = Math.min(220, Math.max(21, Math.round(Math.abs(r3M) * 3 + 28)));
          } else {
            daysInTrend = Math.min(260, Math.max(45, Math.round(Math.abs(r3M) * 4 + 40)));
          }
          const computedStart = new Date(now.getTime() - daysInTrend * oneDayMs);
          trendStartDate = computedStart.toISOString().slice(0, 10);
        }

        // For EXHAUSTED stage: calculate when exhaustion first began
        if (stage === 'EXHAUSTED') {
          let exhIndex = -1;
          for (let i = quotes.length - 1; i >= Math.max(0, quotes.length - 40); i--) {
            const subPrices = closePrices.slice(0, i + 1);
            if (subPrices.length >= 15) {
              const histRsi = calculateRSI(subPrices, 14);
              if (direction === 'BULLISH' && histRsi >= 70) {
                exhIndex = i;
              } else if (direction === 'BEARISH' && histRsi <= 30) {
                exhIndex = i;
              }
            }
          }

          if (exhIndex >= 0 && quotes[exhIndex]?.date) {
            const eDate = new Date(quotes[exhIndex].date);
            daysExhausted = Math.max(1, Math.round((now.getTime() - eDate.getTime()) / oneDayMs));
            exhaustionStartDate = eDate.toISOString().slice(0, 10);
          } else {
            daysExhausted = Math.min(21, Math.max(3, Math.round(Math.abs(rsi14 >= 70 ? rsi14 - 68 : 30 - rsi14) * 1.5 + 4)));
            const computedExh = new Date(now.getTime() - daysExhausted * oneDayMs);
            exhaustionStartDate = computedExh.toISOString().slice(0, 10);
          }
        }
      } else {
        // Fallback for mock/short data
        if (stage === 'STARTING') {
          daysInTrend = 4;
        } else if (stage === 'ONGOING') {
          daysInTrend = Math.min(120, Math.max(18, Math.round(Math.abs(r3M) * 3 + 24)));
        } else {
          daysInTrend = Math.min(180, Math.max(40, Math.round(Math.abs(r3M) * 4 + 35)));
        }
        const computedStart = new Date(now.getTime() - daysInTrend * oneDayMs);
        trendStartDate = computedStart.toISOString().slice(0, 10);

        if (stage === 'EXHAUSTED') {
          daysExhausted = 7;
          exhaustionStartDate = new Date(now.getTime() - 7 * oneDayMs).toISOString().slice(0, 10);
        }
      }

      // Generate Contextual Macro Driver & Actionable Playbook
      const macroDriver = this.generateMacroDriver(def, direction, stage, r1M, r3M);
      const actionablePlaybook = this.generateActionablePlaybook(direction, stage, curPrice, dma20, dma50);

      return {
        symbol: def.symbol,
        name: def.name,
        shortName: def.shortName,
        scope: def.scope,
        subCategory: def.subCategory,
        description: def.description,
        price: curPrice,
        prevClose,
        change,
        changePercent,
        returns: {
          '1D': changePercent,
          '1W': r1W,
          '1M': r1M,
          '3M': r3M,
          'YTD': rYtd,
        },
        stage,
        direction,
        trendStrengthScore: Math.min(99, Math.max(10, trendStrengthScore)),
        exhaustionRiskScore: Math.min(99, Math.max(10, exhaustionRiskScore)),
        dma20,
        dma50,
        dma200,
        dist20DmaPct,
        dist50DmaPct,
        dist200DmaPct,
        rsi14,
        isGoldenCross,
        isDeathCross,
        signals,
        macroDriver,
        actionablePlaybook,
        trendStartDate,
        daysInTrend,
        exhaustionStartDate,
        daysExhausted,
      };
    } catch (err: any) {
      console.error(`[TrendFinder] Error analyzing ${def.symbol}:`, err.message);
      return null;
    }
  }

  /**
   * Generate Macro Catalyst Context
   */
  private generateMacroDriver(
    def: typeof TREND_UNIVERSE[0],
    direction: TrendDirection,
    stage: TrendStage,
    r1M: number,
    r3M: number
  ): string {
    const sym = def.symbol;

    if (sym === 'GLD' || sym === 'SLV') {
      return stage === 'EXHAUSTED'
        ? 'Parabolic safe-haven rally overextended against real yields. Rebalancing / consolidation imminent.'
        : 'Global central bank accumulation + sovereign debt debasement hedging supporting bullish trend.';
    }
    if (sym === 'TLT' || sym === 'IEF') {
      return direction === 'BULLISH'
        ? 'Rate cut expectations and duration flight driving bond yield compression.'
        : 'Sticky inflation / fiscal deficit issuance exerting upward yield pressure.';
    }
    if (sym === 'SMH' || sym === 'XLK' || sym === 'BOTZ') {
      return stage === 'EXHAUSTED'
        ? 'Extreme valuation multiples and AI capex digestion putting near-term pressure on semiconductor leadership.'
        : 'Hyper-scale datacenter buildout, accelerator GPU demand, and enterprise software monetization.';
    }
    if (sym === 'XLE' || sym === 'USO' || sym === 'OIH') {
      return direction === 'BULLISH'
        ? 'OPEC+ discipline and geopolitical supply friction tightens physical inventories.'
        : 'Global manufacturing slowdown and non-OPEC supply expansion tempering petroleum margins.';
    }
    if (sym === 'XLU') {
      return 'AI data center power demand + baseload electrification transforms defensive utility into growth theme.';
    }
    if (sym === 'KRE' || sym === 'XLF') {
      return 'Net interest margin expansion + yield curve steepening boosting regional lending profitability.';
    }
    if (sym === 'UUP') {
      return direction === 'BULLISH'
        ? 'US economic growth outperformance versus Europe and Asia keeping greenback strong.'
        : 'Federal Reserve easing cycle narrowing rate differentials versus foreign currencies.';
    }

    if (direction === 'BULLISH') {
      return `${def.shortName} exhibiting positive sector rotation with ${r1M >= 0 ? '+' : ''}${r1M}% 1M expansion.`;
    }
    return `${def.shortName} under systematic capital outflow with ${r1M}% 1M contraction.`;
  }

  /**
   * Generate Actionable Tactical Trading Playbook
   */
  private generateActionablePlaybook(
    direction: TrendDirection,
    stage: TrendStage,
    price: number,
    dma20: number,
    dma50: number
  ): string {
    if (direction === 'BULLISH') {
      if (stage === 'STARTING') {
        return `High-R:R Breakout Entry: Initiate starter long position. Place risk stop just below 50-SMA ($${dma50.toFixed(1)}) and target prior cycle resistance.`;
      }
      if (stage === 'ONGOING') {
        return `Trend Following: Maintain core long exposure. Add on orderly pullbacks to the 20-EMA ($${dma20.toFixed(1)}) with a trailing stop.`;
      }
      // EXHAUSTED
      return `Take Profit & Hedge: Trim extended longs into strength. Sell out-of-the-money Covered Calls or collar to harvest high volatility premium.`;
    } else {
      if (stage === 'STARTING') {
        return `Short Breakdown Play: Enter tactical bearish spread / short position with invalidation stop above 50-SMA ($${dma50.toFixed(1)}).`;
      }
      if (stage === 'ONGOING') {
        return `Bear Trend Continuation: Avoid dip-buying. Fade bear-market rallies into declining 20-EMA resistance ($${dma20.toFixed(1)}).`;
      }
      // EXHAUSTED
      return `Mean-Reversion Reversal Watch: Heavy capitulation bottom forming. Look for bullish divergence or sell cash-secured puts below key support.`;
    }
  }
}

export const trendFinderService = new TrendFinderService();
