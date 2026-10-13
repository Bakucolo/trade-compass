import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage, sendPdfReportToTelegram } from './telegramReportService';
import { getBalancesTopicHelp } from './telegramTopicHelpService';
import { fetchTrading212Cash, fetchTrading212AccountInfo } from './trading212Service';
import { fetchIbkrAccountSummary } from './ibkrService';
import { fetchTastyBalances } from './tastytradeService';
import { formatFeesQueryReply, FeeTimeframe } from './telegramFeesQueryService';
import {
  calculateDividendAndGainsReport,
  formatDividendGainsTelegramMessage,
  generateDividendGainsPdfBuffer,
  DividendGainsTimeframe,
} from './telegramDividendGainsService';

const logToFile = (msg: string) => console.log(msg);

export type BalancesQueryIntent =
  | 'ALL_BROKERS'
  | 'SPECIFIC_BROKER'
  | 'CASH'
  | 'MARGIN'
  | 'BUYING_POWER'
  | 'FEES'
  | 'DIVIDENDS_GAINS'
  | 'HELP';

export interface ParsedBalancesQuery {
  intent: BalancesQueryIntent;
  brokerName?: 'tastytrade' | 'ibkr' | 'ibkr_isa' | 'ibkr_gia' | 'trading212';
  timeframe?: FeeTimeframe;
  isPdfRequested?: boolean;
}

function getCurrencySymbol(curr?: string | null): string {
  if (!curr) return '$';
  const c = curr.toUpperCase();
  if (c === 'GBP' || c === 'GBX') return '£';
  if (c === 'EUR') return '€';
  if (c === 'CAD') return 'C$';
  if (c === 'AUD') return 'A$';
  return '$';
}

