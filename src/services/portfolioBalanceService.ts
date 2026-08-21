import { useQuery } from '@tanstack/react-query';

export interface DayTradingData {
  dayTradesRemaining?: number;
  dayTradesRemainingT1?: number;
  dayTradesRemainingT2?: number;
  dayTradesRemainingT3?: number;
  dayTradesRemainingT4?: number;
  isDayTrader?: boolean;
  dayTradingBuyingPower?: number;
}

export interface BrokerAccountBalance {
  name: string;
  status: 'connected' | 'disconnected' | 'active';
  accountNumber: string;
  accountType?: string;
  nickname?: string;
  currency?: string;
  netLiquidatingValue: number;
  cash: number;
  buyingPower: number;
  derivativeBuyingPower?: number;
  equityBuyingPower?: number;
  dayTradingBuyingPower?: number;
  availableFunds?: number;
  cashAvailableForWithdrawal?: number;
  excessLiquidity?: number;
  maintMargin?: number;
  initMargin?: number;
  regTMargin?: number;
  marginEquity?: number;
  equityWithLoanValue?: number;
  grossPositionValue?: number;
  regTEquity?: number;
  sma?: number;
  cushion?: number;
  marginUtilization?: number;
  leverage?: number;
  unrealizedPnL: number;
  dayPnL: number;
  realizedPnL?: number;
  realizedDayPnL?: number;
  realizedTodayPnL?: number;
  optionsCount: number;
  optionsValue: number;
  equitiesCount: number;
  equitiesValue: number;
  longDerivativeValue?: number;
  shortDerivativeValue?: number;
  longEquityValue?: number;
  shortEquityValue?: number;
  pendingCash?: number;
  openOrderReserve?: number;
  dayTrading?: DayTradingData;
  accruedCash?: number;
  accruedDividend?: number;
  rawMetrics?: Record<string, any>;
}

export interface PortfolioAllocation {
  ibkrSharePercent: number;
  tastySharePercent: number;
  optionsAllocationPercent: number;
  equitiesAllocationPercent: number;
  cashAllocationPercent: number;
}

export interface PortfolioBalancesData {
  total: {
    netLiquidatingValue: number;
    cash: number;
    buyingPower: number;
    unrealizedPnL: number;
    dayPnL: number;
    realizedPnL?: number;
    optionsCount: number;
    optionsValue: number;
    equitiesCount: number;
    equitiesValue: number;
    maintenanceMargin?: number;
    availableWithdrawal?: number;
    marginUtilization?: number;
    marginCushion?: number;
    allocation?: PortfolioAllocation;
  };
  brokers: {
    ibkr: BrokerAccountBalance;
    tastytrade: BrokerAccountBalance;
  };
}

export const fetchPortfolioBalances = async (): Promise<PortfolioBalancesData> => {
  const response = await fetch('/api/portfolio/balances');
  if (!response.ok) {
    throw new Error('Failed to fetch portfolio balances');
  }
  return response.json();
};

export const usePortfolioBalances = () => {
  return useQuery({
    queryKey: ['portfolioBalances'],
    queryFn: fetchPortfolioBalances,
    refetchInterval: 4000,
  });
};

