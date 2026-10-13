import { PrismaClient } from '@prisma/client';

export type FeeTimeframe = 'today' | '7d' | '30d' | 'ytd' | 'all';

export interface AccountFeeMetrics {
  name: string;
  accountNumber?: string;
  commission: number;
  clearingFees: number;
  totalFees: number;
  totalFeesGBP: number;
  tradesCount: number;
  currency: 'USD' | 'GBP';
}

export interface TimeframeFeeSummary {
  timeframe: FeeTimeframe;
  label: string;
  totalUSD: number;
  totalGBP: number;
  tradesCount: number;
  accounts: {
    tastytrade: AccountFeeMetrics;
    ibkr_isa: AccountFeeMetrics;
    ibkr_gia: AccountFeeMetrics;
    trading212: AccountFeeMetrics;
  };
}

const FX_GBP_TO_USD = 1.302;
const FX_USD_TO_GBP = 1 / FX_GBP_TO_USD;

function formatMoney(amount: number, currency: 'USD' | 'GBP' = 'USD'): string {
  const sym = currency === 'GBP' ? '£' : '$';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount || 0);
  return `${sign}${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calculates commission and regulatory clearing fees for a single trade record
 */
export function getTradeFee(t: any): { commission: number; clearingFees: number; total: number } {
  let commission = Number(t.commission || 0);
  let clearingFees = Number(t.clearingFees || 0);

  // If commission is unrecorded (e.g. from holdings backfill), compute standard broker fee
  if (commission === 0 && clearingFees === 0) {
    if (t.broker === 'Tastytrade') {
      if (t.assetType === 'OPTION') {
        commission = Math.min(10.0, 1.00 * (t.quantity || 1));
      } else {
        commission = 0.0;
      }
      clearingFees = 0.14 * (t.quantity || 1);
    } else if (t.broker === 'Interactive Brokers') {
      if (t.assetType === 'OPTION') {
        commission = Math.max(1.00, 0.65 * (t.quantity || 1));
        clearingFees = 0.03 * (t.quantity || 1);
      } else {
        const qty = t.quantity || 1;
        const notional = (t.totalValue || (qty * (t.price || 0))) || 100;
        commission = Math.max(1.00, Math.min(qty * 0.005, notional * 0.01));
        clearingFees = Math.min(0.50, Math.max(0.01, qty * 0.0005));
      }
    } else if (t.broker === 'Trading 212') {
      commission = 0.0;
      clearingFees = 0.0;
    }
  }

  const total = Math.round((commission + clearingFees) * 100) / 100;
  return { commission, clearingFees, total };
}

/**
 * Computes fees and commissions for all brokers and accounts across 5 standard timeframes
 */
export async function getFeesAcrossTimeframes(prisma?: PrismaClient): Promise<{
  today: TimeframeFeeSummary;
  '7d': TimeframeFeeSummary;
  '30d': TimeframeFeeSummary;
  ytd: TimeframeFeeSummary;
  all: TimeframeFeeSummary;
}> {
  const client = prisma || new PrismaClient();
  let trades: any[] = [];

  try {
    trades = await client.tradeRecord.findMany({
      orderBy: { executedAt: 'desc' }
    });
  } catch (err: any) {
    console.warn('[TelegramFeesQueryService] Failed to query tradeRecord from database, using fallback:', err?.message);
  }

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYTD = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0);

  const timeframeDefs: { id: FeeTimeframe; label: string; cutoff: number }[] = [
    { id: 'today', label: 'Today (24h)', cutoff: startOfToday.getTime() },
    { id: '7d', label: 'Last 7 Days', cutoff: now - 7 * 24 * 60 * 60 * 1000 },
    { id: '30d', label: 'Last 30 Days', cutoff: now - 30 * 24 * 60 * 60 * 1000 },
    { id: 'ytd', label: 'Year to Date (YTD)', cutoff: startOfYTD.getTime() },
    { id: 'all', label: 'All-Time Total', cutoff: 0 }
  ];

  const result: any = {};

  for (const tf of timeframeDefs) {
    const acctTasty: AccountFeeMetrics = {
      name: 'Tastytrade',
      accountNumber: '5WT67220',
      commission: 0,
      clearingFees: 0,
      totalFees: 0,
      totalFeesGBP: 0,
      tradesCount: 0,
      currency: 'USD'
    };

    const acctIsa: AccountFeeMetrics = {
      name: 'Interactive Brokers (ISA)',
      accountNumber: 'U14522424',
      commission: 0,
      clearingFees: 0,
      totalFees: 0,
      totalFeesGBP: 0,
      tradesCount: 0,
      currency: 'GBP'
    };

    const acctGia: AccountFeeMetrics = {
      name: 'Interactive Brokers (GIA)',
      accountNumber: 'U15491236',
      commission: 0,
      clearingFees: 0,
      totalFees: 0,
      totalFeesGBP: 0,
      tradesCount: 0,
      currency: 'GBP'
    };

    const acctT212: AccountFeeMetrics = {
      name: 'Trading 212',
      accountNumber: '22885001',
      commission: 0,
      clearingFees: 0,
      totalFees: 0,
      totalFeesGBP: 0,
      tradesCount: 0,
      currency: 'GBP'
    };

    let totalUSD = 0;
    let totalGBP = 0;
    let tfTradesCount = 0;

    for (const t of trades) {
      const tradeTime = new Date(t.executedAt).getTime();
      if (tradeTime < tf.cutoff) continue;

      tfTradesCount++;
      const { commission, clearingFees, total } = getTradeFee(t);

      if (t.broker === 'Tastytrade') {
        acctTasty.commission += commission;
        acctTasty.clearingFees += clearingFees;
        acctTasty.totalFees += total;
        acctTasty.totalFeesGBP += total * FX_USD_TO_GBP;
        acctTasty.tradesCount++;
        totalUSD += total;
        totalGBP += total * FX_USD_TO_GBP;
      } else if (t.broker === 'Trading 212') {
        acctT212.commission += commission;
        acctT212.clearingFees += clearingFees;
        acctT212.totalFees += total;
        acctT212.totalFeesGBP += total * FX_USD_TO_GBP;
        acctT212.tradesCount++;
        totalUSD += total;
        totalGBP += total * FX_USD_TO_GBP;
      } else {
        // Interactive Brokers (classify ISA U14522424 vs GIA U15491236)
        const isIsa = t.brokerTradeId?.includes('U14522424') ||
          (t.assetType !== 'OPTION' && !t.brokerTradeId?.includes('U15491236') && (t.side === 'BUY'));

        if (isIsa) {
          acctIsa.commission += commission;
          acctIsa.clearingFees += clearingFees;
          acctIsa.totalFees += total;
          acctIsa.totalFeesGBP += total * FX_USD_TO_GBP;
          acctIsa.tradesCount++;
        } else {
          acctGia.commission += commission;
          acctGia.clearingFees += clearingFees;
          acctGia.totalFees += total;
          acctGia.totalFeesGBP += total * FX_USD_TO_GBP;
          acctGia.tradesCount++;
        }
        totalUSD += total;
        totalGBP += total * FX_USD_TO_GBP;
      }
    }

    // Round all monetary values to 2 decimal places
    const roundAcct = (a: AccountFeeMetrics) => {
      a.commission = Math.round(a.commission * 100) / 100;
      a.clearingFees = Math.round(a.clearingFees * 100) / 100;
      a.totalFees = Math.round(a.totalFees * 100) / 100;
      a.totalFeesGBP = Math.round(a.totalFeesGBP * 100) / 100;
    };
    roundAcct(acctTasty);
    roundAcct(acctIsa);
    roundAcct(acctGia);
    roundAcct(acctT212);

    result[tf.id] = {
      timeframe: tf.id,
      label: tf.label,
      totalUSD: Math.round(totalUSD * 100) / 100,
      totalGBP: Math.round(totalGBP * 100) / 100,
      tradesCount: tfTradesCount,
      accounts: {
        tastytrade: acctTasty,
        ibkr_isa: acctIsa,
        ibkr_gia: acctGia,
        trading212: acctT212
      }
    };
  }

  return result as {
    today: TimeframeFeeSummary;
    '7d': TimeframeFeeSummary;
    '30d': TimeframeFeeSummary;
    ytd: TimeframeFeeSummary;
    all: TimeframeFeeSummary;
  };
}

/**
 * Formats Telegram markdown reply for fees & commissions queries
 */
export async function formatFeesQueryReply({
  timeframe,
  brokerName,
  prisma
}: {
  timeframe?: FeeTimeframe;
  brokerName?: 'tastytrade' | 'ibkr' | 'ibkr_isa' | 'ibkr_gia' | 'trading212';
  prisma?: PrismaClient;
}): Promise<string> {
  const feeData = await getFeesAcrossTimeframes(prisma);

  // -------------------------------------------------------------
  // Mode A: Specific Broker/Account Focus across all timeframes
  // -------------------------------------------------------------
  if (brokerName) {
    if (brokerName === 'ibkr') {
      const todayTotal = feeData.today.accounts.ibkr_isa.totalFees + feeData.today.accounts.ibkr_gia.totalFees;
      const todayGBP = feeData.today.accounts.ibkr_isa.totalFeesGBP + feeData.today.accounts.ibkr_gia.totalFeesGBP;
      const d7Total = feeData['7d'].accounts.ibkr_isa.totalFees + feeData['7d'].accounts.ibkr_gia.totalFees;
      const d7GBP = feeData['7d'].accounts.ibkr_isa.totalFeesGBP + feeData['7d'].accounts.ibkr_gia.totalFeesGBP;
      const d30Total = feeData['30d'].accounts.ibkr_isa.totalFees + feeData['30d'].accounts.ibkr_gia.totalFees;
      const d30GBP = feeData['30d'].accounts.ibkr_isa.totalFeesGBP + feeData['30d'].accounts.ibkr_gia.totalFeesGBP;
      const ytdTotal = feeData.ytd.accounts.ibkr_isa.totalFees + feeData.ytd.accounts.ibkr_gia.totalFees;
      const ytdGBP = feeData.ytd.accounts.ibkr_isa.totalFeesGBP + feeData.ytd.accounts.ibkr_gia.totalFeesGBP;
      const allTotal = feeData.all.accounts.ibkr_isa.totalFees + feeData.all.accounts.ibkr_gia.totalFees;
      const allGBP = feeData.all.accounts.ibkr_isa.totalFeesGBP + feeData.all.accounts.ibkr_gia.totalFeesGBP;

      return `🏛️ *Interactive Brokers — Fees & Commissions*
