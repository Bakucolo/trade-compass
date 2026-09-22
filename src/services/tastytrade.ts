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

export interface TastytradeStatus {
    connected: boolean;
    user?: TastytradeUser;
    accountNumber?: string;
}

export const fetchTastytradeStatus = async (): Promise<TastytradeStatus> => {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) {
        return { connected: false };
    }
    return response.json();
};

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
    return data.items || data.data || [];
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

export const useTastytradeStatus = () => {
    return useQuery<TastytradeStatus>({
        queryKey: ['tastytradeStatus'],
        queryFn: fetchTastytradeStatus,
        refetchInterval: 10000,
    });
};

export interface StagedDraftOrder {
    draftId: string;
    broker?: 'tastytrade' | 'alpaca' | 'ibkr';
    accountNumber: string;
    createdAt: string;
    expiresAt: string;
    status: 'PENDING_APPROVAL' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
    symbol: string;
    action: 'BUY_TO_OPEN' | 'SELL_TO_CLOSE' | 'BUY' | 'SELL' | 'SELL_TO_OPEN' | 'BUY_TO_CLOSE';
    instrumentType: 'Equity' | 'Equity Option';
    quantity: number;
    orderType: 'Limit' | 'Market';
    price?: number;
    timeInForce: 'Day' | 'GTC';
    optionDetails?: {
        expirationDate: string;
        strikePrice: number;
        optionType: 'Call' | 'Put';
    };
    notes?: string;
    dryRunResult?: {
        estimatedMarginRequirement?: number;
        buyingPowerEffect?: number;
        estimatedCommission?: number;
        estimatedFees?: number;
        warnings?: string[];
    };
    executionResult?: {
        orderId?: string | number;
        executedAt?: string;
        status?: string;
    };
    buyingPowerComparison?: BuyingPowerComparisonResult;
}

export interface BrokerMarginImpact {
    broker: 'tastytrade' | 'ibkr';
    accountNumber: string;
    environment?: string;
    currency: string;
    baseCurrency?: string;
    fxRateToBase?: number;
    totalAvailableBuyingPower: number;
    availableBuyingPowerBase?: number;
    buyingPowerRequirement: number;
    buyingPowerRequirementBase?: number;
    initialMarginRequirement: number;
    initialMarginRequirementBase?: number;
    maintenanceMarginRequirement: number;
    maintenanceMarginRequirementBase?: number;
    portfolioMarginRequirement?: number;
    portfolioMarginRequirementBase?: number;
    buyingPowerEffect?: number;
    buyingPowerEffectBase?: number;
    marginMethod?: string;
    estimatedCommission: number;
    estimatedRegulatoryFees: number;
    totalFees: number;
    totalCashOutlay: number;
    postTradeAvailableBuyingPower: number;
    postTradeBuyingPowerBase?: number;
    remainingBufferPercentage: number;
    isFeasible: boolean;
    warnings: string[];
    features?: string[];
}

export interface TastytradeMetrics {
    pop: number; // Probability of Profit (%)
    ext: number; // Extrinsic value ($)
    p50: number; // Probability of 50% Profit (%)
    cvar: number; // Conditional Value at Risk ($)
    delta: number; // Position delta
    theta: number; // Position theta ($/day)
    gamma?: number; // Position gamma
    vega?: number; // Position vega
    maxProfit: number | 'Unlimited'; // Max profit ($)
    maxLoss: number | 'Undefined'; // Max loss ($)
    bpEff: number; // Buying power effect ($)
    bpEffDirection: 'db' | 'cr'; // debit or credit
}

export interface BuyingPowerComparisonResult {
    symbol: string;
    action: string;
    quantity: number;
    price?: number;
    orderType: string;
    instrumentType: string;
    underlyingPrice?: number;
    tastytrade: BrokerMarginImpact;
    ibkr: BrokerMarginImpact;
    tastyMetrics?: TastytradeMetrics;
    verdict: {
        recommendedBroker: 'tastytrade' | 'ibkr' | 'either';
        capitalEfficiencyWinner: 'tastytrade' | 'ibkr' | 'equal';
        feeWinner: 'tastytrade' | 'ibkr' | 'equal';
        buyingPowerDifference: number;
        feeDifference: number;
        summary: string;
        rationale: string[];
    };
    calculatedAt: string;
}

export const analyzeBuyingPower = async (params: {
    draftId?: string;
    symbol?: string;
    action?: string;
    quantity?: number;
    price?: number;
    orderType?: string;
    instrumentType?: string;
    optionDetails?: {
        expirationDate: string;
        strikePrice: number;
        optionType: 'Call' | 'Put';
    };
    underlyingPrice?: number;
    impliedVolatility?: number;
    delta?: number;
    theta?: number;
    gamma?: number;
    vega?: number;
    daysToExpiration?: number;
}): Promise<{ success: boolean; comparison: BuyingPowerComparisonResult }> => {
    const response = await fetch('/api/ai-trading/analyze-buying-power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed to analyze buying power (${response.status})`);
    }
    return response.json();
};

export const switchDraftBroker = async (
    draftId: string,
    targetBroker: 'tastytrade' | 'ibkr' | 'alpaca'
): Promise<{ success: boolean; draft: StagedDraftOrder }> => {
    const response = await fetch(`/api/ai-trading/drafts/${draftId}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: targetBroker }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed to switch broker (${response.status})`);
    }
    return response.json();
};

export const approveDraftOrder = async (
    draftId: string,
    overrides?: { price?: number; quantity?: number }
): Promise<{ success: boolean; draft: StagedDraftOrder; orderId?: string | number }> => {
    const response = await fetch(`${API_BASE}/orders/execute-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, ...overrides })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed to execute trade (status ${response.status})`);
    }
    return response.json();
};

export const cancelDraftOrder = async (draftId: string): Promise<{ success: boolean; draft: StagedDraftOrder }> => {
    const response = await fetch(`${API_BASE}/orders/cancel-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed to cancel draft (status ${response.status})`);
    }
    return response.json();
};

export const fetchTastyEnvironment = async (): Promise<{
    baseUrl: string;
    isSandbox: boolean;
    accountNumber: string;
    authenticated: boolean;
    environment: string;
}> => {
    const response = await fetch(`${API_BASE}/environment`);
    if (!response.ok) throw new Error('Failed to fetch Tastytrade environment');
    return response.json();
};

export interface FormattedOptionStrike {
    strike: number;
    formattedStrike: string;
    callSymbol: string;
    callName: string;
    putSymbol: string;
    putName: string;
    callPrice?: number;
    putPrice?: number;
    isAtm?: boolean;
}

export interface FormattedOptionExpiration {
    expirationDate: string;
    dte: number;
    strikes: FormattedOptionStrike[];
}

export interface FormattedOptionChain {
    symbol: string;
    underlyingPrice?: number;
    expirations: FormattedOptionExpiration[];
}

export interface CreateDraftOrderParams {
    symbol: string;
    action: string;
    broker?: 'tastytrade' | 'alpaca' | 'ibkr';
    instrumentType?: 'Equity' | 'Equity Option';
    quantity: number;
    orderType: 'Limit' | 'Market';
    price?: number;
    timeInForce?: 'Day' | 'GTC';
    optionDetails?: {
        expirationDate: string;
        strikePrice: number;
        optionType: 'Call' | 'Put';
    };
    notes?: string;
}

export const createDraftOrder = async (
    params: CreateDraftOrderParams
): Promise<{ success: boolean; draft: StagedDraftOrder }> => {
    const response = await fetch('/api/ai-trading/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create draft order (${response.status})`);
    }
    return response.json();
};

