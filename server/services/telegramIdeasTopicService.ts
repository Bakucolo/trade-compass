import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { sendTelegramMessage, sendPdfReportToTelegram } from './telegramReportService';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import {
  detectSentimentFromText,
  createTitleFromText,
  saveSymbolsToWatchlist,
} from './telegramBufferConsumerService';

const logToFile = (msg: string) => console.log(msg);

export interface IdeasTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
}

export type IdeasTopicAction =
  | 'VIEW_IDEAS'
  | 'CREATE_IDEA'
  | 'PDF_REPORT'
  | 'HELP';

export type IdeasTimeframe = 'ALL' | 'YEAR' | 'MONTH' | 'WEEK';

export interface ParsedIdeasQuery {
  isQuery: boolean;
  timeframe: IdeasTimeframe;
  timeframeLabel: string;
  isPdfRequested: boolean;
  symbolFilter?: string | null;
  cutoffDate?: Date | null;
}

export interface UnifiedMarketIdea {
  id: string;
  sourceType: 'THOUGHT_LOG' | 'TRADE_IDEA';
  title: string;
  content: string;
  symbols: string[];
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CAUTION' | 'MACRO';
  status?: string;
  entryPrice?: number | null;
  targetPrice?: number | null;
  stopLoss?: number | null;
  tags?: string[];
  agentOutput?: string | null;
  createdAt: Date;
}

/**
 * Parses user message to detect if they are requesting idea listings,
 * with timeframe keywords (year, month, week, all) and PDF export formatting.
 */