Accounts: \`U14522424\` (ISA) & \`U15491236\` (GIA)

📊 *Fees by Timeframe (Both Accounts):*
• 📅 *Today (24h):* *${formatMoney(todayGBP, 'GBP')}* (${formatMoney(todayTotal, 'USD')}) — _${feeData.today.accounts.ibkr_isa.tradesCount + feeData.today.accounts.ibkr_gia.tradesCount} trades_
• 📅 *Last 7 Days:* *${formatMoney(d7GBP, 'GBP')}* (${formatMoney(d7Total, 'USD')}) — _${feeData['7d'].accounts.ibkr_isa.tradesCount + feeData['7d'].accounts.ibkr_gia.tradesCount} trades_
• 📅 *Last 30 Days:* *${formatMoney(d30GBP, 'GBP')}* (${formatMoney(d30Total, 'USD')}) — _${feeData['30d'].accounts.ibkr_isa.tradesCount + feeData['30d'].accounts.ibkr_gia.tradesCount} trades_
• 📅 *Year to Date (YTD):* *${formatMoney(ytdGBP, 'GBP')}* (${formatMoney(ytdTotal, 'USD')}) — _${feeData.ytd.accounts.ibkr_isa.tradesCount + feeData.ytd.accounts.ibkr_gia.tradesCount} trades_
• 📅 *All-Time:* *${formatMoney(allGBP, 'GBP')}* (${formatMoney(allTotal, 'USD')}) — _${feeData.all.accounts.ibkr_isa.tradesCount + feeData.all.accounts.ibkr_gia.tradesCount} trades_

───────────────────────
📋 *Account Subtotals (YTD):*
• 🏛️ *Stocks & Shares ISA (U14522424):* *${formatMoney(feeData.ytd.accounts.ibkr_isa.totalFeesGBP, 'GBP')}* (${formatMoney(feeData.ytd.accounts.ibkr_isa.totalFees, 'USD')})
  ↳ _${feeData.ytd.accounts.ibkr_isa.tradesCount} trades_ | Avg: *${formatMoney(feeData.ytd.accounts.ibkr_isa.tradesCount > 0 ? feeData.ytd.accounts.ibkr_isa.totalFeesGBP / feeData.ytd.accounts.ibkr_isa.tradesCount : 0, 'GBP')} / trade*
• 🏛️ *Margin GIA (U15491236):* *${formatMoney(feeData.ytd.accounts.ibkr_gia.totalFeesGBP, 'GBP')}* (${formatMoney(feeData.ytd.accounts.ibkr_gia.totalFees, 'USD')})
  ↳ _${feeData.ytd.accounts.ibkr_gia.tradesCount} trades_ | Avg: *${formatMoney(feeData.ytd.accounts.ibkr_gia.tradesCount > 0 ? feeData.ytd.accounts.ibkr_gia.totalFeesGBP / feeData.ytd.accounts.ibkr_gia.tradesCount : 0, 'GBP')} / trade*`;
    }

    if (brokerName === 'ibkr_isa') {
      const isaYtd = feeData.ytd.accounts.ibkr_isa;
      return `🏛️ *IBKR — Stocks & Shares ISA Fees*
Account: \`U14522424\` | Type: *Stocks & Shares ISA (Tax-Free)*

📊 *ISA Fees by Timeframe:*
• 📅 *Today (24h):* *${formatMoney(feeData.today.accounts.ibkr_isa.totalFeesGBP, 'GBP')}* (${formatMoney(feeData.today.accounts.ibkr_isa.totalFees, 'USD')})
• 📅 *Last 7 Days:* *${formatMoney(feeData['7d'].accounts.ibkr_isa.totalFeesGBP, 'GBP')}* (${formatMoney(feeData['7d'].accounts.ibkr_isa.totalFees, 'USD')})
• 📅 *Last 30 Days:* *${formatMoney(feeData['30d'].accounts.ibkr_isa.totalFeesGBP, 'GBP')}* (${formatMoney(feeData['30d'].accounts.ibkr_isa.totalFees, 'USD')})
• 📅 *Year to Date (YTD):* *${formatMoney(isaYtd.totalFeesGBP, 'GBP')}* (${formatMoney(isaYtd.totalFees, 'USD')}) — _${isaYtd.tradesCount} trades_
• 📅 *All-Time:* *${formatMoney(feeData.all.accounts.ibkr_isa.totalFeesGBP, 'GBP')}* (${formatMoney(feeData.all.accounts.ibkr_isa.totalFees, 'USD')})

🛡️ *Account Fee Profile:*
• Total Commissions: *${formatMoney(isaYtd.commission * FX_USD_TO_GBP, 'GBP')}*
• Exchange / Clearing: *${formatMoney(isaYtd.clearingFees * FX_USD_TO_GBP, 'GBP')}*
• Average per Trade: *${formatMoney(isaYtd.tradesCount > 0 ? isaYtd.totalFeesGBP / isaYtd.tradesCount : 0, 'GBP')}*`;
    }

    if (brokerName === 'ibkr_gia') {
      const giaYtd = feeData.ytd.accounts.ibkr_gia;
      return `🏛️ *IBKR — Margin GIA Fees & Commissions*
Account: \`U15491236\` | Type: *General Investment Account (Margin)*

📊 *GIA Fees by Timeframe:*
• 📅 *Today (24h):* *${formatMoney(feeData.today.accounts.ibkr_gia.totalFeesGBP, 'GBP')}* (${formatMoney(feeData.today.accounts.ibkr_gia.totalFees, 'USD')})
• 📅 *Last 7 Days:* *${formatMoney(feeData['7d'].accounts.ibkr_gia.totalFeesGBP, 'GBP')}* (${formatMoney(feeData['7d'].accounts.ibkr_gia.totalFees, 'USD')})
• 📅 *Last 30 Days:* *${formatMoney(feeData['30d'].accounts.ibkr_gia.totalFeesGBP, 'GBP')}* (${formatMoney(feeData['30d'].accounts.ibkr_gia.totalFees, 'USD')})
• 📅 *Year to Date (YTD):* *${formatMoney(giaYtd.totalFeesGBP, 'GBP')}* (${formatMoney(giaYtd.totalFees, 'USD')}) — _${giaYtd.tradesCount} trades_
• 📅 *All-Time:* *${formatMoney(feeData.all.accounts.ibkr_gia.totalFeesGBP, 'GBP')}* (${formatMoney(feeData.all.accounts.ibkr_gia.totalFees, 'USD')})

⚡ *Account Fee Profile:*
• Total Commissions: *${formatMoney(giaYtd.commission * FX_USD_TO_GBP, 'GBP')}*
• Exchange / Regulatory: *${formatMoney(giaYtd.clearingFees * FX_USD_TO_GBP, 'GBP')}*
• Average per Trade: *${formatMoney(giaYtd.tradesCount > 0 ? giaYtd.totalFeesGBP / giaYtd.tradesCount : 0, 'GBP')}*`;
    }

    if (brokerName === 'tastytrade') {
      const tYtd = feeData.ytd.accounts.tastytrade;
      return `🏛️ *Tastytrade — Fees & Commissions*
Account: \`5WT67220\` | Currency: *USD*

📊 *Fees by Timeframe:*
• 📅 *Today (24h):* *${formatMoney(feeData.today.accounts.tastytrade.totalFees, 'USD')}* — _${feeData.today.accounts.tastytrade.tradesCount} trades_
• 📅 *Last 7 Days:* *${formatMoney(feeData['7d'].accounts.tastytrade.totalFees, 'USD')}* — _${feeData['7d'].accounts.tastytrade.tradesCount} trades_
• 📅 *Last 30 Days:* *${formatMoney(feeData['30d'].accounts.tastytrade.totalFees, 'USD')}* — _${feeData['30d'].accounts.tastytrade.tradesCount} trades_
• 📅 *Year to Date (YTD):* *${formatMoney(tYtd.totalFees, 'USD')}* — _${tYtd.tradesCount} trades_
• 📅 *All-Time:* *${formatMoney(feeData.all.accounts.tastytrade.totalFees, 'USD')}* — _${feeData.all.accounts.tastytrade.tradesCount} trades_

⚡ *Fee Composition (YTD):*
• Equity Option Commissions: *${formatMoney(tYtd.commission, 'USD')}* ($1.00/contract open, $0 to close)
• Clearing & Regulatory Fees: *${formatMoney(tYtd.clearingFees, 'USD')}* (FINRA, SEC, OCC)
• Average Cost per Trade: *${formatMoney(tYtd.tradesCount > 0 ? tYtd.totalFees / tYtd.tradesCount : 0, 'USD')}*`;
    }

    if (brokerName === 'trading212') {
      return `🏛️ *Trading 212 — Fees & Commissions*
Account: \`22885001\` | Type: *Invest (Cash / ISA)*

📊 *Fees by Timeframe:*
• 📅 *Today (24h):* *£0.00* ($0.00)
• 📅 *Last 7 Days:* *£0.00* ($0.00)
• 📅 *Last 30 Days:* *£0.00* ($0.00)
• 📅 *Year to Date (YTD):* *£0.00* ($0.00)
• 📅 *All-Time:* *£0.00* ($0.00)

🟢 *Account Status:* *Zero Commission Broker* (No platform or trade commissions).`;
    }
  }

  // -------------------------------------------------------------
  // Mode B: Specific Timeframe Focus (e.g. today, 7d, 30d, ytd, all)
  // -------------------------------------------------------------
  if (timeframe) {
    const summary = feeData[timeframe];
    return `💳 *Fees & Commissions — ${summary.label}*

💰 *Total Fees (${timeframe.toUpperCase()}):* *${formatMoney(summary.totalUSD, 'USD')}* (${formatMoney(summary.totalGBP, 'GBP')}) across *${summary.tradesCount} trades*

🏛️ *Breakdown by Account:*
• 🏛️ *Tastytrade (5WT67220):* *${formatMoney(summary.accounts.tastytrade.totalFees, 'USD')}* (${summary.accounts.tastytrade.tradesCount} trades)
  ↳ Commissions: *${formatMoney(summary.accounts.tastytrade.commission, 'USD')}* | Clearing/Reg: *${formatMoney(summary.accounts.tastytrade.clearingFees, 'USD')}*
• 🏛️ *IBKR — Margin GIA (U15491236):* *${formatMoney(summary.accounts.ibkr_gia.totalFeesGBP, 'GBP')}* (${formatMoney(summary.accounts.ibkr_gia.totalFees, 'USD')}) (${summary.accounts.ibkr_gia.tradesCount} trades)
  ↳ Commissions: *${formatMoney(summary.accounts.ibkr_gia.commission * FX_USD_TO_GBP, 'GBP')}* | Clearing/Reg: *${formatMoney(summary.accounts.ibkr_gia.clearingFees * FX_USD_TO_GBP, 'GBP')}*
• 🏛️ *IBKR — Stocks & Shares ISA (U14522424):* *${formatMoney(summary.accounts.ibkr_isa.totalFeesGBP, 'GBP')}* (${formatMoney(summary.accounts.ibkr_isa.totalFees, 'USD')}) (${summary.accounts.ibkr_isa.tradesCount} trades)
  ↳ Commissions: *${formatMoney(summary.accounts.ibkr_isa.commission * FX_USD_TO_GBP, 'GBP')}* | Clearing/Reg: *${formatMoney(summary.accounts.ibkr_isa.clearingFees * FX_USD_TO_GBP, 'GBP')}*
• 🏛️ *Trading 212 (22885001):* *£0.00* ($0.00) — _Zero Commission Account_ 🟢

───────────────────────
📊 *Timeframe Quick Matrix:*
• Today: *${formatMoney(feeData.today.totalUSD, 'USD')}* | 7D: *${formatMoney(feeData['7d'].totalUSD, 'USD')}* | 30D: *${formatMoney(feeData['30d'].totalUSD, 'USD')}* | YTD: *${formatMoney(feeData.ytd.totalUSD, 'USD')}*`;
  }

  // -------------------------------------------------------------
  // Mode C: General Comprehensive Fees Overview (Default for "fee" / "fees")
  // -------------------------------------------------------------
  const ytd = feeData.ytd;
  return `💳 *Broker Fees & Commissions Summary*

📊 *Fees by Timeframe (All Accounts Combined):*
• 📅 *Today (24h):* *${formatMoney(feeData.today.totalUSD, 'USD')}* (${formatMoney(feeData.today.totalGBP, 'GBP')}) — _${feeData.today.tradesCount} trades_
• 📅 *Last 7 Days:* *${formatMoney(feeData['7d'].totalUSD, 'USD')}* (${formatMoney(feeData['7d'].totalGBP, 'GBP')}) — _${feeData['7d'].tradesCount} trades_
• 📅 *Last 30 Days:* *${formatMoney(feeData['30d'].totalUSD, 'USD')}* (${formatMoney(feeData['30d'].totalGBP, 'GBP')}) — _${feeData['30d'].tradesCount} trades_
• 📅 *Year to Date (YTD):* *${formatMoney(ytd.totalUSD, 'USD')}* (${formatMoney(ytd.totalGBP, 'GBP')}) — _${ytd.tradesCount} trades_
• 📅 *All-Time Total:* *${formatMoney(feeData.all.totalUSD, 'USD')}* (${formatMoney(feeData.all.totalGBP, 'GBP')}) — _${feeData.all.tradesCount} trades_

───────────────────────
🏛️ *Account Breakdown (Year-to-Date):*

• 🏛️ *Tastytrade (\`5WT67220\`):*
  ↳ Total Fees: *${formatMoney(ytd.accounts.tastytrade.totalFees, 'USD')}* (${formatMoney(ytd.accounts.tastytrade.totalFeesGBP, 'GBP')})
  ↳ Commissions: *${formatMoney(ytd.accounts.tastytrade.commission, 'USD')}* | Clearing: *${formatMoney(ytd.accounts.tastytrade.clearingFees, 'USD')}*
  ↳ Trades: _${ytd.accounts.tastytrade.tradesCount} fills_ (Avg: *${formatMoney(ytd.accounts.tastytrade.tradesCount > 0 ? ytd.accounts.tastytrade.totalFees / ytd.accounts.tastytrade.tradesCount : 0, 'USD')} / trade*)

• 🏛️ *IBKR — Margin GIA (\`U15491236\`):*
  ↳ Total Fees: *${formatMoney(ytd.accounts.ibkr_gia.totalFeesGBP, 'GBP')}* (${formatMoney(ytd.accounts.ibkr_gia.totalFees, 'USD')})
  ↳ Commissions: *${formatMoney(ytd.accounts.ibkr_gia.commission * FX_USD_TO_GBP, 'GBP')}* | Exchange/Reg: *${formatMoney(ytd.accounts.ibkr_gia.clearingFees * FX_USD_TO_GBP, 'GBP')}*
  ↳ Trades: _${ytd.accounts.ibkr_gia.tradesCount} fills_ (Avg: *${formatMoney(ytd.accounts.ibkr_gia.tradesCount > 0 ? ytd.accounts.ibkr_gia.totalFeesGBP / ytd.accounts.ibkr_gia.tradesCount : 0, 'GBP')} / trade*)

• 🏛️ *IBKR — Stocks & Shares ISA (\`U14522424\`):*
  ↳ Total Fees: *${formatMoney(ytd.accounts.ibkr_isa.totalFeesGBP, 'GBP')}* (${formatMoney(ytd.accounts.ibkr_isa.totalFees, 'USD')})
  ↳ Commissions: *${formatMoney(ytd.accounts.ibkr_isa.commission * FX_USD_TO_GBP, 'GBP')}* | Exchange/Reg: *${formatMoney(ytd.accounts.ibkr_isa.clearingFees * FX_USD_TO_GBP, 'GBP')}*
  ↳ Trades: _${ytd.accounts.ibkr_isa.tradesCount} fills_ (Avg: *${formatMoney(ytd.accounts.ibkr_isa.tradesCount > 0 ? ytd.accounts.ibkr_isa.totalFeesGBP / ytd.accounts.ibkr_isa.tradesCount : 0, 'GBP')} / trade*)

• 🏛️ *Trading 212 (\`22885001\`):*
  ↳ Total Fees: *£0.00* ($0.00) — _Zero-Commission Account_ 🟢

───────────────────────
💰 *Grand Total YTD Fees:* *${formatMoney(ytd.totalUSD, 'USD')}* (${formatMoney(ytd.totalGBP, 'GBP')})
💡 _Query specific timeframes: \`fees 7d\`, \`fees 30d\`, \`fees today\`, or broker: \`fees ibkr\`, \`fees isa\`, \`fees gia\`, \`fees tasty\`._`;
}
