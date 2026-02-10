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

const fetchFromFMP = async (endpoint: string, params: Record<string, string> = {}) => {
    if (!API_KEY) {
        throw new Error('FMP API Key is missing. Please add VITE_FMP_API_KEY to .env.local');
    }

    // Check for placeholder key
    if (API_KEY.includes('YOUR_FMP_API_KEY')) {
        throw new Error('You are using the placeholder API key. Please generate a real key from financialmodelingprep.com. update .env.local');
    }

    // Debug log (masked)
    // console.log(`Fetching FMP ${endpoint} with params ${JSON.stringify(params)} key: ${API_KEY.substring(0, 4)}...`);

    const queryParams = new URLSearchParams({ apikey: API_KEY, ...params });
    const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`);

    if (!response.ok) {
        let errorDetails = '';
        try {
            const errorBody = await response.json();
            if (errorBody['Error Message']) errorDetails = errorBody['Error Message'];
            else errorDetails = JSON.stringify(errorBody);
        } catch (e) {
            const text = await response.text();
            if (text) errorDetails = text;
        }

        if (response.status === 429) throw new Error('API Rate Limit Exceeded. Please try again later.');
        if (response.status === 401) throw new Error(`Invalid API Key (401). FMP says: ${errorDetails}`);
        if (response.status === 403) throw new Error(`Access Denied (403) for ${endpoint}. FMP says: ${errorDetails}`);

        throw new Error(`FMP API Error ${response.status}: ${errorDetails || response.statusText || 'Unknown Error'}`);
    }

    const data = await response.json();
    if (data['Error Message']) {
        throw new Error(data['Error Message']);
    }
    return data;
};

// Helper to attempt Tastytrade fetch
const fetchFromTastytrade = async (symbol: string) => {
    try {
        const response = await fetch(`${API_URL}/tastytrade/market-data/${symbol}`);
        if (!response.ok) return null;
        const data = await response.json();
        // Check structure: Tastytrade wrapper `data: { items: [...] }` or simplified by proxy
        // The backend proxy returns `data` directly from api.tastyworks.com
        // Common structure: { data: { items: [...] } } or just { data: ... }
        return data?.data?.items?.[0] || data?.data; // Flexible accessor
    } catch (e) {
        console.warn("Tastytrade fetch failed:", e);
        return null;
    }
};

export const marketDataService = {
    searchSymbols: async (query: string): Promise<StockSearchResult[]> => {
        if (!query) return [];
        // Search is still best handled by FMP for vast coverage
        return fetchFromFMP('/search-symbol', { query, limit: '10' });
    },

    getQuote: async (symbol: string): Promise<StockQuote | null> => {
        // HYBRID STRATEGY:
        // 1. Fetch Fundamentals/Profile from FMP (Stable, Static data)
        // 2. Try fetching Real-time Price from Tastytrade
        // 3. Merge data, prioritizing Tastytrade for price/volume

        const profilePromise = fetchFromFMP('/profile', { symbol });

        // Auto-login attempt if credentials exist (Lazy Auth)
        // We rely on backend or user login. 
        // If we are not logged in, fetchFromTastytrade will likely fail (401 from proxy).
        let tastyPromise = Promise.resolve(null);
        if (USE_STREAMING) {
            tastyPromise = fetchFromTastytrade(symbol);
        }

        const [profileData, tastyData] = await Promise.allSettled([profilePromise, tastyPromise]);

        const profileList = profileData.status === 'fulfilled' ? profileData.value : null;
        const profile = profileList && profileList.length > 0 ? profileList[0] : null;

        if (!profile) return null; // Profile is the base requirement

        const tastyQuote = tastyData.status === 'fulfilled' ? tastyData.value : null;

        // Extract Tastytrade Data if available
        let price = profile.price; // Default to FMP
        let dayLow = 0; // FMP sometimes has this in pool or range
        let dayHigh = 0;
        let volume = profile.volAvg; // Default to FMP volAvg
        let open = 0;
        let previousClose = 0;
        let change = profile.changes;
        let changesPercentage = 0;
        let source = 'FMP (Delayed)';

        if (tastyQuote) {
            // Map Tastytrade fields (DXLink/REST format varies, common fields below)
            if (tastyQuote.lastPrice) price = Number(tastyQuote.lastPrice);
            if (tastyQuote.netChange) change = Number(tastyQuote.netChange);
            if (tastyQuote.percentChange) changesPercentage = Number(tastyQuote.percentChange);
            if (tastyQuote.volume) volume = Number(tastyQuote.volume);
            if (tastyQuote.lowPrice) dayLow = Number(tastyQuote.lowPrice);
            if (tastyQuote.highPrice) dayHigh = Number(tastyQuote.highPrice);
            if (tastyQuote.openPrice) open = Number(tastyQuote.openPrice);
            if (tastyQuote.closePrice) previousClose = Number(tastyQuote.closePrice);

            source = 'Tastytrade (Real-time)';
        } else {
            // Fallback calculations using FMP data
            // FMP Profile 'changes' is the $ change.
            // We need to calculate percentage if not provided.
            // Note: FMP Profile doesn't always have 'changesPercentage', we might need to calc it.
            // or use specific quote endpoint if profile is insufficient, but profile has price and changes.

            // Re-calculate open to be safe
            open = price - change;
            changesPercentage = open !== 0 ? (change / open) * 100 : 0;

            // FMP Profile often has range "low-high"
            if (profile.range) {
                const rangeParts = profile.range.split('-');
                if (rangeParts.length === 2) {
                    // This is usually 52w range, not day range.
                    // FMP Profile doesn't strictly have dayHigh/low.
                    // We will leave dayHigh/Low as 0 or price if not available.
                }
            }
        }

        // Parse 52 week range from FMP if not in Tasty
        let yearLow = 0;
        let yearHigh = 0;
        if (profile.range) {
            const parts = profile.range.split('-');
            if (parts.length === 2) {
                yearLow = parseFloat(parts[0]);
                yearHigh = parseFloat(parts[1]);
            }
        }

        return {
            symbol: profile.symbol,
            name: profile.companyName,
            price: price,
            changesPercentage: changesPercentage,
            change: change,
            dayLow: dayLow || price,
            dayHigh: dayHigh || price,
            yearHigh: yearHigh || price,
            yearLow: yearLow || price,
            marketCap: profile.mktCap,
            priceAvg50: 0,
            priceAvg200: 0,
            volume: volume,
            avgVolume: profile.volAvg,
            exchange: profile.exchangeShortName,
            open: open,
            previousClose: previousClose,
            eps: 0,
            pe: 0,
            earningsAnnouncement: '',
            sharesOutstanding: 0,
            timestamp: Date.now() / 1000,
            source: source
        };
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
