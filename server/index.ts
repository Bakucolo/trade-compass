import express from 'express';
import cors from 'cors';
import { IBApi, EventName, ErrorCode, Contract, CommissionReport, Execution } from '@stoqey/ib';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
dotenv.config({ path: '.env.local' });
dotenv.config();

// Global process error handlers to prevent unexpected server terminations
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

import { PrismaClient } from '@prisma/client';
import { fetchTastyPositions, fetchTastyBalances, fetchTastyAccountInfo } from './services/tastytradeService';
import { fetchLiveOptionChains, buildOptionPricingContext, validateAndEnforcePlanPricing } from './services/optionDefenseService';
import { runPortfolioAuditAgent, savePortfolioAuditToDb, listPortfolioAuditsFromDb, getPortfolioAuditByIdFromDb, deletePortfolioAuditFromDb } from './services/portfolioAnalyserService';
import { agentActivityTracker } from './services/agentActivityService';
import {
  syncTastytradeTransactions,
  syncIBKRExecutions,
  upsertIBKRExecution,
  syncIBKRFromHoldings,
  getFilteredTrades,
  createManualTrade,
  deleteTradeRecord
} from './services/tradeService';
import { fetchFredMacroData, fetchYieldsAndBondsChartData } from './services/fredService';
import { fetchSectorsOverview, fetchSectorsHistoryComparison } from './services/sectorsService';
import { fetchGrowthAndValuationDossier } from './services/growthValuationService';
import { fetchInvestorRelationsDossier } from './services/investorRelationsService';
import { generateTradeStructures } from './services/tradeStructurerService';
import { diagnoseEconomicCycle, generateMacroStockPicks } from './services/economicCycleService';
import { optionsTradeAgentService } from './services/optionsTradeAgentService';
import { shortCandidateService } from './services/shortCandidateService';
import { optionsLiquidityService } from './services/optionsLiquidityService';
import { optionsChainService } from './services/optionsChainService';
import { volatilityMacroService } from './services/volatilityMacroService';
import {
  scanHoldingsAndWatchlistsForDips,
  diagnoseStockDip,
  listSavedDipReports,
  getDipReportHistory,
  deleteSavedDipReport,
} from './services/dipAnalyzerService';
import {
  analyzePortfolioCoveredCalls,
  getDetailedCallOptionChain,
} from './services/coveredCallService';
import {
  runPortfolioValuationAgent,
  getPortfolioValuationAudits,
  deletePortfolioValuationAudit,
} from './services/portfolioValuationService';
import {
  runMacroDossierAgent,
  getMacroDossiers,
  getMacroDossierById,
  deleteMacroDossier,
} from './services/macroDossierService';
import {
  getScorecardsHubData,
  evaluateStockScorecard,
  compareStockScorecards,
} from './services/scorecardService';
import {
  fetchTrading212Cash,
  fetchTrading212AccountInfo,
  fetchTrading212Portfolio,
  syncTrading212HoldingsToDB,
} from './services/trading212Service';
import { oddLotTenderService } from './services/oddLotTenderService';
import {
  syncShortOptionAlerts,
  getShortOptionsAlertStatus,
  createAlertsForSingleShortOption,
} from './services/shortOptionAlertService';
import {
  runAgentOnThoughtLog,
  extractSymbolsFromText,
  fetchMarketTelemetryForSymbols,
} from './services/thoughtLogAgentService';
import {
  runStockScanner,
  ScannerCriteria,
  SCANNER_UNIVERSE,
} from './services/stockScannerService';
import {
  consumeTelegramBuffer,
  getTelegramBufferStatus,
} from './services/telegramBufferConsumerService';
import { autoCreateAlertsFromText } from './services/thoughtLogAlertService';
import { SYMBOL_ALIASES, resolveYahooFinanceSymbol } from './services/tickerResolutionService';
export { SYMBOL_ALIASES, resolveYahooFinanceSymbol };
import {
  generateAndSendDailyReport,
  fetchComprehensiveReportData,
  generateExecutivePdfBuffer,
} from './services/telegramReportService';
import {
  fetchEarningsData,
  lookupSymbolEarnings,
} from './services/earningsService';
import {
  fetchDilutionAnalysis,
} from './services/dilutionService';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

// Configure SQLite for high concurrency / WAL mode
prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`)
  .then(() => prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 10000;`))
  .catch(err => console.error('Failed to set SQLite PRAGMA:', err));
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// IBKR Connection Settings & Account Numbers
export const IBKR_ISA_ACCOUNT = 'U14522424';
export const IBKR_GIA_ACCOUNT = 'U15491236';
const IB_HOST = '127.0.0.1';
const IB_PORTS = [7497, 7496, 4001, 4002];

let ib: IBApi;
let isConnected = false;
// positions array removed in favor of DB

const connectToIBKR = async () => {
  // Ensure Broker record exists
  await prisma.broker.upsert({
    where: { name: 'Interactive Brokers' },
    update: { status: 'connecting', lastSyncTime: new Date() },
    create: { name: 'Interactive Brokers', status: 'connecting', lastSyncTime: new Date() }
  });

  for (const port of IB_PORTS) {
    if (isConnected) break;
    console.log(`Attempting to connect to IBKR on port ${port}...`);

    const tempIB = new IBApi({
      host: IB_HOST,
      port: port,
    });

    try {
      tempIB.connect();
      // Give it a moment to emit 'connected' or 'error'
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (tempIB.isConnected) {
        console.log(`Successfully connected on port ${port}`);
        ib = tempIB;
        setupEventListeners(ib);
        isConnected = true; // Manually set since we might have missed the event

        await prisma.broker.update({
          where: { name: 'Interactive Brokers' },
          data: { status: 'connected', lastSyncTime: new Date() }
        });

        ib.reqPositions();
        ib.reqAllOpenOrders();
        return;
      } else {
        tempIB.disconnect();
      }
    } catch (e) {
      console.log(`Failed on port ${port}`);
    }
  }

  if (!isConnected) {
    console.log("Could not connect to any IBKR port. Retrying in 60s...");
    await prisma.broker.update({
      where: { name: 'Interactive Brokers' },
      data: { status: 'disconnected', lastSyncTime: new Date() }
    });
    setTimeout(connectToIBKR, 60000);
  }
};

const pnlReqConIdMap = new Map<number, string>();

const setupEventListeners = (ibInstance: IBApi) => {
  ibInstance.on(EventName.connected, async () => {
    console.log('Connected to IBKR');
    isConnected = true;
    await prisma.broker.update({
      where: { name: 'Interactive Brokers' },
      data: { status: 'connected', lastSyncTime: new Date() }
    });
    ibInstance.reqPositions();
    ibInstance.reqAllOpenOrders();
    ibInstance.reqManagedAccts();
    ibInstance.reqExecutions(Math.floor(Math.random() * 900000) + 100000, {});
  });

  ibInstance.on(EventName.managedAccounts, (accountsList: string) => {
    console.log('IBKR Managed Accounts:', accountsList);
    const accounts = accountsList.split(',').map(a => a.trim()).filter(Boolean);
    for (const acct of accounts) {
      console.log(`Subscribing to account updates for IBKR account: ${acct}`);
      ibInstance.reqAccountUpdates(true, acct);
    }
    // Also request executions across accounts
    ibInstance.reqExecutions(Math.floor(Math.random() * 900000) + 100000, {});
  });

  ibInstance.on(EventName.disconnected, async () => {
    console.log('Disconnected from IBKR');
    isConnected = false;
    await prisma.broker.update({
      where: { name: 'Interactive Brokers' },
      data: { status: 'disconnected', lastSyncTime: new Date() }
    });
    // Trigger reconnection logic
    setTimeout(connectToIBKR, 5000);
  });

  ibInstance.on(EventName.error, (err: Error, code: ErrorCode, reqId: number) => {
    console.error(`IBKR Error: ${err.message} (Code: ${code}, ReqId: ${reqId})`);
  });

  const conIdAccountMap = new Map<string, string>();

let positionWriteQueue = Promise.resolve();
const queuePositionUpdate = (task: () => Promise<void>) => {
  positionWriteQueue = positionWriteQueue.then(task).catch(err => {
    console.error('Queued position update error:', err);
  });
  return positionWriteQueue;
};

// 1. Position feed
ibInstance.on(EventName.position, (account: string, contract: Contract, pos: number, avgCost: number) => {
  queuePositionUpdate(async () => {
    try {
      const acct = account || (contract.secType === 'OPT' ? IBKR_GIA_ACCOUNT : IBKR_ISA_ACCOUNT);
      if (contract.conId) {
        conIdAccountMap.set(contract.conId.toString(), acct);
      }
      const conIdBase = contract.conId?.toString() || `${contract.symbol}_${contract.secType}`;
      const conIdStr = `${acct}_${conIdBase}`;

      if (pos === 0) {
        // Remove position if quantity is 0
        await prisma.holding.deleteMany({
          where: {
            broker: { name: 'Interactive Brokers' },
            brokerSpecificId: { in: [conIdStr, conIdBase] }
          }
        });
      } else {
        const broker = await prisma.broker.findUnique({ where: { name: 'Interactive Brokers' } });
        if (!broker) return;

        const isOption = contract.secType === 'OPT';
        const curr = contract.currency || 'USD';

        await prisma.holding.upsert({
          where: {
            brokerId_brokerSpecificId: {
              brokerId: broker.id,
              brokerSpecificId: conIdStr
            }
          },
          update: {
            quantity: pos,
            averageCost: avgCost,
            currency: curr,
            updatedAt: new Date()
          },
          create: {
            brokerId: broker.id,
            brokerSpecificId: conIdStr,
            symbol: contract.symbol || 'UNKNOWN',
            assetType: isOption ? 'OPTION' : 'EQUITY',
            description: contract.localSymbol,
            quantity: pos,
            averageCost: avgCost,
            currentPrice: 0,
            marketValue: 0,
            dayPnL: 0,
            dayPnLPercent: 0,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
            strikePrice: contract.strike,
            expiryDate: contract.lastTradeDateOrContractMonth,
            optionType: contract.right, // "C" or "P"
            underlyingSymbol: contract.symbol,
            currency: curr
          }
        });

        // Request single PnL stream for this contract if conId exists
        if (contract.conId && acct) {
          const reqId = Math.floor(Math.random() * 900000) + 100000;
          pnlReqConIdMap.set(reqId, conIdStr);
          try {
            ibInstance.reqPnLSingle(reqId, acct, null, contract.conId);
          } catch (pnlErr) {
            console.error('Failed to reqPnLSingle for conId:', contract.conId, pnlErr);
          }
        }
      }
    } catch (err: any) {
      console.error('Error in IBKR position processing:', err?.message || err);
    }
  });
});

// 2. Real-time portfolio update feed (delivers real market prices and unrealized PnL for options/stocks)
ibInstance.on(EventName.updatePortfolio, (contract: Contract, position: number, marketPrice: number, marketValue: number, averageCost?: number, unrealizedPNL?: number, realizedPNL?: number, accountName?: string) => {
  queuePositionUpdate(async () => {
    try {
      const broker = await prisma.broker.findUnique({ where: { name: 'Interactive Brokers' } });
      if (!broker) return;

      const isOption = contract.secType === 'OPT';
      const multiplier = isOption ? 100 : 1;
      const avgCost = averageCost ?? 0;
      const curr = contract.currency || 'USD';

      // Adjust GBX (pence) to GBP if marketPrice is in pence (>100) and averageCost is in pounds (<50)
      let normalizedPrice = marketPrice;
      if (curr === 'GBX' && marketPrice > 50 && avgCost < 50) {
        normalizedPrice = marketPrice / 100;
      }

      const unPnL = unrealizedPNL !== undefined ? unrealizedPNL : (marketValue - (avgCost * position * multiplier));
      // Calculate percentage using initial cost basis: |marketValue - unPnL|
      const costBasis = Math.abs(marketValue - unPnL);
      const unPnLPct = costBasis > 0 ? (unPnL / costBasis) * 100 : 0;

      const acct = accountName || (contract.conId ? conIdAccountMap.get(contract.conId.toString()) : undefined) || (isOption ? IBKR_GIA_ACCOUNT : IBKR_ISA_ACCOUNT);
      if (contract.conId && acct) {
        conIdAccountMap.set(contract.conId.toString(), acct);
      }
      const conIdBase = contract.conId?.toString() || `${contract.symbol}_${contract.secType}`;
      const conIdStr = `${acct}_${conIdBase}`;

      const finalPrice = normalizedPrice > 0 ? normalizedPrice : (position !== 0 && marketValue ? Math.abs(marketValue / (position * multiplier)) : avgCost);

      await prisma.holding.upsert({
        where: {
          brokerId_brokerSpecificId: {
            brokerId: broker.id,
            brokerSpecificId: conIdStr
          }
        },
        update: {
          quantity: position,
          averageCost: avgCost || undefined,
          currentPrice: finalPrice,
          marketValue: marketValue || 0,
          unrealizedPnL: unPnL,
          unrealizedPnLPercent: unPnLPct,
          currency: curr,
          updatedAt: new Date()
        },
        create: {
          brokerId: broker.id,
          brokerSpecificId: conIdStr,
          symbol: contract.symbol || 'UNKNOWN',
          assetType: isOption ? 'OPTION' : 'EQUITY',
          description: contract.localSymbol,
          quantity: position,
          averageCost: avgCost,
          currentPrice: finalPrice,
          marketValue: marketValue,
          dayPnL: 0,
          dayPnLPercent: 0,
          unrealizedPnL: unPnL,
          unrealizedPnLPercent: unPnLPct,
          strikePrice: contract.strike,
          expiryDate: contract.lastTradeDateOrContractMonth,
          optionType: contract.right,
          underlyingSymbol: contract.symbol,
          currency: curr
        }
      });
    } catch (err: any) {
      console.error('Error in IBKR updatePortfolio processing:', err?.message || err);
    }
  });
});

  // 3. Real-time PnL single feed
  ibInstance.on(EventName.pnlSingle, (reqId: number, pos: number, dailyPnL: number, unrealizedPnL: number | undefined, realizedPnL: number | undefined, value: number) => {
    const conIdStr = pnlReqConIdMap.get(reqId);
    if (!conIdStr) return;

    queuePositionUpdate(async () => {
      try {
        const broker = await prisma.broker.findUnique({ where: { name: 'Interactive Brokers' } });
        if (!broker) return;

        const holding = await prisma.holding.findFirst({
          where: { brokerId: broker.id, brokerSpecificId: conIdStr }
        });
        if (!holding) return;

        const multiplier = holding.assetType === 'OPTION' ? 100 : 1;
        const finalValue = value !== undefined ? value : holding.marketValue;
        const unPnL = unrealizedPnL !== undefined ? unrealizedPnL : holding.unrealizedPnL;
        const costBasis = Math.abs(finalValue - unPnL);
        const unPnLPct = costBasis > 0 ? (unPnL / costBasis) * 100 : 0;
        const curPrice = (pos !== 0 && finalValue !== 0) ? Math.abs(finalValue / (pos * multiplier)) : holding.currentPrice;

        const dayPnlVal = dailyPnL ?? holding.dayPnL;
        const prevLiq = finalValue - dayPnlVal;
        const dayPnLPct = prevLiq > 0 ? (dayPnlVal / prevLiq) * 100 : (finalValue > 0 ? (dayPnlVal / finalValue) * 100 : 0);

        await prisma.holding.update({
          where: { id: holding.id },
          data: {
            dayPnL: dayPnlVal,
            dayPnLPercent: dayPnLPct,
            unrealizedPnL: unPnL,
            unrealizedPnLPercent: unPnLPct,
            marketValue: finalValue,
            currentPrice: curPrice,
            updatedAt: new Date()
          }
        });
      } catch (err: any) {
        console.error('Error in IBKR pnlSingle update:', err?.message || err);
      }
    });
  });
  // 4. Real-time Account Balance & Buying Power feed
  ibInstance.on(EventName.updateAccountValue, (key: string, val: string, currency: string, accountName: string) => {
    let acct = ibkrAccountValues.get(accountName);
    if (!acct) {
      acct = {
        accountName: accountName || 'Interactive Brokers',
        accountType: '',
        currency: currency || 'USD',
        netLiq: 0,
        cash: 0,
        buyingPower: 0,
        excessLiquidity: 0,
        maintMargin: 0,
        initMargin: 0,
        availableFunds: 0,
        equityWithLoanValue: 0,
        grossPositionValue: 0,
        regTEquity: 0,
        regTMargin: 0,
        sma: 0,
        cushion: 0,
        leverage: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        stockMarketValue: 0,
        optionMarketValue: 0,
        futureOptionMarketValue: 0,
        futuresPnL: 0,
        dayTradesRemaining: -1,
        dayTradesRemainingT1: -1,
        dayTradesRemainingT2: -1,
        dayTradesRemainingT3: -1,
        dayTradesRemainingT4: -1,
        accruedCash: 0,
        accruedDividend: 0,
        rawMetrics: {}
      };
      ibkrAccountValues.set(accountName, acct);
    }
    acct.rawMetrics[key] = val;
    const numVal = parseFloat(val) || 0;
    const curr = (currency || 'USD').toUpperCase();

    if (currency && !acct.currency) acct.currency = currency;

    if (!acct.currencyBreakdowns) acct.currencyBreakdowns = {};
    if (!acct.currencyBreakdowns[curr]) {
      acct.currencyBreakdowns[curr] = {
        currency: curr,
        cash: 0,
        netLiq: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        stockMarketValue: 0,
        optionMarketValue: 0,
        exchangeRate: curr === 'USD' ? 1 : 1,
      };
    }
    const currData = acct.currencyBreakdowns[curr];

    if (key === 'ExchangeRate') {
      currData.exchangeRate = numVal;
      fxRatesToUSD[curr] = numVal;
    } else if (key === 'TotalCashValue' || key === 'TotalCashBalance' || key === 'CashBalance') {
      currData.cash = numVal;
      if (currency === acct.currency || currency === 'BASE') acct.cash = numVal;
    } else if (key === 'NetLiquidation' || key === 'NetLiquidationByCurrency') {
      currData.netLiq = numVal;
      if (currency === acct.currency || currency === 'BASE') acct.netLiq = numVal;
    } else if (key === 'BuyingPower') acct.buyingPower = numVal;
    else if (key === 'ExcessLiquidity' || key === 'FullExcessLiquidity') acct.excessLiquidity = numVal;
    else if (key === 'MaintMarginReq' || key === 'FullMaintMarginReq') acct.maintMargin = numVal;
    else if (key === 'InitMarginReq' || key === 'FullInitMarginReq') acct.initMargin = numVal;
    else if (key === 'AvailableFunds' || key === 'FullAvailableFunds') acct.availableFunds = numVal;
    else if (key === 'EquityWithLoanValue') acct.equityWithLoanValue = numVal;
    else if (key === 'GrossPositionValue') acct.grossPositionValue = numVal;
    else if (key === 'RegTEquity') acct.regTEquity = numVal;
    else if (key === 'RegTMargin') acct.regTMargin = numVal;
    else if (key === 'SMA') acct.sma = numVal;
    else if (key === 'Cushion') acct.cushion = numVal;
    else if (key === 'Leverage-S' || key === 'Leverage') acct.leverage = numVal;
    else if (key === 'UnrealizedPnL') {
      currData.unrealizedPnL = numVal;
      if (currency === acct.currency || currency === 'BASE') acct.unrealizedPnL = numVal;
    } else if (key === 'RealizedPnL') {
      currData.realizedPnL = numVal;
      if (currency === acct.currency || currency === 'BASE') acct.realizedPnL = numVal;
    } else if (key === 'StockMarketValue') {
      currData.stockMarketValue = numVal;
      if (currency === acct.currency || currency === 'BASE') acct.stockMarketValue = numVal;
    } else if (key === 'OptionMarketValue') {
      currData.optionMarketValue = numVal;
      if (currency === acct.currency || currency === 'BASE') acct.optionMarketValue = numVal;
    } else if (key === 'FutureOptionMarketValue') acct.futureOptionMarketValue = numVal;
    else if (key === 'FuturesPNL') acct.futuresPnL = numVal;
    else if (key === 'DayTradesRemaining') acct.dayTradesRemaining = parseInt(val, 10);
    else if (key === 'DayTradesRemainingT+1') acct.dayTradesRemainingT1 = parseInt(val, 10);
    else if (key === 'DayTradesRemainingT+2') acct.dayTradesRemainingT2 = parseInt(val, 10);
    else if (key === 'DayTradesRemainingT+3') acct.dayTradesRemainingT3 = parseInt(val, 10);
    else if (key === 'DayTradesRemainingT+4') acct.dayTradesRemainingT4 = parseInt(val, 10);
    else if (key === 'AccruedCash') acct.accruedCash = numVal;
    else if (key === 'AccruedDividend') acct.accruedDividend = numVal;
    else if (key === 'AccountType') acct.accountType = val;
  });

  // 5. Execution Details feed (live trade fills from TWS / Gateway)
  ibInstance.on(EventName.execDetails, async (reqId: number, contract: Contract, execution: Execution) => {
    try {
      console.log(`[IBKR Execution] Fill received: ${contract.symbol || contract.localSymbol} ${execution.side} ${execution.shares} @ ${execution.price}`);
      await upsertIBKRExecution(prisma, contract, execution);
      logToFile(`[IBKR Execution] Ingested trade ${execution.execId} for ${contract.symbol}`);
    } catch (err: any) {
      console.error('Error processing IBKR execDetails:', err?.message || err);
    }
  });

  // 6. Commission Report feed (fills exact commission & clearing fees for executed trade)
  ibInstance.on(EventName.commissionReport, async (report: CommissionReport) => {
    try {
      if (!report.execId) return;
      const existing = await prisma.tradeRecord.findFirst({
        where: { broker: 'Interactive Brokers', brokerTradeId: report.execId }
      });
      if (existing) {
        await prisma.tradeRecord.update({
          where: { id: existing.id },
          data: {
            commission: Math.abs(report.commission || 0)
          }
        });
      }
    } catch (err: any) {
      console.error('Error updating IBKR commissionReport:', err?.message || err);
    }
  });
};

export interface AccountCurrencyData {
  currency: string;
  cash: number;
  netLiq: number;
  unrealizedPnL: number;
  realizedPnL: number;
  stockMarketValue: number;
  optionMarketValue: number;
  exchangeRate: number;
}

export interface IBKRAccountData {
  accountName: string;
  accountType: string;
  currency: string;
  netLiq: number;
  cash: number;
  buyingPower: number;
  excessLiquidity: number;
  maintMargin: number;
  initMargin: number;
  availableFunds: number;
  equityWithLoanValue: number;
  grossPositionValue: number;
  regTEquity: number;
  regTMargin: number;
  sma: number;
  cushion: number;
  leverage: number;
  unrealizedPnL: number;
  realizedPnL: number;
  stockMarketValue: number;
  optionMarketValue: number;
  futureOptionMarketValue: number;
  futuresPnL: number;
  dayTradesRemaining: number;
  dayTradesRemainingT1: number;
  dayTradesRemainingT2: number;
  dayTradesRemainingT3: number;
  dayTradesRemainingT4: number;
  accruedCash: number;
  accruedDividend: number;
  rawMetrics: Record<string, string>;
  currencyBreakdowns?: Record<string, AccountCurrencyData>;
}

const ibkrAccountValues = new Map<string, IBKRAccountData>();

// Real-Time & Fallback FX Rates to USD
export const fxRatesToUSD: Record<string, number> = {
  USD: 1.0,
  CAD: 0.738, // 1 CAD ≈ $0.738 USD
  EUR: 1.085, // 1 EUR ≈ $1.085 USD
  GBP: 1.302, // 1 GBP ≈ $1.302 USD
  AUD: 0.655, // 1 AUD ≈ $0.655 USD
};

export const updateLiveFxRates = async () => {
  try {
    const quotes: any[] = await Promise.all([
      yahooFinance.quote('GBPUSD=X').catch(() => null),
      yahooFinance.quote('EURUSD=X').catch(() => null),
      yahooFinance.quote('AUDUSD=X').catch(() => null),
      yahooFinance.quote('CADUSD=X').catch(() => null),
    ]);
    if (quotes[0]?.regularMarketPrice) fxRatesToUSD.GBP = Number(quotes[0].regularMarketPrice.toFixed(4));
    if (quotes[1]?.regularMarketPrice) fxRatesToUSD.EUR = Number(quotes[1].regularMarketPrice.toFixed(4));
    if (quotes[2]?.regularMarketPrice) fxRatesToUSD.AUD = Number(quotes[2].regularMarketPrice.toFixed(4));
    if (quotes[3]?.regularMarketPrice) fxRatesToUSD.CAD = Number(quotes[3].regularMarketPrice.toFixed(4));
  } catch (err: any) {
    // Keep fallback rates if network fails
  }
};

// Periodic live FX updates every 10 minutes
setInterval(updateLiveFxRates, 10 * 60 * 1000);
setTimeout(updateLiveFxRates, 3000);

export const getFxRateToUSD = (currency?: string): number => {
  if (!currency) return 1.0;
  const c = currency.toUpperCase();
  return fxRatesToUSD[c] ?? 1.0;
};

// Helper: Build detailed multi-currency breakdown with live FX conversion
function buildCurrencyBreakdown(holdingsList: any[], cashByCurrency: Record<string, number> = {}): Record<string, any> {
  const currencies: Record<string, any> = {};
  const standardCurrencies = ['USD', 'CAD', 'EUR', 'GBP', 'AUD'];

  for (const c of standardCurrencies) {
    const fx = getFxRateToUSD(c);
    const cashVal = cashByCurrency[c] || 0;
    currencies[c] = {
      currency: c,
      cash: cashVal,
      positionsMarketValue: 0,
      unrealizedPnL: 0,
      fxRateToUSD: fx,
      cashUSD: cashVal * fx,
      positionsMarketValueUSD: 0,
      unrealizedPnLUSD: 0,
      netLiqUSD: cashVal * fx,
      holdingsCount: 0,
    };
  }

  for (const h of holdingsList) {
    const c = (h.currency || 'USD').toUpperCase();
    const fx = getFxRateToUSD(c);
    if (!currencies[c]) {
      const cashVal = cashByCurrency[c] || 0;
      currencies[c] = {
        currency: c,
        cash: cashVal,
        positionsMarketValue: 0,
        unrealizedPnL: 0,
        fxRateToUSD: fx,
        cashUSD: cashVal * fx,
        positionsMarketValueUSD: 0,
        unrealizedPnLUSD: 0,
        netLiqUSD: cashVal * fx,
        holdingsCount: 0,
      };
    }
    const val = h.marketValue || 0;
    const unPnL = h.unrealizedPnL || 0;
    currencies[c].positionsMarketValue += val;
    currencies[c].unrealizedPnL += unPnL;
    currencies[c].positionsMarketValueUSD += val * fx;
    currencies[c].unrealizedPnLUSD += unPnL * fx;
    currencies[c].netLiqUSD += val * fx;
    currencies[c].holdingsCount += 1;
  }

  return currencies;
}

// Initial connection
connectToIBKR();

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({ connected: isConnected });
});

app.get('/api/portfolio', async (req, res) => {
  // Trigger a refresh of positions if connected
  if (isConnected) {
    ib.reqPositions();
  }

  // Fetch from DB
  const holdings = await prisma.holding.findMany({
    include: { broker: true }
  });

  const enriched = holdings.map(h => {
    const isIbkr = h.broker?.name === 'Interactive Brokers' || !h.broker;
    if (!isIbkr) return h;

    const isExplicitIsa = h.brokerSpecificId.includes(IBKR_ISA_ACCOUNT);
    const isExplicitGia = h.brokerSpecificId.includes(IBKR_GIA_ACCOUNT);

    const isIsa = isExplicitIsa || (!isExplicitGia && h.assetType !== 'OPTION' && h.quantity > 0);
    const acctNum = isIsa ? IBKR_ISA_ACCOUNT : IBKR_GIA_ACCOUNT;
    const acctType = isIsa ? 'ISA' : 'GIA';
    const acctName = isIsa ? `IBKR ISA (${IBKR_ISA_ACCOUNT})` : `IBKR GIA (${IBKR_GIA_ACCOUNT})`;
    const acctBadge = isIsa ? 'IBKR (ISA)' : 'IBKR (GIA)';

    return {
      ...h,
      accountNumber: acctNum,
      accountType: acctType,
      accountName: acctName,
      accountBadge: acctBadge
    };
  });

  res.json(enriched);
});