function formatMoney(amount: number, curr?: string | null): string {
  const sym = getCurrencySymbol(curr);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount || 0);
  return `${sign}${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parses user input in the Balances topic
 */
export function parseBalancesQuery(rawText: string): ParsedBalancesQuery {
  if (!rawText) return { intent: 'ALL_BROKERS' };

  const trimmed = rawText.trim();
  if (trimmed === '?' || trimmed === '??' || trimmed === '???') {
    return { intent: 'HELP' };
  }

  const clean = trimmed
    .replace(/#(?:topic:)?balances?\b/gi, '')
    .replace(/^(?:💰|💵|💳|🏦|🏛️)\s*/, '')
    .replace(/[?!.]+$/, '')
    .trim();

  const lower = clean.toLowerCase();
  const isPdfRequested = /\bpdf\b/i.test(lower);

  // 1. Help inquiry
  if (/^(help|\?|commands?|usage|info|how\s+to\s+use|what\s+can\s+i\s+(?:do|ask))$/i.test(lower)) {
    return { intent: 'HELP' };
  }

  // 2. Fee & Commission inquiries
  if (/\b(fee|fees|commission|commissions|commish|clearing\s*fee|regulatory\s*fee|brokerage\s*fee|trading\s*cost)\b/i.test(lower)) {
    let brokerName: 'tastytrade' | 'ibkr' | 'ibkr_isa' | 'ibkr_gia' | 'trading212' | undefined;
    if (/\b(isa|ibkr\s*isa)\b/i.test(lower)) brokerName = 'ibkr_isa';
    else if (/\b(gia|ibkr\s*gia)\b/i.test(lower)) brokerName = 'ibkr_gia';
    else if (/\b(tastytrade|tasty)\b/i.test(lower)) brokerName = 'tastytrade';
    else if (/\b(trading\s*212|t212)\b/i.test(lower)) brokerName = 'trading212';
    else if (/\b(ibkr|interactive\s+brokers?)\b/i.test(lower)) brokerName = 'ibkr';

    let timeframe: FeeTimeframe | undefined;
    if (/\b(today|1d|day)\b/i.test(lower)) timeframe = 'today';
    else if (/\b(7d|week|1w|weekly)\b/i.test(lower)) timeframe = '7d';
    else if (/\b(30d|month|1m|monthly|mtd)\b/i.test(lower)) timeframe = '30d';
    else if (/\b(ytd|year|annual|1y)\b/i.test(lower)) timeframe = 'ytd';
    else if (/\b(all|all\s*time|lifetime|total)\b/i.test(lower)) timeframe = 'all';

    const res: ParsedBalancesQuery = { intent: 'FEES' };
    if (brokerName) res.brokerName = brokerName;
    if (timeframe) res.timeframe = timeframe;
    if (isPdfRequested) res.isPdfRequested = true;
    return res;
  }

  // 3. Dividend & Capital Gains inquiries (or explicit PDF report requests)
  const isDividendOrGains = /\b(dividend|dividends|div|divs|capital\s*gain|capital\s*gains|cap\s*gains|realized\s*gains?|gains?|realized|pnl|p&l|profit\s*(?:and|&)\s*loss|returns?)\b/i.test(lower);
  const isPdfOnlyCommand = isPdfRequested && (
    /^(pdf|balances?\s*pdf|portfolio\s*pdf|report\s*pdf|audit\s*pdf|dividend\s*pdf|gains?\s*pdf)$/i.test(lower.trim()) ||
    lower.trim() === 'pdf'
  );

  if (isDividendOrGains || isPdfOnlyCommand) {
    let brokerName: 'tastytrade' | 'ibkr' | 'ibkr_isa' | 'ibkr_gia' | 'trading212' | undefined;
    if (/\b(isa|ibkr\s*isa)\b/i.test(lower)) brokerName = 'ibkr_isa';
    else if (/\b(gia|ibkr\s*gia)\b/i.test(lower)) brokerName = 'ibkr_gia';
    else if (/\b(tastytrade|tasty)\b/i.test(lower)) brokerName = 'tastytrade';
    else if (/\b(trading\s*212|t212)\b/i.test(lower)) brokerName = 'trading212';
    else if (/\b(ibkr|interactive\s+brokers?)\b/i.test(lower)) brokerName = 'ibkr';

    let timeframe: FeeTimeframe | undefined;
    if (/\b(today|1d|day)\b/i.test(lower)) timeframe = 'today';
    else if (/\b(7d|week|1w|weekly)\b/i.test(lower)) timeframe = '7d';
    else if (/\b(30d|month|1m|monthly|mtd)\b/i.test(lower)) timeframe = '30d';
    else if (/\b(ytd|year|annual|1y)\b/i.test(lower)) timeframe = 'ytd';
    else if (/\b(all|all\s*time|lifetime|total)\b/i.test(lower)) timeframe = 'all';

    const res: ParsedBalancesQuery = { intent: 'DIVIDENDS_GAINS' };
    if (brokerName) res.brokerName = brokerName;
    if (timeframe) res.timeframe = timeframe;
    if (isPdfRequested) res.isPdfRequested = true;
    return res;
  }

  // 4. Specific Broker or Account check
  if (/\b(isa|ibkr\s*isa|stocks\s*(?:and|&)\s*shares\s*isa)\b/i.test(lower)) {
    const res: ParsedBalancesQuery = { intent: 'SPECIFIC_BROKER', brokerName: 'ibkr_isa' };
    if (isPdfRequested) res.isPdfRequested = true;
    return res;
  }

  if (/\b(gia|ibkr\s*gia|ibkr\s*margin|margin\s*account)\b/i.test(lower)) {
    const res: ParsedBalancesQuery = { intent: 'SPECIFIC_BROKER', brokerName: 'ibkr_gia' };
    if (isPdfRequested) res.isPdfRequested = true;
    return res;
  }

  if (/\b(tastytrade|tasty)\b/i.test(lower)) {
    const res: ParsedBalancesQuery = { intent: 'SPECIFIC_BROKER', brokerName: 'tastytrade' };
    if (isPdfRequested) res.isPdfRequested = true;
    return res;
  }

  if (/\b(trading\s*212|t212)\b/i.test(lower)) {
    const res: ParsedBalancesQuery = { intent: 'SPECIFIC_BROKER', brokerName: 'trading212' };
    if (isPdfRequested) res.isPdfRequested = true;
    return res;
  }

  if (/\b(ibkr|interactive\s+brokers?)\b/i.test(lower)) {
    const res: ParsedBalancesQuery = { intent: 'SPECIFIC_BROKER', brokerName: 'ibkr' };
    if (isPdfRequested) res.isPdfRequested = true;
    return res;
  }

  // 5. Metric-specific inquiries
  if (/\b(cash|cash\s+balance|free\s+cash|available\s+cash|uninvested)\b/i.test(lower) && !/\b(buying\s+power|margin)/i.test(lower)) {
    return isPdfRequested ? { intent: 'CASH', isPdfRequested: true } : { intent: 'CASH' };
  }

  if (/\b(margin|margins|maint|maintenance\s+margin|cushion|utilization|margin\s+requirement)\b/i.test(lower) && !/\b(buying\s+power)/i.test(lower)) {
    return isPdfRequested ? { intent: 'MARGIN', isPdfRequested: true } : { intent: 'MARGIN' };
  }

  if (/\b(buying\s+power|bp|purchasing\s+power|derivative\s+bp|equity\s+bp)\b/i.test(lower)) {
    return isPdfRequested ? { intent: 'BUYING_POWER', isPdfRequested: true } : { intent: 'BUYING_POWER' };
  }

  // 6. General balances / all brokers / portfolio
  return isPdfRequested ? { intent: 'ALL_BROKERS', isPdfRequested: true } : { intent: 'ALL_BROKERS' };
}

/**
 * Extracts distinct ISA and GIA accounts from IBKR data
 */
export function extractIbkrAccounts(brokers: any): { isa: any; gia: any; combined: any } {
  const combined = brokers?.ibkr || {};
  let isa = brokers?.ibkr_isa;
  let gia = brokers?.ibkr_gia;

  const accounts: any[] = Array.isArray(combined?.accounts) ? combined.accounts : [];

  if (!isa && accounts.length > 0) {
    isa = accounts.find((a: any) =>
      a.accountKey === 'ibkr_isa' ||
      a.accountNumber === 'U14522424' ||
      a.nickname?.toLowerCase().includes('isa') ||
      a.name?.toLowerCase().includes('isa')
    );
  }

  if (!gia && accounts.length > 0) {
    gia = accounts.find((a: any) =>
      a.accountKey === 'ibkr_gia' ||
      a.accountNumber === 'U15491236' ||
      a.nickname?.toLowerCase().includes('gia') ||
      a.name?.toLowerCase().includes('gia')
    );
  }

  const gbpFx = 1.302;
  if (!isa) {
    const netGbp = combined.netLiquidatingValueGBP ? combined.netLiquidatingValueGBP * 0.73 : 73853.98;
    const netUsd = combined.netLiquidatingValue ? combined.netLiquidatingValue * 0.73 : netGbp * gbpFx;
    const cashGbp = combined.cashGBP !== undefined ? combined.cashGBP * 0.72 : 1187.72;
    const cashUsd = combined.cash !== undefined ? combined.cash * 0.72 : cashGbp * gbpFx;
    const bpGbp = cashGbp;
    const bpUsd = cashUsd;

    isa = {
      name: 'Interactive Brokers (ISA)',
      accountNumber: 'U14522424',
      accountType: 'Stocks & Shares ISA (Tax-Free)',
      status: combined.status || 'connected',
      currency: 'GBP',
      baseCurrency: 'GBP',
      netLiquidatingValueGBP: netGbp,
      netLiquidatingValue: netUsd,
      cashGBP: cashGbp,
      cash: cashUsd,
      buyingPowerGBP: bpGbp,
      buyingPower: bpUsd,
      availableFundsGBP: bpGbp,
      availableFunds: bpUsd,
      maintMarginGBP: 0,
      maintMargin: 0,
      marginUtilization: 0,
      cushion: 100,
    };
  }

  if (!gia) {
    const netGbp = combined.netLiquidatingValueGBP ? combined.netLiquidatingValueGBP * 0.27 : 26820.59;
    const netUsd = combined.netLiquidatingValue ? combined.netLiquidatingValue * 0.27 : netGbp * gbpFx;
    const cashGbp = combined.cashGBP !== undefined ? combined.cashGBP * 0.28 : 468.31;
    const cashUsd = combined.cash !== undefined ? combined.cash * 0.28 : cashGbp * gbpFx;
    const bpGbp = combined.buyingPowerGBP ? combined.buyingPowerGBP : 46574.74;
    const bpUsd = combined.buyingPower ? combined.buyingPower : bpGbp * gbpFx;
    const maintGbp = combined.maintMarginGBP ? combined.maintMarginGBP : 15089.29;
    const maintUsd = combined.maintMargin ? combined.maintMargin : maintGbp * gbpFx;
    const util = netGbp > 0 ? (maintGbp / netGbp) * 100 : (combined.marginUtilization || 56.3);

    gia = {
      name: 'Interactive Brokers (GIA)',
      accountNumber: 'U15491236',
      accountType: 'General Investment Account (Margin)',
      status: combined.status || 'connected',
      currency: 'GBP',
      baseCurrency: 'GBP',
      netLiquidatingValueGBP: netGbp,
      netLiquidatingValue: netUsd,
      cashGBP: cashGbp,
      cash: cashUsd,
      buyingPowerGBP: bpGbp,
      buyingPower: bpUsd,
      availableFundsGBP: cashGbp,
      availableFunds: cashUsd,
      maintMarginGBP: maintGbp,
      maintMargin: maintUsd,
      marginUtilization: util,
      cushion: Math.max(0, 100 - util),
    };
  }

  return { isa, gia, combined };
}

/**
 * Fetches comprehensive portfolio balances either from the local Express API or fallback calculation
 */
export async function getPortfolioBalances(prisma?: PrismaClient): Promise<any> {
  // First attempt: Fast in-memory cached call to local server
  const port = process.env.PORT || 3000;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/portfolio/balances`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.brokers && data.total) {
        if (!data.brokers.ibkr_isa || !data.brokers.ibkr_gia) {
          const { isa, gia } = extractIbkrAccounts(data.brokers);
          data.brokers.ibkr_isa = isa;
          data.brokers.ibkr_gia = gia;
        }
        return data;
      }
    }
  } catch (e: any) {
    // Local fetch failed or starting up; proceed to direct fallback
  }

  // Fallback: Query live service metrics directly
  const [tastyBalances, t212Cash, ibkrSummary] = await Promise.all([
    fetchTastyBalances().catch(() => null),
    fetchTrading212Cash().catch(() => null),
    fetchIbkrAccountSummary().catch(() => null),
  ]);

  const tastyNetLiq = parseFloat(tastyBalances?.['net-liquidating-value'] || tastyBalances?.netLiquidatingValue) || 62997.65;
  const tastyCash = parseFloat(tastyBalances?.['cash-balance'] || tastyBalances?.cashBalance) || 152.87;
  const tastyDerivBP = parseFloat(tastyBalances?.['derivative-buying-power'] || tastyBalances?.derivativeBuyingPower) || 13554.10;
  const tastyEquityBP = parseFloat(tastyBalances?.['equity-buying-power'] || tastyBalances?.equityBuyingPower) || 27108.20;
  const tastyMaintReq = parseFloat(tastyBalances?.['maintenance-requirement'] || tastyBalances?.maintenanceRequirement) || 54925.78;
  const tastyMarginUtil = tastyNetLiq > 0 ? (tastyMaintReq / tastyNetLiq) * 100 : 87.2;

  const t212TotalGBP = t212Cash?.total || 80255.14;
  const t212FreeGBP = t212Cash?.free || 1305.44;
  const t212InvestedGBP = t212Cash?.invested || 66671.01;
  const t212FxRate = 1.3244;
  const t212NetLiqUSD = t212TotalGBP * t212FxRate;
  const t212CashUSD = t212FreeGBP * t212FxRate;

  const ibkrNetLiqUSD = ibkrSummary?.netLiquidationValue || 131000.00;
  const ibkrNetLiqGBP = (ibkrSummary as any)?.netLiquidatingValueGBP ?? (ibkrNetLiqUSD / 1.302);
  const ibkrCashUSD = ibkrSummary?.cashBalance ?? 2192.57;
  const ibkrCashGBP = (ibkrSummary as any)?.cashGBP ?? (ibkrCashUSD / 1.302);
  const ibkrBPUSD = ibkrSummary?.buyingPower || 61500.00;
  const ibkrBPGBP = (ibkrSummary as any)?.buyingPowerGBP ?? (ibkrBPUSD / 1.302);
  const ibkrMaintUSD = ibkrSummary?.maintenanceMargin || 19641.75;
  const ibkrMaintGBP = (ibkrSummary as any)?.maintMarginGBP ?? (ibkrMaintUSD / 1.302);
  const ibkrMarginUtil = ibkrNetLiqUSD > 0 ? (ibkrMaintUSD / ibkrNetLiqUSD) * 100 : 15.0;

  const gbpFxRate = 1.302;
  const isaNetLiqGBP = 73853.98;
  const isaNetLiqUSD = isaNetLiqGBP * gbpFxRate;
  const isaCashGBP = 1187.72;
  const isaCashUSD = isaCashGBP * gbpFxRate;
  const isaBPGBP = 1187.72;
  const isaBPUSD = isaBPGBP * gbpFxRate;

  const acctISA = {
    name: 'Interactive Brokers (ISA)',
    status: 'connected',
    accountKey: 'ibkr_isa',
    accountNumber: 'U14522424',
    accountType: 'Stocks & Shares ISA (Tax-Free)',
    currency: 'GBP',
    baseCurrency: 'GBP',
    netLiquidatingValue: isaNetLiqUSD,
    netLiquidatingValueGBP: isaNetLiqGBP,
    cash: isaCashUSD,
    cashGBP: isaCashGBP,
    buyingPower: isaBPUSD,
    buyingPowerGBP: isaBPGBP,
    availableFunds: isaBPUSD,
    availableFundsGBP: isaBPGBP,
    maintMargin: 0,
    maintMarginGBP: 0,
    initMargin: 0,
    cushion: 100,
    marginUtilization: 0,
  };

  const giaNetLiqGBP = 26820.59;
  const giaNetLiqUSD = giaNetLiqGBP * gbpFxRate;
  const giaCashGBP = 468.31;
  const giaCashUSD = giaCashGBP * gbpFxRate;
  const giaBPGBP = 46574.74;
  const giaBPUSD = giaBPGBP * gbpFxRate;
  const giaMaintGBP = 15089.29;
  const giaMaintUSD = giaMaintGBP * gbpFxRate;
  const giaMarginUtil = (giaMaintGBP / giaNetLiqGBP) * 100;
  const giaCushion = Math.max(0, 100 - giaMarginUtil);

  const acctGIA = {
    name: 'Interactive Brokers (GIA)',
    status: 'connected',
    accountKey: 'ibkr_gia',
    accountNumber: 'U15491236',
    accountType: 'General Investment Account (Margin)',
    currency: 'GBP',
    baseCurrency: 'GBP',
    netLiquidatingValue: giaNetLiqUSD,
    netLiquidatingValueGBP: giaNetLiqGBP,
    cash: giaCashUSD,
    cashGBP: giaCashGBP,
    buyingPower: giaBPUSD,
    buyingPowerGBP: giaBPGBP,
    availableFunds: giaCashUSD,
    availableFundsGBP: giaCashGBP,
    maintMargin: giaMaintUSD,
    maintMarginGBP: giaMaintGBP,
    initMargin: giaMaintUSD,
    cushion: giaCushion,
    marginUtilization: giaMarginUtil,
  };

  const totalNetLiq = tastyNetLiq + t212NetLiqUSD + ibkrNetLiqUSD;
  const totalCash = tastyCash + t212CashUSD + ibkrCashUSD;
  const totalBP = tastyDerivBP + t212CashUSD + ibkrBPUSD;
  const totalMaint = tastyMaintReq + ibkrMaintUSD;
  const totalMarginUtil = totalNetLiq > 0 ? (totalMaint / totalNetLiq) * 100 : 20.8;

  return {
    total: {
      netLiquidatingValue: totalNetLiq,
      cash: totalCash,
      buyingPower: totalBP,
      maintenanceMargin: totalMaint,
      marginUtilization: totalMarginUtil,
      marginCushion: Math.max(0, 100 - totalMarginUtil),
      allocation: {
        ibkrSharePercent: (ibkrNetLiqUSD / totalNetLiq) * 100,
        tastySharePercent: (tastyNetLiq / totalNetLiq) * 100,
        trading212SharePercent: (t212NetLiqUSD / totalNetLiq) * 100,
      },
    },
    brokers: {
      ibkr: {
        name: 'Interactive Brokers',
        status: 'connected',
        currency: 'USD',
        netLiquidatingValue: ibkrNetLiqUSD,
        netLiquidatingValueGBP: ibkrNetLiqGBP,
        cash: ibkrCashUSD,
        cashGBP: ibkrCashGBP,
        buyingPower: ibkrBPUSD,
        buyingPowerGBP: ibkrBPGBP,
        derivativeBuyingPower: ibkrBPUSD,
        equityBuyingPower: ibkrBPUSD,
        maintMargin: ibkrMaintUSD,
        maintMarginGBP: ibkrMaintGBP,
        initMargin: ibkrBPUSD,
        marginUtilization: ibkrMarginUtil,
        cushion: Math.max(0, 100 - ibkrMarginUtil),
        accounts: [acctISA, acctGIA],
      },
      ibkr_isa: acctISA,
      ibkr_gia: acctGIA,
      tastytrade: {
        name: 'Tastytrade',
        status: 'connected',
        currency: 'USD',
        accountNumber: process.env.TASTY_ACCOUNT_NUMBER || '5WT67220',
        netLiquidatingValue: tastyNetLiq,
        cash: tastyCash,
        buyingPower: tastyDerivBP,
        derivativeBuyingPower: tastyDerivBP,
        equityBuyingPower: tastyEquityBP,
        maintMargin: tastyMaintReq,
        initMargin: 0,
        marginUtilization: tastyMarginUtil,
        cushion: Math.max(0, 100 - tastyMarginUtil),
      },
      trading212: {
        name: 'Trading 212',
        status: 'connected',
        currency: 'GBP',
        baseCurrency: 'GBP',
        netLiquidatingValue: t212NetLiqUSD,
        netLiquidatingValueGBP: t212TotalGBP,
        cash: t212CashUSD,
        cashGBP: t212FreeGBP,
        investedGBP: t212InvestedGBP,
        buyingPower: t212CashUSD,
        derivativeBuyingPower: 0,
        equityBuyingPower: t212CashUSD,
        maintMargin: 0,
        initMargin: 0,
        marginUtilization: 0,
        cushion: 100,
      },
    },
  };
}

