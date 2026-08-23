import { PrismaClient } from '@prisma/client';
import { getTastyAccessToken } from './tastytradeService';

const TASTY_API_URL = 'https://api.tastyworks.com';

export interface TradeFilterParams {
  broker?: string;
  dateRangePreset?: 'today' | '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom' | string;
  startDate?: string;
  endDate?: string;
  assetType?: 'all' | 'OPTION' | 'EQUITY' | string;
  optionType?: 'all' | 'CALL' | 'PUT' | string;
  positionEffect?: 'all' | 'LONG' | 'SHORT' | string;
  action?: 'all' | 'BUY' | 'SELL' | 'BUY_TO_OPEN' | 'SELL_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_CLOSE' | string;
  search?: string;
  limit?: number;
  page?: number;
}

export interface TradeSummaryMetrics {
  totalTrades: number;
  totalBoughtValue: number;
  totalSoldValue: number;
  totalCredits: number;
  totalDebits: number;
  netCashFlow: number;
  totalCommissions: number;
  optionsCount: number;
  equitiesCount: number;
  longCount: number;
  shortCount: number;
}

/**
 * Parse OCC Option Symbol (e.g. "FLNC  260821P00013000")
 */
function parseOccSymbol(rawSymbol: string): {
  underlying: string;
  expiryDate?: string;
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
} {
  const match = rawSymbol.match(/^([A-Z\s]{1,6})\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/i);
  if (!match) {
    const spaceSplit = rawSymbol.trim().split(/\s+/);
    return { underlying: spaceSplit[0] || rawSymbol };
  }

  const underlying = match[1].trim();
  const year = '20' + match[2];
  const month = match[3];
  const day = match[4];
  const typeCode = match[5].toUpperCase();
  const rawStrike = parseInt(match[6], 10);

  return {
    underlying,
    expiryDate: `${year}-${month}-${day}`,
    optionType: typeCode === 'C' ? 'CALL' : 'PUT',
    strikePrice: rawStrike / 1000
  };
}

/**
 * Map raw Tastytrade transaction action to standard normalized action & position effect
 */
function normalizeActionAndEffect(rawAction: string, rawSubType?: string, instrumentType?: string): {
  action: string;
  side: 'BUY' | 'SELL';
  positionEffect: 'LONG' | 'SHORT';
} {
  const text = (rawAction || rawSubType || '').toUpperCase();

  if (text.includes('BUY TO OPEN') || text.includes('BUY_TO_OPEN')) {
    return { action: 'BUY_TO_OPEN', side: 'BUY', positionEffect: 'LONG' };
  }
  if (text.includes('SELL TO CLOSE') || text.includes('SELL_TO_CLOSE')) {
    return { action: 'SELL_TO_CLOSE', side: 'SELL', positionEffect: 'LONG' };
  }
  if (text.includes('SELL TO OPEN') || text.includes('SELL_TO_OPEN')) {
    return { action: 'SELL_TO_OPEN', side: 'SELL', positionEffect: 'SHORT' };
  }
  if (text.includes('BUY TO CLOSE') || text.includes('BUY_TO_CLOSE')) {
    return { action: 'BUY_TO_CLOSE', side: 'BUY', positionEffect: 'SHORT' };
  }
  if (text.startsWith('BUY')) {
    return { action: 'BUY', side: 'BUY', positionEffect: 'LONG' };
  }
  if (text.startsWith('SELL')) {
    return { action: 'SELL', side: 'SELL', positionEffect: 'SHORT' };
  }

  return { action: text || 'TRADE', side: 'BUY', positionEffect: 'LONG' };
}

/**
 * Fetch transaction history from Tastytrade REST API and persist to SQLite
 */
