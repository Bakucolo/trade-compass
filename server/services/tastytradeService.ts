// server/services/tastytradeService.ts
// Native fetch implementation with Tastytrade OpenAPI (Sandbox default)
import { TastytradeAdapter, UnifiedPosition } from './brokerAdapter';

// Cache structure for the access token
let cachedAccessToken: string | null = null;
let tokenExpirationTime: number = 0;

/**
 * Returns active Tastytrade Base URL, defaulting strictly to Sandbox (Certification environment)
 */
export const getTastyBaseUrl = (): string => {
    if (process.env.TASTY_BASE_URL) {
        return process.env.TASTY_BASE_URL;
    }
    // Auto-detect realm from refresh token JWT if present
    const refreshToken = process.env.TASTY_REFRESH_TOKEN;
    if (refreshToken && refreshToken.includes('.')) {
        try {
            const parts = refreshToken.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (payload.iss && payload.iss.includes('tastytrade.com')) {
                return 'https://api.tastytrade.com';
            }
        } catch { }
    }
    return 'https://api.cert.tastyworks.com';
};

/**
 * Checks if current environment is Sandbox
 */
export const isTastySandbox = (): boolean => {
    const url = getTastyBaseUrl();
    return url.includes('cert.tastyworks.com') || process.env.TASTY_ENV === 'sandbox';
};

/**
 * Returns sanitized config summary for UI and telemetry
 */
export const getTastyConfigSummary = () => {
    const baseUrl = getTastyBaseUrl();
    const isSandbox = isTastySandbox();
    const accNumber = process.env.TASTY_ACCOUNT_NUMBER || 'Not configured';
    const hasRefreshToken = !!process.env.TASTY_REFRESH_TOKEN;
    const hasSecret = !!process.env.TASTY_CLIENT_SECRET;

    return {
        baseUrl,
        isSandbox,
        accountNumber: accNumber,
        authenticated: hasRefreshToken && hasSecret,
        environment: isSandbox ? 'Certification Sandbox / Safety Mode' : 'Production (Live Trades)'
    };
};

export const getTastyAccessToken = async (): Promise<string> => {
    // Check if token is cached and valid (added 30s buffer before expiration)
    if (cachedAccessToken && Date.now() < tokenExpirationTime - 30000) {
        return cachedAccessToken;
    }

    const refreshToken = process.env.TASTY_REFRESH_TOKEN;
    const clientSecret = process.env.TASTY_CLIENT_SECRET;

    if (!refreshToken || !clientSecret) {
        throw new Error("Missing Tastytrade OAuth2 credentials in environment (TASTY_REFRESH_TOKEN or TASTY_CLIENT_SECRET).");
    }

    const baseUrl = getTastyBaseUrl();

    try {
        const response = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TradeCompass/1.0'
            },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_secret: clientSecret
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to authenticate with OAuth2 (${baseUrl}): ${response.status} - ${errorText}`);
        }

        const data: any = await response.json();

        cachedAccessToken = data.access_token;
        const expiresIn = data.expires_in || 900;
        tokenExpirationTime = Date.now() + (expiresIn * 1000);

        return cachedAccessToken!;
    } catch (error) {
        console.error(`Error obtaining Tastytrade Access Token (${baseUrl}):`, error);
        throw error;
    }
};

export const fetchTastyPositions = async (accountNumber?: string): Promise<UnifiedPosition[]> => {
    const accNumber = accountNumber || process.env.TASTY_ACCOUNT_NUMBER;

    if (!accNumber) {
        throw new Error("Missing Tastytrade Account Number. Must be passed or defined in env.");
    }

    const token = await getTastyAccessToken();
    const baseUrl = getTastyBaseUrl();

    try {
        const response = await fetch(`${baseUrl}/accounts/${accNumber}/positions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'TradeCompass/1.0'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch positions: ${response.status} - ${errorText}`);
        }

        const data: any = await response.json();
        const items = data?.data?.items || [];

        return items.map((pos: any) => TastytradeAdapter.toUnified(pos));
    } catch (error) {
        console.error("Error fetching Tastytrade Positions:", error);
        throw error;
    }
};

export const fetchTastyBalances = async (accountNumber?: string): Promise<any | null> => {
    const accNumber = accountNumber || process.env.TASTY_ACCOUNT_NUMBER;

    if (!accNumber) {
        return null;
    }

    try {
        const token = await getTastyAccessToken();
        const baseUrl = getTastyBaseUrl();
        const response = await fetch(`${baseUrl}/accounts/${accNumber}/balances`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'TradeCompass/1.0'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Tastytrade balances fetch returned non-200: ${response.status} - ${errorText}`);
            return null;
        }

        const data: any = await response.json();
        return data?.data || null;
    } catch (error) {
        console.warn("Error fetching Tastytrade Balances via OAuth2:", error);
        return null;
    }
};

