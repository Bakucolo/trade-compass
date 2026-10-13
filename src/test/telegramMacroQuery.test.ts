import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseMacroQuery,
  formatMacroTelegramMessage,
  generateMacroPdfBuffer,
  getMacroReportData,
  handleMacroTopicMessage,
} from '../../server/services/telegramMacroQueryService';
import {
  getMacroTopicHelp,
  getHelpMessageForTopic,
  getGeneralTopicDirectoryHelp,
} from '../../server/services/telegramTopicHelpService';
import {
  setTelegramMacroThreadId,
  getTelegramBufferStatus,
} from '../../server/services/telegramBufferConsumerService';
import {
  setGenericTopicThreadId,
  buildTopicsOverviewReport,
} from '../../server/services/telegramTopicsManagementService';
import { MacroDossierResult } from '../../server/services/macroDossierService';

// Mock telegram report service dispatchers
vi.mock('../../server/services/telegramReportService', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ success: true, messageId: 101 }),
  sendPdfReportToTelegram: vi.fn().mockResolvedValue({ success: true, messageId: 102 }),
}));

describe('Telegram Macro Query & PDF Service', () => {
  const mockDossier: MacroDossierResult = {
    id: 'test-dossier-01',
    title: 'TradeFlow Global Macro Intelligence Dossier',
    regimeTitle: 'Resilient Expansion / Late-Cycle Goldilocks',
    regimeTone: 'bullish',
    macroScore: 78,
    growthOutlook: 'EXPANSIONARY',
    inflationRegime: 'DISINFLATION',
    monetaryPolicyPosture: 'NEUTRAL_PAUSE',
    liquidityCondition: 'EXPANDING',
    vixLevel: 14.85,
    yield10y: 4.22,
    spread2y10y: 0.38,
    dxyLevel: 103.4,
    oilPrice: 70.8,
    fedFundsRate: 4.83,
    highYieldSpread: 3.08,
    executiveSummary:
      'Global macroeconomic conditions remain supportive with disciplined disinflation, positive real wage gains, and orderly sovereign curve steepening.',
    narrativeOverview:
      'US consumers remain resilient with prime balance sheets. Liquidity conditions are turning accommodative following central bank rate adjustments.',
    keyTakeaways: [
      'Macro Health Score at 78/100 denotes strong macro stability.',
      '10-Year yield stable at 4.22% with healthy positive +38 bps 2s10s spread.',
      'Contango in VIX futures supports systematic options premium selling.',
    ],
    pillars: [
      {
        id: 'sovereign_yields',
        name: 'Sovereign Yields & Bond Curve',
        status: 'BENIGN',
        summary: 'Curve slope positive without primary dealer absorption constraints.',
        strategicImplications: 'Favor intermediate duration.',
        keyMetrics: [{ label: '10Y Yield', value: '4.22%', interpretation: 'Anchored' }],
      },
      {
        id: 'labor_market',
        name: 'Labor Market & Consumer Resilience',
        status: 'BENIGN',
        summary: 'Full employment balance with stable jobless claims.',
        strategicImplications: 'Equities maintain firm footing.',
        keyMetrics: [{ label: 'Unemployment', value: '4.1%', interpretation: 'Balanced' }],
      },
      {
        id: 'inflation_dynamics',
        name: 'Inflation Dynamics & Price Stability',
        status: 'BENIGN',
        summary: 'Core inflation descending toward long-term targets.',
        strategicImplications: 'Rate cut pathway intact.',
        keyMetrics: [{ label: 'Core PCE', value: '2.6%', interpretation: 'Controlled' }],
      },
      {
        id: 'central_bank_liquidity',
        name: 'Central Bank Liquidity & Fed Policy',
        status: 'STIMULATIVE',
        summary: 'Global liquidity expanding as central banks cut policy rates.',
        strategicImplications: 'Positive liquidity tailwind for equities.',
        keyMetrics: [{ label: 'Fed Funds', value: '4.83%', interpretation: 'Easing cycle' }],
      },
      {
        id: 'corporate_earnings',
        name: 'Corporate Earnings & Credit Spreads',
        status: 'BENIGN',
        summary: 'Tight high-yield credit spreads and solid earnings growth.',
        strategicImplications: 'Low near-term corporate default risk.',
        keyMetrics: [{ label: 'HY Spread', value: '3.08%', interpretation: 'Tight' }],
      },
      {
        id: 'volatility_complex',
        name: 'Volatility Complex, Skew & Fear',
        status: 'BENIGN',
        summary: 'VIX at 14.85 with steep contango term structure.',
        strategicImplications: 'Sell 30-45 DTE options to harvest positive VRP.',
        keyMetrics: [{ label: 'VIX Spot', value: '14.85', interpretation: 'Complacent' }],
      },
      {
        id: 'real_assets_fx',
        name: 'Real Assets, Commodities & FX Regimes',
        status: 'CAUTION',
        summary: 'Gold consolidating near highs; oil range-bound around $70.',
        strategicImplications: 'Hold physical gold allocation as fiscal hedge.',
        keyMetrics: [{ label: 'Gold', value: '$2,735', interpretation: 'Structural bull' }],
      },
    ],
    scenarios: [
      {
        id: 'base_case',
        title: 'Soft Landing (Base Case)',
        probabilityPercent: 60,
        description: 'Controlled disinflation and steady 2.2% GDP growth.',
        keyTriggers: ['Core CPI < 3.0%', 'Jobless claims steady'],
        winners: ['Quality Tech (QQQ)', 'Intermediate Bonds (IEI)'],
        losers: ['Defensive Utilities (XLU)', 'Cash'],
        strategicAction: 'Harvest theta with covered calls and CSPs.',
      },
      {
        id: 'bull_reflation',
        title: 'Productivity Boom (Bull Case)',
        probabilityPercent: 25,
        description: 'AI productivity accelerates corporate margins.',
        keyTriggers: ['Earnings growth > 12%'],
        winners: ['Semiconductors (SMH)', 'Small Caps (IWM)'],
        losers: ['Long Treasuries (TLT)'],
        strategicAction: 'Overweight small-cap cyclicals.',
      },
      {
        id: 'bear_shock',
        title: 'Stagflation Shock (Bear Case)',
        probabilityPercent: 15,
        description: 'Commodity spikes reignite inflation.',
        keyTriggers: ['Oil > $95'],
        winners: ['Gold (GLD)', 'Energy (XLE)'],
        losers: ['High-P/E Tech', 'Duration'],
        strategicAction: 'Allocate 10% collar protection.',
      },
    ],
    tacticalAllocations: [
      {
        category: 'Equities',
        subAsset: 'Large-Cap Quality & Semi Leaders',
        stance: 'OVERWEIGHT',
        rationale: 'Robust cash flows and AI capex spending cycle.',
        recommendedVehicles: ['SPY', 'QQQ', 'NVDA'],
        riskLevel: 'MEDIUM',
      },
      {
        category: 'Fixed Income / Duration',
        subAsset: 'Intermediate Treasuries',
        stance: 'NEUTRAL',
        rationale: 'Favorable yield capture with protected duration downside.',
        recommendedVehicles: ['IEF', 'SHY'],
        riskLevel: 'LOW',
      },
      {
        category: 'Commodities & Real Assets',
        subAsset: 'Physical Gold & Energy',
        stance: 'OVERWEIGHT',
        rationale: 'Hedge against fiat debasement and geopolitical risk.',
        recommendedVehicles: ['GLD', 'XLE'],
        riskLevel: 'MEDIUM',
      },
      {
        category: 'Currencies & Cash',
        subAsset: 'USD & 4-Week T-Bills',
        stance: 'NEUTRAL',
        rationale: 'Dry powder yield around 4.8%.',
        recommendedVehicles: ['BIL', 'SGOV'],
        riskLevel: 'LOW',
      },
      {
        category: 'Derivatives & Hedging',
        subAsset: 'OTM Put Spreads',
        stance: 'TACTICAL_HEDGE',
        rationale: 'Cheap volatility allows low-cost tail hedging.',
        recommendedVehicles: ['SPY Put Spreads'],
        riskLevel: 'MEDIUM',
      },
    ],
    catalystsRadar: [
      {
        id: 'fomc',
        title: 'FOMC Interest Rate Decision',
        category: 'MONETARY_POLICY',
        timeframe: 'Next 3 Weeks',
        potentialImpact: 'CRITICAL',
        whatToWatch: 'Dot plot revisions and neutral rate commentary.',
        criticalPivotLevel: '10Y Yield 4.40%',
      },
      {
        id: 'cpi',
        title: 'Consumer Price Index (CPI)',
        category: 'INFLATION_DATA',
        timeframe: 'Mid-Month',
        potentialImpact: 'CRITICAL',
        whatToWatch: 'Supercore services disinflation.',
        criticalPivotLevel: 'Core CPI 3.3%',
      },
    ],
    createdAt: new Date().toISOString(),
  };

  // ==========================================
  // 1. QUERY PARSING TESTS
  // ==========================================
  describe('parseMacroQuery()', () => {
    it('parses full report requests without pdf', () => {
      expect(parseMacroQuery('macro').intent).toBe('FULL_REPORT');
      expect(parseMacroQuery('macro').isPdfRequested).toBe(false);

      expect(parseMacroQuery('report').intent).toBe('FULL_REPORT');
      expect(parseMacroQuery('dossier').intent).toBe('FULL_REPORT');
      expect(parseMacroQuery('overview').intent).toBe('FULL_REPORT');
      expect(parseMacroQuery('').intent).toBe('FULL_REPORT');
    });

    it('detects pdf keyword across various phrasing', () => {
      const q1 = parseMacroQuery('pdf');
      expect(q1.intent).toBe('FULL_REPORT');
      expect(q1.isPdfRequested).toBe(true);

      const q2 = parseMacroQuery('macro pdf');
      expect(q2.intent).toBe('FULL_REPORT');
      expect(q2.isPdfRequested).toBe(true);

      const q3 = parseMacroQuery('please send me the macro dossier pdf');
      expect(q3.intent).toBe('FULL_REPORT');
      expect(q3.isPdfRequested).toBe(true);
    });

    it('parses specific section intents accurately', () => {
      expect(parseMacroQuery('regime').intent).toBe('REGIME');
      expect(parseMacroQuery('macro score').intent).toBe('REGIME');
      expect(parseMacroQuery('growth outlook').intent).toBe('REGIME');

      expect(parseMacroQuery('yields').intent).toBe('YIELDS_RATES');
      expect(parseMacroQuery('10y rates').intent).toBe('YIELDS_RATES');
      expect(parseMacroQuery('yield curve').intent).toBe('YIELDS_RATES');
      expect(parseMacroQuery('2s10s').intent).toBe('YIELDS_RATES');

      expect(parseMacroQuery('volatility').intent).toBe('VOLATILITY');
      expect(parseMacroQuery('vix').intent).toBe('VOLATILITY');
      expect(parseMacroQuery('skew').intent).toBe('VOLATILITY');

      expect(parseMacroQuery('pillars').intent).toBe('PILLARS');
      expect(parseMacroQuery('7 pillars').intent).toBe('PILLARS');
      expect(parseMacroQuery('labor pillar').intent).toBe('PILLARS');
      expect(parseMacroQuery('labor pillar').subItem).toBe('labor');

      expect(parseMacroQuery('scenarios').intent).toBe('SCENARIOS');
      expect(parseMacroQuery('base case').intent).toBe('SCENARIOS');
      expect(parseMacroQuery('probabilities').intent).toBe('SCENARIOS');

      expect(parseMacroQuery('allocations').intent).toBe('ALLOCATIONS');
      expect(parseMacroQuery('tactical').intent).toBe('ALLOCATIONS');
      expect(parseMacroQuery('hedging').intent).toBe('ALLOCATIONS');

      expect(parseMacroQuery('catalysts').intent).toBe('CATALYSTS');
      expect(parseMacroQuery('fomc radar').intent).toBe('CATALYSTS');
      expect(parseMacroQuery('pivot levels').intent).toBe('CATALYSTS');

      expect(parseMacroQuery('gold').intent).toBe('GOLD_COMMODITIES');
      expect(parseMacroQuery('commodities').intent).toBe('GOLD_COMMODITIES');
      expect(parseMacroQuery('crude oil').intent).toBe('GOLD_COMMODITIES');
      expect(parseMacroQuery('dxy').intent).toBe('GOLD_COMMODITIES');

      expect(parseMacroQuery('sectors').intent).toBe('SECTORS_TRENDS');
      expect(parseMacroQuery('trends').intent).toBe('SECTORS_TRENDS');
      expect(parseMacroQuery('sector momentum').intent).toBe('SECTORS_TRENDS');

      expect(parseMacroQuery('help').intent).toBe('HELP');
      expect(parseMacroQuery('?').intent).toBe('HELP');
      expect(parseMacroQuery('commands').intent).toBe('HELP');
    });

    it('supports specific item queries with pdf requested', () => {
      const qRegimePdf = parseMacroQuery('regime pdf');
      expect(qRegimePdf.intent).toBe('REGIME');
      expect(qRegimePdf.isPdfRequested).toBe(true);

      const qScenariosPdf = parseMacroQuery('scenarios pdf');
      expect(qScenariosPdf.intent).toBe('SCENARIOS');
      expect(qScenariosPdf.isPdfRequested).toBe(true);

      const qAllocationsPdf = parseMacroQuery('allocations pdf');
      expect(qAllocationsPdf.intent).toBe('ALLOCATIONS');
      expect(qAllocationsPdf.isPdfRequested).toBe(true);

      const qYieldsPdf = parseMacroQuery('yields pdf');
      expect(qYieldsPdf.intent).toBe('YIELDS_RATES');
      expect(qYieldsPdf.isPdfRequested).toBe(true);
    });
  });

  // ==========================================
  // 2. TELEGRAM MESSAGE FORMATTING TESTS
  // ==========================================
  describe('formatMacroTelegramMessage()', () => {
    it('formats REGIME query with score and telemetry', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'REGIME' });
      expect(msg).toContain('Global Macro Regime & Stability Score');
      expect(msg).toContain('Resilient Expansion / Late-Cycle Goldilocks');
      expect(msg).toContain('78/100');
      expect(msg).toContain('EXPANSIONARY');
      expect(msg).toContain('DISINFLATION');
      expect(msg).toContain('14.85');
      expect(msg).toContain('4.22%');
    });

    it('formats YIELDS_RATES query with 10Y and 2s10s spread', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'YIELDS_RATES' });
      expect(msg).toContain('Sovereign Yields, Rates & Curve Intelligence');
      expect(msg).toContain('4.22%');
      expect(msg).toContain('+0.38%');
      expect(msg).toContain('Normal Sloping');
      expect(msg).toContain('4.83%');
    });

    it('formats VOLATILITY query with VIX and VRP implications', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'VOLATILITY' });
      expect(msg).toContain('Volatility Complex, VIX & Skew Intelligence');
      expect(msg).toContain('14.85');
      expect(msg).toContain('Complacent / Contango');
      expect(msg).toContain('Volatility Risk Premium');
    });

    it('formats PILLARS query with all 7 pillars', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'PILLARS' });
      expect(msg).toContain('The 7 Institutional Macro Pillars');
      expect(msg).toContain('Sovereign Yields & Bond Curve');
      expect(msg).toContain('Labor Market & Consumer Resilience');
      expect(msg).toContain('Inflation Dynamics & Price Stability');
      expect(msg).toContain('Central Bank Liquidity & Fed Policy');
      expect(msg).toContain('Corporate Earnings & Credit Spreads');
      expect(msg).toContain('Volatility Complex, Skew & Fear');
      expect(msg).toContain('Real Assets, Commodities & FX Regimes');
    });

    it('formats single pillar deep dive when subItem is provided', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'PILLARS', subItem: 'labor' });
      expect(msg).toContain('Labor Market & Consumer Resilience');
      expect(msg).toContain('4.1%');
      expect(msg).toContain('Equities maintain firm footing');
    });

    it('formats SCENARIOS query with Base, Bull, and Bear cases', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'SCENARIOS' });
      expect(msg).toContain('Probabilistic Macro Scenarios & Playbooks');
      expect(msg).toContain('*Soft Landing (Base Case)* (60% Probability)');
      expect(msg).toContain('*Productivity Boom (Bull Case)* (25% Probability)');
      expect(msg).toContain('*Stagflation Shock (Bear Case)* (15% Probability)');
      expect(msg).toContain('Winners:');
      expect(msg).toContain('Losers:');
    });

    it('formats ALLOCATIONS query with multi-asset stances', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'ALLOCATIONS' });
      expect(msg).toContain('Cross-Asset Tactical Allocations & Hedging');
      expect(msg).toContain('Equities');
      expect(msg).toContain('OVERWEIGHT');
      expect(msg).toContain('Fixed Income / Duration');
      expect(msg).toContain('NEUTRAL');
      expect(msg).toContain('Commodities & Real Assets');
      expect(msg).toContain('Derivatives & Hedging');
      expect(msg).toContain('TACTICAL_HEDGE');
    });

    it('formats CATALYSTS query with upcoming watchpoints and pivot levels', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'CATALYSTS' });
      expect(msg).toContain('Macro Catalyst Radar & Critical Pivot Levels');
      expect(msg).toContain('FOMC Interest Rate Decision');
      expect(msg).toContain('CRITICAL');
      expect(msg).toContain('Consumer Price Index (CPI)');
      expect(msg).toContain('*Critical Pivot:* 10Y Yield 4.40%');
    });

    it('formats FULL_REPORT default summary', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'FULL_REPORT' });
      expect(msg).toContain('TradeFlow Global Macro Intelligence Briefing');
      expect(msg).toContain('Resilient Expansion / Late-Cycle Goldilocks');
      expect(msg).toContain('78/100');
      expect(msg).toContain('Cross-Asset Telemetry:');
      expect(msg).toContain('Probabilistic Scenarios:');
      expect(msg).toContain('Tactical Stances:');
    });

    it('appends PDF delivery note when isPdfRequested is true', () => {
      const msg = formatMacroTelegramMessage(mockDossier, { intent: 'FULL_REPORT', isPdfRequested: true });
      expect(msg).toContain('Institutional Macro PDF Briefing attached below!');
    });
  });

  // ==========================================
  // 3. PDF GENERATION TESTS
  // ==========================================
  describe('generateMacroPdfBuffer()', () => {
    it('generates a valid, readable institutional PDF buffer', async () => {
      const buffer = await generateMacroPdfBuffer(mockDossier);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(10000); // 2-page rich PDF should be > 10 KB

      // Verify PDF header magic bytes "%PDF-"
      const headerStr = buffer.toString('utf-8', 0, 5);
      expect(headerStr).toBe('%PDF-');
    });
  });

  // ==========================================
  // 4. TOPIC MESSAGE DISPATCH & HANDLING TESTS
  // ==========================================
  describe('handleMacroTopicMessage()', () => {
    it('handles "help" command in the Macro topic', async () => {
      const res = await handleMacroTopicMessage({
        text: 'help',
        chatId: '-1003872409872',
        messageThreadId: 315,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('HELP');
      expect(res.pdfGenerated).toBe(false);
      expect(res.replyText).toContain('Macro Topic — Instructions & Commands');
    });

    it('handles "regime" command without generating PDF', async () => {
      const res = await handleMacroTopicMessage({
        text: 'regime',
        chatId: '-1003872409872',
        messageThreadId: 315,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('REGIME');
      expect(res.pdfGenerated).toBe(false);
      expect(res.replyText).toContain('Global Macro Regime & Stability Score');
    });

    it('handles "macro pdf" command and generates institutional PDF', async () => {
      const res = await handleMacroTopicMessage({
        text: 'macro pdf',
        chatId: '-1003872409872',
        messageThreadId: 315,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('FULL_REPORT');
      expect(res.pdfGenerated).toBe(true);
      expect(res.replyText).toContain('Institutional Macro PDF Briefing attached below!');
    });

    it('handles single word "pdf" command in Macro topic', async () => {
      const res = await handleMacroTopicMessage({
        text: 'pdf',
        chatId: '-1003872409872',
        messageThreadId: 315,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('FULL_REPORT');
      expect(res.pdfGenerated).toBe(true);
    });
  });

  // ==========================================
  // 5. TOPIC CONFIGURATION & ROUTING TESTS
  // ==========================================
  describe('Thread Configuration & Help Integration', () => {
    beforeEach(() => {
      delete process.env.TELEGRAM_MACRO_THREAD_ID;
    });

    it('setTelegramMacroThreadId sets environment and returns true', () => {
      const success = setTelegramMacroThreadId('412');
      expect(success).toBe(true);
      expect(process.env.TELEGRAM_MACRO_THREAD_ID).toBe('412');

      const status = getTelegramBufferStatus();
      expect(status.macroThreadId).toBe('412');
    });

    it('setGenericTopicThreadId updates macro topic', () => {
      const success = setGenericTopicThreadId('macro', 550);
      expect(success).toBe(true);
      expect(process.env.TELEGRAM_MACRO_THREAD_ID).toBe('550');
    });

    it('getMacroTopicHelp returns full command guide', () => {
      const help = getMacroTopicHelp();
      expect(help).toContain('Macro Topic — Instructions & Commands');
      expect(help).toContain('7 pillars');
      expect(help).toContain('scenarios');
      expect(help).toContain('allocations');
      expect(help).toContain('pdf');
    });

    it('getHelpMessageForTopic("MACRO") routes to getMacroTopicHelp', () => {
      const help = getHelpMessageForTopic('MACRO');
      expect(help).toContain('Macro Topic — Instructions & Commands');
    });

    it('getGeneralTopicDirectoryHelp includes Macro topic entry', () => {
      const dir = getGeneralTopicDirectoryHelp();
      expect(dir).toContain('• 🌐 *Macro*');
    });

    it('buildTopicsOverviewReport displays 9 integrated topics and Macro status', async () => {
      setTelegramMacroThreadId('412');
      const mockPrisma: any = {
        broker: { count: vi.fn().mockResolvedValue(3) },
        holding: { findMany: vi.fn().mockResolvedValue([]) },
        watchlist: { count: vi.fn().mockResolvedValue(5) },
        watchlistItem: { count: vi.fn().mockResolvedValue(30) },
        stockNote: { count: vi.fn().mockResolvedValue(12) },
        plannedTrade: { count: vi.fn().mockResolvedValue(2) },
        priceAlert: { count: vi.fn().mockResolvedValue(4) },
        thoughtLog: { count: vi.fn().mockResolvedValue(8) },
        appIdea: { count: vi.fn().mockResolvedValue(3) },
      };

      const overview = await buildTopicsOverviewReport(mockPrisma);
      expect(overview).toContain('all 9 integrated topics');
      expect(overview).toContain('9. Macro Intelligence');
      expect(overview).toContain('Thread `412`');
    });
  });
});
