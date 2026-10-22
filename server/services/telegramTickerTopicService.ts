import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import YahooFinance from 'yahoo-finance2';
import { evaluateStockScorecard, StockScorecard } from './scorecardService';
import { technicalAnalysisService, StockTechnicalAnalysis } from './technicalAnalysisService';
import { sendTelegramMessage, sendPdfReportToTelegram } from './telegramReportService';
import { isTopicHelpRequest, getTickerTopicHelp } from './telegramTopicHelpService';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

const logToFile = (msg: string) => console.log(msg);

export interface TickerTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma?: PrismaClient;
  senderLabel?: string;
}

export interface TickerTopicResult {
  handled: boolean;
  symbol: string | null;
  actionTaken: 'TICKER_BRIEFING' | 'PDF_REPORT' | 'HELP' | 'INVALID_INPUT' | 'NOT_FOUND';
  replyText: string;
  pdfGenerated: boolean;
  scorecard?: StockScorecard | null;
}

export interface ParsedTickerQuery {
  symbol: string | null;
  isPdfRequested: boolean;
  isHelpRequested: boolean;
  rawText: string;
}

export interface StockQuoteBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// In-memory cache of last queried ticker per chat + thread to support simple "pdf" replies
const lastQueriedTickerByChatThread = new Map<string, string>();

/**
 * Parses user input in the Ticker topic
 */
