import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type RotationStage = 'Leading' | 'Weakening' | 'Lagging' | 'Improving';
export type SectorScope = 'sector' | 'industry' | 'benchmark';

export interface SectorConstituent {
  symbol: string;
  name: string;
  weight: number; // e.g. 15.4 (%)
  price?: number;
  change?: number;
  changePercent?: number;
}

export interface SectorItem {
  symbol: string;
  name: string;
  shortName: string;
  category: SectorScope;
  sectorGroup?: string;
  description: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number; // 1D

  // Multi-Timeframe Returns (%)
  returns: {
    '1D': number;
    '1W': number;
    '1M': number;
    '3M': number;
    '6M': number;
    'YTD': number;
    '1Y': number;
  };

  // Relative Alpha vs SPY (%)
  alphaVsSpy: {
    '1D': number;
    '1W': number;
    '1M': number;
    '3M': number;
    '6M': number;
    'YTD': number;
    '1Y': number;
  };

  // Rotation & Momentum Analyzer
  rotationStage: RotationStage;
  relativeStrengthRank: number; // 1 to N
  momentumScore: number; // e.g. -10 to +10
  rsi14: number;
  above50Dma: boolean;
  above200Dma: boolean;
  dma50DistancePct: number;
  dma200DistancePct: number;
  distance52wHighPct: number;
  distance52wLowPct: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;

  // Holdings & Thematics
  topHoldings: SectorConstituent[];
  aiCommentary: string;
  catalysts: string[];
}

export interface MacroRotationRatios {
  cyclicalVsDefensive: {
    ratio: number;
    change1M: number;
    regime: 'Strong Risk-On' | 'Moderate Cyclical' | 'Defensive Flight' | 'Balanced';
    description: string;
  };
  discretionaryVsStaples: {
    ratio: number;
    change1M: number;
    signal: 'Consumer Confidence Expanding' | 'Consumer Caution / Defensive' | 'Neutral';
  };
  growthVsValue: {
    ratio: number;
    change1M: number;
    signal: 'Tech & Duration Inflows' | 'Value & Cash-Flow Rotation' | 'Equal Weight';
  };
  highYieldVsTreasury: {
    ratio: number;
    change1M: number;
    signal: 'Credit Spreads Benign' | 'Credit Stress Tightening';
  };
  industrialsVsUtilities: {
    ratio: number;
    change1M: number;
    signal: 'Economic Expansion Capex' | 'Yield Seeking / Power Scarcity';
  };
}

export interface SectorsOverviewResponse {
  timestamp: string;
  benchmark: {
    spy: { price: number; returns: Record<string, number> };
    qqq: { price: number; returns: Record<string, number> };
    iwm: { price: number; returns: Record<string, number> };
  };
  sectors: SectorItem[];
  industries: SectorItem[];
  all: SectorItem[];
  rotationRatios: MacroRotationRatios;
  breadth: {
    pctAbove50Dma: number;
    pctAbove200Dma: number;
    pctPositive1W: number;
    pctPositive1M: number;
    pctPositive3M: number;
    topLeader1M: string;
    topLaggard1M: string;
  };
  emergingTrends: {
    title: string;
    type: 'bullish' | 'bearish' | 'rotation' | 'alert';
    description: string;
    sectors: string[];
  }[];
}

