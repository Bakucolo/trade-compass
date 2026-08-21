import express from 'express';
import cors from 'cors';
import { IBApi, EventName, ErrorCode, Contract } from '@stoqey/ib';
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

// IBKR Connection Settings
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
  });

  ibInstance.on(EventName.managedAccounts, (accountsList: string) => {
    console.log('IBKR Managed Accounts:', accountsList);
    const accounts = accountsList.split(',').map(a => a.trim()).filter(Boolean);
    for (const acct of accounts) {
      console.log(`Subscribing to account updates for IBKR account: ${acct}`);
      ibInstance.reqAccountUpdates(true, acct);
    }
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
        if (pos === 0) {
          // Remove position if quantity is 0
          await prisma.holding.deleteMany({
            where: {
              broker: { name: 'Interactive Brokers' },
              brokerSpecificId: contract.conId?.toString()
            }
          });
        } else {
          const broker = await prisma.broker.findUnique({ where: { name: 'Interactive Brokers' } });
          if (!broker) return;

          const isOption = contract.secType === 'OPT';
          const conIdStr = contract.conId?.toString() || `${contract.symbol}_${contract.secType}`;
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
          if (contract.conId && account) {
            const reqId = Math.floor(Math.random() * 900000) + 100000;
            pnlReqConIdMap.set(reqId, contract.conId.toString());
            try {
              ibInstance.reqPnLSingle(reqId, account, null, contract.conId);
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
        const conIdStr = contract.conId?.toString() || `${contract.symbol}_${contract.secType}`;

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

        await prisma.holding.update({
          where: { id: holding.id },
          data: {
            dayPnL: dailyPnL ?? holding.dayPnL,
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

    if (currency && !acct.currency) acct.currency = currency;

    if (key === 'NetLiquidation' || key === 'NetLiquidationByCurrency') acct.netLiq = numVal;
    else if (key === 'TotalCashValue' || key === 'TotalCashBalance' || key === 'CashBalance') acct.cash = numVal;
    else if (key === 'BuyingPower') acct.buyingPower = numVal;
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
    else if (key === 'UnrealizedPnL') acct.unrealizedPnL = numVal;
    else if (key === 'RealizedPnL') acct.realizedPnL = numVal;
    else if (key === 'StockMarketValue') acct.stockMarketValue = numVal;
    else if (key === 'OptionMarketValue') acct.optionMarketValue = numVal;
    else if (key === 'FutureOptionMarketValue') acct.futureOptionMarketValue = numVal;
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
};

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
}

const ibkrAccountValues = new Map<string, IBKRAccountData>();

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

  res.json(holdings);
});

// Comprehensive Broker Balances & Detailed Buying Power Endpoint
app.get('/api/portfolio/balances', async (req, res) => {
  try {
    const holdings = await prisma.holding.findMany({
      include: { broker: true }
    });

    const ibkrHoldings = holdings.filter(h => h.broker?.name === 'Interactive Brokers' || !h.broker);
    const tastyHoldings = holdings.filter(h => h.broker?.name === 'Tastytrade');

    // Aggregate IBKR Holdings metrics from DB
    const ibkrPositionsMarketValue = ibkrHoldings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const ibkrOptionsCount = ibkrHoldings.filter(h => h.assetType === 'OPTION').length;
    const ibkrOptionsValue = ibkrHoldings.filter(h => h.assetType === 'OPTION').reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const ibkrEquitiesCount = ibkrHoldings.filter(h => h.assetType !== 'OPTION').length;
    const ibkrEquitiesValue = ibkrHoldings.filter(h => h.assetType !== 'OPTION').reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const ibkrUnrealizedPnL = ibkrHoldings.reduce((sum, h) => sum + (h.unrealizedPnL || 0), 0);
    const ibkrDayPnL = ibkrHoldings.reduce((sum, h) => sum + (h.dayPnL || 0), 0);

    // Aggregate Tastytrade Holdings metrics from DB
    const tastyPositionsMarketValue = tastyHoldings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const tastyOptionsCount = tastyHoldings.filter(h => h.assetType === 'OPTION').length;
    const tastyOptionsValue = tastyHoldings.filter(h => h.assetType === 'OPTION').reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const tastyEquitiesCount = tastyHoldings.filter(h => h.assetType !== 'OPTION').length;
    const tastyEquitiesValue = tastyHoldings.filter(h => h.assetType !== 'OPTION').reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const tastyUnrealizedPnL = tastyHoldings.reduce((sum, h) => sum + (h.unrealizedPnL || 0), 0);
    const tastyDayPnL = tastyHoldings.reduce((sum, h) => sum + (h.dayPnL || 0), 0);

    // Extract first IBKR account values or compute sensible fallback
    let ibkrAcct: IBKRAccountData = {
      accountName: 'Interactive Brokers',
      accountType: 'Margin',
      currency: 'USD',
      netLiq: ibkrPositionsMarketValue,
      cash: 0,
      buyingPower: Math.max(0, ibkrPositionsMarketValue * 0.5),
      excessLiquidity: Math.max(0, ibkrPositionsMarketValue * 0.3),
      maintMargin: Math.max(0, ibkrPositionsMarketValue * 0.25),
      initMargin: Math.max(0, ibkrPositionsMarketValue * 0.5),
      availableFunds: Math.max(0, ibkrPositionsMarketValue * 0.5),
      equityWithLoanValue: ibkrPositionsMarketValue,
      grossPositionValue: ibkrPositionsMarketValue,
      regTEquity: ibkrPositionsMarketValue,
      regTMargin: Math.max(0, ibkrPositionsMarketValue * 0.5),
      sma: 0,
      cushion: 0,
      leverage: 1.0,
      unrealizedPnL: ibkrUnrealizedPnL,
      realizedPnL: 0,
      stockMarketValue: ibkrEquitiesValue,
      optionMarketValue: ibkrOptionsValue,
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

    for (const [acctName, val] of ibkrAccountValues.entries()) {
      ibkrAcct = {
        ...val,
        accountName: acctName || ibkrAcct.accountName,
        netLiq: val.netLiq > 0 ? val.netLiq : (ibkrPositionsMarketValue || ibkrAcct.netLiq),
        stockMarketValue: val.stockMarketValue || ibkrEquitiesValue,
        optionMarketValue: val.optionMarketValue || ibkrOptionsValue,
        unrealizedPnL: val.unrealizedPnL || ibkrUnrealizedPnL,
      };
      break;
    }

    const ibkrNetLiq = ibkrAcct.netLiq || ibkrPositionsMarketValue;
    const ibkrMaint = ibkrAcct.maintMargin;
    const ibkrExcess = ibkrAcct.excessLiquidity;
    const ibkrMarginUtilization = ibkrNetLiq > 0 ? Math.min(100, (ibkrMaint / ibkrNetLiq) * 100) : 0;
    const ibkrMarginCushion = ibkrAcct.cushion > 0
      ? (ibkrAcct.cushion * 100)
      : (ibkrNetLiq > 0 ? Math.max(0, (ibkrExcess / ibkrNetLiq) * 100) : 100);

    // Fetch Tastytrade live balances & account info
    let tastyRawBalances: any = null;
    let tastyAccountMeta: any = null;
    let tastyConnected = false;

    // 1. Try OAuth2 direct REST
    try {
      tastyRawBalances = await fetchTastyBalances();
      if (tastyRawBalances) {
        tastyConnected = true;
        tastyAccountMeta = await fetchTastyAccountInfo();
      }
    } catch (e) {
      // ignore
    }

    // 2. Fallback to SDK client if OAuth2 wasn't configured or returned null
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
      } catch (ttErr) {
        // Fall back to positions calculations
      }
    }

    // Parse Tastytrade metrics
    const tastyAcctNum = tastyRawBalances?.['account-number'] || tastyAccountMeta?.['account-number'] || process.env.TASTY_ACCOUNT_NUMBER || 'Tastytrade';
    const tastyNetLiq = parseFloat(tastyRawBalances?.['net-liquidating-value'] || tastyRawBalances?.netLiquidatingValue) || tastyPositionsMarketValue;
    const tastyCash = parseFloat(tastyRawBalances?.['cash-balance'] || tastyRawBalances?.cashBalance) || 0;
    const tastyDerivBP = parseFloat(tastyRawBalances?.['derivative-buying-power'] || tastyRawBalances?.derivativeBuyingPower) || Math.max(0, tastyPositionsMarketValue * 0.5);
    const tastyEquityBP = parseFloat(tastyRawBalances?.['equity-buying-power'] || tastyRawBalances?.equityBuyingPower) || Math.max(0, tastyPositionsMarketValue * 0.5);
    const tastyDayTradingBP = parseFloat(tastyRawBalances?.['day-trading-buying-power'] || tastyRawBalances?.dayTradingBuyingPower) || 0;
    const tastyMaintReq = parseFloat(tastyRawBalances?.['maintenance-requirement'] || tastyRawBalances?.maintenanceRequirement) || 0;
    const tastyInitReq = parseFloat(tastyRawBalances?.['initial-requirement'] || tastyRawBalances?.initialRequirement) || 0;
    const tastyRegTReq = parseFloat(tastyRawBalances?.['reg-t-margin-requirement'] || tastyRawBalances?.regTMarginRequirement) || 0;
    const tastyMarginEquity = parseFloat(tastyRawBalances?.['margin-equity'] || tastyRawBalances?.marginEquity) || (tastyNetLiq - tastyMaintReq);
    const tastyLongEquityVal = parseFloat(tastyRawBalances?.['long-equity-value'] || tastyRawBalances?.longEquityValue) || tastyEquitiesValue;
    const tastyShortEquityVal = parseFloat(tastyRawBalances?.['short-equity-value'] || tastyRawBalances?.shortEquityValue) || 0;
    const tastyLongDerivVal = parseFloat(tastyRawBalances?.['long-derivative-value'] || tastyRawBalances?.longDerivativeValue) || tastyOptionsValue;
    const tastyShortDerivVal = parseFloat(tastyRawBalances?.['short-derivative-value'] || tastyRawBalances?.shortDerivativeValue) || 0;
    const tastyCashForWithdrawal = parseFloat(tastyRawBalances?.['cash-available-for-withdrawal'] || tastyRawBalances?.cashAvailableForWithdrawal) || tastyCash;
    const tastyUnrealizedDayPnL = parseFloat(tastyRawBalances?.['unrealized-day-pnl'] || tastyRawBalances?.unrealizedDayPnL) || tastyDayPnL;
    const tastyUnrealizedTotalPnL = parseFloat(tastyRawBalances?.['unrealized-pnl'] || tastyRawBalances?.unrealizedPnL) || tastyUnrealizedPnL;
    const tastyRealizedDayPnL = parseFloat(tastyRawBalances?.['realized-day-pnl'] || tastyRawBalances?.realizedDayPnL) || 0;
    const tastyRealizedTodayPnL = parseFloat(tastyRawBalances?.['realized-today-pnl'] || tastyRawBalances?.realizedTodayPnL) || 0;
    const tastyPendingCash = parseFloat(tastyRawBalances?.['pending-cash'] || tastyRawBalances?.pendingCash) || 0;
    const tastyOpenOrderReserve = parseFloat(tastyRawBalances?.['open-order-reserve-requirement'] || tastyRawBalances?.openOrderReserveRequirement) || 0;
    const tastyAccountType = tastyAccountMeta?.['account-type-name'] || (tastyAccountMeta?.['margin-or-cash'] ? `${tastyAccountMeta['margin-or-cash']} Margin` : 'Margin Account');
    const tastyNickname = tastyAccountMeta?.nickname || '';
    const tastyIsDayTrader = Boolean(tastyAccountMeta?.['is-firm-marked-day-trader']);

    const tastyMarginUtilization = tastyNetLiq > 0 ? Math.min(100, (tastyMaintReq / tastyNetLiq) * 100) : 0;
    const tastyMarginCushion = Math.max(0, 100 - tastyMarginUtilization);

    // Total Aggregates
    const totalNetLiq = ibkrNetLiq + tastyNetLiq;
    const totalCash = ibkrAcct.cash + tastyCash;
    const totalBP = ibkrAcct.buyingPower + tastyDerivBP;
    const totalUnrealizedPnL = (ibkrAcct.unrealizedPnL || ibkrUnrealizedPnL) + tastyUnrealizedTotalPnL;
    const totalDayPnL = ibkrDayPnL + tastyUnrealizedDayPnL;
    const totalRealizedPnL = ibkrAcct.realizedPnL + tastyRealizedTodayPnL;
    const totalOptionsCount = ibkrOptionsCount + tastyOptionsCount;
    const totalOptionsValue = (ibkrAcct.optionMarketValue || ibkrOptionsValue) + (tastyLongDerivVal + tastyShortDerivVal);
    const totalEquitiesCount = ibkrEquitiesCount + tastyEquitiesCount;
    const totalEquitiesValue = (ibkrAcct.stockMarketValue || ibkrEquitiesValue) + (tastyLongEquityVal + tastyShortEquityVal);
    const totalMaintMargin = ibkrMaint + tastyMaintReq;
    const totalAvailableWithdrawal = Math.max(0, ibkrAcct.availableFunds) + tastyCashForWithdrawal;

    const totalMarginUtilization = totalNetLiq > 0 ? Math.min(100, (totalMaintMargin / totalNetLiq) * 100) : 0;
    const totalMarginCushion = Math.max(0, 100 - totalMarginUtilization);

    // Allocation percentages
    const ibkrSharePercent = totalNetLiq > 0 ? (ibkrNetLiq / totalNetLiq) * 100 : 50;
    const tastySharePercent = totalNetLiq > 0 ? (tastyNetLiq / totalNetLiq) * 100 : 50;
    const optionsAllocationPercent = totalNetLiq > 0 ? (Math.abs(totalOptionsValue) / totalNetLiq) * 100 : 0;
    const equitiesAllocationPercent = totalNetLiq > 0 ? (Math.abs(totalEquitiesValue) / totalNetLiq) * 100 : 0;
    const cashAllocationPercent = totalNetLiq > 0 ? (Math.max(0, totalCash) / totalNetLiq) * 100 : 0;

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
          optionsAllocationPercent,
          equitiesAllocationPercent,
          cashAllocationPercent
        }
      },
      brokers: {
        ibkr: {
          name: 'Interactive Brokers',
          status: isConnected ? 'connected' : 'disconnected',
          accountNumber: ibkrAcct.accountName,
          accountType: ibkrAcct.accountType || 'Margin Account',
          currency: ibkrAcct.currency || 'USD',
          netLiquidatingValue: ibkrNetLiq,
          cash: ibkrAcct.cash,
          buyingPower: ibkrAcct.buyingPower,
          derivativeBuyingPower: ibkrAcct.buyingPower,
          equityBuyingPower: ibkrAcct.buyingPower,
          availableFunds: ibkrAcct.availableFunds,
          excessLiquidity: ibkrAcct.excessLiquidity,
          maintMargin: ibkrAcct.maintMargin,
          initMargin: ibkrAcct.initMargin,
          equityWithLoanValue: ibkrAcct.equityWithLoanValue,
          grossPositionValue: ibkrAcct.grossPositionValue,
          regTEquity: ibkrAcct.regTEquity,
          regTMargin: ibkrAcct.regTMargin,
          sma: ibkrAcct.sma,
          cushion: ibkrMarginCushion,
          marginUtilization: ibkrMarginUtilization,
          leverage: ibkrAcct.leverage || 1.0,
          unrealizedPnL: ibkrAcct.unrealizedPnL || ibkrUnrealizedPnL,
          dayPnL: ibkrDayPnL,
          realizedPnL: ibkrAcct.realizedPnL,
          optionsCount: ibkrOptionsCount,
          optionsValue: ibkrAcct.optionMarketValue || ibkrOptionsValue,
          equitiesCount: ibkrEquitiesCount,
          equitiesValue: ibkrAcct.stockMarketValue || ibkrEquitiesValue,
          dayTrading: {
            dayTradesRemaining: ibkrAcct.dayTradesRemaining,
            dayTradesRemainingT1: ibkrAcct.dayTradesRemainingT1,
            dayTradesRemainingT2: ibkrAcct.dayTradesRemainingT2,
            dayTradesRemainingT3: ibkrAcct.dayTradesRemainingT3,
            dayTradesRemainingT4: ibkrAcct.dayTradesRemainingT4,
          },
          accruedCash: ibkrAcct.accruedCash,
          accruedDividend: ibkrAcct.accruedDividend,
          rawMetrics: ibkrAcct.rawMetrics
        },
        tastytrade: {
          name: 'Tastytrade',
          status: tastyConnected ? 'connected' : (tastyHoldings.length > 0 ? 'active' : 'disconnected'),
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
          optionsValue: (tastyLongDerivVal + tastyShortDerivVal) || tastyOptionsValue,
          equitiesCount: tastyEquitiesCount,
          equitiesValue: (tastyLongEquityVal + tastyShortEquityVal) || tastyEquitiesValue,
          dayTrading: {
            isDayTrader: tastyIsDayTrader,
            dayTradingBuyingPower: tastyDayTradingBP
          },
          rawMetrics: tastyRawBalances || {}
        }
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
    logToFile(`Error fetching Yahoo data: ${error.message}`);
    console.error('Error fetching Yahoo data:', error);
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

// AI Analysis Endpoint (OpenRouter)
app.get('/api/research/analyze/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
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

    res.json({ analysis });

  } catch (error: any) {
    logToFile(`Error generating AI analysis: ${error.message}`);
    console.error('Error generating AI analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AI POSITION DEFENSE & MANAGEMENT ADVISOR
// ==========================================
app.post('/api/portfolio/analyze-position', async (req, res) => {
  try {
    const position = req.body;

    if (!position || !position.symbol) {
      return res.status(400).json({ error: 'Position data is required.' });
    }

    const symbol = (position.underlyingSymbol || position.symbol).trim().toUpperCase();
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
      return res.status(401).json({ error: 'Neither OPENROUTER_API_KEY nor GEMINI_API_KEY found in environment.' });
    }

    const cleanJson = rawAnalysis.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedAnalysis = JSON.parse(cleanJson);

    // Apply strict server-side mathematical validation and price enforcement
    if (parsedAnalysis && parsedAnalysis.rankedPlans) {
      parsedAnalysis.rankedPlans = validateAndEnforcePlanPricing(parsedAnalysis.rankedPlans, position, chainData);
    }

    res.json({
      success: true,
      position,
      analysis: parsedAnalysis,
      liveOptionChain: chainData
    });

  } catch (error: any) {
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
  try {
    const input = req.body || {};
    logToFile(`Starting AI Portfolio Analyser Agent on ${input.positions?.length || 0} positions...`);

    const auditResult = await runPortfolioAuditAgent(input, logToFile);
    const savedRecord = await savePortfolioAuditToDb(prisma, auditResult);

    logToFile(`AI Portfolio Audit completed successfully with Health Score: ${auditResult.healthScore}/100 (${auditResult.riskLevel}) - Saved DB ID: ${savedRecord.id}`);

    res.json({
      success: true,
      auditId: savedRecord.id,
      audit: auditResult,
      savedAt: savedRecord.createdAt
    });
  } catch (error: any) {
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

        resolve({ report: savedReport, pdfPath });
      } catch (postErr) {
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
async function checkPriceAlerts() {
  try {
    const activeAlerts = await prisma.priceAlert.findMany({
      where: { status: 'ACTIVE' }
    });

    if (activeAlerts.length === 0) return;

    // Collect unique symbols
    const uniqueSymbols = Array.from(new Set(activeAlerts.map(a => a.symbol.toUpperCase())));

    // Fetch prices in parallel
    const priceMap: Record<string, number> = {};
    await Promise.all(
      uniqueSymbols.map(async (sym) => {
        try {
          const summary = await yahooFinance.quoteSummary(sym, { modules: ['price'] });
          const price = summary?.price?.regularMarketPrice;
          if (price != null && !isNaN(price)) {
            priceMap[sym] = Number(price);
          }
        } catch (e) {
          // ignore transient symbol failure
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
        try {
          const summary = await yahooFinance.quoteSummary(sym, { modules: ['price'] });
          if (summary?.price?.regularMarketPrice) {
            priceMap[sym] = {
              price: summary.price.regularMarketPrice,
              name: summary.price.shortName || summary.price.longName || sym
            };
          }
        } catch {
          // ignore
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

    // Check current market price
    let currentPrice: number | null = null;
    try {
      const summary = await yahooFinance.quoteSummary(cleanSymbol, { modules: ['price'] });
      currentPrice = summary?.price?.regularMarketPrice ?? null;
    } catch {}

    const newAlert = await prisma.priceAlert.create({
      data: {
        symbol: cleanSymbol,
        targetPrice: numTarget,
        condition: cleanCondition,
        status: 'ACTIVE',
        notes: notes ? String(notes).trim() : null
      }
    });

    // Run immediate check
    setTimeout(checkPriceAlerts, 500);

    res.status(201).json({ success: true, alert: newAlert, currentPrice });
  } catch (error: any) {
    logToFile(`Error creating alert: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/alerts/:id - Update alert
app.put('/api/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetPrice, condition, notes, status } = req.body;

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

// POST /api/alerts/:id/reset - Re-arm / reset triggered alert
app.post('/api/alerts/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetPrice, condition } = req.body || {};

    const dataToUpdate: any = {
      status: 'ACTIVE',
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

// POST /api/ideas/generate-ai - Autonomous AI Idea Hunter Agent
app.post('/api/ideas/generate-ai', async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: 'OpenRouter API key is missing. Please add it to .env.local.' });
    }

    const {
      theme = 'AI & Semiconductor Infrastructure',
      customPrompt = '',
      sentiment = 'ANY',
      timeframe = 'SWING',
      count = 2,
      tickers: providedTickers
    } = req.body || {};

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
          tags: item.tags ? String(item.tags) : 'AI Generated, Tactical Idea',
          confidenceScore: item.confidenceScore ? Number(item.confidenceScore) : 85,
          status: 'ACTIVE',
          source: 'AI_AGENT'
        }
      });
      savedIdeas.push(created);
    }

    logToFile(`[AI Idea Hunter] Successfully saved ${savedIdeas.length} trade ideas`);
    res.status(201).json({ success: true, ideas: savedIdeas });
  } catch (error: any) {
    logToFile(`Error in AI Idea Hunter: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});



const server = app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
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