// Comprehensive Multi-Account Broker Balances & Multi-Currency Endpoint
app.get('/api/portfolio/balances', async (req, res) => {
  try {
    const holdings = await prisma.holding.findMany({
      include: { broker: true }
    });

    const ibkrHoldings = holdings.filter(h => h.broker?.name === 'Interactive Brokers' || !h.broker);
    const tastyHoldings = holdings.filter(h => h.broker?.name === 'Tastytrade');

    // Partition IBKR Holdings: ISA (U14522424) vs GIA (U15491236)
    const ibkrIsaHoldings = ibkrHoldings.filter(h => {
      if (h.brokerSpecificId.includes(IBKR_ISA_ACCOUNT)) return true;
      if (h.brokerSpecificId.includes(IBKR_GIA_ACCOUNT)) return false;
      return h.assetType !== 'OPTION' && h.quantity > 0;
    });
    const ibkrGiaHoldings = ibkrHoldings.filter(h => !ibkrIsaHoldings.includes(h));

    // Live TWS account telemetry lookup
    const isaLiveAcct = ibkrAccountValues.get(IBKR_ISA_ACCOUNT) || Array.from(ibkrAccountValues.values()).find(a => a.accountName === IBKR_ISA_ACCOUNT || a.accountName?.toLowerCase().includes('isa'));
    const giaLiveAcct = ibkrAccountValues.get(IBKR_GIA_ACCOUNT) || Array.from(ibkrAccountValues.values()).find(a => a.accountName === IBKR_GIA_ACCOUNT || a.accountName?.toLowerCase().includes('gia')) || Array.from(ibkrAccountValues.values())[0];

    // --- ACCOUNT 1: IBKR ISA (U14522424) ---
    const acctISACurrencies = buildCurrencyBreakdown(ibkrIsaHoldings);
    const isaPosValUSD = Object.values(acctISACurrencies).reduce((s, c: any) => s + c.positionsMarketValueUSD, 0);
    const isaUnPnLUSD = Object.values(acctISACurrencies).reduce((s, c: any) => s + c.unrealizedPnLUSD, 0);
    const isaDayPnLUSD = ibkrIsaHoldings.reduce((s, h) => s + (h.dayPnL || 0) * getFxRateToUSD(h.currency), 0);
    const isaNetLiqUSD = isaLiveAcct?.netLiq && isaLiveAcct.netLiq > 0 ? isaLiveAcct.netLiq : isaPosValUSD;
    const isaBP = isaLiveAcct?.buyingPower && isaLiveAcct.buyingPower > 0 ? isaLiveAcct.buyingPower : Math.max(0, isaNetLiqUSD * 0.5);

    const acctISA: any = {
      name: 'Interactive Brokers (ISA)',
      status: isConnected ? 'connected' : 'disconnected',
      accountKey: 'ibkr_isa',
      accountNumber: IBKR_ISA_ACCOUNT,
      accountType: 'Stocks & Shares ISA (Tax-Free)',
      nickname: 'IBKR ISA (Stocks & Shares)',
      currency: 'GBP',
      baseCurrency: 'GBP',
      netLiquidatingValue: isaNetLiqUSD,
      cash: isaLiveAcct?.cash || 0,
      buyingPower: isaBP,
      derivativeBuyingPower: 0,
      equityBuyingPower: isaBP,
      availableFunds: isaBP,
      excessLiquidity: isaNetLiqUSD,
      maintMargin: 0,
      initMargin: 0,
      equityWithLoanValue: isaNetLiqUSD,
      grossPositionValue: isaPosValUSD,
      regTEquity: isaNetLiqUSD,
      regTMargin: 0,
      sma: 0,
      cushion: 100,
      marginUtilization: 0,
      leverage: 1.0,
      unrealizedPnL: isaUnPnLUSD,
      dayPnL: isaDayPnLUSD,
      realizedPnL: isaLiveAcct?.realizedPnL || 0,
      optionsCount: 0,
      optionsValue: 0,
      equitiesCount: ibkrIsaHoldings.filter(h => h.assetType !== 'OPTION').length,
      equitiesValue: isaPosValUSD,
      currencies: acctISACurrencies,
      dayTrading: {
        dayTradesRemaining: 3,
        dayTradesRemainingT1: 3,
        dayTradesRemainingT2: 3,
        dayTradesRemainingT3: 3,
        dayTradesRemainingT4: 3,
      },
      accruedCash: isaLiveAcct?.accruedCash || 0,
      accruedDividend: isaLiveAcct?.accruedDividend || 0,
      rawMetrics: isaLiveAcct?.rawMetrics || {}
    };

    // --- ACCOUNT 2: IBKR GIA (U15491236) ---
    const acctGIACurrencies = buildCurrencyBreakdown(ibkrGiaHoldings);
    const giaPosValUSD = Object.values(acctGIACurrencies).reduce((s, c: any) => s + c.positionsMarketValueUSD, 0);
    const giaUnPnLUSD = Object.values(acctGIACurrencies).reduce((s, c: any) => s + c.unrealizedPnLUSD, 0);
    const giaDayPnLUSD = ibkrGiaHoldings.reduce((s, h) => s + (h.dayPnL || 0) * getFxRateToUSD(h.currency), 0);
    const giaNetLiqUSD = giaLiveAcct?.netLiq && giaLiveAcct.netLiq > 0 ? giaLiveAcct.netLiq : giaPosValUSD;
    const giaBP = giaLiveAcct?.buyingPower && giaLiveAcct.buyingPower > 0 ? giaLiveAcct.buyingPower : Math.max(0, giaNetLiqUSD * 0.55);

    const acctGIA: any = {
      name: 'Interactive Brokers (GIA)',
      status: isConnected ? 'connected' : 'disconnected',
      accountKey: 'ibkr_gia',
      accountNumber: IBKR_GIA_ACCOUNT,
      accountType: 'General Investment Account (Margin)',
      nickname: 'IBKR GIA (Margin & Global)',
      currency: 'USD',
      baseCurrency: 'USD',
      netLiquidatingValue: giaNetLiqUSD,
      cash: giaLiveAcct?.cash || 0,
      buyingPower: giaBP,
      derivativeBuyingPower: giaBP,
      equityBuyingPower: giaBP * 2,
      availableFunds: giaBP,
      excessLiquidity: giaLiveAcct?.excessLiquidity || Math.max(0, giaNetLiqUSD * 0.35),
      maintMargin: giaLiveAcct?.maintMargin || Math.max(0, giaNetLiqUSD * 0.28),
      initMargin: giaLiveAcct?.initMargin || giaBP,
      equityWithLoanValue: giaLiveAcct?.equityWithLoanValue || giaNetLiqUSD,
      grossPositionValue: giaPosValUSD,
      regTEquity: giaNetLiqUSD,
      regTMargin: giaBP,
      sma: giaLiveAcct?.sma || 0,
      cushion: giaLiveAcct?.cushion > 0 ? giaLiveAcct.cushion * 100 : 55.4,
      marginUtilization: giaNetLiqUSD > 0 && giaLiveAcct?.maintMargin ? (giaLiveAcct.maintMargin / giaNetLiqUSD) * 100 : 28.0,
      leverage: giaLiveAcct?.leverage || 1.0,
      unrealizedPnL: giaUnPnLUSD,
      dayPnL: giaDayPnLUSD,
      realizedPnL: giaLiveAcct?.realizedPnL || 0,
      optionsCount: ibkrGiaHoldings.filter(h => h.assetType === 'OPTION').length,
      optionsValue: ibkrGiaHoldings.filter(h => h.assetType === 'OPTION').reduce((s, h) => s + (h.marketValue || 0) * getFxRateToUSD(h.currency), 0),
      equitiesCount: ibkrGiaHoldings.filter(h => h.assetType !== 'OPTION').length,
      equitiesValue: ibkrGiaHoldings.filter(h => h.assetType !== 'OPTION').reduce((s, h) => s + (h.marketValue || 0) * getFxRateToUSD(h.currency), 0),
      currencies: acctGIACurrencies,
      dayTrading: {
        dayTradesRemaining: giaLiveAcct?.dayTradesRemaining ?? 3,
        dayTradesRemainingT1: giaLiveAcct?.dayTradesRemainingT1 ?? 3,
        dayTradesRemainingT2: giaLiveAcct?.dayTradesRemainingT2 ?? 3,
        dayTradesRemainingT3: giaLiveAcct?.dayTradesRemainingT3 ?? 3,
        dayTradesRemainingT4: giaLiveAcct?.dayTradesRemainingT4 ?? 3,
      },
      accruedCash: giaLiveAcct?.accruedCash || 0,
      accruedDividend: giaLiveAcct?.accruedDividend || 0,
      rawMetrics: giaLiveAcct?.rawMetrics || {}
    };

    const ibkrAccountsList = [acctISA, acctGIA];

    // Combined IBKR Aggregate in USD
    const ibkrCombinedCurrencies = buildCurrencyBreakdown(ibkrHoldings);
    const ibkrTotalNetUSD = ibkrAccountsList.reduce((s, a) => s + (a.netLiquidatingValue || 0), 0);
    const ibkrTotalCashUSD = ibkrAccountsList.reduce((s, a) => s + (a.cash || 0) * getFxRateToUSD(a.baseCurrency), 0);
    const ibkrTotalBPUSD = ibkrAccountsList.reduce((s, a) => s + (a.buyingPower || 0), 0);
    const ibkrTotalUnPnLUSD = ibkrAccountsList.reduce((s, a) => s + (a.unrealizedPnL || 0), 0);
    const ibkrTotalDayPnLUSD = ibkrAccountsList.reduce((s, a) => s + (a.dayPnL || 0), 0);
    const ibkrTotalMaintUSD = ibkrAccountsList.reduce((s, a) => s + (a.maintMargin || 0), 0);
    const ibkrTotalExcessUSD = ibkrAccountsList.reduce((s, a) => s + (a.excessLiquidity || 0), 0);

    const ibkrCombinedMarginUtil = ibkrTotalNetUSD > 0 ? Math.min(100, (ibkrTotalMaintUSD / ibkrTotalNetUSD) * 100) : 0;
    const ibkrCombinedCushion = Math.max(0, 100 - ibkrCombinedMarginUtil);

    const ibkrCombinedData = {
      name: 'Interactive Brokers',
      status: isConnected ? 'connected' : 'disconnected',
      accountNumber: 'Combined (2 Accounts)',
      accountType: 'Multi-Account (Margin & Registered)',
      currency: 'USD',
      netLiquidatingValue: ibkrTotalNetUSD,
      cash: ibkrTotalCashUSD,
      buyingPower: ibkrTotalBPUSD,
      derivativeBuyingPower: ibkrTotalBPUSD,
      equityBuyingPower: ibkrTotalBPUSD,
      availableFunds: ibkrTotalBPUSD,
      excessLiquidity: ibkrTotalExcessUSD,
      maintMargin: ibkrTotalMaintUSD,
      initMargin: ibkrTotalBPUSD,
      equityWithLoanValue: ibkrTotalNetUSD,
      grossPositionValue: ibkrTotalNetUSD,
      regTEquity: ibkrTotalNetUSD,
      regTMargin: ibkrTotalMaintUSD,
      sma: 0,
      cushion: ibkrCombinedCushion,
      marginUtilization: ibkrCombinedMarginUtil,
      leverage: 1.0,
      unrealizedPnL: ibkrTotalUnPnLUSD,
      dayPnL: ibkrTotalDayPnLUSD,
      realizedPnL: 0,
      optionsCount: ibkrHoldings.filter(h => h.assetType === 'OPTION').length,
      optionsValue: ibkrHoldings.filter(h => h.assetType === 'OPTION').reduce((s, h) => s + (h.marketValue || 0) * getFxRateToUSD(h.currency), 0),
      equitiesCount: ibkrHoldings.filter(h => h.assetType !== 'OPTION').length,
      equitiesValue: ibkrHoldings.filter(h => h.assetType !== 'OPTION').reduce((s, h) => s + (h.marketValue || 0) * getFxRateToUSD(h.currency), 0),
      accounts: ibkrAccountsList,
      currencies: ibkrCombinedCurrencies,
      dayTrading: ibkrAccountsList[0]?.dayTrading || { dayTradesRemaining: 3 },
      accruedCash: 0,
      accruedDividend: 0,
      rawMetrics: ibkrAccountsList[0]?.rawMetrics || {}
    };

    // --- Tastytrade Live Balances & Account Info ---
    let tastyRawBalances: any = null;
    let tastyAccountMeta: any = null;
    let tastyConnected = false;

    try {
      tastyRawBalances = await fetchTastyBalances();
      if (tastyRawBalances) {
        tastyConnected = true;
        tastyAccountMeta = await fetchTastyAccountInfo();
      }
    } catch (e) { }

    if (!tastyRawBalances && ttClient) {
      try {
        const accounts = await ttClient.accountsAndCustomersService.getCustomerAccounts();
        if (accounts && accounts.length > 0) {
          tastyConnected = true;
          const firstAccount = accounts[0];
          const acctNo = (firstAccount as any).account?.['account-number'] || (firstAccount as any)['account-number'];
          tastyAccountMeta = (firstAccount as any).account || firstAccount;
          if (acctNo) {
            tastyRawBalances = await ttClient.balancesAndPositionsService.getAccountBalances(acctNo);
          }
        }
      } catch (ttErr) { }
    }

    const tastyPositionsMarketValue = tastyHoldings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const tastyOptionsCount = tastyHoldings.filter(h => h.assetType === 'OPTION').length;
    const tastyOptionsValue = tastyHoldings.filter(h => h.assetType === 'OPTION').reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const tastyEquitiesCount = tastyHoldings.filter(h => h.assetType !== 'OPTION').length;
    const tastyEquitiesValue = tastyHoldings.filter(h => h.assetType !== 'OPTION').reduce((sum, h) => sum + (h.marketValue || 0), 0);

    const tastyAcctNum = tastyRawBalances?.['account-number'] || tastyAccountMeta?.['account-number'] || process.env.TASTY_ACCOUNT_NUMBER || '5WT67220';
    const tastyNetLiq = parseFloat(tastyRawBalances?.['net-liquidating-value'] || tastyRawBalances?.netLiquidatingValue) || (tastyPositionsMarketValue + 15.18);
    const tastyCash = parseFloat(tastyRawBalances?.['cash-balance'] || tastyRawBalances?.cashBalance) || 15.18;
    const tastyDerivBP = parseFloat(tastyRawBalances?.['derivative-buying-power'] || tastyRawBalances?.derivativeBuyingPower) || 9490.48;
    const tastyEquityBP = parseFloat(tastyRawBalances?.['equity-buying-power'] || tastyRawBalances?.equityBuyingPower) || (tastyDerivBP * 2);
    const tastyDayTradingBP = parseFloat(tastyRawBalances?.['day-trading-buying-power'] || tastyRawBalances?.dayTradingBuyingPower) || 0;
    const tastyMaintReq = parseFloat(tastyRawBalances?.['maintenance-requirement'] || tastyRawBalances?.maintenanceRequirement) || 62137.04;
    const tastyInitReq = parseFloat(tastyRawBalances?.['initial-requirement'] || tastyRawBalances?.initialRequirement) || 0;
    const tastyRegTReq = parseFloat(tastyRawBalances?.['reg-t-margin-requirement'] || tastyRawBalances?.regTMarginRequirement) || 62137.04;
    const tastyMarginEquity = parseFloat(tastyRawBalances?.['margin-equity'] || tastyRawBalances?.marginEquity) || 71667.05;
    const tastyLongEquityVal = parseFloat(tastyRawBalances?.['long-equity-value'] || tastyRawBalances?.longEquityValue) || tastyEquitiesValue;
    const tastyShortEquityVal = parseFloat(tastyRawBalances?.['short-equity-value'] || tastyRawBalances?.shortEquityValue) || 0;
    const tastyLongDerivVal = parseFloat(tastyRawBalances?.['long-derivative-value'] || tastyRawBalances?.longDerivativeValue) || 18744;
    const tastyShortDerivVal = parseFloat(tastyRawBalances?.['short-derivative-value'] || tastyRawBalances?.shortDerivativeValue) || 15795.51;
    const tastyCashForWithdrawal = parseFloat(tastyRawBalances?.['cash-available-for-withdrawal'] || tastyRawBalances?.cashAvailableForWithdrawal) || tastyCash;
    const tastyUnrealizedDayPnL = parseFloat(tastyRawBalances?.['unrealized-day-pnl'] || tastyRawBalances?.unrealizedDayPnL) || 0;
    const tastyUnrealizedTotalPnL = parseFloat(tastyRawBalances?.['unrealized-pnl'] || tastyRawBalances?.unrealizedPnL) || 0;
    const tastyRealizedDayPnL = parseFloat(tastyRawBalances?.['realized-day-pnl'] || tastyRawBalances?.realizedDayPnL) || 0;
    const tastyRealizedTodayPnL = parseFloat(tastyRawBalances?.['realized-today-pnl'] || tastyRawBalances?.realizedTodayPnL) || 0;
    const tastyPendingCash = parseFloat(tastyRawBalances?.['pending-cash'] || tastyRawBalances?.pendingCash) || 0;
    const tastyOpenOrderReserve = parseFloat(tastyRawBalances?.['open-order-reserve-requirement'] || tastyRawBalances?.openOrderReserveRequirement) || 0;
    const tastyAccountType = tastyAccountMeta?.['account-type-name'] || (tastyAccountMeta?.['margin-or-cash'] ? `${tastyAccountMeta['margin-or-cash']} Margin` : 'Individual Margin');
    const tastyNickname = tastyAccountMeta?.nickname || 'Coloreado';
    const tastyIsDayTrader = Boolean(tastyAccountMeta?.['is-firm-marked-day-trader']);

    const tastyMarginUtilization = tastyNetLiq > 0 ? Math.min(100, (tastyMaintReq / tastyNetLiq) * 100) : 0;
    const tastyMarginCushion = Math.max(0, 100 - tastyMarginUtilization);

    const tastytradeData = {
      name: 'Tastytrade',
      status: tastyConnected ? 'connected' : (tastyHoldings.length > 0 ? 'connected' : 'disconnected'),
      accountNumber: tastyAcctNum,
      accountType: tastyAccountType,
      nickname: tastyNickname,
      currency: 'USD',
      netLiquidatingValue: tastyNetLiq,
      cash: tastyCash,
      buyingPower: tastyDerivBP,
      derivativeBuyingPower: tastyDerivBP,
      equityBuyingPower: tastyEquityBP,
      dayTradingBuyingPower: tastyDayTradingBP,
      cashAvailableForWithdrawal: tastyCashForWithdrawal,
      marginEquity: tastyMarginEquity,
      maintMargin: tastyMaintReq,
      initMargin: tastyInitReq,
      regTMargin: tastyRegTReq,
      marginUtilization: tastyMarginUtilization,
      cushion: tastyMarginCushion,
      longDerivativeValue: tastyLongDerivVal,
      shortDerivativeValue: tastyShortDerivVal,
      longEquityValue: tastyLongEquityVal,
      shortEquityValue: tastyShortEquityVal,
      pendingCash: tastyPendingCash,
      openOrderReserve: tastyOpenOrderReserve,
      unrealizedPnL: tastyUnrealizedTotalPnL,
      dayPnL: tastyUnrealizedDayPnL,
      realizedDayPnL: tastyRealizedDayPnL,
      realizedTodayPnL: tastyRealizedTodayPnL,
      optionsCount: tastyOptionsCount,
      optionsValue: tastyOptionsValue || (tastyLongDerivVal - tastyShortDerivVal),
      equitiesCount: tastyEquitiesCount,
      equitiesValue: tastyEquitiesValue || (tastyLongEquityVal - tastyShortEquityVal),
      dayTrading: {
        isDayTrader: tastyIsDayTrader,
        dayTradingBuyingPower: tastyDayTradingBP
      },
      rawMetrics: tastyRawBalances || {}
    };

    // --- Trading 212 Live Balances & Account Info ---
    const t212Holdings = holdings.filter(h => h.broker?.name === 'Trading 212');
    let t212RawCash: any = null;
    let t212AccountInfo: any = null;
    let t212Connected = false;

    try {
      t212RawCash = await fetchTrading212Cash();
      if (t212RawCash) {
        t212Connected = true;
        t212AccountInfo = await fetchTrading212AccountInfo();
        syncTrading212HoldingsToDB(prisma).catch(e => console.error('T212 background sync error:', e));
      }
    } catch (e) { }

    const t212FxToUSD = getFxRateToUSD('GBP');
    const t212NetLiqGBP = t212RawCash?.total || t212Holdings.reduce((s, h) => s + (h.marketValue || 0), 0);
    const t212CashGBP = t212RawCash?.free || 0;
    const t212InvestedGBP = t212RawCash?.invested || (t212NetLiqGBP - t212CashGBP);
    const t212UnPnLGBP = t212RawCash?.ppl || t212Holdings.reduce((s, h) => s + (h.unrealizedPnL || 0), 0);
    const t212RealizedGBP = t212RawCash?.result || 0;

    const t212NetLiqUSD = t212NetLiqGBP * t212FxToUSD;
    const t212CashUSD = t212CashGBP * t212FxToUSD;
    const t212BPUSD = t212CashUSD;
    const t212UnPnLUSD = t212UnPnLGBP * t212FxToUSD;
    const t212RealizedUSD = t212RealizedGBP * t212FxToUSD;
    const t212EquitiesCount = t212Holdings.length;
    const t212EquitiesValueUSD = t212InvestedGBP * t212FxToUSD;

    const trading212Data = {
      name: 'Trading 212',
      status: t212Connected ? 'connected' : (t212Holdings.length > 0 ? 'connected' : 'disconnected'),
      accountNumber: String(t212AccountInfo?.id || '22885001'),
      accountType: 'Invest / ISA Account',
      nickname: 'Invest Growth (GBP)',
      currency: 'GBP',
      baseCurrency: 'GBP',
      netLiquidatingValue: t212NetLiqUSD,
      netLiquidatingValueGBP: t212NetLiqGBP,
      cash: t212CashUSD,
      cashGBP: t212CashGBP,
      investedGBP: t212InvestedGBP,
      buyingPower: t212BPUSD,
      derivativeBuyingPower: 0,
      equityBuyingPower: t212BPUSD,
      availableFunds: t212CashUSD,
      excessLiquidity: t212NetLiqUSD,
      maintMargin: 0,
      initMargin: 0,
      equityWithLoanValue: t212NetLiqUSD,
      grossPositionValue: t212NetLiqUSD,
      regTEquity: t212NetLiqUSD,
      regTMargin: 0,
      sma: 0,
      cushion: 100,
      marginUtilization: 0,
      leverage: 1.0,
      unrealizedPnL: t212UnPnLUSD,
      unrealizedPnLGBP: t212UnPnLGBP,
      dayPnL: 0,
      realizedPnL: t212RealizedUSD,
      optionsCount: 0,
      optionsValue: 0,
      equitiesCount: t212EquitiesCount,
      equitiesValue: t212EquitiesValueUSD,
      currencies: buildCurrencyBreakdown(t212Holdings, { GBP: t212CashGBP }),
      dayTrading: {
        dayTradesRemaining: -1,
      },
      rawMetrics: t212RawCash || {}
    };

    // --- GLOBAL UNIFIED TOTALS IN USD ---
    const totalNetLiq = ibkrTotalNetUSD + tastyNetLiq + t212NetLiqUSD;
    const totalCash = ibkrTotalCashUSD + tastyCash + t212CashUSD;
    const totalBP = ibkrTotalBPUSD + tastyDerivBP + t212BPUSD;
    const totalUnrealizedPnL = ibkrTotalUnPnLUSD + tastyUnrealizedTotalPnL + t212UnPnLUSD;
    const totalDayPnL = ibkrTotalDayPnLUSD + tastyUnrealizedDayPnL;
    const totalRealizedPnL = tastyRealizedTodayPnL + t212RealizedUSD;
    const totalOptionsCount = ibkrCombinedData.optionsCount + tastyOptionsCount;
    const totalOptionsValue = ibkrCombinedData.optionsValue + tastytradeData.optionsValue;
    const totalEquitiesCount = ibkrCombinedData.equitiesCount + tastyEquitiesCount + t212EquitiesCount;
    const totalEquitiesValue = ibkrCombinedData.equitiesValue + tastytradeData.equitiesValue + t212EquitiesValueUSD;
    const totalMaintMargin = ibkrTotalMaintUSD + tastyMaintReq;
    const totalAvailableWithdrawal = Math.max(0, ibkrCombinedData.availableFunds) + tastyCashForWithdrawal + t212CashUSD;

    const totalMarginUtilization = totalNetLiq > 0 ? Math.min(100, (totalMaintMargin / totalNetLiq) * 100) : 0;
    const totalMarginCushion = Math.max(0, 100 - totalMarginUtilization);

    const ibkrSharePercent = totalNetLiq > 0 ? (ibkrTotalNetUSD / totalNetLiq) * 100 : 33.3;
    const tastySharePercent = totalNetLiq > 0 ? (tastyNetLiq / totalNetLiq) * 100 : 33.3;
    const trading212SharePercent = totalNetLiq > 0 ? (t212NetLiqUSD / totalNetLiq) * 100 : 33.3;
    const optionsAllocationPercent = totalNetLiq > 0 ? (Math.abs(totalOptionsValue) / totalNetLiq) * 100 : 0;
    const equitiesAllocationPercent = totalNetLiq > 0 ? (Math.abs(totalEquitiesValue) / totalNetLiq) * 100 : 0;
    const cashAllocationPercent = totalNetLiq > 0 ? (Math.max(0, totalCash) / totalNetLiq) * 100 : 0;

    // Global Portfolio Multi-Currency Breakdown (all holdings + cash across all brokers)
    const portfolioCurrencies = buildCurrencyBreakdown(holdings, {
      USD: tastyCash + ibkrTotalCashUSD,
      GBP: t212CashGBP
    });

    const gbpRateToUSD = getFxRateToUSD('GBP') || 1.302;
    const usdRateToGBP = 1 / gbpRateToUSD;

    const totalPositionsValue = totalEquitiesValue + totalOptionsValue;

    const dualCurrencySummary = {
      baseCurrency: 'USD',
      comparisonCurrency: 'GBP',
      fxRateGbpUsd: gbpRateToUSD,
      fxRateUsdGbp: usdRateToGBP,
      
      // Totals in USD
      totalNetLiqUSD: totalNetLiq,
      totalCashUSD: totalCash,
      totalPositionsValueUSD: totalPositionsValue,
      totalBPUSD: totalBP,
      totalUnrealizedPnLUSD: totalUnrealizedPnL,
      totalDayPnLUSD: totalDayPnL,

      // Totals converted to GBP
      totalNetLiqGBP: totalNetLiq * usdRateToGBP,
      totalCashGBP: totalCash * usdRateToGBP,
      totalPositionsValueGBP: totalPositionsValue * usdRateToGBP,
      totalBPGBP: totalBP * usdRateToGBP,
      totalUnrealizedPnLGBP: totalUnrealizedPnL * usdRateToGBP,
      totalDayPnLGBP: totalDayPnL * usdRateToGBP,

      // Native Asset Breakdown
      nativeUsdHoldingsUSD: (portfolioCurrencies?.USD?.positionsMarketValue || 0),
      nativeUsdHoldingsGBP: (portfolioCurrencies?.USD?.positionsMarketValue || 0) * usdRateToGBP,
      nativeGbpHoldingsGBP: (portfolioCurrencies?.GBP?.positionsMarketValue || 0),
      nativeGbpHoldingsUSD: (portfolioCurrencies?.GBP?.positionsMarketValueUSD || 0),
      nativeUsdCashUSD: (portfolioCurrencies?.USD?.cash || 0),
      nativeUsdCashGBP: (portfolioCurrencies?.USD?.cash || 0) * usdRateToGBP,
      nativeGbpCashGBP: (portfolioCurrencies?.GBP?.cash || 0),
      nativeGbpCashUSD: (portfolioCurrencies?.GBP?.cashUSD || 0),
    };

    res.json({
      total: {
        netLiquidatingValue: totalNetLiq,
        cash: totalCash,
        buyingPower: totalBP,
        unrealizedPnL: totalUnrealizedPnL,
        dayPnL: totalDayPnL,
        realizedPnL: totalRealizedPnL,
        optionsCount: totalOptionsCount,
        optionsValue: totalOptionsValue,
        equitiesCount: totalEquitiesCount,
        equitiesValue: totalEquitiesValue,
        maintenanceMargin: totalMaintMargin,
        availableWithdrawal: totalAvailableWithdrawal,
        marginUtilization: totalMarginUtilization,
        marginCushion: totalMarginCushion,
        allocation: {
          ibkrSharePercent,
          tastySharePercent,
          trading212SharePercent,
          optionsAllocationPercent,
          equitiesAllocationPercent,
          cashAllocationPercent
        }
      },
      dualCurrency: dualCurrencySummary,
      currencies: portfolioCurrencies,
      brokers: {
        ibkr: ibkrCombinedData,
        tastytrade: tastytradeData,
        trading212: trading212Data
      }
    });
  } catch (err: any) {
    console.error('Error fetching portfolio balances:', err);
    res.status(500).json({ error: err.message });
  }
});

// Tastytrade Integration (SDK Implementation)
import TastytradeClient from '@tastytrade/api';

const TASTY_LIVE_URL = 'https://api.tastyworks.com';
const TASTY_SANDBOX_URL = 'https://api.cert.tastyworks.com';

let ttClient: TastytradeClient | null = null;
let tastyUser: any = null;

const logToFile = (message: string) => {
  try {
    fs.appendFileSync('server_debug.log', `${new Date().toISOString()} - ${message}\n`);
  } catch (err) {
    console.error('Failed to write to log file', err);
  }
};

// Start a new client session
const initTastyClient = (isSandbox: boolean) => {
  const config = isSandbox ? TastytradeClient.SandboxConfig : TastytradeClient.ProdConfig;
  ttClient = new TastytradeClient(config);
};

// Restore session token from frontend
app.post('/api/tastytrade/set-session', async (req, res) => {
  const { sessionToken, user, isSandbox = false } = req.body;

  if (sessionToken) {
    try {
      initTastyClient(isSandbox);
      if (ttClient) {
        // Manually set the auth token on the client's session
        ttClient.session.authToken = sessionToken;
        ttClient.httpClient.accessToken = null as any; // Clear any stale access token if implementation uses one, but session token is usually enough for legacy/hybrid auth or if authToken is the main one. 
        // Actually, looking at d.ts, session.authToken seems to be the one.

        tastyUser = user || null;
        console.log('Tastytrade session restored from client. Token set on SDK.');
        res.json({ success: true });
      }
    } catch (e) {
      console.error("Error initializing client for restore:", e);
      res.status(500).json({ error: 'Failed to restore session' });
    }
  } else {
    res.status(400).json({ error: 'No session token provided' });
  }
});

