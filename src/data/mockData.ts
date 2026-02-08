export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  marketCap: string;
  pe: number;
  eps: number;
  high52w: number;
  low52w: number;
  avgVolume: string;
  dividend: number;
  sector: string;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  date: string;
  status: 'executed' | 'pending' | 'cancelled';
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  alert?: number;
}

export interface Idea {
  id: string;
  title: string;
  symbol: string;
  type: 'bullish' | 'bearish' | 'neutral';
  content: string;
  date: string;
  tags: string[];
}

export const portfolioStats = {
  totalValue: 125847.32,
  dayChange: 2341.56,
  dayChangePercent: 1.89,
  totalGain: 15847.32,
  totalGainPercent: 14.41,
  buyingPower: 23500.00,
};

export const stocks: Stock[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 178.72,
    change: 2.34,
    changePercent: 1.33,
    volume: '52.3M',
    marketCap: '2.78T',
    pe: 28.5,
    eps: 6.27,
    high52w: 199.62,
    low52w: 124.17,
    avgVolume: '58.2M',
    dividend: 0.96,
    sector: 'Technology',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 378.91,
    change: 5.67,
    changePercent: 1.52,
    volume: '21.4M',
    marketCap: '2.81T',
    pe: 35.2,
    eps: 10.76,
    high52w: 384.30,
    low52w: 245.61,
    avgVolume: '25.1M',
    dividend: 3.00,
    sector: 'Technology',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 721.28,
    change: -12.45,
    changePercent: -1.70,
    volume: '41.2M',
    marketCap: '1.78T',
    pe: 65.3,
    eps: 11.04,
    high52w: 974.00,
    low52w: 222.97,
    avgVolume: '45.8M',
    dividend: 0.16,
    sector: 'Technology',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    price: 248.50,
    change: 8.92,
    changePercent: 3.72,
    volume: '98.7M',
    marketCap: '790.2B',
    pe: 72.1,
    eps: 3.45,
    high52w: 299.29,
    low52w: 152.37,
    avgVolume: '112.5M',
    dividend: 0,
    sector: 'Consumer Cyclical',
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    price: 178.25,
    change: 1.23,
    changePercent: 0.70,
    volume: '35.6M',
    marketCap: '1.86T',
    pe: 58.9,
    eps: 3.03,
    high52w: 189.77,
    low52w: 101.26,
    avgVolume: '42.3M',
    dividend: 0,
    sector: 'Consumer Cyclical',
  },
];

export const watchlist: WatchlistItem[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.72, change: 2.34, changePercent: 1.33, alert: 175 },
  { symbol: 'MSFT', name: 'Microsoft', price: 378.91, change: 5.67, changePercent: 1.52 },
  { symbol: 'NVDA', name: 'NVIDIA', price: 721.28, change: -12.45, changePercent: -1.70, alert: 700 },
  { symbol: 'TSLA', name: 'Tesla', price: 248.50, change: 8.92, changePercent: 3.72 },
  { symbol: 'AMZN', name: 'Amazon', price: 178.25, change: 1.23, changePercent: 0.70 },
  { symbol: 'GOOGL', name: 'Alphabet', price: 141.80, change: 0.95, changePercent: 0.67 },
  { symbol: 'META', name: 'Meta Platforms', price: 505.95, change: 12.30, changePercent: 2.49 },
];

export const recentTrades: Trade[] = [
  { id: '1', symbol: 'AAPL', type: 'BUY', quantity: 50, price: 175.50, total: 8775, date: '2024-01-15', status: 'executed' },
  { id: '2', symbol: 'NVDA', type: 'BUY', quantity: 10, price: 680.25, total: 6802.50, date: '2024-01-14', status: 'executed' },
  { id: '3', symbol: 'TSLA', type: 'SELL', quantity: 25, price: 245.00, total: 6125, date: '2024-01-12', status: 'executed' },
  { id: '4', symbol: 'MSFT', type: 'BUY', quantity: 15, price: 370.80, total: 5562, date: '2024-01-10', status: 'executed' },
  { id: '5', symbol: 'AMZN', type: 'BUY', quantity: 30, price: 175.25, total: 5257.50, date: '2024-01-08', status: 'executed' },
];

export const ideas: Idea[] = [
  {
    id: '1',
    title: 'NVDA Pullback Entry',
    symbol: 'NVDA',
    type: 'bullish',
    content: 'Looking for entry on pullback to $680-700 range. AI demand remains strong, data center growth accelerating.',
    date: '2024-01-15',
    tags: ['AI', 'Semiconductor', 'Growth'],
  },
  {
    id: '2',
    title: 'AAPL Vision Pro Catalyst',
    symbol: 'AAPL',
    type: 'bullish',
    content: 'Vision Pro launch could be significant catalyst. Services revenue growing 15% YoY.',
    date: '2024-01-14',
    tags: ['Hardware', 'Services', 'AR/VR'],
  },
  {
    id: '3',
    title: 'TSLA Overvalued Short-term',
    symbol: 'TSLA',
    type: 'bearish',
    content: 'Price action disconnected from fundamentals. Competition increasing, margins compressing.',
    date: '2024-01-12',
    tags: ['EV', 'Competition', 'Margins'],
  },
];

export const chartData = [
  { date: 'Jan 1', value: 110000 },
  { date: 'Jan 5', value: 112500 },
  { date: 'Jan 10', value: 108000 },
  { date: 'Jan 15', value: 115000 },
  { date: 'Jan 20', value: 118500 },
  { date: 'Jan 25', value: 121000 },
  { date: 'Jan 30', value: 119500 },
  { date: 'Feb 1', value: 122000 },
  { date: 'Feb 5', value: 125847 },
];