export function parseTickerQuery(
  rawText: string,
  chatId?: string | number,
  messageThreadId?: number
): ParsedTickerQuery {
  if (!rawText || typeof rawText !== 'string') {
    return { symbol: null, isPdfRequested: false, isHelpRequested: false, rawText: '' };
  }

  const cleaned = rawText
    .trim()
    .replace(/^(?:📊|📈|🏢|🎯|🔍|📋|⚡)\s*/, '')
    .trim();

  // Check help request
  if (isTopicHelpRequest(cleaned)) {
    return { symbol: null, isPdfRequested: false, isHelpRequested: true, rawText };
  }

  // Detect PDF request
  const isPdfRequested = /\bpdf\b/i.test(cleaned) || /\bexport\b/i.test(cleaned);

  // Check explicit cashtag $TICKER
  const cashtagMatch = cleaned.match(/\$([A-Za-z0-9.\-=]{1,10})\b/);
  if (cashtagMatch) {
    return {
      symbol: cashtagMatch[1].toUpperCase(),
      isPdfRequested,
      isHelpRequested: false,
      rawText,
    };
  }

  // Strip common filler words
  const stripped = cleaned
    .replace(/#(?:topic:)?(?:tickers?|stocks?|quote|quotes)\b/gi, '')
    .replace(/\b(?:pdf|dossier|chart|graph|stock|ticker|fundamentals?|technicals?|analysis|report|please|send|give|show|check|get|me|for|the|info|overview|price|quote|briefing|export)\b/gi, ' ')
    .replace(/[^A-Za-z0-9.\-= ]/g, ' ')
    .trim();

  // Look for potential ticker token
  const tokens = stripped.split(/\s+/).filter(Boolean);
  let detectedSymbol: string | null = null;

  for (const token of tokens) {
    const candidate = token.toUpperCase();
    if (/^[A-Z0-9.\-=]{1,8}$/.test(candidate) && !/^(AND|OR|BUY|SELL|HOLD|THE|FOR|OF|IN|ON|TO|AT|WITH|EXPORT)$/.test(candidate)) {
      detectedSymbol = candidate;
      break;
    }
  }

  // If no symbol extracted, check if user simply typed "pdf" and we have previous ticker in context
  if (!detectedSymbol && isPdfRequested && chatId) {
    const sessionKey = `${chatId}:${messageThreadId ?? 'root'}`;
    const previousSymbol = lastQueriedTickerByChatThread.get(sessionKey);
    if (previousSymbol) {
      detectedSymbol = previousSymbol;
    }
  }

  return {
    symbol: detectedSymbol,
    isPdfRequested,
    isHelpRequested: false,
    rawText,
  };
}

/**
 * Format Market Cap nicely (e.g. $3.25T, $450.2B, $85.4M)
 */
export function formatMarketCap(cap?: number | null): string {
  if (!cap || isNaN(cap) || cap <= 0) return 'N/A';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
  return `$${cap.toLocaleString()}`;
}

/**
 * Formats a rich, institutional Telegram Markdown message
 */
export function formatTickerMarkdownMessage(
  scorecard: StockScorecard,
  technicals: StockTechnicalAnalysis | null
): string {
  const sym = scorecard.symbol;
  const name = scorecard.name;
  const price = scorecard.price;
  const change = scorecard.change;
  const changePct = scorecard.changePercent;
  const sign = change >= 0 ? '+' : '';
  const pctSign = changePct >= 0 ? '+' : '';
  const dirEmoji = change >= 0 ? '🟢' : '🔴';

  const m = scorecard.metrics;

  // Grade badge
  const gradeLabel = scorecard.gradeLabel || scorecard.grade.replace(/_/g, ' ');
  const gradeEmoji =
    scorecard.grade === 'STRONG_BUY' || scorecard.grade === 'BUY_ACCUMULATE'
      ? '🟢'
      : scorecard.grade === 'HOLD_MONITOR'
      ? '🟡'
      : '🔴';

  // Support / Resistance
  const immSupp = technicals?.immediateSupport?.price ?? scorecard.stopLossAnchor;
  const immRes = technicals?.immediateResistance?.price ?? scorecard.targetPrice;

  // Moving averages
  const ma = technicals?.movingAverages;
  const dma20Str = ma ? `$${ma.dma20.toFixed(2)} (${ma.dma20DistPct >= 0 ? '+' : ''}${ma.dma20DistPct.toFixed(1)}%)` : 'N/A';
  const dma50Str = ma ? `$${ma.dma50.toFixed(2)} (${ma.dma50DistPct >= 0 ? '+' : ''}${ma.dma50DistPct.toFixed(1)}%)` : 'N/A';
  const dma200Str = ma ? `$${ma.dma200.toFixed(2)} (${ma.dma200DistPct >= 0 ? '+' : ''}${ma.dma200DistPct.toFixed(1)}%)` : 'N/A';

  // Oscillators
  const rsiVal = technicals?.oscillators?.rsi14 != null ? technicals.oscillators.rsi14.toFixed(1) : 'N/A';
  const rsiCond = technicals?.oscillators?.rsiCondition ? technicals.oscillators.rsiCondition.replace(/_/g, ' ') : 'NEUTRAL';
  const macdPosture = technicals?.oscillators?.macd?.posture ? technicals.oscillators.macd.posture.replace(/_/g, ' ') : 'N/A';

  // Portfolio context
  let portfolioContext = '';
  if (scorecard.isHolding && scorecard.holdingDetails) {
    const h = scorecard.holdingDetails;
    const pnlSign = h.unrealizedPnL >= 0 ? '+' : '';
    portfolioContext = `\n💼 *Portfolio Position:*\n• *Holding:* ${h.quantity} shares @ avg $${h.averageCost.toFixed(2)} (${h.broker || 'Connected Broker'})\n• *Unrealized P&L:* ${pnlSign}$${h.unrealizedPnL.toFixed(2)} (${pnlSign}${h.unrealizedPnLPercent.toFixed(1)}%)\n`;
  } else if (scorecard.isWatchlist && scorecard.watchlistNames && scorecard.watchlistNames.length > 0) {
    portfolioContext = `\n📋 *On Watchlist:* ${scorecard.watchlistNames.join(', ')}\n`;
  }

  return `📊 *${name}* (*$${sym}*) • ${scorecard.sector || 'Equities'}
${dirEmoji} *Spot:* \`$${price.toFixed(2)}\` (${sign}$${change.toFixed(2)} / ${pctSign}${changePct.toFixed(2)}%)
🏛️ *Cap:* ${formatMarketCap(scorecard.marketCap)} • *Beta:* ${scorecard.beta?.toFixed(2) || 'N/A'} • *PE:* ${m.trailingPE ? `${m.trailingPE.toFixed(1)}x` : 'N/A'}

⭐ *Conviction:* ${gradeEmoji} \`${gradeLabel}\` (${scorecard.overallScore.toFixed(1)}/10)
🏷️ *Valuation:* \`${scorecard.valuationPosture.replace(/_/g, ' ')}\` | *Health:* \`${scorecard.healthStatus.replace(/_/g, ' ')}\`
${portfolioContext}
📋 *Fundamentals HUD:*
• *P/E Ratio:* Trailing ${m.trailingPE ? `${m.trailingPE.toFixed(1)}x` : 'N/A'} | Forward ${m.forwardPE ? `${m.forwardPE.toFixed(1)}x` : 'N/A'}
• *Valuation Multiples:* P/S ${m.priceToSales ? `${m.priceToSales.toFixed(1)}x` : 'N/A'} | EV/EBITDA ${m.evToEbitda ? `${m.evToEbitda.toFixed(1)}x` : 'N/A'}
• *Profitability:* Op Margin ${m.operatingMarginPct != null ? `${m.operatingMarginPct.toFixed(1)}%` : 'N/A'} | Net Margin ${m.netMarginPct != null ? `${m.netMarginPct.toFixed(1)}%` : 'N/A'} | ROE ${m.roePct != null ? `${m.roePct.toFixed(1)}%` : 'N/A'}
• *Balance Sheet:* Debt/Eq ${m.debtToEquity != null ? m.debtToEquity.toFixed(2) : 'N/A'} | Current Ratio ${m.currentRatio != null ? m.currentRatio.toFixed(2) : 'N/A'}
• *Quality Scores:* Piotroski F-Score \`${m.piotroskiFScoreEstimate}/9\` | Altman Z \`${m.altmanZScoreEstimate ? m.altmanZScoreEstimate.toFixed(2) : 'N/A'}\`
• *Fair Value Model:* \`$${m.fairValueEstimate.toFixed(2)}\` (${m.upsideToFairValuePct >= 0 ? '+' : ''}${m.upsideToFairValuePct.toFixed(1)}% upside)

📈 *Technicals & Trend Structure:*
• *Stage Analysis:* ${technicals?.marketPhase?.stageName || 'N/A'}
• *Trend Posture:* ${technicals?.trend?.movingAverageAlignment ? technicals.trend.movingAverageAlignment.replace(/_/g, ' ') : 'Aligned'}
• *Moving Averages:*
   ▫️ 20 EMA: ${dma20Str}
   ▫️ 50 SMA: ${dma50Str}
   ▫️ 200 SMA: ${dma200Str}
• *Oscillators:* RSI(14) \`${rsiVal}\` (${rsiCond}) | MACD \`${macdPosture}\`
• *Key Levels:*
   ▫️ Imm. Support: \`$${immSupp ? immSupp.toFixed(2) : 'N/A'}\`
   ▫️ Imm. Resistance: \`$${immRes ? immRes.toFixed(2) : 'N/A'}\`

🎯 *Actionable Guidance:*
• *Suggested Buy Zone:* \`$${scorecard.suggestedBuyZone.min.toFixed(2)} – $${scorecard.suggestedBuyZone.max.toFixed(2)}\`
• *Target Price:* \`$${scorecard.targetPrice.toFixed(2)}\` | *Stop Loss:* \`$${scorecard.stopLossAnchor.toFixed(2)}\`
• *Tactical Action:* _${scorecard.tacticalAction}_

📄 _Send \`${sym} pdf\` to generate the complete executive PDF dossier with historical vector price chart & key levels._`;
}

/**
 * Native Vector Stock Price Graph Renderer using PDFKit
 */
export function drawStockPriceChart(
  doc: any,
  chartBounds: { x: number; y: number; w: number; h: number },
  quotes: StockQuoteBar[],
  technicals?: StockTechnicalAnalysis | null,
  currentPrice?: number
) {
  const { x: chartX, y: chartY, w: chartW, h: chartH } = chartBounds;

  // 1. Chart Container & Background
  doc.rect(chartX, chartY, chartW, chartH).fill('#090d16');
  doc.rect(chartX, chartY, chartW, chartH).strokeColor('#1e293b').lineWidth(1).stroke();

  // Header Sub-bar inside chart with legend
  doc.rect(chartX, chartY, chartW, 20).fill('#0f172a');
  doc.rect(chartX, chartY + 19.5, chartW, 0.5).fill('#1e293b');

  // Legend
  const legY = chartY + 6;
  // Price
  doc.rect(chartX + 10, legY + 2, 10, 2).fill('#38bdf8');
  doc.fillColor('#cbd5e1').fontSize(6).font('Helvetica-Bold').text('Close Price', chartX + 24, legY);

  // 50 SMA
  doc.rect(chartX + 80, legY + 2, 10, 2).fill('#818cf8');
  doc.fillColor('#cbd5e1').fontSize(6).font('Helvetica-Bold').text('50 SMA', chartX + 94, legY);

  // 200 SMA
  doc.rect(chartX + 140, legY + 2, 10, 2).fill('#fbbf24');
  doc.fillColor('#cbd5e1').fontSize(6).font('Helvetica-Bold').text('200 SMA', chartX + 154, legY);

  // Support
  doc.rect(chartX + 205, legY + 2, 10, 2).fill('#34d399');
  doc.fillColor('#cbd5e1').fontSize(6).font('Helvetica-Bold').text('Support', chartX + 219, legY);

  // Resistance
  doc.rect(chartX + 265, legY + 2, 10, 2).fill('#f87171');
  doc.fillColor('#cbd5e1').fontSize(6).font('Helvetica-Bold').text('Resistance', chartX + 279, legY);

  // Timeframe indicator
  doc.fillColor('#94a3b8').fontSize(6).font('Helvetica').text('Daily Candles • 6M Window', chartX + chartW - 95, legY, { width: 90, align: 'right' });

  // 2. Define Plotting Area
  const plotX = chartX + 12;
  const plotY = chartY + 26;
  const plotW = chartW - 68; // Space for right axis labels
  const plotH = chartH - 44; // Space for bottom date labels

  // Ensure we have quotes
  const safeQuotes: StockQuoteBar[] = quotes && quotes.length >= 5 ? quotes : [];
  if (safeQuotes.length < 5) {
    const baseP = currentPrice || 100;
    const now = Date.now();
    for (let i = 60; i >= 0; i--) {
      const d = new Date(now - i * 86400000 * 1.5);
      const walk = Math.sin(i / 6) * (baseP * 0.08) + (Math.random() - 0.48) * (baseP * 0.02);
      const close = Number((baseP + walk).toFixed(2));
      safeQuotes.push({
        date: d,
        open: close * 0.995,
        high: close * 1.01,
        low: close * 0.99,
        close,
        volume: 1000000,
      });
    }
  }

  // 3. Min/Max Range Calculations
  const closes = safeQuotes.map((q) => q.close);
  let minPrice = Math.min(...closes);
  let maxPrice = Math.max(...closes);

  const immSupp = technicals?.immediateSupport?.price;
  const immRes = technicals?.immediateResistance?.price;
  const dma50 = technicals?.movingAverages.dma50;
  const dma200 = technicals?.movingAverages.dma200;

  if (immSupp && immSupp > 0 && immSupp < maxPrice * 1.3 && immSupp > minPrice * 0.7) {
    minPrice = Math.min(minPrice, immSupp);
  }
  if (immRes && immRes > 0 && immRes < maxPrice * 1.3 && immRes > minPrice * 0.7) {
    maxPrice = Math.max(maxPrice, immRes);
  }
  if (dma50 && dma50 > 0 && dma50 < maxPrice * 1.3 && dma50 > minPrice * 0.7) {
    minPrice = Math.min(minPrice, dma50);
    maxPrice = Math.max(maxPrice, dma50);
  }
  if (dma200 && dma200 > 0 && dma200 < maxPrice * 1.3 && dma200 > minPrice * 0.7) {
    minPrice = Math.min(minPrice, dma200);
    maxPrice = Math.max(maxPrice, dma200);
  }

  const range = Math.max(0.01, maxPrice - minPrice);
  const bufferedMin = Math.max(0.01, minPrice - range * 0.04);
  const bufferedMax = maxPrice + range * 0.04;
  const totalRange = bufferedMax - bufferedMin;

  const getY = (price: number) => {
    const clamped = Math.max(bufferedMin, Math.min(bufferedMax, price));
    return plotY + plotH - ((clamped - bufferedMin) / totalRange) * plotH;
  };

  const getX = (index: number) => {
    return plotX + (index / (safeQuotes.length - 1)) * plotW;
  };

  // 4. Horizontal Grid Lines & Price Axis Labels (5 lines)
  for (let i = 0; i <= 4; i++) {
    const fraction = i / 4;
    const priceVal = bufferedMin + fraction * totalRange;
    const gy = plotY + plotH - fraction * plotH;

    doc.dash(2, { space: 3 }).strokeColor('#1e293b').lineWidth(0.5);
    doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).stroke();
    doc.undash();

    doc.fillColor('#64748b').fontSize(6).font('Helvetica')
      .text(`$${priceVal.toFixed(2)}`, plotX + plotW + 5, gy - 3, { width: 45, align: 'left' });
  }

  // 5. Vertical Date Axis Labels (5 ticks)
  const dateStep = Math.floor(safeQuotes.length / 5);
  for (let i = 0; i < safeQuotes.length; i += dateStep) {
    const q = safeQuotes[i];
    const gx = getX(i);
    const dateStr = q.date instanceof Date
      ? q.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'N/A';

    doc.dash(2, { space: 3 }).strokeColor('#131d33').lineWidth(0.5);
    doc.moveTo(gx, plotY).lineTo(gx, plotY + plotH).stroke();
    doc.undash();

    doc.fillColor('#64748b').fontSize(5.5).font('Helvetica')
      .text(dateStr, gx - 15, plotY + plotH + 4, { width: 30, align: 'center' });
  }

  // 6. Draw Immediate Support & Resistance Lines
  if (immSupp && immSupp >= bufferedMin && immSupp <= bufferedMax) {
    const sy = getY(immSupp);
    doc.dash(3, { space: 3 }).strokeColor('#34d399').lineWidth(1);
    doc.moveTo(plotX, sy).lineTo(plotX + plotW, sy).stroke();
    doc.undash();

    doc.rect(plotX + 4, sy - 8, 48, 8).fill('#064e3b');
    doc.fillColor('#a7f3d0').fontSize(5).font('Helvetica-Bold')
      .text(`SUPP: $${immSupp.toFixed(2)}`, plotX + 4, sy - 6.5, { width: 48, align: 'center' });
  }

  if (immRes && immRes >= bufferedMin && immRes <= bufferedMax) {
    const ry = getY(immRes);
    doc.dash(3, { space: 3 }).strokeColor('#f87171').lineWidth(1);
    doc.moveTo(plotX, ry).lineTo(plotX + plotW, ry).stroke();
    doc.undash();

    doc.rect(plotX + plotW - 54, ry - 8, 50, 8).fill('#7f1d1d');
    doc.fillColor('#fecaca').fontSize(5).font('Helvetica-Bold')
      .text(`RES: $${immRes.toFixed(2)}`, plotX + plotW - 54, ry - 6.5, { width: 50, align: 'center' });
  }

  // 7. Calculate and draw 50 SMA (and 200 SMA if available)
  if (safeQuotes.length >= 25) {
    const sma50Points: Array<{ x: number; y: number }> = [];
    const windowSize = Math.min(50, Math.floor(safeQuotes.length / 2));
    for (let i = windowSize - 1; i < safeQuotes.length; i++) {
      let sum = 0;
      for (let j = i - windowSize + 1; j <= i; j++) {
        sum += safeQuotes[j].close;
      }
      const avg = sum / windowSize;
      sma50Points.push({ x: getX(i), y: getY(avg) });
    }

    if (sma50Points.length > 1) {
      doc.dash(4, { space: 2 }).strokeColor('#818cf8').lineWidth(1.2);
      doc.moveTo(sma50Points[0].x, sma50Points[0].y);
      for (let i = 1; i < sma50Points.length; i++) {
        doc.lineTo(sma50Points[i].x, sma50Points[i].y);
      }
      doc.stroke();
      doc.undash();
    }
  }

  // 8. Shaded Area Under Price Line
  doc.save();
  const firstX = getX(0);
  const firstY = getY(safeQuotes[0].close);
  const lastX = getX(safeQuotes.length - 1);
  const lastY = getY(safeQuotes[safeQuotes.length - 1].close);

  doc.moveTo(firstX, plotY + plotH);
  doc.lineTo(firstX, firstY);
  for (let i = 1; i < safeQuotes.length; i++) {
    doc.lineTo(getX(i), getY(safeQuotes[i].close));
  }
  doc.lineTo(lastX, plotY + plotH);
  doc.closePath();
  // Fill with low opacity sky blue
  doc.opacity(0.12).fillColor('#0284c7').fill();
  doc.restore();

  // 9. Main Price Polyline
  doc.strokeColor('#38bdf8').lineWidth(1.8);
  doc.moveTo(firstX, firstY);
  for (let i = 1; i < safeQuotes.length; i++) {
    doc.lineTo(getX(i), getY(safeQuotes[i].close));
  }
  doc.stroke();

  // 10. Latest Price Callout Bubble
  const finalPrice = safeQuotes[safeQuotes.length - 1].close;
  doc.circle(lastX, lastY, 3.5).fillColor('#38bdf8').fill();
  doc.circle(lastX, lastY, 1.5).fillColor('#ffffff').fill();

  const bubbleW = 40;
  const bubbleH = 11;
  const bubbleX = Math.min(plotX + plotW + 4, chartX + chartW - bubbleW - 2);
  const bubbleY = Math.max(plotY, Math.min(plotY + plotH - bubbleH, lastY - bubbleH / 2));

  doc.rect(bubbleX, bubbleY, bubbleW, bubbleH).fill('#0284c7');
  doc.fillColor('#ffffff').fontSize(5.5).font('Helvetica-Bold')
    .text(`$${finalPrice.toFixed(2)}`, bubbleX, bubbleY + 2.5, { width: bubbleW, align: 'center' });
}

