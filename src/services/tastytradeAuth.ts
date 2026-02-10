const API_URL = 'http://localhost:3000/api';

export interface TastytradeUser {
    'external-id': string;
    username: string;
    email: string;
}

export const tastytradeAuthService = {
    login: async (username: string, password: string, isSandbox: boolean = false): Promise<{ success: boolean; user?: TastytradeUser; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/tastytrade/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, isSandbox }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // We don't need to store the token here if the backend proxy handles it for subsequent calls.
            // But typically we might want to know *if* we are logged in.
            // For this simple proxy setup, the backend state variable `tastySessionToken` is the source of truth.
            // We can just return success.
            return { success: true, user: data.user };
        } catch (error: any) {
            console.error('Tastytrade login error:', error);
            return { success: false, error: error.message };
        }
    },

    // Helper to check if backend thinks we are authenticated (optional, better to just try fetch)
    isAuthenticated: async (): Promise<boolean> => {
        // We could add a /status endpoint check on the proxy, but valid session check is complex without call.
        // Attempting to fetch accounts is a good proxy for "is authenticated".
        try {
            const response = await fetch(`${API_URL}/tastytrade/accounts`);
            return response.ok;
        } catch {
            return false;
        }
    }
};