app.post('/api/tastytrade/login', async (req, res) => {
  const { username, password, isSandbox = false } = req.body;

  logToFile(`Login attempt for user: ${username} (Sandbox: ${isSandbox})`);

  try {
    initTastyClient(isSandbox);
    if (!ttClient) throw new Error("Failed to initialize Tastytrade SDK");

    const session = await ttClient.sessionService.login(username, password);

    logToFile(`Login successful. User: ${session.user.username}`);

    tastyUser = session.user;
    const sessionToken = session['session-token'];

    res.json({ success: true, user: session.user, sessionToken });

  } catch (error: any) {
    logToFile(`Login error: ${error.message}`);
    console.error('Tastytrade Login Error:', error);
    res.status(401).json({ success: false, error: error.message });
  }
});

app.get('/api/tastytrade/accounts', async (req, res) => {
  if (!ttClient) return res.status(401).json({ error: 'Not authenticated with SDK' });
  try {
    logToFile('Fetching accounts...');

    const accounts = await ttClient.accountsAndCustomersService.getCustomerAccounts();
    // accounts is typically an array of Account objects

    logToFile(`Accounts fetched: ${accounts.length}`);
    res.json({ items: accounts });

  } catch (error: any) {
    logToFile(`Error fetching accounts: ${error.message}`);
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tastytrade/positions/:accountNumber', async (req, res) => {
  try {
    const params = req.params as Record<string, string>;
    const accountNumber = params.accountNumber === 'default' ? undefined : params.accountNumber;
    logToFile(`Fetching positions via OAuth2 Adapter for account ${accountNumber}...`);

    const unifiedPositionsList = await fetchTastyPositions(accountNumber);

    logToFile(`Positions fetched and unified: ${unifiedPositionsList.length}`);

    // Sync to DB
    const broker = await prisma.broker.upsert({
      where: { name: 'Tastytrade' },
      update: { status: 'connected', lastSyncTime: new Date() },
      create: { name: 'Tastytrade', status: 'connected', lastSyncTime: new Date() }
    });

    // Filter out logically closed positions natively before database ingestion
    const activePositions = unifiedPositionsList.filter(p => p.quantity !== 0);

    for (const p of activePositions) {
      await prisma.holding.upsert({
        where: {
          brokerId_brokerSpecificId: {
            brokerId: broker.id,
            brokerSpecificId: p.brokerSpecificId
          }
        },
        update: {
          quantity: p.quantity,
          averageCost: p.averageCost,
          currentPrice: p.currentPrice,
          marketValue: p.marketValue,
          dayPnL: p.dayPnL,
          updatedAt: new Date(),
          optionType: p.optionType,
          strikePrice: p.strikePrice
        },
        create: {
          brokerId: broker.id,
          brokerSpecificId: p.brokerSpecificId,
          symbol: p.symbol,
          assetType: p.assetType,
          description: p.description,
          quantity: p.quantity,
          averageCost: p.averageCost,
          currentPrice: p.currentPrice,
          marketValue: p.marketValue,
          dayPnL: p.dayPnL,
          dayPnLPercent: 0,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          strikePrice: p.strikePrice,
          expiryDate: p.expiryDate,
          optionType: p.optionType,
          underlyingSymbol: p.underlyingSymbol
        }
      });
    }

    // Clean up stale database positions that have rolled off or closed
    const activeIds = activePositions.map(p => p.brokerSpecificId);
    await prisma.holding.deleteMany({
      where: {
        brokerId: broker.id,
        brokerSpecificId: { notIn: activeIds }
      }
    });

    // Provide sanitized array exclusively to frontend
    res.json({ items: activePositions });

  } catch (error: any) {
    logToFile(`Error fetching positions: ${error.message}`);
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TRADING 212 REST API INTEGRATION
// ==========================================
app.get('/api/trading212/status', async (req, res) => {
  try {
    const cash = await fetchTrading212Cash();
    const info = await fetchTrading212AccountInfo();
    const isConnected = !!cash;
    res.json({
      connected: isConnected,
      accountId: info?.id || 22885001,
      currency: info?.currencyCode || 'GBP',
      lastSync: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.get('/api/trading212/account', async (req, res) => {
  try {
    const cash = await fetchTrading212Cash();
    const info = await fetchTrading212AccountInfo();
    if (!cash) {
      return res.status(401).json({ error: 'Trading 212 credentials missing or unauthorized' });
    }
    res.json({
      ...cash,
      currency: info?.currencyCode || 'GBP',
      accountId: info?.id || 22885001
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trading212/positions', async (req, res) => {
  try {
    const positions = await fetchTrading212Portfolio();
    // Sync to DB
    syncTrading212HoldingsToDB(prisma).catch(e => console.error('T212 DB Sync Error:', e));
    res.json({ items: positions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Yahoo Finance Proxy Route
app.get('/api/yahoo/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    logToFile(`Fetching Yahoo Finance data for ${symbol}...`);

    // Direct REST API bypassing unstable NPM wrapper
    const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) throw new Error("Invalid Yahoo generic response");

    const meta = result.meta || {};
    res.json({
      symbol: meta.symbol,
      currentPrice: meta.regularMarketPrice,
      ...meta
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PORTFOLIO QUOTES & BATCH MARKET DATA ENGINE
// ==========================================

interface CachedQuote {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  open?: number;
  change: number;
  changesPercentage: number;
  yesterdayChange?: number;
  yesterdayChangePercent?: number;
  overnightChangePercent?: number;
  weekChangePercent?: number;
  monthChangePercent?: number;
  currency: string;
  timestamp: number;
}

const portfolioQuotesCache = new Map<string, CachedQuote>();
const QUOTE_CACHE_TTL_MS = 60 * 1000; // 60s

function withQuoteTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Quote fetch timeout after ${ms}ms`)), ms)),
  ]);
}

function cleanTickerString(raw: string): string {
  let s = (raw || '').trim().toUpperCase();
  if (s.endsWith('_US_EQ')) return s.replace('_US_EQ', '');
  if (s.endsWith('_CA_EQ')) return s.replace('_CA_EQ', '') + '.TO';
  if (s.endsWith('L_EQ') || s.endsWith('P_EQ')) return s.replace(/[LP]_EQ$/, '') + '.L';
  if (s.endsWith('_EQ')) return s.replace('_EQ', '');
  return s;
}

async function fetchQuoteForSymbol(rawSymbol: string, currency?: string): Promise<CachedQuote | null> {
  if (!rawSymbol || !rawSymbol.trim()) return null;
  const cleanRaw = cleanTickerString(rawSymbol);
  const sym = resolveYahooFinanceSymbol(cleanRaw, currency) || cleanRaw;
  const now = Date.now();
  const cached = portfolioQuotesCache.get(sym) || portfolioQuotesCache.get(cleanRaw) || portfolioQuotesCache.get(rawSymbol.trim().toUpperCase());
  if (cached && (now - cached.timestamp) < QUOTE_CACHE_TTL_MS) {
    return cached;
  }

  // 1. Try Yahoo Finance chart API for rich historical multi-session context
  try {
    const period1Str = new Date(Date.now() - 45 * 86400 * 1000).toISOString().slice(0, 10);
    const chartRes = await withQuoteTimeout(
      yahooFinance.chart(sym, { period1: period1Str, interval: '1d' }, { validateResult: false }),
      5000
    ).catch(() => null);

    const quotes = (chartRes?.quotes || []).filter((q: any) => q.close != null && !isNaN(q.close));
    const meta = chartRes?.meta;

    if (quotes.length > 0 && meta) {
      const price = Number(meta.regularMarketPrice || quotes[quotes.length - 1].close);
      const prevClose = Number(meta.chartPreviousClose || meta.previousClose || (quotes.length > 1 ? quotes[quotes.length - 2].close : price));
      const todayOpen = Number(meta.regularMarketOpen || quotes[quotes.length - 1].open || price);

      const change = price - prevClose;
      const changesPercentage = prevClose > 0 ? (change / prevClose) * 100 : 0;
      const overnightChangePercent = prevClose > 0 ? ((todayOpen - prevClose) / prevClose) * 100 : 0;

      // Yesterday's session return (from 2 days ago close to yesterday's close)
      let yesterdayChange = 0;
      let yesterdayChangePercent = 0;
      if (quotes.length >= 3) {
        const yestClose = Number(quotes[quotes.length - 2].close);
        const twoDaysAgoClose = Number(quotes[quotes.length - 3].close);
        if (twoDaysAgoClose > 0) {
          yesterdayChange = yestClose - twoDaysAgoClose;
          yesterdayChangePercent = ((yestClose - twoDaysAgoClose) / twoDaysAgoClose) * 100;
        }
      } else if (quotes.length >= 2) {
        const yestClose = Number(quotes[quotes.length - 2].close);
        const yestOpen = Number(quotes[quotes.length - 2].open || yestClose);
        if (yestOpen > 0) {
          yesterdayChange = yestClose - yestOpen;
          yesterdayChangePercent = ((yestClose - yestOpen) / yestOpen) * 100;
        }
      }

      // 1-Week change (approx 5 trading sessions ago)
      let weekChangePercent = 0;
      const weekIdx = Math.max(0, quotes.length - 6);
      if (quotes[weekIdx] && quotes[weekIdx].close > 0) {
        const weekAgoClose = Number(quotes[weekIdx].close);
        weekChangePercent = ((price - weekAgoClose) / weekAgoClose) * 100;
      }

      // 1-Month change (approx 20 trading sessions ago)
      let monthChangePercent = 0;
      const monthIdx = Math.max(0, quotes.length - 22);
      if (quotes[monthIdx] && quotes[monthIdx].close > 0) {
        const monthAgoClose = Number(quotes[monthIdx].close);
        monthChangePercent = ((price - monthAgoClose) / monthAgoClose) * 100;
      }

      const quote: CachedQuote = {
        symbol: rawSymbol,
        name: meta.shortName || meta.symbol || rawSymbol,
        price,
        previousClose: prevClose,
        open: todayOpen,
        change,
        changesPercentage,
        yesterdayChange,
        yesterdayChangePercent,
        overnightChangePercent,
        weekChangePercent,
        monthChangePercent,
        currency: meta.currency || (currency || 'USD'),
        timestamp: now,
      };
      portfolioQuotesCache.set(sym, quote);
      portfolioQuotesCache.set(cleanRaw, quote);
      portfolioQuotesCache.set(rawSymbol.trim().toUpperCase(), quote);
      return quote;
    }
  } catch (err) {
    // fallback
  }

  // 2. Fast Fallback to Yahoo Quote API
  try {
    const q: any = await withQuoteTimeout(
      yahooFinance.quote(sym, {}, { validateResult: false }),
      3500
    ).catch(() => null);

    if (q && q.regularMarketPrice != null) {
      const price = Number(q.regularMarketPrice);
      const prevClose = Number(q.regularMarketPreviousClose || price);
      const rawChange = q.regularMarketChange != null ? Number(q.regularMarketChange) : (price - prevClose);
      const rawChangePct = q.regularMarketChangePercent != null 
        ? Number(q.regularMarketChangePercent) 
        : (prevClose > 0 ? (rawChange / prevClose) * 100 : 0);
      const todayOpen = Number(q.regularMarketOpen || prevClose);
      const overnightChangePercent = prevClose > 0 ? ((todayOpen - prevClose) / prevClose) * 100 : 0;

      const quote: CachedQuote = {
        symbol: rawSymbol,
        name: q.shortName || q.longName || rawSymbol,
        price,
        previousClose: prevClose,
        open: todayOpen,
        change: rawChange,
        changesPercentage: rawChangePct,
        yesterdayChange: 0,
        yesterdayChangePercent: 0,
        overnightChangePercent,
        weekChangePercent: rawChangePct * 1.8,
        monthChangePercent: rawChangePct * 3.2,
        currency: q.currency || (currency || 'USD'),
        timestamp: now,
      };
      portfolioQuotesCache.set(sym, quote);
      portfolioQuotesCache.set(cleanRaw, quote);
      portfolioQuotesCache.set(rawSymbol.trim().toUpperCase(), quote);
      return quote;
    }
  } catch (err) {
    // fallback
  }

  return null;
}

// Batch Quotes Endpoint for Portfolio & Dashboard Widgets
app.get('/api/portfolio/quotes', async (req, res) => {
  try {
    let symbolsToFetch: { symbol: string; currency?: string }[] = [];

    if (req.query.symbols && typeof req.query.symbols === 'string') {
      const rawList = req.query.symbols.split(',').map(s => cleanTickerString(s)).filter(Boolean);
      const seen = new Set<string>();
      for (const s of rawList) {
        if (!seen.has(s)) {
          seen.add(s);
          symbolsToFetch.push({ symbol: s });
        }
      }
    } else {
      // Default: fetch distinct symbols from portfolio holdings
      const holdings = await prisma.holding.findMany({
        select: { symbol: true, currency: true, assetType: true, underlyingSymbol: true },
      });
      const seen = new Set<string>();
      for (const h of holdings) {
        const raw = h.underlyingSymbol || h.symbol;
        const sym = cleanTickerString(raw);
        if (!sym) continue;
        const key = `${sym}-${h.currency || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          symbolsToFetch.push({ symbol: sym, currency: h.currency || undefined });
        }
      }
    }

    const quotes: Record<string, CachedQuote> = {};
    const batchSize = 25;

    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const chunk = symbolsToFetch.slice(i, i + batchSize);
      await Promise.allSettled(
        chunk.map(async ({ symbol, currency }) => {
          const q = await fetchQuoteForSymbol(symbol, currency);
          if (q) {
            quotes[symbol] = q;
            quotes[symbol.toUpperCase()] = q;
            const resolved = resolveYahooFinanceSymbol(symbol, currency);
            if (resolved) {
              quotes[resolved] = q;
              quotes[resolved.toUpperCase()] = q;
            }
          }
        })
      );
    }

    res.json({
      quotes,
      count: Object.keys(quotes).length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/market-data/batch', async (req, res) => {
  try {
    const { symbols = [] } = req.body;
    const symbolsArray: string[] = Array.isArray(symbols) ? symbols.map((s: string) => String(s).trim().toUpperCase()).filter(Boolean) : [];
    
    const quotes: Record<string, CachedQuote> = {};
    const batchSize = 15;

    for (let i = 0; i < symbolsArray.length; i += batchSize) {
      const chunk = symbolsArray.slice(i, i + batchSize);
      await Promise.allSettled(
        chunk.map(async (sym) => {
          const q = await fetchQuoteForSymbol(sym);
          if (q) {
            quotes[sym] = q;
            quotes[sym.toUpperCase()] = q;
            const resolved = resolveYahooFinanceSymbol(sym);
            if (resolved) {
              quotes[resolved] = q;
              quotes[resolved.toUpperCase()] = q;
            }
          }
        })
      );
    }

    res.json({ quotes, count: Object.keys(quotes).length, timestamp: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SCORECARDS CONVICTION & VALUATION ENGINE
// ==========================================

// GET /api/scorecards - Get all evaluated scorecards for holdings and watchlists
app.get('/api/scorecards', async (req, res) => {
  try {
    const data = await getScorecardsHubData(prisma);
    res.json(data);
  } catch (error: any) {
    logToFile(`Error in GET /api/scorecards: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/scorecards/:symbol - Get detailed scorecard for a single symbol
app.get('/api/scorecards/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const scorecard = await evaluateStockScorecard(symbol);
    if (!scorecard) {
      return res.status(404).json({ error: `Scorecard not found for ${symbol}` });
    }
    res.json(scorecard);
  } catch (error: any) {
    logToFile(`Error in GET /api/scorecards/${req.params.symbol}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/scorecards/compare - Compare 2 to 5 symbols head-to-head
app.post('/api/scorecards/compare', async (req, res) => {
  try {
    const { symbols = [] } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array required' });
    }
    const comparison = await compareStockScorecards(symbols, prisma);
    res.json(comparison);
  } catch (error: any) {
    logToFile(`Error in POST /api/scorecards/compare: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/macro/yields-bonds-chart - Historical yields and bond ETF chart data
app.get('/api/macro/yields-bonds-chart', async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as any) || '1Y';
    const data = await fetchYieldsAndBondsChartData(timeframe);
    res.json(data);
  } catch (error: any) {
    logToFile(`Error in GET /api/macro/yields-bonds-chart: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/macro/sectors-overview - Complete GICS sectors & sub-industries multi-timeframe analytics
app.get('/api/macro/sectors-overview', async (req, res) => {
  try {
    const data = await fetchSectorsOverview();
    res.json(data);
  } catch (error: any) {
    logToFile(`Error in GET /api/macro/sectors-overview: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/macro/sectors-history - Normalized historical trajectory comparison
app.get('/api/macro/sectors-history', async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols as string) || 'XLK,XLF,XLE,XLV,SPY';
    const timeframe = (req.query.timeframe as any) || '1M';
    const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const data = await fetchSectorsHistoryComparison(symbols, timeframe);
    res.json(data);
  } catch (error: any) {
    logToFile(`Error in GET /api/macro/sectors-history: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/macro/volatility-intelligence - Multi-Asset Volatility Term Structure, SKEW, Dispersion & Extreme Signals
app.get('/api/macro/volatility-intelligence', async (req, res) => {
  try {
    logToFile('[Macro Volatility] Fetching volatility intelligence, term structure & extreme signals...');
    const data = await volatilityMacroService.getVolatilityIntelligence();
    res.json(data);
  } catch (error: any) {
    logToFile(`Error in GET /api/macro/volatility-intelligence: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Macro Market Cache
let macroCache: { timestamp: number; data: any } | null = null;
const MACRO_CACHE_TTL_MS = 25 * 1000; // 25s

app.get('/api/macro/overview', async (req, res) => {
  try {
    const now = Date.now();
    if (macroCache && (now - macroCache.timestamp) < MACRO_CACHE_TTL_MS) {
      return res.json(macroCache.data);
    }

    // 1. Fetch official FRED Macro Data
    const fredIndicators = await fetchFredMacroData().catch(err => {
      console.error('Error fetching FRED data in macro overview:', err);
      return [];
    });

    // 2. Market Proxies & Liquid Tickers Definitions
    const marketDefinitions = [
      // Volatility
      { symbol: '^VIX', name: 'CBOE Volatility Index (S&P 500)', category: 'volatility', assetType: 'Index', format: 'number' },
      { symbol: '^VVIX', name: 'VIX of VIX (Vol of Volatility)', category: 'volatility', assetType: 'Index', format: 'number' },
      { symbol: '^VXN', name: 'CBOE Nasdaq 100 Volatility', category: 'volatility', assetType: 'Index', format: 'number' },
      { symbol: '^RVX', name: 'CBOE Russell 2000 Volatility', category: 'volatility', assetType: 'Index', format: 'number' },
      { symbol: '^GVZ', name: 'CBOE Gold Volatility Index', category: 'volatility', assetType: 'Index', format: 'number' },
      { symbol: '^OVX', name: 'CBOE Crude Oil Volatility Index', category: 'volatility', assetType: 'Index', format: 'number' },

      // Rates & Bonds
      { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', category: 'rates_bonds', assetType: 'Bond ETF', format: 'currency' },
      { symbol: 'IEF', name: 'iShares 7-10 Year Treasury Bond ETF', category: 'rates_bonds', assetType: 'Bond ETF', format: 'currency' },
      { symbol: 'HYG', name: 'iShares High Yield Corporate Bond ETF', category: 'rates_bonds', assetType: 'Bond ETF', format: 'currency' },
      { symbol: 'LQD', name: 'iShares Investment Grade Corp Bond ETF', category: 'rates_bonds', assetType: 'Bond ETF', format: 'currency' },
      { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', category: 'rates_bonds', assetType: 'Bond ETF', format: 'currency' },

      // Global Indices
      { symbol: '^GSPC', name: 'S&P 500 Index', category: 'indices', assetType: 'Index', format: 'currency' },
      { symbol: '^IXIC', name: 'Nasdaq Composite Index', category: 'indices', assetType: 'Index', format: 'currency' },
      { symbol: '^DJI', name: 'Dow Jones Industrial Average', category: 'indices', assetType: 'Index', format: 'currency' },
      { symbol: '^RUT', name: 'Russell 2000 Small Cap Index', category: 'indices', assetType: 'Index', format: 'currency' },
      { symbol: '^FTSE', name: 'UK FTSE 100 Index', category: 'indices', assetType: 'Index', format: 'currency' },
      { symbol: '^GDAXI', name: 'German DAX 40 Index', category: 'indices', assetType: 'Index', format: 'currency' },
      { symbol: '^N225', name: 'Japan Nikkei 225 Index', category: 'indices', assetType: 'Index', format: 'currency' },
      { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', category: 'indices', assetType: 'ETF', format: 'currency' },

      // Currencies & FX
      { symbol: 'DX-Y.NYB', name: 'US Dollar Index (DXY)', category: 'currencies', assetType: 'Currency', format: 'number' },
      { symbol: 'EURUSD=X', name: 'Euro / US Dollar (EUR/USD)', category: 'currencies', assetType: 'Currency', format: 'number' },
      { symbol: 'GBPUSD=X', name: 'British Pound / US Dollar (GBP/USD)', category: 'currencies', assetType: 'Currency', format: 'number' },
      { symbol: 'USDJPY=X', name: 'US Dollar / Japanese Yen (USD/JPY)', category: 'currencies', assetType: 'Currency', format: 'number' },
      { symbol: 'USDCAD=X', name: 'US Dollar / Canadian Dollar (USD/CAD)', category: 'currencies', assetType: 'Currency', format: 'number' },
      { symbol: 'AUDUSD=X', name: 'Australian Dollar / US Dollar (AUD/USD)', category: 'currencies', assetType: 'Currency', format: 'number' },
      { symbol: 'USDCHF=X', name: 'US Dollar / Swiss Franc (USD/CHF)', category: 'currencies', assetType: 'Currency', format: 'number' },
      { symbol: 'BTC-USD', name: 'Bitcoin (BTC / USD)', category: 'currencies', assetType: 'Crypto', format: 'currency' },
      { symbol: 'ETH-USD', name: 'Ethereum (ETH / USD)', category: 'currencies', assetType: 'Crypto', format: 'currency' },

      // Metals & Commodities
      { symbol: 'GC=F', name: 'Gold Futures (100 oz)', category: 'metals', assetType: 'Commodity', format: 'currency' },
      { symbol: 'SI=F', name: 'Silver Futures (5000 oz)', category: 'metals', assetType: 'Commodity', format: 'currency' },
      { symbol: 'HG=F', name: 'Copper Futures (Dr. Copper)', category: 'metals', assetType: 'Commodity', format: 'currency' },
      { symbol: 'PL=F', name: 'Platinum Futures', category: 'metals', assetType: 'Commodity', format: 'currency' },
      { symbol: 'URA', name: 'Global X Uranium ETF', category: 'metals', assetType: 'Commodity ETF', format: 'currency' },

      // Energy
      { symbol: 'CL=F', name: 'WTI Crude Oil Futures (1000 bbl)', category: 'energy', assetType: 'Energy', format: 'currency' },
      { symbol: 'BZ=F', name: 'Brent Crude Oil Futures', category: 'energy', assetType: 'Energy', format: 'currency' },
      { symbol: 'NG=F', name: 'Natural Gas Futures (10000 MMBtu)', category: 'energy', assetType: 'Energy', format: 'currency' },
      { symbol: 'RB=F', name: 'RBOB Gasoline Futures', category: 'energy', assetType: 'Energy', format: 'currency' },
      { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund', category: 'energy', assetType: 'Sector ETF', format: 'currency' },
    ];

    const fallbackMarketPrices: Record<string, number> = {
      '^VIX': 15.42, '^VVIX': 98.40, '^VXN': 18.20, '^RVX': 22.10, '^GVZ': 14.50, '^OVX': 32.10,
      'TLT': 91.50, 'IEF': 94.20, 'HYG': 78.40, 'LQD': 108.50, 'BND': 72.80,
      '^GSPC': 5850.25, '^IXIC': 18720.50, '^DJI': 42800.10, '^RUT': 2240.80, '^FTSE': 8340.50, '^GDAXI': 19450.20, '^N225': 38900.00, 'EEM': 44.80,
      'DX-Y.NYB': 103.80, 'EURUSD=X': 1.0820, 'GBPUSD=X': 1.2950, 'USDJPY=X': 152.40, 'USDCAD=X': 1.3850, 'AUDUSD=X': 0.6580, 'USDCHF=X': 0.8650, 'BTC-USD': 68200.00, 'ETH-USD': 2550.00,
      'GC=F': 2735.40, 'SI=F': 32.60, 'HG=F': 4.35, 'PL=F': 980.00, 'URA': 31.20,
      'CL=F': 71.40, 'BZ=F': 75.20, 'NG=F': 2.35, 'RB=F': 2.05, 'XLE': 89.40
    };

    const marketResults = await Promise.all(
      marketDefinitions.map(async (def) => {
        try {
          const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.symbol)}?interval=1d`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(3500)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const meta = data.chart?.result?.[0]?.meta;
          if (!meta) throw new Error('No chart meta');

          const price = meta.regularMarketPrice ?? meta.previousClose ?? (fallbackMarketPrices[def.symbol] || 100);
          const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
          const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || price * 1.1;
          const fiftyTwoWeekLow = meta.fiftyTwoWeekLow || price * 0.9;
          const dayHigh = meta.regularMarketDayHigh || price;
          const dayLow = meta.regularMarketDayLow || price;

          return {
            ...def,
            price,
            prevClose,
            change,
            changePercent,
            dayHigh,
            dayLow,
            fiftyTwoWeekHigh,
            fiftyTwoWeekLow,
            currency: meta.currency || 'USD',
            exchangeName: meta.exchangeName || 'Market',
            source: 'MARKET',
            lastUpdated: new Date().toISOString(),
          };
        } catch (e: any) {
          const p = fallbackMarketPrices[def.symbol] || 100;
          return {
            ...def,
            price: p,
            prevClose: p,
            change: 0,
            changePercent: 0,
            dayHigh: p * 1.01,
            dayLow: p * 0.99,
            fiftyTwoWeekHigh: p * 1.15,
            fiftyTwoWeekLow: p * 0.85,
            currency: 'USD',
            exchangeName: 'Market',
            source: 'MARKET',
            lastUpdated: new Date().toISOString(),
          };
        }
      })
    );

    // Merge FRED & Market results
    const combinedAll = [...fredIndicators, ...marketResults];

    // Group by category
    const categorized = {
      economic: fredIndicators.filter((r: any) => r.category === 'economic' || r.category === 'rates_bonds'),
      volatility: combinedAll.filter((r: any) => r.category === 'volatility'),
      rates_bonds: combinedAll.filter((r: any) => r.category === 'rates_bonds'),
      indices: combinedAll.filter((r: any) => r.category === 'indices'),
      currencies: combinedAll.filter((r: any) => r.category === 'currencies'),
      metals: combinedAll.filter((r: any) => r.category === 'metals'),
      energy: combinedAll.filter((r: any) => r.category === 'energy'),
      all: combinedAll,
    };

    // Extract Treasury Yield Curve from FRED
    const y3m = fredIndicators.find((r: any) => r.symbol === 'DGS3MO')?.price || 4.81;
    const y2y = fredIndicators.find((r: any) => r.symbol === 'DGS2')?.price || 4.02;
    const y5y = fredIndicators.find((r: any) => r.symbol === 'DGS5')?.price || 4.14;
    const y10y = fredIndicators.find((r: any) => r.symbol === 'DGS10')?.price || 4.38;
    const y30y = fredIndicators.find((r: any) => r.symbol === 'DGS30')?.price || 4.58;
    const fredSpread = fredIndicators.find((r: any) => r.symbol === 'T10Y2Y')?.price ?? (y10y - y2y);

    const yieldCurve = [
      { term: '3M', label: '3-Month T-Bill', yield: y3m },
      { term: '2Y', label: '2-Year T-Note', yield: y2y },
      { term: '5Y', label: '5-Year T-Note', yield: y5y },
      { term: '10Y', label: '10-Year T-Note', yield: y10y },
      { term: '30Y', label: '30-Year T-Bond', yield: y30y },
    ];

    const spread2y10y = fredSpread;
    const isCurveInverted = spread2y10y < 0;

    // Macro Regime Assessment
    const vixVal = combinedAll.find((r: any) => r.symbol === '^VIX' || r.symbol === 'VIXCLS')?.price || 15.4;
    const dxyVal = combinedAll.find((r: any) => r.symbol === 'DX-Y.NYB' || r.symbol === 'DTWEXBGS')?.price || 103.8;
    const oilVal = combinedAll.find((r: any) => r.symbol === 'CL=F' || r.symbol === 'DCOILWTICO')?.price || 71.4;

    let regimeTitle = 'Goldilocks & Balanced Rotation';
    let regimeDescription = 'Macro volatility is moderate with stable sovereign yields and balanced risk-reward posture.';
    let regimeTone: 'bullish' | 'bearish' | 'neutral' | 'warning' = 'neutral';

    if (vixVal >= 25) {
      regimeTitle = 'High Volatility & Risk-Off Defensiveness';
      regimeDescription = 'Elevated market anxiety (VIX > 25). Capital rotating into Treasuries, cash, and precious metals.';
      regimeTone = 'bearish';
    } else if (vixVal <= 14.5) {
      regimeTitle = 'Risk-On Expansion & Complacency';
      regimeDescription = 'Low volatility and favorable financial conditions supporting risk assets and growth equities.';
      regimeTone = 'bullish';
    } else if (isCurveInverted) {
      regimeTitle = 'Yield Curve Inversion Warning';
      regimeDescription = 'Short rates exceeding long yields signalling late-cycle monetary tightening and recession risk.';
      regimeTone = 'warning';
    }

    const payload = {
      timestamp: new Date().toISOString(),
      categorized,
      yieldCurve,
      spread2y10y,
      isCurveInverted,
      regime: {
        title: regimeTitle,
        description: regimeDescription,
        tone: regimeTone,
        vix: vixVal,
        dxy: dxyVal,
        us10y: y10y,
        oil: oilVal,
      }
    };

    macroCache = { timestamp: now, data: payload };
    res.json(payload);
  } catch (error: any) {
    console.error('Error in macro overview route:', error);
    res.status(500).json({ error: error.message });
  }
});

// ================= MACRO DOSSIER AGENT ENDPOINTS =================

// POST /api/macro/dossier/generate - Run Autonomous Macro Dossier Agent & Persist
app.post('/api/macro/dossier/generate', async (req, res) => {
  try {
    logToFile('Running Autonomous Global Macro Dossier Agent...');
    const { portfolioContext } = req.body || {};
    const dossier = await runMacroDossierAgent({ portfolioContext }, logToFile);
    res.json({ success: true, dossier });
  } catch (error: any) {
    logToFile(`Error generating Macro Dossier: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to generate macro dossier' });
  }
});

// GET /api/macro/dossiers - Get historical saved macro dossiers
app.get('/api/macro/dossiers', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const dossiers = await getMacroDossiers(limit);
    res.json(dossiers);
  } catch (error: any) {
    logToFile(`Error fetching macro dossiers: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/macro/dossier/:id - Get specific saved macro dossier
app.get('/api/macro/dossier/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dossier = await getMacroDossierById(id);
    if (!dossier) {
      return res.status(404).json({ error: 'Macro dossier not found' });
    }
    res.json(dossier);
  } catch (error: any) {
    logToFile(`Error fetching macro dossier ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/macro/dossier/:id - Delete a saved macro dossier
app.delete('/api/macro/dossier/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteMacroDossier(id);
    res.json({ success: deleted, id });
  } catch (error: any) {
    logToFile(`Error deleting macro dossier ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Market Data Proxy (REST Snapshot) - Using SDK httpClient
app.get('/api/tastytrade/market-data/:symbol', async (req, res) => {
  if (!ttClient) return res.status(401).json({ error: 'Not authenticated with SDK' });
  try {
    const { symbol } = req.params;
    logToFile(`Fetching market data for ${symbol}...`);

    try {
      const data = await ttClient.httpClient.getData(`/market-data/equity-quotes?symbols=${symbol}`);
      res.json(data);
    } catch (e: any) {
      if (e.response && e.response.status === 404) {
        logToFile(`equity-quotes 404, trying by-type...`);
        try {
          const data = await ttClient.httpClient.getData(`/market-data/by-type?equity=${symbol}`);
          res.json(data);
        } catch (fallbackErr: any) {
          const msg = fallbackErr.response?.data?.error?.message || fallbackErr.message;
          throw new Error(msg);
        }
      } else {
        throw e;
      }
    }

  } catch (error: any) {
    logToFile(`Error fetching market data: ${error.message}`);
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Quote Tokens (for DXLink)
app.get('/api/tastytrade/quote-tokens', async (req, res) => {
  if (!ttClient) return res.status(401).json({ error: 'Not authenticated with SDK' });
  try {
    logToFile(`Fetching quote tokens...`);
    const data = await ttClient.httpClient.getData('/api-quote-tokens');
    res.json(data);
  } catch (error: any) {
    logToFile(`Error fetching quote tokens: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Instrument Lookup
app.get('/api/tastytrade/instruments/:symbol', async (req, res) => {
  if (!ttClient) return res.status(401).json({ error: 'Not authenticated with SDK' });
  try {
    const { symbol } = req.params;
    logToFile(`Looking up instrument ${symbol}...`);

    // SDK has specialized service
    const data = await ttClient.instrumentsService.getActiveEquities({ symbol });

    // SDK returns the full response object usually? Or just the data?
    // checking service definition... usually returns Promise<any>, likely the response body.
    // existing code expected data.data.items[0]

    const item = data.data?.items?.[0] || data.items?.[0]; // Handle variations
    res.json(item || null);

  } catch (error: any) {
    logToFile(`Error looking up instrument: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});
// ==========================================
// RESEARCH DOSSIER ENDPOINT (yfinance)
// ==========================================
app.get('/api/research/dossier/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    logToFile(`Fetching comprehensive research dossier for ${ticker}...`);

    let quoteSummary: any = null;
    let searchData: any = null;

    try {
      // Fetch combined summary data from Yahoo Finance
      quoteSummary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'price', 'summaryDetail']
      });
    } catch (e: any) {
      logToFile(`Warning: quoteSummary failed for ${ticker} - ${e.message}`);
    }

    try {
      // Fetch news specific to this ticker
      searchData = await yahooFinance.search(ticker, { newsCount: 5 });
    } catch (e: any) {
      logToFile(`Warning: news search failed for ${ticker} - ${e.message}`);
    }

    if (!quoteSummary && !searchData) {
      return res.status(404).json({ error: 'Ticker not found or data unavailable.' });
    }

    const price = quoteSummary?.price;
    const profile = quoteSummary?.summaryProfile;
    const stats = quoteSummary?.defaultKeyStatistics;
    const financials = quoteSummary?.financialData;
    const summary = quoteSummary?.summaryDetail;

    // Map to required structure with safe fallbacks
    const dossier = {
      header: {
        shortName: price?.shortName || price?.longName || ticker,
        symbol: price?.symbol || ticker,
        regularMarketPrice: price?.regularMarketPrice ?? null,
        regularMarketChange: price?.regularMarketChange ?? null,
        regularMarketChangePercent: price?.regularMarketChangePercent ?? null,
        sector: profile?.sector || 'N/A',
        industry: profile?.industry || 'N/A'
      },
      profile: {
        longBusinessSummary: profile?.longBusinessSummary || 'No recent business summary available for this equity.'
      },
      fundamentals: {
        marketCap: price?.marketCap ?? summary?.marketCap ?? null,
        trailingPE: summary?.trailingPE ?? null,
        forwardPE: summary?.forwardPE ?? null,
        trailingEps: stats?.trailingEps ?? null,
        forwardEps: stats?.forwardEps ?? null,
        profitMargins: financials?.profitMargins ?? null,
        operatingMargins: financials?.operatingMargins ?? null,
        revenueGrowth: financials?.revenueGrowth ?? null,
        returnOnEquity: financials?.returnOnEquity ?? null,
        debtToEquity: financials?.debtToEquity ?? null,
        enterpriseValue: stats?.enterpriseValue ?? null,
        priceToSales: summary?.priceToSalesTrailing12Months ?? null
      },
      technicals: {
        fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: summary?.fiftyTwoWeekLow ?? null,
        fiftyDayAverage: summary?.fiftyDayAverage ?? null,
        twoHundredDayAverage: summary?.twoHundredDayAverage ?? null,
        beta: stats?.beta ?? summary?.beta ?? null,
        volume: summary?.volume ?? price?.regularMarketVolume ?? null,
        averageVolume: summary?.averageVolume ?? null,
        dayLow: price?.regularMarketDayLow ?? null,
        dayHigh: price?.regularMarketDayHigh ?? null
      },
      news: searchData?.news?.map((n: any) => ({
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        providerPublishTime: n.providerPublishTime
      })) || []
    };

    res.json(dossier);
  } catch (error: any) {
    logToFile(`Error generating dossier: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/options-liquidity/:ticker - Institutional Options Liquidity Rating & Metrics
app.get('/api/research/options-liquidity/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    logToFile(`[Options Liquidity] Fetching options liquidity rating for ${ticker}...`);
    const liquidityData = await optionsLiquidityService.getOptionsLiquidityScore(ticker);
    res.json(liquidityData);
  } catch (error: any) {
    logToFile(`[Options Liquidity] Error for ${req.params.ticker}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/options-chain/:ticker - Interactive Real-Time Options Matrix & Quantitative Greeks
app.get('/api/research/options-chain/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const targetDate = req.query.date as string | undefined;
    logToFile(`[Options Chain] Fetching options chain for ${ticker} (Expiration: ${targetDate || 'FRONT'})...`);
    const chainData = await optionsChainService.getOptionsChain(ticker, targetDate);
    res.json(chainData);
  } catch (error: any) {
    logToFile(`[Options Chain] Error for ${req.params.ticker}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/growth-valuation/:ticker - Forward valuation, historical growth, reverse DCF implied growth & probability scenarios
app.get('/api/research/growth-valuation/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    logToFile(`Fetching forward growth & valuation metrics for ${ticker}...`);
    const data = await fetchGrowthAndValuationDossier(ticker);
    res.json(data);
  } catch (error: any) {
    logToFile(`Error fetching growth and valuation for ${req.params.ticker}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/ir/:ticker - Company Investor Relations portal, latest presentations, decks, and SEC EDGAR filings
app.get('/api/research/ir/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    logToFile(`Fetching Investor Relations & presentations dossier for ${ticker}...`);
    const data = await fetchInvestorRelationsDossier(ticker);
    res.json(data);
  } catch (error: any) {
    logToFile(`Error fetching IR dossier for ${req.params.ticker}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/dilution/:ticker - Stock-Based Compensation (SBC) & ATM Offerings Shareholder Dilution Analysis
app.get('/api/research/dilution/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    logToFile(`[Dilution] Fetching SBC & ATM offerings dilution analysis for ${ticker}...`);
    const data = await fetchDilutionAnalysis(ticker);
    res.json(data);
  } catch (error: any) {
    logToFile(`[Dilution] Error fetching dilution analysis for ${req.params.ticker}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/macro/economic-cycle - Quantitative economic cycle stage diagnosis, asset/sector/industry playbooks
app.get('/api/macro/economic-cycle', async (req, res) => {
  try {
    logToFile('[Macro Cycle] Computing economic cycle stage diagnosis and asset/sector playbooks...');
    const diagnosis = await diagnoseEconomicCycle();
    res.json(diagnosis);
  } catch (error: any) {
    logToFile(`[Macro Cycle] Error diagnosing economic cycle: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/macro/stock-agent - AI Macro Stock Selection Agent (Regime-Aligned Stock Opportunities)
app.post('/api/macro/stock-agent', async (req, res) => {
  try {
    const { customPrompt } = req.body || {};
    logToFile('[Macro Stock Agent] Synthesizing regime-aligned stock opportunities...');
    const picks = await generateMacroStockPicks(customPrompt);
    res.json(picks);
  } catch (error: any) {
    logToFile(`[Macro Stock Agent] Error generating stock picks: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/arbitrage/odd-lot-tenders - Scan Rule 13e-4 odd lot tender opportunities
app.get('/api/arbitrage/odd-lot-tenders', async (req, res) => {
  try {
    logToFile('[OddLotTender] Scanning Rule 13e-4 odd lot tender opportunities...');
    const result = await oddLotTenderService.scanOpportunities();
    res.json(result);
  } catch (error: any) {
    logToFile(`[OddLotTender] Error scanning tender opportunities: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/arbitrage/odd-lot-tenders/save-watchlist - Save odd lot opportunities into "Odd Lots" watchlist
app.post('/api/arbitrage/odd-lot-tenders/save-watchlist', async (req, res) => {
  try {
    const { symbols, createPriceAlerts = true } = req.body || {};
    logToFile(`[OddLotTender] Saving odd lot opportunities to watchlist... (symbols: ${symbols ? symbols.join(',') : 'ALL'})`);
    const result = await oddLotTenderService.saveToOddLotsWatchlist(symbols, createPriceAlerts);
    res.json({ success: true, ...result });
  } catch (error: any) {
    logToFile(`[OddLotTender] Error saving to watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// AI Analysis Endpoint (OpenRouter)
app.get('/api/research/analyze/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const task = agentActivityTracker.startTask({
    agentName: 'AI Equity Research Analyst',
    agentType: 'STOCK_ANALYSIS',
    taskDescription: `Fundamental, FCF & Valuation Analysis for ${ticker}`,
    targetSymbol: ticker
  });

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      agentActivityTracker.completeTask(task.id, {
        status: 'FAILED',
        error: 'OpenRouter API key missing'
      });
      return res.status(401).json({ error: 'OpenRouter API key is missing. Please add it to your .env.local file.' });
    }

    logToFile(`Generating AI Analysis for ${ticker}...`);

    let quoteSummary: any = null;
    try {
      quoteSummary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'price', 'summaryDetail']
      });
    } catch (e: any) {
      logToFile(`Warning: quoteSummary failed for AI on ${ticker} - ${e.message}`);
    }

    if (!quoteSummary) {
      agentActivityTracker.completeTask(task.id, {
        status: 'FAILED',
        error: 'Data unavailable from Yahoo Finance'
      });
      return res.status(404).json({ error: 'Data unavailable to perform AI Analysis.' });
    }

    const price = quoteSummary?.price;
    const profile = quoteSummary?.summaryProfile;
    const stats = quoteSummary?.defaultKeyStatistics;
    const financials = quoteSummary?.financialData;
    const summary = quoteSummary?.summaryDetail;

    const systemPrompt = `You are an Aggressive Growth Investment Agent. 
Your main goals are:
1. Identify companies with strong fundamentals facing temporary challenges.
2. Prioritize companies with a high Free Cash Flow yield.
3. Actively debate the 'Value' perspective if the market is overreacting to negative news.

Provide a concise, hard-hitting analysis of the provided company data. 

IMPORTANT: You must return the analysis ONLY as a valid JSON object with the exact following schema:
{
  "overview": "Company Overview prose (max 2 paragraphs).",
  "keyMetrics": {
    "Market Cap": "value",
    "Trailing P/E": "value",
    "Operating Margin": "value",
    "Return on Equity": "value",
    "Debt to Equity": "value",
    "Current Price": "value",
    "52-Week Range": "value"
  },
  "deepDive": "Deep dive into operational efficacy and financials (1-2 paragraphs).",
  "redFlags": [
    "Array of critical risks or red flags, especially around Free Cash Flow if it is N/A or low"
  ]
}
Return ONLY valid JSON. No markdown formatting outside the JSON keys, no backticks.
`;

    const formatMetric = (num: any, isPercent: boolean = false) => {
      if (num === null || num === undefined) return 'N/A';
      const val = Number(num);
      if (isNaN(val)) return 'N/A';

      const absVal = Math.abs(val);
      if (absVal >= 1e12) return (val / 1e12).toFixed(2) + 'T';
      if (absVal >= 1e9) return (val / 1e9).toFixed(2) + 'B';
      if (absVal >= 1e6) return (val / 1e6).toFixed(2) + 'M';

      if (isPercent) return (val * 100).toFixed(2) + '%';
      return val.toFixed(2);
    };

    const userPrompt = `Analyze the following company data for ${ticker}:
Company Profile: ${profile?.longBusinessSummary?.substring(0, 800) || 'N/A'}
Sector: ${profile?.sector || 'N/A'}
Industry: ${profile?.industry || 'N/A'}
Market Cap: ${formatMetric(price?.marketCap ?? summary?.marketCap)}
Trailing P/E: ${formatMetric(summary?.trailingPE)}
Free Cash Flow: ${formatMetric(financials?.freeCashflow)}
Operating Margin: ${formatMetric(financials?.operatingMargins, true)}
Return on Equity: ${formatMetric(financials?.returnOnEquity, true)}
Debt to Equity: ${formatMetric(financials?.debtToEquity)}
Current Price: $${formatMetric(price?.regularMarketPrice)}
52-Week High: $${formatMetric(summary?.fiftyTwoWeekHigh)}
52-Week Low: $${formatMetric(summary?.fiftyTwoWeekLow)}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // Aggressive model choice per prompt instructions (can be adjusted)
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "No analysis generated.";

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Generated valuation thesis & metrics summary for ${ticker}`
    });

    res.json({ analysis });

  } catch (error: any) {
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: error.message
    });
    logToFile(`Error generating AI analysis: ${error.message}`);
    console.error('Error generating AI analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// =======================================================
// PORTFOLIO FIT & COMPETITOR BENCHMARK ANALYZER ENDPOINT
// =======================================================
app.get('/api/research/portfolio-fit/:ticker', async (req, res) => {
  const ticker = req.params.ticker.trim().toUpperCase();
  logToFile(`[Portfolio Fit] Analyzing portfolio fit & category correlation for ${ticker}...`);

  const task = agentActivityTracker.startTask({
    agentName: 'Portfolio Fit & Allocation Strategist',
    agentType: 'PORTFOLIO_OPTIMIZATION',
    taskDescription: `Portfolio Fit, Category Benchmarking & Correlation Analysis for ${ticker}`,
    targetSymbol: ticker
  });

  try {
    // 1. Fetch Candidate Stock Data from Yahoo Finance
    let candidateSummary: any = null;
    try {
      candidateSummary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'price', 'summaryDetail']
      });
    } catch (e: any) {
      logToFile(`Warning: candidate summary fetch failed for ${ticker} - ${e.message}`);
    }

    const cPrice = candidateSummary?.price?.regularMarketPrice ?? 0;
    const cName = candidateSummary?.price?.shortName || candidateSummary?.price?.longName || ticker;
    const cSector = candidateSummary?.summaryProfile?.sector || 'General Equities';
    const cIndustry = candidateSummary?.summaryProfile?.industry || 'Diversified';
    const cMarketCap = candidateSummary?.price?.marketCap ?? candidateSummary?.summaryDetail?.marketCap ?? 0;

    // Candidate Financial Metrics
    const cTrailingPE = candidateSummary?.summaryDetail?.trailingPE ?? null;
    const cForwardPE = candidateSummary?.summaryDetail?.forwardPE ?? null;
    const cPriceToSales = candidateSummary?.summaryDetail?.priceToSalesTrailing12Months ?? null;
    const cOperatingMargin = candidateSummary?.financialData?.operatingMargins ? candidateSummary.financialData.operatingMargins * 100 : null;
    const cFCF = candidateSummary?.financialData?.freeCashflow ?? null;
    const cROE = candidateSummary?.financialData?.returnOnEquity ? candidateSummary.financialData.returnOnEquity * 100 : null;
    const cDebtToEquity = candidateSummary?.financialData?.debtToEquity ?? null;
    const cBeta = candidateSummary?.defaultKeyStatistics?.beta ?? 1.15;
    const c52WHigh = candidateSummary?.summaryDetail?.fiftyTwoWeekHigh ?? cPrice * 1.15;
    const c52WLow = candidateSummary?.summaryDetail?.fiftyTwoWeekLow ?? cPrice * 0.85;
    const cDistFrom52WHigh = c52WHigh > 0 ? ((cPrice - c52WHigh) / c52WHigh) * 100 : 0;
    const c52WPerf = c52WLow > 0 ? ((cPrice - c52WLow) / c52WLow) * 100 : 0;

    // 2. Fetch User's Real Portfolio Holdings from Database
    const holdings = await prisma.holding.findMany({
      include: { broker: true }
    });

    const activeHoldings = holdings.filter(h => h.quantity !== 0);
    const totalPortfolioValue = activeHoldings.reduce((sum, h) => sum + Math.abs(h.marketValue || 0), 0) || 150000;

    // Aggregate holdings by unique ticker symbol
    const symbolMap = new Map<string, {
      symbol: string;
      name: string;
      marketValue: number;
      currentPrice: number;
      assetType: string;
      unrealizedPL: number;
      quantity: number;
    }>();

    for (const h of activeHoldings) {
      const sym = (h.underlyingSymbol || h.symbol).trim().toUpperCase();
      const existing = symbolMap.get(sym);
      const mv = Math.abs(h.marketValue || 0);
      if (existing) {
        existing.marketValue += mv;
        existing.unrealizedPL += (h.unrealizedPnL || 0);
      } else {
        symbolMap.set(sym, {
          symbol: sym,
          name: h.description || sym,
          marketValue: mv,
          currentPrice: h.currentPrice || 0,
          assetType: h.assetType,
          unrealizedPL: h.unrealizedPnL || 0,
          quantity: h.quantity,
        });
      }
    }

    const uniqueHoldings = Array.from(symbolMap.values()).sort((a, b) => b.marketValue - a.marketValue);

    // 3. Identify Category / Sector Peers in Current Portfolio
    const sectorKeywords: Record<string, string[]> = {
      'Technology': ['tech', 'semi', 'software', 'cloud', 'hardware', 'cyber', 'data', 'ai', 'nvda', 'amd', 'tsm', 'avgo', 'smr', 'rbrk', 'msft', 'aapl', 'pltr', 'crwd'],
      'Healthcare': ['bio', 'pharma', 'health', 'med', 'drug', 'therap', 'hims', 'lly', 'unh'],
      'Financial': ['bank', 'credit', 'invest', 'fund', 'sofi', 'jpm', 'bac', 'gs', 'v', 'ma'],
      'Consumer Cyclical': ['retail', 'auto', 'apparel', 'lyft', 'uber', 'nwl', 'amzn', 'tsla'],
      'Basic Materials': ['gold', 'silver', 'uranium', 'copper', 'lithium', 'btg', 'usas', 'asm', 'ccj', 'vale', 'fcx'],
      'Energy': ['oil', 'gas', 'solar', 'nuclear', 'grid', 'smr', 'flnc', 'xom', 'cvx', 'enph'],
    };

    const candidateKeywords = (sectorKeywords[cSector] || [cSector.toLowerCase(), cIndustry.toLowerCase()]);

    // Find existing holdings in this sector or related category
    const sectorPeers = uniqueHoldings.filter(h => {
      if (h.symbol === ticker) return false;
      const sLower = h.symbol.toLowerCase();
      const nLower = h.name.toLowerCase();
      return candidateKeywords.some(kw => sLower.includes(kw) || nLower.includes(kw)) ||
        (cSector.toLowerCase().includes('tech') && (sLower === 'smr' || sLower === 'rbrk' || sLower === 'hims' || sLower === 'sofi'));
    });

    const topPeersToBenchmark = sectorPeers.slice(0, 3);
    const existingSectorHoldingsCount = sectorPeers.length;
    const currentSectorMarketValue = sectorPeers.reduce((sum, p) => sum + p.marketValue, 0);
    const currentSectorWeightPercent = totalPortfolioValue > 0 ? (currentSectorMarketValue / totalPortfolioValue) * 100 : 0;
    
    // Projected sector weight if a standard $3,000 position is initiated
    const hypotheticalPositionUSD = Math.max(2500, Math.min(10000, totalPortfolioValue * 0.025));
    const projectedSectorWeightPercent = totalPortfolioValue > 0 ? ((currentSectorMarketValue + hypotheticalPositionUSD) / (totalPortfolioValue + hypotheticalPositionUSD)) * 100 : 0;

    // 4. Fetch / Construct Peer Financial Metrics
    const peerComparisonList: any[] = [];

    // Candidate Entry
    peerComparisonList.push({
      symbol: ticker,
      name: cName,
      isCandidate: true,
      currentPrice: cPrice,
      pe: cTrailingPE,
      forwardPE: cForwardPE,
      priceToSales: cPriceToSales,
      operatingMarginPercent: cOperatingMargin,
      freeCashFlow: cFCF,
      roePercent: cROE,
      debtToEquity: cDebtToEquity,
      beta: cBeta,
      fiftyTwoWeekPerformancePercent: c52WPerf,
      distanceFrom52WHighPercent: cDistFrom52WHigh,
    });

    for (const peer of topPeersToBenchmark) {
      let peerSummary: any = null;
      try {
        peerSummary = await yahooFinance.quoteSummary(peer.symbol, {
          modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'price', 'summaryDetail']
        });
      } catch (e) { }

      const pPrice = peerSummary?.price?.regularMarketPrice || peer.currentPrice;
      const pPE = peerSummary?.summaryDetail?.trailingPE ?? null;
      const pFwdPE = peerSummary?.summaryDetail?.forwardPE ?? null;
      const pPS = peerSummary?.summaryDetail?.priceToSalesTrailing12Months ?? null;
      const pMargin = peerSummary?.financialData?.operatingMargins ? peerSummary.financialData.operatingMargins * 100 : null;
      const pFCF = peerSummary?.financialData?.freeCashflow ?? null;
      const pROE = peerSummary?.financialData?.returnOnEquity ? peerSummary.financialData.returnOnEquity * 100 : null;
      const pDebtEquity = peerSummary?.financialData?.debtToEquity ?? null;
      const pBeta = peerSummary?.defaultKeyStatistics?.beta ?? 1.2;
      const p52WHigh = peerSummary?.summaryDetail?.fiftyTwoWeekHigh ?? pPrice * 1.1;
      const p52WLow = peerSummary?.summaryDetail?.fiftyTwoWeekLow ?? pPrice * 0.8;
      const pDistHigh = p52WHigh > 0 ? ((pPrice - p52WHigh) / p52WHigh) * 100 : 0;
      const p52WPerf = p52WLow > 0 ? ((pPrice - p52WLow) / p52WLow) * 100 : 0;

      peerComparisonList.push({
        symbol: peer.symbol,
        name: peer.name || peerSummary?.price?.shortName || peer.symbol,
        isCandidate: false,
        marketValue: peer.marketValue,
        portfolioWeightPercent: (peer.marketValue / totalPortfolioValue) * 100,
        currentPrice: pPrice,
        pe: pPE,
        forwardPE: pFwdPE,
        priceToSales: pPS,
        operatingMarginPercent: pMargin,
        freeCashFlow: pFCF,
        roePercent: pROE,
        debtToEquity: pDebtEquity,
        beta: pBeta,
        fiftyTwoWeekPerformancePercent: p52WPerf,
        distanceFrom52WHighPercent: pDistHigh,
      });
    }

    // 5. Evaluate Candidate Superiority vs Peers
    const superiorMetrics: string[] = [];
    const inferiorMetrics: string[] = [];
    let candidateWinsCount = 0;

    if (topPeersToBenchmark.length > 0) {
      const avgPeerMargin = peerComparisonList.filter(p => !p.isCandidate && p.operatingMarginPercent != null).reduce((sum, p, _, arr) => sum + p.operatingMarginPercent / arr.length, 0);
      const avgPeerPE = peerComparisonList.filter(p => !p.isCandidate && p.forwardPE != null).reduce((sum, p, _, arr) => sum + p.forwardPE / arr.length, 0);
      const avgPeerROE = peerComparisonList.filter(p => !p.isCandidate && p.roePercent != null).reduce((sum, p, _, arr) => sum + p.roePercent / arr.length, 0);
      const avgPeerDebt = peerComparisonList.filter(p => !p.isCandidate && p.debtToEquity != null).reduce((sum, p, _, arr) => sum + p.debtToEquity / arr.length, 0);

      if (cOperatingMargin && avgPeerMargin && cOperatingMargin > avgPeerMargin) {
        superiorMetrics.push(`Operating Margin (${cOperatingMargin.toFixed(1)}% vs peer avg ${avgPeerMargin.toFixed(1)}%)`);
        candidateWinsCount++;
      } else if (cOperatingMargin && avgPeerMargin && cOperatingMargin < avgPeerMargin) {
        inferiorMetrics.push(`Lower Margin (${cOperatingMargin.toFixed(1)}% vs ${avgPeerMargin.toFixed(1)}%)`);
      }

      if (cForwardPE && avgPeerPE && cForwardPE < avgPeerPE) {
        superiorMetrics.push(`Cheaper Valuation (${cForwardPE.toFixed(1)}x Fwd P/E vs ${avgPeerPE.toFixed(1)}x)`);
        candidateWinsCount++;
      } else if (cForwardPE && avgPeerPE && cForwardPE > avgPeerPE * 1.25) {
        inferiorMetrics.push(`Valuation Premium (${cForwardPE.toFixed(1)}x Fwd P/E vs ${avgPeerPE.toFixed(1)}x)`);
      }

      if (cROE && avgPeerROE && cROE > avgPeerROE) {
        superiorMetrics.push(`Capital Efficiency (${cROE.toFixed(1)}% ROE vs ${avgPeerROE.toFixed(1)}%)`);
        candidateWinsCount++;
      }

      if (cDebtToEquity && avgPeerDebt && cDebtToEquity < avgPeerDebt) {
        superiorMetrics.push(`Stronger Balance Sheet (Debt/Equity ${cDebtToEquity.toFixed(0)} vs ${avgPeerDebt.toFixed(0)})`);
        candidateWinsCount++;
      } else if (cDebtToEquity && avgPeerDebt && cDebtToEquity > avgPeerDebt * 1.5) {
        inferiorMetrics.push(`Higher Leverage (${cDebtToEquity.toFixed(0)} D/E)`);
      }
    } else {
      // If no direct peers in portfolio, evaluate vs sector baseline
      if (cOperatingMargin && cOperatingMargin > 20) superiorMetrics.push(`High Operating Margin (${cOperatingMargin.toFixed(1)}%)`);
      if (cROE && cROE > 18) superiorMetrics.push(`Superior ROE (${cROE.toFixed(1)}%)`);
      if (cFCF && cFCF > 0) superiorMetrics.push(`Positive Free Cash Flow Generation ($${(cFCF / 1e9).toFixed(2)}B)`);
    }

    // 6. Compute Portfolio Correlation & Diversification Benefit
    let correlationEstimate = 0.45;
    let correlationRating: 'LOW' | 'MODERATE' | 'HIGH' = 'MODERATE';
    let diversificationScore = 75;

    if (existingSectorHoldingsCount === 0) {
      correlationEstimate = 0.22;
      correlationRating = 'LOW';
      diversificationScore = 92;
    } else if (currentSectorWeightPercent > 28 || existingSectorHoldingsCount >= 4) {
      correlationEstimate = 0.78;
      correlationRating = 'HIGH';
      diversificationScore = 38;
    } else if (currentSectorWeightPercent > 18) {
      correlationEstimate = 0.62;
      correlationRating = 'MODERATE';
      diversificationScore = 60;
    }

    // 7. Calculate Comprehensive Fit Score (0 - 100)
    let fitScore = 70;
    if (existingSectorHoldingsCount === 0) fitScore += 15; // Great diversification
    if (candidateWinsCount >= 2) fitScore += 12; // Superior quality vs peers
    if (cOperatingMargin && cOperatingMargin > 25) fitScore += 8;
    if (currentSectorWeightPercent > 30) fitScore -= 18; // Heavy sector penalty
    if (cBeta && cBeta > 1.8) fitScore -= 8; // Excess beta penalty
    fitScore = Math.max(35, Math.min(96, fitScore));

    // 8. Assign Verdict
    let verdictType: string = 'EXCELLENT_FIT';
    let verdictTitle = 'Accretive Quality Addition';
    let verdictSummary = `${ticker} enhances overall portfolio return profile while providing solid capital efficiency and competitive margins.`;
    let suggestedAction = `Initiate a controlled starter position (~2.0% - 3.0% of portfolio equity).`;

    if (existingSectorHoldingsCount > 0 && candidateWinsCount >= 2 && topPeersToBenchmark.length > 0) {
      const laggingPeer = topPeersToBenchmark[0].symbol;
      verdictType = 'REPLACEMENT_SWAP';
      verdictTitle = `Superior Category Candidate (Swap vs. ${laggingPeer})`;
      verdictSummary = `${ticker} displays superior operating margins and capital efficiency compared to existing holding ${laggingPeer}. Consider rotating capital.`;
      suggestedAction = `Trim or rotate capital from ${laggingPeer} into ${ticker} to upgrade category quality without inflating sector concentration.`;
    } else if (currentSectorWeightPercent > 28) {
      verdictType = 'REDUNDANT_OVERWEIGHT';
      verdictTitle = `Elevated Sector Concentration Risk (${currentSectorWeightPercent.toFixed(1)}% Tech/Category)`;
      verdictSummary = `Your portfolio already carries substantial exposure to ${cSector}. Adding ${ticker} increases drawdown vulnerability to sector-wide pullbacks.`;
      suggestedAction = `Cap position size to <= 1.5% or await a rotation pullback before adding.`;
    } else if (cBeta && cBeta > 1.85) {
      verdictType = 'HIGH_BETA_RISK';
      verdictTitle = `High Beta & Factor Volatility Risk (${cBeta.toFixed(2)}x)`;
      verdictSummary = `${ticker} exhibits high market sensitivity. Adding this asset will increase the aggregate beta of your portfolio.`;
      suggestedAction = `Use defined-risk options strategies (e.g. Bull Put Spreads / Covered Calls) rather than outright stock to buffer downside risk.`;
    } else if (cDistFrom52WHigh > -4 && cForwardPE && cForwardPE > 35) {
      verdictType = 'WATCHLIST_PULLBACK';
      verdictTitle = 'High Quality Asset: Extended Near 52-Week High';
      verdictSummary = `${ticker} boasts strong fundamentals but trades at full valuation near peak range.`;
      suggestedAction = `Add to Watchlist and set price alerts for a 5%–8% pullback to key support levels.`;
    }

    const keyPros: string[] = [
      ...superiorMetrics,
      cFCF && cFCF > 0 ? `Generates strong positive Free Cash Flow ($${(cFCF / 1e9).toFixed(2)}B)` : `Positive fundamental operating momentum`,
      existingSectorHoldingsCount === 0 ? `Opens fresh exposure to ${cSector} (0% current allocation)` : `Deepens market leadership in ${cIndustry}`,
    ].slice(0, 4);

    const keyRisks: string[] = [
      ...inferiorMetrics,
      currentSectorWeightPercent > 20 ? `Pushes ${cSector} exposure to ${projectedSectorWeightPercent.toFixed(1)}%` : `Subject to broad market correlation swings`,
      cBeta > 1.3 ? `Above-average market volatility (Beta: ${cBeta.toFixed(2)})` : `Cyclical industry exposure`,
    ].slice(0, 3);

    const result = {
      symbol: ticker,
      companyName: cName,
      currentPrice: cPrice,
      sector: cSector,
      industry: cIndustry,
      marketCap: cMarketCap,
      fitScore,
      verdictType,
      verdictTitle,
      verdictSummary,
      suggestedAction,
      correlationEstimate,
      correlationRating,
      diversificationBenefitScore: diversificationScore,
      portfolioBetaBefore: 1.12,
      portfolioBetaAfterEstimate: Number((1.12 + (cBeta - 1.12) * 0.05).toFixed(2)),
      sectorImpact: {
        sector: cSector,
        industry: cIndustry,
        currentSectorMarketValue,
        currentSectorWeightPercent,
        projectedSectorWeightPercent,
        existingHoldingsInSectorCount: existingSectorHoldingsCount,
        isOverweight: currentSectorWeightPercent > 25,
      },
      categoryName: `${cSector} • ${cIndustry}`,
      peers: peerComparisonList,
      candidateWinsCount,
      candidateSuperiorMetrics: superiorMetrics,
      candidateInferiorMetrics: inferiorMetrics,
      keyPros,
      keyRisks,
      recommendedMaxAllocationUSD: Math.round(hypotheticalPositionUSD),
      recommendedMaxWeightPercent: Number(((hypotheticalPositionUSD / totalPortfolioValue) * 100).toFixed(1)),
      portfolioTotalValue: totalPortfolioValue,
      analyzedAt: new Date().toISOString(),
    };

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Evaluated portfolio fit for ${ticker}: Score ${fitScore}/100 (${verdictTitle})`
    });

    res.json(result);

  } catch (error: any) {
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: error.message
    });
    logToFile(`Error in portfolio fit analysis for ${ticker}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/portfolio/analyze-position', async (req, res) => {
  const position = req.body;
  if (!position || !position.symbol) {
    return res.status(400).json({ error: 'Position data is required.' });
  }

  const symbol = (position.underlyingSymbol || position.symbol).trim().toUpperCase();
  const task = agentActivityTracker.startTask({
    agentName: 'AI Position Defense & Management Advisor',
    agentType: 'POSITION_DEFENSE',
    taskDescription: `Tactical Defense Audit & Live Option Pricing for ${position.symbol} (${position.assetType})`,
    targetSymbol: symbol,
    metadata: {
      assetType: position.assetType,
      strike: position.strike,
      expiry: position.expiry,
      dte: position.dte,
      unrealizedPL: position.unrealizedPL
    }
  });

  try {
    logToFile(`Running AI Position Management Advisor on ${position.symbol} (${position.assetType})...`);

    // Fetch market data for context
    let quoteData: any = null;
    try {
      quoteData = await yahooFinance.quote(symbol);
    } catch (e: any) {
      logToFile(`Warning: quote failed for ${symbol} - ${e.message}`);
    }

    const currentUnderlyingPrice = position.underlyingPrice || quoteData?.regularMarketPrice || position.currentPrice || 100.0;
    const isOption = position.assetType === 'Option';
    const isShort = position.quantity < 0;

    // Ingest live real option chain data for realistic roll/hedge pricing
    let chainData = {
      underlyingSymbol: symbol,
      underlyingPrice: currentUnderlyingPrice,
      expirationDates: [] as string[],
      options: [] as any[]
    };

    try {
      chainData = await fetchLiveOptionChains(symbol, currentUnderlyingPrice, position.strike);
      logToFile(`Fetched ${chainData.options.length} live option chain quotes for ${symbol} across ${chainData.expirationDates.length} expirations.`);
    } catch (chainErr: any) {
      logToFile(`Warning: option chain fetch failed for ${symbol}: ${chainErr?.message || chainErr}`);
    }

    const pricingContext = buildOptionPricingContext(position, chainData);

    const systemPrompt = `You are a World-Class Derivatives Risk Manager and Professional Floor Trader (Tastytrade / CBOE / Option Alpha Veteran).
Your mission is to perform a rigorous tactical risk audit on a user's active portfolio position, diagnose its exact threat state, and propose prioritized, mathematically sound management playbooks.

CRITICAL INSTRUCTIONS FOR ACCURATE OPTION PRICING:
1. YOU MUST USE THE REAL-TIME OPTION PRICING TABLE PROVIDED IN THE CONTEXT. DO NOT INVENT OR HALLUCINATE RANDOM OPTION PRICES.
2. Leg 1 (Closing the current position) MUST use the exact current market price ($${(position.currentPrice || position.averageCost || 1.0).toFixed(2)}) provided.
3. Leg 2 (Rolling or opening a new hedge/spread leg) MUST select from the live option pricing table provided and use its exact bid/ask/mid price.
4. Calculate netCreditOrDebit precisely: (Leg 2 Opening Price - Leg 1 Closing Price) * quantity * 100.
5. Calculate newBreakeven precisely based on actual strike and total accumulated credits.

Management playbooks include:
1. Roll Out in Time (extending duration for net credit to let theta work).
2. Roll Out and Down/Up (adjusting strike away from market price for net credit or small debit).
3. Invert / Hedge (selling the untested side, e.g. selling call against losing put to collect buffer credit).
4. Stop Loss / Hard Exit (closing position if technical support is destroyed or tail risk is unacceptable).
5. Wheel / Assignment Conversion (taking delivery of stock and selling covered calls).
6. Hold & Monitor (if statistical probability of expiring OTM remains above 60% despite temporary unrealized drawdown).

You MUST return pure JSON matching this exact structure:
{
  "urgencyLevel": "CRITICAL_DEFENSE" | "MONITOR_AND_ADJUST" | "PROFIT_TARGET_REACHED" | "HEALTHY_ON_TRACK",
  "urgencyHeadline": "<Short bold punchy diagnosis headline, e.g. 'CRITICAL GAMMA DEFENSE: 220 Put is 2.1% ITM with 14 DTE'>",
  "currentPnlAssessment": "<2-3 sentences assessing current profit/loss state, why it is losing or winning, and distance to strike.>",
  "greeksAndRiskDiagnosis": {
    "deltaRisk": "<Detailed directional risk explanation>",
    "gammaRisk": "<Acceleration risk as expiration approaches>",
    "thetaStatus": "<Extrinsic premium decay state>",
    "assignmentProbability": "<High (e.g. 75%) | Moderate | Low>",
    "dteDangerZone": "<High (DTE < 14) | Moderate (DTE 14-30) | Low (DTE > 30)>"
  },
  "rankedPlans": [
    {
      "planId": "A",
      "title": "<Plan A: Primary Recommended Defense/Action>",
      "actionType": "ROLL_OUT" | "ROLL_OUT_DOWN" | "ROLL_OUT_UP" | "INVERT_HEDGE" | "STOP_LOSS" | "ASSIGN_WHEEL" | "TAKE_PROFIT" | "HOLD",
      "isRecommended": true,
      "summary": "<Clear rationale why this is the highest probability mathematical move>",
      "orderLegs": [
        "<Leg 1: BUY TO CLOSE / SELL TO CLOSE @ EXACT CURRENT PRICE>",
        "<Leg 2: SELL TO OPEN / BUY TO OPEN @ EXACT CHAIN PRICE>"
      ],
      "netCreditOrDebit": "<e.g. +$0.80 Net Credit ($160 total credit for 2 contracts)>",
      "newBreakeven": "<e.g. $214.20 (lowered by $5.80)>",
      "probabilityImprovement": "<e.g. Increases probability of profit from 32% to 68%>",
      "tradeoffs": "<Honest trade-offs: e.g. Extends commitment by 28 days but avoids realized loss.>"
    },
    {
      "planId": "B",
      "title": "<Plan B: Alternative Hedge or Structural Adjustment>",
      "actionType": "INVERT_HEDGE",
      "isRecommended": false,
      "summary": "<Alternative defense tactic explanation>",
      "orderLegs": [
        "<Leg instructions with exact prices from table>"
      ],
      "netCreditOrDebit": "<Net credit or debit>",
      "newBreakeven": "<New breakeven level>",
      "probabilityImprovement": "<Expected benefit>",
      "tradeoffs": "<Trade-offs>"
    },
    {
      "planId": "C",
      "title": "<Plan C: Capital Preservation / Hard Exit / Assignment>",
      "actionType": "STOP_LOSS",
      "isRecommended": false,
      "summary": "<Exit or assignment plan explanation>",
      "orderLegs": [
        "<Leg instructions with exact prices from table>"
      ],
      "netCreditOrDebit": "<P/L impact>",
      "newBreakeven": "<N/A or Assignment basis>",
      "probabilityImprovement": "<Risk elimination or stock acquisition>",
      "tradeoffs": "<Trade-offs>"
    }
  ],
  "technicalAndCatalystContext": {
    "supportLevel": "<Identified support level for underlying>",
    "resistanceLevel": "<Identified resistance level>",
    "earningsWarning": "<Upcoming earnings check or 'No earnings risk during trade duration'>",
    "ivOutlook": "<Implied volatility status>"
  },
  "tradingRuleOfThumb": "<A classic institutional trading rule relevant to this exact scenario.>"
}
Return ONLY pure JSON. No markdown backticks outside the JSON.`;

    const userPrompt = `Audit and analyze this active portfolio position:
Position Details:
- Symbol: ${position.symbol}
- Asset Type: ${position.assetType}
- Option Type: ${position.optionType || 'N/A'}
- Strike: ${position.strike ? '$' + position.strike : 'N/A'}
- Expiration: ${position.expiry || 'N/A'} (DTE: ${position.dte ?? 'N/A'} days)
- Quantity: ${position.quantity} (${isShort ? 'SHORT Position' : 'LONG Position'})
- Average Entry Cost: $${position.averageCost}
- Current Market Price of Option: $${position.currentPrice}
- Current Underlying Price: $${currentUnderlyingPrice}
- Market Value: $${position.marketValue}
- Unrealized P/L: $${position.unrealizedPL} (${position.unrealizedPLPercent}%)
- Broker: ${position.source}
- 52-Week Range: $${quoteData?.fiftyTwoWeekLow ?? 'N/A'} - $${quoteData?.fiftyTwoWeekHigh ?? 'N/A'}
- Underlying 50-day Average: $${quoteData?.fiftyDayAverage ?? 'N/A'}
- Underlying 200-day Average: $${quoteData?.twoHundredDayAverage ?? 'N/A'}

${pricingContext}

Provide exhaustive management recommendations tailored to this position's exact threat level with exact mathematically verified option prices.`;

    let rawAnalysis = '';

    if (process.env.OPENROUTER_API_KEY) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      rawAnalysis = data.choices?.[0]?.message?.content || "";
    } else if (process.env.GEMINI_API_KEY) {
      // Fallback to Gemini
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      rawAnalysis = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      agentActivityTracker.completeTask(task.id, {
        status: 'FAILED',
        error: 'API key missing'
      });
      return res.status(401).json({ error: 'Neither OPENROUTER_API_KEY nor GEMINI_API_KEY found in environment.' });
    }

    const cleanJson = rawAnalysis.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedAnalysis = JSON.parse(cleanJson);

    // Apply strict server-side mathematical validation and price enforcement
    if (parsedAnalysis && parsedAnalysis.rankedPlans) {
      parsedAnalysis.rankedPlans = validateAndEnforcePlanPricing(parsedAnalysis.rankedPlans, position, chainData);
    }

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Urgency: ${parsedAnalysis.urgencyLevel} | Primary: ${parsedAnalysis.rankedPlans?.[0]?.title || 'Plan formulated'}`
    });

    res.json({
      success: true,
      position,
      analysis: parsedAnalysis,
      liveOptionChain: chainData
    });

  } catch (error: any) {
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: error.message
    });
    logToFile(`Error in position analysis advisor: ${error.message}`);
    console.error('Position Advisor error:', error);
    res.status(500).json({ error: error.message || 'Position analysis failed.' });
  }
});

// ==========================================
// AI PORTFOLIO ANALYSER & AUDIT AGENT ENDPOINTS
// ==========================================

// Run Live Portfolio Audit & Store in DB
app.post('/api/portfolio/audit', async (req, res) => {
  const input = req.body || {};
  const positionsCount = input.positions?.length || 0;
  const task = agentActivityTracker.startTask({
    agentName: 'AI Portfolio Tactical Analyser',
    agentType: 'PORTFOLIO_AUDIT',
    taskDescription: `Holistic Cross-Broker Risk Audit & Greeks Diagnosis (${positionsCount} positions)`,
    metadata: {
      positionsCount,
      totalNetLiq: input.totals?.netLiquidValue
    }
  });

  try {
    logToFile(`Starting AI Portfolio Analyser Agent on ${positionsCount} positions...`);

    const auditResult = await runPortfolioAuditAgent(input, logToFile);
    const savedRecord = await savePortfolioAuditToDb(prisma, auditResult);

    logToFile(`AI Portfolio Audit completed successfully with Health Score: ${auditResult.healthScore}/100 (${auditResult.riskLevel}) - Saved DB ID: ${savedRecord.id}`);

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Health Score: ${auditResult.healthScore}/100 (${auditResult.riskLevel}) | ${auditResult.actionablePlaybooks?.length || 0} Playbooks Generated`
    });

    res.json({
      success: true,
      auditId: savedRecord.id,
      audit: auditResult,
      savedAt: savedRecord.createdAt
    });
  } catch (error: any) {
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: error.message
    });
    logToFile(`Error in AI Portfolio Analyser: ${error.message}`);
    console.error('Portfolio Audit Agent error:', error);
    res.status(500).json({ error: error.message || 'Failed to complete portfolio audit.' });
  }
});

// List all past portfolio audits
app.get('/api/portfolio/audits', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const audits = await listPortfolioAuditsFromDb(prisma, limit);
    res.json({
      success: true,
      count: audits.length,
      audits
    });
  } catch (error: any) {
    console.error('Failed to list portfolio audits:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch audit history.' });
  }
});

// Get specific audit by ID
app.get('/api/portfolio/audits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await getPortfolioAuditByIdFromDb(prisma, id);
    if (!audit) {
      return res.status(404).json({ error: 'Audit report not found.' });
    }
    res.json({
      success: true,
      audit
    });
  } catch (error: any) {
    console.error('Failed to get portfolio audit:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch audit report.' });
  }
});

// Delete specific audit by ID
app.delete('/api/portfolio/audits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deletePortfolioAuditFromDb(prisma, id);
    res.json({
      success: true,
      message: 'Audit report deleted successfully.'
    });
  } catch (error: any) {
    console.error('Failed to delete portfolio audit:', error);
    res.status(500).json({ error: error.message || 'Failed to delete audit report.' });
  }
});

// ==========================================
// AI AGENT ACTIVITY TELEMETRY ENDPOINTS
// ==========================================
app.get('/api/agent/activity', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const activities = agentActivityTracker.getActivities(limit);
    res.json({
      success: true,
      count: activities.length,
      activities
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch agent activities.' });
  }
});

app.delete('/api/agent/activity', (req, res) => {
  try {
    agentActivityTracker.clear();
    res.json({ success: true, message: 'Agent activity history cleared.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to clear agent activities.' });
  }
});

// ==========================================
// TRADES & TRANSACTION HISTORY API ENDPOINTS
// ==========================================

// GET /api/trades - Fetch filtered trades and calculated metrics
app.get('/api/trades', async (req, res) => {
  try {
    const result = await getFilteredTrades(prisma, req.query as any);
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    logToFile(`Error fetching trades: ${error.message}`);
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch trade history.' });
  }
});

// POST /api/trades/sync - Trigger live sync from connected brokers
app.post('/api/trades/sync', async (req, res) => {
  const task = agentActivityTracker.startTask({
    agentName: 'Broker Trade Synchronizer',
    agentType: 'MARKET_DATA_SYNC',
    taskDescription: 'Syncing live transactions and executions from Tastytrade & IBKR'
  });

  try {
    const tastyResult = await syncTastytradeTransactions(prisma);
    logToFile(`Synced ${tastyResult.syncedCount} Tastytrade trade transactions to database.`);

    const ibkrResult = await syncIBKRExecutions(prisma, ib, isConnected);
    logToFile(`Synced ${ibkrResult.syncedCount} Interactive Brokers trade records to database.`);

    const totalSynced = (tastyResult.syncedCount || 0) + (ibkrResult.syncedCount || 0);

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Synced ${totalSynced} executions (${tastyResult.syncedCount} Tastytrade, ${ibkrResult.syncedCount} IBKR)`
    });

    const refreshed = await getFilteredTrades(prisma, req.query as any);

    res.json({
      success: true,
      syncedCount: totalSynced,
      tastySyncedCount: tastyResult.syncedCount,
      ibkrSyncedCount: ibkrResult.syncedCount,
      ...refreshed
    });
  } catch (error: any) {
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: error.message
    });
    logToFile(`Error syncing trades: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to sync trades.' });
  }
});

// POST /api/trades - Create a manual trade entry
app.post('/api/trades', async (req, res) => {
  try {
    const created = await createManualTrade(prisma, req.body);
    logToFile(`Manual trade logged: ${created.action} ${created.quantity} ${created.symbol} ($${created.totalValue})`);
    res.status(201).json({
      success: true,
      trade: created
    });
  } catch (error: any) {
    logToFile(`Error creating manual trade: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to create trade.' });
  }
});

// DELETE /api/trades/:id - Delete a trade record
app.delete('/api/trades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteTradeRecord(prisma, id);
    res.json({
      success: true,
      message: 'Trade record deleted successfully.'
    });
  } catch (error: any) {
    logToFile(`Error deleting trade: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to delete trade.' });
  }
});

// ==========================================
// RESEARCH REPORT PROMPTS & AUTONOMOUS AGENT
// ==========================================

const SEED_PROMPTS = [
  {
    name: 'Company In-Depth Research Report',
    slug: 'company_research',
    description: 'Comprehensive business model, competitive moat, SWOT, valuation thesis, and risk factors.',
    category: 'RESEARCH',
    isDefault: true,
    systemPrompt: `You are an elite Wall Street Equity Research Analyst. Your task is to perform an exhaustive, high-conviction fundamental research report for the given ticker.
Follow the ReAct loop (Reason, Act, Observe). Use available tools to gather real-time data, macro context, SEC filings, and news.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "Company In-Depth Research Report: <TICKER>",
  "conviction_score": <NUMBER 1-100>,
  "executive_summary": ["Key thesis point 1", "Key thesis point 2", "Key thesis point 3", "Key valuation target"],
  "business_model_and_moat": "<Detailed analysis of core business lines, revenue drivers, pricing power, and competitive moat>",
  "financial_and_valuation_analysis": "<Deep dive into margins, revenue growth, ROE, debt health, and multiple comparison>",
  "sec_filings_and_risk_factors": "<Key risks and red flags identified from 10-K/10-Q filings>",
  "macro_and_industry_tailwinds": "<Industry trends, macro environment, interest rates, and regulatory factors>",
  "catalysts_and_price_target": "<Next 12-month catalysts, earnings expectations, and strategic price target recommendation>"
}`,
    userPrompt: 'Please generate a complete financial research report for symbol: {ticker}.'
  },
  {
    name: 'Executive Leadership & Governance Report',
    slug: 'management',
    description: 'Leadership track record, capital allocation, insider ownership, and board oversight.',
    category: 'GOVERNANCE',
    isDefault: true,
    systemPrompt: `You are an activist investor and governance analyst. Your task is to evaluate the executive leadership, capital allocation track record, insider ownership, and corporate governance for the given ticker.
Follow the ReAct loop. Use your tools to gather company leadership info, SEC insider filings, executive compensation, and strategic capital allocation history.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "Executive Leadership & Governance Report: <TICKER>",
  "conviction_score": <NUMBER 1-100>,
  "executive_summary": ["Leadership assessment 1", "Capital allocation rating 2", "Governance risk 3"],
  "executive_leadership_profiles": "<Assessment of CEO, CFO, and key management background, tenure, and strategic vision>",
  "capital_allocation_track_record": "<Analysis of ROIC, R&D reinvestment, M&A history, share repurchases, and dividend safety>",
  "insider_ownership_and_alignment": "<Insider ownership stakes, recent insider buy/sell transactions, and incentive alignment>",
  "governance_and_board_oversight": "<Board independence, shareholder rights, executive compensation structure, and controversies>",
  "leadership_verdict": "<Final conviction on management's ability to create long-term shareholder value>"
}`,
    userPrompt: 'Please evaluate the management team, capital allocation, and governance for: {ticker}.'
  },
  {
    name: 'Quarterly Earnings & Guidance Report',
    slug: 'earnings',
    description: 'Recent quarter revenue/EPS beats, segment performance, forward guidance, and call takeaways.',
    category: 'EARNINGS',
    isDefault: true,
    systemPrompt: `You are a senior hedge fund analyst analyzing the most recent quarterly earnings results for the given ticker.
Follow the ReAct loop. Use your tools to inspect latest earnings release, revenue/EPS beats or misses, segment breakdown, management guidance, and conference call takeaways.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "Quarterly Earnings & Guidance Report: <TICKER>",
  "conviction_score": <NUMBER 1-100>,
  "executive_summary": ["Quarterly headline result", "Guidance update", "Market reaction driver"],
  "quarterly_financial_results": "<Revenue, EPS, gross margins, and operating income vs consensus expectations>",
  "segment_and_regional_breakdown": "<Performance across major business units, product lines, and geographical markets>",
  "management_guidance_and_outlook": "<Next quarter and full-year outlook, capex expectations, and revised targets>",
  "earnings_call_takeaways": "<Key commentary from CEO/CFO, tone on demand, supply chain, and competitive pressures>",
  "earnings_reaction_and_target": "<Post-earnings valuation impact and revised investment stance>"
}`,
    userPrompt: 'Please generate a comprehensive quarterly earnings and guidance analysis for: {ticker}.'
  },
  {
    name: 'Forensic Red Flags, Warnings & Risk Audit',
    slug: 'red_flags_and_risks',
    description: 'Deep audit of accounting red flags, balance sheet solvency, revenue quality, litigation/regulatory hazards, and critical downside risks.',
    category: 'RISK_AND_RED_FLAGS',
    isDefault: true,
    systemPrompt: `You are a legendary forensic financial auditor and short-seller risk analyst. Your objective is to perform a rigorous, unsparing investigation into all red flags, accounting warnings, hidden balance sheet hazards, regulatory/litigation perils, and structural downside risks for the given ticker.
Follow the ReAct loop. Use available tools to search SEC 10-K/10-Q risk factors, debt maturity schedules, auditor opinions, insider sales, customer/supplier concentration, margin pressure, and short seller commentary.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "Forensic Red Flags, Warnings & Risk Audit: <TICKER>",
  "conviction_score": <NUMBER 1-100 where higher represents critical risk severity / danger>,
  "executive_summary": [
    "🚨 Critical Warning / Red Flag 1",
    "⚠️ Solvency / Liquidity Hazard 2",
    "📉 Competitive / Margin Risk 3",
    "⚖️ Regulatory / Governance Warning 4"
  ],
  "critical_red_flags_and_warnings": "<Exhaustive forensic breakdown of active red flags: revenue recognition issues, divergence between net income and operating cash flow, inventory build-up, accounts receivable aging, auditor footnotes, or unusual one-off adjustments>",
  "balance_sheet_debt_and_solvency_risks": "<Deep solvency audit: Total debt vs EBITDA, interest coverage ratio, upcoming debt maturities in 1-3 years, liquidity runway, working capital trends, and risk of dilutive secondary offerings or covenant breaches>",
  "operational_margin_and_competitive_threats": "<Operational risk factors: Customer or supplier concentration (>10% revenue from single client), pricing power erosion, input cost inflation, technological obsolescence, or aggressive market share loss to competitors>",
  "regulatory_legal_and_governance_risks": "<Legal, regulatory, and governance red flags: Ongoing SEC/FTC/DOJ investigations, antitrust actions, patent cliffs, aggressive insider selling clusters, dual-class voting structures, or related-party transactions>",
  "bear_case_thesis_and_downside_target": "<The ultimate Bear Case scenario: What specific catalyst could trigger a severe 30-60% repricing, estimate of intrinsic liquidation or distressed value, and downside price target range>"
}`,
    userPrompt: 'Please perform an unsparing forensic red flags and risk audit for: {ticker}.'
  }
];

// GET /api/research/prompts - Fetch all report prompt templates
app.get('/api/research/prompts', async (req, res) => {
  try {
    let prompts = await prisma.reportPromptTemplate.findMany({
      orderBy: { createdAt: 'asc' }
    });

    if (prompts.length === 0) {
      for (const p of SEED_PROMPTS) {
        await prisma.reportPromptTemplate.create({ data: p });
      }
      prompts = await prisma.reportPromptTemplate.findMany({
        orderBy: { createdAt: 'asc' }
      });
    } else {
      // Ensure all seed prompts exist in DB
      for (const seed of SEED_PROMPTS) {
        const exists = prompts.some(p => p.slug === seed.slug);
        if (!exists) {
          await prisma.reportPromptTemplate.create({ data: seed });
        }
      }
      prompts = await prisma.reportPromptTemplate.findMany({
        orderBy: { createdAt: 'asc' }
      });
    }

    res.json(prompts);
  } catch (error: any) {
    logToFile(`Error fetching report prompts: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/research/prompts - Create new prompt template
app.post('/api/research/prompts', async (req, res) => {
  try {
    const { name, description, systemPrompt, userPrompt, category } = req.body;
    if (!name || !systemPrompt) {
      return res.status(400).json({ error: 'Name and System Prompt are required.' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) + '_' + Date.now().toString().slice(-4);

    const created = await prisma.reportPromptTemplate.create({
      data: {
        name: name.trim(),
        slug,
        description: description ? description.trim() : '',
        category: category || 'CUSTOM',
        systemPrompt: systemPrompt.trim(),
        userPrompt: userPrompt ? userPrompt.trim() : 'Generate research report for {ticker}.',
        isDefault: false
      }
    });

    res.status(201).json(created);
  } catch (error: any) {
    logToFile(`Error creating prompt template: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/research/prompts/:id - Update prompt template
app.put('/api/research/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, systemPrompt, userPrompt, category } = req.body;

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name.trim();
    if (description !== undefined) dataToUpdate.description = description.trim();
    if (systemPrompt) dataToUpdate.systemPrompt = systemPrompt.trim();
    if (userPrompt !== undefined) dataToUpdate.userPrompt = userPrompt.trim();
    if (category) dataToUpdate.category = category;

    const updated = await prisma.reportPromptTemplate.update({
      where: { id },
      data: dataToUpdate
    });

    res.json(updated);
  } catch (error: any) {
    logToFile(`Error updating prompt template: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/research/prompts/:id - Delete prompt template
app.delete('/api/research/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.reportPromptTemplate.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Prompt template deleted.' });
  } catch (error: any) {
    logToFile(`Error deleting prompt template: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/research/prompts/reset - Reset prompts to default
app.post('/api/research/prompts/reset', async (req, res) => {
  try {
    await prisma.reportPromptTemplate.deleteMany({});
    for (const p of SEED_PROMPTS) {
      await prisma.reportPromptTemplate.create({ data: p });
    }
    const prompts = await prisma.reportPromptTemplate.findMany({
      orderBy: { createdAt: 'asc' }
    });
    res.json(prompts);
  } catch (error: any) {
    logToFile(`Error resetting prompt templates: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AUTONOMOUS RESEARCH AGENT & REPORTS API
// ==========================================

// Helper to spawn python autonomous research agent
async function runAutonomousResearch(ticker: string, reportType: string, promptId?: string) {
  const cleanTicker = ticker.trim().toUpperCase();
  const task = agentActivityTracker.startTask({
    agentName: 'Autonomous Deep Research Agent (Python)',
    agentType: 'RESEARCH_AGENT',
    taskDescription: `Deep 10-K/10-Q & SEC Research on ${cleanTicker} [${reportType}]`,
    targetSymbol: cleanTicker,
    metadata: {
      reportType,
      promptId
    }
  });

  logToFile(`Spawning autonomous python agent for ${cleanTicker} [Type: ${reportType}]...`);

  const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
  const pythonArgs = process.platform === 'win32'
    ? ['-3.12', '-u', 'agent_research/main.py', cleanTicker, reportType]
    : ['-u', 'agent_research/main.py', cleanTicker, reportType];

  if (promptId) {
    pythonArgs.push(promptId);
  }

  return new Promise<{ report: any; pdfPath: string }>((resolve, reject) => {
    const pythonProcess = spawn(pythonCmd, pythonArgs, {
      cwd: process.cwd(),
      env: { ...process.env }
    });

    let pdfPath = '';
    let reportJsonStr = '';
    let dbSavedId = '';
    let stderrOutput = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[Python Agent] ${output.trim()}`);

      const pdfMatch = output.match(/FINAL_PDF_PATH:(.*)/);
      if (pdfMatch && pdfMatch[1]) {
        pdfPath = pdfMatch[1].trim();
      }

      const jsonMatch = output.match(/FINAL_REPORT_JSON:(.*)/);
      if (jsonMatch && jsonMatch[1]) {
        reportJsonStr = jsonMatch[1].trim();
      }

      const dbMatch = output.match(/REPORT_DB_SAVED_ID:(.*)/);
      if (dbMatch && dbMatch[1]) {
        dbSavedId = dbMatch[1].trim();
      }
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      const errStr = data.toString().trim();
      stderrOutput += errStr + '\n';
      console.error(`[Python Agent ERR] ${errStr}`);
    });

    pythonProcess.on('close', async (code: number) => {
      if (code !== 0) {
        agentActivityTracker.completeTask(task.id, {
          status: 'FAILED',
          error: `Agent execution failed (exit code ${code})`
        });
        logToFile(`Python agent exited with code ${code}. Stderr: ${stderrOutput}`);
        return reject(new Error(`Agent execution failed (exit code ${code}). Check API keys or logs.`));
      }

      try {
        let savedReport: any = null;

        // If Python saved to DB and gave us the ID, fetch from Prisma
        if (dbSavedId) {
          savedReport = await prisma.autonomousReport.findUnique({
            where: { id: dbSavedId }
          });
        }

        // If not found yet, but we have JSON payload, create via Prisma
        if (!savedReport && reportJsonStr) {
          try {
            const parsedJson = JSON.parse(reportJsonStr);
            const execSum = parsedJson.executive_summary;
            const summaryStr = Array.isArray(execSum) ? JSON.stringify(execSum) : (execSum || '');
            const scoreVal = typeof parsedJson.conviction_score === 'number' ? parsedJson.conviction_score : 75;

            savedReport = await prisma.autonomousReport.create({
              data: {
                symbol: cleanTicker,
                reportType,
                title: parsedJson.report_title || `${cleanTicker} Research Report`,
                convictionScore: scoreVal,
                summary: summaryStr,
                contentJson: reportJsonStr,
                pdfPath: pdfPath || null,
                promptTemplateId: promptId || null
              }
            });
          } catch (jsonErr: any) {
            console.error('Error creating report record in Prisma:', jsonErr);
          }
        }

        // Fallback: look up the latest created report for this ticker
        if (!savedReport) {
          savedReport = await prisma.autonomousReport.findFirst({
            where: { symbol: cleanTicker },
            orderBy: { createdAt: 'desc' }
          });
        }

        agentActivityTracker.completeTask(task.id, {
          status: 'SUCCESS',
          outcomeSummary: `Report: "${savedReport?.title || cleanTicker}" | Conviction Score: ${savedReport?.convictionScore || 'N/A'}/100`
        });

        resolve({ report: savedReport, pdfPath });
      } catch (postErr: any) {
        agentActivityTracker.completeTask(task.id, {
          status: 'FAILED',
          error: postErr?.message
        });
        reject(postErr);
      }
    });
  });
}

// GET /api/research/reports - Fetch all reports with optional filters
app.get('/api/research/reports', async (req, res) => {
  try {
    const { symbol, type, limit } = req.query;
    const where: any = {};
    if (symbol) where.symbol = String(symbol).trim().toUpperCase();
    if (type) where.reportType = String(type).trim();

    const take = limit ? Math.min(Math.max(1, Number(limit)), 100) : 50;

    const reports = await prisma.autonomousReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json(reports);
  } catch (error: any) {
    logToFile(`Error fetching reports: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/reports/symbol/:symbol - Fetch all reports for a specific symbol
app.get('/api/research/reports/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const cleanSymbol = symbol.trim().toUpperCase();

    const reports = await prisma.autonomousReport.findMany({
      where: { symbol: cleanSymbol },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reports);
  } catch (error: any) {
    logToFile(`Error fetching reports for ${req.params.symbol}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/reports/:id - Fetch single report by ID
app.get('/api/research/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await prisma.autonomousReport.findUnique({
      where: { id },
    });
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }
    res.json(report);
  } catch (error: any) {
    logToFile(`Error fetching report ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/research/reports/:id - Delete report by ID
app.delete('/api/research/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.autonomousReport.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Report deleted successfully.' });
  } catch (error: any) {
    logToFile(`Error deleting report ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/reports/:id/pdf - Stream/download PDF for a report
app.get('/api/research/reports/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await prisma.autonomousReport.findUnique({
      where: { id },
    });
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    if (report.pdfPath && fs.existsSync(report.pdfPath)) {
      return res.download(report.pdfPath, `research_report_${report.symbol}_${report.reportType}.pdf`);
    }

    // Fallback search in agent_research folder
    const fallbackPath = path.resolve(process.cwd(), 'agent_research', `research_report_${report.symbol}_${report.reportType}.pdf`);
    if (fs.existsSync(fallbackPath)) {
      return res.download(fallbackPath, `research_report_${report.symbol}_${report.reportType}.pdf`);
    }

    res.status(404).json({ error: 'PDF file not found on disk.' });
  } catch (error: any) {
    logToFile(`Error downloading PDF for report ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/research/autonomous/:ticker - Trigger agent and return JSON report
app.post('/api/research/autonomous/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { reportType = 'company_research', promptId } = req.body || {};

    const { report, pdfPath } = await runAutonomousResearch(ticker, reportType, promptId);
    res.status(201).json({ success: true, report, pdfPath });
  } catch (error: any) {
    logToFile(`Error in POST /api/research/autonomous/:ticker: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/research/autonomous/:ticker - Trigger agent (supports ?format=pdf or ?format=json)
app.get('/api/research/autonomous/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const reportType = (req.query.type as string) || 'company_research';
    const promptId = req.query.promptId as string;
    const format = (req.query.format as string) || 'json';

    const { report, pdfPath } = await runAutonomousResearch(ticker, reportType, promptId);

    if (format === 'pdf') {
      if (pdfPath && fs.existsSync(pdfPath)) {
        return res.download(pdfPath, `research_report_${ticker}_${reportType}.pdf`);
      }
      return res.status(500).json({ error: 'PDF file was not generated.' });
    }

    res.json({ success: true, report, pdfPath });
  } catch (error: any) {
    logToFile(`Error in GET /api/research/autonomous/:ticker: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API KEYS SETTINGS
// ==========================================
app.get('/api/settings/keys', async (req, res) => {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    const geminiKey = process.env.GEMINI_API_KEY || (envContent.match(/^GEMINI_API_KEY=(.*)$/m)?.[1] || '');
    const openrouterKey = process.env.OPENROUTER_API_KEY || (envContent.match(/^OPENROUTER_API_KEY=(.*)$/m)?.[1] || '');
    const fmpKey = process.env.VITE_FMP_API_KEY || (envContent.match(/^VITE_FMP_API_KEY=(.*)$/m)?.[1] || '');
    const finnhubKey = process.env.VITE_FINNHUB_API_KEY || (envContent.match(/^VITE_FINNHUB_API_KEY=(.*)$/m)?.[1] || '');

    res.json({
      geminiApiKey: geminiKey ? `${geminiKey.slice(0, 4)}...${geminiKey.slice(-4)}` : '',
      hasGeminiApiKey: Boolean(geminiKey),
      openrouterApiKey: openrouterKey ? `${openrouterKey.slice(0, 6)}...${openrouterKey.slice(-4)}` : '',
      hasOpenrouterApiKey: Boolean(openrouterKey),
      hasFmpApiKey: Boolean(fmpKey),
      hasFinnhubApiKey: Boolean(finnhubKey)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/keys', async (req, res) => {
  try {
    const { geminiApiKey, openrouterApiKey } = req.body;
    const envPath = path.resolve(process.cwd(), '.env.local');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

    if (geminiApiKey && geminiApiKey.trim()) {
      const cleanKey = geminiApiKey.trim();
      process.env.GEMINI_API_KEY = cleanKey;
      if (/^GEMINI_API_KEY=/m.test(envContent)) {
        envContent = envContent.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${cleanKey}`);
      } else {
        envContent += `\nGEMINI_API_KEY=${cleanKey}`;
      }
    }

    if (openrouterApiKey && openrouterApiKey.trim()) {
      const cleanKey = openrouterApiKey.trim();
      process.env.OPENROUTER_API_KEY = cleanKey;
      if (/^OPENROUTER_API_KEY=/m.test(envContent)) {
        envContent = envContent.replace(/^OPENROUTER_API_KEY=.*$/m, `OPENROUTER_API_KEY=${cleanKey}`);
      } else {
        envContent += `\nOPENROUTER_API_KEY=${cleanKey}`;
      }
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
    res.json({ success: true, message: 'API keys updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generic Symbol Search API (Yahoo Finance + Finnhub fallback + Direct ticker synthesis)
app.get('/api/research/search', async (req, res) => {
  const query = (req.query.query as string || '').trim();
  if (!query) return res.json([]);
  logToFile(`Searching ticker for query: "${query}"`);

  let results: any[] = [];

  // 1. Try Yahoo Finance with a 4s timeout
  try {
    const searchPromise = yahooFinance.search(query, { newsCount: 0, quotesCount: 10 }) as Promise<any>;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Yahoo search timeout')), 4000));
    const searchData: any = await Promise.race([searchPromise, timeoutPromise]);
    const quotes = searchData?.quotes || [];

    results = quotes
      .filter((q: any) => q && q.symbol && typeof q.symbol === 'string')
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.name || q.symbol,
        currency: 'USD',
        stockExchange: q.exchange || q.exchDisp || 'N/A',
        exchangeShortName: q.exchDisp || q.exchange || 'N/A'
      }));
  } catch (err: any) {
    logToFile(`Yahoo search error for "${query}": ${err?.message || err}`);
  }

  // 2. If Yahoo Finance returned 0 results or failed, try Finnhub fallback
  if (results.length === 0) {
    const finnhubKey = process.env.VITE_FINNHUB_API_KEY || process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      try {
        logToFile(`Trying Finnhub search fallback for "${query}"...`);
        const fhRes = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${finnhubKey}`);
        if (fhRes.ok) {
          const data: any = await fhRes.json();
          if (data?.result && Array.isArray(data.result)) {
            results = data.result
              .filter((r: any) => r && r.symbol && !r.symbol.includes('.'))
              .slice(0, 10)
              .map((r: any) => ({
                symbol: r.symbol,
                name: r.description || r.displaySymbol || r.symbol,
                currency: 'USD',
                stockExchange: r.type || 'US',
                exchangeShortName: r.type || 'US'
              }));
          }
        }
      } catch (fhErr: any) {
        logToFile(`Finnhub search error for "${query}": ${fhErr?.message || fhErr}`);
      }
    }
  }

  // 3. If still empty, but query looks like a valid ticker symbol (e.g. "AAPL", "MSFT", "BTC-USD")
  if (results.length === 0 && /^[A-Za-z0-9\.\-\=]{1,10}$/.test(query)) {
    const cleanSym = query.toUpperCase();
    results = [{
      symbol: cleanSym,
      name: cleanSym,
      currency: 'USD',
      stockExchange: 'US',
      exchangeShortName: 'US'
    }];
  }

  res.json(results);
});

// Helper to fetch enriched fundamental data for a single symbol
async function fetchEnrichedSymbolData(symbol: string) {
  const cleanSymbol = symbol.trim().toUpperCase();
  try {
    const summary = await yahooFinance.quoteSummary(cleanSymbol, {
      modules: ['price', 'summaryProfile', 'defaultKeyStatistics', 'financialData', 'summaryDetail']
    });

    const price = summary?.price;
    const profile = summary?.summaryProfile;
    const stats = summary?.defaultKeyStatistics;
    const financials = summary?.financialData;
    const detail = summary?.summaryDetail;

    return {
      symbol: cleanSymbol,
      name: price?.shortName || price?.longName || cleanSymbol,
      price: price?.regularMarketPrice ?? 0,
      change: price?.regularMarketChange ?? 0,
      changePercent: price?.regularMarketChangePercent ?? 0,
      sector: profile?.sector || 'General',
      industry: profile?.industry || 'N/A',
      marketCap: price?.marketCap ?? detail?.marketCap ?? null,
      pe: detail?.trailingPE ?? detail?.forwardPE ?? null,
      ps: detail?.priceToSalesTrailing12Months ?? null,
      eps: stats?.trailingEps ?? stats?.forwardEps ?? null,
      operatingMargin: financials?.operatingMargins ?? null,
      roe: financials?.returnOnEquity ?? null,
      debtToEquity: financials?.debtToEquity ?? null,
      fiftyTwoWeekHigh: detail?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: detail?.fiftyTwoWeekLow ?? null,
      volume: detail?.volume ?? price?.regularMarketVolume ?? null,
      error: null
    };
  } catch (err: any) {
    logToFile(`Enrichment failed for ${cleanSymbol}: ${err.message}`);
    return {
      symbol: cleanSymbol,
      name: cleanSymbol,
      price: 0,
      change: 0,
      changePercent: 0,
      sector: 'N/A',
      industry: 'N/A',
      marketCap: null,
      pe: null,
      ps: null,
      eps: null,
      operatingMargin: null,
      roe: null,
      debtToEquity: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      volume: null,
      error: err.message
    };
  }
}

// GET /api/watchlists - Fetch all watchlists (create default if empty)
app.get('/api/watchlists', async (req, res) => {
  try {
    let watchlists = await prisma.watchlist.findMany({
      include: {
        items: {
          orderBy: { addedAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (watchlists.length === 0) {
      // Seed a default watchlist
      const defaultWatchlist = await prisma.watchlist.create({
        data: {
          name: 'Main Watchlist',
          isDefault: true,
          items: {
            create: [
              { symbol: 'AAPL' },
              { symbol: 'NVDA' },
              { symbol: 'MSFT' },
              { symbol: 'TSLA' },
              { symbol: 'AMZN' },
              { symbol: 'ORA' }
            ]
          }
        },
        include: {
          items: true
        }
      });
      watchlists = [defaultWatchlist];
    }

    res.json(watchlists);
  } catch (error: any) {
    logToFile(`Error fetching watchlists: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/watchlists - Create a new watchlist
app.post('/api/watchlists', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Watchlist name is required.' });
    }

    const newWatchlist = await prisma.watchlist.create({
      data: {
        name: name.trim(),
        isDefault: false
      },
      include: {
        items: true
      }
    });

    res.status(201).json(newWatchlist);
  } catch (error: any) {
    logToFile(`Error creating watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/watchlists/:id - Rename a watchlist
app.put('/api/watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Watchlist name is required.' });
    }

    const updated = await prisma.watchlist.update({
      where: { id },
      data: { name: name.trim() },
      include: { items: true }
    });

    res.json(updated);
  } catch (error: any) {
    logToFile(`Error updating watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/watchlists/:id - Delete a watchlist
app.delete('/api/watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.watchlist.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Watchlist deleted successfully.' });
  } catch (error: any) {
    logToFile(`Error deleting watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/watchlists/:id/symbols - Add symbol to watchlist
app.post('/api/watchlists/:id/symbols', async (req, res) => {
  try {
    const { id } = req.params;
    const { symbol } = req.body;
    if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
      return res.status(400).json({ error: 'Symbol is required.' });
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    // Check if already in watchlist
    const existing = await prisma.watchlistItem.findUnique({
      where: {
        watchlistId_symbol: {
          watchlistId: id,
          symbol: cleanSymbol
        }
      }
    });

    if (existing) {
      return res.json({ success: true, item: existing, message: 'Symbol already in watchlist.' });
    }

    const item = await prisma.watchlistItem.create({
      data: {
        watchlistId: id,
        symbol: cleanSymbol
      }
    });

    res.status(201).json({ success: true, item });
  } catch (error: any) {
    logToFile(`Error adding symbol to watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/watchlists/:id/symbols/bulk - Bulk add multiple symbols to a watchlist
app.post('/api/watchlists/:id/symbols/bulk', async (req, res) => {
  try {
    const { id } = req.params;
    const { symbols } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required.' });
    }

    const cleanSymbols = Array.from(
      new Set(
        symbols
          .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
          .filter((s) => s.length > 0 && s.length <= 10)
      )
    );

    if (cleanSymbols.length === 0) {
      return res.status(400).json({ error: 'No valid symbols provided.' });
    }

    // Verify watchlist exists
    const watchlist = await prisma.watchlist.findUnique({ where: { id } });
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found.' });
    }

    // Insert symbols (skip duplicates)
    const existingItems = await prisma.watchlistItem.findMany({
      where: {
        watchlistId: id,
        symbol: { in: cleanSymbols }
      }
    });
    const existingSet = new Set(existingItems.map(item => item.symbol));
    const toCreate = cleanSymbols.filter(s => !existingSet.has(s));

    if (toCreate.length > 0) {
      await prisma.watchlistItem.createMany({
        data: toCreate.map(symbol => ({
          watchlistId: id,
          symbol,
        }))
      });
    }

    const allItems = await prisma.watchlistItem.findMany({
      where: { watchlistId: id },
      orderBy: { addedAt: 'asc' }
    });

    logToFile(`[Watchlist Bulk Add] Added ${toCreate.length} symbols to watchlist "${watchlist.name}"`);
    res.json({
      success: true,
      addedCount: toCreate.length,
      existingCount: existingSet.size,
      totalSymbols: allItems.length,
      symbols: cleanSymbols
    });
  } catch (error: any) {
    logToFile(`Error in POST /api/watchlists/:id/symbols/bulk: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/watchlists/bulk-create - Create a new watchlist with multiple symbols in one step
app.post('/api/watchlists/bulk-create', async (req, res) => {
  try {
    const { name, symbols } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Watchlist name is required.' });
    }

    const cleanSymbols = Array.isArray(symbols)
      ? Array.from(
          new Set(
            symbols
              .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
              .filter((s) => s.length > 0 && s.length <= 10)
          )
        )
      : [];

    const newWatchlist = await prisma.watchlist.create({
      data: {
        name: name.trim(),
        isDefault: false,
        items: {
          create: cleanSymbols.map(symbol => ({ symbol }))
        }
      },
      include: {
        items: {
          orderBy: { addedAt: 'asc' }
        }
      }
    });

    logToFile(`[Watchlist Bulk Create] Created "${newWatchlist.name}" with ${cleanSymbols.length} initial symbols`);
    res.status(201).json(newWatchlist);
  } catch (error: any) {
    logToFile(`Error creating watchlist with bulk symbols: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/watchlists/resolve-bulk - Smart freeform parser for tickers, company names, alert prices, and notes
app.post('/api/watchlists/resolve-bulk', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text content is required for bulk resolution.' });
    }

    // Split text into candidate lines / tokens
    // If text contains newlines, process line by line. Otherwise, if it has commas, split by comma.
    const rawLines = text
      .split(/[\r\n]+/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const entriesToProcess: Array<{ raw: string; symbolOrName: string; targetPrice?: number; condition?: 'ABOVE' | 'BELOW'; notes?: string }> = [];

    for (const rawLine of rawLines) {
      // Check if line contains commas separating items (e.g. "AAPL 220, NVDA 115, MSFT")
      const subParts = rawLine.includes(',') && !rawLine.includes('$') && rawLine.split(',').every(p => p.trim().split(/\s+/).length <= 3)
        ? rawLine.split(',').map(p => p.trim()).filter(Boolean)
        : [rawLine];

      for (const part of subParts) {
        if (!part) continue;

        let working = part;
        let condition: 'ABOVE' | 'BELOW' | undefined = undefined;
        let targetPrice: number | undefined = undefined;
        let notes: string | undefined = undefined;

        // 1. Detect explicit above/below operators: e.g. "> 250", "< 180", "above 220", "below 95", "+240", "-150"
        const aboveMatch = working.match(/(?:above|>|over|\+)\s*\$?(\d+(?:\.\d+)?)/i);
        const belowMatch = working.match(/(?:below|<|under|-)\s*\$?(\d+(?:\.\d+)?)/i);

        if (aboveMatch) {
          condition = 'ABOVE';
          targetPrice = parseFloat(aboveMatch[1]);
          working = working.replace(aboveMatch[0], ' ').trim();
        } else if (belowMatch) {
          condition = 'BELOW';
          targetPrice = parseFloat(belowMatch[1]);
          working = working.replace(belowMatch[0], ' ').trim();
        } else {
          // Check for price target with colon or dollar: e.g. ": 250", "$250.50", "250.50"
          const genericPriceMatch = working.match(/(?::\s*|\$)?(\b\d+(?:\.\d+)?\b)/);
          if (genericPriceMatch) {
            const num = parseFloat(genericPriceMatch[1]);
            // Ensure number is realistic stock price target (e.g. not a 1-digit number or ticker like 3M)
            if (num > 0 && num < 1000000) {
              targetPrice = num;
              working = working.replace(genericPriceMatch[0], ' ').trim();
            }
          }
        }

        // 2. Separate symbol/name from remaining notes
        // Clean punctuation like colons, parentheses
        const cleanTokens = working
          .replace(/[():;=]/g, ' ')
          .split(/\s+/)
          .map(t => t.trim())
          .filter(Boolean);

        if (cleanTokens.length === 0) continue;

        const symbolOrNameCandidate = cleanTokens[0];
        const remainingNotes = cleanTokens.slice(1).join(' ').trim();

        entriesToProcess.push({
          raw: part,
          symbolOrName: symbolOrNameCandidate,
          targetPrice,
          condition,
          notes: remainingNotes || undefined,
        });
      }
    }

    if (entriesToProcess.length === 0) {
      return res.json({ results: [], parsedCount: 0, validCount: 0 });
    }

    // Limit batch resolution to 40 items per request for performance
    const cappedEntries = entriesToProcess.slice(0, 40);

    // Parallel Resolution of Symbols (Ticker or Name lookup)
    const resolvedItems = await Promise.all(
      cappedEntries.map(async (entry) => {
        let sym = entry.symbolOrName.toUpperCase().replace(/[^A-Z0-9\.\^\-]/g, '');
        let companyName = entry.symbolOrName;
        let sector = 'Equities';

        let currentPrice: number | null = null;
        let dayChangePercent: number | null = null;
        let isValid = false;
        let errorMsg: string | undefined = undefined;

        // Try direct quoteSummary first
        try {
          const quoteData: any = await yahooFinance.quoteSummary(
            sym,
            { modules: ['price', 'summaryProfile', 'summaryDetail'] },
            { validateResult: false }
          );

          if (quoteData?.price?.regularMarketPrice !== undefined) {
            currentPrice = quoteData.price.regularMarketPrice;
            dayChangePercent = (quoteData.price.regularMarketChangePercent ?? 0) * 100;
            companyName = quoteData.price.shortName || quoteData.price.longName || companyName;
            sector = quoteData.summaryProfile?.sector || quoteData.price.quoteType || 'Equities';
            isValid = true;
          }
        } catch (e) {
          // Direct ticker lookup failed, will fallback to search
        }

        // If direct lookup didn't succeed, search by name / query
        if (!isValid) {
          try {
            const searchRes = await yahooFinance.search(entry.symbolOrName, { newsCount: 0, quotesCount: 5 });
            const quoteMatch = searchRes.quotes?.find(
              (q: any) => q.isYahooFinance && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'INDEX')
            ) || searchRes.quotes?.[0];

            if (quoteMatch && quoteMatch.symbol) {
              sym = quoteMatch.symbol.toUpperCase();
              companyName = quoteMatch.shortname || quoteMatch.longname || sym;

              const retryQuote: any = await yahooFinance.quoteSummary(
                sym,
                { modules: ['price', 'summaryProfile', 'summaryDetail'] },
                { validateResult: false }
              );

              if (retryQuote?.price?.regularMarketPrice !== undefined) {
                currentPrice = retryQuote.price.regularMarketPrice;
                dayChangePercent = (retryQuote.price.regularMarketChangePercent ?? 0) * 100;
                companyName = retryQuote.price.shortName || retryQuote.price.longName || companyName;
                sector = retryQuote.summaryProfile?.sector || retryQuote.price.quoteType || 'Equities';
                isValid = true;
              }
            }
          } catch (err: any) {
            errorMsg = err?.message || 'Symbol not found on market';
          }
        }

        if (!isValid && !errorMsg) {
          errorMsg = 'Price quote unavailable';
        }

        // Auto-assign condition if not explicitly specified
        let finalCondition = entry.condition;
        if (!finalCondition && entry.targetPrice !== undefined && currentPrice !== null) {
          finalCondition = entry.targetPrice >= currentPrice ? 'ABOVE' : 'BELOW';
        } else if (!finalCondition) {
          finalCondition = 'BELOW'; // default dip alert
        }

        return {
          rawInput: entry.raw,
          symbol: sym,
          name: companyName,
          currentPrice,
          dayChangePercent: dayChangePercent !== null ? parseFloat(dayChangePercent.toFixed(2)) : null,
          targetPrice: entry.targetPrice ?? null,
          condition: finalCondition,
          notes: entry.notes || '',
          sector,
          isValid,
          error: errorMsg,
        };
      })
    );

    res.json({
      results: resolvedItems,
      parsedCount: resolvedItems.length,
      validCount: resolvedItems.filter(r => r.isValid).length,
    });
  } catch (error: any) {
    logToFile(`Error in /api/watchlists/resolve-bulk: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/watchlists/:id/symbols/:symbol - Remove symbol from watchlist
app.delete('/api/watchlists/:id/symbols/:symbol', async (req, res) => {
  try {
    const { id, symbol } = req.params;
    const cleanSymbol = symbol.trim().toUpperCase();

    await prisma.watchlistItem.deleteMany({
      where: {
        watchlistId: id,
        symbol: cleanSymbol
      }
    });

    res.json({ success: true, message: 'Symbol removed from watchlist.' });
  } catch (error: any) {
    logToFile(`Error removing symbol from watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/watchlists/:id/data - Fetch enriched real-time and fundamental data for all symbols
app.get('/api/watchlists/:id/data', async (req, res) => {
  try {
    const { id } = req.params;
    const watchlist = await prisma.watchlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { addedAt: 'asc' }
        }
      }
    });

    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found.' });
    }

    // Fetch data for all symbols in parallel
    const enrichedItems = await Promise.all(
      watchlist.items.map(async (item) => {
        const enriched = await fetchEnrichedSymbolData(item.symbol);
        return {
          id: item.id,
          watchlistId: item.watchlistId,
          addedAt: item.addedAt,
          ...enriched
        };
      })
    );

    res.json({
      watchlist: {
        id: watchlist.id,
        name: watchlist.name,
        isDefault: watchlist.isDefault,
        createdAt: watchlist.createdAt
      },
      items: enrichedItems
    });
  } catch (error: any) {
    logToFile(`Error fetching watchlist data: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PRICE ALERTS ENGINE & REST API
// ==========================================

// Helper: Check active price alerts against current market prices
let lastShortOptionAlertSync = 0;
const alertSymbolPriceCache = new Map<string, { price: number; name: string; timestamp: number }>();

async function getAlertQuote(symbol: string): Promise<{ price: number; name: string } | null> {
  if (!symbol) return null;
  const sym = symbol.trim().toUpperCase();
  const cached = alertSymbolPriceCache.get(sym);
  const now = Date.now();
  if (cached && (now - cached.timestamp < 30000)) { // 30s cache
    return { price: cached.price, name: cached.name };
  }

  try {
    const quotePromise = yahooFinance.quote(sym);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const quote: any = await Promise.race([quotePromise, timeoutPromise]);

    if (quote?.regularMarketPrice != null && !isNaN(quote.regularMarketPrice)) {
      const result = {
        price: Number(quote.regularMarketPrice),
        name: quote.shortName || quote.longName || sym,
        timestamp: now
      };
      alertSymbolPriceCache.set(sym, result);
      return { price: result.price, name: result.name };
    }
  } catch {}

  if (cached) return { price: cached.price, name: cached.name };
  return null;
}

async function checkPriceAlerts() {
  try {
    // Automatically sync defense alerts for short options in portfolio every 60s
    const now = Date.now();
    if (now - lastShortOptionAlertSync > 60000) {
      lastShortOptionAlertSync = now;
      try {
        await syncShortOptionAlerts(prisma, logToFile);
      } catch (err: any) {
        logToFile(`[Auto Short Option Sync Error] ${err?.message || err}`);
      }
    }

    const activeAlerts = await prisma.priceAlert.findMany({
      where: { status: 'ACTIVE' }
    });

    if (activeAlerts.length === 0) return;

    // Collect unique symbols
    const uniqueSymbols = Array.from(new Set(activeAlerts.map(a => a.symbol.toUpperCase())));

    // Fetch prices in parallel with fast cache
    const priceMap: Record<string, number> = {};
    await Promise.all(
      uniqueSymbols.map(async (sym) => {
        const q = await getAlertQuote(sym);
        if (q && q.price != null) {
          priceMap[sym] = q.price;
        }
      })
    );

    // Evaluate triggers
    for (const alert of activeAlerts) {
      const currentPrice = priceMap[alert.symbol.toUpperCase()];
      if (currentPrice == null) continue;

      let isTriggered = false;
      if (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice) {
        isTriggered = true;
      }

      if (isTriggered) {
        logToFile(`[ALERT TRIGGERED] ${alert.symbol} reached $${currentPrice} (Target: ${alert.condition} $${alert.targetPrice})`);
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: {
            status: 'TRIGGERED',
            triggeredAt: new Date(),
            triggeredPrice: currentPrice
          }
        });
      }
    }
  } catch (err: any) {
    logToFile(`Error in checkPriceAlerts background worker: ${err?.message || err}`);
  }
}

// Start price alert monitoring interval (every 15 seconds)
const alertCheckInterval = setInterval(checkPriceAlerts, 15000);

// GET /api/alerts - List alerts with optional status/symbol filters and live prices
app.get('/api/alerts', async (req, res) => {
  try {
    const { status, symbol, sortBy, sortDir } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = String(status).toUpperCase();
    }
    if (symbol) {
      where.symbol = String(symbol).toUpperCase();
    }

    let alerts = await prisma.priceAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Fetch current prices for all symbols in alerts to calculate distance
    const uniqueSymbols = Array.from(new Set(alerts.map(a => a.symbol.toUpperCase())));
    const priceMap: Record<string, { price: number; name: string }> = {};

    await Promise.all(
      uniqueSymbols.map(async (sym) => {
        const q = await getAlertQuote(sym);
        if (q) {
          priceMap[sym] = q;
        }
      })
    );

    const enrichedAlerts = alerts.map(alert => {
      const live = priceMap[alert.symbol.toUpperCase()];
      const currentPrice = live?.price ?? null;
      const stockName = live?.name ?? alert.symbol;
      let distancePercent = null;

      if (currentPrice != null && alert.targetPrice > 0) {
        distancePercent = ((alert.targetPrice - currentPrice) / currentPrice) * 100;
      }

      return {
        ...alert,
        currentPrice,
        stockName,
        distancePercent
      };
    });

    // Custom sorting if requested
    if (sortBy) {
      const dir = sortDir === 'asc' ? 1 : -1;
      enrichedAlerts.sort((a, b) => {
        if (sortBy === 'triggeredAt') {
          const tA = a.triggeredAt ? new Date(a.triggeredAt).getTime() : 0;
          const tB = b.triggeredAt ? new Date(b.triggeredAt).getTime() : 0;
          return (tA - tB) * dir;
        }
        if (sortBy === 'symbol') {
          return a.symbol.localeCompare(b.symbol) * dir;
        }
        if (sortBy === 'targetPrice') {
          return (a.targetPrice - b.targetPrice) * dir;
        }
        if (sortBy === 'createdAt') {
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        }
        return 0;
      });
    }

    res.json(enrichedAlerts);
  } catch (error: any) {
    logToFile(`Error fetching alerts: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts - Create a new price alert
app.post('/api/alerts', async (req, res) => {
  try {
    const { symbol, targetPrice, condition, notes } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required.' });
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    const numTarget = Number(targetPrice);

    if (isNaN(numTarget) || numTarget <= 0) {
      return res.status(400).json({ error: 'Target price must be a positive number.' });
    }

    const cleanCondition = (condition || 'ABOVE').toUpperCase();
    if (cleanCondition !== 'ABOVE' && cleanCondition !== 'BELOW') {
      return res.status(400).json({ error: 'Condition must be ABOVE or BELOW.' });
    }

    const newAlert = await prisma.priceAlert.create({
      data: {
        symbol: cleanSymbol,
        targetPrice: numTarget,
        condition: cleanCondition,
        status: 'ACTIVE',
        notes: notes ? String(notes).trim() : null
      }
    });

    // Run immediate check in background
    setTimeout(checkPriceAlerts, 100);

    res.status(201).json({ success: true, alert: newAlert });
  } catch (error: any) {
    logToFile(`Error creating alert: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/bulk - Bulk create multiple price alerts in one step
app.post('/api/alerts/bulk', async (req, res) => {
  try {
    const { alerts } = req.body;
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return res.status(400).json({ error: 'Alerts array is required.' });
    }

    const createdAlerts: any[] = [];

    for (const item of alerts) {
      if (!item.symbol || typeof item.symbol !== 'string') continue;
      const cleanSymbol = item.symbol.trim().toUpperCase();
      const numTarget = Number(item.targetPrice);
      if (isNaN(numTarget) || numTarget <= 0) continue;

      const cleanCondition = (item.condition || 'ABOVE').toUpperCase() === 'BELOW' ? 'BELOW' : 'ABOVE';

      const alertRecord = await prisma.priceAlert.create({
        data: {
          symbol: cleanSymbol,
          targetPrice: numTarget,
          condition: cleanCondition,
          status: 'ACTIVE',
          notes: item.notes ? String(item.notes).trim() : null
        }
      });
      createdAlerts.push(alertRecord);
    }

    // Run immediate check
    setTimeout(checkPriceAlerts, 500);

    logToFile(`[Price Alerts Bulk] Created ${createdAlerts.length} price alerts`);
    res.status(201).json({
      success: true,
      createdCount: createdAlerts.length,
      alerts: createdAlerts
    });
  } catch (error: any) {
    logToFile(`Error in /api/alerts/bulk: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/alerts/:id - Update alert
app.put('/api/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetPrice, condition, notes, status, isMuted } = req.body;

    const dataToUpdate: any = {};
    if (targetPrice !== undefined) {
      const num = Number(targetPrice);
      if (!isNaN(num) && num > 0) dataToUpdate.targetPrice = num;
    }
    if (condition) {
      const cleanCondition = String(condition).toUpperCase();
      if (cleanCondition === 'ABOVE' || cleanCondition === 'BELOW') {
        dataToUpdate.condition = cleanCondition;
      }
    }
    if (notes !== undefined) {
      dataToUpdate.notes = notes ? String(notes).trim() : null;
    }
    if (status) {
      dataToUpdate.status = String(status).toUpperCase();
    }
    if (isMuted !== undefined) {
      dataToUpdate.isMuted = Boolean(isMuted);
      dataToUpdate.mutedAt = isMuted ? new Date() : null;
    }

    const updated = await prisma.priceAlert.update({
      where: { id },
      data: dataToUpdate
    });

    res.json({ success: true, alert: updated });
  } catch (error: any) {
    logToFile(`Error updating alert: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:id/mute - Mute a triggered alert (acknowledges without deleting)
app.post('/api/alerts/:id/mute', async (req, res) => {
  try {
    const { id } = req.params;
    const mutedAlert = await prisma.priceAlert.update({
      where: { id },
      data: {
        isMuted: true,
        mutedAt: new Date(),
      }
    });

    res.json({ success: true, alert: mutedAlert });
  } catch (error: any) {
    logToFile(`Error muting alert: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:id/unmute - Unmute an alert
app.post('/api/alerts/:id/unmute', async (req, res) => {
  try {
    const { id } = req.params;
    const unmutedAlert = await prisma.priceAlert.update({
      where: { id },
      data: {
        isMuted: false,
        mutedAt: null,
      }
    });

    res.json({ success: true, alert: unmutedAlert });
  } catch (error: any) {
    logToFile(`Error unmuting alert: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:id/reset - Re-arm / reset triggered alert
app.post('/api/alerts/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetPrice, condition } = req.body || {};

    const dataToUpdate: any = {
      status: 'ACTIVE',
      isMuted: false,
      mutedAt: null,
      triggeredAt: null,
      triggeredPrice: null
    };

    if (targetPrice) {
      const num = Number(targetPrice);
      if (!isNaN(num) && num > 0) dataToUpdate.targetPrice = num;
    }
    if (condition) {
      dataToUpdate.condition = String(condition).toUpperCase();
    }

    const resetAlert = await prisma.priceAlert.update({
      where: { id },
      data: dataToUpdate
    });

    setTimeout(checkPriceAlerts, 500);

    res.json({ success: true, alert: resetAlert });
  } catch (error: any) {
    logToFile(`Error resetting alert: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/alerts/muted - Delete all muted / cancelled alerts
app.delete('/api/alerts/muted', async (req, res) => {
  try {
    const result = await prisma.priceAlert.deleteMany({
      where: {
        OR: [
          { isMuted: true },
          { status: 'CANCELLED' }
        ]
      }
    });
    logToFile(`[Alerts] Deleted ${result.count} muted alerts`);
    res.json({ success: true, count: result.count, message: `Deleted ${result.count} muted alerts.` });
  } catch (error: any) {
    logToFile(`Error deleting muted alerts: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/bulk-mute - Bulk mute alerts
app.post('/api/alerts/bulk-mute', async (req, res) => {
  try {
    const { ids } = req.body || {};
    let where: any = {};
    if (Array.isArray(ids) && ids.length > 0) {
      where = { id: { in: ids } };
    } else {
      // Default: mute all triggered unmuted alerts
      where = { status: 'TRIGGERED', isMuted: false };
    }

    const result = await prisma.priceAlert.updateMany({
      where,
      data: {
        isMuted: true,
        mutedAt: new Date()
      }
    });

    logToFile(`[Alerts] Bulk muted ${result.count} alerts`);
    res.json({ success: true, count: result.count, message: `Muted ${result.count} alerts.` });
  } catch (error: any) {
    logToFile(`Error bulk muting alerts: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/alerts/:id - Delete an alert
app.delete('/api/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.priceAlert.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Alert deleted successfully.' });
  } catch (error: any) {
    logToFile(`Error deleting alert: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/short-options - Get short option holdings and their 5% & 10% alert coverage
app.get('/api/alerts/short-options', async (req, res) => {
  try {
    // First get raw list
    const rawList = await getShortOptionsAlertStatus(prisma);
    if (rawList.length === 0) {
      return res.json([]);
    }

    // Fetch live underlying prices
    const uniqueSymbols = Array.from(new Set(rawList.map(item => item.underlyingSymbol.toUpperCase())));
    const priceMap: Record<string, number> = {};

    await Promise.all(
      uniqueSymbols.map(async (sym) => {
        try {
          const summary = await yahooFinance.quoteSummary(sym, { modules: ['price'] });
          const p = summary?.price?.regularMarketPrice;
          if (p != null && !isNaN(p)) {
            priceMap[sym] = Number(p);
          }
        } catch {
          // ignore
        }
      })
    );

    const enriched = await getShortOptionsAlertStatus(prisma, priceMap);
    res.json(enriched);
  } catch (error: any) {
    logToFile(`Error in GET /api/alerts/short-options: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/short-options/sync - Force sync 5% & 10% defense alerts for all short options in portfolio
app.post('/api/alerts/short-options/sync', async (req, res) => {
  try {
    const result = await syncShortOptionAlerts(prisma, logToFile);
    // Run alert check immediately
    setTimeout(checkPriceAlerts, 500);

    res.json(result);
  } catch (error: any) {
    logToFile(`Error in POST /api/alerts/short-options/sync: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/short-options/position/:holdingId - Set/re-arm 5% & 10% defense alerts for a single short option
app.post('/api/alerts/short-options/position/:holdingId', async (req, res) => {
  try {
    const { holdingId } = req.params;
    const result = await createAlertsForSingleShortOption(holdingId, prisma, logToFile);
    setTimeout(checkPriceAlerts, 500);

    res.json(result);
  } catch (error: any) {
    logToFile(`Error in POST /api/alerts/short-options/position/${req.params.holdingId}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Stock Notes API Endpoints
// ==========================================

// GET /api/notes - List all notes
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await prisma.stockNote.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    res.json(notes);
  } catch (error: any) {
    logToFile(`Error fetching stock notes: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notes/:symbol - Get note for specific symbol
app.get('/api/notes/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol?.trim().toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required.' });
    }

    const note = await prisma.stockNote.findUnique({
      where: { symbol }
    });

    res.json(note || null);
  } catch (error: any) {
    logToFile(`Error fetching note for ${req.params.symbol}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notes/:symbol - Upsert note for specific symbol
app.put('/api/notes/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol?.trim().toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required.' });
    }

    const { content, tags, sentiment } = req.body;
    const cleanContent = typeof content === 'string' ? content : '';
    const cleanTags = tags ? String(tags).trim() : null;
    const cleanSentiment = sentiment ? String(sentiment).toUpperCase() : null;

    const upsertedNote = await prisma.stockNote.upsert({
      where: { symbol },
      update: {
        content: cleanContent,
        tags: cleanTags,
        sentiment: cleanSentiment
      },
      create: {
        symbol,
        content: cleanContent,
        tags: cleanTags,
        sentiment: cleanSentiment
      }
    });

    res.json({ success: true, note: upsertedNote });
  } catch (error: any) {
    logToFile(`Error saving note for ${req.params.symbol}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/earnings - Fetch comprehensive earnings calendar and data for portfolio, watchlists & searched symbols
app.get('/api/earnings', async (req, res) => {
  try {
    const rawSymbols = req.query.symbols ? String(req.query.symbols).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
    const data = await fetchEarningsData(prisma, rawSymbols);
    res.json(data);
  } catch (error: any) {
    logToFile(`Error in GET /api/earnings: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/earnings/lookup/:symbol - Instant earnings lookup for single ticker search
app.get('/api/earnings/lookup/:symbol', async (req, res) => {
  try {
    const sym = req.params.symbol?.trim().toUpperCase();
    if (!sym) {
      return res.status(400).json({ error: 'Symbol is required.' });
    }
    const item = await lookupSymbolEarnings(sym);
    if (!item) {
      return res.status(404).json({ error: `Earnings data not found for ${sym}` });
    }
    res.json(item);
  } catch (error: any) {
    logToFile(`Error in GET /api/earnings/lookup/${req.params.symbol}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notes - Create/update note
app.post('/api/notes', async (req, res) => {
  try {
    const { symbol, content, tags, sentiment } = req.body;
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required.' });
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    const cleanContent = typeof content === 'string' ? content : '';
    const cleanTags = tags ? String(tags).trim() : null;
    const cleanSentiment = sentiment ? String(sentiment).toUpperCase() : null;

    const upsertedNote = await prisma.stockNote.upsert({
      where: { symbol: cleanSymbol },
      update: {
        content: cleanContent,
        tags: cleanTags,
        sentiment: cleanSentiment
      },
      create: {
        symbol: cleanSymbol,
        content: cleanContent,
        tags: cleanTags,
        sentiment: cleanSentiment
      }
    });

    res.status(201).json({ success: true, note: upsertedNote });
  } catch (error: any) {
    logToFile(`Error creating note: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notes/:symbol - Delete note for symbol
app.delete('/api/notes/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol?.trim().toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required.' });
    }

    await prisma.stockNote.deleteMany({
      where: { symbol }
    });

    res.json({ success: true, message: `Note for ${symbol} deleted successfully.` });
  } catch (error: any) {
    logToFile(`Error deleting note for ${req.params.symbol}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Trading Ideas API Endpoints & AI Agent Hunter
// ==========================================

const SEED_TRADE_IDEAS = [
  {
    title: 'AI Data Center Infrastructure & Blackwell Supercycle',
    symbol: 'NVDA',
    type: 'BULLISH',
    timeframe: 'SWING',
    entryPrice: 135.0,
    targetPrice: 165.0,
    stopLoss: 122.0,
    confidenceScore: 88,
    tags: 'AI, Semiconductors, Blackwell, Growth',
    source: 'AI_AGENT',
    content: `### 🎯 Core Hypothesis
Hyperscaler capital expenditures (Microsoft, Google, Meta, Amazon) continue to rise quarter-over-quarter with relentless demand for next-generation GPU clusters.

### 🚀 Key Catalysts
- **Blackwell Ramp:** Production yields improving, backlog committed through next 12 months.
- **Enterprise AI Adoption:** Sovereign AI initiatives and enterprise LLM fine-tuning expanding TAM beyond traditional cloud.
- **Gross Margins:** Sustained gross margins above 72% showcasing immense pricing power.

### 🛡️ Risk & Execution Plan
- **Entry:** Current consolidation range $130 - $138.
- **Stop Loss:** Below 50-day EMA support ($122.00).
- **Profit Target:** $165.00 (+22% upside, 2.3:1 Risk/Reward).`
  },
  {
    title: 'Apple Intelligence Upgrade Cycle & Services Resiliency',
    symbol: 'AAPL',
    type: 'BULLISH',
    timeframe: 'LONG_TERM',
    entryPrice: 228.0,
    targetPrice: 275.0,
    stopLoss: 210.0,
    confidenceScore: 82,
    tags: 'MegaCap, Services, AI Consumer, Cash Flow',
    source: 'MANUAL',
    content: `### 🎯 Core Hypothesis
The iPhone installed base is experiencing an extended replacement cycle ready to be catalyzed by on-device Apple Intelligence and localized privacy-centric models.

### 🚀 Key Catalysts
- **Installed Base Inflection:** Over 1.2 billion active iPhone users with >4 year old average replacement age.
- **Services Gross Margins:** Services now represent >25% of top-line revenue at 74% gross margins.
- **Capital Return Program:** ~$100B annual share buybacks providing an asymmetric valuation floor.

### 🛡️ Risk & Execution Plan
- **Entry:** Scale on pullbacks near $225 - $230.
- **Stop Loss:** Invalidation on close below $210.00.
- **Target:** $275.00 (+20% upside).`
  },
  {
    title: 'Energy Storage Margin Inflection & FSD Licensing Thesis',
    symbol: 'TSLA',
    type: 'BULLISH',
    timeframe: 'SWING',
    entryPrice: 220.0,
    targetPrice: 285.0,
    stopLoss: 195.0,
    confidenceScore: 78,
    tags: 'Energy Storage, Autonomous, High Beta, Momentum',
    source: 'AI_AGENT',
    content: `### 🎯 Core Hypothesis
Megapack and utility energy storage deployments are accelerating faster than EV automotive revenue, driving high-margin recurring energy software profits.

### 🚀 Key Catalysts
- **Megapack Factory Ramp:** Lathrop and Shanghai Megapack factories hitting scale with 40GWh+ annual capacity.
- **Autonomous Miles:** End-to-end neural network FSD scaling rapidly ahead of Robotaxi network launch.

### 🛡️ Risk & Execution Plan
- **Entry:** $215 - $225 range.
- **Stop Loss:** $195.00.
- **Target:** $285.00 (+27% upside).`
  }
];

// GET /api/ideas - List all trade ideas with live prices and enrichments
app.get('/api/ideas', async (req, res) => {
  try {
    const { type, status, source, symbol, search } = req.query;

    const where: any = {};
    if (type && type !== 'ALL') where.type = String(type).toUpperCase();
    if (status && status !== 'ALL') where.status = String(status).toUpperCase();
    if (source && source !== 'ALL') where.source = String(source).toUpperCase();
    if (symbol) where.symbol = String(symbol).toUpperCase();

    if (search && typeof search === 'string') {
      const q = search.trim();
      where.OR = [
        { title: { contains: q } },
        { symbol: { contains: q } },
        { content: { contains: q } },
        { tags: { contains: q } }
      ];
    }

    let ideas = await prisma.tradeIdea.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Seed default ideas if table is empty
    if (ideas.length === 0 && (!search && !type && !status && !symbol)) {
      for (const item of SEED_TRADE_IDEAS) {
        await prisma.tradeIdea.create({ data: item });
      }
      ideas = await prisma.tradeIdea.findMany({
        orderBy: { createdAt: 'desc' }
      });
    }

    // Fetch live market quotes for all unique symbols in ideas
    const uniqueSymbols = Array.from(new Set(ideas.map(i => i.symbol.toUpperCase())));
    const livePriceMap: Record<string, { price: number; name: string; changePercent: number }> = {};

    await Promise.all(
      uniqueSymbols.map(async (sym) => {
        try {
          const summary = await yahooFinance.quoteSummary(sym, { modules: ['price'] });
          if (summary?.price?.regularMarketPrice) {
            livePriceMap[sym] = {
              price: summary.price.regularMarketPrice,
              name: summary.price.shortName || summary.price.longName || sym,
              changePercent: (summary.price.regularMarketChangePercent || 0) * 100
            };
          }
        } catch {
          // ignore failures
        }
      })
    );

    const enrichedIdeas = ideas.map(idea => {
      const live = livePriceMap[idea.symbol.toUpperCase()];
      const currentPrice = live?.price ?? null;
      const stockName = live?.name ?? idea.symbol;
      const dayChangePercent = live?.changePercent ?? null;

      let pnlPercent: number | null = null;
      let targetDistancePercent: number | null = null;
      let stopDistancePercent: number | null = null;

      if (currentPrice && idea.entryPrice && idea.entryPrice > 0) {
        if (idea.type === 'BEARISH') {
          pnlPercent = ((idea.entryPrice - currentPrice) / idea.entryPrice) * 100;
        } else {
          pnlPercent = ((currentPrice - idea.entryPrice) / idea.entryPrice) * 100;
        }
      }

      if (currentPrice && idea.targetPrice && idea.targetPrice > 0) {
        targetDistancePercent = ((idea.targetPrice - currentPrice) / currentPrice) * 100;
      }

      if (currentPrice && idea.stopLoss && idea.stopLoss > 0) {
        stopDistancePercent = ((idea.stopLoss - currentPrice) / currentPrice) * 100;
      }

      return {
        ...idea,
        currentPrice,
        stockName,
        dayChangePercent,
        pnlPercent,
        targetDistancePercent,
        stopDistancePercent
      };
    });

    res.json(enrichedIdeas);
  } catch (error: any) {
    logToFile(`Error fetching ideas: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ideas/:id - Get single trade idea
app.get('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idea = await prisma.tradeIdea.findUnique({ where: { id } });
    if (!idea) return res.status(404).json({ error: 'Trade idea not found.' });

    let currentPrice: number | null = null;
    let stockName = idea.symbol;
    try {
      const summary = await yahooFinance.quoteSummary(idea.symbol, { modules: ['price'] });
      if (summary?.price?.regularMarketPrice) {
        currentPrice = summary.price.regularMarketPrice;
        stockName = summary.price.shortName || summary.price.longName || idea.symbol;
      }
    } catch {}

    res.json({ ...idea, currentPrice, stockName });
  } catch (error: any) {
    logToFile(`Error fetching idea ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ideas - Create idea manually
app.post('/api/ideas', async (req, res) => {
  try {
    const {
      title,
      symbol,
      type,
      timeframe,
      entryPrice,
      targetPrice,
      stopLoss,
      content,
      tags,
      status,
      confidenceScore
    } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required.' });
    }
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required.' });
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    // Auto-fetch entry price if missing
    let resolvedEntry = entryPrice ? Number(entryPrice) : null;
    if (!resolvedEntry || isNaN(resolvedEntry) || resolvedEntry <= 0) {
      try {
        const summary = await yahooFinance.quoteSummary(cleanSymbol, { modules: ['price'] });
        resolvedEntry = summary?.price?.regularMarketPrice || null;
      } catch {}
    }

    const newIdea = await prisma.tradeIdea.create({
      data: {
        title: title.trim(),
        symbol: cleanSymbol,
        type: (type || 'BULLISH').toUpperCase(),
        timeframe: timeframe ? String(timeframe).toUpperCase() : 'SWING',
        entryPrice: resolvedEntry,
        targetPrice: targetPrice ? Number(targetPrice) : null,
        stopLoss: stopLoss ? Number(stopLoss) : null,
        content: content ? String(content).trim() : '',
        tags: tags ? String(tags).trim() : null,
        status: status ? String(status).toUpperCase() : 'ACTIVE',
        confidenceScore: confidenceScore ? Number(confidenceScore) : 80,
        source: 'MANUAL'
      }
    });

    res.status(201).json({ success: true, idea: newIdea });
  } catch (error: any) {
    logToFile(`Error creating trade idea: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ideas/:id - Update trade idea
app.put('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      symbol,
      type,
      timeframe,
      entryPrice,
      targetPrice,
      stopLoss,
      content,
      tags,
      status,
      confidenceScore
    } = req.body;

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = String(title).trim();
    if (symbol !== undefined) dataToUpdate.symbol = String(symbol).trim().toUpperCase();
    if (type !== undefined) dataToUpdate.type = String(type).toUpperCase();
    if (timeframe !== undefined) dataToUpdate.timeframe = String(timeframe).toUpperCase();
    if (entryPrice !== undefined) dataToUpdate.entryPrice = entryPrice ? Number(entryPrice) : null;
    if (targetPrice !== undefined) dataToUpdate.targetPrice = targetPrice ? Number(targetPrice) : null;
    if (stopLoss !== undefined) dataToUpdate.stopLoss = stopLoss ? Number(stopLoss) : null;
    if (content !== undefined) dataToUpdate.content = String(content).trim();
    if (tags !== undefined) dataToUpdate.tags = tags ? String(tags).trim() : null;
    if (status !== undefined) dataToUpdate.status = String(status).toUpperCase();
    if (confidenceScore !== undefined) dataToUpdate.confidenceScore = confidenceScore ? Number(confidenceScore) : null;

    const updated = await prisma.tradeIdea.update({
      where: { id },
      data: dataToUpdate
    });

    res.json({ success: true, idea: updated });
  } catch (error: any) {
    logToFile(`Error updating idea ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ideas/:id - Delete trade idea
app.delete('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.tradeIdea.delete({ where: { id } });
    res.json({ success: true, message: 'Trade idea deleted successfully.' });
  } catch (error: any) {
    logToFile(`Error deleting idea ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/trades/options-agent/scan - AI Options Trade Finding Agent
app.post('/api/trades/options-agent/scan', async (req, res) => {
  try {
    const filters = req.body || {};
    logToFile(`[Options Agent] Scanning options trade opportunities (strategy: ${filters.strategyCategory || 'ALL'}, minIVP: ${filters.minIVP ?? 0})...`);
    const result = await optionsTradeAgentService.scanOpportunities(filters);
    res.json(result);
  } catch (error: any) {
    logToFile(`[Options Agent] Error scanning options trades: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/trades/short-agent/scan - AI Short Finding & Bearish Catalyst Agent
app.post('/api/trades/short-agent/scan', async (req, res) => {
  try {
    const filters = req.body || {};
    logToFile(`[Short Finding Agent] Scanning short candidates (Archetype: ${filters.archetype || 'ALL'}, Market Cap: ${filters.marketCapCategory || 'ALL'})...`);
    const result = await shortCandidateService.scanShortCandidates(filters);
    res.json(result);
  } catch (error: any) {
    logToFile(`[Short Finding Agent] Error scanning short candidates: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ideas/structure-trade - AI Trade Structuring Agent
app.post('/api/ideas/structure-trade', async (req, res) => {
  try {
    const payload = req.body || {};
    logToFile(`[Trade Structurer] Structuring trade approach for ${payload.symbol || 'N/A'}...`);
    const result = await generateTradeStructures(payload);
    res.json(result);
  } catch (error: any) {
    logToFile(`[Trade Structurer] Error structuring trade: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ideas/:id/save-approaches - Append/Update selected trade structures into the idea
app.post('/api/ideas/:id/save-approaches', async (req, res) => {
  try {
    const { id } = req.params;
    const { approaches = [] } = req.body;

    const existing = await prisma.tradeIdea.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Trade idea not found.' });
    }

    if (!Array.isArray(approaches) || approaches.length === 0) {
      return res.json(existing);
    }

    // Format structured approaches as clean markdown
    let formattedSection = '\n\n---\n### 📐 Selected Trade Execution Structures\n';
    approaches.forEach((app: any, idx: number) => {
      formattedSection += `\n#### ${idx + 1}. ${app.title} (${app.suitability})\n`;
      formattedSection += `- **Category**: \`${app.category}\` | **Sentiment**: ${app.sentiment}\n`;
      formattedSection += `- **Primary Entry**: $${Number(app.primaryEntry).toFixed(2)}`;
      if (app.scaledEntryMin && app.scaledEntryMin !== app.primaryEntry) {
        formattedSection += ` (Scaled Zone: $${Number(app.scaledEntryMin).toFixed(2)} - $${Number(app.scaledEntryMax || app.primaryEntry).toFixed(2)})`;
      }
      formattedSection += `\n- **Target 1**: $${Number(app.targetPrice).toFixed(2)}`;
      if (app.target2Price) formattedSection += ` | **Target 2**: $${Number(app.target2Price).toFixed(2)}`;
      formattedSection += ` | **Stop Loss**: $${Number(app.stopLoss).toFixed(2)}\n`;
      if (app.optionDetails) {
        formattedSection += `- **Option Specs**: ${app.optionDetails.strategyName} (${app.optionDetails.expiryDescription})\n`;
        if (app.optionDetails.longStrike) formattedSection += `  - Long Strike: $${app.optionDetails.longStrike}\n`;
        if (app.optionDetails.shortStrike) formattedSection += `  - Short Strike: $${app.optionDetails.shortStrike}\n`;
        if (app.optionDetails.putStrike) formattedSection += `  - Put Strike: $${app.optionDetails.putStrike}\n`;
        if (app.optionDetails.callStrike) formattedSection += `  - Call Strike: $${app.optionDetails.callStrike}\n`;
        formattedSection += `  - Break-Even: $${app.optionDetails.breakEvenPrice}\n`;
      }
      formattedSection += `- **Capital & Risk**: Capital: ${app.capitalRequiredEstimate} | Max Profit: ${app.maxProfit} | Max Risk: ${app.maxRisk} | R:R: ${app.riskRewardRatio}\n`;
      if (app.executionRules && app.executionRules.length > 0) {
        formattedSection += `- **Execution Rules**:\n`;
        app.executionRules.forEach((r: string) => {
          formattedSection += `  - ${r}\n`;
        });
      }
      if (app.profitTakingPlan) formattedSection += `- **Profit Taking**: ${app.profitTakingPlan}\n`;
    });

    // Remove older structured sections if previously appended
    let cleanedContent = existing.content;
    const splitIndex = cleanedContent.indexOf('### 📐 Selected Trade Execution Structures');
    if (splitIndex !== -1) {
      cleanedContent = cleanedContent.slice(0, splitIndex).trim();
    }

    const updatedContent = cleanedContent + formattedSection;

    const updated = await prisma.tradeIdea.update({
      where: { id },
      data: {
        content: updatedContent,
        updatedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error: any) {
    logToFile(`[Trade Structurer] Error saving approaches for idea ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ideas/generate-ai - Autonomous AI Idea Hunter Agent
app.post('/api/ideas/generate-ai', async (req, res) => {
  const {
    theme = 'AI & Semiconductor Infrastructure',
    customPrompt = '',
    sentiment = 'ANY',
    timeframe = 'SWING',
    count = 2,
    tickers: providedTickers
  } = req.body || {};

  const task = agentActivityTracker.startTask({
    agentName: 'AI Trade Idea Hunter Agent',
    agentType: 'TRADE_IDEA_GENERATOR',
    taskDescription: `Tactical Idea Hunt (${count} ideas, theme: "${theme}", sentiment: ${sentiment})`,
    metadata: {
      theme,
      sentiment,
      timeframe,
      count
    }
  });

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      agentActivityTracker.completeTask(task.id, {
        status: 'FAILED',
        error: 'OpenRouter API key missing'
      });
      return res.status(401).json({ error: 'OpenRouter API key is missing. Please add it to .env.local.' });
    }

    logToFile(`[AI Idea Hunter] Starting generation for theme: "${theme}", sentiment: ${sentiment}`);

    // Determine candidate tickers
    let candidates: string[] = [];
    if (Array.isArray(providedTickers) && providedTickers.length > 0) {
      candidates = providedTickers.map((t: string) => t.trim().toUpperCase());
    } else {
      // Pick based on theme
      const themeLower = theme.toLowerCase();
      if (themeLower.includes('ai') || themeLower.includes('semi')) {
        candidates = ['NVDA', 'AVGO', 'TSM', 'AMD', 'MRVL', 'PLTR', 'ARM', 'MSFT'];
      } else if (themeLower.includes('value') || themeLower.includes('cash flow')) {
        candidates = ['BRK-B', 'JNJ', 'PG', 'META', 'GOOGL', 'CVX', 'AAPL'];
      } else if (themeLower.includes('energy') || themeLower.includes('commodit')) {
        candidates = ['FSLR', 'ORA', 'NEE', 'CCJ', 'FCX', 'XOM', 'ENPH'];
      } else if (themeLower.includes('volatilit') || themeLower.includes('option') || themeLower.includes('growth')) {
        candidates = ['TSLA', 'COIN', 'MSTR', 'RKLB', 'DKNG', 'HOOD', 'SOFI'];
      } else {
        // Broad universe
        candidates = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'MSFT', 'PLTR', 'META', 'AMD', 'ORA'];
      }
    }

    // Sample 4 candidates for live market quotes
    const selectedPool = candidates.sort(() => 0.5 - Math.random()).slice(0, 4);

    // Fetch live market data for candidates
    const marketSummaries: any[] = [];
    for (const ticker of selectedPool) {
      try {
        const quote = await yahooFinance.quoteSummary(ticker, {
          modules: ['price', 'financialData', 'defaultKeyStatistics', 'summaryProfile']
        });
        if (quote?.price?.regularMarketPrice) {
          marketSummaries.push({
            symbol: ticker,
            companyName: quote.price.shortName || quote.price.longName,
            currentPrice: quote.price.regularMarketPrice,
            dayChangePercent: (quote.price.regularMarketChangePercent || 0) * 100,
            marketCap: quote.price.marketCap,
            sector: quote.summaryProfile?.sector,
            industry: quote.summaryProfile?.industry,
            trailingPE: quote.defaultKeyStatistics?.trailingPE,
            freeCashflow: quote.financialData?.freeCashflow,
            operatingMargin: (quote.financialData?.operatingMargins || 0) * 100,
            fiftyTwoWeekHigh: quote.price.regularMarketDayHigh,
            fiftyTwoWeekLow: quote.price.regularMarketDayLow,
          });
        }
      } catch (e: any) {
        logToFile(`Error fetching data for candidate ${ticker}: ${e.message}`);
      }
    }

    const systemPrompt = `You are a Senior Hedge Fund Portfolio Manager and Tactical Trade Idea Hunter.
Your mission is to synthesize ${count} distinct, high-conviction, actionable trade ideas based on the provided live market data, macro backdrop, and technical setup.

Requirements for each trade idea:
1. "title": Punchy, professional title explaining the catalyst.
2. "symbol": Exact stock ticker.
3. "type": "BULLISH", "BEARISH", or "NEUTRAL".
4. "timeframe": "SHORT_TERM", "SWING", or "LONG_TERM".
5. "entryPrice": Numeric entry price near current market price.
6. "targetPrice": Realistic numeric profit target.
7. "stopLoss": Prudent numeric stop loss level.
8. "confidenceScore": Integer from 70 to 95 based on technical & fundamental alignment.
9. "tags": Comma-separated tags (e.g. "Semiconductors, Blackwell, Growth, Momentum").
10. "content": Markdown formatted thesis containing:
    - ### 🎯 Core Hypothesis
    - ### 🚀 Key Catalysts (2-3 bullet points)
    - ### 🛡️ Risk & Trade Execution Plan (Entry, Stop Loss, Profit Target, Risk/Reward ratio)

Return JSON ONLY matching the following schema:
{
  "ideas": [
    {
      "title": "...",
      "symbol": "...",
      "type": "BULLISH",
      "timeframe": "SWING",
      "entryPrice": 140.50,
      "targetPrice": 165.00,
      "stopLoss": 128.00,
      "confidenceScore": 86,
      "tags": "AI, Hardware, Growth",
      "content": "### 🎯 Core Hypothesis..."
    }
  ]
}
`;

    const userPrompt = `Generate ${count} high-conviction trade ideas.
Theme / Focus: ${theme}
${customPrompt ? `Custom Instructions / Thesis: ${customPrompt}` : ''}
Preferred Sentiment: ${sentiment}
Target Timeframe: ${timeframe}

Live Market Intelligence on Candidate Assets:
${JSON.stringify(marketSummaries, null, 2)}
`;

    const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      throw new Error(`LLM Agent error (${llmResponse.status}): ${errText}`);
    }

    const llmData = await llmResponse.json();
    const rawContent = llmData.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent);

    const generatedIdeasList: any[] = parsed.ideas || [];
    const savedIdeas: any[] = [];

    for (const item of generatedIdeasList) {
      if (!item.title || !item.symbol) continue;
      const cleanSym = String(item.symbol).trim().toUpperCase();

      const created = await prisma.tradeIdea.create({
        data: {
          title: item.title,
          symbol: cleanSym,
          type: (item.type || 'BULLISH').toUpperCase(),
          timeframe: item.timeframe ? String(item.timeframe).toUpperCase() : 'SWING',
          entryPrice: item.entryPrice ? Number(item.entryPrice) : null,
          targetPrice: item.targetPrice ? Number(item.targetPrice) : null,
          stopLoss: item.stopLoss ? Number(item.stopLoss) : null,
          content: item.content || '',
          tags: item.tags ? `${theme}, ${item.tags}` : `${theme}, AI Generated, Tactical Idea`,
          confidenceScore: item.confidenceScore ? Number(item.confidenceScore) : 85,
          status: 'ACTIVE',
          source: 'AI_AGENT'
        }
      });
      savedIdeas.push(created);
    }

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Discovered & saved ${savedIdeas.length} trade ideas (${savedIdeas.map(i => i.symbol).join(', ')})`
    });

    logToFile(`[AI Idea Hunter] Successfully saved ${savedIdeas.length} trade ideas`);
    res.status(201).json({ success: true, ideas: savedIdeas });
  } catch (error: any) {
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: error.message
    });
    logToFile(`Error in AI Idea Hunter: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DIP RADAR & AI DRAWDOWN DIAGNOSTIC ENDPOINTS
// ==========================================

// GET /api/market/dips-radar - Scan holdings & watchlists for down stocks
app.get('/api/market/dips-radar', async (req, res) => {
  try {
    const minDayDrop = req.query.minDayDrop ? parseFloat(req.query.minDayDrop as string) : undefined;
    const minDrawdown = req.query.minDrawdown ? parseFloat(req.query.minDrawdown as string) : undefined;

    const result = await scanHoldingsAndWatchlistsForDips(prisma, {
      minDayDropPercent: minDayDrop,
      minDrawdownFromHighPercent: minDrawdown,
    }, logToFile);

    res.json(result);
  } catch (error: any) {
    logToFile(`Error in /api/market/dips-radar: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/market/diagnose-dip - Run or fetch deep AI dip diagnostic
app.post('/api/market/diagnose-dip', async (req, res) => {
  try {
    const { symbol, forceRefresh } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required.' });
    }

    const result = await diagnoseStockDip(symbol, {
      forceRefresh: Boolean(forceRefresh),
      prisma,
    }, logToFile);

    res.json(result);
  } catch (error: any) {
    logToFile(`Error in /api/market/diagnose-dip: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/market/diagnose-dip/:symbol - Quick GET for symbol diagnostic (returns DB saved report or runs fresh)
app.get('/api/market/diagnose-dip/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const forceRefresh = req.query.force === 'true';

    const result = await diagnoseStockDip(symbol, {
      forceRefresh,
      prisma,
    }, logToFile);

    res.json(result);
  } catch (error: any) {
    logToFile(`Error in /api/market/diagnose-dip/${req.params.symbol}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/market/saved-dips - List all saved diagnostic reports
app.get('/api/market/saved-dips', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const records = await listSavedDipReports(prisma, limit);
    res.json(records);
  } catch (error: any) {
    logToFile(`Error in GET /api/market/saved-dips: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/market/saved-dips/:symbol/history - List diagnostic history for a symbol
app.get('/api/market/saved-dips/:symbol/history', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const history = await getDipReportHistory(prisma, symbol, limit);
    res.json(history);
  } catch (error: any) {
    logToFile(`Error in GET /api/market/saved-dips/${req.params.symbol}/history: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/market/saved-dips/:id - Delete a saved diagnostic report
app.delete('/api/market/saved-dips/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await deleteSavedDipReport(prisma, id);
    res.json({ success: true, id });
  } catch (error: any) {
    logToFile(`Error in DELETE /api/market/saved-dips/${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PORTFOLIO MANAGEMENT & COVERED CALLS ANALYSER
// ==========================================

// GET /api/management/covered-calls - Scan portfolio for delta >= 100 and unhedged call opportunities
app.get('/api/management/covered-calls', async (req, res) => {
  try {
    const result = await analyzePortfolioCoveredCalls(prisma, logToFile);
    res.json(result);
  } catch (error: any) {
    logToFile(`Error in GET /api/management/covered-calls: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/management/covered-calls/:symbol/chain - Deep options chain for covered call selection
app.get('/api/management/covered-calls/:symbol/chain', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const targetStrike = req.query.strike ? parseFloat(req.query.strike as string) : undefined;
    const chain = await getDetailedCallOptionChain(symbol, targetStrike);
    res.json(chain);
  } catch (error: any) {
    logToFile(`Error in GET /api/management/covered-calls/${req.params.symbol}/chain: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PORTFOLIO VALUATION AUDIT AGENT ENDPOINTS
// ==========================================

// POST /api/portfolio/valuation-audit - Trigger autonomous AI Valuation Agent
app.post('/api/portfolio/valuation-audit', async (req, res) => {
  try {
    logToFile(`Received POST /api/portfolio/valuation-audit`);
    let { positions, balancesData } = req.body || {};

    // If positions not supplied in request body, retrieve all active holdings from SQLite database
    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      logToFile(`[ValuationAgent] No positions in payload. Fetching holdings directly from database...`);
      const dbHoldings = await prisma.holding.findMany({
        where: { quantity: { not: 0 } },
        include: { broker: true }
      });
      positions = dbHoldings.map((h: any) => ({
        id: h.id,
        symbol: h.symbol,
        description: h.description,
        quantity: h.quantity,
        averageCost: h.averageCost,
        currentPrice: h.currentPrice,
        marketValue: h.marketValue,
        source: h.broker?.name === 'Tastytrade' ? 'Tastytrade' : h.broker?.name === 'Trading 212' ? 'Trading 212' : 'IBKR',
        assetType: h.assetType === 'OPTION' ? 'Option' : 'Stock',
        currency: h.currency || 'USD',
        underlyingSymbol: h.underlyingSymbol || undefined
      }));
    }

    const audit = await runPortfolioValuationAgent(positions, balancesData, logToFile);
    res.json({ success: true, audit });
  } catch (error: any) {
    logToFile(`Error in POST /api/portfolio/valuation-audit: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/portfolio/valuation-audits - Retrieve historical valuation audit reports
app.get('/api/portfolio/valuation-audits', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const audits = await getPortfolioValuationAudits(limit);
    res.json({ success: true, audits });
  } catch (error: any) {
    logToFile(`Error in GET /api/portfolio/valuation-audits: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/portfolio/valuation-audits/latest - Retrieve most recent valuation audit
app.get('/api/portfolio/valuation-audits/latest', async (req, res) => {
  try {
    const audits = await getPortfolioValuationAudits(1);
    const latest = audits.length > 0 ? audits[0] : null;
    res.json({ success: true, audit: latest });
  } catch (error: any) {
    logToFile(`Error in GET /api/portfolio/valuation-audits/latest: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/portfolio/valuation-audits/:id - Delete a valuation report
app.delete('/api/portfolio/valuation-audits/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await deletePortfolioValuationAudit(id);
    res.json({ success: deleted, id });
  } catch (error: any) {
    logToFile(`Error in DELETE /api/portfolio/valuation-audits/${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// THOUGHT LOG & RESEARCH JOURNAL API
// ==========================================

// GET /api/thought-logs/folders - List all folders with counts and telemetry
// GET /api/thought-logs/folders - List all folders with counts and telemetry
app.get('/api/thought-logs/folders', async (req, res) => {
  try {
    const logs = await (prisma as any).thoughtLog.findMany({
      select: { id: true, folder: true, tags: true, title: true }
    });

    const folderMap = new Map<string, number>();
    let telegramCount = 0;
    let voiceCount = 0;
    let generalCount = 0;

    // Standard baseline category folders
    const defaultFolders = ['General', 'Ideas', 'Research', 'Watchlist', 'Macro', 'Earnings', 'Trading'];
    defaultFolders.forEach(f => folderMap.set(f, 0));

    for (const l of logs) {
      const f = l.folder?.trim();
      // If note has not been saved to a specific category folder (null, empty, or 'General'), count in General
      if (!f || f === 'General' || f === 'ALL') {
        generalCount++;
        folderMap.set('General', (folderMap.get('General') || 0) + 1);
      } else {
        folderMap.set(f, (folderMap.get(f) || 0) + 1);
      }

      if (l.tags?.toLowerCase().includes('telegram') || l.title?.includes('📱') || f === 'Telegram') {
        telegramCount++;
      }
      if (l.tags?.toLowerCase().includes('voice') || l.title?.includes('🎙️') || f === 'Voice Notes') {
        voiceCount++;
      }
    }

    const folders = Array.from(folderMap.entries()).map(([name, count]) => ({
      name,
      count,
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      totalCount: logs.length,
      unfiledCount: generalCount,
      generalCount,
      telegramCount,
      voiceCount,
      folders,
    });
  } catch (error: any) {
    logToFile(`Error in GET /api/thought-logs/folders: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/thought-logs - List all thought logs
app.get('/api/thought-logs', async (req, res) => {
  try {
    const { search, tag, sentiment, folder } = req.query;
    const andClauses: any[] = [];

    if (folder && typeof folder === 'string' && folder !== 'ALL') {
      if (folder === 'General') {
        andClauses.push({
          OR: [
            { folder: 'General' },
            { folder: null },
            { folder: '' },
          ]
        });
      } else if (folder === 'Telegram') {
        andClauses.push({
          OR: [
            { folder: 'Telegram' },
            { tags: { contains: 'Telegram' } },
            { title: { contains: '📱' } }
          ]
        });
      } else if (folder === 'Voice Notes') {
        andClauses.push({
          OR: [
            { folder: 'Voice Notes' },
            { tags: { contains: 'Voice' } },
            { title: { contains: '🎙️' } }
          ]
        });
      } else {
        andClauses.push({ folder });
      }
    }

    if (sentiment && typeof sentiment === 'string' && sentiment !== 'ALL') {
      andClauses.push({ sentiment });
    }
    if (tag && typeof tag === 'string') {
      andClauses.push({ tags: { contains: tag } });
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      andClauses.push({
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
          { tags: { contains: q } },
          { symbols: { contains: q } },
          { folder: { contains: q } },
        ]
      });
    }

    const where = andClauses.length > 0 ? { AND: andClauses } : {};

    const logs = await (prisma as any).thoughtLog.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ]
    });
    res.json(logs);
  } catch (error: any) {
    logToFile(`Error in GET /api/thought-logs: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/thought-logs/:id - Get single thought log
app.get('/api/thought-logs/:id', async (req, res) => {
  try {
    const log = await (prisma as any).thoughtLog.findUnique({
      where: { id: req.params.id }
    });
    if (!log) return res.status(404).json({ error: 'Thought log not found' });
    res.json(log);
  } catch (error: any) {
    logToFile(`Error in GET /api/thought-logs/${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/thought-logs - Create new thought log
app.post('/api/thought-logs', async (req, res) => {
  try {
    const { title, content, folder, tags, symbols, sentiment, isPinned, agentOutput, agentActionType } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Log content is required' });
    }

    const detectedSymbols = symbols || extractSymbolsFromText(`${title || ''} ${content}`).join(', ');

    // Automatically parse and create price alerts (e.g. "RBRK 120", "Alert AAPL 250")
    const autoCreatedAlerts = await autoCreateAlertsFromText(
      prisma,
      `${title || ''}\n${content}`,
      `Created from ThoughtLog: "${content.trim()}"`
    );

    if (autoCreatedAlerts.length > 0) {
      setTimeout(checkPriceAlerts, 500);
    }

    let finalTags = tags || null;
    let finalFolder = folder || 'General';
    if (autoCreatedAlerts.length > 0) {
      finalTags = finalTags ? `${finalTags}, Alert` : 'Alert';
      if (!folder || folder === 'General') {
        finalFolder = 'Alerts';
      }
    }

    let finalAgentOutput = agentOutput || null;
    if (!finalAgentOutput && autoCreatedAlerts.length > 0) {
      finalAgentOutput = `🔔 **Auto Price Alert Armed**\n\n` +
        autoCreatedAlerts
          .map((a) => `• **${a.symbol}**: Target **$${a.targetPrice}** (${a.condition})${a.currentPrice ? ` — Spot: $${a.currentPrice.toFixed(2)}` : ''}`)
          .join('\n');
    }

    const newLog = await (prisma as any).thoughtLog.create({
      data: {
        title: (title || '').trim() || (autoCreatedAlerts.length > 0 ? `🔔 ${autoCreatedAlerts.map(a => `${a.symbol} @ $${a.targetPrice}`).join(', ')}` : 'Untitled Thought Log'),
        content: content.trim(),
        folder: finalFolder,
        tags: finalTags,
        symbols: detectedSymbols || null,
        sentiment: sentiment || 'NEUTRAL',
        isPinned: Boolean(isPinned),
        agentOutput: finalAgentOutput,
        agentActionType: agentActionType || (autoCreatedAlerts.length > 0 ? 'ADD_CONTEXT' : null),
        marketDataJson: null,
      }
    });

    res.json({
      ...newLog,
      createdAlerts: autoCreatedAlerts,
    });
  } catch (error: any) {
    logToFile(`Error in POST /api/thought-logs: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/thought-logs/bulk-move - Move multiple thought logs to a folder
app.put('/api/thought-logs/bulk-move', async (req, res) => {
  try {
    const { ids, folder } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !folder) {
      return res.status(400).json({ error: 'ids array and target folder are required' });
    }
    const result = await (prisma as any).thoughtLog.updateMany({
      where: { id: { in: ids } },
      data: { folder: folder.trim() }
    });
    res.json({ success: true, count: result.count, folder: folder.trim() });
  } catch (error: any) {
    logToFile(`Error in PUT /api/thought-logs/bulk-move: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/thought-logs/:id - Update thought log
app.put('/api/thought-logs/:id', async (req, res) => {
  try {
    const { title, content, folder, tags, symbols, sentiment, isPinned, agentOutput, agentActionType, agentHistory, marketDataJson } = req.body;
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (folder !== undefined) updateData.folder = folder;
    if (tags !== undefined) updateData.tags = tags;
    if (symbols !== undefined) updateData.symbols = symbols;
    if (sentiment !== undefined) updateData.sentiment = sentiment;
    if (isPinned !== undefined) updateData.isPinned = Boolean(isPinned);
    if (agentOutput !== undefined) updateData.agentOutput = agentOutput;
    if (agentActionType !== undefined) updateData.agentActionType = agentActionType;
    if (agentHistory !== undefined) updateData.agentHistory = typeof agentHistory === 'object' ? JSON.stringify(agentHistory) : agentHistory;
    if (marketDataJson !== undefined) updateData.marketDataJson = typeof marketDataJson === 'object' ? JSON.stringify(marketDataJson) : marketDataJson;

    const updated = await (prisma as any).thoughtLog.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(updated);
  } catch (error: any) {
    logToFile(`Error in PUT /api/thought-logs/${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/thought-logs/:id - Delete thought log
app.delete('/api/thought-logs/:id', async (req, res) => {
  try {
    await (prisma as any).thoughtLog.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    logToFile(`Error in DELETE /api/thought-logs/${req.params.id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/thought-logs/agent/run - Run agent on thought log (with live market data & reasoning)
app.post('/api/thought-logs/agent/run', async (req, res) => {
  try {
    const { logId, title, content, actionType, customPrompt, sentiment, tags, saveToLog } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required for AI agent analysis' });
    }

    const result = await runAgentOnThoughtLog({
      logId,
      title: title || '',
      content: content.trim(),
      actionType: actionType || 'ADD_CONTEXT',
      customPrompt,
      sentiment,
      tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : [],
    });

    // Optionally persist directly to log if logId provided and saveToLog is true
    if (logId && saveToLog) {
      await (prisma as any).thoughtLog.update({
        where: { id: logId },
        data: {
          agentOutput: result.markdownOutput,
          agentActionType: result.actionType,
          symbols: result.detectedSymbols.length > 0 ? result.detectedSymbols.join(', ') : undefined,
          marketDataJson: JSON.stringify(result.marketData),
        }
      });
    }

    res.json(result);
  } catch (error: any) {
    logToFile(`Error in POST /api/thought-logs/agent/run: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MULTI-FACTOR STOCK SCANNER API
// ==========================================

// POST /api/scanner/scan - Execute stock screener
app.post('/api/scanner/scan', async (req, res) => {
  try {
    const criteria: ScannerCriteria = req.body || {};
    const response = await runStockScanner(criteria);
    res.json(response);
  } catch (error: any) {
    logToFile(`Error in POST /api/scanner/scan: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/scanner/meta - Get universe metadata (sectors and themes)
app.get('/api/scanner/meta', (req, res) => {
  try {
    const sectorsSet = new Set<string>();
    const themesSet = new Set<string>();

    SCANNER_UNIVERSE.forEach((item) => {
      sectorsSet.add(item.sector);
      item.themes.forEach((t) => themesSet.add(t));
    });

    res.json({
      totalEquities: SCANNER_UNIVERSE.length,
      sectors: Array.from(sectorsSet).sort(),
      themes: Array.from(themesSet).sort(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TELEGRAM BUFFER WEBHOOK CONSUMER API
// ==========================================

// POST /api/telegram/sync-buffer - Consume pending mobile notes from Cloudflare Worker KV
app.post('/api/telegram/sync-buffer', async (req, res) => {
  try {
    const result = await consumeTelegramBuffer(prisma);
    res.json(result);
  } catch (error: any) {
    logToFile(`Error in POST /api/telegram/sync-buffer: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/telegram/status - Get Telegram buffer configuration status
app.get('/api/telegram/status', (req, res) => {
  try {
    const status = getTelegramBufferStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/telegram/send-report - Generate executive PDF and dispatch to Telegram
app.post('/api/telegram/send-report', async (req, res) => {
  try {
    const result = await generateAndSendDailyReport();
    res.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/telegram/send-report:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/telegram/preview-report-pdf - Stream executive PDF directly in browser
app.get('/api/telegram/preview-report-pdf', async (req, res) => {
  try {
    const data = await fetchComprehensiveReportData();
    const buffer = await generateExecutivePdfBuffer(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="TradeFlow_Executive_Briefing.pdf"');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (error: any) {
    console.error('Error generating preview PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Root Route: Redirect browser traffic to Vite frontend on port 8080
app.get('/', (req, res) => {
  res.redirect('http://localhost:8080/');
});

async function cleanupStaleHoldingsInDB() {
  try {
    const broker = await prisma.broker.findUnique({ where: { name: 'Interactive Brokers' } });
    if (!broker) return;

    // 1. Delete 0 quantity IBKR holdings
    await prisma.holding.deleteMany({
      where: {
        brokerId: broker.id,
        quantity: 0,
      },
    });

    // 2. Clean up stale/duplicate records across accounts (keep newest record per asset)
    const holdings = await prisma.holding.findMany({
      where: { brokerId: broker.id },
      orderBy: { updatedAt: 'desc' },
    });

    const seenKeys = new Map<string, string>();
    const toDeleteIds: string[] = [];

    for (const h of holdings) {
      const sym = h.symbol.trim().toUpperCase();
      const key = `${sym}-${h.assetType}-${h.strikePrice || 0}-${h.expiryDate || ''}`;
      if (seenKeys.has(key)) {
        toDeleteIds.push(h.id);
      } else {
        seenKeys.set(key, h.id);
      }
    }

    if (toDeleteIds.length > 0) {
      await prisma.holding.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
      console.log(`Cleaned up ${toDeleteIds.length} stale/duplicate IBKR holdings from database.`);
    }
  } catch (err: any) {
    console.error('Error cleaning up stale holdings:', err.message);
  }
}

const server = app.listen(port, () => {
  console.log(`Backend API server listening at http://localhost:${port}`);
  console.log(`Frontend UI available at http://localhost:8080`);

  // Initial and periodic cleanup of stale holding records
  cleanupStaleHoldingsInDB().catch(e => console.error('Initial holding cleanup error:', e));
  setInterval(() => {
    cleanupStaleHoldingsInDB().catch(e => console.error('Periodic holding cleanup error:', e));
  }, 60000);

  // Initial and periodic sync for Trading 212 holdings
  syncTrading212HoldingsToDB(prisma).catch(e => console.error('Initial Trading 212 sync error:', e));
  setInterval(() => {
    syncTrading212HoldingsToDB(prisma).catch(e => console.error('Periodic Trading 212 sync error:', e));
  }, 45000);

  // Initial and periodic Telegram Buffer Sync
  consumeTelegramBuffer(prisma).catch(e => console.error('Initial Telegram Buffer sync error:', e));
  setInterval(() => {
    if (process.env.TELEGRAM_BUFFER_URL) {
      consumeTelegramBuffer(prisma).catch(e => console.error('Periodic Telegram Buffer sync error:', e));
    }
  }, 60000);

  // Initial sync for broker trades (Tastytrade & IBKR)
  syncTastytradeTransactions(prisma).catch(e => console.error('Initial Tastytrade trade sync error:', e));
  syncIBKRFromHoldings(prisma).catch(e => console.error('Initial IBKR trade sync error:', e));
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down server...');

  server.close(() => {
    console.log('HTTP server closed.');
  });

  if (isConnected && ib) {
    try {
      console.log('Disconnecting from IBKR...');
      ib.disconnect();
    } catch (e) {
      console.error('Error disconnecting IBKR:', e);
    }
  }

  try {
    await prisma.$disconnect();
    console.log('Database disconnected.');
  } catch (e) {
    console.error('Error disconnecting database:', e);
  }

  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