export const fetchTastyAccountInfo = async (accountNumber?: string): Promise<any | null> => {
    const accNumber = accountNumber || process.env.TASTY_ACCOUNT_NUMBER;

    if (!accNumber) {
        return null;
    }

    try {
        const token = await getTastyAccessToken();
        const baseUrl = getTastyBaseUrl();
        const response = await fetch(`${baseUrl}/customers/me/accounts`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'TradeCompass/1.0'
            }
        });

        if (!response.ok) {
            return null;
        }

        const data: any = await response.json();
        const items = data?.data?.items || [];
        const match = items.find((item: any) => {
            const acct = item.account || item;
            return acct['account-number'] === accNumber;
        });
        return match ? (match.account || match) : null;
    } catch (error) {
        console.warn("Error fetching Tastytrade Account Info via OAuth2:", error);
        return null;
    }
};

/**
 * Fetch nested option chain for an underlying symbol
 */
export const fetchTastyOptionChain = async (symbol: string): Promise<any | null> => {
    const cleanSymbol = symbol.trim().toUpperCase().replace('$', '');
    try {
        const token = await getTastyAccessToken();
        const baseUrl = getTastyBaseUrl();
        const response = await fetch(`${baseUrl}/option-chains/${cleanSymbol}/nested`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'TradeCompass/1.0'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Option chain fetch failed for ${cleanSymbol}: ${response.status} - ${errorText}`);
            return null;
        }

        const data: any = await response.json();
        return data?.data?.items || data?.data || null;
    } catch (error) {
        console.warn(`Error fetching option chain for ${symbol}:`, error);
        return null;
    }
};

/**
 * Fetch market metrics (implied volatility, IV rank, beta, liquidity)
 */
export const fetchTastyMarketMetrics = async (symbols: string[]): Promise<any | null> => {
    if (!symbols.length) return null;
    const cleanSymbols = symbols.map(s => s.trim().toUpperCase().replace('$', '')).join(',');
    try {
        const token = await getTastyAccessToken();
        const baseUrl = getTastyBaseUrl();
        const response = await fetch(`${baseUrl}/market-metrics?symbols=${encodeURIComponent(cleanSymbols)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'TradeCompass/1.0'
            }
        });

        if (!response.ok) {
            return null;
        }

        const data: any = await response.json();
        return data?.data?.items || data?.data || null;
    } catch (error) {
        console.warn(`Error fetching market metrics for ${cleanSymbols}:`, error);
        return null;
    }
};

/**
 * Fetch orders for account (live, queued, or filled)
 */
export const fetchTastyOrders = async (accountNumber?: string, status?: string): Promise<any[]> => {
    const accNumber = accountNumber || process.env.TASTY_ACCOUNT_NUMBER;
    if (!accNumber) return [];

    try {
        const token = await getTastyAccessToken();
        const baseUrl = getTastyBaseUrl();
        const url = status
            ? `${baseUrl}/accounts/${accNumber}/orders?status[]=${encodeURIComponent(status)}`
            : `${baseUrl}/accounts/${accNumber}/orders`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'TradeCompass/1.0'
            }
        });

        if (!response.ok) {
            return [];
        }

        const data: any = await response.json();
        return data?.data?.items || [];
    } catch (error) {
        console.warn("Error fetching Tastytrade orders:", error);
        return [];
    }
};

/**
 * Pre-flight dry run validation for an order payload.
 * Runs preflights without placing the order, estimating margin requirements & commissions.
 */
export const dryRunTastyOrder = async (accountNumber: string, orderPayload: any): Promise<any> => {
    const token = await getTastyAccessToken();
    const baseUrl = getTastyBaseUrl();

    const response = await fetch(`${baseUrl}/accounts/${accountNumber}/orders/dry-run`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'TradeCompass/1.0'
        },
        body: JSON.stringify(orderPayload)
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errMsg = data?.error?.message || `Dry run failed with status ${response.status}`;
        throw new Error(errMsg);
    }

    return data?.data || data;
};

/**
 * Submits live order to Tastytrade Open API.
 * CRITICAL: This MUST ONLY be called after explicit Human-in-the-Loop user approval.
 */
export const submitTastyOrder = async (accountNumber: string, orderPayload: any): Promise<any> => {
    if (isTastySandbox() && !process.env.TASTY_ALLOW_LIVE_ORDERS) {
        console.log(`[Tastytrade Safety Sandbox] Simulated trade order staged and validated in Sandbox mode for account ${accountNumber}`);
        return {
            id: `SANDBOX_${Math.floor(100000 + Math.random() * 900000)}`,
            status: 'Received (Sandbox Simulated)',
            order: {
                id: `SANDBOX_${Math.floor(100000 + Math.random() * 900000)}`,
                status: 'Received (Sandbox Simulated)',
                ...orderPayload
            }
        };
    }

    const token = await getTastyAccessToken();
    const baseUrl = getTastyBaseUrl();

    console.log(`[Tastytrade Order Execution] Submitting live order to ${baseUrl}/accounts/${accountNumber}/orders...`);

    const response = await fetch(`${baseUrl}/accounts/${accountNumber}/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'TradeCompass/1.0'
        },
        body: JSON.stringify(orderPayload)
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errMsg = data?.error?.message || `Order placement failed with status ${response.status}`;
        console.error(`[Tastytrade Order Execution Error] ${errMsg}`);
        throw new Error(errMsg);
    }

    console.log(`[Tastytrade Order Execution Success] Order ID:`, data?.data?.order?.id || data?.data?.id);
    return data?.data?.order || data?.data || data;
};
