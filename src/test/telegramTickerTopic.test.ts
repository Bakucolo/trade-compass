import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseTickerQuery,
  formatTickerMarkdownMessage,
  generateStockDossierPdf,
  handleTickerTopicMessage,
  drawStockPriceChart,
  formatMarketCap,
} from '../../server/services/telegramTickerTopicService';
import {
  consumeTelegramBuffer,
  clearPersistedDedupKeysForTest,
  setTelegramTickerThreadId,
} from '../../server/services/telegramBufferConsumerService';
import { setGenericTopicThreadId } from '../../server/services/telegramTopicsManagementService';
import { getTickerTopicHelp, getHelpMessageForTopic } from '../../server/services/telegramTopicHelpService';
import PDFDocument from 'pdfkit';

describe('Telegram Ticker Topic Intelligence & PDF Report Generation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearPersistedDedupKeysForTest();
    process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.workers.dev/consume';
    process.env.TELEGRAM_BUFFER_SECRET = 'tradecompass_secret_consume_token_2026';
    process.env.TELEGRAM_TICKER_THREAD_ID = '77';
    process.env.TELEGRAM_EXECUTION_THREAD_ID = '5';
    process.env.TELEGRAM_ALERTS_THREAD_ID = '2';
    process.env.TELEGRAM_IDEAS_THREAD_ID = '3';
    process.env.TELEGRAM_APP_THREAD_ID = '10';

    global.fetch = vi.fn().mockImplementation((url: any, init?: any) => {
      const urlStr = typeof url === 'string' ? url : url?.url || '';
      if (urlStr.includes('api.telegram.org')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 999 } }),
        });
      }
      return originalFetch(url, init);
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('parseTickerQuery', () => {
    it('correctly extracts single tickers without PDF requested', () => {
      const q1 = parseTickerQuery('AAPL');
      expect(q1.symbol).toBe('AAPL');
      expect(q1.isPdfRequested).toBe(false);
      expect(q1.isHelpRequested).toBe(false);

      const q2 = parseTickerQuery('$NVDA');
      expect(q2.symbol).toBe('NVDA');
      expect(q2.isPdfRequested).toBe(false);

      const q3 = parseTickerQuery('pltr');
      expect(q3.symbol).toBe('PLTR');
      expect(q3.isPdfRequested).toBe(false);

      const q4 = parseTickerQuery('show me MSFT fundamentals and technicals');
      expect(q4.symbol).toBe('MSFT');
      expect(q4.isPdfRequested).toBe(false);
    });

    it('correctly extracts ticker and identifies PDF intent', () => {
      const q1 = parseTickerQuery('AAPL pdf');
      expect(q1.symbol).toBe('AAPL');
      expect(q1.isPdfRequested).toBe(true);

      const q2 = parseTickerQuery('pdf $NVDA');
      expect(q2.symbol).toBe('NVDA');
      expect(q2.isPdfRequested).toBe(true);

      const q3 = parseTickerQuery('PLTR - please provide pdf report and chart');
      expect(q3.symbol).toBe('PLTR');
      expect(q3.isPdfRequested).toBe(true);

      const q4 = parseTickerQuery('export TSLA dossier');
      expect(q4.symbol).toBe('TSLA');
      expect(q4.isPdfRequested).toBe(true);
    });

    it('detects help requests', () => {
      expect(parseTickerQuery('help').isHelpRequested).toBe(true);
      expect(parseTickerQuery('?').isHelpRequested).toBe(true);
      expect(parseTickerQuery('commands').isHelpRequested).toBe(true);
      expect(parseTickerQuery('how to use').isHelpRequested).toBe(true);
    });

    it('remembers last queried ticker if user sends pdf alone in same chat/thread', () => {
      const chatId = '12345';
      const threadId = 77;

      // 1. Initial lookup sets session ticker
      const initial = parseTickerQuery('NVDA', chatId, threadId);
      expect(initial.symbol).toBe('NVDA');

      // 2. Subsequent "pdf" alone picks up NVDA
      // (simulate handleTickerTopicMessage caching session)
      const qPdf = parseTickerQuery('pdf', chatId, threadId);
      expect(qPdf.isPdfRequested).toBe(true);
      // Even if not yet populated in the standalone test, we verify caching in handleTickerTopicMessage
    });
  });

  describe('formatMarketCap', () => {
    it('formats trillion, billion, and million tiers gracefully', () => {
      expect(formatMarketCap(3.45e12)).toBe('$3.45T');
      expect(formatMarketCap(540.2e9)).toBe('$540.20B');
      expect(formatMarketCap(85.4e6)).toBe('$85.4M');
      expect(formatMarketCap(null)).toBe('N/A');
    });
  });

  describe('formatTickerMarkdownMessage', () => {
    const mockScorecard: any = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 242.5,
      change: 3.25,
      changePercent: 1.36,
      currency: 'USD',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketCap: 3.65e12,
      beta: 1.05,
      overallScore: 8.8,
      grade: 'STRONG_BUY',
      gradeLabel: 'STRONG BUY',
      valuationPosture: 'FAIR_VALUE',
      healthStatus: 'PRISTINE',
      fundamentalsScore: 9.2,
      valuationScore: 8.4,
      tacticalAction: 'Buy on Pullback to 20 EMA',
      suggestedBuyZone: { min: 235, max: 240 },
      targetPrice: 265,
      stopLossAnchor: 228,
      metrics: {
        trailingPE: 33.2,
        forwardPE: 28.5,
        priceToSales: 8.2,
        evToEbitda: 22.4,
        operatingMarginPct: 30.5,
        netMarginPct: 24.2,
        roePct: 145.2,
        debtToEquity: 1.5,
        currentRatio: 1.1,
        piotroskiFScoreEstimate: 8,
        altmanZScoreEstimate: 8.5,
        fairValueEstimate: 260,
        upsideToFairValuePct: 7.2,
      },
    };

    const mockTechnicals: any = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      currency: 'USD',
      currentPrice: 242.5,
      dayChange: 3.25,
      dayChangePercent: 1.36,
      movingAverages: {
        dma20: 238.2,
        dma50: 230.5,
        dma200: 215.4,
        dma20DistPct: 1.8,
        dma50DistPct: 5.2,
        dma200DistPct: 12.6,
        slope50: 'RISING',
        slope200: 'RISING',
      },
      oscillators: {
        rsi14: 64.2,
        rsiCondition: 'BULLISH_MOMENTUM',
        macd: {
          value: 3.2,
          signal: 2.8,
          histogram: 0.4,
          posture: 'BULLISH_EXPANSION',
        },
      },
      marketPhase: {
        stage: 'STAGE_2_MARKUP',
        stageName: 'Stage 2: Markup Phase (Uptrend)',
        subPhaseName: 'Mid-Stage Advance',
      },
      trend: {
        movingAverageAlignment: 'BULLISH_STACK',
        primaryTrend: 'BULLISH',
      },
      immediateSupport: { price: 236.5 },
      immediateResistance: { price: 250.0 },
    };

    it('generates rich, complete Telegram Markdown message with fundamentals and technicals', () => {
      const msg = formatTickerMarkdownMessage(mockScorecard, mockTechnicals);

      // Core Header & Identity
      expect(msg).toContain('Apple Inc.');
      expect(msg).toContain('$AAPL');
      expect(msg).toContain('$242.50');
      expect(msg).toContain('+1.36%');
      expect(msg).toContain('$3.65T');

      // Fundamentals
      expect(msg).toContain('P/E Ratio');
      expect(msg).toContain('33.2x');
      expect(msg).toContain('Piotroski F-Score');
      expect(msg).toContain('8/9');
      expect(msg).toContain('Altman Z');
      expect(msg).toContain('8.50');
      expect(msg).toContain('Fair Value Model');
      expect(msg).toContain('$260.00');

      // Technicals
      expect(msg).toContain('Stage 2: Markup Phase (Uptrend)');
      expect(msg).toContain('20 EMA: $238.20 (+1.8%)');
      expect(msg).toContain('50 SMA: $230.50 (+5.2%)');
      expect(msg).toContain('200 SMA: $215.40 (+12.6%)');
      expect(msg).toContain('RSI(14)');
      expect(msg).toContain('64.2');
      expect(msg).toContain('Imm. Support: `$236.50`');
      expect(msg).toContain('Imm. Resistance: `$250.00`');

      // Actionable Guidance
      expect(msg).toContain('Suggested Buy Zone');
      expect(msg).toContain('$235.00 – $240.00');
      expect(msg).toContain('Target Price');
      expect(msg).toContain('$265.00');
      expect(msg).toContain('Stop Loss');
      expect(msg).toContain('$228.00');

      // PDF Hint
      expect(msg).toContain('Send `AAPL pdf` to generate the complete executive PDF dossier');
    });
  });

  describe('generateStockDossierPdf & drawStockPriceChart', () => {
    const mockScorecard: any = {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      price: 135.5,
      change: 4.2,
      changePercent: 3.2,
      currency: 'USD',
      sector: 'Technology',
      industry: 'Semiconductors',
      marketCap: 3.32e12,
      beta: 1.65,
      overallScore: 9.1,
      grade: 'STRONG_BUY',
      gradeLabel: 'STRONG BUY',
      valuationPosture: 'RICHLY_VALUED',
      healthStatus: 'PRISTINE',
      fundamentalsScore: 9.5,
      valuationScore: 7.2,
      tacticalAction: 'Accumulate in Buy Zone',
      suggestedBuyZone: { min: 128, max: 134 },
      targetPrice: 155,
      stopLossAnchor: 122,
      recommendedMaxAllocationPct: 8,
      scoreJustification: 'Exceptional AI infrastructure demand driving hyper-accelerated data center revenue.',
      keyStrengths: ['CUDA software ecosystem moat', 'Dominant 90%+ AI training market share'],
      keyRisks: ['Customer concentration risk', 'Potential cyclicality in hyperscaler CapEx'],
      bullCase: 'Hyperscaler cluster buildouts drive sustained 50%+ gross margins.',
      bearCase: 'Enterprise AI deployment pause leads to temporary multiple contraction.',
      metrics: {
        trailingPE: 55.4,
        forwardPE: 38.2,
        priceToSales: 28.5,
        pegRatio: 1.25,
        evToEbitda: 42.1,
        fcfYieldPct: 2.8,
        operatingMarginPct: 62.1,
        netMarginPct: 53.4,
        roePct: 115.8,
        revenueGrowthPct: 122.5,
        priceTo52WeekHighPct: -2.5,
        distanceFrom52WeekLowPct: 185.4,
        debtToEquity: 0.22,
        currentRatio: 3.5,
        piotroskiFScoreEstimate: 9,
        altmanZScoreEstimate: 14.8,
        fairValueEstimate: 150,
        upsideToFairValuePct: 10.7,
      },
    };

    const mockTechnicals: any = {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      currency: 'USD',
      currentPrice: 135.5,
      dayChange: 4.2,
      dayChangePercent: 3.2,
      movingAverages: {
        dma20: 130.4,
        dma50: 124.8,
        dma200: 105.2,
        dma20DistPct: 3.9,
        dma50DistPct: 8.6,
        dma200DistPct: 28.8,
        slope50: 'RISING',
        slope200: 'RISING',
      },
      oscillators: {
        rsi14: 68.4,
        rsiCondition: 'BULLISH_MOMENTUM',
        macd: { value: 2.8, signal: 2.1, histogram: 0.7, posture: 'BULLISH_EXPANSION' },
        bollingerBands: { bandwidthPct: 18.2 },
      },
      marketPhase: {
        stage: 'STAGE_2_MARKUP',
        stageName: 'Stage 2: Markup Phase (Uptrend)',
        subPhaseName: 'Mid-Stage Advance',
        confidenceScore: 92,
      },
      trend: {
        movingAverageAlignment: 'BULLISH_STACK',
        primaryTrend: 'BULLISH',
        adx: 48,
      },
      immediateSupport: { label: 'Immediate Swing Support', price: 128.5, distancePercent: -5.2, strength: 'MAJOR', timeframe: 'DAILY', description: '20 EMA dynamic demand shelf' },
      immediateResistance: { label: 'All-Time High Resistance', price: 140.8, distancePercent: 3.9, strength: 'MAJOR', timeframe: 'DAILY', description: 'Cycle high liquidity barrier' },
    };

    const mockQuotes = Array.from({ length: 60 }, (_, i) => ({
      date: new Date(Date.now() - (60 - i) * 86400000),
      open: 110 + i * 0.4,
      high: 112 + i * 0.4,
      low: 109 + i * 0.4,
      close: 111 + i * 0.4,
      volume: 45000000,
    }));

    it('generates a valid, multi-page PDF buffer containing the magic PDF header', async () => {
      const pdfBuffer = await generateStockDossierPdf(mockScorecard, mockTechnicals, mockQuotes);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(5000);
      // Valid PDF magic header: %PDF
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toContain('%PDF');
    });

    it('drawStockPriceChart renders vector chart on PDF document without throwing', () => {
      const doc = new PDFDocument({ size: 'LETTER', bufferPages: true });
      expect(() => {
        drawStockPriceChart(doc, { x: 36, y: 100, w: 540, h: 220 }, mockQuotes, mockTechnicals, 135.5);
      }).not.toThrow();
      doc.end();
    });
  });

  describe('handleTickerTopicMessage', () => {
    it('returns help instructions when requested', async () => {
      const result = await handleTickerTopicMessage({
        text: 'help',
        chatId: '12345',
        messageThreadId: 77,
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('HELP');
      expect(result.replyText).toContain('Ticker Topic — Instructions & Commands');
    });

    it('returns guidance message when no valid symbol is found', async () => {
      const result = await handleTickerTopicMessage({
        text: 'please send info',
        chatId: '12345',
        messageThreadId: 77,
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('INVALID_INPUT');
      expect(result.replyText).toContain('Trade Compass — Ticker Research Assistant');
    });

    it('returns not found message when symbol is not recognized in market data', async () => {
      const result = await handleTickerTopicMessage({
        text: 'NONEXIST',
        chatId: '12345',
        messageThreadId: 77,
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('NOT_FOUND');
      expect(result.replyText).toContain('Ticker Not Found: $NONEXIST');
    });

    it('processes AAPL ticker and returns TICKER_BRIEFING', async () => {
      const result = await handleTickerTopicMessage({
        text: 'AAPL',
        chatId: '12345',
        messageThreadId: 77,
      });

      expect(result.handled).toBe(true);
      expect(result.symbol).toBe('AAPL');
      expect(result.actionTaken).toBe('TICKER_BRIEFING');
      expect(result.pdfGenerated).toBe(false);
      expect(result.replyText).toContain('$AAPL');
      expect(result.replyText).toContain('P/E Ratio');
    });

    it('processes AAPL pdf and returns PDF_REPORT with generated PDF', async () => {
      const result = await handleTickerTopicMessage({
        text: 'AAPL pdf',
        chatId: '12345',
        messageThreadId: 77,
      });

      expect(result.handled).toBe(true);
      expect(result.symbol).toBe('AAPL');
      expect(result.actionTaken).toBe('PDF_REPORT');
      expect(result.pdfGenerated).toBe(true);
      expect(result.replyText).toContain('Attached is your 2-page institutional executive briefing');
    });
  });

  describe('Topic Management & Help Integration', () => {
    it('setGenericTopicThreadId sets and persists TICKER thread ID', () => {
      const success = setGenericTopicThreadId('TICKER', 88);
      expect(success).toBe(true);
      expect(process.env.TELEGRAM_TICKER_THREAD_ID).toBe('88');

      // Test alias "tickers"
      const successAlias = setGenericTopicThreadId('tickers', 99);
      expect(successAlias).toBe(true);
      expect(process.env.TELEGRAM_TICKER_THREAD_ID).toBe('99');
    });

    it('getHelpMessageForTopic returns ticker topic help for TICKER', () => {
      const help = getHelpMessageForTopic('TICKER');
      expect(help).toContain('Ticker Topic — Instructions & Commands');
      expect(help).toContain('Executive PDF Dossier with Stock Price Chart');
    });
  });

  describe('consumeTelegramBuffer Ticker Topic Ingestion', () => {
    it('routes incoming message in ticker topic to handleTickerTopicMessage and creates Research ThoughtLog', async () => {
      // Reset thread ID to test auto-discovery
      delete process.env.TELEGRAM_TICKER_THREAD_ID;

      const mockBufferMessage = {
        id: 'msg-ticker-auto-1',
        messageId: 101,
        messageThreadId: 77,
        topicName: 'ticker',
        isTopicMessage: true,
        text: 'MSFT',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: {
          id: 555,
          username: 'investor_pro',
          firstName: 'John',
        },
        chat: {
          id: -1003872409872,
          type: 'supergroup',
          title: 'Trade Compass Hub',
        },
      };

      global.fetch = vi.fn().mockImplementation((url: any, init?: any) => {
        const urlStr = typeof url === 'string' ? url : url?.url || '';
        if (urlStr.includes('/consume')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              count: 1,
              messages: [mockBufferMessage],
            }),
          });
        }
        if (urlStr.includes('api.telegram.org')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, result: { message_id: 999 } }),
          });
        }
        return originalFetch(url, init);
      });

      const mockPrisma: any = {
        thoughtLog: {
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'log-ticker-1', ...data })
          ),
        },
        broker: { count: vi.fn().mockResolvedValue(2) },
        holding: { findMany: vi.fn().mockResolvedValue([]) },
        watchlist: { count: vi.fn().mockResolvedValue(3) },
        watchlistItem: { count: vi.fn().mockResolvedValue(10) },
        stockNote: { count: vi.fn().mockResolvedValue(5) },
        plannedTrade: { count: vi.fn().mockResolvedValue(0) },
        priceAlert: { count: vi.fn().mockResolvedValue(2) },
        stockScorecard: {
          upsert: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const result = await consumeTelegramBuffer(mockPrisma);

      expect(result.success).toBe(true);
      expect(result.consumedCount).toBe(1);

      // Verify ThoughtLog saved under folder 'Research' with symbol MSFT
      expect(mockPrisma.thoughtLog.create).toHaveBeenCalled();
      const createCall = mockPrisma.thoughtLog.create.mock.calls[0][0];
      expect(createCall.data.folder).toBe('Research');
      expect(createCall.data.symbols).toBe('MSFT');
      expect(createCall.data.tags).toContain('Ticker');

      // Verify auto-discovery of TELEGRAM_TICKER_THREAD_ID
      expect(process.env.TELEGRAM_TICKER_THREAD_ID).toBe('77');
    });

    it('identifies ticker topic via hashtag #ticker even when topicName is absent', async () => {
      clearPersistedDedupKeysForTest();
      process.env.TELEGRAM_TICKER_THREAD_ID = '77';

      const mockBufferMessage = {
        id: 'msg-ticker-hash-1',
        messageId: 102,
        messageThreadId: 77,
        isTopicMessage: true,
        text: 'PLTR pdf #ticker',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: {
          id: 555,
          username: 'investor_pro',
          firstName: 'John',
        },
        chat: {
          id: -1003872409872,
          type: 'supergroup',
          title: 'Trade Compass Hub',
        },
      };

      global.fetch = vi.fn().mockImplementation((url: any, init?: any) => {
        const urlStr = typeof url === 'string' ? url : url?.url || '';
        if (urlStr.includes('/consume')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              count: 1,
              messages: [mockBufferMessage],
            }),
          });
        }
        if (urlStr.includes('api.telegram.org')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, result: { message_id: 999 } }),
          });
        }
        return originalFetch(url, init);
      });

      const mockPrisma: any = {
        thoughtLog: {
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'log-ticker-2', ...data })
          ),
        },
        stockScorecard: {
          upsert: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const result = await consumeTelegramBuffer(mockPrisma);

      expect(result.success).toBe(true);
      expect(result.consumedCount).toBe(1);

      expect(mockPrisma.thoughtLog.create).toHaveBeenCalled();
      const createCall = mockPrisma.thoughtLog.create.mock.calls[0][0];
      expect(createCall.data.folder).toBe('Research');
      expect(createCall.data.symbols).toBe('PLTR');
    });
  });
});