export function parseIdeasQuery(text: string): ParsedIdeasQuery {
  const clean = text
    .replace(/#(?:topic:)?ideas?\b/gi, '')
    .replace(/^💡\s*/, '')
    .replace(/^[/#]+/, '')
    .trim();

  const lower = clean.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);

  // Exact standalone keywords
  const isExactTimeframeOnly = /^(?:week|weekly|last\s+week|month|monthly|last\s+month|year|yearly|annual|annually|last\s+year|all|pdf)$/i.test(clean);

  // Starts with list/ideas/theses/show ideas/pdf
  const startsWithCommand = /^(?:list|ideas?|theses?|show\s+ideas?|view\s+ideas?|get\s+ideas?|my\s+ideas?|recent\s+ideas?|all\s+ideas?|pdf)\b/i.test(clean);

  // Short query phrase (<= 6 tokens) containing list, ideas, theses, or pdf
  const isShortQueryPhrase = tokens.length <= 6 && (
    tokens.includes('list') ||
    tokens.includes('idea') ||
    tokens.includes('ideas') ||
    tokens.includes('theses') ||
    tokens.includes('thesis') ||
    tokens.includes('pdf') ||
    isExactTimeframeOnly
  );

  // Check if it's an inquiry command rather than a new thesis
  const isQuery = (startsWithCommand || isExactTimeframeOnly || isShortQueryPhrase) && tokens.length <= 8;

  if (!isQuery) {
    return {
      isQuery: false,
      timeframe: 'ALL',
      timeframeLabel: 'All Ideas Sent',
      isPdfRequested: false,
      symbolFilter: null,
      cutoffDate: null,
    };
  }

  // 1. PDF requested
  const isPdfRequested = /\b(?:pdf|report|export|dossier|document)\b/i.test(clean);

  // 2. Timeframe detection
  let timeframe: IdeasTimeframe = 'ALL';
  let cutoffDate: Date | null = null;
  let timeframeLabel = 'All Ideas Sent';

  const now = Date.now();
  if (/\b(?:week|weekly|1w|last\s+week|past\s+week|this\s+week)\b/i.test(clean)) {
    timeframe = 'WEEK';
    cutoffDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    timeframeLabel = 'Last Week (7 Days)';
  } else if (/\b(?:month|monthly|1m|last\s+month|past\s+month|this\s+month)\b/i.test(clean)) {
    timeframe = 'MONTH';
    cutoffDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    timeframeLabel = 'Last Month (30 Days)';
  } else if (/\b(?:year|yearly|annual|annually|1y|last\s+year|past\s+year|this\s+year|ytd)\b/i.test(clean)) {
    timeframe = 'YEAR';
    cutoffDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
    timeframeLabel = 'Last Year (365 Days)';
  }

  // 3. Optional ticker filter
  let symbolFilter: string | null = null;
  const dollarMatch = clean.match(/\$([A-Za-z]{1,6})\b/);
  if (dollarMatch) {
    symbolFilter = dollarMatch[1].toUpperCase();
  } else {
    const reservedWords = new Set([
      'list', 'all', 'week', 'weekly', 'last', 'past', 'this', 'month', 'monthly',
      'year', 'yearly', 'annual', 'annually', 'pdf', 'report', 'export', 'dossier',
      'document', 'ideas', 'idea', 'theses', 'thesis', 'show', 'view', 'get', 'my',
      'recent', 'for', 'on', 'in', 'and', 'the', 'of', 'to'
    ]);
    for (const t of tokens) {
      const cleanToken = t.replace(/[^a-z0-9]/gi, '');
      if (cleanToken.length >= 1 && cleanToken.length <= 6 && !reservedWords.has(cleanToken.toLowerCase())) {
        if (/^[a-zA-Z]{1,6}$/.test(cleanToken)) {
          symbolFilter = cleanToken.toUpperCase();
          break;
        }
      }
    }
  }

  return {
    isQuery: true,
    timeframe,
    timeframeLabel,
    isPdfRequested,
    symbolFilter,
    cutoffDate,
  };
}

/**
 * Fetches and unifies market ideas across ThoughtLog (Ideas folder) and TradeIdea
 */
export async function fetchUnifiedIdeas(
  prisma: any,
  options: {
    cutoffDate?: Date | null;
    symbolFilter?: string | null;
  } = {}
): Promise<UnifiedMarketIdea[]> {
  const { cutoffDate, symbolFilter } = options;
  const ideas: UnifiedMarketIdea[] = [];

  // 1. Query prisma.thoughtLog
  try {
    const queryWhere: any = { folder: 'Ideas' };
    if (cutoffDate) {
      queryWhere.createdAt = { gte: cutoffDate };
    }
    if (symbolFilter) {
      queryWhere.OR = [
        { symbols: { contains: symbolFilter } },
        { title: { contains: symbolFilter } },
        { content: { contains: symbolFilter } },
      ];
    }

    const logs = await prisma.thoughtLog.findMany({
      where: queryWhere,
      orderBy: { createdAt: 'desc' },
    });

    for (const log of logs) {
      const rawSyms = log.symbols
        ? log.symbols.split(/,\s*/).map((s: string) => s.trim().toUpperCase()).filter(Boolean)
        : [];
      let sent = (log.sentiment || 'NEUTRAL').toUpperCase();
      if (!['BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTION', 'MACRO'].includes(sent)) {
        sent = 'NEUTRAL';
      }

      ideas.push({
        id: log.id,
        sourceType: 'THOUGHT_LOG',
        title: log.title ? log.title.replace(/^💡\s*(?:Idea:\s*)?/, '').trim() : 'Market Idea',
        content: log.content || '',
        symbols: rawSyms,
        sentiment: sent as any,
        tags: log.tags ? log.tags.split(/,\s*/).map((t: string) => t.trim()).filter(Boolean) : [],
        agentOutput: log.agentOutput || null,
        createdAt: new Date(log.createdAt || Date.now()),
      });
    }
  } catch (err: any) {
    logToFile(`[TelegramIdeas] Error querying thoughtLog: ${err.message}`);
  }

  // 2. Query prisma.tradeIdea if available
  try {
    if (prisma?.tradeIdea && typeof prisma.tradeIdea.findMany === 'function') {
      const tradeIdeaWhere: any = {};
      if (cutoffDate) {
        tradeIdeaWhere.createdAt = { gte: cutoffDate };
      }
      if (symbolFilter) {
        tradeIdeaWhere.OR = [
          { symbol: { contains: symbolFilter } },
          { title: { contains: symbolFilter } },
          { content: { contains: symbolFilter } },
        ];
      }

      const tradeIdeas = await prisma.tradeIdea.findMany({
        where: tradeIdeaWhere,
        orderBy: { createdAt: 'desc' },
      });

      for (const ti of tradeIdeas) {
        let sent = (ti.type || 'NEUTRAL').toUpperCase();
        if (!['BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTION', 'MACRO'].includes(sent)) {
          sent = 'NEUTRAL';
        }

        ideas.push({
          id: ti.id,
          sourceType: 'TRADE_IDEA',
          title: ti.title || `${ti.symbol || 'Market'} Trade Thesis`,
          content: ti.content || '',
          symbols: ti.symbol ? [ti.symbol.toUpperCase()] : [],
          sentiment: sent as any,
          status: ti.status || 'ACTIVE',
          entryPrice: ti.entryPrice ?? null,
          targetPrice: ti.targetPrice ?? null,
          stopLoss: ti.stopLoss ?? null,
          tags: ti.tags ? ti.tags.split(/,\s*/).map((t: string) => t.trim()).filter(Boolean) : [],
          createdAt: new Date(ti.createdAt || Date.now()),
        });
      }
    }
  } catch (err: any) {
    logToFile(`[TelegramIdeas] Error querying tradeIdea: ${err.message}`);
  }

  // Sort descending by creation date
  ideas.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Deduplicate items with identical title/content within short period
  const deduped: UnifiedMarketIdea[] = [];
  const seenKeys = new Set<string>();
  for (const idea of ideas) {
    const key = `${idea.title}_${idea.content.slice(0, 45)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(idea);
    }
  }

  return deduped;
}

/**
 * Formats Telegram Markdown message summarizing the ideas sent
 */
export function formatIdeasTelegramMessage(
  ideas: UnifiedMarketIdea[],
  query: ParsedIdeasQuery
): string {
  if (ideas.length === 0) {
    if (query.symbolFilter) {
      return (
        `💡 *Market Ideas for $${query.symbolFilter}*\n\n` +
        `_No logged theses or catalysts found for $${query.symbolFilter} in ${query.timeframeLabel.toLowerCase()}._\n\n` +
        `💡 _To log an idea: \`$${query.symbolFilter} Thesis and catalyst...\`._`
      );
    }
    return (
      `💡 *Market Ideas & Catalysts*\n\n` +
      `_No market theses currently logged in the Ideas folder (${query.timeframeLabel.toLowerCase()})._\n\n` +
      `💡 *How to Log Ideas:*\n` +
      `• Share any market observation, catalyst, or macro thesis.\n` +
      `• Mentions of \`$TICKER\` are automatically linked to Trade Compass!`
    );
  }

  const bullCount = ideas.filter((i) => i.sentiment === 'BULLISH').length;
  const bearCount = ideas.filter((i) => i.sentiment === 'BEARISH').length;
  const neutralCount = ideas.length - bullCount - bearCount;

  // Extract unique symbols
  const symSet = new Set<string>();
  for (const item of ideas) {
    for (const s of item.symbols) {
      symSet.add(s);
    }
  }
  const uniqueSyms = Array.from(symSet).slice(0, 8);
  const symSummary = uniqueSyms.length > 0 ? uniqueSyms.map((s) => `$${s}`).join(', ') : null;

  let replyText = `💡 *Recent Market Ideas & Catalysts* (${ideas.length} logs • ${query.timeframeLabel})\n`;
  replyText += `• Breakdown: 🟢 *${bullCount}* Bullish • 🔴 *${bearCount}* Bearish • ⚪ *${neutralCount}* Neutral\n`;
  if (symSummary) {
    replyText += `• Mentioned Symbols: *${symSummary}${symSet.size > 8 ? ` (+${symSet.size - 8} more)` : ''}*\n`;
  }
  replyText += `\n`;

  const displayLimit = 15;
  const rows = ideas.slice(0, displayLimit).map((item) => {
    const titleClean = item.title.replace(/^💡\s*(?:Idea:\s*)?/, '');
    const symStr = item.symbols.length > 0 ? ` ($${item.symbols.join(', $')})` : '';
    const dateStr = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sentIcon = item.sentiment === 'BULLISH' ? '🟢 ' : item.sentiment === 'BEARISH' ? '🔴 ' : '';
    const snippet = item.content.slice(0, 95).replace(/\n+/g, ' ');
    return `• ${sentIcon}*${titleClean}*${symStr} — _${dateStr}_\n  "${snippet}${item.content.length > 95 ? '...' : ''}"`;
  }).join('\n\n');

  replyText += rows;

  if (ideas.length > displayLimit) {
    replyText += `\n\n_...and ${ideas.length - displayLimit} more ideas sent in this period._\n📄 _Tip: Send \`list ${query.timeframe === 'ALL' ? '' : query.timeframe.toLowerCase() + ' '}pdf\` to get all ${ideas.length} ideas in a styled PDF dossier!_`;
  }

  replyText += `\n\n───────────────────────\n💡 _Commands: \`list week\`, \`list month\`, \`list year\`, \`list all\`, or add \`pdf\` (e.g. \`list month pdf\`) for a downloadable PDF report!_`;

  return replyText;
}

