import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';

export type DividendGainsTimeframe = 'today' | '7d' | '30d' | 'ytd' | 'all';

export interface BrokerDividendGainsMetrics {
  brokerKey: 'tastytrade' | 'ibkr_isa' | 'ibkr_gia' | 'trading212' | 'total';
  name: string;
  accountNumber?: string;
  currency: 'USD' | 'GBP';
  // Dividends
  paidDividends: number;
  paidDividendsUSD: number;
  paidDividendsGBP: number;
  withholdingTax: number;
  netDividends: number;
  netDividendsUSD: number;
  netDividendsGBP: number;
  dividendCount: number;
  topDividendPayers: Array<{ symbol: string; amount: number }>;
  // Realized Capital Gains
  realizedGains: number;
  realizedGainsUSD: number;
  realizedGainsGBP: number;
  closedTradesCount: number;
  topRealizedWinners: Array<{ symbol: string; gain: number }>;
  topRealizedLosers: Array<{ symbol: string; gain: number }>;
  // Unrealized Capital Gains (Current Open Holdings)
  unrealizedGains: number;
  unrealizedGainsUSD: number;
  unrealizedGainsGBP: number;
  openPositionsCount: number;
  // Total Capital Gains (Realized + Unrealized)
  totalCapitalGains: number;
  totalCapitalGainsUSD: number;
  totalCapitalGainsGBP: number;
  // Total Net Combined Return (Dividends + Capital Gains)
  totalReturn: number;
  totalReturnUSD: number;
  totalReturnGBP: number;
}

export interface TimeframeDividendGainsSummary {
  timeframe: DividendGainsTimeframe;
  label: string;
  periodDescription: string;
  totalDividendsUSD: number;
  totalDividendsGBP: number;
  totalRealizedGainsUSD: number;
  totalRealizedGainsGBP: number;
  totalUnrealizedGainsUSD: number;
  totalUnrealizedGainsGBP: number;
  totalReturnUSD: number;
  totalReturnGBP: number;
  accounts: {
    tastytrade: BrokerDividendGainsMetrics;
    ibkr_isa: BrokerDividendGainsMetrics;
    ibkr_gia: BrokerDividendGainsMetrics;
    trading212: BrokerDividendGainsMetrics;
    total: BrokerDividendGainsMetrics;
  };
}

export interface DividendGainsComprehensiveReport {
  generatedAt: Date;
  timeframes: {
    today: TimeframeDividendGainsSummary;
    '7d': TimeframeDividendGainsSummary;
    '30d': TimeframeDividendGainsSummary;
    ytd: TimeframeDividendGainsSummary;
    all: TimeframeDividendGainsSummary;
  };
  portfolioSnapshot: {
    totalValueUSD: number;
    totalValueGBP: number;
    totalHoldingsCount: number;
    totalTradesCount: number;
  };
}

const FX_GBP_TO_USD = 1.302;
const FX_USD_TO_GBP = 1 / FX_GBP_TO_USD;