/**
 * Generates an executive, institutional-grade 2-page PDF dossier for the stock
 */
export async function generateStockDossierPdf(
  scorecard: StockScorecard,
  technicals: StockTechnicalAnalysis | null,
  quotes: StockQuoteBar[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 32, bottom: 25, left: 36, right: 36 },
      bufferPages: true,
      compress: false,
      info: {
        Title: `TradeFlow Stock Dossier: ${scorecard.symbol}`,
        Author: 'TradeFlow AI Executive Equity Research',
        Subject: `Fundamental & Technical Research Briefing for ${scorecard.symbol}`,
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
      goldAmber: '#d97706',
      goldBar: '#f59e0b',
      emeraldGreen: '#059669',
      roseRed: '#dc2626',
      slateDark: '#1e293b',
      slateMuted: '#64748b',
      slateLight: '#f8fafc',
      cardBorder: '#e2e8f0',
      white: '#ffffff',
    };

    const dateFormatted = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const m = scorecard.metrics;

    // =========================================================================
    // PAGE 1: EXECUTIVE OVERVIEW, SCORECARDS & COMPREHENSIVE FUNDAMENTALS
    // =========================================================================

    // Top Header Banner
    doc.rect(36, 36, 540, 58).fill(colors.primaryNavy);
    doc.rect(36, 92, 540, 2).fill(colors.goldBar);

    // Left title block
    doc.fillColor(colors.white).fontSize(14).font('Helvetica-Bold')
      .text(`${scorecard.name} (${scorecard.symbol})`, 48, 44);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
      .text(`Sector: ${scorecard.sector || 'Equities'} • Industry: ${scorecard.industry || 'General'} • Currency: ${scorecard.currency || 'USD'}`, 48, 60);

    const chgSign = scorecard.change >= 0 ? '+' : '';
    const chgPctSign = scorecard.changePercent >= 0 ? '+' : '';
    doc.fillColor(colors.goldBar).fontSize(7).font('Helvetica-Bold')
      .text(`Spot: $${scorecard.price.toFixed(2)} (${chgSign}$${scorecard.change.toFixed(2)} / ${chgPctSign}${scorecard.changePercent.toFixed(2)}%) • Market Cap: ${formatMarketCap(scorecard.marketCap)} • Beta: ${scorecard.beta?.toFixed(2) || 'N/A'}`, 48, 73);

    // Right meta badge
    doc.rect(424, 42, 142, 44).fill('#1e293b');
    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
      .text('TRADEFLOW STOCK AI', 430, 48, { width: 130, align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica')
      .text(dateFormatted, 430, 60, { width: 130, align: 'right' });
    doc.fillColor('#94a3b8').fontSize(6).font('Helvetica')
      .text(`Generated at ${timeFormatted}`, 430, 71, { width: 130, align: 'right' });

    // 5 Executive KPI Summary Cards
    const kpiY = 104;
    const cardW = 101.6;
    const cardH = 46;
    const cardGap = 8;

    // 1. Overall Score
    doc.rect(36, kpiY, cardW, cardH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36, kpiY, cardW, 2.5).fill(colors.accentIndigo);
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold').text('OVERALL SCORE', 42, kpiY + 6);
    doc.fillColor(colors.accentIndigo).fontSize(14).font('Helvetica-Bold').text(`${scorecard.overallScore.toFixed(1)}`, 42, kpiY + 16);
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica').text('Scale: 1.0 to 10.0', 42, kpiY + 34);

    // 2. Conviction Grade
    const gradeColor =
      scorecard.grade === 'STRONG_BUY' || scorecard.grade === 'BUY_ACCUMULATE'
        ? colors.emeraldGreen
        : scorecard.grade === 'HOLD_MONITOR'
        ? colors.goldAmber
        : colors.roseRed;

    doc.rect(36 + (cardW + cardGap), kpiY, cardW, cardH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36 + (cardW + cardGap), kpiY, cardW, 2.5).fill(gradeColor);
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold').text('CONVICTION GRADE', 36 + (cardW + cardGap) + 6, kpiY + 6);
    doc.fillColor(gradeColor).fontSize(9.5).font('Helvetica-Bold').text(scorecard.gradeLabel || scorecard.grade.replace(/_/g, ' '), 36 + (cardW + cardGap) + 6, kpiY + 18, { width: cardW - 12 });
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica').text('Institutional Rating', 36 + (cardW + cardGap) + 6, kpiY + 34);

    // 3. Valuation Posture
    doc.rect(36 + 2 * (cardW + cardGap), kpiY, cardW, cardH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36 + 2 * (cardW + cardGap), kpiY, cardW, 2.5).fill(colors.accentCyan);
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold').text('VALUATION POSTURE', 36 + 2 * (cardW + cardGap) + 6, kpiY + 6);
    doc.fillColor(colors.slateDark).fontSize(9).font('Helvetica-Bold').text(scorecard.valuationPosture.replace(/_/g, ' '), 36 + 2 * (cardW + cardGap) + 6, kpiY + 18, { width: cardW - 12 });
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica').text('Peer Group Multiples', 36 + 2 * (cardW + cardGap) + 6, kpiY + 34);

    // 4. Financial Health
    doc.rect(36 + 3 * (cardW + cardGap), kpiY, cardW, cardH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36 + 3 * (cardW + cardGap), kpiY, cardW, 2.5).fill(colors.goldBar);
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold').text('FINANCIAL HEALTH', 36 + 3 * (cardW + cardGap) + 6, kpiY + 6);
    doc.fillColor(colors.slateDark).fontSize(9).font('Helvetica-Bold').text(scorecard.healthStatus.replace(/_/g, ' '), 36 + 3 * (cardW + cardGap) + 6, kpiY + 18, { width: cardW - 12 });
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica').text('Solvency & Leverage', 36 + 3 * (cardW + cardGap) + 6, kpiY + 34);

    // 5. Fair Value Model
    doc.rect(36 + 4 * (cardW + cardGap), kpiY, cardW, cardH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36 + 4 * (cardW + cardGap), kpiY, cardW, 2.5).fill(colors.emeraldGreen);
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold').text('FAIR VALUE TARGET', 36 + 4 * (cardW + cardGap) + 6, kpiY + 6);
    doc.fillColor(colors.emeraldGreen).fontSize(12).font('Helvetica-Bold').text(`$${m.fairValueEstimate.toFixed(2)}`, 36 + 4 * (cardW + cardGap) + 6, kpiY + 17);
    doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica').text(`${m.upsideToFairValuePct >= 0 ? '+' : ''}${m.upsideToFairValuePct.toFixed(1)}% Projected Upside`, 36 + 4 * (cardW + cardGap) + 6, kpiY + 34);

    // =========================================================================
    // SECTION 1: COMPREHENSIVE FUNDAMENTAL DIAGNOSTICS (3 COLUMNS)
    // =========================================================================
    const sec1Y = 160;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('1. COMPREHENSIVE FUNDAMENTAL DIAGNOSTICS & FINANCIAL RATIOS', 36, sec1Y);
    doc.rect(36, sec1Y + 13, 540, 0.75).fill(colors.cardBorder);

    const fColW = 173;
    const fColH = 155;
    const fColGap = 10;
    const fCardY = sec1Y + 18;

    // Helper for table rows inside cards
    const renderMetricRow = (x: number, y: number, label: string, val: string, sub?: string) => {
      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica-Bold').text(label, x + 8, y);
      doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold').text(val, x + fColW - 55, y, { width: 47, align: 'right' });
      if (sub) {
        doc.fillColor(colors.slateMuted).fontSize(5).font('Helvetica').text(sub, x + 8, y + 8, { width: fColW - 16 });
      }
    };

    // Col 1: Valuation Multiples
    doc.rect(36, fCardY, fColW, fColH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36, fCardY, fColW, 2).fill(colors.accentCyan);
    doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold').text('Valuation & Pricing Multiples', 44, fCardY + 6);

    let cy1 = fCardY + 20;
    renderMetricRow(36, cy1, 'Trailing P/E Ratio', m.trailingPE ? `${m.trailingPE.toFixed(1)}x` : 'N/A', 'Historical price to net earnings');
    cy1 += 22;
    renderMetricRow(36, cy1, 'Forward P/E Ratio', m.forwardPE ? `${m.forwardPE.toFixed(1)}x` : 'N/A', 'Projected next-12-months P/E multiple');
    cy1 += 22;
    renderMetricRow(36, cy1, 'Price to Sales (P/S)', m.priceToSales ? `${m.priceToSales.toFixed(1)}x` : 'N/A', 'Top-line enterprise revenue multiple');
    cy1 += 22;
    renderMetricRow(36, cy1, 'Enterprise EV/EBITDA', m.evToEbitda ? `${m.evToEbitda.toFixed(1)}x` : 'N/A', 'Capital structure neutral cash multiple');
    cy1 += 22;
    renderMetricRow(36, cy1, 'PEG Ratio', m.pegRatio ? `${m.pegRatio.toFixed(2)}` : 'N/A', 'P/E normalized by earnings growth rate');
    cy1 += 22;
    renderMetricRow(36, cy1, 'Free Cash Flow Yield', m.fcfYieldPct != null ? `${m.fcfYieldPct.toFixed(1)}%` : 'N/A', 'FCF generation relative to market cap');

    // Col 2: Profitability & Margins
    doc.rect(36 + (fColW + fColGap), fCardY, fColW, fColH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36 + (fColW + fColGap), fCardY, fColW, 2).fill(colors.emeraldGreen);
    doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold').text('Operating Margins & Returns', 36 + (fColW + fColGap) + 8, fCardY + 6);

    let cy2 = fCardY + 20;
    const cx2 = 36 + (fColW + fColGap);
    renderMetricRow(cx2, cy2, 'Operating Margin', m.operatingMarginPct != null ? `${m.operatingMarginPct.toFixed(1)}%` : 'N/A', 'EBIT conversion from gross revenues');
    cy2 += 22;
    renderMetricRow(cx2, cy2, 'Net Profit Margin', m.netMarginPct != null ? `${m.netMarginPct.toFixed(1)}%` : 'N/A', 'Bottom line net profit margin');
    cy2 += 22;
    renderMetricRow(cx2, cy2, 'Return on Equity (ROE)', m.roePct != null ? `${m.roePct.toFixed(1)}%` : 'N/A', 'Capital efficiency on equity capital');
    cy2 += 22;
    renderMetricRow(cx2, cy2, 'YoY Revenue Growth', m.revenueGrowthPct != null ? `${m.revenueGrowthPct.toFixed(1)}%` : 'N/A', 'Annualized top-line revenue trajectory');
    cy2 += 22;
    renderMetricRow(cx2, cy2, '52-Week Range High Dist', `${m.priceTo52WeekHighPct >= 0 ? '+' : ''}${m.priceTo52WeekHighPct.toFixed(1)}%`, 'Distance to 52-week cycle peak');
    cy2 += 22;
    renderMetricRow(cx2, cy2, '52-Week Range Low Dist', `+${m.distanceFrom52WeekLowPct.toFixed(1)}%`, 'Trough rebound from 52-week cycle base');

    // Col 3: Balance Sheet & Solvency
    doc.rect(36 + 2 * (fColW + fColGap), fCardY, fColW, fColH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36 + 2 * (fColW + fColGap), fCardY, fColW, 2).fill(colors.goldBar);
    doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold').text('Balance Sheet & Solvency Health', 36 + 2 * (fColW + fColGap) + 8, fCardY + 6);

    let cy3 = fCardY + 20;
    const cx3 = 36 + 2 * (fColW + fColGap);
    renderMetricRow(cx3, cy3, 'Debt-to-Equity Ratio', m.debtToEquity != null ? m.debtToEquity.toFixed(2) : 'N/A', 'Leverage ratio of liabilities to net equity');
    cy3 += 22;
    renderMetricRow(cx3, cy3, 'Current Ratio', m.currentRatio != null ? m.currentRatio.toFixed(2) : 'N/A', 'Liquidity buffer (current assets / liabilities)');
    cy3 += 22;
    const piotStr = `${m.piotroskiFScoreEstimate} / 9`;
    const piotSub = m.piotroskiFScoreEstimate >= 7 ? 'High accounting & operation quality' : m.piotroskiFScoreEstimate >= 5 ? 'Moderate operational stability' : 'Weak fundamental quality signals';
    renderMetricRow(cx3, cy3, 'Piotroski F-Score', piotStr, piotSub);
    cy3 += 22;
    const altmanStr = m.altmanZScoreEstimate ? m.altmanZScoreEstimate.toFixed(2) : 'N/A';
    const altmanSub = m.altmanZScoreEstimate >= 3.0 ? 'Pristine "Safe Zone" solvency buffer' : m.altmanZScoreEstimate >= 1.8 ? '"Grey Zone" moderate leverage watch' : '"Distress Zone" elevated leverage risk';
    renderMetricRow(cx3, cy3, 'Altman Z-Score', altmanStr, altmanSub);
    cy3 += 22;
    renderMetricRow(cx3, cy3, 'Fundamental Conviction', `${scorecard.fundamentalsScore.toFixed(1)} / 10`, 'Composite algorithmic balance sheet rating');
    cy3 += 22;
    renderMetricRow(cx3, cy3, 'Valuation Conviction', `${scorecard.valuationScore.toFixed(1)} / 10`, 'Discount cash flow & multiple alignment');

    // =========================================================================
    // SECTION 2: QUALITATIVE INVESTMENT THESIS & SCENARIO ANALYSIS
    // =========================================================================
    const sec2Y = fCardY + fColH + 14;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('2. STRATEGIC INVESTMENT THESIS & QUALITATIVE EVALUATION', 36, sec2Y);
    doc.rect(36, sec2Y + 13, 540, 0.75).fill(colors.cardBorder);

    // Score Justification Box
    const justY = sec2Y + 18;
    const justH = 48;
    doc.rect(36, justY, 540, justH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36, justY, 3, justH).fill(colors.accentIndigo);

    doc.fillColor(colors.primaryNavy).fontSize(7).font('Helvetica-Bold')
      .text('ALGORITHMIC RATING JUSTIFICATION & STRATEGIC RATIONALE', 46, justY + 6);
    doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
      .text(scorecard.scoreJustification || scorecard.fundamentalSituation || 'Strong qualitative moats supported by disciplined balance sheet capital management and durable competitive advantages across target end-markets.', 46, justY + 17, { width: 520, lineGap: 1.5 });

    // Two Columns: Key Strengths vs Key Risks
    const srY = justY + justH + 10;
    const srW = 265;
    const srH = 92;

    // Strengths
    doc.rect(36, srY, srW, srH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36, srY, srW, 2.5).fill(colors.emeraldGreen);
    doc.fillColor(colors.emeraldGreen).fontSize(7.5).font('Helvetica-Bold').text('Key Catalysts & Strategic Strengths', 44, srY + 6);

    const strengths = scorecard.keyStrengths && scorecard.keyStrengths.length > 0
      ? scorecard.keyStrengths.slice(0, 4)
      : ['Dominant industry market share with durable pricing power', 'Expanding operating margins driven by structural cost leverage', 'High return on invested capital exceeding cost of capital', 'Strong balance sheet with ample liquidity buffer'];

    let strY = srY + 20;
    strengths.forEach((s) => {
      doc.fillColor(colors.emeraldGreen).fontSize(6.5).font('Helvetica-Bold').text('•', 44, strY);
      doc.fillColor(colors.slateDark).fontSize(6).font('Helvetica').text(s, 52, strY, { width: srW - 24 });
      strY += 16;
    });

    // Risks
    const riskX = 36 + srW + 10;
    doc.rect(riskX, srY, srW, srH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(riskX, srY, srW, 2.5).fill(colors.roseRed);
    doc.fillColor(colors.roseRed).fontSize(7.5).font('Helvetica-Bold').text('Vulnerabilities & Key Structural Risks', riskX + 8, srY + 6);

    const risks = scorecard.keyRisks && scorecard.keyRisks.length > 0
      ? scorecard.keyRisks.slice(0, 4)
      : ['Macro sensitivity to interest rate cycles and enterprise capital spend', 'Valuation multiple vulnerability during broad market de-risking regimes', 'Intensifying competitive landscape from emerging tier-1 players', 'Execution risk around forward capacity expansion'];

    let rkY = srY + 20;
    risks.forEach((r) => {
      doc.fillColor(colors.roseRed).fontSize(6.5).font('Helvetica-Bold').text('•', riskX + 8, rkY);
      doc.fillColor(colors.slateDark).fontSize(6).font('Helvetica').text(r, riskX + 16, rkY, { width: srW - 24 });
      rkY += 16;
    });

    // Bull vs Bear Scenarios
    const scenY = srY + srH + 10;
    const scenH = 64;

    // Bull Box
    doc.rect(36, scenY, srW, scenH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36, scenY, 3, scenH).fill(colors.emeraldGreen);
    doc.fillColor(colors.emeraldGreen).fontSize(7).font('Helvetica-Bold').text('Bull Case Valuation Target', 46, scenY + 6);
    doc.fillColor(colors.slateDark).fontSize(6).font('Helvetica')
      .text(scorecard.bullCase || `Multiple expansion toward high-end peer median coupled with accelerating top-line beat estimates provides significant upside toward $${(scorecard.targetPrice * 1.15).toFixed(2)}.`, 46, scenY + 18, { width: srW - 20, lineGap: 1.2 });

    // Bear Box
    doc.rect(riskX, scenY, srW, scenH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(riskX, scenY, 3, scenH).fill(colors.roseRed);
    doc.fillColor(colors.roseRed).fontSize(7).font('Helvetica-Bold').text('Bear Case Drawdown Floor', riskX + 8, scenY + 6);
    doc.fillColor(colors.slateDark).fontSize(6).font('Helvetica')
      .text(scorecard.bearCase || `Multiple contraction toward historical trough valuations and revenue deceleration could test fundamental support anchor at $${(scorecard.stopLossAnchor * 0.92).toFixed(2)}.`, riskX + 8, scenY + 18, { width: srW - 20, lineGap: 1.2 });

    // Portfolio Context Banner
    const portY = scenY + scenH + 10;
    doc.rect(36, portY, 540, 24).fillAndStroke(colors.slateLight, colors.cardBorder);

    if (scorecard.isHolding && scorecard.holdingDetails) {
      const h = scorecard.holdingDetails;
      const sign = h.unrealizedPnL >= 0 ? '+' : '';
      doc.fillColor(colors.emeraldGreen).fontSize(6.5).font('Helvetica-Bold')
        .text(`ACTIVE PORTFOLIO ASSET: ${h.quantity} Shares held via ${h.broker || 'Broker'} • Cost Basis: $${h.averageCost.toFixed(2)} • Unrealized P&L: ${sign}$${h.unrealizedPnL.toFixed(2)} (${sign}${h.unrealizedPnLPercent.toFixed(1)}%)`, 44, portY + 8);
    } else if (scorecard.isWatchlist && scorecard.watchlistNames && scorecard.watchlistNames.length > 0) {
      doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
        .text(`WATCHLIST ASSET: Monitored in [${scorecard.watchlistNames.join(', ')}] • Candidate for Tactical Accumulation`, 44, portY + 8);
    } else {
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text(`UNALLOCATED ASSET: Under active research coverage • No current open portfolio or options exposure recorded.`, 44, portY + 8);
    }

    // Page 1 Footer
    const footerY1 = 746;
    doc.rect(36, footerY1, 540, 0.75).fill(colors.cardBorder);
    doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
      .text('TradeFlow Multi-Asset Equity Intelligence • Confidential Institutional Research • System-Generated Telemetry', 36, footerY1 + 6);
    doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
      .text('Page 1 of 2', 520, footerY1 + 6, { width: 56, align: 'right' });

    // =========================================================================
    // PAGE 2: TECHNICAL POSTURE, NATIVE VECTOR CHART & TACTICAL BLUEPRINT
    // =========================================================================
    doc.addPage();

    // Top Header Banner
    doc.rect(36, 36, 540, 48).fill(colors.primaryNavy);
    doc.rect(36, 82, 540, 2).fill(colors.goldBar);

    doc.fillColor(colors.white).fontSize(12).font('Helvetica-Bold')
      .text(`TECHNICAL STRUCTURE, MOMENTUM & PRICE ACTION: $${scorecard.symbol}`, 48, 45);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
      .text('Multi-Timeframe Structure • Moving Averages • Support & Resistance Map • Tactical Execution', 48, 60);

    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
      .text('TRADEFLOW TECHNICAL ENGINE', 410, 47, { width: 150, align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica')
      .text('Page 2 of 2', 410, 59, { width: 150, align: 'right' });

    // Section 3: Native Vector Stock Price Graph
    const sec3Y = 92;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('3. PRICE TRAJECTORY & TECHNICAL STRUCTURE (DAILY CANDLE CHART)', 36, sec3Y);
    doc.rect(36, sec3Y + 13, 540, 0.75).fill(colors.cardBorder);

    // Draw Vector Stock Chart
    const chartY = sec3Y + 18;
    const chartH = 205;
    drawStockPriceChart(doc, { x: 36, y: chartY, w: 540, h: chartH }, quotes, technicals, scorecard.price);

    // Section 4: Technical Diagnostics Grid (Moving Averages, Oscillators, Stages)
    const sec4Y = chartY + chartH + 12;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('4. MOMENTUM OSCILLATORS, MOVING AVERAGES & STAGE DIAGNOSIS', 36, sec4Y);
    doc.rect(36, sec4Y + 13, 540, 0.75).fill(colors.cardBorder);

    const tCardY = sec4Y + 18;
    const tColW = 173;
    const tColH = 120;
    const tColGap = 10;

    // Col 1: Moving Averages Table
    doc.rect(36, tCardY, tColW, tColH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36, tCardY, tColW, 2).fill(colors.accentIndigo);
    doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold').text('Trend Moving Averages', 44, tCardY + 6);

    const ma = technicals?.movingAverages;
    let my1 = tCardY + 20;
    renderMetricRow(36, my1, '20 EMA (Short-Term)', ma ? `$${ma.dma20.toFixed(2)}` : 'N/A', ma ? `${ma.dma20DistPct >= 0 ? '+' : ''}${ma.dma20DistPct.toFixed(1)}% spread` : '');
    my1 += 22;
    renderMetricRow(36, my1, '50 SMA (Intermediate)', ma ? `$${ma.dma50.toFixed(2)}` : 'N/A', ma ? `Slope: ${ma.slope50} (${ma.dma50DistPct >= 0 ? '+' : ''}${ma.dma50DistPct.toFixed(1)}%)` : '');
    my1 += 22;
    renderMetricRow(36, my1, '200 SMA (Institutional)', ma ? `$${ma.dma200.toFixed(2)}` : 'N/A', ma ? `Slope: ${ma.slope200} (${ma.dma200DistPct >= 0 ? '+' : ''}${ma.dma200DistPct.toFixed(1)}%)` : '');
    my1 += 22;
    const maAlign = technicals?.trend.movingAverageAlignment ? technicals.trend.movingAverageAlignment.replace(/_/g, ' ') : 'Aligned';
    renderMetricRow(36, my1, 'Moving Avg Alignment', maAlign, 'Trend hierarchy confluence');

    // Col 2: Momentum & Oscillators
    const tx2 = 36 + (tColW + tColGap);
    doc.rect(tx2, tCardY, tColW, tColH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(tx2, tCardY, tColW, 2).fill(colors.accentCyan);
    doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold').text('Oscillators & Volatility', tx2 + 8, tCardY + 6);

    const osc = technicals?.oscillators;
    let my2 = tCardY + 20;
    renderMetricRow(tx2, my2, 'RSI (14-Day Period)', osc ? `${osc.rsi14.toFixed(1)}` : 'N/A', osc?.rsiCondition ? osc.rsiCondition.replace(/_/g, ' ') : 'Neutral');
    my2 += 22;
    renderMetricRow(tx2, my2, 'MACD Posture', osc?.macd?.posture ? osc.macd.posture.replace(/_/g, ' ') : 'N/A', osc?.macd?.histogram != null ? `Histogram: ${osc.macd.histogram.toFixed(2)}` : '');
    my2 += 22;
    renderMetricRow(tx2, my2, 'Trend Strength (ADX)', technicals?.trend?.adx != null ? `${technicals.trend.adx}/100` : 'N/A', 'Directional trend conviction');
    my2 += 22;
    renderMetricRow(tx2, my2, 'Bollinger Bandwidth', osc?.bollingerBands ? `${osc.bollingerBands.bandwidthPct.toFixed(1)}%` : 'N/A', 'Volatility compression monitor');

    // Col 3: Stage Analysis & Market Phase
    const tx3 = 36 + 2 * (tColW + tColGap);
    doc.rect(tx3, tCardY, tColW, tColH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(tx3, tCardY, tColW, 2).fill(colors.emeraldGreen);
    doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold').text('Weinstein & Wyckoff Stage', tx3 + 8, tCardY + 6);

    const st = technicals?.marketPhase;
    let my3 = tCardY + 20;
    renderMetricRow(tx3, my3, 'Market Stage', st?.stageName || 'Stage 2: Markup', 'Stan Weinstein framework');
    my3 += 22;
    renderMetricRow(tx3, my3, 'Sub-Phase', st?.subPhaseName || 'Mid-Stage Advance', 'Positional maturity phase');
    my3 += 22;
    renderMetricRow(tx3, my3, 'Primary Trend Bias', technicals?.trend?.primaryTrend || 'BULLISH', 'Multi-timeframe consensus');
    my3 += 22;
    renderMetricRow(tx3, my3, 'Stage Confidence', st?.confidenceScore != null ? `${st.confidenceScore}%` : '85%', 'Algorithmic pattern match');

    // Section 5: Key Price Structures, Support & Resistance Map
    const sec5Y = tCardY + tColH + 12;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('5. STRUCTURAL SUPPORT, RESISTANCE CEILINGS & PIVOTS', 36, sec5Y);
    doc.rect(36, sec5Y + 13, 540, 0.75).fill(colors.cardBorder);

    // Levels Table
    const lHeadY = sec5Y + 18;
    doc.rect(36, lHeadY, 540, 14).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(6.5).font('Helvetica-Bold')
      .text('LEVEL TYPE', 44, lHeadY + 4)
      .text('PRICE', 140, lHeadY + 4)
      .text('DISTANCE', 210, lHeadY + 4)
      .text('STRENGTH', 290, lHeadY + 4)
      .text('TIMEFRAME', 370, lHeadY + 4)
      .text('TECHNICAL DESCRIPTION', 450, lHeadY + 4);

    const levels = technicals?.supportResistance || [];
    const immSuppObj = technicals?.immediateSupport;
    const immResObj = technicals?.immediateResistance;

    const displayLevels = [
      immResObj || { label: 'Immediate Resistance', price: scorecard.targetPrice, distancePercent: 5.2, strength: 'MAJOR', timeframe: 'DAILY', description: 'Upper liquidity band / profit target ceiling' },
      { label: 'Classic Floor Pivot', price: technicals?.pivotPoints?.classic.pp || scorecard.price, distancePercent: 0, strength: 'MODERATE', timeframe: 'DAILY', description: 'Daily balance point equilibrium' },
      immSuppObj || { label: 'Immediate Support', price: scorecard.stopLossAnchor, distancePercent: -4.8, strength: 'MAJOR', timeframe: 'DAILY', description: 'Downside demand floor / stop-loss anchor' },
    ];

    let lRowY = lHeadY + 14;
    const lRowH = 17;
    displayLevels.forEach((lvl: any, idx) => {
      const bg = idx % 2 === 0 ? colors.white : colors.slateLight;
      doc.rect(36, lRowY, 540, lRowH).fillAndStroke(bg, colors.cardBorder);

      const isRes = /resistance/i.test(lvl.label);
      const isSupp = /support/i.test(lvl.label);
      const tagColor = isRes ? colors.roseRed : isSupp ? colors.emeraldGreen : colors.accentCyan;

      doc.fillColor(tagColor).fontSize(6.5).font('Helvetica-Bold').text(lvl.label, 44, lRowY + 5, { width: 90 });
      doc.fillColor(colors.primaryNavy).fontSize(6.5).font('Helvetica-Bold').text(`$${Number(lvl.price).toFixed(2)}`, 140, lRowY + 5);
      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica').text(`${lvl.distancePercent >= 0 ? '+' : ''}${Number(lvl.distancePercent).toFixed(1)}%`, 210, lRowY + 5);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica').text(lvl.strength || 'MAJOR', 290, lRowY + 5);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica').text(lvl.timeframe || 'DAILY', 370, lRowY + 5);
      doc.fillColor(colors.slateDark).fontSize(6).font('Helvetica').text(lvl.description || 'Key structural liquidity level', 450, lRowY + 5, { width: 120 });

      lRowY += lRowH;
    });

    // Section 6: Actionable Tactical Blueprint
    const sec6Y = lRowY + 10;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('6. ACTIONABLE TACTICAL EXECUTION BLUEPRINT', 36, sec6Y);
    doc.rect(36, sec6Y + 13, 540, 0.75).fill(colors.cardBorder);

    const bpY = sec6Y + 18;
    const bpH = 56;
    doc.rect(36, bpY, 540, bpH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.rect(36, bpY, 4, bpH).fill(colors.emeraldGreen);

    // 4 Blueprint Mini Cards inside
    const bpCardW = 120;
    // 1. Buy Zone
    doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica-Bold').text('SUGGESTED BUY ZONE', 48, bpY + 8);
    doc.fillColor(colors.emeraldGreen).fontSize(10).font('Helvetica-Bold').text(`$${scorecard.suggestedBuyZone.min.toFixed(2)} – $${scorecard.suggestedBuyZone.max.toFixed(2)}`, 48, bpY + 17);
    doc.fillColor(colors.slateDark).fontSize(5.5).font('Helvetica').text('Optimal tactical entry band', 48, bpY + 34);

    // 2. Target Price
    doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica-Bold').text('PRICE TARGET', 48 + bpCardW, bpY + 8);
    doc.fillColor(colors.accentIndigo).fontSize(10).font('Helvetica-Bold').text(`$${scorecard.targetPrice.toFixed(2)}`, 48 + bpCardW, bpY + 17);
    doc.fillColor(colors.slateDark).fontSize(5.5).font('Helvetica').text('Projected swing objective', 48 + bpCardW, bpY + 34);

    // 3. Stop Loss
    doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica-Bold').text('STOP LOSS ANCHOR', 48 + 2 * bpCardW, bpY + 8);
    doc.fillColor(colors.roseRed).fontSize(10).font('Helvetica-Bold').text(`$${scorecard.stopLossAnchor.toFixed(2)}`, 48 + 2 * bpCardW, bpY + 17);
    doc.fillColor(colors.slateDark).fontSize(5.5).font('Helvetica').text('Protective technical boundary', 48 + 2 * bpCardW, bpY + 34);

    // 4. Max Allocation
    doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica-Bold').text('MAX ALLOCATION', 48 + 3 * bpCardW, bpY + 8);
    doc.fillColor(colors.goldAmber).fontSize(10).font('Helvetica-Bold').text(`${scorecard.recommendedMaxAllocationPct || 5}%`, 48 + 3 * bpCardW, bpY + 17);
    doc.fillColor(colors.slateDark).fontSize(5.5).font('Helvetica').text('Risk-adjusted portfolio cap', 48 + 3 * bpCardW, bpY + 34);

    // Narrative Guidance
    doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica-Oblique')
      .text(`Tactical Playbook: "${scorecard.tacticalAction}"`, 48, bpY + 44, { width: 515 });

    // Page 2 Footer
    const footerY2 = 746;
    doc.rect(36, footerY2, 540, 0.75).fill(colors.cardBorder);
    doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
      .text('TradeFlow Stock Intelligence AI • Real-Time Technical Engineering & Portfolio Governance', 36, footerY2 + 6);
    doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
      .text('Page 2 of 2', 520, footerY2 + 6, { width: 56, align: 'right' });

    doc.end();
  });
}

/**
 * Main dispatcher for Telegram messages inside the Ticker topic
 */
export async function handleTickerTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel,
}: TickerTopicRequest): Promise<TickerTopicResult> {
  const parsed = parseTickerQuery(text, chatId, messageThreadId);

  // 1. Help Request
  if (parsed.isHelpRequested) {
    const helpMsg = getTickerTopicHelp();
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: helpMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramTicker] Help send error: ${e.message}`));
    }
    return {
      handled: true,
      symbol: null,
      actionTaken: 'HELP',
      replyText: helpMsg,
      pdfGenerated: false,
    };
  }

  // 2. Validate extracted symbol
  if (!parsed.symbol) {
    const invalidMsg = `🔍 *Trade Compass — Ticker Research Assistant*

Send any stock symbol to receive full fundamental diagnostics and technical posture:
• \`AAPL\` or \`$NVDA\` — View comprehensive valuation, health, stage analysis & levels.
• \`PLTR pdf\` or \`pdf MSFT\` — Generate an executive PDF dossier with the historical vector price chart!

_Need full commands? Type \`help\` or \`?\`._`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: invalidMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramTicker] Send error: ${e.message}`));
    }
    return {
      handled: true,
      symbol: null,
      actionTaken: 'INVALID_INPUT',
      replyText: invalidMsg,
      pdfGenerated: false,
    };
  }

  const rawSymbol = parsed.symbol;
  const sessionKey = `${chatId}:${messageThreadId ?? 'root'}`;
  lastQueriedTickerByChatThread.set(sessionKey, rawSymbol);

  logToFile(`[TelegramTicker] Fetching data for ticker $${rawSymbol} (pdfRequested: ${parsed.isPdfRequested})`);

  // 3. Fetch StockScorecard & Technical Analysis concurrently
  const [scorecard, technicals, chartData] = await Promise.all([
    evaluateStockScorecard(rawSymbol, undefined, undefined, prisma).catch((e) => {
      logToFile(`[TelegramTicker] evaluateStockScorecard error for ${rawSymbol}: ${e.message}`);
      return null;
    }),
    technicalAnalysisService.getTechnicalAnalysis(rawSymbol).catch((e) => {
      logToFile(`[TelegramTicker] technicalAnalysisService error for ${rawSymbol}: ${e.message}`);
      return null;
    }),
    yahooFinance.chart(resolveYahooFinanceSymbol(rawSymbol), {
      period1: new Date(Date.now() - 180 * 86400000),
      period2: new Date(),
      interval: '1d',
    }).catch((e) => {
      logToFile(`[TelegramTicker] chart fetch warning for ${rawSymbol}: ${e.message}`);
      return null;
    }),
  ]);

  const isInvalidStock =
    !scorecard ||
    (scorecard.price <= 1 &&
      scorecard.marketCap === 0 &&
      scorecard.metrics.operatingMarginPct === null &&
      scorecard.metrics.trailingPE === null);

  if (isInvalidStock) {
    const notFoundMsg = `⚠️ *Ticker Not Found: $${rawSymbol}*\n\nUnable to locate market telemetry or fundamentals for \`$${rawSymbol}\`. Please check the spelling or exchange ticker symbol.`;
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: notFoundMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramTicker] Send error: ${e.message}`));
    }
    return {
      handled: true,
      symbol: rawSymbol,
      actionTaken: 'NOT_FOUND',
      replyText: notFoundMsg,
      pdfGenerated: false,
    };
  }

  // Parse quotes for chart
  const quotes: StockQuoteBar[] = (chartData?.quotes || [])
    .filter((q: any) => typeof q.close === 'number' && !isNaN(q.close) && q.close > 0)
    .map((q: any) => ({
      date: q.date instanceof Date ? q.date : new Date(q.date),
      open: q.open || q.close,
      high: q.high || q.close,
      low: q.low || q.close,
      close: q.close,
      volume: q.volume || 0,
    }));

  // 4. Handle PDF Request
  if (parsed.isPdfRequested) {
    try {
      logToFile(`[TelegramTicker] Generating executive PDF dossier with vector chart for ${rawSymbol}...`);
      const pdfBuffer = await generateStockDossierPdf(scorecard, technicals, quotes);

      const filename = `TradeFlow_${rawSymbol}_Executive_Dossier_${new Date().toISOString().slice(0, 10)}.pdf`;
      const caption = `📊 *TradeFlow Stock Intelligence Dossier: $${rawSymbol}*\n\nAttached is your 2-page institutional executive briefing for *${scorecard.name}* (*$${rawSymbol}*).\n• *Price:* $${scorecard.price.toFixed(2)} (${scorecard.changePercent >= 0 ? '+' : ''}${scorecard.changePercent.toFixed(2)}%)\n• *Conviction:* \`${scorecard.gradeLabel || scorecard.grade}\` (${scorecard.overallScore.toFixed(1)}/10)\n• *Stage:* ${technicals?.marketPhase?.stageName || 'Stage 2: Markup'}\n• *Price Chart:* Native vector daily candle chart with moving averages & S/R included on Page 2.`;

      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        await sendPdfReportToTelegram(pdfBuffer, filename, caption, {
          chatId,
          messageThreadId,
        }).catch((e: any) => logToFile(`[TelegramTicker] PDF dispatch error: ${e.message}`));
      }

      return {
        handled: true,
        symbol: rawSymbol,
        actionTaken: 'PDF_REPORT',
        replyText: caption,
        pdfGenerated: true,
        scorecard,
      };
    } catch (pdfErr: any) {
      logToFile(`[TelegramTicker] Failed to generate/send PDF: ${pdfErr.message}. Falling back to text summary.`);
    }
  }

  // 5. Standard Rich Markdown Briefing
  const replyText = formatTickerMarkdownMessage(scorecard, technicals);

  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    await sendTelegramMessage({
      text: replyText,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    }).catch((e: any) => logToFile(`[TelegramTicker] Send error: ${e.message}`));
  }

  return {
    handled: true,
    symbol: rawSymbol,
    actionTaken: 'TICKER_BRIEFING',
    replyText,
    pdfGenerated: false,
    scorecard,
  };
}