/**
 * Generates an institutional, beautifully styled PDF dossier of market ideas using PDFKit
 */
export async function generateIdeasPdfReport(
  ideas: UnifiedMarketIdea[],
  query: ParsedIdeasQuery
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 32, bottom: 25, left: 36, right: 36 },
      bufferPages: true,
      info: {
        Title: `Trade Compass - Market Ideas Dossier (${query.timeframeLabel})`,
        Author: 'Trade Compass Institutional Intelligence',
        Subject: `Curated Dossier of ${ideas.length} Market Theses and Catalysts`,
        CreationDate: new Date(),
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
      emeraldBorder: '#a7f3d0',
      roseRed: '#dc2626',
      roseBg: '#fef2f2',
      roseBorder: '#fecaca',
      amberGold: '#d97706',
      amberBg: '#fffbeb',
      slateDark: '#1e293b',
      slateMuted: '#64748b',
      slateLight: '#f8fafc',
      cardBorder: '#e2e8f0',
      white: '#ffffff',
    };

    const dateFormatted = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatted = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const bullCount = ideas.filter((i) => i.sentiment === 'BULLISH').length;
    const bearCount = ideas.filter((i) => i.sentiment === 'BEARISH').length;
    const neutralCount = ideas.length - bullCount - bearCount;

    // Unique symbols
    const symCounts = new Map<string, number>();
    for (const item of ideas) {
      for (const s of item.symbols) {
        symCounts.set(s, (symCounts.get(s) || 0) + 1);
      }
    }
    const sortedSyms = Array.from(symCounts.entries()).sort((a, b) => b[1] - a[1]);

    // ==========================================
    // 1. PAGE 1 HEADER BANNER
    // ==========================================
    doc.rect(36, 36, 540, 58).fill(colors.primaryNavy);
    doc.rect(36, 92, 540, 2).fill(colors.accentIndigo);

    // Left title block
    doc.fillColor(colors.white).fontSize(13.5).font('Helvetica-Bold')
      .text('TRADE COMPASS | MARKET IDEAS DOSSIER', 48, 44);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
      .text('Curated Market Catalysts, Theses & Tactical Rationale', 48, 60);

    const filterNote = query.symbolFilter ? ` • Ticker: $${query.symbolFilter}` : '';
    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
      .text(`Scope: ${query.timeframeLabel}${filterNote}`, 48, 73);

    // Right meta badge
    doc.rect(424, 42, 142, 44).fill('#1e293b');
    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
      .text('INSTITUTIONAL DOSSIER', 430, 48, { width: 130, align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica')
      .text(dateFormatted, 430, 60, { width: 130, align: 'right' });
    doc.fillColor('#94a3b8').fontSize(6).font('Helvetica')
      .text(`Generated at ${timeFormatted}`, 430, 71, { width: 130, align: 'right' });

    // ==========================================
    // 2. EXECUTIVE SUMMARY KPI HUD (4 Cards)
    // ==========================================
    const kpiY = 102;
    const cardW = 129;
    const cardH = 44;
    const cardGap = 8;

    const renderKpiCard = (
      x: number,
      title: string,
      val: string,
      sub: string,
      accentColor: string
    ) => {
      doc.rect(x, kpiY, cardW, cardH).fillAndStroke(colors.white, colors.cardBorder);
      doc.rect(x, kpiY, cardW, 2.5).fill(accentColor);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold')
        .text(title.toUpperCase(), x + 8, kpiY + 7);
      doc.fillColor(accentColor).fontSize(13).font('Helvetica-Bold')
        .text(val, x + 8, kpiY + 16);
      doc.fillColor(colors.slateDark).fontSize(5.5).font('Helvetica')
        .text(sub, x + 8, kpiY + 32);
    };

    renderKpiCard(36, 'Total Ideas', `${ideas.length}`, 'Recorded theses & insights', colors.primaryNavy);
    renderKpiCard(36 + (cardW + cardGap), 'Bullish Bias', `${bullCount}`, `${ideas.length > 0 ? Math.round((bullCount / ideas.length) * 100) : 0}% upside catalysts`, colors.emeraldGreen);
    renderKpiCard(36 + (cardW + cardGap) * 2, 'Bearish Bias', `${bearCount}`, `${ideas.length > 0 ? Math.round((bearCount / ideas.length) * 100) : 0}% defensive/short theses`, colors.roseRed);
    renderKpiCard(36 + (cardW + cardGap) * 3, 'Unique Symbols', `${symCounts.size}`, 'Tracked tickers with catalysts', colors.accentCyan);

    // Symbols Bar
    let secY = 154;
    if (sortedSyms.length > 0) {
      doc.rect(36, 154, 540, 20).fillAndStroke(colors.slateLight, colors.cardBorder);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica-Bold')
        .text('TOP TRACKED SYMBOLS:', 44, 160);
      const topSymStr = sortedSyms
        .slice(0, 10)
        .map(([sym, count]) => `$${sym} (${count})`)
        .join('  •  ');
      doc.fillColor(colors.primaryNavy).fontSize(6.5).font('Helvetica-Bold')
        .text(topSymStr, 150, 160, { width: 415 });
      secY = 182;
    }

    // Section title
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('LOGGED MARKET THESES & DD RECORDS', 36, secY);
    doc.rect(36, secY + 13, 540, 0.75).fill(colors.cardBorder);

    let curY = secY + 20;

    // If 0 ideas
    if (ideas.length === 0) {
      doc.rect(36, curY, 540, 75).fillAndStroke(colors.slateLight, colors.cardBorder);
      doc.fillColor(colors.slateDark).fontSize(9).font('Helvetica-Bold')
        .text(`No Market Ideas Found for ${query.timeframeLabel}`, 48, curY + 20);
      doc.fillColor(colors.slateMuted).fontSize(7.5).font('Helvetica')
        .text('To log new theses, share market thoughts or ticker catalysts directly in the Ideas Telegram topic.', 48, curY + 36);
    } else {
      // Loop through all ideas
      for (const item of ideas) {
        const hasTargets = Boolean(item.targetPrice || item.stopLoss || item.entryPrice);
        const textH = Math.min(
          Math.max(doc.heightOfString(item.content, { width: 512, font: 'Helvetica', size: 8 }), 14),
          120
        );
        const cardH = 24 + (hasTargets ? 14 : 0) + textH + 18;

        // Page break if card exceeds bottom margin
        if (curY + cardH > 730) {
          doc.addPage();
          curY = 36;
          doc.rect(36, curY, 540, 22).fill(colors.primaryNavy);
          doc.fillColor(colors.white).fontSize(8).font('Helvetica-Bold')
            .text('TRADE COMPASS | MARKET IDEAS DOSSIER (CONTINUED)', 44, curY + 7);
          doc.fillColor('#38bdf8').fontSize(7).font('Helvetica')
            .text(`Timeframe: ${query.timeframeLabel}`, 400, curY + 7, { width: 168, align: 'right' });
          curY += 30;
        }

        // Accent strip & pill colors
        let accentColor = colors.accentIndigo;
        let badgeBg = colors.slateLight;
        let badgeBorder = colors.cardBorder;
        let badgeColor = colors.slateDark;

        if (item.sentiment === 'BULLISH') {
          accentColor = colors.emeraldGreen;
          badgeBg = colors.emeraldBg;
          badgeBorder = colors.emeraldBorder;
          badgeColor = colors.emeraldGreen;
        } else if (item.sentiment === 'BEARISH') {
          accentColor = colors.roseRed;
          badgeBg = colors.roseBg;
          badgeBorder = colors.roseBorder;
          badgeColor = colors.roseRed;
        } else if (item.sentiment === 'MACRO' || item.sentiment === 'CAUTION') {
          accentColor = colors.accentCyan;
          badgeBg = '#f0f9ff';
          badgeBorder = '#bae6fd';
          badgeColor = colors.accentCyan;
        }

        // Draw Card Container
        doc.roundedRect(36, curY, 540, cardH, 3).fillAndStroke(colors.white, colors.cardBorder);
        doc.rect(36, curY, 4, cardH).fill(accentColor);

        // Sentiment Pill
        doc.roundedRect(46, curY + 6, 52, 13, 2).fillAndStroke(badgeBg, badgeBorder);
        doc.fillColor(badgeColor).fontSize(6.5).font('Helvetica-Bold')
          .text(item.sentiment, 46, curY + 9, { width: 52, align: 'center' });

        // Symbols tag
        let headerX = 104;
        if (item.symbols.length > 0) {
          const symText = item.symbols.map((s) => `$${s}`).join(', ');
          doc.fillColor(colors.primaryNavy).fontSize(8.5).font('Helvetica-Bold')
            .text(symText, headerX, curY + 8);
          headerX += Math.min(item.symbols.length * 40, 140);
        }

        // Title
        doc.fillColor(colors.slateDark).fontSize(8).font('Helvetica-Bold')
          .text(item.title, headerX, curY + 8, { width: 380 - (headerX - 104), lineBreak: false });

        // Date right aligned
        const dateStr =
          item.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
          ' ' +
          item.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
          .text(dateStr, 400, curY + 8, { width: 168, align: 'right' });

        // Targets row (if any)
        let bodyY = curY + 22;
        if (hasTargets) {
          let targetsText = '';
          if (item.entryPrice) targetsText += `Entry: $${item.entryPrice.toFixed(2)}   `;
          if (item.targetPrice) targetsText += `Target: $${item.targetPrice.toFixed(2)}   `;
          if (item.stopLoss) targetsText += `Stop: $${item.stopLoss.toFixed(2)}   `;
          if (item.status) targetsText += `Status: ${item.status}`;

          doc.fillColor(colors.accentIndigo).fontSize(7).font('Helvetica-Bold')
            .text(targetsText, 46, bodyY);
          bodyY += 13;
        }

        // Content
        doc.fillColor(colors.slateDark).fontSize(8).font('Helvetica')
          .text(item.content, 46, bodyY, { width: 520, height: textH, ellipsis: true });

        // Card Footer
        const footY = curY + cardH - 13;
        const tagsStr =
          item.tags && item.tags.length > 0
            ? `Tags: ${item.tags.join(', ')}`
            : `Type: ${item.sourceType === 'TRADE_IDEA' ? 'Trade Compass Idea' : 'Market Observation'}`;
        doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica').text(tagsStr, 46, footY);

        const srcStr = item.sourceType === 'TRADE_IDEA' ? 'Trade Compass Record' : 'Telegram Ideas Topic';
        doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
          .text(srcStr, 400, footY, { width: 168, align: 'right' });

        curY += cardH + 7;
      }
    }

    // Numbered Footers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const footerY = 752;
      doc.rect(36, footerY, 540, 0.75).fill(colors.cardBorder);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text(
          `Trade Compass Market Ideas Dossier • ${query.timeframeLabel} • Institutional Intelligence`,
          36,
          footerY + 6,
          { lineBreak: false }
        );
      doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
        .text(`Page ${i + 1} of ${totalPages}`, 480, footerY + 6, { width: 96, align: 'right', lineBreak: false });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}

/**
 * Handles incoming Ideas topic messages (view recent ideas or log new market thesis)
 */
export async function handleIdeasTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel = 'Mobile',
  timestamp = Date.now(),
}: IdeasTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: IdeasTopicAction;
  ideaCreated?: any;
  pdfGenerated?: boolean;
  ideasCount?: number;
}> {
  const clean = text
    .replace(/#(?:topic:)?ideas?\b/gi, '')
    .replace(/^💡\s*/, '')
    .trim();

  // ==========================================
  // 1. VIEW IDEAS QUERY (with week, month, year, pdf keywords)
  // ==========================================
  const parsedQuery = parseIdeasQuery(clean);

  if (parsedQuery.isQuery) {
    const ideas = await fetchUnifiedIdeas(prisma, {
      cutoffDate: parsedQuery.cutoffDate,
      symbolFilter: parsedQuery.symbolFilter,
    });

    // Check if PDF report requested
    if (parsedQuery.isPdfRequested) {
      try {
        logToFile(`[TelegramIdeas] Generating PDF ideas dossier for timeframe: ${parsedQuery.timeframe}...`);
        const pdfBuffer = await generateIdeasPdfReport(ideas, parsedQuery);

        const dateStr = new Date().toISOString().slice(0, 10);
        const tfSlug = parsedQuery.timeframe.toLowerCase();
        const symSlug = parsedQuery.symbolFilter ? `_${parsedQuery.symbolFilter}` : '';
        const filename = `TradeCompass_Ideas_${tfSlug}${symSlug}_${dateStr}.pdf`;

        const bullCount = ideas.filter((i) => i.sentiment === 'BULLISH').length;
        const bearCount = ideas.filter((i) => i.sentiment === 'BEARISH').length;
        const neutralCount = ideas.length - bullCount - bearCount;

        const symSet = new Set<string>();
        for (const item of ideas) {
          for (const s of item.symbols) {
            symSet.add(s);
          }
        }
        const symsList = Array.from(symSet).slice(0, 6).map((s) => `$${s}`).join(', ');

        const caption =
          `💡 *Trade Compass — Market Ideas Dossier*\n\n` +
          `Attached is your institutional PDF dossier containing *${ideas.length} market ${ideas.length === 1 ? 'idea' : 'ideas'}*.\n` +
          `• *Timeframe:* \`${parsedQuery.timeframeLabel}\`\n` +
          `• *Breakdown:* 🟢 *${bullCount}* Bullish • 🔴 *${bearCount}* Bearish • ⚪ *${neutralCount}* Neutral\n` +
          `• *Tracked Tickers:* ${symsList || 'General Market'}\n\n` +
          `💡 _Send \`list\` to browse in chat, or \`list week\`, \`list month\`, \`list year\` for period filters._`;

        if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
          await sendPdfReportToTelegram(pdfBuffer, filename, caption, {
            chatId,
            messageThreadId,
          }).catch((e: any) => logToFile(`[TelegramIdeas] PDF dispatch error: ${e.message}`));
        }

        return {
          handled: true,
          replyText: caption,
          actionTaken: 'PDF_REPORT',
          pdfGenerated: true,
          ideasCount: ideas.length,
        };
      } catch (pdfErr: any) {
        logToFile(`[TelegramIdeas] PDF generation failed: ${pdfErr.message}. Falling back to text summary.`);
      }
    }

    // Default text summary message
    const replyText = formatIdeasTelegramMessage(ideas, parsedQuery);

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramIdeas] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'VIEW_IDEAS',
      ideasCount: ideas.length,
    };
  }

  // ==========================================
  // 2. LOG NEW MARKET IDEA / THESIS
  // ==========================================
  if (clean.length > 0) {
    const detectedSymbols = extractSymbolsFromText(clean);
    const sentiment = detectSentimentFromText(clean);

    // Check if message requests saving directly to a watchlist via directive
    const hasWatchlistDirective = Boolean(
      clean.match(/#(?:topic:)?(?:watchlist|watch)\b/i) ||
      clean.match(/\+watchlist\b/i) ||
      clean.match(/watchlist:\s*([A-Za-z0-9_\-\s]+)/i)
    );
    const wlMatch = clean.match(/watchlist:\s*([A-Za-z0-9_\-\s]+)/i);
    const specifiedWlName = wlMatch ? wlMatch[1].trim() : undefined;

    let savedWatchlistResult: { added: string[]; watchlistName: string } | null = null;
    if (hasWatchlistDirective && detectedSymbols.length > 0) {
      savedWatchlistResult = await saveSymbolsToWatchlist(prisma, detectedSymbols, specifiedWlName);
    }

    const rawHeadline = createTitleFromText(clean, timestamp).replace(/^📱\s*/, '');
    const title = `💡 Idea: ${rawHeadline}`;

    let ideaTags = `Telegram, Ideas, Mobile, ${senderLabel}`;
    if (savedWatchlistResult || hasWatchlistDirective) {
      ideaTags += ', Watchlist';
    }

    const savedLog = await prisma.thoughtLog.create({
      data: {
        title,
        content: clean,
        folder: 'Ideas',
        tags: ideaTags,
        symbols: detectedSymbols.length > 0 ? detectedSymbols.join(', ') : null,
        sentiment,
        isPinned: false,
        isFulfilled: false,
        agentOutput: `💡 **Market Idea Logged**` + (savedWatchlistResult ? `\n\n📌 Saved to Watchlist "${savedWatchlistResult.watchlistName}": ${savedWatchlistResult.added.map(s => `$${s}`).join(', ')}` : ''),
        agentActionType: 'ADD_CONTEXT',
        marketDataJson: null,
        createdAt: new Date(timestamp),
      },
    });

    const symBadge = detectedSymbols.length > 0 ? `\n• Tracked Symbols: *${detectedSymbols.map(s => `$${s}`).join(', ')}*` : '';
    const wlNote = savedWatchlistResult ? `\n• Watchlist Sync: ✅ Added to *"${savedWatchlistResult.watchlistName}"*` : '';
    const replyText = `💡 *Market Idea Logged*\n\n"${clean.slice(0, 120)}${clean.length > 120 ? '...' : ''}"\n${symBadge}${wlNote}\n• Folder: 📁 *Ideas*\n\n_Send \`ideas\` anytime to view your recent market theses._`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramIdeas] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'CREATE_IDEA',
      ideaCreated: savedLog,
    };
  }

  return {
    handled: false,
    replyText: '',
    actionTaken: 'HELP',
  };
}

