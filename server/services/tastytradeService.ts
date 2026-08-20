// using native fetch
import { TastytradeAdapter, UnifiedPosition } from './brokerAdapter';

// Cache structure for the access token
let cachedAccessToken: string | null = null;
let tokenExpirationTime: number = 0;

const TASTY_API_URL = 'https://api.tastyworks.com';

export const getTastyAccessToken = async (): Promise<string> => {
    // Check if token is cached and valid (added 30s buffer before expiration)
    if (cachedAccessToken && Date.now() < tokenExpirationTime - 30000) {
        return cachedAccessToken;
    }

    // dynamically access tokens to prevent ES6 import hoisting from bypassing dotenv configurations.
    const refreshToken = process.env.TASTY_REFRESH_TOKEN;
    const clientSecret = process.env.TASTY_CLIENT_SECRET;

    if (!refreshToken || !clientSecret) {
        throw new Error("Missing Tastytrade OAuth2 credentials in environment (TASTY_REFRESH_TOKEN or TASTY_CLIENT_SECRET).");
    }

    try {
        // We use native fetch starting from Node 18+; if it's an older node we'd need node-fetch, but standard Next.js / modern Node environments support global fetch
        const response = await fetch(`${TASTY_API_URL}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Antigravity/1.0'
            },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_secret: clientSecret
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to authenticate with OAuth2: ${response.status} - ${errorText}`);
        }

        const data: any = await response.json();

        cachedAccessToken = data.access_token;
        // Data contains "expires_in" dynamically or we default to 15m (900s)
        const expiresIn = data.expires_in || 900;
        tokenExpirationTime = Date.now() + (expiresIn * 1000);

        return cachedAccessToken!;
    } catch (error) {
        console.error("Error obtaining Tastytrade Access Token:", error);
        throw error;
    }
};

export const fetchTastyPositions = async (accountNumber?: string): Promise<UnifiedPosition[]> => {
    const accNumber = accountNumber || process.env.TASTY_ACCOUNT_NUMBER;

    if (!accNumber) {
        throw new Error("Missing Tastytrade Account Number. Must be passed or defined in env.");
    }

    const token = await getTastyAccessToken();

    try {
        const response = await fetch(`${TASTY_API_URL}/accounts/${accNumber}/positions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'Antigravity/1.0'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch positions: ${response.status} - ${errorText}`);
        }

        const data: any = await response.json();
        // The API wraps items in data.items
        const items = data?.data?.items || [];

        // Map to standard Unified Position
        return items.map((pos: any) => TastytradeAdapter.toUnified(pos));
    } catch (error) {
        console.error("Error fetching Tastytrade Positions:", error);
        throw error;
    }
};
