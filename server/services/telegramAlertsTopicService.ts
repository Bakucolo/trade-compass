import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';
import { autoCreateAlertsFromText } from './thoughtLogAlertService';

const logToFile = (msg: string) => console.log(msg);

export interface AlertsTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
}

export type AlertsTopicAction =
  | 'VIEW_ALERTS'
  | 'CANCEL_ALERT'
  | 'CREATE_ALERT'
  | 'HELP';

/**
 * Handles incoming Alerts topic messages (view active alerts, cancel alert, or arm new alert)
 */
export async function handleAlertsTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel = 'Mobile',
  timestamp = Date.now(),
}: AlertsTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: AlertsTopicAction;
  alertsCreated?: any[];
}> {
  const clean = text
    .replace(/#(?:topic:)?alert(?:s)?\b/gi, '')
    .replace(/^[🚨🔔]\s*/, '')
    .trim();

  const lower = clean.toLowerCase();

  // ==========================================
  // 1. CANCEL / DELETE PRICE ALERT
  // ==========================================
  const cancelMatch = clean.match(/^(?:cancel|remove|delete|clear|disarm)\s+(?:alerts?\s+)?\$?([A-Za-z]{1,6})$/i);
  if (cancelMatch) {
    const sym = cancelMatch[1].toUpperCase();
    const alertModel = (prisma as any).priceAlert || (prisma as any).alert;
    const activeAlerts = alertModel
      ? await alertModel.findMany({
          where: {
            symbol: { equals: sym },
            status: { in: ['ACTIVE', 'PENDING'] },
          },
        })
      : [];

    let replyText = '';
    if (activeAlerts.length === 0) {
      replyText = `🔔 *Price Alerts for $${sym}*\n\n_No active price alerts currently armed for $${sym}._\n\n💡 _Send \`alerts\` to view all armed price alerts._`;
    } else {
      if (alertModel) {
        await alertModel.deleteMany({
          where: {
            symbol: { equals: sym },
            status: { in: ['ACTIVE', 'PENDING'] },
          },
        });
      }

      replyText = `🔕 *Price Alert Cancelled: $${sym}*\n\nDisarmed and removed ${activeAlerts.length} alert(s) for $${sym}.\n\n💡 _Send \`alerts\` to see remaining active monitors._`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramAlerts] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'CANCEL_ALERT',
    };
  }

  // ==========================================
  // 2. VIEW ACTIVE ARMED ALERTS
  // ==========================================
  if (/^(alerts|list|active|active\s+alerts|my\s+alerts|show\s+alerts|status|all\s+alerts)$/i.test(lower)) {
    const alertModel = (prisma as any).priceAlert || (prisma as any).alert;
    const alerts = alertModel
      ? await alertModel.findMany({
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];

    let replyText = '';
    if (alerts.length === 0) {
      replyText = `🔔 *Active Price Alerts*\n\n_No active price alerts currently armed._\n\n💡 *How to Arm Price Alerts:*\n• \`Alert NVDA above $145\`\n• \`Alert AAPL below $215\`\n• \`PLTR > $60\`\n• \`TSLA < 200\``;
    } else {
      const rows = alerts.map((a: any) => {
        const condArrow = a.condition === 'ABOVE' || a.type === 'PRICE_ABOVE' ? '▲ Above' : '▼ Below';
        const targetVal = Number(a.targetPrice ?? a.targetValue ?? 0);
        const targetStr = targetVal > 0 ? `$${targetVal.toFixed(2)}` : '$0.00';
        const noteStr = a.notes ? `\n   _${a.notes.replace(/^📱 Telegram Note.*?: /i, '').replace(/"/g, '')}_` : '';
        return `• *$${a.symbol}*: Target *${targetStr}* (${condArrow})${noteStr}`;
      }).join('\n\n');

      replyText = `🔔 *Active Armed Price Alerts* (${alerts.length} monitors)\n\n${rows}\n\n───────────────────────\n💡 _Send \`delete alert [TICKER]\` to disarm an alert, or arm a new one anytime._`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramAlerts] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'VIEW_ALERTS',
    };
  }

  // ==========================================
  // 3. ARM / CREATE PRICE ALERT
  // ==========================================
  const createdAlerts = await autoCreateAlertsFromText(
    prisma,
    clean,
    `📱 Telegram Alert (${new Date(timestamp).toLocaleString()}): "${clean}"`,
    { isAlertsTopic: true }
  );

  if (createdAlerts.length > 0) {
    const alertSummary = createdAlerts
      .map(
        (a) =>
          `• *$${a.symbol}*: Target *$${a.targetPrice.toFixed(2)}* (${a.condition === 'ABOVE' ? '▲ Above' : '▼ Below'})${a.currentPrice ? ` — Spot: $${a.currentPrice.toFixed(2)}` : ''}`
      )
      .join('\n');

    const replyText = `🎯 *Price Alert Armed & Monitored 24/7*\n\n${alertSummary}\n\n───────────────────────\n🚨 _When triggered, live alert notifications will fire into the *Alerts* topic!_`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramAlerts] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'CREATE_ALERT',
      alertsCreated: createdAlerts,
    };
  }

  return {
    handled: false,
    replyText: '',
    actionTaken: 'HELP',
  };
}
