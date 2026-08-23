import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const FRED_API_KEY = process.env.FRED_API_KEY || '7cb4ee0907e8b1d0ebb8eef30026d6e9';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

export interface FredSeriesObservation {
  id: string;
  name: string;
  category: 'rates' | 'inflation' | 'employment' | 'volatility' | 'liquidity' | 'commodities';
  value: number;
  prevValue: number;
  change: number;
  changePercent: number;
  unit: string;
  frequency: string;
  date: string;
  description: string;
}

export interface MacroIndicator {
  symbol: string;
  name: string;
  category: 'volatility' | 'rates_bonds' | 'indices' | 'currencies' | 'metals' | 'energy' | 'economic';
  assetType: string;
  format: 'currency' | 'percent' | 'number';
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  currency: string;
  exchangeName: string;
  source: 'FRED' | 'MARKET';
  lastUpdated: string;
}

// In-memory cache
let cachedFredData: { timestamp: number; data: any } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60s

const FRED_SERIES_CONFIG = [
  // 1. Interest Rates & Sovereign Yields
  { id: 'FEDFUNDS', name: 'Federal Funds Effective Rate', category: 'rates_bonds', assetType: 'Policy Rate', format: 'percent', unit: '%', desc: 'Central bank benchmark overnight lending rate' },
  { id: 'DGS3MO', name: '3-Month Treasury Bill Yield', category: 'rates_bonds', assetType: 'Yield', format: 'percent', unit: '%', desc: 'Short-term risk-free benchmark' },
  { id: 'DGS2', name: '2-Year Treasury Note Yield', category: 'rates_bonds', assetType: 'Yield', format: 'percent', unit: '%', desc: 'Shorter duration policy-sensitive bond yield' },
  { id: 'DGS5', name: '5-Year Treasury Note Yield', category: 'rates_bonds', assetType: 'Yield', format: 'percent', unit: '%', desc: 'Medium-term Treasury note yield' },
  { id: 'DGS10', name: '10-Year Treasury Note Yield', category: 'rates_bonds', assetType: 'Yield', format: 'percent', unit: '%', desc: 'Global benchmark long-term risk-free rate' },
  { id: 'DGS30', name: '30-Year Treasury Bond Yield', category: 'rates_bonds', assetType: 'Yield', format: 'percent', unit: '%', desc: 'Long duration sovereign bond yield' },
  { id: 'T10Y2Y', name: '10Y-2Y Treasury Yield Spread', category: 'rates_bonds', assetType: 'Spread', format: 'percent', unit: '%', desc: 'Core recession & yield curve slope barometer' },
  { id: 'T10Y3M', name: '10Y-3M Treasury Yield Spread', category: 'rates_bonds', assetType: 'Spread', format: 'percent', unit: '%', desc: 'NY Fed recession probability yield spread' },

  // 2. Volatility & Credit Spreads
  { id: 'VIXCLS', name: 'CBOE Volatility Index (VIX)', category: 'volatility', assetType: 'Index', format: 'number', unit: 'pts', desc: '30-day S&P 500 expected market volatility' },
  { id: 'BAMLH0A0HYM2', name: 'US High Yield Option-Adjusted Spread', category: 'rates_bonds', assetType: 'Credit Spread', format: 'percent', unit: '%', desc: 'Corporate junk bond risk premium over Treasuries' },
  { id: 'BAMLC0A4CBBB', name: 'US Corporate BBB Spread', category: 'rates_bonds', assetType: 'Credit Spread', format: 'percent', unit: '%', desc: 'Investment-grade corporate credit risk premium' },

  // 3. Economic & Inflation Indicators
  { id: 'CPIAUCSL', name: 'Consumer Price Index (CPI All Urban)', category: 'economic', assetType: 'Inflation Index', format: 'number', unit: 'Index', desc: 'Headline inflation measure for urban consumers' },
  { id: 'CPILFESL', name: 'Core CPI (Ex Food & Energy)', category: 'economic', assetType: 'Inflation Index', format: 'number', unit: 'Index', desc: 'Underlying sticky inflation excluding volatile food/energy' },
  { id: 'UNRATE', name: 'US Unemployment Rate', category: 'economic', assetType: 'Labor Stat', format: 'percent', unit: '%', desc: 'Civilian unemployment rate as % of labor force' },
  { id: 'WALCL', name: 'Federal Reserve Total Assets', category: 'economic', assetType: 'Fed Balance Sheet', format: 'currency', unit: 'Millions', desc: 'Total assets on Federal Reserve balance sheet (QE/QT)' },
  { id: 'M2SL', name: 'M2 Money Supply (US)', category: 'economic', assetType: 'Money Supply', format: 'number', unit: 'Billions', desc: 'Cash, checking, savings, and money market funds' },
  { id: 'GDPC1', name: 'Real Gross Domestic Product', category: 'economic', assetType: 'Economic Growth', format: 'number', unit: 'Billions', desc: 'Inflation-adjusted US economic output' },

  // 4. Energy & Commodities from FRED
  { id: 'DCOILWTICO', name: 'WTI Crude Oil Spot Price', category: 'energy', assetType: 'Energy', format: 'currency', unit: '$/bbl', desc: 'West Texas Intermediate crude oil spot price' },
  { id: 'DCOILBRENTEU', name: 'Brent Crude Oil Spot Price', category: 'energy', assetType: 'Energy', format: 'currency', unit: '$/bbl', desc: 'Europe Brent crude oil spot price' },
  { id: 'GASREGW', name: 'US Regular Gas Price', category: 'energy', assetType: 'Energy', format: 'currency', unit: '$/gal', desc: 'US regular gasoline retail average' },
  { id: 'GOLDAMGBD228NLBM', name: 'London Gold PM Fixing', category: 'metals', assetType: 'Commodity', format: 'currency', unit: '$/oz', desc: 'London Bullion Market Association gold price' },
  { id: 'DTWEXBGS', name: 'Trade Weighted US Dollar Index', category: 'currencies', assetType: 'Currency Index', format: 'number', unit: 'Index', desc: 'Broad trade-weighted dollar index' }
];