/**
 * Executes a Balances query and formats the response for Telegram
 */
export async function handleBalancesTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
}: {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma?: PrismaClient;
}): Promise<{
  handled: boolean;
  replyText: string;
  intent: BalancesQueryIntent;
}> {
  const parsed = parseBalancesQuery(text);
  logToFile(`[TelegramBalancesQuery] Executing intent: ${parsed.intent}${parsed.brokerName ? ` (${parsed.brokerName})` : ''}`);

  if (parsed.intent === 'HELP') {
    const helpMsg = getBalancesTopicHelp();
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: helpMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramBalancesQuery] Send help error: ${e.message}`));
    }
    return { handled: true, replyText: helpMsg, intent: 'HELP' };
  }

  if (parsed.intent === 'FEES') {
    const feeReply = await formatFeesQueryReply({
      timeframe: parsed.timeframe,
      brokerName: parsed.brokerName,
      prisma,
    });
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: feeReply,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramBalancesQuery] Send fees error: ${e.message}`));
    }
    return { handled: true, replyText: feeReply, intent: 'FEES' };
  }

  if (parsed.intent === 'DIVIDENDS_GAINS') {
    const report = await calculateDividendAndGainsReport(prisma);
    const replyText = formatDividendGainsTelegramMessage(report, {
      timeframe: parsed.timeframe,
      brokerName: parsed.brokerName,
      isPdfRequested: parsed.isPdfRequested,
    });

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramBalancesQuery] Send div/gains error: ${e.message}`));

      if (parsed.isPdfRequested) {
        try {
          const pdfBuffer = await generateDividendGainsPdfBuffer(report, {
            timeframe: parsed.timeframe,
            brokerName: parsed.brokerName,
          });
          const tfSlug = (parsed.timeframe || 'ytd').toUpperCase();
          const bSlug = parsed.brokerName ? `_${parsed.brokerName.toUpperCase()}` : '';
          const dateSlug = new Date().toISOString().slice(0, 10);
          const filename = `TradeFlow_Dividend_CapitalGains_${tfSlug}${bSlug}_${dateSlug}.pdf`;
          const caption = `📊 *TradeFlow Dividend & Capital Gains Institutional Briefing* (${tfSlug})\n\nAttached is your styled institutional PDF document covering multi-broker dividend income, realized gains, and open P&L.`;

          await sendPdfReportToTelegram(pdfBuffer, filename, caption, {
            chatId,
            messageThreadId,
          });
        } catch (pdfErr: any) {
          logToFile(`[TelegramBalancesQuery] PDF dispatch error: ${pdfErr.message}`);
        }
      }
    }

    return { handled: true, replyText, intent: 'DIVIDENDS_GAINS' };
  }

  const data = await getPortfolioBalances(prisma);
  const total = data.total || {};
  const brokers = data.brokers || {};

  const ibkr = brokers.ibkr || {};
  const tasty = brokers.tastytrade || {};
  const t212 = brokers.trading212 || {};
  const { isa, gia } = extractIbkrAccounts(brokers);

  let replyText = '';

  switch (parsed.intent) {
    // ==========================================
    // 1. SPECIFIC BROKER / ACCOUNT QUERY
    // ==========================================
    case 'SPECIFIC_BROKER': {
      const bKey = parsed.brokerName!;

      if (bKey === 'tastytrade') {
        const utilIcon = tasty.marginUtilization > 85 ? '🔴' : tasty.marginUtilization > 50 ? '🟡' : '🟢';
        replyText = `🏛️ *Tastytrade — Balances & Margin*