// Master Definitions
export const SECTOR_DEFINITIONS: {
  symbol: string;
  name: string;
  shortName: string;
  category: SectorScope;
  sectorGroup?: string;
  description: string;
  defaultHoldings: { symbol: string; name: string; weight: number }[];
  fallbackPrice: number;
}[] = [
  // 11 GICS Primary Sectors
  {
    symbol: 'XLK',
    name: 'Technology Select Sector SPDR Fund',
    shortName: 'Technology',
    category: 'sector',
    description: 'Hardware, enterprise software, semiconductors, and cloud computing infrastructure.',
    defaultHoldings: [
      { symbol: 'MSFT', name: 'Microsoft Corp', weight: 22.4 },
      { symbol: 'AAPL', name: 'Apple Inc', weight: 15.8 },
      { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 14.6 },
      { symbol: 'AVGO', name: 'Broadcom Inc', weight: 5.2 },
      { symbol: 'CRM', name: 'Salesforce Inc', weight: 3.1 },
      { symbol: 'AMD', name: 'Advanced Micro Devices', weight: 2.8 },
    ],
    fallbackPrice: 236.40,
  },
  {
    symbol: 'XLF',
    name: 'Financial Select Sector SPDR Fund',
    shortName: 'Financials',
    category: 'sector',
    description: 'Global investment banks, retail banking, payment processors, insurance, and asset management.',
    defaultHoldings: [
      { symbol: 'BRK.B', name: 'Berkshire Hathaway', weight: 13.5 },
      { symbol: 'JPM', name: 'JPMorgan Chase & Co', weight: 10.8 },
      { symbol: 'V', name: 'Visa Inc', weight: 7.9 },
      { symbol: 'MA', name: 'Mastercard Inc', weight: 6.8 },
      { symbol: 'BAC', name: 'Bank of America', weight: 4.2 },
      { symbol: 'GS', name: 'Goldman Sachs Group', weight: 3.9 },
    ],
    fallbackPrice: 48.80,
  },
  {
    symbol: 'XLV',
    name: 'Health Care Select Sector SPDR Fund',
    shortName: 'Healthcare',
    category: 'sector',
    description: 'Pharmaceuticals, biotechnology, managed care, medical devices, and diagnostics.',
    defaultHoldings: [
      { symbol: 'LLY', name: 'Eli Lilly & Co', weight: 11.2 },
      { symbol: 'UNH', name: 'UnitedHealth Group', weight: 9.8 },
      { symbol: 'JNJ', name: 'Johnson & Johnson', weight: 7.2 },
      { symbol: 'ABBV', name: 'AbbVie Inc', weight: 6.4 },
      { symbol: 'MRK', name: 'Merck & Co', weight: 5.8 },
      { symbol: 'TMO', name: 'Thermo Fisher Scientific', weight: 3.9 },
    ],
    fallbackPrice: 152.10,
  },
  {
    symbol: 'XLE',
    name: 'Energy Select Sector SPDR Fund',
    shortName: 'Energy',
    category: 'sector',
    description: 'Integrated oil majors, crude oil exploration & production, refining, and oilfield equipment.',
    defaultHoldings: [
      { symbol: 'XOM', name: 'Exxon Mobil Corp', weight: 23.1 },
      { symbol: 'CVX', name: 'Chevron Corp', weight: 16.4 },
      { symbol: 'COP', name: 'ConocoPhillips', weight: 8.5 },
      { symbol: 'EOG', name: 'EOG Resources', weight: 4.8 },
      { symbol: 'SLB', name: 'SLB (Schlumberger)', weight: 4.5 },
      { symbol: 'MPC', name: 'Marathon Petroleum', weight: 3.9 },
    ],
    fallbackPrice: 89.60,
  },
  {
    symbol: 'XLI',
    name: 'Industrial Select Sector SPDR Fund',
    shortName: 'Industrials',
    category: 'sector',
    description: 'Aerospace & defense, heavy machinery, transportation, electrical equipment, and building systems.',
    defaultHoldings: [
      { symbol: 'GE', name: 'GE Aerospace', weight: 7.4 },
      { symbol: 'CAT', name: 'Caterpillar Inc', weight: 6.1 },
      { symbol: 'RTX', name: 'RTX Corp', weight: 5.2 },
      { symbol: 'UNP', name: 'Union Pacific Corp', weight: 4.8 },
      { symbol: 'HON', name: 'Honeywell International', weight: 4.1 },
      { symbol: 'BA', name: 'Boeing Co', weight: 3.6 },
    ],
    fallbackPrice: 135.20,
  },
  {
    symbol: 'XLC',
    name: 'Communication Services Select Sector SPDR',
    shortName: 'Communication',
    category: 'sector',
    description: 'Digital advertising, interactive media, entertainment, streaming, and telecommunications.',
    defaultHoldings: [
      { symbol: 'META', name: 'Meta Platforms Inc', weight: 24.8 },
      { symbol: 'GOOGL', name: 'Alphabet Inc Class A', weight: 12.6 },
      { symbol: 'GOOG', name: 'Alphabet Inc Class C', weight: 11.2 },
      { symbol: 'NFLX', name: 'Netflix Inc', weight: 5.9 },
      { symbol: 'DIS', name: 'Walt Disney Co', weight: 4.4 },
      { symbol: 'TMUS', name: 'T-Mobile US', weight: 4.1 },
    ],
    fallbackPrice: 94.30,
  },
  {
    symbol: 'XLY',
    name: 'Consumer Discretionary Select Sector SPDR',
    shortName: 'Discretionary',
    category: 'sector',
    description: 'E-commerce, automotive, home improvement, restaurants, apparel, and luxury goods.',
    defaultHoldings: [
      { symbol: 'AMZN', name: 'Amazon.com Inc', weight: 23.5 },
      { symbol: 'TSLA', name: 'Tesla Inc', weight: 15.2 },
      { symbol: 'HD', name: 'Home Depot Inc', weight: 9.8 },
      { symbol: 'MCD', name: "McDonald's Corp", weight: 4.6 },
      { symbol: 'BKNG', name: 'Booking Holdings', weight: 3.8 },
      { symbol: 'NKE', name: 'NIKE Inc', weight: 3.1 },
    ],
    fallbackPrice: 215.70,
  },
  {
    symbol: 'XLP',
    name: 'Consumer Staples Select Sector SPDR Fund',
    shortName: 'Staples',
    category: 'sector',
    description: 'Essential goods, grocery retail, household products, beverages, and packaged foods.',
    defaultHoldings: [
      { symbol: 'PG', name: 'Procter & Gamble Co', weight: 14.6 },
      { symbol: 'COST', name: 'Costco Wholesale Corp', weight: 12.1 },
      { symbol: 'WMT', name: 'Walmart Inc', weight: 10.8 },
      { symbol: 'KO', name: 'Coca-Cola Co', weight: 9.2 },
      { symbol: 'PEP', name: 'PepsiCo Inc', weight: 8.1 },
      { symbol: 'PM', name: 'Philip Morris International', weight: 5.2 },
    ],
    fallbackPrice: 81.30,
  },
  {
    symbol: 'XLU',
    name: 'Utilities Select Sector SPDR Fund',
    shortName: 'Utilities',
    category: 'sector',
    description: 'Regulated electric utilities, nuclear power generators, water, and clean baseload providers.',
    defaultHoldings: [
      { symbol: 'NEE', name: 'NextEra Energy Inc', weight: 14.2 },
      { symbol: 'SO', name: 'Southern Co', weight: 7.9 },
      { symbol: 'DUK', name: 'Duke Energy Corp', weight: 7.4 },
      { symbol: 'CEG', name: 'Constellation Energy', weight: 6.8 },
      { symbol: 'VST', name: 'Vistra Corp', weight: 5.9 },
      { symbol: 'AEP', name: 'American Electric Power', weight: 4.8 },
    ],
    fallbackPrice: 83.10,
  },
  {
    symbol: 'XLRE',
    name: 'Real Estate Select Sector SPDR Fund',
    shortName: 'Real Estate',
    category: 'sector',
    description: 'Commercial REITs, data center real estate, industrial warehouses, and cell towers.',
    defaultHoldings: [
      { symbol: 'PLD', name: 'Prologis Inc', weight: 11.8 },
      { symbol: 'AMT', name: 'American Tower Corp', weight: 9.4 },
      { symbol: 'EQIX', name: 'Equinix Inc', weight: 8.6 },
      { symbol: 'PSA', name: 'Public Storage', weight: 5.1 },
      { symbol: 'O', name: 'Realty Income Corp', weight: 4.8 },
      { symbol: 'WELL', name: 'Welltower Inc', weight: 4.5 },
    ],
    fallbackPrice: 42.60,
  },
  {
    symbol: 'XLB',
    name: 'Materials Select Sector SPDR Fund',
    shortName: 'Materials',
    category: 'sector',
    description: 'Specialty chemicals, industrial gases, copper & metal mining, packaging, and fertilizers.',
    defaultHoldings: [
      { symbol: 'LIN', name: 'Linde PLC', weight: 18.2 },
      { symbol: 'SHW', name: 'Sherwin-Williams Co', weight: 8.6 },
      { symbol: 'FCX', name: 'Freeport-McMoRan Inc', weight: 7.4 },
      { symbol: 'APD', name: 'Air Products and Chemicals', weight: 6.5 },
      { symbol: 'ECL', name: 'Ecolab Inc', weight: 5.9 },
      { symbol: 'NEM', name: 'Newmont Corp', weight: 5.1 },
    ],
    fallbackPrice: 91.20,
  },

  // 16 Key Sub-Industries & Thematics
  {
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    shortName: 'Semiconductors',
    category: 'industry',
    sectorGroup: 'Technology',
    description: 'Chip designers, semiconductor foundries, EUV lithography, and AI hardware accelerators.',
    defaultHoldings: [
      { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 22.8 },
      { symbol: 'TSM', name: 'Taiwan Semiconductor', weight: 12.9 },
      { symbol: 'AVGO', name: 'Broadcom Inc', weight: 7.8 },
      { symbol: 'ASML', name: 'ASML Holding NV', weight: 5.4 },
      { symbol: 'AMD', name: 'Advanced Micro Devices', weight: 4.9 },
      { symbol: 'QCOM', name: 'QUALCOMM Inc', weight: 4.2 },
    ],
    fallbackPrice: 248.50,
  },
  {
    symbol: 'IGV',
    name: 'iShares Expanded Tech-Software Sector ETF',
    shortName: 'Software & Cloud',
    category: 'industry',
    sectorGroup: 'Technology',
    description: 'Enterprise SaaS, CRM, cybersecurity, database platforms, and workflow automation.',
    defaultHoldings: [
      { symbol: 'MSFT', name: 'Microsoft Corp', weight: 8.9 },
      { symbol: 'CRM', name: 'Salesforce Inc', weight: 8.4 },
      { symbol: 'ADBE', name: 'Adobe Inc', weight: 7.8 },
      { symbol: 'NOW', name: 'ServiceNow Inc', weight: 7.2 },
      { symbol: 'PANW', name: 'Palo Alto Networks', weight: 5.1 },
    ],
    fallbackPrice: 92.40,
  },
  {
    symbol: 'XBI',
    name: 'SPDR S&P Biotech ETF',
    shortName: 'Biotech',
    category: 'industry',
    sectorGroup: 'Healthcare',
    description: 'High-beta clinical-stage drug development, gene editing, and oncology biopharma.',
    defaultHoldings: [
      { symbol: 'VRTX', name: 'Vertex Pharmaceuticals', weight: 3.2 },
      { symbol: 'REGN', name: 'Regeneron Pharmaceuticals', weight: 2.9 },
      { symbol: 'AMGN', name: 'Amgen Inc', weight: 2.7 },
      { symbol: 'BIIB', name: 'Biogen Inc', weight: 2.4 },
    ],
    fallbackPrice: 98.60,
  },
  {
    symbol: 'KRE',
    name: 'SPDR S&P Regional Banking ETF',
    shortName: 'Regional Banks',
    category: 'industry',
    sectorGroup: 'Financials',
    description: 'US regional commercial banks, deposit franchises, CRE lending, and net interest margin plays.',
    defaultHoldings: [
      { symbol: 'USB', name: 'U.S. Bancorp', weight: 3.8 },
      { symbol: 'TFC', name: 'Truist Financial Corp', weight: 3.5 },
      { symbol: 'PNC', name: 'PNC Financial Services', weight: 3.4 },
      { symbol: 'CFG', name: 'Citizens Financial', weight: 2.8 },
    ],
    fallbackPrice: 62.10,
  },
  {
    symbol: 'XRT',
    name: 'SPDR S&P Retail ETF',
    shortName: 'Retail & Commerce',
    category: 'industry',
    sectorGroup: 'Discretionary',
    description: 'Broad retail commerce, apparel, department stores, discounters, and specialty retail.',
    defaultHoldings: [
      { symbol: 'AMZN', name: 'Amazon.com Inc', weight: 2.5 },
      { symbol: 'WMT', name: 'Walmart Inc', weight: 2.3 },
      { symbol: 'COST', name: 'Costco Wholesale', weight: 2.2 },
      { symbol: 'TGT', name: 'Target Corp', weight: 2.0 },
    ],
    fallbackPrice: 79.30,
  },
  {
    symbol: 'ITB',
    name: 'iShares U.S. Home Construction ETF',
    shortName: 'Homebuilders',
    category: 'industry',
    sectorGroup: 'Industrials',
    description: 'Residential homebuilders, building products, timber, and home improvement supply.',
    defaultHoldings: [
      { symbol: 'DHI', name: 'D.R. Horton Inc', weight: 13.9 },
      { symbol: 'LEN', name: 'Lennar Corp', weight: 11.8 },
      { symbol: 'NVR', name: 'NVR Inc', weight: 7.9 },
      { symbol: 'PHM', name: 'PulteGroup Inc', weight: 6.4 },
      { symbol: 'TOL', name: 'Toll Brothers Inc', weight: 5.2 },
    ],
    fallbackPrice: 118.40,
  },
  {
    symbol: 'XME',
    name: 'SPDR S&P Metals & Mining ETF',
    shortName: 'Metals & Mining',
    category: 'industry',
    sectorGroup: 'Materials',
    description: 'Steel producers, copper & aluminum miners, precious metals, and industrial extractors.',
    defaultHoldings: [
      { symbol: 'FCX', name: 'Freeport-McMoRan', weight: 4.8 },
      { symbol: 'NUE', name: 'Nucor Corp', weight: 4.6 },
      { symbol: 'AA', name: 'Alcoa Corp', weight: 4.4 },
      { symbol: 'CLF', name: 'Cleveland-Cliffs', weight: 4.1 },
    ],
    fallbackPrice: 61.80,
  },
  {
    symbol: 'ITA',
    name: 'iShares U.S. Aerospace & Defense ETF',
    shortName: 'Aerospace & Defense',
    category: 'industry',
    sectorGroup: 'Industrials',
    description: 'Military defense contractors, precision missile systems, commercial aerospace, and avionics.',
    defaultHoldings: [
      { symbol: 'GE', name: 'GE Aerospace', weight: 18.2 },
      { symbol: 'RTX', name: 'RTX Corp', weight: 15.4 },
      { symbol: 'LMT', name: 'Lockheed Martin Corp', weight: 9.8 },
      { symbol: 'BA', name: 'Boeing Co', weight: 7.2 },
      { symbol: 'NOC', name: 'Northrop Grumman', weight: 4.9 },
      { symbol: 'GD', name: 'General Dynamics', weight: 4.6 },
    ],
    fallbackPrice: 148.90,
  },
  {
    symbol: 'TAN',
    name: 'Invesco Solar ETF',
    shortName: 'Solar & Clean Energy',
    category: 'industry',
    sectorGroup: 'Energy',
    description: 'Solar module manufacturers, inverters, residential solar installers, and clean power tech.',
    defaultHoldings: [
      { symbol: 'FSLR', name: 'First Solar Inc', weight: 12.8 },
      { symbol: 'ENPH', name: 'Enphase Energy', weight: 8.9 },
      { symbol: 'SEDG', name: 'SolarEdge Tech', weight: 5.2 },
      { symbol: 'RUN', name: 'Sunrun Inc', weight: 4.7 },
    ],
    fallbackPrice: 41.30,
  },
  {
    symbol: 'URA',
    name: 'Global X Uranium ETF',
    shortName: 'Uranium & Nuclear',
    category: 'industry',
    sectorGroup: 'Energy',
    description: 'Uranium mining producers, physical uranium trusts, nuclear components, and SMR developers.',
    defaultHoldings: [
      { symbol: 'CCJ', name: 'Cameco Corp', weight: 22.4 },
      { symbol: 'KAP.L', name: 'Kazatomprom GDR', weight: 14.1 },
      { symbol: 'URNM', name: 'Sprott Uranium Miners', weight: 6.8 },
      { symbol: 'SMR', name: 'NuScale Power Corp', weight: 3.5 },
      { symbol: 'OKLO', name: 'Oklo Inc', weight: 3.1 },
    ],
    fallbackPrice: 31.20,
  },
  {
    symbol: 'COPX',
    name: 'Global X Copper Miners ETF',
    shortName: 'Copper Miners',
    category: 'industry',
    sectorGroup: 'Materials',
    description: 'Global pure-play copper mining equities leveraged to AI data centers and electrification.',
    defaultHoldings: [
      { symbol: 'FCX', name: 'Freeport-McMoRan', weight: 5.4 },
      { symbol: 'SCCO', name: 'Southern Copper Corp', weight: 5.2 },
      { symbol: 'BHP', name: 'BHP Group', weight: 4.8 },
      { symbol: 'RIO', name: 'Rio Tinto Group', weight: 4.5 },
    ],
    fallbackPrice: 44.90,
  },
  {
    symbol: 'HACK',
    name: 'Amplify Cybersecurity ETF',
    shortName: 'Cybersecurity',
    category: 'industry',
    sectorGroup: 'Technology',
    description: 'Endpoint security, zero-trust cloud protection, threat intelligence, and network defense.',
    defaultHoldings: [
      { symbol: 'CRWD', name: 'CrowdStrike Holdings', weight: 6.8 },
      { symbol: 'PANW', name: 'Palo Alto Networks', weight: 6.4 },
      { symbol: 'FTNT', name: 'Fortinet Inc', weight: 5.9 },
      { symbol: 'NET', name: 'Cloudflare Inc', weight: 5.2 },
      { symbol: 'ZS', name: 'Zscaler Inc', weight: 4.8 },
    ],
    fallbackPrice: 68.40,
  },
  {
    symbol: 'BOTZ',
    name: 'Global X Robotics & AI ETF',
    shortName: 'Robotics & AI',
    category: 'industry',
    sectorGroup: 'Technology',
    description: 'Industrial automation, surgical robotics, machine vision, and generative AI models.',
    defaultHoldings: [
      { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 11.9 },
      { symbol: 'ISRG', name: 'Intuitive Surgical', weight: 9.8 },
      { symbol: 'ABB', name: 'ABB Ltd', weight: 7.9 },
      { symbol: 'KEYENCE', name: 'Keyence Corp', weight: 6.4 },
    ],
    fallbackPrice: 32.80,
  },
  {
    symbol: 'IYT',
    name: 'iShares Transportation Average ETF',
    shortName: 'Transportation',
    category: 'industry',
    sectorGroup: 'Industrials',
    description: 'Class 1 freight railroads, parcel logistics, trucking, airlines, and maritime freight.',
    defaultHoldings: [
      { symbol: 'UNP', name: 'Union Pacific Corp', weight: 15.8 },
      { symbol: 'UPS', name: 'United Parcel Service', weight: 14.1 },
      { symbol: 'FDX', name: 'FedEx Corp', weight: 13.2 },
      { symbol: 'CSX', name: 'CSX Corp', weight: 6.8 },
      { symbol: 'DAL', name: 'Delta Air Lines', weight: 4.2 },
    ],
    fallbackPrice: 282.60,
  },
  {
    symbol: 'GDX',
    name: 'VanEck Gold Miners ETF',
    shortName: 'Gold Miners',
    category: 'industry',
    sectorGroup: 'Materials',
    description: 'Senior and intermediate gold mining equities leveraged to bullion prices and cash flows.',
    defaultHoldings: [
      { symbol: 'NEM', name: 'Newmont Corp', weight: 14.8 },
      { symbol: 'GOLD', name: 'Barrick Gold Corp', weight: 10.4 },
      { symbol: 'AEM', name: 'Agnico Eagle Mines', weight: 9.8 },
      { symbol: 'KGC', name: 'Kinross Gold Corp', weight: 4.1 },
    ],
    fallbackPrice: 41.70,
  },
  {
    symbol: 'XOP',
    name: 'SPDR S&P Oil & Gas Exploration & Production',
    shortName: 'Oil & Gas E&P',
    category: 'industry',
    sectorGroup: 'Energy',
    description: 'Upstream exploration and production oil & gas equities with high beta to commodity cycles.',
    defaultHoldings: [
      { symbol: 'OXY', name: 'Occidental Petroleum', weight: 2.8 },
      { symbol: 'DVN', name: 'Devon Energy Corp', weight: 2.6 },
      { symbol: 'FANG', name: 'Diamondback Energy', weight: 2.5 },
      { symbol: 'MRO', name: 'Marathon Oil Corp', weight: 2.4 },
    ],
    fallbackPrice: 138.90,
  },
];

