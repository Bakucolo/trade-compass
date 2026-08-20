import { tastytradeAuthService } from './tastytradeAuth';

export const USE_STREAMING = false;

const BASE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = import.meta.env.VITE_FMP_API_KEY;
const API_URL = '/api'; // Relative URL via Vite proxy

export interface StockSearchResult {
    symbol: string;
    name: string;
    currency: string;
    stockExchange: string;
    exchangeShortName: string;
}

export interface StockQuote {
    symbol: string;
    name: string;
    price: number;
    changesPercentage: number;
    change: number;
    dayLow: number;
    dayHigh: number;
    yearHigh: number;
    yearLow: number;
    marketCap: number;
    priceAvg50: number;
    priceAvg200: number;
    volume: number;
    avgVolume: number;
    exchange: string;
    open: number;
    previousClose: number;
    eps: number;
    pe: number;
    earningsAnnouncement: string;
    sharesOutstanding: number;
    timestamp: number;
    source?: string; // To indicate where data came from
}

export interface CompanyProfile {
    symbol: string;
    price: number;
    beta: number;
    volAvg: number;
    mktCap: number;
    lastDiv: number;
    range: string;
    changes: number;
    companyName: string;
    currency: string;
    cisin: string;
    isin: string;
    exchange: string;
    exchangeShortName: string;
    industry: string;
    website: string;
    description: string;
    ceo: string;
    sector: string;
    country: string;
    fullTimeEmployees: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    dcfDiff: number;
    dcf: number;
    image: string;
    ipoDate: string;
    defaultImage: boolean;
    isEtf: boolean;
    isActivelyTrading: boolean;
    isAdr: boolean;
    isFund: boolean;
}

export interface CalculatedFinancials {
    operatingMargin: number;
    netMargin: number;
    debtToEquity: number;
    enterpriseValue: number;
    priceToSales: number;
    date: string;
}


const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

const fetchFromYahoo = async (symbol: string) => {
    try {
        const response = await fetchWithTimeout(`${API_URL}/yahoo/quote/${symbol}`, {}, 5000);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn("Yahoo fetch failed:", e);
        return null;
    }
};