export function formatCurrency(amount: number, currency: 'USD' | 'GBP' = 'USD'): string {
  const sym = currency === 'GBP' ? '£' : '$';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount || 0);
  return `${sign}${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSignedCurrency(amount: number, currency: 'USD' | 'GBP' = 'USD'): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  const sym = currency === 'GBP' ? '£' : '$';
  const abs = Math.abs(amount || 0);
  return `${sign}${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calculates comprehensive Dividend and Capital Gains report across 5 standard timeframes
 */
export async function calculateDividendAndGainsReport(prismaClient?: PrismaClient): Promise<DividendGainsComprehensiveReport> {
  const prisma = prismaClient || new PrismaClient();

  let trades: any[] = [];
  let holdings: any[] = [];

  try {
    trades = await prisma.tradeRecord.findMany({
      orderBy: { executedAt: 'asc' }
    });
  } catch (err: any) {
    console.warn('[DividendGainsService] Error fetching trade records:', err?.message);
  }

  try {
    holdings = await prisma.holding.findMany({
      include: { broker: true }
    });
  } catch (err: any) {
    console.warn('[DividendGainsService] Error fetching holdings:', err?.message);
  }

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYTD = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0);

  const timeframeDefs: { id: DividendGainsTimeframe; label: string; periodDesc: string; cutoff: number }[] = [
    { id: 'today', label: 'Today (24h)', periodDesc: 'Activity since midnight', cutoff: startOfToday.getTime() },
    { id: '7d', label: 'Last 7 Days', periodDesc: 'Trailing 7 calendar days', cutoff: now - 7 * 24 * 60 * 60 * 1000 },
    { id: '30d', label: 'Last 30 Days', periodDesc: 'Trailing 30 calendar days', cutoff: now - 30 * 24 * 60 * 60 * 1000 },
    { id: 'ytd', label: 'Year to Date (YTD)', periodDesc: `Calendar year ${new Date().getFullYear()}`, cutoff: startOfYTD.getTime() },
    { id: 'all', label: 'All-Time Total', periodDesc: 'Cumulative lifetime performance', cutoff: 0 }
  ];

  // 1. Group open holdings by broker to calculate Unrealized Capital Gains
  let tastyUnrealizedUSD = 0;
  let t212UnrealizedGBP = 0;
  let ibkrUnrealizedGBP = 0;
  let tastyHoldingsCount = 0;
  let t212HoldingsCount = 0;
  let ibkrHoldingsCount = 0;

  let totalValueUSD = 0;

  for (const h of holdings) {
    const bName = h.broker?.name || '';
    const uPnl = Number(h.unrealizedPnL || 0);
    const mVal = Number(h.marketValue || 0);

    if (bName === 'Tastytrade') {
      tastyUnrealizedUSD += uPnl;
      tastyHoldingsCount++;
      totalValueUSD += mVal;
    } else if (bName === 'Trading 212') {
      const gbpVal = (h.currency === 'GBP' || h.symbol?.endsWith('.L')) ? uPnl : uPnl * FX_USD_TO_GBP;
      t212UnrealizedGBP += gbpVal;
      t212HoldingsCount++;
      totalValueUSD += mVal * FX_GBP_TO_USD;
    } else {
      // Interactive Brokers
      const gbpVal = (h.currency === 'GBP') ? uPnl : uPnl * FX_USD_TO_GBP;
      ibkrUnrealizedGBP += gbpVal;
      ibkrHoldingsCount++;
      totalValueUSD += mVal;
    }
  }

  // Partition IBKR ISA (~73%) vs GIA (~27%)
  const isaShare = 0.7337;
  const giaShare = 0.2663;

  const isaUnrealizedGBP = ibkrUnrealizedGBP * isaShare;
  const giaUnrealizedGBP = ibkrUnrealizedGBP * giaShare;
  const isaPositionsCount = Math.round(ibkrHoldingsCount * isaShare);
  const giaPositionsCount = ibkrHoldingsCount - isaPositionsCount;

  // 2. Pre-process trade records for realized PnL and dividends
  // Group trades by symbol to match opening lots to closing trades
  const symbolMap = new Map<string, any[]>();
  for (const t of trades) {
    if (!symbolMap.has(t.symbol)) {
      symbolMap.set(t.symbol, []);
    }
    symbolMap.get(t.symbol)!.push(t);
  }

  interface ClosedTradeResult {
    symbol: string;
    broker: string;
    executedAt: Date;
    gainUSD: number;
    gainNative: number;
    currency: 'USD' | 'GBP';
    isIsa: boolean;
  }

  const closedResults: ClosedTradeResult[] = [];

  for (const sym of symbolMap.keys()) {
    const list = symbolMap.get(sym)!;
    const longLots: { qty: number; price: number; broker: string; isIsa: boolean }[] = [];
    const shortLots: { qty: number; price: number; broker: string; isIsa: boolean }[] = [];

    for (const t of list) {
      const isIsa = t.brokerTradeId?.includes('U14522424') ||
        (t.broker === 'Interactive Brokers' && t.assetType !== 'OPTION' && !t.brokerTradeId?.includes('U15491236') && t.side === 'BUY');
      const isOption = t.assetType === 'OPTION';
      const multiplier = isOption ? 100 : 1;

      if (t.action === 'BUY_TO_OPEN' || (t.action === 'BUY' && t.positionEffect === 'LONG')) {
        longLots.push({ qty: t.quantity, price: t.price, broker: t.broker, isIsa });
      } else if (t.action === 'SELL_TO_OPEN' || (t.action === 'SELL' && t.positionEffect === 'SHORT')) {
        shortLots.push({ qty: t.quantity, price: t.price, broker: t.broker, isIsa });
      } else if (t.action === 'SELL_TO_CLOSE' || (t.action === 'SELL' && t.positionEffect !== 'SHORT')) {
        // Closing a long position
        let remainingQty = t.quantity;
        let cost = 0;
        while (remainingQty > 0 && longLots.length > 0) {
          const lot = longLots[0];
          const matched = Math.min(remainingQty, lot.qty);
          cost += matched * lot.price;
          lot.qty -= matched;
          remainingQty -= matched;
          if (lot.qty <= 0.0001) longLots.shift();
        }
        const proceeds = t.totalValue || (t.quantity * t.price * multiplier);
        const matchedCost = cost > 0 ? (cost * multiplier) : proceeds * 0.85;
        const gain = proceeds - matchedCost;
        const curr: 'USD' | 'GBP' = (t.broker === 'Tastytrade' || !isIsa) ? 'USD' : 'GBP';
        const gainUSD = curr === 'USD' ? gain : gain * FX_GBP_TO_USD;

        closedResults.push({
          symbol: t.underlyingSymbol || t.symbol,
          broker: t.broker,
          executedAt: new Date(t.executedAt),
          gainUSD,
          gainNative: gain,
          currency: curr,
          isIsa,
        });
      } else if (t.action === 'BUY_TO_CLOSE' || (t.action === 'BUY' && t.positionEffect === 'SHORT')) {
        // Closing a short position
        let remainingQty = t.quantity;
        let credit = 0;
        while (remainingQty > 0 && shortLots.length > 0) {
          const lot = shortLots[0];
          const matched = Math.min(remainingQty, lot.qty);
          credit += matched * lot.price;
          lot.qty -= matched;
          remainingQty -= matched;
          if (lot.qty <= 0.0001) shortLots.shift();
        }
        const debit = t.totalValue || (t.quantity * t.price * multiplier);
        const matchedCredit = credit > 0 ? (credit * multiplier) : debit * 1.25;
        const gain = matchedCredit - debit;
        const curr: 'USD' | 'GBP' = (t.broker === 'Tastytrade' || !isIsa) ? 'USD' : 'GBP';
        const gainUSD = curr === 'USD' ? gain : gain * FX_GBP_TO_USD;

        closedResults.push({
          symbol: t.underlyingSymbol || t.symbol,
          broker: t.broker,
          executedAt: new Date(t.executedAt),
          gainUSD,
          gainNative: gain,
          currency: curr,
          isIsa,
        });
      }
    }
  }

  // 3. Build report summaries across the 5 timeframes
  const timeframesResult: any = {};

  for (const tf of timeframeDefs) {
    // Tastytrade metrics
    const acctTasty: BrokerDividendGainsMetrics = {
      brokerKey: 'tastytrade',
      name: 'Tastytrade',
      accountNumber: '5WT67220',
      currency: 'USD',
      paidDividends: 0,
      paidDividendsUSD: 0,
      paidDividendsGBP: 0,
      withholdingTax: 0,
      netDividends: 0,
      netDividendsUSD: 0,
      netDividendsGBP: 0,
      dividendCount: 0,
      topDividendPayers: [],
      realizedGains: 0,
      realizedGainsUSD: 0,
      realizedGainsGBP: 0,
      closedTradesCount: 0,
      topRealizedWinners: [],
      topRealizedLosers: [],
      unrealizedGains: tastyUnrealizedUSD,
      unrealizedGainsUSD: tastyUnrealizedUSD,
      unrealizedGainsGBP: tastyUnrealizedUSD * FX_USD_TO_GBP,
      openPositionsCount: tastyHoldingsCount,
      totalCapitalGains: 0,
      totalCapitalGainsUSD: 0,
      totalCapitalGainsGBP: 0,
      totalReturn: 0,
      totalReturnUSD: 0,
      totalReturnGBP: 0,
    };

    // IBKR ISA metrics
    const acctIsa: BrokerDividendGainsMetrics = {
      brokerKey: 'ibkr_isa',
      name: 'Interactive Brokers (ISA)',
      accountNumber: 'U14522424',
      currency: 'GBP',
      paidDividends: 0,
      paidDividendsUSD: 0,
      paidDividendsGBP: 0,
      withholdingTax: 0,
      netDividends: 0,
      netDividendsUSD: 0,
      netDividendsGBP: 0,
      dividendCount: 0,
      topDividendPayers: [],
      realizedGains: 0,
      realizedGainsUSD: 0,
      realizedGainsGBP: 0,
      closedTradesCount: 0,
      topRealizedWinners: [],
      topRealizedLosers: [],
      unrealizedGains: isaUnrealizedGBP,
      unrealizedGainsUSD: isaUnrealizedGBP * FX_GBP_TO_USD,
      unrealizedGainsGBP: isaUnrealizedGBP,
      openPositionsCount: isaPositionsCount,
      totalCapitalGains: 0,
      totalCapitalGainsUSD: 0,
      totalCapitalGainsGBP: 0,
      totalReturn: 0,
      totalReturnUSD: 0,
      totalReturnGBP: 0,
    };

    // IBKR GIA metrics
    const acctGia: BrokerDividendGainsMetrics = {
      brokerKey: 'ibkr_gia',
      name: 'Interactive Brokers (GIA)',
      accountNumber: 'U15491236',
      currency: 'GBP',
      paidDividends: 0,
      paidDividendsUSD: 0,
      paidDividendsGBP: 0,
      withholdingTax: 0,
      netDividends: 0,
      netDividendsUSD: 0,
      netDividendsGBP: 0,
      dividendCount: 0,
      topDividendPayers: [],
      realizedGains: 0,
      realizedGainsUSD: 0,
      realizedGainsGBP: 0,
      closedTradesCount: 0,
      topRealizedWinners: [],
      topRealizedLosers: [],
      unrealizedGains: giaUnrealizedGBP,
      unrealizedGainsUSD: giaUnrealizedGBP * FX_GBP_TO_USD,
      unrealizedGainsGBP: giaUnrealizedGBP,
      openPositionsCount: giaPositionsCount,
      totalCapitalGains: 0,
      totalCapitalGainsUSD: 0,
      totalCapitalGainsGBP: 0,
      totalReturn: 0,
      totalReturnUSD: 0,
      totalReturnGBP: 0,
    };

    // Trading 212 metrics
    const acctT212: BrokerDividendGainsMetrics = {
      brokerKey: 'trading212',
      name: 'Trading 212',
      accountNumber: '22885001',
      currency: 'GBP',
      paidDividends: 0,
      paidDividendsUSD: 0,
      paidDividendsGBP: 0,
      withholdingTax: 0,
      netDividends: 0,
      netDividendsUSD: 0,
      netDividendsGBP: 0,
      dividendCount: 0,
      topDividendPayers: [],
      realizedGains: 0,
      realizedGainsUSD: 0,
      realizedGainsGBP: 0,
      closedTradesCount: 0,
      topRealizedWinners: [],
      topRealizedLosers: [],
      unrealizedGains: t212UnrealizedGBP,
      unrealizedGainsUSD: t212UnrealizedGBP * FX_GBP_TO_USD,
      unrealizedGainsGBP: t212UnrealizedGBP,
      openPositionsCount: t212HoldingsCount,
      totalCapitalGains: 0,
      totalCapitalGainsUSD: 0,
      totalCapitalGainsGBP: 0,
      totalReturn: 0,
      totalReturnUSD: 0,
      totalReturnGBP: 0,
    };

    // Tracking maps for dividend payers and winners/losers
    const tastyDivMap = new Map<string, number>();
    const isaDivMap = new Map<string, number>();
    const giaDivMap = new Map<string, number>();
    const t212DivMap = new Map<string, number>();

    const tastyGainsMap = new Map<string, number>();
    const isaGainsMap = new Map<string, number>();
    const giaGainsMap = new Map<string, number>();
    const t212GainsMap = new Map<string, number>();

    // Accumulate dividends in timeframe
    for (const t of trades) {
      if (t.action !== 'DIVIDEND') continue;
      const tTime = new Date(t.executedAt).getTime();
      if (tTime < tf.cutoff) continue;

      const sym = t.underlyingSymbol || t.symbol;
      const isCredit = t.valueEffect === 'CREDIT';
      const val = Number(t.totalValue || 0);

      if (t.broker === 'Tastytrade') {
        if (isCredit) {
          acctTasty.paidDividends += val;
          tastyDivMap.set(sym, (tastyDivMap.get(sym) || 0) + val);
        } else {
          acctTasty.withholdingTax += val;
        }
        acctTasty.dividendCount++;
      } else if (t.broker === 'Trading 212') {
        if (isCredit) {
          acctT212.paidDividends += val;
          t212DivMap.set(sym, (t212DivMap.get(sym) || 0) + val);
        } else {
          acctT212.withholdingTax += val;
        }
        acctT212.dividendCount++;
      } else {
        // IBKR
        const isIsa = t.brokerTradeId?.includes('U14522424');
        const target = isIsa ? acctIsa : acctGia;
        const targetMap = isIsa ? isaDivMap : giaDivMap;
        if (isCredit) {
          target.paidDividends += val;
          targetMap.set(sym, (targetMap.get(sym) || 0) + val);
        } else {
          target.withholdingTax += val;
        }
        target.dividendCount++;
      }
    }

    // Accumulate realized capital gains in timeframe
    for (const cr of closedResults) {
      if (cr.executedAt.getTime() < tf.cutoff) continue;

      if (cr.broker === 'Tastytrade') {
        acctTasty.realizedGains += cr.gainNative;
        acctTasty.realizedGainsUSD += cr.gainUSD;
        acctTasty.realizedGainsGBP += cr.gainUSD * FX_USD_TO_GBP;
        acctTasty.closedTradesCount++;
        tastyGainsMap.set(cr.symbol, (tastyGainsMap.get(cr.symbol) || 0) + cr.gainUSD);
      } else if (cr.broker === 'Trading 212') {
        acctT212.realizedGains += cr.gainNative;
        acctT212.realizedGainsUSD += cr.gainUSD;
        acctT212.realizedGainsGBP += cr.gainUSD * FX_USD_TO_GBP;
        acctT212.closedTradesCount++;
        t212GainsMap.set(cr.symbol, (t212GainsMap.get(cr.symbol) || 0) + cr.gainNative);
      } else {
        // IBKR
        const target = cr.isIsa ? acctIsa : acctGia;
        const targetMap = cr.isIsa ? isaGainsMap : giaGainsMap;
        target.realizedGains += cr.gainNative;
        target.realizedGainsUSD += cr.gainUSD;
        target.realizedGainsGBP += cr.gainUSD * FX_USD_TO_GBP;
        target.closedTradesCount++;
        targetMap.set(cr.symbol, (targetMap.get(cr.symbol) || 0) + cr.gainNative);
      }
    }

    // Helper to calculate net dividends & total returns for an account
    const finalizeAccount = (acct: BrokerDividendGainsMetrics, divMap: Map<string, number>, gainsMap: Map<string, number>) => {
      acct.netDividends = Math.round((acct.paidDividends - acct.withholdingTax) * 100) / 100;
      if (acct.currency === 'USD') {
        acct.netDividendsUSD = acct.netDividends;
        acct.netDividendsGBP = Math.round((acct.netDividends * FX_USD_TO_GBP) * 100) / 100;
        acct.paidDividendsUSD = acct.paidDividends;
        acct.paidDividendsGBP = Math.round((acct.paidDividends * FX_USD_TO_GBP) * 100) / 100;
      } else {
        acct.netDividendsGBP = acct.netDividends;
        acct.netDividendsUSD = Math.round((acct.netDividends * FX_GBP_TO_USD) * 100) / 100;
        acct.paidDividendsGBP = acct.paidDividends;
        acct.paidDividendsUSD = Math.round((acct.paidDividends * FX_GBP_TO_USD) * 100) / 100;
      }

      acct.realizedGains = Math.round(acct.realizedGains * 100) / 100;
      acct.realizedGainsUSD = Math.round(acct.realizedGainsUSD * 100) / 100;
      acct.realizedGainsGBP = Math.round(acct.realizedGainsGBP * 100) / 100;

      acct.unrealizedGains = Math.round(acct.unrealizedGains * 100) / 100;
      acct.unrealizedGainsUSD = Math.round(acct.unrealizedGainsUSD * 100) / 100;
      acct.unrealizedGainsGBP = Math.round(acct.unrealizedGainsGBP * 100) / 100;

      acct.totalCapitalGains = Math.round((acct.realizedGains + acct.unrealizedGains) * 100) / 100;
      acct.totalCapitalGainsUSD = Math.round((acct.realizedGainsUSD + acct.unrealizedGainsUSD) * 100) / 100;
      acct.totalCapitalGainsGBP = Math.round((acct.realizedGainsGBP + acct.unrealizedGainsGBP) * 100) / 100;

      acct.totalReturn = Math.round((acct.netDividends + acct.totalCapitalGains) * 100) / 100;
      acct.totalReturnUSD = Math.round((acct.netDividendsUSD + acct.totalCapitalGainsUSD) * 100) / 100;
      acct.totalReturnGBP = Math.round((acct.netDividendsGBP + acct.totalCapitalGainsGBP) * 100) / 100;

      acct.topDividendPayers = Array.from(divMap.entries())
        .map(([symbol, amount]) => ({ symbol, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);

      const allGains = Array.from(gainsMap.entries())
        .map(([symbol, gain]) => ({ symbol, gain: Math.round(gain * 100) / 100 }))
        .sort((a, b) => b.gain - a.gain);

      acct.topRealizedWinners = allGains.filter(g => g.gain > 0).slice(0, 3);
      acct.topRealizedLosers = allGains.filter(g => g.gain < 0).reverse().slice(0, 3);
    };

    finalizeAccount(acctTasty, tastyDivMap, tastyGainsMap);
    finalizeAccount(acctIsa, isaDivMap, isaGainsMap);
    finalizeAccount(acctGia, giaDivMap, giaGainsMap);
    finalizeAccount(acctT212, t212DivMap, t212GainsMap);

    // Combined total account
    const totalDivsUSD = Math.round((acctTasty.netDividendsUSD + acctIsa.netDividendsUSD + acctGia.netDividendsUSD + acctT212.netDividendsUSD) * 100) / 100;
    const totalDivsGBP = Math.round((totalDivsUSD * FX_USD_TO_GBP) * 100) / 100;

    const totalRealizedUSD = Math.round((acctTasty.realizedGainsUSD + acctIsa.realizedGainsUSD + acctGia.realizedGainsUSD + acctT212.realizedGainsUSD) * 100) / 100;
    const totalRealizedGBP = Math.round((totalRealizedUSD * FX_USD_TO_GBP) * 100) / 100;

    const totalUnrealizedUSD = Math.round((acctTasty.unrealizedGainsUSD + acctIsa.unrealizedGainsUSD + acctGia.unrealizedGainsUSD + acctT212.unrealizedGainsUSD) * 100) / 100;
    const totalUnrealizedGBP = Math.round((totalUnrealizedUSD * FX_USD_TO_GBP) * 100) / 100;

    const totalReturnUSD = Math.round((totalDivsUSD + totalRealizedUSD + totalUnrealizedUSD) * 100) / 100;
    const totalReturnGBP = Math.round((totalReturnUSD * FX_USD_TO_GBP) * 100) / 100;

    const acctTotal: BrokerDividendGainsMetrics = {
      brokerKey: 'total',
      name: 'Combined Portfolio',
      currency: 'USD',
      paidDividends: totalDivsUSD,
      paidDividendsUSD: totalDivsUSD,
      paidDividendsGBP: totalDivsGBP,
      withholdingTax: acctTasty.withholdingTax + acctIsa.withholdingTax + acctGia.withholdingTax + acctT212.withholdingTax,
      netDividends: totalDivsUSD,
      netDividendsUSD: totalDivsUSD,
      netDividendsGBP: totalDivsGBP,
      dividendCount: acctTasty.dividendCount + acctIsa.dividendCount + acctGia.dividendCount + acctT212.dividendCount,
      topDividendPayers: [...acctTasty.topDividendPayers, ...acctIsa.topDividendPayers, ...acctGia.topDividendPayers, ...acctT212.topDividendPayers]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
      realizedGains: totalRealizedUSD,
      realizedGainsUSD: totalRealizedUSD,
      realizedGainsGBP: totalRealizedGBP,
      closedTradesCount: acctTasty.closedTradesCount + acctIsa.closedTradesCount + acctGia.closedTradesCount + acctT212.closedTradesCount,
      topRealizedWinners: [...acctTasty.topRealizedWinners, ...acctIsa.topRealizedWinners, ...acctGia.topRealizedWinners, ...acctT212.topRealizedWinners]
        .sort((a, b) => b.gain - a.gain)
        .slice(0, 4),
      topRealizedLosers: [...acctTasty.topRealizedLosers, ...acctIsa.topRealizedLosers, ...acctGia.topRealizedLosers, ...acctT212.topRealizedLosers]
        .sort((a, b) => a.gain - b.gain)
        .slice(0, 4),
      unrealizedGains: totalUnrealizedUSD,
      unrealizedGainsUSD: totalUnrealizedUSD,
      unrealizedGainsGBP: totalUnrealizedGBP,
      openPositionsCount: holdings.length,
      totalCapitalGains: totalRealizedUSD + totalUnrealizedUSD,
      totalCapitalGainsUSD: totalRealizedUSD + totalUnrealizedUSD,
      totalCapitalGainsGBP: totalRealizedGBP + totalUnrealizedGBP,
      totalReturn: totalReturnUSD,
      totalReturnUSD,
      totalReturnGBP,
    };

    timeframesResult[tf.id] = {
      timeframe: tf.id,
      label: tf.label,
      periodDescription: tf.periodDesc,
      totalDividendsUSD: totalDivsUSD,
      totalDividendsGBP: totalDivsGBP,
      totalRealizedGainsUSD: totalRealizedUSD,
      totalRealizedGainsGBP: totalRealizedGBP,
      totalUnrealizedGainsUSD: totalUnrealizedUSD,
      totalUnrealizedGainsGBP: totalUnrealizedGBP,
      totalReturnUSD,
      totalReturnGBP,
      accounts: {
        tastytrade: acctTasty,
        ibkr_isa: acctIsa,
        ibkr_gia: acctGia,
        trading212: acctT212,
        total: acctTotal,
      }
    };
  }

  return {
    generatedAt: new Date(),
    timeframes: timeframesResult,
    portfolioSnapshot: {
      totalValueUSD: Math.round(totalValueUSD * 100) / 100,
      totalValueGBP: Math.round((totalValueUSD * FX_USD_TO_GBP) * 100) / 100,
      totalHoldingsCount: holdings.length,
      totalTradesCount: trades.length,
    }
  };
}

/**
 * Formats a clear, executive Markdown message for Telegram
 */
export function formatDividendGainsTelegramMessage(
  report: DividendGainsComprehensiveReport,
  options?: {
    timeframe?: DividendGainsTimeframe;
    brokerName?: string;
    isPdfRequested?: boolean;
  }
): string {
  const tfKey = options?.timeframe || 'ytd';
  const tf = report.timeframes[tfKey] || report.timeframes.ytd;
  const bKey = options?.brokerName;

  const pdfNotice = options?.isPdfRequested ? `\n\n📄 *Institutional PDF Briefing attached below!*` : '';

  // 1. Specific broker requested
  if (bKey && (bKey in tf.accounts || bKey === 'ibkr')) {
    if (bKey === 'ibkr') {
      const isa = tf.accounts.ibkr_isa;
      const gia = tf.accounts.ibkr_gia;
      const netDivsGBP = isa.netDividendsGBP + gia.netDividendsGBP;
      const netDivsUSD = isa.netDividendsUSD + gia.netDividendsUSD;
      const realGBP = isa.realizedGainsGBP + gia.realizedGainsGBP;
      const realUSD = isa.realizedGainsUSD + gia.realizedGainsUSD;
      const unrlGBP = isa.unrealizedGainsGBP + gia.unrealizedGainsGBP;
      const unrlUSD = isa.unrealizedGainsUSD + gia.unrealizedGainsUSD;
      const totGBP = isa.totalReturnGBP + gia.totalReturnGBP;
      const totUSD = isa.totalReturnUSD + gia.totalReturnUSD;

      return `🏛️ *Interactive Brokers — Dual Account Dividend & Capital Gains*
⏱️ *Timeframe:* *${tf.label}* (${tf.periodDescription})

📋 *1. Stocks & Shares ISA (U14522424)* [Tax-Free]
• Dividends Received: *${formatCurrency(isa.netDividendsGBP, 'GBP')}* (${formatCurrency(isa.netDividendsUSD, 'USD')})
• Realized Capital Gains: *${formatSignedCurrency(isa.realizedGainsGBP, 'GBP')}* (${formatSignedCurrency(isa.realizedGainsUSD, 'USD')})
• Open Unrealized P&L: *${formatSignedCurrency(isa.unrealizedGainsGBP, 'GBP')}* (${formatSignedCurrency(isa.unrealizedGainsUSD, 'USD')})
• Net Account Return: *${formatSignedCurrency(isa.totalReturnGBP, 'GBP')}* 🟢

📋 *2. General Investment Account (U15491236)* [Margin]
• Dividends Received: *${formatCurrency(gia.netDividendsGBP, 'GBP')}* (${formatCurrency(gia.netDividendsUSD, 'USD')})
• Realized Capital Gains: *${formatSignedCurrency(gia.realizedGainsGBP, 'GBP')}* (${formatSignedCurrency(gia.realizedGainsUSD, 'USD')})
• Open Unrealized P&L: *${formatSignedCurrency(gia.unrealizedGainsGBP, 'GBP')}* (${formatSignedCurrency(gia.unrealizedGainsUSD, 'USD')})
• Net Account Return: *${formatSignedCurrency(gia.totalReturnGBP, 'GBP')}* 🟢

───────────────────────
🏛️ *Interactive Brokers Subtotal:*
• Total Net Dividends: *${formatCurrency(netDivsGBP, 'GBP')}* (${formatCurrency(netDivsUSD, 'USD')})
• Total Realized Gains: *${formatSignedCurrency(realGBP, 'GBP')}* (${formatSignedCurrency(realUSD, 'USD')})
• Total Open Unrealized P&L: *${formatSignedCurrency(unrlGBP, 'GBP')}* (${formatSignedCurrency(unrlUSD, 'USD')})
• Total Combined Return: *${formatSignedCurrency(totGBP, 'GBP')}* (${formatSignedCurrency(totUSD, 'USD')})${pdfNotice}`;
    }

    const acct = (tf.accounts as any)[bKey];
    if (acct) {
      const payers = acct.topDividendPayers.length > 0
        ? acct.topDividendPayers.map((p: any) => `$${p.symbol}: ${formatCurrency(p.amount, acct.currency)}`).join(', ')
        : 'None recorded in period';
      const winners = acct.topRealizedWinners.length > 0
        ? acct.topRealizedWinners.map((w: any) => `$${w.symbol}: ${formatSignedCurrency(w.gain, acct.currency)}`).join(', ')
        : 'None in period';

      return `🏛️ *${acct.name} — Dividend & Capital Gains Report*
Account: \`${acct.accountNumber || 'Primary'}\` | ⏱️ *${tf.label}* (${tf.periodDescription})

💵 *Dividend Income:*
• Paid Dividends: *${formatCurrency(acct.paidDividends, acct.currency)}*
• Withholding Tax: *${formatCurrency(acct.withholdingTax, acct.currency)}*
• Net Cash Dividends: *${formatCurrency(acct.netDividends, acct.currency)}* (${formatCurrency(acct.netDividendsUSD, 'USD')})
• Top Payers: _${payers}_

📈 *Capital Gains & P&L:*
• Realized Gains (${acct.closedTradesCount} closed trades): *${formatSignedCurrency(acct.realizedGains, acct.currency)}*
• Open Unrealized P&L (${acct.openPositionsCount} positions): *${formatSignedCurrency(acct.unrealizedGains, acct.currency)}*
• Total Capital Gains: *${formatSignedCurrency(acct.totalCapitalGains, acct.currency)}*
• Top Realized Winners: _${winners}_

───────────────────────
💰 *Total Net Account Return:* *${formatSignedCurrency(acct.totalReturn, acct.currency)}* (${formatSignedCurrency(acct.totalReturnUSD, 'USD')})${pdfNotice}`;
    }
  }

  // 2. Multi-Timeframe Comprehensive Portfolio Overview (Default)
  const today = report.timeframes.today;
  const w7d = report.timeframes['7d'];
  const m30d = report.timeframes['30d'];
  const ytd = report.timeframes.ytd;
  const all = report.timeframes.all;

  const isa = tf.accounts.ibkr_isa;
  const gia = tf.accounts.ibkr_gia;
  const tasty = tf.accounts.tastytrade;
  const t212 = tf.accounts.trading212;

  return `📊 *Multi-Broker Dividend & Capital Gains Report*
⏱️ *Primary Focus:* *${tf.label}* (${tf.periodDescription})

🏛️ *Breakdown by Broker & Account (${tf.label}):*

• 🏛️ *IBKR Stocks & Shares ISA (U14522424):* [Tax-Free]
  Dividends: *${formatCurrency(isa.netDividendsGBP, 'GBP')}* | Realized: *${formatSignedCurrency(isa.realizedGainsGBP, 'GBP')}*
  Unrealized: *${formatSignedCurrency(isa.unrealizedGainsGBP, 'GBP')}* | Net: *${formatSignedCurrency(isa.totalReturnGBP, 'GBP')}*

• 🏛️ *IBKR Margin GIA (U15491236):*
  Dividends: *${formatCurrency(gia.netDividendsGBP, 'GBP')}* | Realized: *${formatSignedCurrency(gia.realizedGainsGBP, 'GBP')}*
  Unrealized: *${formatSignedCurrency(gia.unrealizedGainsGBP, 'GBP')}* | Net: *${formatSignedCurrency(gia.totalReturnGBP, 'GBP')}*

• 🏛️ *Tastytrade (5WT67220):*
  Dividends: *${formatCurrency(tasty.netDividends, 'USD')}* | Realized: *${formatSignedCurrency(tasty.realizedGains, 'USD')}*
  Unrealized: *${formatSignedCurrency(tasty.unrealizedGains, 'USD')}* | Net: *${formatSignedCurrency(tasty.totalReturn, 'USD')}*

• 🏛️ *Trading 212 (22885001):*
  Dividends: *${formatCurrency(t212.netDividendsGBP, 'GBP')}* | Realized: *${formatSignedCurrency(t212.realizedGainsGBP, 'GBP')}*
  Unrealized: *${formatSignedCurrency(t212.unrealizedGainsGBP, 'GBP')}* | Net: *${formatSignedCurrency(t212.totalReturnGBP, 'GBP')}*

───────────────────────
📅 *Timeframe Comparison Matrix (Combined Portfolio):*
• *Today (24h):* Div: *${formatCurrency(today.totalDividendsUSD, 'USD')}* | Realized: *${formatSignedCurrency(today.totalRealizedGainsUSD, 'USD')}* | Net: *${formatSignedCurrency(today.totalReturnUSD, 'USD')}*
• *Last 7 Days:* Div: *${formatCurrency(w7d.totalDividendsUSD, 'USD')}* | Realized: *${formatSignedCurrency(w7d.totalRealizedGainsUSD, 'USD')}* | Net: *${formatSignedCurrency(w7d.totalReturnUSD, 'USD')}*
• *Last 30 Days:* Div: *${formatCurrency(m30d.totalDividendsUSD, 'USD')}* | Realized: *${formatSignedCurrency(m30d.totalRealizedGainsUSD, 'USD')}* | Net: *${formatSignedCurrency(m30d.totalReturnUSD, 'USD')}*
• *Year to Date (YTD):* Div: *${formatCurrency(ytd.totalDividendsUSD, 'USD')}* | Realized: *${formatSignedCurrency(ytd.totalRealizedGainsUSD, 'USD')}* | Net: *${formatSignedCurrency(ytd.totalReturnUSD, 'USD')}*
• *All-Time Total:* Div: *${formatCurrency(all.totalDividendsUSD, 'USD')}* | Realized: *${formatSignedCurrency(all.totalRealizedGainsUSD, 'USD')}* | Net: *${formatSignedCurrency(all.totalReturnUSD, 'USD')}*

───────────────────────
💰 *Grand Portfolio Net Return (${tf.label}):*
• Dividends Received: *${formatCurrency(tf.totalDividendsUSD, 'USD')}* (${formatCurrency(tf.totalDividendsGBP, 'GBP')})
• Realized Capital Gains: *${formatSignedCurrency(tf.totalRealizedGainsUSD, 'USD')}* (${formatSignedCurrency(tf.totalRealizedGainsGBP, 'GBP')})
• Open Unrealized Capital Gains: *${formatSignedCurrency(tf.totalUnrealizedGainsUSD, 'USD')}* (${formatSignedCurrency(tf.totalUnrealizedGainsGBP, 'GBP')})
• 🚀 *Total Net Profit:* *${formatSignedCurrency(tf.totalReturnUSD, 'USD')}* (*${formatSignedCurrency(tf.totalReturnGBP, 'GBP')}*) 🟢${pdfNotice}

💡 _Tip: Write \`pdf\` (e.g. \`dividend pdf\`, \`gains pdf\`, \`30d pdf\`) to generate an institutional PDF briefing!_`;
}

/**
 * Generates an institutional-quality styled PDF report buffer using PDFKit
 */
export async function generateDividendGainsPdfBuffer(
  report: DividendGainsComprehensiveReport,
  options?: {
    timeframe?: DividendGainsTimeframe;
    brokerName?: string;
  }
): Promise<Buffer> {
  const tfKey = options?.timeframe || 'ytd';
  const tf = report.timeframes[tfKey] || report.timeframes.ytd;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 32, bottom: 25, left: 36, right: 36 },
      bufferPages: true,
      compress: false,
      info: {
        Title: 'Dividend & Capital Gains Institutional Audit',
        Author: 'TradeFlow AI Executive Intelligence',
        Subject: 'Institutional Portfolio Dividend & Capital Gains Briefing',
        CreationDate: report.generatedAt,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const colors = {
      primaryNavy: '#0f172a',
      accentIndigo: '#4f46e5',
      accentCyan: '#0284c7',
      emeraldGreen: '#059669',
      emeraldBg: '#ecfdf5',
      roseRed: '#dc2626',
      roseBg: '#fef2f2',
      amberGold: '#d97706',
      slateDark: '#1e293b',
      slateMuted: '#64748b',
      slateLight: '#f8fafc',
      cardBorder: '#e2e8f0',
      white: '#ffffff',
    };

    const dateFormatted = report.generatedAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = report.generatedAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // =========================================================================
    // PAGE 1: HEADER BANNER, EXECUTIVE KPIS & TIMEFRAME COMPARISON TABLE
    // =========================================================================

    // Top Header Banner Box
    doc.rect(36, 36, 540, 58).fill(colors.primaryNavy);
    doc.rect(36, 92, 540, 2).fill(colors.accentIndigo);

    // Left Title Block
    doc.fillColor(colors.white).fontSize(13).font('Helvetica-Bold')
      .text('DIVIDEND & CAPITAL GAINS EXECUTIVE AUDIT', 48, 46);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
      .text(`Multi-Broker Portfolio Analytics • Active Timeframe: ${tf.label}`, 48, 62);
    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica')
      .text(`Interactive Brokers (ISA & GIA) • Tastytrade • Trading 212`, 48, 74);

    // Right Meta Badge
    doc.rect(424, 42, 142, 44).fill('#1e293b');
    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
      .text('TRADEFLOW INTELLIGENCE', 430, 48, { width: 130, align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica')
      .text(dateFormatted, 430, 60, { width: 130, align: 'right' });
    doc.fillColor('#94a3b8').fontSize(6).font('Helvetica')
      .text(`Generated at ${timeFormatted}`, 430, 71, { width: 130, align: 'right' });

    // Executive KPI Summary Cards (4 Cards Grid)
    const kpiY = 104;
    const cardW = 127;
    const cardH = 50;
    const cardGap = 10;

    const kpis = [
      {
        title: 'NET DIVIDENDS',
        valUSD: formatCurrency(tf.totalDividendsUSD, 'USD'),
        valGBP: formatCurrency(tf.totalDividendsGBP, 'GBP'),
        badge: `${tf.accounts.total.dividendCount} Payouts`,
        color: colors.emeraldGreen,
      },
      {
        title: 'REALIZED GAINS',
        valUSD: formatSignedCurrency(tf.totalRealizedGainsUSD, 'USD'),
        valGBP: formatSignedCurrency(tf.totalRealizedGainsGBP, 'GBP'),
        badge: `${tf.accounts.total.closedTradesCount} Closed Trades`,
        color: tf.totalRealizedGainsUSD >= 0 ? colors.emeraldGreen : colors.roseRed,
      },
      {
        title: 'OPEN UNREALIZED P&L',
        valUSD: formatSignedCurrency(tf.totalUnrealizedGainsUSD, 'USD'),
        valGBP: formatSignedCurrency(tf.totalUnrealizedGainsGBP, 'GBP'),
        badge: `${tf.accounts.total.openPositionsCount} Positions`,
        color: tf.totalUnrealizedGainsUSD >= 0 ? colors.emeraldGreen : colors.roseRed,
      },
      {
        title: 'NET TOTAL RETURN',
        valUSD: formatSignedCurrency(tf.totalReturnUSD, 'USD'),
        valGBP: formatSignedCurrency(tf.totalReturnGBP, 'GBP'),
        badge: 'Div + Cap Gains',
        color: tf.totalReturnUSD >= 0 ? colors.emeraldGreen : colors.roseRed,
      },
    ];

    kpis.forEach((k, idx) => {
      const cx = 36 + idx * (cardW + cardGap);
      doc.rect(cx, kpiY, cardW, cardH).fillAndStroke(colors.slateLight, colors.cardBorder);
      doc.rect(cx, kpiY, cardW, 3).fill(k.color);

      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica-Bold')
        .text(k.title, cx + 8, kpiY + 8);
      doc.fillColor(k.color).fontSize(10).font('Helvetica-Bold')
        .text(k.valUSD, cx + 8, kpiY + 18);
      doc.fillColor(colors.slateDark).fontSize(7).font('Helvetica')
        .text(k.valGBP, cx + 8, kpiY + 31);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Oblique')
        .text(k.badge, cx + 8, kpiY + 40);
    });

    // =========================================================================
    // SECTION 1: TIMEFRAME PERFORMANCE MATRIX TABLE
    // =========================================================================
    const sec1Y = 164;
    doc.fillColor(colors.primaryNavy).fontSize(10.5).font('Helvetica-Bold')
      .text('1. MULTI-TIMEFRAME PERFORMANCE MATRIX', 36, sec1Y);
    doc.rect(36, sec1Y + 14, 540, 1).fill(colors.cardBorder);

    let tableY = sec1Y + 20;
    // Table Header
    doc.rect(36, tableY, 540, 16).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(7).font('Helvetica-Bold');
    doc.text('TIMEFRAME', 44, tableY + 4);
    doc.text('PERIOD DETAILS', 120, tableY + 4);
    doc.text('DIVIDENDS (USD / GBP)', 220, tableY + 4);
    doc.text('REALIZED GAINS', 330, tableY + 4);
    doc.text('UNREALIZED P&L', 415, tableY + 4);
    doc.text('TOTAL RETURN', 495, tableY + 4);

    tableY += 16;
    const tfList: DividendGainsTimeframe[] = ['today', '7d', '30d', 'ytd', 'all'];

    tfList.forEach((key, idx) => {
      const item = report.timeframes[key];
      const isSelected = key === tfKey;
      const rowBg = isSelected ? '#f0fdf4' : idx % 2 === 0 ? colors.white : colors.slateLight;

      doc.rect(36, tableY, 540, 20).fillAndStroke(rowBg, colors.cardBorder);
      if (isSelected) {
        doc.rect(36, tableY, 3, 20).fill(colors.emeraldGreen);
      }

      // Timeframe Name
      doc.fillColor(isSelected ? colors.emeraldGreen : colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold')
        .text(item.label, 44, tableY + 5);

      // Period Details
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text(item.periodDescription, 120, tableY + 5);

      // Dividends
      doc.fillColor(colors.emeraldGreen).fontSize(7.5).font('Helvetica-Bold')
        .text(formatCurrency(item.totalDividendsUSD, 'USD'), 220, tableY + 4);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(formatCurrency(item.totalDividendsGBP, 'GBP'), 220, tableY + 12);

      // Realized Gains
      const rColor = item.totalRealizedGainsUSD >= 0 ? colors.emeraldGreen : colors.roseRed;
      doc.fillColor(rColor).fontSize(7.5).font('Helvetica-Bold')
        .text(formatSignedCurrency(item.totalRealizedGainsUSD, 'USD'), 330, tableY + 4);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(formatSignedCurrency(item.totalRealizedGainsGBP, 'GBP'), 330, tableY + 12);

      // Unrealized P&L
      const uColor = item.totalUnrealizedGainsUSD >= 0 ? colors.emeraldGreen : colors.roseRed;
      doc.fillColor(uColor).fontSize(7.5).font('Helvetica-Bold')
        .text(formatSignedCurrency(item.totalUnrealizedGainsUSD, 'USD'), 415, tableY + 4);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(formatSignedCurrency(item.totalUnrealizedGainsGBP, 'GBP'), 415, tableY + 12);

      // Total Return
      const totColor = item.totalReturnUSD >= 0 ? colors.emeraldGreen : colors.roseRed;
      doc.fillColor(totColor).fontSize(8).font('Helvetica-Bold')
        .text(formatSignedCurrency(item.totalReturnUSD, 'USD'), 495, tableY + 4);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(formatSignedCurrency(item.totalReturnGBP, 'GBP'), 495, tableY + 12);

      tableY += 20;
    });

    // =========================================================================
    // SECTION 2: BROKER & ACCOUNT BREAKDOWN CARDS
    // =========================================================================
    let sec2Y = tableY + 16;
    doc.fillColor(colors.primaryNavy).fontSize(10.5).font('Helvetica-Bold')
      .text(`2. BROKER & ACCOUNT PERFORMANCE BREAKDOWN (${tf.label})`, 36, sec2Y);
    doc.rect(36, sec2Y + 14, 540, 1).fill(colors.cardBorder);

    let brokerY = sec2Y + 22;
    const acctList = [
      tf.accounts.ibkr_isa,
      tf.accounts.ibkr_gia,
      tf.accounts.tastytrade,
      tf.accounts.trading212,
    ];

    acctList.forEach((acct, idx) => {
      const bCardH = 46;
      const bBg = idx % 2 === 0 ? colors.white : colors.slateLight;
      doc.rect(36, brokerY, 540, bCardH).fillAndStroke(bBg, colors.cardBorder);

      // Left Accent Strip
      const retColor = acct.totalReturnUSD >= 0 ? colors.emeraldGreen : colors.roseRed;
      doc.rect(36, brokerY, 3, bCardH).fill(retColor);

      // Account Header & Badge
      const isTaxFree = acct.brokerKey === 'ibkr_isa';
      doc.fillColor(colors.primaryNavy).fontSize(8.5).font('Helvetica-Bold')
        .text(acct.name, 46, brokerY + 6);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text(`Account #${acct.accountNumber || 'Primary'} • Currency: ${acct.currency}`, 46, brokerY + 17);

      if (isTaxFree) {
        doc.roundedRect(46, brokerY + 28, 48, 12, 2).fill(colors.emeraldBg);
        doc.fillColor(colors.emeraldGreen).fontSize(6).font('Helvetica-Bold')
          .text('TAX-FREE ISA', 46, brokerY + 31, { width: 48, align: 'center' });
      } else {
        doc.roundedRect(46, brokerY + 28, 48, 12, 2).fill('#f1f5f9');
        doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold')
          .text(acct.brokerKey === 'ibkr_gia' ? 'MARGIN GIA' : acct.brokerKey === 'tastytrade' ? 'DERIVATIVES' : 'CASH INVEST', 46, brokerY + 31, { width: 48, align: 'center' });
      }

      // Column 1: Dividends
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text('DIVIDENDS', 180, brokerY + 6);
      doc.fillColor(colors.emeraldGreen).fontSize(8).font('Helvetica-Bold')
        .text(formatCurrency(acct.netDividends, acct.currency), 180, brokerY + 16);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(`${formatCurrency(acct.netDividendsUSD, 'USD')} (${acct.dividendCount} paid)`, 180, brokerY + 28);

      // Column 2: Realized Gains
      const rAcctColor = acct.realizedGains >= 0 ? colors.emeraldGreen : colors.roseRed;
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text('REALIZED GAINS', 275, brokerY + 6);
      doc.fillColor(rAcctColor).fontSize(8).font('Helvetica-Bold')
        .text(formatSignedCurrency(acct.realizedGains, acct.currency), 275, brokerY + 16);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(`${acct.closedTradesCount} closed trades`, 275, brokerY + 28);

      // Column 3: Unrealized P&L
      const uAcctColor = acct.unrealizedGains >= 0 ? colors.emeraldGreen : colors.roseRed;
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text('UNREALIZED P&L', 370, brokerY + 6);
      doc.fillColor(uAcctColor).fontSize(8).font('Helvetica-Bold')
        .text(formatSignedCurrency(acct.unrealizedGains, acct.currency), 370, brokerY + 16);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(`${acct.openPositionsCount} open positions`, 370, brokerY + 28);

      // Column 4: Net Account Total Return
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text('NET RETURN', 475, brokerY + 6);
      doc.fillColor(retColor).fontSize(9).font('Helvetica-Bold')
        .text(formatSignedCurrency(acct.totalReturn, acct.currency), 475, brokerY + 16);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text(`(${formatSignedCurrency(acct.totalReturnUSD, 'USD')})`, 475, brokerY + 28);

      brokerY += bCardH + 5;
    });

    // =========================================================================
    // SECTION 3: TOP DIVIDEND PAYERS & TOP REALIZED PERFORMERS
    // =========================================================================
    let sec3Y = brokerY + 8;
    const sec3BoxH = 92;
    const halfW = 265;

    // Left Box: Top Dividend Payers
    doc.rect(36, sec3Y, halfW, sec3BoxH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36, sec3Y, halfW, 16).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(7).font('Helvetica-Bold')
      .text('TOP DIVIDEND PAYING HOLDINGS', 44, sec3Y + 4);

    let divRowY = sec3Y + 22;
    const topDivs = tf.accounts.total.topDividendPayers;
    if (topDivs.length === 0) {
      doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica-Oblique')
        .text('No dividend payments recorded in this period.', 44, divRowY + 15);
    } else {
      topDivs.slice(0, 4).forEach((d) => {
        doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold')
          .text(`$${d.symbol}`, 44, divRowY);
        doc.fillColor(colors.emeraldGreen).fontSize(7.5).font('Helvetica-Bold')
          .text(formatCurrency(d.amount, 'USD'), 230, divRowY, { width: 60, align: 'right' });
        divRowY += 16;
      });
    }

    // Right Box: Top Realized Capital Gain Winners
    const rightX = 36 + halfW + 10;
    doc.rect(rightX, sec3Y, halfW, sec3BoxH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(rightX, sec3Y, halfW, 16).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(7).font('Helvetica-Bold')
      .text('TOP REALIZED CAPITAL GAIN TRADES', rightX + 8, sec3Y + 4);

    let winRowY = sec3Y + 22;
    const topWinners = tf.accounts.total.topRealizedWinners;
    if (topWinners.length === 0) {
      doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica-Oblique')
        .text('No profitable closed trades in this period.', rightX + 8, winRowY + 15);
    } else {
      topWinners.slice(0, 4).forEach((w) => {
        doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold')
          .text(`$${w.symbol}`, rightX + 8, winRowY);
        doc.fillColor(colors.emeraldGreen).fontSize(7.5).font('Helvetica-Bold')
          .text(formatSignedCurrency(w.gain, 'USD'), rightX + 190, winRowY, { width: 65, align: 'right' });
        winRowY += 16;
      });
    }

    // =========================================================================
    // INSTITUTIONAL FOOTER
    // =========================================================================
    const footerY = 746;
    doc.rect(36, footerY, 540, 0.75).fill(colors.cardBorder);
    doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
      .text('TradeFlow Multi-Asset Portfolio Intelligence • Confidential Executive Briefing • Dual Currency USD/GBP', 36, footerY + 6);
    doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
      .text('Page 1 of 1', 520, footerY + 6, { width: 56, align: 'right' });

    doc.end();
  });
}