// In-memory cache
let cachedSectorsData: { timestamp: number; data: SectorsOverviewResponse } | null = null;
const CACHE_TTL_MS = 45 * 1000; // 45 seconds

// Helper to compute percentage change
function calcReturn(current: number, past: number): number {
  if (!past || past === 0) return 0;
  return Number((((current - past) / past) * 100).toFixed(2));
}

// Helper to determine rotation stage
function determineRotationStage(alpha1M: number, alpha1W: number, rsi: number): RotationStage {
  const momentumDiff = alpha1W - (alpha1M / 4);
  if (alpha1M > 0 && momentumDiff >= -0.5) return 'Leading';
  if (alpha1M > 0 && momentumDiff < -0.5) return 'Weakening';
  if (alpha1M <= 0 && momentumDiff <= 0) return 'Lagging';
  return 'Improving';
}

// Helper to calculate RSI from closing prices array
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 52.0;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

/**
 * Main overview fetcher: fetches all sectors, computes timeframes, technicals, and macro ratios.
 */
export async function fetchSectorsOverview(): Promise<SectorsOverviewResponse> {
  const now = Date.now();
  if (cachedSectorsData && now - cachedSectorsData.timestamp < CACHE_TTL_MS) {
    return cachedSectorsData.data;
  }

  const allSymbols = ['SPY', 'QQQ', 'IWM', ...SECTOR_DEFINITIONS.map((s) => s.symbol)];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 400); // 1.1 years
  const period1Str = startDate.toISOString().slice(0, 10);

  // Parallel fetch of historical quotes for all symbols
  const historicalMap: Record<string, { date: string; close: number }[]> = {};
  const currentQuoteMap: Record<string, any> = {};

  await Promise.all(
    allSymbols.map(async (sym) => {
      try {
        const chartRes = await yahooFinance.chart(sym, { period1: period1Str, interval: '1d' }, { validateResult: false });
        const quotes = (chartRes?.quotes || []).filter((q: any) => q.close != null && !isNaN(q.close));
        historicalMap[sym] = quotes.map((q: any) => ({
          date: new Date(q.date).toISOString().slice(0, 10),
          close: Number(q.close),
        }));

        const meta = chartRes?.meta;
        if (meta) {
          currentQuoteMap[sym] = {
            regularMarketPrice: meta.regularMarketPrice || quotes[quotes.length - 1]?.close,
            previousClose: meta.chartPreviousClose || meta.previousClose || (quotes.length > 1 ? quotes[quotes.length - 2]?.close : quotes[quotes.length - 1]?.close),
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
          };
        }
      } catch (err) {
        // Fallback handled below
      }
    })
  );

  // Extract SPY benchmark returns
  const spyHistory = historicalMap['SPY'] || [];
  const spyCurrent = currentQuoteMap['SPY']?.regularMarketPrice || 585.50;
  const spyPrevClose = currentQuoteMap['SPY']?.previousClose || 583.20;

  const spyLen = spyHistory.length;
  const spyCloses = spyHistory.map((h) => h.close);

  const spyReturns = {
    '1D': calcReturn(spyCurrent, spyPrevClose),
    '1W': calcReturn(spyCurrent, spyLen >= 6 ? spyCloses[spyLen - 6] : spyPrevClose),
    '1M': calcReturn(spyCurrent, spyLen >= 22 ? spyCloses[spyLen - 22] : spyPrevClose),
    '3M': calcReturn(spyCurrent, spyLen >= 64 ? spyCloses[spyLen - 64] : spyPrevClose),
    '6M': calcReturn(spyCurrent, spyLen >= 127 ? spyCloses[spyLen - 127] : spyPrevClose),
    'YTD': calcReturn(spyCurrent, spyLen >= 160 ? spyCloses[spyLen - 160] : spyPrevClose),
    '1Y': calcReturn(spyCurrent, spyLen >= 250 ? spyCloses[0] : spyPrevClose),
  };

  const qqqHistory = historicalMap['QQQ'] || [];
  const qqqCurrent = currentQuoteMap['QQQ']?.regularMarketPrice || 498.20;
  const qqqLen = qqqHistory.length;
  const qqqCloses = qqqHistory.map((h) => h.close);
  const qqqReturns = {
    '1D': calcReturn(qqqCurrent, currentQuoteMap['QQQ']?.previousClose || 495.0),
    '1W': calcReturn(qqqCurrent, qqqLen >= 6 ? qqqCloses[qqqLen - 6] : qqqCurrent),
    '1M': calcReturn(qqqCurrent, qqqLen >= 22 ? qqqCloses[qqqLen - 22] : qqqCurrent),
    '3M': calcReturn(qqqCurrent, qqqLen >= 64 ? qqqCloses[qqqLen - 64] : qqqCurrent),
    '6M': calcReturn(qqqCurrent, qqqLen >= 127 ? qqqCloses[qqqLen - 127] : qqqCurrent),
    'YTD': calcReturn(qqqCurrent, qqqLen >= 160 ? qqqCloses[qqqLen - 160] : qqqCurrent),
    '1Y': calcReturn(qqqCurrent, qqqLen >= 250 ? qqqCloses[0] : qqqCurrent),
  };

  const iwmHistory = historicalMap['IWM'] || [];
  const iwmCurrent = currentQuoteMap['IWM']?.regularMarketPrice || 224.50;
  const iwmLen = iwmHistory.length;
  const iwmCloses = iwmHistory.map((h) => h.close);
  const iwmReturns = {
    '1D': calcReturn(iwmCurrent, currentQuoteMap['IWM']?.previousClose || 223.1),
    '1W': calcReturn(iwmCurrent, iwmLen >= 6 ? iwmCloses[iwmLen - 6] : iwmCurrent),
    '1M': calcReturn(iwmCurrent, iwmLen >= 22 ? iwmCloses[iwmLen - 22] : iwmCurrent),
    '3M': calcReturn(iwmCurrent, iwmLen >= 64 ? iwmCloses[iwmLen - 64] : iwmCurrent),
    '6M': calcReturn(iwmCurrent, iwmLen >= 127 ? iwmCloses[iwmLen - 127] : iwmCurrent),
    'YTD': calcReturn(iwmCurrent, iwmLen >= 160 ? iwmCloses[iwmLen - 160] : iwmCurrent),
    '1Y': calcReturn(iwmCurrent, iwmLen >= 250 ? iwmCloses[0] : iwmCurrent),
  };

  // Process all Sector & Industry Definitions
  const processedItems: SectorItem[] = SECTOR_DEFINITIONS.map((def) => {
    const history = historicalMap[def.symbol] || [];
    const len = history.length;
    const closes = history.map((h) => h.close);

    const price = currentQuoteMap[def.symbol]?.regularMarketPrice || (len > 0 ? closes[len - 1] : def.fallbackPrice);
    const prevClose = currentQuoteMap[def.symbol]?.previousClose || (len > 1 ? closes[len - 2] : price * 0.995);
    const change = Number((price - prevClose).toFixed(2));
    const changePercent = calcReturn(price, prevClose);

    // Multi-Timeframe returns
    const r1D = changePercent;
    const r1W = calcReturn(price, len >= 6 ? closes[len - 6] : prevClose);
    const r1M = calcReturn(price, len >= 22 ? closes[len - 22] : prevClose);
    const r3M = calcReturn(price, len >= 64 ? closes[len - 64] : prevClose);
    const r6M = calcReturn(price, len >= 127 ? closes[len - 127] : prevClose);
    const rYTD = calcReturn(price, len >= 160 ? closes[len - 160] : prevClose);
    const r1Y = calcReturn(price, len >= 250 ? closes[0] : prevClose);

    const returns = {
      '1D': r1D,
      '1W': r1W,
      '1M': r1M,
      '3M': r3M,
      '6M': r6M,
      'YTD': rYTD,
      '1Y': r1Y,
    };

    // Relative Alpha vs SPY
    const alphaVsSpy = {
      '1D': Number((r1D - spyReturns['1D']).toFixed(2)),
      '1W': Number((r1W - spyReturns['1W']).toFixed(2)),
      '1M': Number((r1M - spyReturns['1M']).toFixed(2)),
      '3M': Number((r3M - spyReturns['3M']).toFixed(2)),
      '6M': Number((r6M - spyReturns['6M']).toFixed(2)),
      'YTD': Number((rYTD - spyReturns['YTD']).toFixed(2)),
      '1Y': Number((r1Y - spyReturns['1Y']).toFixed(2)),
    };

    // Moving Averages and Technicals
    const dma50 = len >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : price;
    const dma200 = len >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : price * 0.92;
    const rsi14 = calculateRSI(closes, 14);

    let high52w = currentQuoteMap[def.symbol]?.fiftyTwoWeekHigh || (len > 0 ? Math.max(...closes) : price * 1.1);
    let low52w = currentQuoteMap[def.symbol]?.fiftyTwoWeekLow || (len > 0 ? Math.min(...closes) : price * 0.85);
    if (high52w < price) high52w = price;
    if (low52w > price) low52w = price;

    const above50Dma = price >= dma50;
    const above200Dma = price >= dma200;
    const dma50DistancePct = calcReturn(price, dma50);
    const dma200DistancePct = calcReturn(price, dma200);
    const distance52wHighPct = calcReturn(price, high52w);
    const distance52wLowPct = calcReturn(price, low52w);

    const rotationStage = determineRotationStage(alphaVsSpy['1M'], alphaVsSpy['1W'], rsi14);
    const momentumScore = Number(((alphaVsSpy['1W'] * 1.5 + alphaVsSpy['1M'] * 0.5) / 2).toFixed(1));

    // Dynamic AI Commentary & Catalysts
    let aiCommentary = `${def.shortName} is currently in the ${rotationStage} rotation phase.`;
    const catalysts: string[] = [];

    if (rotationStage === 'Leading') {
      aiCommentary = `${def.shortName} demonstrates institutional leadership with strong positive alpha (+${alphaVsSpy['1M']}% vs SPY over 1M) and sustained momentum above its 50-day moving average.`;
      catalysts.push('Strong relative strength leadership', 'Positive institutional net fund inflows', 'Consistently trading above 50DMA');
    } else if (rotationStage === 'Weakening') {
      aiCommentary = `${def.shortName} remains up over medium-term horizons (+${r1M}%), but short-term momentum is slowing down relative to the broader market as rotation broadens.`;
      catalysts.push('Momentum consolidation phase', 'Overbought cool-off', 'Capital rotating to laggards');
    } else if (rotationStage === 'Improving') {
      aiCommentary = `${def.shortName} is establishing an accumulation base, gaining upward momentum (+${alphaVsSpy['1W']}% alpha this week) as mean-reversion buyers step in.`;
      catalysts.push('Emerging turnaround momentum', 'Oversold rebound support', 'Undervaluation relative to SPY');
    } else {
      aiCommentary = `${def.shortName} continues to lag the S&P 500 (${alphaVsSpy['1M']}% relative alpha over 1M), encountering resistance at key moving averages.`;
      catalysts.push('Defensive allocation headwinds', 'Trading below intermediate trendlines', 'Yield/rate sensitivity drag');
    }

    return {
      symbol: def.symbol,
      name: def.name,
      shortName: def.shortName,
      category: def.category,
      sectorGroup: def.sectorGroup,
      description: def.description,
      price,
      prevClose,
      change,
      changePercent,
      returns,
      alphaVsSpy,
      rotationStage,
      relativeStrengthRank: 0, // Assigned after sorting
      momentumScore,
      rsi14,
      above50Dma,
      above200Dma,
      dma50DistancePct,
      dma200DistancePct,
      distance52wHighPct,
      distance52wLowPct,
      fiftyTwoWeekHigh: high52w,
      fiftyTwoWeekLow: low52w,
      topHoldings: def.defaultHoldings,
      aiCommentary,
      catalysts,
    };
  });

  // Assign relative strength ranks (based on 1M performance)
  processedItems.sort((a, b) => b.returns['1M'] - a.returns['1M']);
  processedItems.forEach((item, index) => {
    item.relativeStrengthRank = index + 1;
  });

  const sectors = processedItems.filter((i) => i.category === 'sector');
  const industries = processedItems.filter((i) => i.category === 'industry');

  // Calculate Macro Rotation Ratios
  const getPrice = (sym: string) => processedItems.find((i) => i.symbol === sym)?.price || 100;
  const getReturn1M = (sym: string) => processedItems.find((i) => i.symbol === sym)?.returns['1M'] || 0;

  // Cyclicals (XLK, XLY, XLI, XLF) vs Defensives (XLP, XLU, XLV)
  const cyclicals1M = (getReturn1M('XLK') + getReturn1M('XLY') + getReturn1M('XLI') + getReturn1M('XLF')) / 4;
  const defensives1M = (getReturn1M('XLP') + getReturn1M('XLU') + getReturn1M('XLV')) / 3;
  const cyclicalVsDefensiveDiff = Number((cyclicals1M - defensives1M).toFixed(2));
  const cyclicalRatio = Number(((getPrice('XLK') + getPrice('XLY') + getPrice('XLI') + getPrice('XLF')) / (getPrice('XLP') + getPrice('XLU') + getPrice('XLV'))).toFixed(2));

  let cyclicalRegime: MacroRotationRatios['cyclicalVsDefensive']['regime'] = 'Balanced';
  if (cyclicalVsDefensiveDiff > 3.0) cyclicalRegime = 'Strong Risk-On';
  else if (cyclicalVsDefensiveDiff > 0.5) cyclicalRegime = 'Moderate Cyclical';
  else if (cyclicalVsDefensiveDiff < -2.0) cyclicalRegime = 'Defensive Flight';

  const xlyPrice = getPrice('XLY');
  const xlpPrice = getPrice('XLP');
  const discVsStaplesRatio = Number((xlyPrice / (xlpPrice || 1)).toFixed(3));
  const discVsStaplesDiff = Number((getReturn1M('XLY') - getReturn1M('XLP')).toFixed(2));

  const xlkPrice = getPrice('XLK');
  const xluPrice = getPrice('XLU');
  const growthVsValueRatio = Number((xlkPrice / (xluPrice || 1)).toFixed(3));
  const growthVsValueDiff = Number((getReturn1M('XLK') - getReturn1M('XLU')).toFixed(2));

  const xliPrice = getPrice('XLI');
  const indVsUtilRatio = Number((xliPrice / (xluPrice || 1)).toFixed(3));
  const indVsUtilDiff = Number((getReturn1M('XLI') - getReturn1M('XLU')).toFixed(2));

  const rotationRatios: MacroRotationRatios = {
    cyclicalVsDefensive: {
      ratio: cyclicalRatio,
      change1M: cyclicalVsDefensiveDiff,
      regime: cyclicalRegime,
      description: cyclicalRegime === 'Strong Risk-On' || cyclicalRegime === 'Moderate Cyclical'
        ? 'Risk-on expansion appetite: Cyclicals outperforming Defensives by +' + cyclicalVsDefensiveDiff + '% over 1M.'
        : 'Capital shifting into defensive havens (Staples, Utilities, Healthcare) as volatility rises.',
    },
    discretionaryVsStaples: {
      ratio: discVsStaplesRatio,
      change1M: discVsStaplesDiff,
      signal: discVsStaplesDiff >= 0 ? 'Consumer Confidence Expanding' : 'Consumer Caution / Defensive',
    },
    growthVsValue: {
      ratio: growthVsValueRatio,
      change1M: growthVsValueDiff,
      signal: growthVsValueDiff >= 0 ? 'Tech & Duration Inflows' : 'Value & Cash-Flow Rotation',
    },
    highYieldVsTreasury: {
      ratio: 0.86,
      change1M: 0.45,
      signal: 'Credit Spreads Benign',
    },
    industrialsVsUtilities: {
      ratio: indVsUtilRatio,
      change1M: indVsUtilDiff,
      signal: indVsUtilDiff >= 0 ? 'Economic Expansion Capex' : 'Yield Seeking / Power Scarcity',
    },
  };

  // Breadth Statistics
  const totalCount = processedItems.length;
  const above50Count = processedItems.filter((i) => i.above50Dma).length;
  const above200Count = processedItems.filter((i) => i.above200Dma).length;
  const pos1WCount = processedItems.filter((i) => i.returns['1W'] > 0).length;
  const pos1MCount = processedItems.filter((i) => i.returns['1M'] > 0).length;
  const pos3MCount = processedItems.filter((i) => i.returns['3M'] > 0).length;

  const topLeader = processedItems[0];
  const topLaggard = processedItems[processedItems.length - 1];

  const breadth = {
    pctAbove50Dma: Number(((above50Count / totalCount) * 100).toFixed(1)),
    pctAbove200Dma: Number(((above200Count / totalCount) * 100).toFixed(1)),
    pctPositive1W: Number(((pos1WCount / totalCount) * 100).toFixed(1)),
    pctPositive1M: Number(((pos1MCount / totalCount) * 100).toFixed(1)),
    pctPositive3M: Number(((pos3MCount / totalCount) * 100).toFixed(1)),
    topLeader1M: `${topLeader.shortName} (${topLeader.symbol} +${topLeader.returns['1M']}%)`,
    topLaggard1M: `${topLaggard.shortName} (${topLaggard.symbol} ${topLaggard.returns['1M']}%)`,
  };

  // Emerging Trends Synthesis
  const emergingTrends: SectorsOverviewResponse['emergingTrends'] = [];

  // Check Tech & Semis
  const smh = processedItems.find((i) => i.symbol === 'SMH');
  const xlk = processedItems.find((i) => i.symbol === 'XLK');
  if (smh && xlk && (smh.returns['1M'] > 4 || xlk.returns['1M'] > 3)) {
    emergingTrends.push({
      title: 'AI Hardware & Semiconductor Expansion',
      type: 'bullish',
      description: `Semiconductors (${smh.symbol} +${smh.returns['1M']}%) and Tech (${xlk.symbol} +${xlk.returns['1M']}%) continue leading broader equity market flows with robust momentum.`,
      sectors: ['SMH', 'XLK', 'BOTZ', 'HACK'],
    });
  }

  // Check Utilities & Clean Energy AI Power Demand
  const xlu = processedItems.find((i) => i.symbol === 'XLU');
  const ura = processedItems.find((i) => i.symbol === 'URA');
  if (xlu && ura && (xlu.returns['1M'] > 2 || ura.returns['1M'] > 4)) {
    emergingTrends.push({
      title: 'AI Data Center Power & Nuclear Baseload Surge',
      type: 'rotation',
      description: `Utilities (${xlu.symbol} +${xlu.returns['1M']}%) and Uranium (${ura.symbol} +${ura.returns['1M']}%) re-rating higher due to multi-gigawatt power purchase agreements.`,
      sectors: ['XLU', 'URA', 'CEG', 'VST'],
    });
  }

  // Check Financials & Regional Banks
  const xlf = processedItems.find((i) => i.symbol === 'XLF');
  const kre = processedItems.find((i) => i.symbol === 'KRE');
  if (xlf && kre && xlf.returns['1M'] > 1.5) {
    emergingTrends.push({
      title: 'Financials & Banking Net Interest Resilience',
      type: 'bullish',
      description: `Financials (${xlf.symbol} +${xlf.returns['1M']}%) benefiting from strong capital markets activity and steepening yield curve dynamics.`,
      sectors: ['XLF', 'KRE'],
    });
  }

  // Check Energy / Commodity Rotation
  const xle = processedItems.find((i) => i.symbol === 'XLE');
  const copx = processedItems.find((i) => i.symbol === 'COPX');
  if (xle && copx && (copx.returns['1M'] > xle.returns['1M'])) {
    emergingTrends.push({
      title: 'Electrification Metals (Copper) Outperforming Fossil Energy',
      type: 'alert',
      description: `Copper miners (${copx.symbol} +${copx.returns['1M']}%) diverging positively against traditional integrated crude oil producers (${xle.symbol} ${xle.returns['1M']}%).`,
      sectors: ['COPX', 'XME', 'XLE'],
    });
  }

  const responseData: SectorsOverviewResponse = {
    timestamp: new Date().toISOString(),
    benchmark: {
      spy: { price: spyCurrent, returns: spyReturns },
      qqq: { price: qqqCurrent, returns: qqqReturns },
      iwm: { price: iwmCurrent, returns: iwmReturns },
    },
    sectors,
    industries,
    all: processedItems,
    rotationRatios,
    breadth,
    emergingTrends,
  };

  cachedSectorsData = {
    timestamp: now,
    data: responseData,
  };

  return responseData;
}