const fetchFromFMP = async (endpoint: string, params: Record<string, string> = {}) => {
    if (!API_KEY || API_KEY.includes('YOUR_FMP')) return [];

    const queryParams = new URLSearchParams({ apikey: API_KEY, ...params });
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}?${queryParams}`);

    if (!response.ok) {
        return [];
    }

    const data = await response.json();
    return data;
};

// Helper to attempt Tastytrade fetch
const fetchFromTastytrade = async (symbol: string) => {
    try {
        const response = await fetchWithTimeout(`${API_URL}/tastytrade/market-data/${symbol}`, {}, 5000);
        if (!response.ok) return null;
        const data = await response.json();
        const items = data?.data?.items;
        if (items && items.length > 0) {
            return items[0];
        }
        return data?.data?.description ? data.data : null; // Only accept if it's a direct valid quote object
    } catch (e) {
        console.warn("Tastytrade fetch failed:", e);
        return null;
    }
};

const quoteCache = new Map<string, { promise: Promise<StockQuote | null>, timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache to avoid rate limits

export const marketDataService = {
    searchSymbols: async (query: string): Promise<StockSearchResult[]> => {
        if (!query) return [];
        try {
            const response = await fetchWithTimeout(`${API_URL}/research/search?query=${encodeURIComponent(query)}`, {}, 5000);
            if (!response.ok) return [];
            return await response.json();
        } catch (e) {
            console.error("Search fetch failed:", e);
            return [];
        }
    },

    getQuote: async (symbol: string): Promise<StockQuote | null> => {
        const isOccSymbol = /^[A-Z\s]{6}\d{6}[CP]\d{8}$/.test(symbol) || /^[A-Z]+\s*\d{6}[CP]\d{8}$/.test(symbol);

        // Check Cache first
        if (!isOccSymbol && quoteCache.has(symbol)) {
            const cached = quoteCache.get(symbol)!;
            if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
                return cached.promise;
            }
        }

        const fetchQuoteTask = async (): Promise<StockQuote | null> => {

            let yahooPromise = Promise.resolve(null);
            let tastyPromise = Promise.resolve(null);

            if (USE_STREAMING || isOccSymbol) {
                tastyPromise = fetchFromTastytrade(symbol);
            }

            if (!isOccSymbol) {
                yahooPromise = fetchFromYahoo(symbol);
            }

            const [yahooData, tastyData] = await Promise.all([yahooPromise, tastyPromise]);

            console.log("Resolved Quotes for", symbol, "-> Yahoo:", yahooData);

            if (isOccSymbol && tastyData) {
                return mapTastyQuoteToStockQuote(symbol, tastyData);
            } else if (isOccSymbol && !tastyData) {
                // Mock Option Data Fallback
                return {
                    symbol, name: symbol, price: 5.00, changesPercentage: 0, change: 0, dayLow: 5.00, dayHigh: 5.00, yearHigh: 5.00, yearLow: 5.00, marketCap: 0, priceAvg50: 0, priceAvg200: 0, volume: 0, avgVolume: 0, exchange: 'MOCK', open: 5.00, previousClose: 5.00, eps: 0, pe: 0, earningsAnnouncement: '', sharesOutstanding: 0, timestamp: Date.now() / 1000, source: 'Mock Data (Tasty Offline)'
                };
            }

            if (yahooData && yahooData.currentPrice !== undefined) {
                const price = typeof yahooData.currentPrice === 'number' ? yahooData.currentPrice : parseFloat(yahooData.currentPrice);
                const prevClose = yahooData.chartPreviousClose || yahooData.previousClose || price;
                const change = price - prevClose;
                const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;

                console.log("Mapping Yahoo Data for", symbol, price, prevClose);

                return {
                    symbol: symbol,
                    name: symbol, // Could augment later
                    price: price,
                    changesPercentage: changePct,
                    change: change,
                    dayLow: price, // Yahoo v8 basic proxy might not have day range natively, we simulate or accept current
                    dayHigh: price,
                    yearHigh: price,
                    yearLow: price,
                    marketCap: 0,
                    priceAvg50: 0,
                    priceAvg200: 0,
                    volume: 0,
                    avgVolume: 0,
                    exchange: yahooData.exchangeName || 'US',
                    open: yahooData.regularMarketPrice,
                    previousClose: prevClose,
                    eps: 0,
                    pe: 0,
                    earningsAnnouncement: '',
                    sharesOutstanding: 0,
                    timestamp: yahooData.regularMarketTime || (Date.now() / 1000),
                    source: 'Yahoo Finance'
                };
            }

            // Fallback to FMP
            if (!isOccSymbol) {
                try {
                    const profileData = await fetchFromFMP(`/profile/${symbol}`);
                    if (profileData && profileData.length > 0) {
                        const profile = profileData[0];
                        return {
                            symbol: profile.symbol,
                            name: profile.companyName,
                            price: profile.price,
                            changesPercentage: profile.changesPercentage || 0,
                            change: profile.changes || 0,
                            dayLow: profile.price,
                            dayHigh: profile.price,
                            yearHigh: profile.price,
                            yearLow: profile.price,
                            marketCap: profile.mktCap || 0,
                            priceAvg50: 0,
                            priceAvg200: 0,
                            volume: profile.volAvg || 0,
                            avgVolume: profile.volAvg || 0,
                            exchange: profile.exchangeShortName || 'US',
                            open: profile.price,
                            previousClose: profile.price,
                            eps: 0,
                            pe: 0,
                            earningsAnnouncement: '',
                            sharesOutstanding: 0,
                            timestamp: Date.now() / 1000,
                            source: 'FMP (Fallback)'
                        };
                    }
                } catch (e) {
                    console.warn("FMP Fallback failed:", e);
                }
            }

            // Last Resort
            return null;
        };

        const promise = fetchQuoteTask();
        if (!isOccSymbol) {
            quoteCache.set(symbol, { promise, timestamp: Date.now() });
            promise.then(res => {
                if (!res) {
                    quoteCache.delete(symbol);
                }
            });
        }
        return promise;
    },

    getProfile: async (symbol: string): Promise<CompanyProfile | null> => {
        const data = await fetchFromFMP('/profile', { symbol });
        return data && data.length > 0 ? data[0] : null;
    },

    getFinancials: async (symbol: string): Promise<CalculatedFinancials | null> => {
        try {
            // FMP for fundamentals (free tier compliant)
            const [ratiosData, keyMetricsData] = await Promise.all([
                fetchFromFMP(`/ratios`, { symbol, limit: '1' }),
                fetchFromFMP(`/key-metrics`, { symbol, limit: '1' })
            ]);

            const ratios = ratiosData && ratiosData.length > 0 ? ratiosData[0] : null;
            const metrics = keyMetricsData && keyMetricsData.length > 0 ? keyMetricsData[0] : null;

            if (!ratios) return null;

            return {
                operatingMargin: ratios.operatingProfitMargin || 0,
                netMargin: ratios.netProfitMargin || 0,
                debtToEquity: ratios.debtEquityRatio || 0,
                enterpriseValue: metrics?.enterpriseValue || 0,
                priceToSales: ratios.priceToSalesRatio || 0,
                date: ratios.date
            };
        } catch (error) {
            console.error("Error fetching financials:", error);
            return null;
        }
    }
};

function mapTastyQuoteToStockQuote(symbol: string, tastyQuote: any): StockQuote {
    // Market Closed Handling: Use lastPrice, then closePrice (prev day close), then bidPrice as last resort
    const price = Number(tastyQuote.lastPrice || tastyQuote.closePrice || tastyQuote.bidPrice || 0);
    const change = Number(tastyQuote.netChange || 0);
    const changesPercentage = Number(tastyQuote.percentChange || 0);

    return {
        symbol: symbol,
        name: tastyQuote.description || symbol, // Use description (e.g. "AAPL Jan 23 '23 $150 Call")
        price: price,
        changesPercentage: changesPercentage,
        change: change,
        dayLow: Number(tastyQuote.lowPrice || price),
        dayHigh: Number(tastyQuote.highPrice || price),
        yearHigh: Number(tastyQuote.high52Weeks || price),
        yearLow: Number(tastyQuote.low52Weeks || price),
        marketCap: 0,
        priceAvg50: 0,
        priceAvg200: 0,
        volume: Number(tastyQuote.volume || 0),
        avgVolume: 0,
        exchange: tastyQuote.exchangeCode || 'OPRA',
        open: Number(tastyQuote.openPrice || 0),
        previousClose: Number(tastyQuote.closePrice || 0),
        eps: 0,
        pe: 0,
        earningsAnnouncement: '',
        sharesOutstanding: 0,
        timestamp: Date.now() / 1000,
        source: 'Tastytrade (Real-time Option)'
    };
}
