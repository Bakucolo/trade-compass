import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api';

export interface IBKRStatus {
    connected: boolean;
}

export interface IBKRPosition {
    account: string;
    contract: {
        conId: number;
        symbol: string;
        secType: string;
        exchange: string;
        currency: string;
    };
    pos: number;
    avgCost: number;
}

export const fetchStatus = async (): Promise<IBKRStatus> => {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
};

export const fetchPortfolio = async (): Promise<IBKRPosition[]> => {
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