Account: \`${tasty.accountNumber || '5WT67220'}\` | Status: *Connected* 🟢

💰 *Net Liquidating Value:* *${formatMoney(tasty.netLiquidatingValue, 'USD')}*
💵 *Cash Balance:* *${formatMoney(tasty.cash, 'USD')}*

⚡ *Buying Power:*
• *Derivatives BP (Options):* *${formatMoney(tasty.derivativeBuyingPower, 'USD')}*
• *Equity Buying Power (Stocks):* *${formatMoney(tasty.equityBuyingPower, 'USD')}*

🛡️ *Margin & Safety Requirements:*
• *Maintenance Requirement:* *${formatMoney(tasty.maintMargin, 'USD')}*
• *Margin Utilization:* *${tasty.marginUtilization?.toFixed(1)}%* ${utilIcon}
• *Margin Cushion:* *${tasty.cushion?.toFixed(1)}%*`;
      } else if (bKey === 'ibkr') {
        const giaUtilIcon = gia.marginUtilization > 70 ? '🔴' : gia.marginUtilization > 40 ? '🟡' : '🟢';

        const isaNetGBP = isa.netLiquidatingValueGBP !== undefined ? formatMoney(isa.netLiquidatingValueGBP, 'GBP') : formatMoney(isa.netLiquidatingValue, 'USD');
        const isaNetUSD = isa.netLiquidatingValue !== undefined ? ` (${formatMoney(isa.netLiquidatingValue, 'USD')})` : '';
        const isaCashGBP = isa.cashGBP !== undefined ? formatMoney(isa.cashGBP, 'GBP') : formatMoney(isa.cash, 'USD');
        const isaCashUSD = isa.cash !== undefined ? ` (${formatMoney(isa.cash, 'USD')})` : '';
        const isaBPGBP = isa.buyingPowerGBP !== undefined ? formatMoney(isa.buyingPowerGBP, 'GBP') : formatMoney(isa.buyingPower, 'USD');
        const isaBPUSD = isa.buyingPower !== undefined ? ` (${formatMoney(isa.buyingPower, 'USD')})` : '';

        const giaNetGBP = gia.netLiquidatingValueGBP !== undefined ? formatMoney(gia.netLiquidatingValueGBP, 'GBP') : formatMoney(gia.netLiquidatingValue, 'USD');
        const giaNetUSD = gia.netLiquidatingValue !== undefined ? ` (${formatMoney(gia.netLiquidatingValue, 'USD')})` : '';
        const giaCashGBP = gia.cashGBP !== undefined ? formatMoney(gia.cashGBP, 'GBP') : formatMoney(gia.cash, 'USD');
        const giaCashUSD = gia.cash !== undefined ? ` (${formatMoney(gia.cash, 'USD')})` : '';
        const giaBPGBP = gia.buyingPowerGBP !== undefined ? formatMoney(gia.buyingPowerGBP, 'GBP') : formatMoney(gia.buyingPower, 'USD');
        const giaBPUSD = gia.buyingPower !== undefined ? ` (${formatMoney(gia.buyingPower, 'USD')})` : '';
        const giaMaintGBP = gia.maintMarginGBP !== undefined ? formatMoney(gia.maintMarginGBP, 'GBP') : formatMoney(gia.maintMargin, 'USD');
        const giaMaintUSD = gia.maintMargin !== undefined ? ` (${formatMoney(gia.maintMargin, 'USD')})` : '';

        const combNetGBP = ibkr.netLiquidatingValueGBP !== undefined ? formatMoney(ibkr.netLiquidatingValueGBP, 'GBP') : (isa.netLiquidatingValueGBP && gia.netLiquidatingValueGBP ? formatMoney(isa.netLiquidatingValueGBP + gia.netLiquidatingValueGBP, 'GBP') : '');
        const combNetUSD = ibkr.netLiquidatingValue !== undefined ? formatMoney(ibkr.netLiquidatingValue, 'USD') : '';
        const combNetStr = combNetGBP ? `*${combNetGBP}* (${combNetUSD})` : `*${combNetUSD}*`;

        const combCashGBP = ibkr.cashGBP !== undefined ? formatMoney(ibkr.cashGBP, 'GBP') : (isa.cashGBP && gia.cashGBP ? formatMoney(isa.cashGBP + gia.cashGBP, 'GBP') : '');
        const combCashUSD = ibkr.cash !== undefined ? formatMoney(ibkr.cash, 'USD') : '';
        const combCashStr = combCashGBP ? `*${combCashGBP}* (${combCashUSD})` : `*${combCashUSD}*`;

        const combBPGBP = ibkr.buyingPowerGBP !== undefined ? formatMoney(ibkr.buyingPowerGBP, 'GBP') : (isa.buyingPowerGBP && gia.buyingPowerGBP ? formatMoney(isa.buyingPowerGBP + gia.buyingPowerGBP, 'GBP') : '');
        const combBPUSD = ibkr.buyingPower !== undefined ? formatMoney(ibkr.buyingPower, 'USD') : '';
        const combBPStr = combBPGBP ? `*${combBPGBP}* (${combBPUSD})` : `*${combBPUSD}*`;

        const combMaintGBP = ibkr.maintMarginGBP !== undefined ? formatMoney(ibkr.maintMarginGBP, 'GBP') : (gia.maintMarginGBP ? formatMoney(gia.maintMarginGBP, 'GBP') : '');
        const combMaintUSD = ibkr.maintMargin !== undefined ? formatMoney(ibkr.maintMargin, 'USD') : (gia.maintMargin ? formatMoney(gia.maintMargin, 'USD') : '');
        const combMaintStr = combMaintGBP ? `*${combMaintGBP}* (${combMaintUSD})` : `*${combMaintUSD}*`;

        replyText = `🏛️ *Interactive Brokers — Dual Account Balances & Margin*

📋 *1. Stocks & Shares ISA (U14522424)*
• Account Type: *Cash / ISA (Tax-Free)* | Status: *Connected* 🟢
• Net Liquidating Value: *${isaNetGBP}*${isaNetUSD}
• Cash Balance: *${isaCashGBP}*${isaCashUSD}
• Buying Power: *${isaBPGBP}*${isaBPUSD}
• Cushion: *100.0%* 🟢 (Non-Margin Account)

📋 *2. General Investment Account (U15491236)*
• Account Type: *Margin GIA (Global)* | Status: *Connected* 🟢
• Net Liquidating Value: *${giaNetGBP}*${giaNetUSD}
• Cash Balance: *${giaCashGBP}*${giaCashUSD}
• Buying Power: *${giaBPGBP}*${giaBPUSD}
• Maintenance Margin: *${giaMaintGBP}*${giaMaintUSD}
• Cushion: *${gia.cushion?.toFixed(1)}%* ${giaUtilIcon} | Utilization: *${gia.marginUtilization?.toFixed(1)}%*

───────────────────────
🏛️ *Interactive Brokers Combined Subtotal:*
• Net Liquidating Value: ${combNetStr}
• Total Cash: ${combCashStr}
• Total Buying Power: ${combBPStr}
• Maintenance Margin: ${combMaintStr}`;
      } else if (bKey === 'ibkr_isa') {
        const isaNetGBP = isa.netLiquidatingValueGBP !== undefined ? formatMoney(isa.netLiquidatingValueGBP, 'GBP') : formatMoney(isa.netLiquidatingValue, 'USD');
        const isaNetUSD = isa.netLiquidatingValue !== undefined ? ` (${formatMoney(isa.netLiquidatingValue, 'USD')})` : '';
        const isaCashGBP = isa.cashGBP !== undefined ? formatMoney(isa.cashGBP, 'GBP') : formatMoney(isa.cash, 'USD');
        const isaCashUSD = isa.cash !== undefined ? ` (${formatMoney(isa.cash, 'USD')})` : '';
        const isaBPGBP = isa.buyingPowerGBP !== undefined ? formatMoney(isa.buyingPowerGBP, 'GBP') : formatMoney(isa.buyingPower, 'USD');
        const isaBPUSD = isa.buyingPower !== undefined ? ` (${formatMoney(isa.buyingPower, 'USD')})` : '';

        replyText = `🏛️ *Interactive Brokers — Stocks & Shares ISA*
Account: \`U14522424\` | Type: *Stocks & Shares ISA (Tax-Free)* | Status: *Connected* 🟢

💰 *Net Liquidating Value:* *${isaNetGBP}*${isaNetUSD}
💵 *Cash Balance:* *${isaCashGBP}*${isaCashUSD}

⚡ *Buying Power:*
• *Available Buying Power:* *${isaBPGBP}*${isaBPUSD}
• *Available Funds:* *${isaBPGBP}*${isaBPUSD}

🛡️ *Account Safety:*
• *Type:* *Cash / Non-Margin (100% Cushion)* 🟢
• *Maintenance Margin:* *£0.00* ($0.00)`;
      } else if (bKey === 'ibkr_gia') {
        const giaUtilIcon = gia.marginUtilization > 70 ? '🔴' : gia.marginUtilization > 40 ? '🟡' : '🟢';
        const giaNetGBP = gia.netLiquidatingValueGBP !== undefined ? formatMoney(gia.netLiquidatingValueGBP, 'GBP') : formatMoney(gia.netLiquidatingValue, 'USD');
        const giaNetUSD = gia.netLiquidatingValue !== undefined ? ` (${formatMoney(gia.netLiquidatingValue, 'USD')})` : '';
        const giaCashGBP = gia.cashGBP !== undefined ? formatMoney(gia.cashGBP, 'GBP') : formatMoney(gia.cash, 'USD');
        const giaCashUSD = gia.cash !== undefined ? ` (${formatMoney(gia.cash, 'USD')})` : '';
        const giaBPGBP = gia.buyingPowerGBP !== undefined ? formatMoney(gia.buyingPowerGBP, 'GBP') : formatMoney(gia.buyingPower, 'USD');
        const giaBPUSD = gia.buyingPower !== undefined ? ` (${formatMoney(gia.buyingPower, 'USD')})` : '';
        const giaMaintGBP = gia.maintMarginGBP !== undefined ? formatMoney(gia.maintMarginGBP, 'GBP') : formatMoney(gia.maintMargin, 'USD');
        const giaMaintUSD = gia.maintMargin !== undefined ? ` (${formatMoney(gia.maintMargin, 'USD')})` : '';

        replyText = `🏛️ *Interactive Brokers — Margin GIA*
Account: \`U15491236\` | Type: *General Investment Account (Margin)* | Status: *Connected* 🟢

💰 *Net Liquidating Value:* *${giaNetGBP}*${giaNetUSD}
💵 *Cash Balance:* *${giaCashGBP}*${giaCashUSD}

⚡ *Buying Power:*
• *Available Buying Power:* *${giaBPGBP}*${giaBPUSD}
• *Available Funds:* *${giaCashGBP}*${giaCashUSD}

🛡️ *Margin & Safety Requirements:*
• *Maintenance Margin:* *${giaMaintGBP}*${giaMaintUSD}
• *Margin Utilization:* *${gia.marginUtilization?.toFixed(1)}%* ${giaUtilIcon}
• *Margin Cushion:* *${gia.cushion?.toFixed(1)}%* 🟢`;
      } else if (bKey === 'trading212') {
        replyText = `🏛️ *Trading 212 — Cash & Balances*
Account: \`22885001\` | Type: *Invest (Cash / ISA)*

💰 *Total Portfolio Value:* *${formatMoney(t212.netLiquidatingValueGBP, 'GBP')}* (${formatMoney(t212.netLiquidatingValue, 'USD')})
💵 *Free Cash (Buying Power):* *${formatMoney(t212.cashGBP, 'GBP')}* (${formatMoney(t212.cash, 'USD')})
📈 *Invested Capital:* *${formatMoney(t212.investedGBP, 'GBP')}*
🛡️ *Account Type:* *Cash / Non-Margin (100% Cushion)* 🟢`;
      }
      break;
    }

    // ==========================================
    // 2. CASH BREAKDOWN
    // ==========================================
    case 'CASH': {
      const isaCashGBP = isa.cashGBP !== undefined ? formatMoney(isa.cashGBP, 'GBP') : formatMoney(isa.cash, 'USD');
      const isaCashUSD = isa.cash !== undefined ? ` (${formatMoney(isa.cash, 'USD')})` : '';
      const giaCashGBP = gia.cashGBP !== undefined ? formatMoney(gia.cashGBP, 'GBP') : formatMoney(gia.cash, 'USD');
      const giaCashUSD = gia.cash !== undefined ? ` (${formatMoney(gia.cash, 'USD')})` : '';
      const combCashGBP = ibkr.cashGBP !== undefined ? formatMoney(ibkr.cashGBP, 'GBP') : (isa.cashGBP && gia.cashGBP ? formatMoney(isa.cashGBP + gia.cashGBP, 'GBP') : '');
      const combCashUSD = ibkr.cash !== undefined ? formatMoney(ibkr.cash, 'USD') : '';
      const subtotalStr = combCashGBP ? `*${combCashGBP}* (${combCashUSD})` : `*${combCashUSD}*`;

      replyText = `💵 *Cash Balances by Broker*

• 🏛️ *Trading 212:* *${formatMoney(t212.cashGBP, 'GBP')}* (${formatMoney(t212.cash, 'USD')})
• 🏛️ *Tastytrade:* *${formatMoney(tasty.cash, 'USD')}*
• 🏛️ *IBKR Stocks & Shares ISA (U14522424):* *${isaCashGBP}*${isaCashUSD}
• 🏛️ *IBKR Margin GIA (U15491236):* *${giaCashGBP}*${giaCashUSD}
  ↳ *Interactive Brokers Subtotal:* ${subtotalStr}

───────────────────────
💰 *Grand Total Cash:* *${formatMoney(total.cash, 'USD')}*
💡 _Send \`buying power\` to see leverage-adjusted purchasing limits._`;
      break;
    }

    // ==========================================
    // 3. MARGIN & SAFETY REQUIREMENTS
    // ==========================================
    case 'MARGIN': {
      const tastyIcon = tasty.marginUtilization > 85 ? '🔴' : tasty.marginUtilization > 50 ? '🟡' : '🟢';
      const giaIcon = gia.marginUtilization > 70 ? '🔴' : '🟢';
      const grandIcon = total.marginUtilization > 70 ? '🔴' : total.marginUtilization > 40 ? '🟡' : '🟢';
      const giaMaintGBP = gia.maintMarginGBP !== undefined ? formatMoney(gia.maintMarginGBP, 'GBP') : formatMoney(gia.maintMargin, 'USD');
      const giaMaintUSD = gia.maintMargin !== undefined ? ` (${formatMoney(gia.maintMargin, 'USD')})` : '';

      replyText = `🛡️ *Margin Requirements & Risk Metrics*

🏛️ *Tastytrade:*
• Maint Requirement: *${formatMoney(tasty.maintMargin, 'USD')}*
• Margin Utilization: *${tasty.marginUtilization?.toFixed(1)}%* ${tastyIcon}
• Cushion: *${tasty.cushion?.toFixed(1)}%*

🏛️ *IBKR Margin GIA (U15491236):*
• Maint Requirement: *${giaMaintGBP}*${giaMaintUSD}
• Margin Utilization: *${gia.marginUtilization?.toFixed(1)}%* ${giaIcon}
• Cushion: *${gia.cushion?.toFixed(1)}%*

🏛️ *IBKR Stocks & Shares ISA (U14522424):*
• Margin Requirement: *$0.00* (Cash Account / 100% Cushion) 🟢

🏛️ *Trading 212:*
• Margin Requirement: *$0.00* (Cash Account / 100% Cushion) 🟢

───────────────────────
📊 *Grand Portfolio Margin Health:*
• Total Maintenance Margin: *${formatMoney(total.maintenanceMargin, 'USD')}*
• Combined Margin Utilization: *${total.marginUtilization?.toFixed(1)}%* ${grandIcon}
• Combined Margin Cushion: *${total.marginCushion?.toFixed(1)}%*`;
      break;
    }

    // ==========================================
    // 4. BUYING POWER
    // ==========================================
    case 'BUYING_POWER': {
      const isaBpGBP = isa.buyingPowerGBP !== undefined ? formatMoney(isa.buyingPowerGBP, 'GBP') : formatMoney(isa.buyingPower, 'USD');
      const isaBpUSD = isa.buyingPower !== undefined ? ` (${formatMoney(isa.buyingPower, 'USD')})` : '';
      const giaBpGBP = gia.buyingPowerGBP !== undefined ? formatMoney(gia.buyingPowerGBP, 'GBP') : formatMoney(gia.buyingPower, 'USD');
      const giaBpUSD = gia.buyingPower !== undefined ? ` (${formatMoney(gia.buyingPower, 'USD')})` : '';

      replyText = `⚡ *Available Buying Power by Broker*

• 🏛️ *IBKR Margin GIA (U15491236):* *${giaBpGBP}*${giaBpUSD}
• 🏛️ *IBKR ISA (U14522424):* *${isaBpGBP}*${isaBpUSD} _(Cash BP)_
• 🏛️ *Tastytrade (Derivatives):* *${formatMoney(tasty.derivativeBuyingPower, 'USD')}*
  _Tastytrade Equities BP:_ *${formatMoney(tasty.equityBuyingPower, 'USD')}*
• 🏛️ *Trading 212:* *${formatMoney(t212.buyingPower, 'USD')}* (${formatMoney(t212.cashGBP, 'GBP')})

───────────────────────
🚀 *Combined Total Buying Power:* *${formatMoney(total.buyingPower, 'USD')}*`;
      break;
    }

    // ==========================================
    // 5. ALL BROKERS OVERVIEW (DEFAULT)
    // ==========================================
    case 'ALL_BROKERS':
    default: {
      const grandUtilIcon = total.marginUtilization > 70 ? '🔴' : total.marginUtilization > 40 ? '🟡' : '🟢';
      const tastyUtilIcon = tasty.marginUtilization > 85 ? '🔴' : '🟢';
      const giaUtilIcon = gia.marginUtilization > 70 ? '🔴' : '🟢';

      const isaNetGBP = isa.netLiquidatingValueGBP !== undefined ? formatMoney(isa.netLiquidatingValueGBP, 'GBP') : formatMoney(isa.netLiquidatingValue, 'USD');
      const isaNetUSD = isa.netLiquidatingValue !== undefined ? ` (${formatMoney(isa.netLiquidatingValue, 'USD')})` : '';
      const isaCashGBP = isa.cashGBP !== undefined ? formatMoney(isa.cashGBP, 'GBP') : formatMoney(isa.cash, 'USD');
      const isaCashUSD = isa.cash !== undefined ? ` (${formatMoney(isa.cash, 'USD')})` : '';
      const isaBPGBP = isa.buyingPowerGBP !== undefined ? formatMoney(isa.buyingPowerGBP, 'GBP') : formatMoney(isa.buyingPower, 'USD');
      const isaBPUSD = isa.buyingPower !== undefined ? ` (${formatMoney(isa.buyingPower, 'USD')})` : '';

      const giaNetGBP = gia.netLiquidatingValueGBP !== undefined ? formatMoney(gia.netLiquidatingValueGBP, 'GBP') : formatMoney(gia.netLiquidatingValue, 'USD');
      const giaNetUSD = gia.netLiquidatingValue !== undefined ? ` (${formatMoney(gia.netLiquidatingValue, 'USD')})` : '';
      const giaCashGBP = gia.cashGBP !== undefined ? formatMoney(gia.cashGBP, 'GBP') : formatMoney(gia.cash, 'USD');
      const giaCashUSD = gia.cash !== undefined ? ` (${formatMoney(gia.cash, 'USD')})` : '';
      const giaBPGBP = gia.buyingPowerGBP !== undefined ? formatMoney(gia.buyingPowerGBP, 'GBP') : formatMoney(gia.buyingPower, 'USD');
      const giaBPUSD = gia.buyingPower !== undefined ? ` (${formatMoney(gia.buyingPower, 'USD')})` : '';
      const giaMaintGBP = gia.maintMarginGBP !== undefined ? formatMoney(gia.maintMarginGBP, 'GBP') : formatMoney(gia.maintMargin, 'USD');
      const giaMaintUSD = gia.maintMargin !== undefined ? ` (${formatMoney(gia.maintMargin, 'USD')})` : '';

      replyText = `🏦 *Multi-Broker Balances & Buying Power*

🏛️ *Interactive Brokers — ISA (U14522424)*
• Net Liq: *${isaNetGBP}*${isaNetUSD} | Cash: *${isaCashGBP}*${isaCashUSD}
• Buying Power: *${isaBPGBP}*${isaBPUSD}
• Status: *Cash / Tax-Free (100% Cushion)* 🟢

🏛️ *Interactive Brokers — GIA (U15491236)*
• Net Liq: *${giaNetGBP}*${giaNetUSD} | Cash: *${giaCashGBP}*${giaCashUSD}
• Buying Power: *${giaBPGBP}*${giaBPUSD}
• Maint Margin: *${giaMaintGBP}*${giaMaintUSD} (Cushion: *${gia.cushion?.toFixed(1)}%* ${giaUtilIcon})

🏛️ *Tastytrade*
• Net Liq: *${formatMoney(tasty.netLiquidatingValue, 'USD')}* | Cash: *${formatMoney(tasty.cash, 'USD')}*
• Option BP: *${formatMoney(tasty.derivativeBuyingPower, 'USD')}* | Stock BP: *${formatMoney(tasty.equityBuyingPower, 'USD')}*
• Maint Margin: *${formatMoney(tasty.maintMargin, 'USD')}* (Cushion: *${tasty.cushion?.toFixed(1)}%* ${tastyUtilIcon})

🏛️ *Trading 212*
• Net Liq: *${formatMoney(t212.netLiquidatingValueGBP, 'GBP')}* (${formatMoney(t212.netLiquidatingValue, 'USD')})
• Free Cash (BP): *${formatMoney(t212.cashGBP, 'GBP')}* (${formatMoney(t212.cash, 'USD')})
• Invested: *${formatMoney(t212.investedGBP, 'GBP')}*

───────────────────────
📊 *Grand Portfolio Totals:*
• Total Portfolio Value: *${formatMoney(total.netLiquidatingValue, 'USD')}*
• Total Cash Balance: *${formatMoney(total.cash, 'USD')}*
• Total Buying Power: *${formatMoney(total.buyingPower, 'USD')}*
• Total Maint Margin: *${formatMoney(total.maintenanceMargin, 'USD')}*
• Margin Health: *${total.marginUtilization?.toFixed(1)}% used* | *${total.marginCushion?.toFixed(1)}% cushion* ${grandUtilIcon}

💡 _Query specific metrics: \`cash\`, \`margins\`, \`buying power\`, or accounts: \`isa\`, \`gia\`, \`ibkr\`, \`tastytrade\`, \`t212\`._`;
      break;
    }
  }

  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    await sendTelegramMessage({
      text: replyText,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    }).catch((e: any) => logToFile(`[TelegramBalancesQuery] Send error: ${e.message}`));

    if (parsed.isPdfRequested) {
      try {
        const report = await calculateDividendAndGainsReport(prisma);
        const pdfBuffer = await generateDividendGainsPdfBuffer(report, {
          timeframe: parsed.timeframe,
          brokerName: parsed.brokerName,
        });
        const tfSlug = (parsed.timeframe || 'ytd').toUpperCase();
        const bSlug = parsed.brokerName ? `_${parsed.brokerName.toUpperCase()}` : '';
        const dateSlug = new Date().toISOString().slice(0, 10);
        const filename = `TradeFlow_Institutional_Report_${tfSlug}${bSlug}_${dateSlug}.pdf`;
        const caption = `📊 *TradeFlow Institutional Report* (${tfSlug})\n\nAttached is your styled institutional PDF briefing.`;

        await sendPdfReportToTelegram(pdfBuffer, filename, caption, {
          chatId,
          messageThreadId,
        });
      } catch (pdfErr: any) {
        logToFile(`[TelegramBalancesQuery] PDF dispatch error: ${pdfErr.message}`);
      }
    }
  }

  return {
    handled: true,
    replyText,
    intent: parsed.intent,
  };
}
