import YahooFinance from 'yahoo-finance2';
import { agentActivityTracker } from './agentActivityService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
const logToFile = (msg: string) => console.log(msg);

export interface ScannerCriteria {
  search?: string;
  sectors?: string[];
  themes?: string[];
  marketCapTier?: 'ALL' | 'MEGA' | 'LARGE' | 'MID' | 'SMALL';
  minPe?: number;
  maxPe?: number;
  minPs?: number;
  maxPs?: number;
  minOperatingMargin?: number; // e.g. 15 (%)
  minRoe?: number; // e.g. 15 (%)
  maxDebtToEquity?: number; // e.g. 100 (%)
  minDividendYield?: number; // e.g. 2 (%)
  minDayChange?: number; // e.g. -5 (%)
  maxDayChange?: number; // e.g. +5 (%)
  minDistance52wHigh?: number; // e.g. -10 (%)
  maxDistance52wHigh?: number; // e.g. 0 (%)
  movingAverageCondition?: 'ALL' | 'ABOVE_50DMA' | 'ABOVE_200DMA' | 'GOLDEN_CROSS' | 'BELOW_200DMA';
  rsiCondition?: 'ALL' | 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

export interface ScannedStockResult {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  themes: string[];
  price: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  marketCapFormatted: string;
  pe: number | null;
  forwardPe: number | null;
  ps: number | null;
  pb: number | null;
  operatingMargin: number | null; // e.g. 0.28 -> 28%
  roe: number | null; // e.g. 0.32 -> 32%
  debtToEquity: number | null;
  dividendYield: number | null; // e.g. 0.024 -> 2.4%
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  distance52wHighPercent: number; // e.g. -8.4%
  distance52wLowPercent: number; // e.g. +34.2%
  fiftyDma: number | null;
  twoHundredDma: number | null;
  above50Dma: boolean;
  above200Dma: boolean;
  goldenCross: boolean;
  volume: number | null;
  avgVolume: number | null;
  volumeSurgeRatio: number; // e.g. 1.35x
  estimatedRsi: number; // 0 - 100 estimated 14D RSI
  passedCriteriaCount: number;
}

export interface ScannerExecutionResponse {
  results: ScannedStockResult[];
  totalUniverseSize: number;
  matchedCount: number;
  appliedCriteria: ScannerCriteria;
  timestamp: string;
}

/**
 * Curated universe representing multi-sector equities & thematic leaders
 */
export const SCANNER_UNIVERSE = [
  // Mega-Cap & AI Tech
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', themes: ['AI & Compute', 'Semiconductors', 'Datacenter'] },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', themes: ['AI & Compute', 'Enterprise Cloud', 'Software'] },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', themes: ['Consumer Tech', 'Quality Compounder'] },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', themes: ['Enterprise Cloud', 'E-Commerce', 'AI'] },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', themes: ['AI & Compute', 'Search', 'Cloud'] },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Communication Services', themes: ['AI & Compute', 'Digital Ads', 'Social Media'] },
  { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Discretionary', themes: ['EV & Mobility', 'Autonomous Tech', 'Energy'] },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', themes: ['AI & Compute', 'Semiconductors'] },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', themes: ['AI & Compute', 'Semiconductors', 'Cash Compounder'] },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', sector: 'Technology', themes: ['Semiconductors', 'Foundry Leader'] },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Technology', themes: ['AI & Compute', 'Defense', 'Enterprise SaaS'] },
  { symbol: 'ARM', name: 'Arm Holdings', sector: 'Technology', themes: ['Semiconductors', 'AI & Compute'] },
  { symbol: 'SMCI', name: 'Super Micro Computer', sector: 'Technology', themes: ['AI & Compute', 'Server Hardware'] },
  { symbol: 'ANET', name: 'Arista Networks', sector: 'Technology', themes: ['AI & Compute', 'Datacenter Networking'] },
  { symbol: 'CRM', name: 'Salesforce, Inc.', sector: 'Technology', themes: ['Enterprise SaaS', 'Cloud Software'] },
  { symbol: 'NOW', name: 'ServiceNow, Inc.', sector: 'Technology', themes: ['Enterprise SaaS', 'Workflow Automation'] },
  { symbol: 'SNOW', name: 'Snowflake Inc.', sector: 'Technology', themes: ['Enterprise SaaS', 'Cloud Data'] },
  { symbol: 'DDOG', name: 'Datadog, Inc.', sector: 'Technology', themes: ['Enterprise SaaS', 'Cloud Monitoring'] },
  { symbol: 'MDB', name: 'MongoDB, Inc.', sector: 'Technology', themes: ['Enterprise SaaS', 'Cloud Database'] },
  { symbol: 'NET', name: 'Cloudflare, Inc.', sector: 'Technology', themes: ['Cybersecurity', 'Cloud Infrastructure'] },

  // Cybersecurity & Defense
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', sector: 'Technology', themes: ['Cybersecurity', 'Zero-Trust'] },
  { symbol: 'PANW', name: 'Palo Alto Networks', sector: 'Technology', themes: ['Cybersecurity', 'Enterprise Security'] },
  { symbol: 'FTNT', name: 'Fortinet, Inc.', sector: 'Technology', themes: ['Cybersecurity', 'Cash Compounder'] },
  { symbol: 'ZS', name: 'Zscaler, Inc.', sector: 'Technology', themes: ['Cybersecurity', 'Cloud Security'] },
  { symbol: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', themes: ['Defense', 'Aerospace', 'Dividend Aristocrat'] },
  { symbol: 'RTX', name: 'RTX Corporation', sector: 'Industrials', themes: ['Defense', 'Aerospace'] },
  { symbol: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', themes: ['Defense', 'Aerospace'] },
  { symbol: 'GD', name: 'General Dynamics', sector: 'Industrials', themes: ['Defense', 'Marine Systems'] },
  { symbol: 'KTOS', name: 'Kratos Defense', sector: 'Industrials', themes: ['Defense', 'Drones & Autonomous'] },
  { symbol: 'RKLB', name: 'Rocket Lab USA', sector: 'Industrials', themes: ['Space Tech', 'Satellite Launch'] },

  // Energy, Nuclear & Clean Grid
  { symbol: 'CCJ', name: 'Cameco Corporation', sector: 'Energy', themes: ['Nuclear Energy', 'Uranium Miner', 'Clean Grid'] },
  { symbol: 'SMR', name: 'NuScale Power', sector: 'Industrials', themes: ['Nuclear Energy', 'SMR Technology'] },
  { symbol: 'CEG', name: 'Constellation Energy', sector: 'Utilities', themes: ['Nuclear Energy', 'Clean Power', 'Datacenter PPA'] },
  { symbol: 'VST', name: 'Vistra Corp.', sector: 'Utilities', themes: ['Nuclear Energy', 'Power Producer', 'Clean Grid'] },
  { symbol: 'OKLO', name: 'Oklo Inc.', sector: 'Industrials', themes: ['Nuclear Energy', 'Next-Gen Fission'] },
  { symbol: 'GE', name: 'GE Aerospace', sector: 'Industrials', themes: ['Aerospace', 'Industrial Compounder'] },
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', themes: ['Oil & Gas Major', 'Dividend Aristocrat', 'Cash Flow'] },
  { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy', themes: ['Oil & Gas Major', 'Dividend Aristocrat'] },
  { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy', themes: ['E&P Major', 'High Free Cash Flow'] },
  { symbol: 'SLB', name: 'SLB (Schlumberger)', sector: 'Energy', themes: ['Oilfield Services', 'Energy Tech'] },
  { symbol: 'ENPH', name: 'Enphase Energy', sector: 'Technology', themes: ['Energy Transition', 'Solar Tech'] },
  { symbol: 'FSLR', name: 'First Solar', sector: 'Technology', themes: ['Energy Transition', 'US Solar Manufacturing'] },

  // Healthcare & GLP-1 Bio-Pharma
  { symbol: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', themes: ['GLP-1 Weight Loss', 'Pharmaceuticals'] },
  { symbol: 'NVO', name: 'Novo Nordisk A/S', sector: 'Healthcare', themes: ['GLP-1 Weight Loss', 'Diabetes & Obesity'] },
  { symbol: 'VKTX', name: 'Viking Therapeutics', sector: 'Healthcare', themes: ['GLP-1 Weight Loss', 'Biotech Growth'] },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', themes: ['Managed Care', 'Quality Compounder'] },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', themes: ['Dividend Aristocrat', 'Defensive All-Weather'] },
  { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', themes: ['High Dividend', 'Pharmaceuticals'] },
  { symbol: 'MRK', name: 'Merck & Co.', sector: 'Healthcare', themes: ['Oncology', 'High Free Cash Flow'] },
  { symbol: 'ISRG', name: 'Intuitive Surgical', sector: 'Healthcare', themes: ['Robotic Surgery', 'Medical Devices'] },
  { symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare', themes: ['Biotechnology', 'Dividend Aristocrat'] },
  { symbol: 'REGN', name: 'Regeneron Pharma', sector: 'Healthcare', themes: ['Biotechnology', 'High ROE'] },

  // Financials & Fintech
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials', themes: ['Money Center Bank', 'Quality Compounder'] },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Financials', themes: ['Money Center Bank', 'Value'] },
  { symbol: 'WFC', name: 'Wells Fargo & Co.', sector: 'Financials', themes: ['Commercial Bank', 'Turnaround'] },
  { symbol: 'MS', name: 'Morgan Stanley', sector: 'Financials', themes: ['Wealth Management', 'Investment Bank'] },
  { symbol: 'GS', name: 'The Goldman Sachs Group', sector: 'Financials', themes: ['Investment Bank', 'Capital Markets'] },
  { symbol: 'BLK', name: 'BlackRock, Inc.', sector: 'Financials', themes: ['Asset Management', 'Cash Compounder'] },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financials', themes: ['Fintech & Payments', 'Unassailable Moat'] },
  { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financials', themes: ['Fintech & Payments', 'High ROE'] },
  { symbol: 'PYPL', name: 'PayPal Holdings', sector: 'Financials', themes: ['Fintech & Payments', 'Value'] },
  { symbol: 'HOOD', name: 'Robinhood Markets', sector: 'Financials', themes: ['Fintech Brokerage', 'Crypto & Retail'] },
  { symbol: 'SOFI', name: 'SoFi Technologies', sector: 'Financials', themes: ['Digital Banking', 'Fintech Growth'] },
  { symbol: 'COIN', name: 'Coinbase Global', sector: 'Financials', themes: ['Crypto Exchange', 'Digital Assets'] },

  // Industrials & Infrastructure Capex
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', themes: ['US Infrastructure', 'Heavy Machinery', 'Dividend Aristocrat'] },
  { symbol: 'URI', name: 'United Rentals', sector: 'Industrials', themes: ['US Infrastructure', 'Equipment Rental'] },
  { symbol: 'ETN', name: 'Eaton Corporation', sector: 'Industrials', themes: ['Clean Grid', 'Electrification', 'Datacenter Power'] },
  { symbol: 'PWR', name: 'Quanta Services', sector: 'Industrials', themes: ['Clean Grid', 'Infrastructure Engineering'] },
  { symbol: 'DE', name: 'Deere & Company', sector: 'Industrials', themes: ['Agriculture Equipment', 'Automation'] },
  { symbol: 'UNP', name: 'Union Pacific Corp.', sector: 'Industrials', themes: ['Railways & Freight', 'Cash Compounder'] },
  { symbol: 'BA', name: 'The Boeing Company', sector: 'Industrials', themes: ['Aerospace & Defense', 'Turnaround'] },

  // Consumer, Staples & Retail Compounders
  { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Staples', themes: ['Quality Compounder', 'Defensive All-Weather'] },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples', themes: ['Retail Titan', 'Defensive All-Weather'] },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', themes: ['Dividend Aristocrat', 'Defensive All-Weather'] },
  { symbol: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Staples', themes: ['Dividend Aristocrat', 'Defensive All-Weather'] },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', sector: 'Consumer Staples', themes: ['Dividend Aristocrat', 'Cash Flow'] },
  { symbol: 'HD', name: 'The Home Depot', sector: 'Consumer Discretionary', themes: ['Home Improvement', 'Dividend Aristocrat'] },
  { symbol: 'MCD', name: 'McDonald\'s Corp.', sector: 'Consumer Discretionary', themes: ['Fast Food Titan', 'Dividend Aristocrat'] },
  { symbol: 'NKE', name: 'NIKE, Inc.', sector: 'Consumer Discretionary', themes: ['Footwear & Apparel', 'Turnaround'] },
  { symbol: 'SBUX', name: 'Starbucks Corporation', sector: 'Consumer Discretionary', themes: ['Coffee & Retail', 'Turnaround'] },

  // Deep Value / Squeeze / High Beta
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Technology', themes: ['Deep Value', 'Semiconductors Foundry', 'Turnaround'] },
  { symbol: 'BABA', name: 'Alibaba Group', sector: 'Consumer Discretionary', themes: ['China Tech', 'Deep Value', 'High FCF'] },
  { symbol: 'CVNA', name: 'Carvana Co.', sector: 'Consumer Discretionary', themes: ['High Short Interest', 'High Beta', 'Squeeze'] },
  { symbol: 'UPST', name: 'Upstart Holdings', sector: 'Financials', themes: ['High Short Interest', 'Fintech Lending'] },
  { symbol: 'MARA', name: 'MARA Holdings', sector: 'Financials', themes: ['Crypto Mining', 'High Beta'] },
  { symbol: 'RIOT', name: 'Riot Platforms', sector: 'Financials', themes: ['Crypto Mining', 'High Beta'] },

  // Gold & Materials
  { symbol: 'NEM', name: 'Newmont Corporation', sector: 'Materials', themes: ['Gold Miner', 'Precious Metals'] },
  { symbol: 'GOLD', name: 'Barrick Gold', sector: 'Materials', themes: ['Gold Miner', 'Precious Metals'] },
  { symbol: 'AEM', name: 'Agnico Eagle Mines', sector: 'Materials', themes: ['Senior Gold Miner', 'Precious Metals'] },
  { symbol: 'FCX', name: 'Freeport-McMoRan', sector: 'Materials', themes: ['Copper Miner', 'Energy Transition'] },
  { symbol: 'LIN', name: 'Linde plc', sector: 'Materials', themes: ['Industrial Gases', 'Quality Compounder'] },
  { symbol: 'ALB', name: 'Albemarle Corp.', sector: 'Materials', themes: ['Lithium Miner', 'Energy Transition', 'Deep Value'] },

  // Benchmark ETFs
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', sector: 'Broad Market ETF', themes: ['US Index', 'Large Cap'] },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', sector: 'Tech Index ETF', themes: ['Nasdaq 100', 'Tech Growth'] },
  { symbol: 'IWM', name: 'iShares Russell 2000', sector: 'Small Cap ETF', themes: ['Small Cap', 'High Beta'] },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury', sector: 'Bond ETF', themes: ['Fixed Income', 'Duration Hedge'] },
  { symbol: 'GLD', name: 'SPDR Gold Shares', sector: 'Commodity ETF', themes: ['Gold & Hard Assets', 'Inflation Hedge'] },
];

/**
 * Format market cap numbers into human-readable strings
 */
function formatMarketCap(val: number | null | undefined): string {
  if (!val) return 'N/A';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

/**
 * Core scanning and multi-factor evaluation engine
 */
export async function runStockScanner(criteria: ScannerCriteria): Promise<ScannerExecutionResponse> {
  const task = agentActivityTracker.startTask({
    agentType: 'RESEARCH',
    symbol: 'MARKET_SCANNER',
    taskDescription: `Multi-Factor Stock Scanner: Evaluating universe across ${SCANNER_UNIVERSE.length} equities`,
  });

  try {
    const rawResults: ScannedStockResult[] = [];

    // 1. Fetch live market telemetry for universe stocks in batches
    const batchSize = 15;
    for (let i = 0; i < SCANNER_UNIVERSE.length; i += batchSize) {
      const batch = SCANNER_UNIVERSE.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item) => {
        try {
          const quote: any = await yahooFinance.quote(item.symbol);
          if (!quote || quote.regularMarketPrice === undefined) return null;

          const price = quote.regularMarketPrice || 0;
          const high52 = quote.fiftyTwoWeekHigh || price;
          const low52 = quote.fiftyTwoWeekLow || price;
          const fiftyDma = quote.fiftyDayAverage || null;
          const twoHundredDma = quote.twoHundredDayAverage || null;
          const vol = quote.regularMarketVolume || null;
          const avgVol = quote.averageDailyVolume3Month || quote.averageDailyVolume10Day || null;

          const distHigh = high52 > 0 ? ((price - high52) / high52) * 100 : 0;
          const distLow = low52 > 0 ? ((price - low52) / low52) * 100 : 0;
          const above50 = fiftyDma ? price > fiftyDma : false;
          const above200 = twoHundredDma ? price > twoHundredDma : false;
          const goldenCross = fiftyDma && twoHundredDma ? fiftyDma > twoHundredDma : false;
          const volRatio = vol && avgVol && avgVol > 0 ? vol / avgVol : 1.0;

          // Estimate RSI based on 52W range position and recent change
          const rangePosition = high52 > low52 ? (price - low52) / (high52 - low52) : 0.5;
          const dayChange = quote.regularMarketChangePercent || 0;
          const estimatedRsi = Math.min(95, Math.max(10, Math.round(rangePosition * 70 + 15 + dayChange * 2)));

          const res: ScannedStockResult = {
            symbol: item.symbol,
            name: item.name,
            sector: item.sector,
            themes: item.themes,
            price,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            marketCap: quote.marketCap || null,
            marketCapFormatted: formatMarketCap(quote.marketCap),
            pe: quote.trailingPE || null,
            forwardPe: quote.forwardPE || null,
            ps: quote.priceToSalesTrailing12Months || null,
            pb: quote.priceToBook || null,
            operatingMargin: quote.operatingMargins !== undefined ? quote.operatingMargins * 100 : null,
            roe: quote.returnOnEquity !== undefined ? quote.returnOnEquity * 100 : null,
            debtToEquity: quote.debtToEquity !== undefined ? quote.debtToEquity : null,
            dividendYield: quote.dividendYield !== undefined ? quote.dividendYield * 100 : (quote.trailingAnnualDividendYield ? quote.trailingAnnualDividendYield * 100 : null),
            fiftyTwoWeekHigh: high52,
            fiftyTwoWeekLow: low52,
            distance52wHighPercent: distHigh,
            distance52wLowPercent: distLow,
            fiftyDma,
            twoHundredDma,
            above50Dma: above50,
            above200Dma: above200,
            goldenCross,
            volume: vol,
            avgVolume: avgVol,
            volumeSurgeRatio: volRatio,
            estimatedRsi,
            passedCriteriaCount: 0,
          };

          return res;
        } catch {
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach((r) => {
        if (r) rawResults.push(r);
      });
    }

    // 2. Apply Custom Multi-Factor Filters
    const filtered = rawResults.filter((stock) => {
      // Freeform Text Search (symbol, name, sector, theme)
      if (criteria.search && criteria.search.trim()) {
        const q = criteria.search.toLowerCase().trim();
        const matchesSymbol = stock.symbol.toLowerCase().includes(q);
        const matchesName = stock.name.toLowerCase().includes(q);
        const matchesSector = stock.sector.toLowerCase().includes(q);
        const matchesTheme = stock.themes.some((t) => t.toLowerCase().includes(q));
        if (!matchesSymbol && !matchesName && !matchesSector && !matchesTheme) return false;
      }

      // Sectors Filter
      if (criteria.sectors && criteria.sectors.length > 0 && !criteria.sectors.includes('ALL')) {
        if (!criteria.sectors.includes(stock.sector)) return false;
      }

      // Themes Filter
      if (criteria.themes && criteria.themes.length > 0 && !criteria.themes.includes('ALL')) {
        const hasMatchingTheme = stock.themes.some((t) => criteria.themes!.includes(t));
        if (!hasMatchingTheme) return false;
      }

      // Market Cap Tier Filter
      if (criteria.marketCapTier && criteria.marketCapTier !== 'ALL') {
        const cap = stock.marketCap || 0;
        if (criteria.marketCapTier === 'MEGA' && cap < 200e9) return false;
        if (criteria.marketCapTier === 'LARGE' && (cap < 10e9 || cap >= 200e9)) return false;
        if (criteria.marketCapTier === 'MID' && (cap < 2e9 || cap >= 10e9)) return false;
        if (criteria.marketCapTier === 'SMALL' && cap >= 2e9) return false;
      }

      // Valuation P/E Filter
      if (criteria.minPe !== undefined && stock.pe !== null && stock.pe < criteria.minPe) return false;
      if (criteria.maxPe !== undefined && stock.pe !== null && stock.pe > criteria.maxPe) return false;

      // Operating Margin Filter (%)
      if (criteria.minOperatingMargin !== undefined && (stock.operatingMargin === null || stock.operatingMargin < criteria.minOperatingMargin)) {
        return false;
      }

      // ROE Filter (%)
      if (criteria.minRoe !== undefined && (stock.roe === null || stock.roe < criteria.minRoe)) {
        return false;
      }

      // Debt to Equity Filter (%)
      if (criteria.maxDebtToEquity !== undefined && (stock.debtToEquity !== null && stock.debtToEquity > criteria.maxDebtToEquity)) {
        return false;
      }

      // Dividend Yield Filter (%)
      if (criteria.minDividendYield !== undefined && (stock.dividendYield === null || stock.dividendYield < criteria.minDividendYield)) {
        return false;
      }

      // Day Change %
      if (criteria.minDayChange !== undefined && stock.changePercent < criteria.minDayChange) return false;
      if (criteria.maxDayChange !== undefined && stock.changePercent > criteria.maxDayChange) return false;

      // Distance from 52W High %
      if (criteria.minDistance52wHigh !== undefined && stock.distance52wHighPercent < criteria.minDistance52wHigh) return false;
      if (criteria.maxDistance52wHigh !== undefined && stock.distance52wHighPercent > criteria.maxDistance52wHigh) return false;

      // Moving Average Condition
      if (criteria.movingAverageCondition && criteria.movingAverageCondition !== 'ALL') {
        if (criteria.movingAverageCondition === 'ABOVE_50DMA' && !stock.above50Dma) return false;
        if (criteria.movingAverageCondition === 'ABOVE_200DMA' && !stock.above200Dma) return false;
        if (criteria.movingAverageCondition === 'GOLDEN_CROSS' && !stock.goldenCross) return false;
        if (criteria.movingAverageCondition === 'BELOW_200DMA' && stock.above200Dma) return false;
      }

      // RSI Condition
      if (criteria.rsiCondition && criteria.rsiCondition !== 'ALL') {
        if (criteria.rsiCondition === 'OVERSOLD' && stock.estimatedRsi >= 35) return false;
        if (criteria.rsiCondition === 'OVERBOUGHT' && stock.estimatedRsi <= 65) return false;
        if (criteria.rsiCondition === 'NEUTRAL' && (stock.estimatedRsi < 35 || stock.estimatedRsi > 65)) return false;
      }

      return true;
    });

    // 3. Sort Results
    const sortBy = criteria.sortBy || 'marketCap';
    const sortDir = criteria.sortDirection || 'desc';

    filtered.sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (valA === null || valA === undefined) valA = -999999999;
      if (valB === null || valB === undefined) valB = -999999999;

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    const limit = criteria.limit || 100;
    const finalResults = filtered.slice(0, limit);

    agentActivityTracker.completeTask(task.id, {
      status: 'COMPLETED',
      resultSummary: `Stock Scanner matched ${finalResults.length} equities across universe of ${SCANNER_UNIVERSE.length} stocks.`,
    });

    return {
      results: finalResults,
      totalUniverseSize: SCANNER_UNIVERSE.length,
      matchedCount: finalResults.length,
      appliedCriteria: criteria,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logToFile(`[StockScanner] Error running scanner: ${error.message}`);
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: error.message,
    });
    throw error;
  }
}
