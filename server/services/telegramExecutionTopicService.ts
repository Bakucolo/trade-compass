import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';
import {
  parseTradeExecutionCandidates,
  formatTelegramExecutionSummary,
  ParsedExecutionTrade,
} from './telegramBufferConsumerService';
import { createPlannedTrade, PlannedTradeItem } from './plannedTradeService';

const logToFile = (msg: string) => console.log(msg);

export interface ExecutionTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
}

export type ExecutionTopicAction =
  | 'VIEW_QUEUE'
  | 'CANCEL_ORDER'
  | 'STATUS_TICKER'
  | 'CREATE_TRADE'
  | 'HELP';

/**
 * Handles incoming Execution topic messages (view queue, cancel order, check order, or queue trade)
 */
export async function handleExecutionTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel = 'Mobile',
  timestamp = Date.now(),
}: ExecutionTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: ExecutionTopicAction;
  tradesCreated?: PlannedTradeItem[];
}> {
  const clean = text
    .replace(/#(?:topic:)?(?:execution|execute|trade-execution|queue)\b/gi, '')
    .replace(/^🎯\s*/, '')
    .trim();

  const lower = clean.toLowerCase();

  // ==========================================
  // 1. CANCEL / REMOVE ORDER FROM QUEUE
  // ==========================================
  const cancelMatch = clean.match(/^(?:cancel|remove|delete|clear)\s+(?:order\s+)?\$?([A-Za-z]{1,6})$/i);
  if (cancelMatch) {
    const sym = cancelMatch[1].toUpperCase();
    const pendingTrades = await prisma.plannedTrade.findMany({
      where: {
        symbol: { equals: sym },
        status: { in: ['PENDING', 'READY'] },
      },
    });

    let replyText = '';
    if (pendingTrades.length === 0) {
      replyText = `🎯 *Execution Queue for $${sym}*\n\n_No pending tactical orders found for $${sym}._\n\n💡 _Send \`queue\` to review all active orders in the queue._`;
    } else {
      await prisma.plannedTrade.deleteMany({
        where: {
          symbol: { equals: sym },
          status: { in: ['PENDING', 'READY'] },
        },
      });

      replyText = `🗑️ *Removed from Execution Queue: $${sym}*\n\nCancelled and removed ${pendingTrades.length} pending order(s) for $${sym}.\n\n💡 _Send \`queue\` to view remaining active trades._`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramExecution] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'CANCEL_ORDER',
    };
  }

  // ==========================================
  // 2. VIEW EXECUTION QUEUE (Active Orders)
  // ==========================================
  if (/^(queue|orders|pending|status|list|active\s+orders|show\s+queue|my\s+orders|all\s+orders)$/i.test(lower)) {
    const queue = await prisma.plannedTrade.findMany({
      where: { status: { in: ['PENDING', 'READY'] } },
      orderBy: { rank: 'asc' },
      take: 20,
    });

    let replyText = '';
    if (queue.length === 0) {
      replyText = `🎯 *Tactical Execution Queue*\n\n_The execution queue is currently empty._\n\n💡 *How to Queue Orders:*\n• \`BUY 100 AAPL @ 220 SL 210 TP 245\`\n• \`STO 1 NVDA 120P 03/21 @ 3.20\`\n• \`Covered Call AAPL 230C Jan 17\`\n• \`SELL 50 PLTR MKT\``;
    } else {
      const orderLines = queue.map((t, idx) => {
        const actionEmoji = t.action.includes('BUY') || t.action.includes('BTO') ? '🟢' : '🔴';
        const typeStr = t.assetType === 'OPTION' ? 'contracts' : 'shares';
        const targetStr = t.targetPrice ? ` @ $${t.targetPrice.toFixed(2)}` : ' @ MKT';
        const slStr = t.stopLoss ? ` | SL: $${t.stopLoss.toFixed(2)}` : '';
        const tpStr = t.targetExit ? ` | TP: $${t.targetExit.toFixed(2)}` : '';
        const tfStr = t.timeframe ? ` [${t.timeframe}]` : '';

        return `${idx + 1}. ${actionEmoji} *${t.action} ${t.quantity} ${typeStr} $${t.symbol}*${targetStr}${tfStr}\n   Status: *${t.status}*${slStr}${tpStr}`;
      }).join('\n\n');

      replyText = `🎯 *Tactical Execution Queue* (${queue.length} orders)\n\n${orderLines}\n\n───────────────────────\n💡 _Send \`cancel [TICKER]\` to remove an order, or queue a new order directly!_`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramExecution] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'VIEW_QUEUE',
    };
  }

  // ==========================================
  // 3. CHECK ORDER STATUS FOR SPECIFIC TICKER
  // ==========================================
  const statusMatch = clean.match(/^(?:status|order|check)\s+\$?([A-Za-z]{1,6})$/i);
  if (statusMatch) {
    const sym = statusMatch[1].toUpperCase();
    const trades = await prisma.plannedTrade.findMany({
      where: { symbol: { equals: sym } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    let replyText = '';
    if (trades.length === 0) {
      replyText = `🎯 *Orders for $${sym}*\n\n_No tactical execution orders found for $${sym}._\n\n💡 _To queue an order: \`BUY 50 ${sym} @ 150 SL 140\`._`;
    } else {
      const rows = trades.map((t) => {
        const targetStr = t.targetPrice ? ` @ $${t.targetPrice.toFixed(2)}` : '';
        const slStr = t.stopLoss ? ` | SL: $${t.stopLoss.toFixed(2)}` : '';
        return `• *${t.action} ${t.quantity} $${t.symbol}*${targetStr} (${t.status})${slStr}`;
      }).join('\n');

      replyText = `🎯 *Orders for $${sym}* (${trades.length})\n\n${rows}\n\n💡 _Send \`cancel ${sym}\` to remove pending orders._`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramExecution] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'STATUS_TICKER',
    };
  }

  // ==========================================
  // 4. PARSE & CREATE PLANNED TRADES (Orders)
  // ==========================================
  const parsedTrades = parseTradeExecutionCandidates(clean);
  if (parsedTrades.length > 0) {
    const autoCreatedPlannedTrades: PlannedTradeItem[] = [];

    for (const pt of parsedTrades) {
      try {
        const created = await createPlannedTrade(
          {
            symbol: pt.symbol,
            underlyingSymbol: pt.underlyingSymbol || pt.symbol,
            action: pt.action,
            assetType: pt.assetType,
            timeframe: pt.timeframe,
            orderType: pt.orderType,
            quantity: pt.quantity,
            targetPrice: pt.targetPrice,
            stopLoss: pt.stopLoss,
            targetExit: pt.targetExit,
            conviction: pt.conviction,
            notes: pt.notes || `📱 Telegram Execution Queue: "${clean}"`,
          },
          prisma
        );
        autoCreatedPlannedTrades.push(created);
        logToFile(`[TelegramExecution] Queued trade #${created.rank}: ${created.action} ${created.quantity} ${created.symbol}`);
      } catch (tradeErr: any) {
        logToFile(`[TelegramExecution] Error creating PlannedTrade for ${pt.symbol}: ${tradeErr.message}`);
      }
    }

    if (autoCreatedPlannedTrades.length > 0) {
      const summaryLines = autoCreatedPlannedTrades
        .map((t, idx) => formatTelegramExecutionSummary(t, parsedTrades[idx]?.strategy))
        .join('\n');

      const replyText = `🎯 *Added to Tactical Execution Queue*\n\n${summaryLines}\n\n───────────────────────\n_View live queue anytime with \`queue\`. Manage in Trade Compass > Management Hub._`;

      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        await sendTelegramMessage({
          text: replyText,
          chatId,
          messageThreadId,
          parseMode: 'Markdown',
        }).catch((e: any) => logToFile(`[TelegramExecution] Send error: ${e.message}`));
      }

      return {
        handled: true,
        replyText,
        actionTaken: 'CREATE_TRADE',
        tradesCreated: autoCreatedPlannedTrades,
      };
    }
  }

  return {
    handled: false,
    replyText: '',
    actionTaken: 'HELP',
  };
}
