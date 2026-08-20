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