export async function syncTastytradeTransactions(
  prisma: PrismaClient,
  accountNumber?: string
): Promise<{ syncedCount: number; transactions: any[] }> {
  const accNumber = accountNumber || process.env.TASTY_ACCOUNT_NUMBER;
  if (!accNumber) {
    console.warn('Tastytrade Account Number not configured for transaction sync.');
    return { syncedCount: 0, transactions: [] };
  }

  try {
    const token = await getTastyAccessToken();
    const response = await fetch(`${TASTY_API_URL}/accounts/${accNumber}/transactions?per-page=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'Antigravity/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Tastytrade transactions API returned status ${response.status}: ${errorText}`);
      return { syncedCount: 0, transactions: [] };
    }

    const json: any = await response.json();
    const items: any[] = json?.data?.items || [];
    let syncedCount = 0;

    for (const item of items) {
      if (item['transaction-type'] !== 'Trade' && !item.action && !item.symbol) {
        continue;
      }

      const brokerTradeId = String(item.id || item['exec-id'] || Math.random());
      const rawSymbol = item.symbol || item['underlying-symbol'] || 'UNKNOWN';
      const isOption = item['instrument-type'] === 'Equity Option' || /[CP]\d{8}$/i.test(rawSymbol);
      const parsedOcc = isOption ? parseOccSymbol(rawSymbol) : { underlying: item['underlying-symbol'] || rawSymbol };

      const { action, side, positionEffect } = normalizeActionAndEffect(
        item.action,
        item['transaction-sub-type'],
        item['instrument-type']
      );

      const quantity = Math.abs(parseFloat(item.quantity || '1'));
      const price = Math.abs(parseFloat(item.price || '0'));
      const totalVal = Math.abs(parseFloat(item.value || item['net-value'] || '0'));
      const valueEffect = (item['value-effect'] || (side === 'BUY' ? 'Debit' : 'Credit')).toUpperCase();

      const commission = Math.abs(parseFloat(item.commission || '0'));
      const clearingFees = Math.abs(parseFloat(item['clearing-fees'] || '0')) + Math.abs(parseFloat(item['regulatory-fees'] || '0'));
      const executedAt = new Date(item['executed-at'] || item['transaction-date'] || item['created-at'] || Date.now());

      await prisma.tradeRecord.upsert({
        where: {
          broker_brokerTradeId: {
            broker: 'Tastytrade',
            brokerTradeId
          }
        },
        update: {
          symbol: rawSymbol,
          underlyingSymbol: parsedOcc.underlying || item['underlying-symbol'] || rawSymbol,
          assetType: isOption ? 'OPTION' : 'EQUITY',
          optionType: parsedOcc.optionType || null,
          strikePrice: parsedOcc.strikePrice || null,
          expiryDate: parsedOcc.expiryDate || null,
          action,
          side,
          positionEffect,
          quantity,
          price,
          totalValue: totalVal,
          valueEffect,
          commission,
          clearingFees,
          orderId: item['order-id'] ? String(item['order-id']) : null,
          description: item.description || `${action} ${quantity} ${rawSymbol} @ $${price.toFixed(2)}`,
          executedAt
        },
        create: {
          broker: 'Tastytrade',
          brokerTradeId,
          symbol: rawSymbol,
          underlyingSymbol: parsedOcc.underlying || item['underlying-symbol'] || rawSymbol,
          assetType: isOption ? 'OPTION' : 'EQUITY',
          optionType: parsedOcc.optionType || null,
          strikePrice: parsedOcc.strikePrice || null,
          expiryDate: parsedOcc.expiryDate || null,
          action,
          side,
          positionEffect,
          quantity,
          price,
          totalValue: totalVal,
          valueEffect,
          commission,
          clearingFees,
          orderId: item['order-id'] ? String(item['order-id']) : null,
          description: item.description || `${action} ${quantity} ${rawSymbol} @ $${price.toFixed(2)}`,
          executedAt
        }
      });

      syncedCount++;
    }

    return { syncedCount, transactions: items };
  } catch (error: any) {
    console.error('Error in syncTastytradeTransactions:', error);
    return { syncedCount: 0, transactions: [] };
  }
}

/**
 * Compute date boundaries based on preset or custom strings
 */
function resolveDateRange(params: TradeFilterParams): { start?: Date; end?: Date } {
  const { dateRangePreset, startDate, endDate } = params;

  if (startDate || endDate) {
    return {
      start: startDate ? new Date(startDate) : undefined,
      end: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : undefined
    };
  }

  const now = new Date();
  if (dateRangePreset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return { start, end: now };
  }
  if (dateRangePreset === '7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }
  if (dateRangePreset === '30d') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }
  if (dateRangePreset === '90d') {
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }
  if (dateRangePreset === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    return { start, end: now };
  }

  return {};
}

/**
 * Query unified trades from SQLite with multifaceted filtering and calculate KPI metrics
 */
