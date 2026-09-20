import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api';

export interface IBKRStatus {
    connected: boolean;
}

export interface DBHolding {
    id: string;
    brokerId: string;
    brokerSpecificId: string;
    symbol: string;
    assetType: string;
    description: string | null;
    quantity: number;
    averageCost: number;
    currentPrice: number;
    marketValue: number;
    dayPnL: number;
    dayPnLPercent: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    strikePrice: number | null;
    expiryDate: string | null;
    optionType: string | null;
    underlyingSymbol: string | null;
    updatedAt: string;
    broker?: {
        name: string;
        status: string;
    };
}

export const fetchStatus = async (): Promise<IBKRStatus> => {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
};

export const fetchPortfolio = async (): Promise<DBHolding[]> => {
    const response = await fetch(`${API_BASE}/portfolio`);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
};

export const useIBKRStatus = () => {
    return useQuery({
        queryKey: ['ibkrStatus'],
        queryFn: fetchStatus,
        refetchInterval: 5000,
    });
};

export const useIBKRPortfolio = () => {
    return useQuery({
        queryKey: ['ibkrPortfolio'],
        queryFn: fetchPortfolio,
        refetchInterval: 2000, // Frequent updates for live positions
    });
};

export interface IBKRClientPortalStatus {
    connected: boolean;
    authenticated: boolean;
    gatewayUrl: string;
    environment: string;
    paperAccountId: string;
    lastTickleTimestamp: string | null;
    lastHeartbeatSuccess: boolean;
    tickleIntervalMs: number;
    heartbeatActive: boolean;
    serverTime?: number;
    error?: string;
}

export const fetchIBKRClientPortalStatus = async (): Promise<IBKRClientPortalStatus> => {
    const response = await fetch(`${API_BASE}/ibkr/status`);
    if (!response.ok) {
        throw new Error('Failed to fetch IBKR Client Portal status');
    }
    return response.json();
};

export const triggerIBKRTickle = async (): Promise<{ success: boolean; session: any }> => {
    const response = await fetch(`${API_BASE}/ibkr/tickle`, { method: 'POST' });
    if (!response.ok) {
        throw new Error('Failed to send tickle heartbeat');
    }
    return response.json();
};

export const useIBKRClientPortalStatus = () => {
    return useQuery({
        queryKey: ['ibkrClientPortalStatus'],
        queryFn: fetchIBKRClientPortalStatus,
        refetchInterval: 15000, // Query backend session status every 15s
    });
};

export const fetchIBKRAccounts = async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE}/ibkr/accounts`);
    if (!response.ok) {
        throw new Error('Failed to fetch IBKR accounts');
    }
    return response.json();
};

export const useIBKRAccounts = () => {
    return useQuery({
        queryKey: ['ibkrAccounts'],
        queryFn: fetchIBKRAccounts,
        staleTime: 60000,
    });
};

export const fetchIBKRSummary = async (accountId?: string): Promise<any> => {
    const url = accountId ? `${API_BASE}/ibkr/summary?accountId=${encodeURIComponent(accountId)}` : `${API_BASE}/ibkr/summary`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch IBKR account summary');
    }
    return response.json();
};

export const useIBKRSummary = (accountId?: string) => {
    return useQuery({
        queryKey: ['ibkrSummary', accountId],
        queryFn: () => fetchIBKRSummary(accountId),
        refetchInterval: 30000,
    });
};