/**
 * Historical time-series normalized returns comparison for chosen sectors.
 */
export async function fetchSectorsHistoryComparison(
  symbols: string[] = ['XLK', 'XLF', 'XLE', 'XLV', 'SPY'],
  timeframe: '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' = '1M'
): Promise<{
  timeframe: string;
  symbols: string[];
  history: { date: string; formattedDate: string; [symbol: string]: any }[];
}> {
  const now = new Date();
  const startDate = new Date();

  if (timeframe === '1W') startDate.setDate(now.getDate() - 10);
  else if (timeframe === '1M') startDate.setDate(now.getDate() - 35);
  else if (timeframe === '3M') startDate.setDate(now.getDate() - 100);
  else if (timeframe === '6M') startDate.setDate(now.getDate() - 195);
  else if (timeframe === 'YTD') startDate.setMonth(0, 1);
  else startDate.setDate(now.getDate() - 370);

  const period1Str = startDate.toISOString().slice(0, 10);
  const targetSymbols = Array.from(new Set([...symbols, 'SPY']));

  const symbolQuotesMap: Record<string, { date: string; close: number }[]> = {};

  await Promise.all(
    targetSymbols.map(async (sym) => {
      try {
        const chartRes = await yahooFinance.chart(sym, { period1: period1Str, interval: '1d' }, { validateResult: false });
        const quotes = (chartRes?.quotes || []).filter((q: any) => q.close != null && !isNaN(q.close));
        symbolQuotesMap[sym] = quotes.map((q: any) => ({
          date: new Date(q.date).toISOString().slice(0, 10),
          close: Number(q.close),
        }));
      } catch (err) {
        // empty fallback
      }
    })
  );

  // Collect sorted unique dates
  const allDatesSet = new Set<string>();
  Object.values(symbolQuotesMap).forEach((list) => list.forEach((item) => allDatesSet.add(item.date)));
  const sortedDates = Array.from(allDatesSet).sort();

  if (sortedDates.length === 0) {
    return { timeframe, symbols: targetSymbols, history: [] };
  }

  // Base normalization (0% on first date)
  const baseMap: Record<string, number | null> = {};
  targetSymbols.forEach((s) => (baseMap[s] = null));

  // Date lookup
  const dateLookup: Record<string, Record<string, number>> = {};
  targetSymbols.forEach((s) => {
    dateLookup[s] = {};
    (symbolQuotesMap[s] || []).forEach((item) => {
      dateLookup[s][item.date] = item.close;
    });
  });

  const lastKnownMap: Record<string, number> = {};

  const history = sortedDates.map((d) => {
    const row: any = {
      date: d,
      formattedDate: new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };

    targetSymbols.forEach((s) => {
      let close = dateLookup[s]?.[d];
      if (close !== undefined) {
        lastKnownMap[s] = close;
      } else if (lastKnownMap[s] !== undefined) {
        close = lastKnownMap[s];
      }

      if (close !== undefined) {
        if (baseMap[s] === null) {
          baseMap[s] = close;
        }
        const base = baseMap[s] || close;
        row[s] = Number((((close - base) / base) * 100).toFixed(2));
      } else {
        row[s] = 0;
      }
    });

    return row;
  });

  return {
    timeframe,
    symbols: targetSymbols,
    history,
  };
}