export async function getFilteredTrades(
  prisma: PrismaClient,
  params: TradeFilterParams = {}
): Promise<{
  trades: any[];
  metrics: TradeSummaryMetrics;
  totalCount: number;
  page: number;
  limit: number;
}> {
  const {
    broker,
    assetType,
    optionType,
    positionEffect,
    action,
    search,
    limit = 50,
    page = 1
  } = params;

  const { start, end } = resolveDateRange(params);

  const where: any = {};

  // 1. Broker Filter
  if (broker && broker !== 'all') {
    if (broker.toLowerCase().includes('tasty')) {
      where.broker = 'Tastytrade';
    } else if (broker.toLowerCase().includes('ibkr') || broker.toLowerCase().includes('interactive')) {
      where.broker = 'Interactive Brokers';
    } else {
      where.broker = broker;
    }
  }

  // 2. Date Range Filter
  if (start || end) {
    where.executedAt = {};
    if (start) where.executedAt.gte = start;
    if (end) where.executedAt.lte = end;
  }

  // 3. Asset Type Filter (Options vs Equities)
  if (assetType && assetType !== 'all') {
    where.assetType = assetType.toUpperCase();
  }

  // 4. Option Type Filter (Calls vs Puts)
  if (optionType && optionType !== 'all') {
    where.optionType = optionType.toUpperCase();
  }

  // 5. Position Effect Filter (Short vs Long)
  if (positionEffect && positionEffect !== 'all') {
    where.positionEffect = positionEffect.toUpperCase();
  }

  // 6. Action Filter
  if (action && action !== 'all') {
    const actUpper = action.toUpperCase();
    if (actUpper === 'BUY' || actUpper === 'SELL') {
      where.side = actUpper;
    } else {
      where.action = actUpper;
    }
  }

  // 7. Search Filter (symbol, underlyingSymbol, description)
  if (search && search.trim()) {
    const query = search.trim();
    where.OR = [
      { symbol: { contains: query } },
      { underlyingSymbol: { contains: query } },
      { description: { contains: query } }
    ];
  }

  // Execute queries: Count, Aggregates, and Paginated List
  const totalCount = await prisma.tradeRecord.count({ where });

  const allFiltered = await prisma.tradeRecord.findMany({
    where,
    orderBy: { executedAt: 'desc' }
  });

  const skip = (Math.max(1, page) - 1) * limit;
  const paginatedTrades = allFiltered.slice(skip, skip + limit);

  // Compute Metrics over the entire filtered set
  let totalBoughtValue = 0;
  let totalSoldValue = 0;
  let totalCredits = 0;
  let totalDebits = 0;
  let totalCommissions = 0;
  let optionsCount = 0;
  let equitiesCount = 0;
  let longCount = 0;
  let shortCount = 0;

  for (const t of allFiltered) {
    const val = t.totalValue || (t.quantity * t.price) || 0;
    const comm = (t.commission || 0) + (t.clearingFees || 0);

    totalCommissions += comm;

    if (t.side === 'BUY') {
      totalBoughtValue += val;
    } else {
      totalSoldValue += val;
    }

    if (t.valueEffect === 'CREDIT' || (!t.valueEffect && t.side === 'SELL')) {
      totalCredits += val;
    } else {
      totalDebits += val;
    }

    if (t.assetType === 'OPTION') {
      optionsCount++;
    } else {
      equitiesCount++;
    }

    if (t.positionEffect === 'LONG') {
      longCount++;
    } else {
      shortCount++;
    }
  }

  const metrics: TradeSummaryMetrics = {
    totalTrades: allFiltered.length,
    totalBoughtValue,
    totalSoldValue,
    totalCredits,
    totalDebits,
    netCashFlow: totalCredits - totalDebits,
    totalCommissions,
    optionsCount,
    equitiesCount,
    longCount,
    shortCount
  };

  return {
    trades: paginatedTrades,
    metrics,
    totalCount,
    page,
    limit
  };
}

/**
 * Create a manual trade record in the database
 */
export async function createManualTrade(prisma: PrismaClient, data: any) {
  const isOption = data.assetType === 'OPTION' || Boolean(data.optionType);
  const side = (data.side || (data.action?.includes('BUY') ? 'BUY' : 'SELL')).toUpperCase();
  const positionEffect = data.positionEffect || (side === 'BUY' ? 'LONG' : 'SHORT');
  const quantity = Math.abs(Number(data.quantity || 1));
  const price = Math.abs(Number(data.price || 0));
  const totalValue = Number(data.totalValue || (quantity * price * (isOption ? 100 : 1)));

  return await prisma.tradeRecord.create({
    data: {
      broker: data.broker || 'Manual',
      brokerTradeId: `manual-${Date.now()}`,
      symbol: data.symbol.toUpperCase(),
      underlyingSymbol: data.underlyingSymbol ? data.underlyingSymbol.toUpperCase() : data.symbol.toUpperCase(),
      assetType: isOption ? 'OPTION' : 'EQUITY',
      optionType: isOption ? (data.optionType || 'CALL').toUpperCase() : null,
      strikePrice: data.strikePrice ? Number(data.strikePrice) : null,
      expiryDate: data.expiryDate || null,
      action: (data.action || (side === 'BUY' ? 'BUY_TO_OPEN' : 'SELL_TO_OPEN')).toUpperCase(),
      side,
      positionEffect,
      quantity,
      price,
      totalValue,
      valueEffect: data.valueEffect || (side === 'BUY' ? 'DEBIT' : 'CREDIT'),
      commission: Number(data.commission || 0),
      clearingFees: Number(data.clearingFees || 0),
      description: data.description || `${data.action || side} ${quantity} ${data.symbol} @ $${price.toFixed(2)}`,
      executedAt: data.executedAt ? new Date(data.executedAt) : new Date()
    }
  });
}

/**
 * Delete a trade record by ID
 */
export async function deleteTradeRecord(prisma: PrismaClient, id: string) {
  return await prisma.tradeRecord.delete({
    where: { id }
  });
}
