import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api';

export const fetchResearchDossier = async (ticker: string) => {
    const response = await fetch(`${API_BASE}/research/dossier/${ticker}`);
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch research dossier');
    }
    return response.json();
};

export const useResearchDossier = (ticker: string) => {
    return useQuery({
        queryKey: ['researchDossier', ticker],
        queryFn: () => fetchResearchDossier(ticker),
        enabled: Boolean(ticker && ticker.trim().length > 0),
        retry: 1,
        staleTime: 60 * 1000 // 1 minute
    });
};

export const fetchAIAnalysis = async (ticker: string) => {
    const response = await fetch(`${API_BASE}/research/analyze/${ticker}`);
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch AI analysis');
    }
    return response.json();
};

export const useAIAnalysis = (ticker: string) => {
    return useQuery({
        queryKey: ['aiAnalysis', ticker],
        queryFn: () => fetchAIAnalysis(ticker),
        enabled: Boolean(ticker && ticker.trim().length > 0),
        retry: 0,
        staleTime: 5 * 60 * 1000 // 5 minutes, since it costs API tokens
    });
};
