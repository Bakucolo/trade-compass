const API_URL = '/api';

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

            // Store session token in localStorage for persistence
            if (data.sessionToken) {
                localStorage.setItem('tasty_session_token', data.sessionToken);
                localStorage.setItem('tasty_user', JSON.stringify(data.user));
            }

            return { success: true, user: data.user };
        } catch (error: any) {
            console.error('Tastytrade login error:', error);
            return { success: false, error: error.message };
        }
    },

    logout: () => {
        localStorage.removeItem('tasty_session_token');
        localStorage.removeItem('tasty_user');
    },

    // Restore session from localStorage
    restoreSession: async (): Promise<{ success: boolean; user?: TastytradeUser }> => {
        const token = localStorage.getItem('tasty_session_token');
        const userStr = localStorage.getItem('tasty_user');

        if (!token) return { success: false };

        try {
            const user = userStr ? JSON.parse(userStr) : undefined;

            // Sync with backend
            try {
                const response = await fetch(`${API_URL}/tastytrade/set-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: token, user })
                });

                if (!response.ok) {
                    throw new Error('Backend session sync failed');
                }
            } catch (e) {
                console.error("Failed to sync session with backend:", e);
                // If backend sync fails, we must consider the session invalid/lost
                // because the proxy needs the token to function.
                return { success: false };
            }

            return { success: true, user };
        } catch {
            return { success: false };
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
