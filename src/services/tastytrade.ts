import { useMutation, useQuery } from '@tanstack/react-query';

const API_BASE = '/api/tastytrade';

export interface TastytradeUser {
    username: string;
    email: string;
}

export interface TastytradeAccount {
    account: {
        'account-number': string;
        nickname: string;
    };
    'authority-level': string;
}

export const loginToTastytrade = async (credentials: { username: string; password: string; isSandbox?: boolean }) => {
    const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
    }

    return response.json();
};

export const fetchAccounts = async (): Promise<TastytradeAccount[]> => {
    const response = await fetch(`${API_BASE}/accounts`);
    if (!response.ok) throw new Error('Failed to fetch accounts');
    const data = await response.json();
    return data.items;
};

export const fetchPositions = async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE}/positions/default`);
    if (!response.ok) throw new Error('Failed to fetch positions');
    const data = await response.json();
    return data.data;
};

export const useTastytradeLogin = () => {
    return useMutation({
        mutationFn: loginToTastytrade,
    });
};

export const useTastytradeAccounts = (enabled: boolean) => {
    return useQuery({
        queryKey: ['tastytradeAccounts'],
        queryFn: fetchAccounts,
        enabled,
    });
};

export const useTastytradePositions = () => {
    return useQuery({
        queryKey: ['tastytradePositions'],
        queryFn: fetchPositions,
        retry: false,
    });
};
