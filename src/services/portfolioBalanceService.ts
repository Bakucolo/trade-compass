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
  netLiquidatingValueGBP?: number;
  cashGBP?: number;
  investedGBP?: number;
  unrealizedPnLGBP?: number;
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

export interface CurrencyBalance {
  currency: string;
  cash: number;
  positionsMarketValue: number;
  unrealizedPnL: number;
  fxRateToUSD: number;
  cashUSD: number;
  positionsMarketValueUSD: number;
  unrealizedPnLUSD: number;
  netLiqUSD: number;
  holdingsCount: number;
}

export interface IBKRAccountDetails extends BrokerAccountBalance {
  accountKey: string; // e.g. 'account1', 'account2', or specific account number
  baseCurrency: string;
  currencies: Record<string, CurrencyBalance>;
}

export interface IBKRCombinedBalance extends BrokerAccountBalance {
  accounts: IBKRAccountDetails[];
  currencies: Record<string, CurrencyBalance>;
}

export interface PortfolioAllocation {
  ibkrSharePercent: number;
  tastySharePercent: number;
  trading212SharePercent?: number;
  optionsAllocationPercent: number;
  equitiesAllocationPercent: number;
  cashAllocationPercent: number;
}

export interface DualCurrencySummary {
  baseCurrency: string;
  comparisonCurrency: string;
  fxRateGbpUsd: number;
  fxRateUsdGbp: number;
  
  // USD Totals
  totalNetLiqUSD: number;
  totalCashUSD: number;
  totalPositionsValueUSD: number;
  totalBPUSD: number;
  totalUnrealizedPnLUSD: number;
  totalDayPnLUSD: number;

  // GBP Totals
  totalNetLiqGBP: number;
  totalCashGBP: number;
  totalPositionsValueGBP: number;
  totalBPGBP: number;
  totalUnrealizedPnLGBP: number;
  totalDayPnLGBP: number;

  // Native Holdings Breakdown
  nativeUsdHoldingsUSD: number;
  nativeUsdHoldingsGBP: number;
  nativeGbpHoldingsGBP: number;
  nativeGbpHoldingsUSD: number;
  nativeUsdCashUSD: number;
  nativeUsdCashGBP: number;
  nativeGbpCashGBP: number;
  nativeGbpCashUSD: number;
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
  dualCurrency?: DualCurrencySummary;
  currencies?: Record<string, CurrencyBalance>;
  brokers: {
    ibkr: IBKRCombinedBalance;
    tastytrade: BrokerAccountBalance;
    trading212?: BrokerAccountBalance;
  };
}

export type PortfolioBalancesResponse = PortfolioBalancesData;

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