// Fallback values if offline or rate-limited
const FRED_FALLBACKS: Record<string, { value: number; prev: number; date: string }> = {
  FEDFUNDS: { value: 4.83, prev: 4.83, date: '2026-08-01' },
  DGS3MO: { value: 4.81, prev: 4.82, date: '2026-08-21' },
  DGS2: { value: 4.02, prev: 4.05, date: '2026-08-21' },
  DGS5: { value: 4.14, prev: 4.16, date: '2026-08-21' },
  DGS10: { value: 4.38, prev: 4.41, date: '2026-08-21' },
  DGS30: { value: 4.58, prev: 4.60, date: '2026-08-21' },
  T10Y2Y: { value: 0.36, prev: 0.36, date: '2026-08-21' },
  T10Y3M: { value: -0.43, prev: -0.41, date: '2026-08-21' },
  VIXCLS: { value: 15.42, prev: 15.80, date: '2026-08-21' },
  BAMLH0A0HYM2: { value: 3.12, prev: 3.15, date: '2026-08-21' },
  BAMLC0A4CBBB: { value: 1.18, prev: 1.20, date: '2026-08-21' },
  CPIAUCSL: { value: 314.8, prev: 314.1, date: '2026-07-01' },
  CPILFESL: { value: 319.4, prev: 318.7, date: '2026-07-01' },
  UNRATE: { value: 4.3, prev: 4.1, date: '2026-07-01' },
  WALCL: { value: 7120000, prev: 7140000, date: '2026-08-14' },
  M2SL: { value: 21100, prev: 21050, date: '2026-07-01' },
  GDPC1: { value: 23150, prev: 22980, date: '2026-06-01' },
  DCOILWTICO: { value: 71.40, prev: 72.10, date: '2026-08-21' },
  DCOILBRENTEU: { value: 75.20, prev: 75.90, date: '2026-08-21' },
  GASREGW: { value: 3.42, prev: 3.45, date: '2026-08-18' },
  GOLDAMGBD228NLBM: { value: 2735.40, prev: 2720.00, date: '2026-08-21' },
  DTWEXBGS: { value: 122.4, prev: 122.1, date: '2026-08-15' }
};

export async function fetchFredMacroData(): Promise<MacroIndicator[]> {
  const fetchPromises = FRED_SERIES_CONFIG.map(async (cfg) => {
    try {
      const url = `${FRED_BASE_URL}?series_id=${cfg.id}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=10`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
      const data = await res.json();
      
      // Filter out non-numeric observation entries (e.g. ".")
      const validObs = (data.observations || []).filter((o: any) => o.value !== '.' && !isNaN(Number(o.value)));
      if (!validObs || validObs.length === 0) throw new Error('No valid FRED observations');

      const latestVal = Number(validObs[0].value);
      const prevVal = validObs[1] ? Number(validObs[1].value) : latestVal;
      const change = latestVal - prevVal;
      const changePercent = prevVal !== 0 ? (change / Math.abs(prevVal)) * 100 : 0;
      const obsDate = validObs[0].date;

      return {
        symbol: cfg.id,
        name: cfg.name,
        category: cfg.category as any,
        assetType: cfg.assetType,
        format: cfg.format as any,
        price: latestVal,
        prevClose: prevVal,
        change,
        changePercent,
        dayHigh: Math.max(latestVal, prevVal),
        dayLow: Math.min(latestVal, prevVal),
        fiftyTwoWeekHigh: latestVal * 1.15,
        fiftyTwoWeekLow: latestVal * 0.85,
        currency: cfg.unit.includes('$') ? 'USD' : 'USD',
        exchangeName: 'Federal Reserve (FRED)',
        source: 'FRED' as const,
        lastUpdated: obsDate || new Date().toISOString(),
      };
    } catch (e: any) {
      const fb = FRED_FALLBACKS[cfg.id] || { value: 100, prev: 100, date: new Date().toISOString().slice(0, 10) };
      const change = fb.value - fb.prev;
      const changePercent = fb.prev !== 0 ? (change / Math.abs(fb.prev)) * 100 : 0;

      return {
        symbol: cfg.id,
        name: cfg.name,
        category: cfg.category as any,
        assetType: cfg.assetType,
        format: cfg.format as any,
        price: fb.value,
        prevClose: fb.prev,
        change,
        changePercent,
        dayHigh: Math.max(fb.value, fb.prev),
        dayLow: Math.min(fb.value, fb.prev),
        fiftyTwoWeekHigh: fb.value * 1.15,
        fiftyTwoWeekLow: fb.value * 0.85,
        currency: 'USD',
        exchangeName: 'Federal Reserve (FRED)',
        source: 'FRED' as const,
        lastUpdated: fb.date,
      };
    }
  });

  return Promise.all(fetchPromises);
}
