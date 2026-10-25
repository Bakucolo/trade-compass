import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { sendTelegramMessage, sendPdfReportToTelegram } from './telegramReportService';
import { runTastyCopilotAgent, StagedDraftOrder } from './tastytradeToolService';
import { isCloudHosting } from './environmentService';
import { getCopilotTopicHelp } from './telegramTopicHelpService';
import { extractSymbolsFromText } from './thoughtLogAgentService';

const logToFile = (msg: string) => {
  try {
    console.log(msg);
  } catch {}
};

export interface CopilotTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number | string;
}

export type CopilotTopicAction =
  | 'HELP'
  | 'CHAT_QUERY'
  | 'DRAFT_ORDER'
  | 'PDF_REPORT'
  | 'RESET_SESSION'
  | 'SWITCH_BROKER'
  | 'STATUS';

export interface CopilotTopicResult {
  handled: boolean;
  replyText: string;
  actionTaken: CopilotTopicAction;
  modelUsed?: string;
  toolsUsed?: string[];
  pdfGenerated?: boolean;
  draftOrder?: StagedDraftOrder;
  symbol?: string | null;
}

interface CopilotSessionState {
  chatHistory: { role: string; content: string }[];
  activeBroker: 'tastytrade' | 'alpaca' | 'ibkr';
  activeModel: string;
  lastActive: number;
  lastResponse?: string;
  lastQuery?: string;
}

// In-memory conversation state keyed by `${chatId}:${messageThreadId}`
const copilotSessions = new Map<string, CopilotSessionState>();

function getSessionKey(chatId: string | number, threadId?: number): string {
  return `${chatId}:${threadId ?? 'main'}`;
}

export function getCopilotSession(chatId: string | number, threadId?: number): CopilotSessionState {
  const key = getSessionKey(chatId, threadId);
  let session = copilotSessions.get(key);
  if (!session) {
    session = {
      chatHistory: [],
      activeBroker: 'tastytrade',
      activeModel: 'auto',
      lastActive: Date.now(),
    };
    copilotSessions.set(key, session);
  }
  return session;
}

export function clearCopilotSessionForTesting(): void {
  copilotSessions.clear();
}

/**
 * Splits long telegram text into safe chunks under Telegram's 4096-char ceiling
 */
export function splitTelegramMessage(text: string, maxLength = 3900): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIdx === -1) {
      splitIdx = maxLength;
    }
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  return chunks;
}

/**
 * Generates an executive PDF report of an AI Copilot response
 */
