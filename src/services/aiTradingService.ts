import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/ai-trading';

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  last_equity: string;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  avg_entry_price: string;
  qty: string;
  side: 'long' | 'short';
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price: string;
  change_today: string;
}

export interface AlpacaOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty?: string;
  filled_qty?: string;
  filled_avg_price?: string;
  type: string;
  status: string;
  submitted_at: string;
  filled_at?: string;
  limit_price?: string;
}

export interface AiTradingSettings {
  accountMode: 'PAPER' | 'LIVE';
  masterKillSwitch: boolean;
  sizingMode: 'FIXED_DOLLAR' | 'PERCENT_OF_PORTFOLIO' | 'FIXED_SHARES';
  fixedDollarAmount: number;
  portfolioPercent: number;
  fixedShares: number;
  maxSinglePositionDollar: number;
  maxOpenPositions: number;
  maxDailyLossDollar?: number;
  executionMode: 'MANUAL_APPROVAL' | 'AUTOMATED';
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  trailingStopPercent?: number;
  updatedAt: string;
}

export interface DeployedStrategy {
  id: string;
  name: string;
  symbol: string;
  strategyType: string;
  isActive: boolean;
  timeframe: '1Day' | '1Hour';
  parameters: Record<string, any>;
  userPositionSizeDollar: number;
  winRateBacktest: number;
  totalReturnBacktest: number;
  deployedAt: string;
  lastEvaluatedAt?: string;
  lastSignal?: {
    action: 'BUY' | 'SELL' | 'HOLD';
    reason: string;
    timestamp: string;
  };
}

export interface PendingTradeSignal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  currentPrice: number;
  targetShares: number;
  targetDollarValue: number;
  sizingRule: string;
  reason: string;
  confidenceScore: number;
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'DISMISSED' | 'EXECUTED';
}

export interface BacktestResult {
  symbol: string;
  strategyName: string;
  strategyType: string;
  timeframe: string;
  periodStart: string;
  periodEnd: string;
  initialCapital: number;
  finalCapital: number;
  totalReturnPercent: number;
  benchmarkReturnPercent: number;
  alphaPercent: number;
  annualizedReturnPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPercent: number;
  winRatePercent: number;
  profitFactor: number;
  expectancyDollar: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgHoldingDays: number;
  equityCurve: {
    date: string;
    strategyEquity: number;
    benchmarkEquity: number;
    drawdownPercent: number;
  }[];
  trades: {
    id: string;
    symbol: string;
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    shares: number;
    dollarInvested: number;
    pnl: number;
    pnlPercent: number;
    exitReason: string;
    holdingDays: number;
  }[];
  parametersUsed: Record<string, any>;
  thesisSummary: string;
}

// 1. Status & Account Queries
export function useAlpacaStatus() {
  return useQuery({
    queryKey: ['alpaca-status'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error('Failed to fetch Alpaca status');
      return res.json();
    },
    refetchInterval: 15000,
  });
}

export function useAlpacaAccount() {
  return useQuery<AlpacaAccount>({
    queryKey: ['alpaca-account'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/account`);
      if (!res.ok) throw new Error('Failed to fetch Alpaca account');
      return res.json();
    },
    refetchInterval: 10000,
  });
}

export function useAlpacaPositions() {
  return useQuery<AlpacaPosition[]>({
    queryKey: ['alpaca-positions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/positions`);
      if (!res.ok) throw new Error('Failed to fetch positions');
      return res.json();
    },
    refetchInterval: 10000,
  });
}

export function useAlpacaOrders(status: 'open' | 'closed' | 'all' = 'all') {
  return useQuery<AlpacaOrder[]>({
    queryKey: ['alpaca-orders', status],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/orders?status=${status}`);
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    },
    refetchInterval: 15000,
  });
}

// 2. Settings & Guardrails
export function useAiTradingSettings() {
  return useQuery<AiTradingSettings>({
    queryKey: ['ai-trading-settings'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });
}

export function useUpdateAiTradingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<AiTradingSettings>) => {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-trading-settings'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-status'] });
    },
  });
}

// 3. Deployed Strategies
export function useDeployedStrategies() {
  return useQuery<DeployedStrategy[]>({
    queryKey: ['deployed-strategies'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/strategies`);
      if (!res.ok) throw new Error('Failed to fetch deployed strategies');
      return res.json();
    },
  });
}

export function useDeployStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      symbol: string;
      strategyType: string;
      parameters?: Record<string, any>;
      timeframe?: '1Day' | '1Hour';
      winRateBacktest?: number;
      totalReturnBacktest?: number;
    }) => {
      const res = await fetch(`${API_BASE}/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to deploy strategy');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployed-strategies'] });
    },
  });
}

export function useToggleStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active?: boolean }) => {
      const res = await fetch(`${API_BASE}/strategies/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error('Failed to toggle strategy');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployed-strategies'] });
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/strategies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete strategy');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployed-strategies'] });
    },
  });
}

// 4. Pending Signals
export function usePendingSignals() {
  return useQuery<PendingTradeSignal[]>({
    queryKey: ['pending-signals'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/signals`);
      if (!res.ok) throw new Error('Failed to fetch pending signals');
      return res.json();
    },
    refetchInterval: 10000,
  });
}

export function useApproveSignal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (signalId: string) => {
      const res = await fetch(`${API_BASE}/signals/${signalId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve signal');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-signals'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-positions'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-orders'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-account'] });
    },
  });
}

export function useDismissSignal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (signalId: string) => {
      const res = await fetch(`${API_BASE}/signals/${signalId}/dismiss`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to dismiss signal');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-signals'] });
    },
  });
}

// 5. Orders & Positions Management
export function useClosePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ symbol, qty }: { symbol: string; qty?: number }) => {
      let url = `${API_BASE}/positions/${symbol}`;
      if (qty) url += `?qty=${qty}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to close position');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alpaca-positions'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-account'] });
    },
  });
}

export function useLiquidateAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/positions/liquidate-all`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to liquidate positions');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alpaca-positions'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-orders'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-account'] });
    },
  });
}

export function useSubmitManualOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      symbol: string;
      side: 'buy' | 'sell';
      type?: 'market' | 'limit';
      limit_price?: number;
      requestedShares?: number;
    }) => {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit order');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alpaca-positions'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-orders'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-account'] });
    },
  });
}

// 6. Backtest & AI Discovery
export function useRunBacktest() {
  return useMutation({
    mutationFn: async (params: {
      symbol: string;
      strategyType: string;
      timeframe?: '1Day' | '1Hour';
      lookbackDays?: number;
      initialCapital?: number;
      positionSizeDollar?: number;
      parameters?: Record<string, any>;
    }): Promise<BacktestResult> => {
      const res = await fetch(`${API_BASE}/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backtest failed');
      return data;
    },
  });
}

export function useAiDiscoverStrategy() {
  return useMutation({
    mutationFn: async (params: {
      symbol: string;
      objectivePrompt?: string;
      lookbackDays?: number;
      timeframe?: '1Day' | '1Hour';
    }): Promise<{
      strategyHypothesis: {
        name: string;
        hypothesis: string;
        rationale: string;
        suggestedIndicators: string[];
        targetArchetype: string;
      };
      backtestResult: BacktestResult;
    }> => {
      const res = await fetch(`${API_BASE}/backtest/ai-discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI strategy discovery failed');
      return data;
    },
  });
}

export function useScanStrategies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
      if (!res.ok) throw new Error('Scan failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-signals'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-positions'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-orders'] });
      queryClient.invalidateQueries({ queryKey: ['deployed-strategies'] });
    },
  });
}