export async function generateCopilotBriefingPdf(
  query: string,
  responseContent: string,
  modelName: string,
  brokerName: string,
  toolsUsed: string[] = []
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      bufferPages: true,
    });

    const buffers: Buffer[] = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const colors = {
      primaryNavy: '#0F172A',
      secondaryNavy: '#1E293B',
      cardBg: '#F8FAFC',
      cardBorder: '#E2E8F0',
      accentIndigo: '#4F46E5',
      accentCyan: '#0EA5E9',
      accentEmerald: '#10B981',
      slateDark: '#334155',
      slateMuted: '#64748B',
      white: '#FFFFFF',
    };

    // Header Banner
    doc.rect(36, 36, 523, 52).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(14).font('Helvetica-Bold')
      .text('Trade Compass • AI Copilot Quantitative Briefing', 48, 48);
    doc.fillColor(colors.accentCyan).fontSize(8).font('Helvetica')
      .text(
        `Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • Broker Gateway: ${brokerName.toUpperCase()} • Model: ${modelName}`,
        48,
        68
      );

    let curY = 96;

    // User Inquiry Card
    doc.rect(36, curY, 523, 44).fill(colors.cardBg);
    doc.rect(36, curY, 523, 44).strokeColor(colors.accentIndigo).lineWidth(1).stroke();

    doc.fillColor(colors.accentIndigo).fontSize(7).font('Helvetica-Bold')
      .text('QUANTITATIVE INQUIRY PROMPT', 46, curY + 8);
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text(query.length > 120 ? query.slice(0, 117) + '...' : query, 46, curY + 20, { width: 503 });

    curY += 52;

    // Telemetry strip
    doc.rect(36, curY, 523, 24).fill(colors.secondaryNavy);
    const toolsStr = toolsUsed.length > 0 ? toolsUsed.join(', ') : 'Frontier Synthesis';
    doc.fillColor(colors.accentCyan).fontSize(7).font('Helvetica-Bold')
      .text(`ACTIVE TOOLS CALLED: ${toolsStr}`, 46, curY + 8, { width: 503 });

    curY += 32;

    // Response Body
    doc.fillColor(colors.primaryNavy).fontSize(11).font('Helvetica-Bold')
      .text('Synthesized Quantitative Financial Analysis', 36, curY);
    curY += 16;

    // Strip basic markdown asterisks for clean PDF readability
    const cleanText = responseContent
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{3}[\s\S]*?`{3}/g, (match) => match.replace(/`{3}/g, ''))
      .replace(/`([^`]+)`/g, '$1');

    doc.fillColor(colors.slateDark).fontSize(9).font('Helvetica')
      .text(cleanText, 36, curY, {
        width: 523,
        lineGap: 3,
        align: 'left',
      });

    // Numbered Footers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const footerY = 752;
      doc.rect(36, footerY, 523, 0.75).fill(colors.cardBorder);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text('Trade Compass • Multi-Factor Financial Copilot Briefing', 36, footerY + 6, { lineBreak: false });
      doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
        .text(`Page ${i + 1} of ${totalPages}`, 463, footerY + 6, { width: 96, align: 'right', lineBreak: false });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}

/**
 * Main dispatcher for Telegram messages inside the AI Copilot topic
 */
export async function handleCopilotTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel,
}: CopilotTopicRequest): Promise<CopilotTopicResult> {
  const clean = (text || '').trim();
  const lower = clean.toLowerCase();
  const session = getCopilotSession(chatId, messageThreadId);
  session.lastActive = Date.now();

  const token = process.env.TELEGRAM_BOT_TOKEN;

  // 1. Help Request
  if (
    /^(?:help|\?|guide|commands?|usage|info)$/i.test(lower) ||
    lower === 'how to use' ||
    lower === 'what can you do'
  ) {
    const helpMsg = getCopilotTopicHelp();
    if (token && chatId) {
      await sendTelegramMessage({
        text: helpMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramCopilot] Help send error: ${e.message}`));
    }
    return {
      handled: true,
      actionTaken: 'HELP',
      replyText: helpMsg,
    };
  }

  // 2. Clear / Reset Conversation Memory
  if (/^(?:reset|clear|new|restart|forget|clear\s+memory|new\s+chat)$/i.test(lower)) {
    session.chatHistory = [];
    delete session.lastQuery;
    delete session.lastResponse;
    const resetMsg = `🧹 *Copilot Memory Cleared*\n\nYour conversational history in this topic has been reset. What would you like to analyze or execute next?`;
    if (token && chatId) {
      await sendTelegramMessage({
        text: resetMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramCopilot] Reset send error: ${e.message}`));
    }
    return {
      handled: true,
      actionTaken: 'RESET_SESSION',
      replyText: resetMsg,
    };
  }

  // 3. Status Inquiry
  if (/^(?:status|session|whoami|config|broker)$/i.test(lower)) {
    const isCloud = isCloudHosting();
    const statusMsg =
      `🤖 *Trade Compass AI Copilot — Session Status*\n\n` +
      `• *Active Target Broker:* \`${session.activeBroker.toUpperCase()}\`\n` +
      `• *Routing Engine:* \`${isCloud ? 'Cloud Frontier Cascade (Gemini Flash / Groq / OpenRouter)' : 'Localhost / Hybrid'}\`\n` +
      `• *Conversation Context Depth:* \`${session.chatHistory.length} messages in memory\`\n` +
      `• *Thread ID:* \`${messageThreadId ?? 'Default'}\`\n\n` +
      `💡 *Commands:*\n` +
      `• \`broker ibkr\` — Switch active connection to Interactive Brokers.\n` +
      `• \`broker tasty\` — Switch active connection to Tastytrade.\n` +
      `• \`reset\` — Clear conversational memory.`;

    if (token && chatId) {
      await sendTelegramMessage({
        text: statusMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramCopilot] Status send error: ${e.message}`));
    }
    return {
      handled: true,
      actionTaken: 'STATUS',
      replyText: statusMsg,
    };
  }

  // 4. Broker Switching
  if (/^broker\s+(ibkr|interactive\s*brokers?|tastytrade|tasty|alpaca)/i.test(lower)) {
    let targetBroker: 'tastytrade' | 'alpaca' | 'ibkr' = 'tastytrade';
    if (/ibkr|interactive/i.test(lower)) {
      targetBroker = 'ibkr';
    } else if (/alpaca/i.test(lower)) {
      targetBroker = 'alpaca';
    }

    session.activeBroker = targetBroker;
    const brokerMsg = `🏛️ *Active Broker Switched to ${targetBroker.toUpperCase()}*\n\nSubsequent queries, position inspections, buying power calculations, and draft orders will target your *${targetBroker.toUpperCase()}* gateway.`;

    if (token && chatId) {
      await sendTelegramMessage({
        text: brokerMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramCopilot] Broker switch error: ${e.message}`));
    }
    return {
      handled: true,
      actionTaken: 'SWITCH_BROKER',
      replyText: brokerMsg,
    };
  }

  // 5. PDF Dossier Request
  const isPdfRequested = /\b(?:pdf|dossier|document)\b/i.test(lower);
  let effectiveQuery = clean;

  // If user simply wrote "pdf", use the last query & response
  if (/^pdf$/i.test(clean) && session.lastResponse && session.lastQuery) {
    effectiveQuery = session.lastQuery;
  } else if (isPdfRequested) {
    // Strip trailing or standalone "pdf" from query to get clean financial prompt
    effectiveQuery = clean.replace(/\b(?:pdf|send\s+pdf|export\s+pdf|as\s+a\s+pdf|dossier)\b/gi, '').trim();
    if (!effectiveQuery && session.lastQuery) {
      effectiveQuery = session.lastQuery;
    }
  }

  const extracted = extractSymbolsFromText(effectiveQuery);
  const detectedSymbol = extracted.length > 0 ? extracted[0] : null;

  logToFile(`[TelegramCopilot] Executing AI Copilot inquiry for ${senderLabel}: "${effectiveQuery}" (Broker: ${session.activeBroker})`);

  try {
    const isCloud = isCloudHosting();
    let modelToUse = session.activeModel || 'auto';
    if (isCloud && modelToUse.toLowerCase().includes('ollama')) {
      modelToUse = 'auto';
    }

    const copilotRes = await runTastyCopilotAgent(
      effectiveQuery,
      modelToUse,
      session.chatHistory,
      session.activeBroker
    );

    const rawResponse = copilotRes.response || 'No response returned from agent.';
    session.lastQuery = effectiveQuery;
    session.lastResponse = rawResponse;

    // Append to conversation history (keep last 8 turns)
    session.chatHistory.push({ role: 'user', content: effectiveQuery });
    session.chatHistory.push({ role: 'assistant', content: rawResponse });
    if (session.chatHistory.length > 8) {
      session.chatHistory = session.chatHistory.slice(-8);
    }

    // Format Draft Order card if an order was staged
    let draftOrderCard = '';
    if (copilotRes.draftOrder) {
      const d = copilotRes.draftOrder;
      const priceText = d.price ? `$${d.price.toFixed(2)}` : 'Market';
      const optDetails = d.optionDetails
        ? ` (${d.optionDetails.strikePrice} ${d.optionDetails.optionType} Exp: ${d.optionDetails.expirationDate})`
        : '';

      draftOrderCard =
        `\n\n🛡️ *ORDER DRAFTED & STAGED IN TRADE COMPASS*\n` +
        `• *Broker:* \`${(d.broker || session.activeBroker).toUpperCase()}\`\n` +
        `• *Action:* \`${d.action} ${d.quantity} ${d.symbol}\`${optDetails}\n` +
        `• *Order Type:* \`${d.orderType} (${d.timeInForce})\` @ \`${priceText}\`\n` +
        (d.dryRunResult?.buyingPowerEffect ? `• *Est. BP Impact:* \`$${Math.abs(d.dryRunResult.buyingPowerEffect).toFixed(2)}\`\n` : '') +
        (d.dryRunResult?.estimatedCommission ? `• *Est. Fees:* \`$${d.dryRunResult.estimatedCommission.toFixed(2)}\`\n` : '') +
        `• *Draft ID:* \`${d.draftId}\`\n\n` +
        `⚠️ *Human-in-the-Loop Security Rule:*\n` +
        `_Live execution strictly requires your confirmation in Trade Compass. Open the app to approve or edit this order!_`;
    }

    // If PDF was requested, generate and send the PDF document
    if (isPdfRequested) {
      logToFile(`[TelegramCopilot] Generating quantitative Copilot PDF dossier for ${senderLabel}...`);
      try {
        const pdfBuffer = await generateCopilotBriefingPdf(
          effectiveQuery,
          rawResponse,
          copilotRes.model,
          session.activeBroker,
          copilotRes.tools_used
        );

        const filename = `TradeCompass_Copilot_${detectedSymbol ? `${detectedSymbol}_` : ''}${new Date().toISOString().slice(0, 10)}.pdf`;
        const caption =
          `📄 *Trade Compass — AI Copilot Quantitative Briefing*\n\n` +
          `Attached is your institutional PDF dossier for: *"${effectiveQuery.length > 50 ? effectiveQuery.slice(0, 47) + '...' : effectiveQuery}"*\n` +
          `• *Gateway:* \`${session.activeBroker.toUpperCase()}\`\n` +
          `• *Frontier Engine:* \`${copilotRes.model}\`\n` +
          `• *Execution Time:* \`${copilotRes.execution_time_seconds}s\`\n\n` +
          `💡 _You can continue conversing with the Copilot directly in this topic._`;

        if (token && chatId) {
          await sendPdfReportToTelegram(pdfBuffer, filename, caption, {
            chatId,
            messageThreadId,
          });
        }

        return {
          handled: true,
          actionTaken: 'PDF_REPORT',
          replyText: caption,
          pdfGenerated: true,
          modelUsed: copilotRes.model,
          toolsUsed: copilotRes.tools_used,
          draftOrder: copilotRes.draftOrder,
          symbol: detectedSymbol,
        };
      } catch (pdfErr: any) {
        logToFile(`[TelegramCopilot] PDF generation error: ${pdfErr.message}. Falling back to text response.`);
      }
    }

    // Prepare full text message
    const telemetryFooter = `\n\n🤖 _Model: ${copilotRes.model} | Broker: ${session.activeBroker.toUpperCase()} | Time: ${copilotRes.execution_time_seconds}s_`;
    const fullMessage = `${rawResponse}${draftOrderCard}${telemetryFooter}`;

    // Split and send text chunks to Telegram
    const chunks = splitTelegramMessage(fullMessage);
    if (token && chatId) {
      for (const chunk of chunks) {
        try {
          await sendTelegramMessage({
            text: chunk,
            chatId,
            messageThreadId,
            parseMode: 'Markdown',
          });
        } catch {
          // Fallback without parseMode in case markdown formatting has unclosed brackets
          await sendTelegramMessage({
            text: chunk,
            chatId,
            messageThreadId,
          }).catch((err: any) => logToFile(`[TelegramCopilot] Plain send error: ${err.message}`));
        }
      }
    }

    return {
      handled: true,
      actionTaken: copilotRes.draftOrder ? 'DRAFT_ORDER' : 'CHAT_QUERY',
      replyText: fullMessage,
      modelUsed: copilotRes.model,
      toolsUsed: copilotRes.tools_used,
      draftOrder: copilotRes.draftOrder,
      symbol: detectedSymbol,
    };
  } catch (err: any) {
    logToFile(`[TelegramCopilot] Agent error: ${err.message}`);
    const isRateLimit = /429|rate[- ]?limit|quota|demand|temporarily/i.test(err.message || '');
    const userHint = isRateLimit
      ? 'The upstream frontier models are temporarily experiencing high volume. Please wait a few seconds and retry.'
      : 'Please verify your API keys in Settings, or try asking in a slightly different way.';

    const errMsg =
      `⚠️ *Trade Compass Copilot Notice*\n\n` +
      `The agent encountered a temporary delay: ${isRateLimit ? '_Upstream provider rate limit reached._' : `\`${err.message}\``}\n\n` +
      `💡 _${userHint} Send \`reset\` to clear conversational context._`;

    if (token && chatId) {
      await sendTelegramMessage({
        text: errMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramCopilot] Error send failure: ${e.message}`));
    }

    return {
      handled: true,
      actionTaken: 'CHAT_QUERY',
      replyText: errMsg,
    };
  }
}
