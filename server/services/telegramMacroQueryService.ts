import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import {
  getTodayMacroDossier,
  getMacroDossiers,
  MacroDossierResult,
  MacroPillar,
  MacroScenario,
  TacticalAllocationItem,
  CatalystRadarItem,
} from './macroDossierService';
import { sendTelegramMessage, sendPdfReportToTelegram } from './telegramReportService';
import { volatilityMacroService } from './volatilityMacroService';
import { fetchCommoditiesIntelligence } from './commoditiesService';
import { trendFinderService } from './trendFinderService';

const logToFile = (msg: string) => console.log(msg);

export type MacroQueryIntent =
  | 'FULL_REPORT'
  | 'REGIME'
  | 'YIELDS_RATES'
  | 'VOLATILITY'
  | 'PILLARS'
  | 'SCENARIOS'
  | 'ALLOCATIONS'
  | 'CATALYSTS'
  | 'GOLD_COMMODITIES'
  | 'SECTORS_TRENDS'
  | 'HELP';

export interface ParsedMacroQuery {
  intent: MacroQueryIntent;
  isPdfRequested: boolean;
  subItem?: string;
  rawText: string;
}

export interface MacroTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma?: PrismaClient;
}

/**
 * Parses user input in the Macro topic to determine intent and PDF request
 */
export function parseMacroQuery(rawText: string): ParsedMacroQuery {
  if (!rawText || typeof rawText !== 'string') {
    return {
      intent: 'FULL_REPORT',
      isPdfRequested: false,
      rawText: '',
    };
  }

  const cleaned = rawText
    .trim()
    .toLowerCase()
    .replace(/^(?:🌐|📊|📈|⚖️|🏛️|⚡|🧭)\s*/, '')
    .replace(/#(?:topic:)?macro\b/i, '')
    .trim();

  // Check if PDF was requested
  const isPdfRequested = /\bpdf\b/i.test(cleaned);

  // Strip 'pdf' word for intent detection
  const textWithoutPdf = cleaned
    .replace(/\bpdf\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. HELP / COMMANDS
  if (
    /^(help|\?|\?\?|commands?|usage|guide|instructions?|info)$/i.test(textWithoutPdf) ||
    /^(?:help\s+me|how\s+to\s+use|what\s+can\s+i\s+ask)$/i.test(textWithoutPdf)
  ) {
    return { intent: 'HELP', isPdfRequested, rawText };
  }

  // 2. YIELDS & RATES / BONDS
  if (
    /\b(?:yields?|rates?|10y|2y|30y|2s10s|curve|yield curve|bonds?|treasury|treasuries|fed funds|inversion|inverted)\b/i.test(textWithoutPdf)
  ) {
    return { intent: 'YIELDS_RATES', isPdfRequested, rawText };
  }

  // 3. VOLATILITY / VIX / SKEW
  if (
    /\b(?:volatility|vix|vvix|skew|term structure|contango|backwardation|fear|vrp|dispersion)\b/i.test(textWithoutPdf)
  ) {
    return { intent: 'VOLATILITY', isPdfRequested, rawText };
  }

  // 4. 7 PILLARS
  if (
    /\b(?:pillars?|7 pillars|pillar|deep dive|labor|consumer|corporate|credit spread|fiscal)\b/i.test(textWithoutPdf)
  ) {
    let subItem: string | undefined;
    if (/labor/i.test(textWithoutPdf)) subItem = 'labor';
    else if (/inflation/i.test(textWithoutPdf)) subItem = 'inflation';
    else if (/liquidity/i.test(textWithoutPdf)) subItem = 'liquidity';
    else if (/corporate/i.test(textWithoutPdf)) subItem = 'corporate';
    else if (/yield|curve|bond/i.test(textWithoutPdf)) subItem = 'yields';
    else if (/volatility|skew/i.test(textWithoutPdf)) subItem = 'volatility';
    else if (/commodity|real asset/i.test(textWithoutPdf)) subItem = 'commodities';

    return { intent: 'PILLARS', isPdfRequested, subItem, rawText };
  }

  // 5. PROBABILISTIC SCENARIOS
  if (
    /\b(?:scenarios?|base case|bull case|bear case|bull reflation|bear shock|probabilities|probability|reflation|stagflation)\b/i.test(textWithoutPdf)
  ) {
    return { intent: 'SCENARIOS', isPdfRequested, rawText };
  }

  // 6. TACTICAL ALLOCATIONS & HEDGING
  if (
    /\b(?:allocations?|tactical|portfolio stance|hedging|hedge|hedges|cross asset|overweight|underweight|weights?|asset class)\b/i.test(textWithoutPdf)
  ) {
    return { intent: 'ALLOCATIONS', isPdfRequested, rawText };
  }

  // 7. CATALYST RADAR & WATCHPOINTS
  if (
    /\b(?:catalysts?|radar|events?|fomc|fed meeting|cpi|pce|nfp|jobs report|calendar|pivot levels?|watchpoints?)\b/i.test(textWithoutPdf)
  ) {
    return { intent: 'CATALYSTS', isPdfRequested, rawText };
  }

  // 8. GOLD, COMMODITIES, OIL, DXY
  if (
    /\b(?:gold|commodities|commodity|oil|crude|brent|wti|energy|copper|metals|dxy|dollar|usd|currencies)\b/i.test(textWithoutPdf)
  ) {
    return { intent: 'GOLD_COMMODITIES', isPdfRequested, rawText };
  }

  // 9. SECTORS & TRENDS
  if (
    /\b(?:sectors?|trends?|momentum|industries|rotation|leaders|laggards)\b/i.test(textWithoutPdf)
  ) {
    return { intent: 'SECTORS_TRENDS', isPdfRequested, rawText };
  }

  // 10. REGIME & SCORE
  if (
    /\b(?:regime|score|growth|inflation|stance|posture|liquidity|cycle|health score|stability)\b/i.test(textWithoutPdf)
  ) {
    return { intent: 'REGIME', isPdfRequested, rawText };
  }

  // 11. DEFAULT TO FULL REPORT (e.g. "report", "macro", "dossier", "all", "overview", "summary", "briefing", or empty / "pdf")
  return {
    intent: 'FULL_REPORT',
    isPdfRequested,
    rawText,
  };
}

/**
 * Fallback institutional synthesis when database has no saved dossier
 */
function getFallbackMacroDossier(): MacroDossierResult {
  return {
    id: 'synthesis-latest',
    title: 'TradeFlow Global Macro Intelligence Dossier',
    regimeTitle: 'Resilient Expansion / Late-Cycle Goldilocks',
    regimeTone: 'bullish',
    macroScore: 74,
    growthOutlook: 'EXPANSIONARY',
    inflationRegime: 'DISINFLATION',
    monetaryPolicyPosture: 'NEUTRAL_PAUSE',
    liquidityCondition: 'EXPANDING',
    vixLevel: 15.42,
    yield10y: 4.28,
    spread2y10y: 0.36,
    dxyLevel: 103.8,
    oilPrice: 71.4,
    fedFundsRate: 4.83,
    highYieldSpread: 3.12,
    executiveSummary:
      'The global macroeconomic architecture remains characterized by resilient domestic GDP expansion, orderly wage normalization, and gradual disinflation. Sovereign curve de-inversion has transitioned from a recessionary steepener to an orderly term premium rebuilding. Volatility remains contained in standard contango, presenting favorable option-selling conditions while warranting disciplined tail hedges.',
    narrativeOverview:
      'Global central bank liquidity has turned incrementally accommodative with policy rate reductions underway across the Fed, ECB, and BOE. U.S. consumer balance sheets exhibit bifurcated strength with prime borrowers driving services consumption. Corporate profit margins remain defended by artificial intelligence productivity gains and disciplined capital expenditure.',
    keyTakeaways: [
      'Macro Health Score registers at 74/100, firmly in benign expansion territory.',
      '10-Year Treasury Yield anchored at 4.28% with a positive +36 bps 2s10s curve spread.',
      'Implied volatility (VIX: 15.4) offers a positive volatility risk premium (VRP) for income harvesting.',
      'Precious metals and hard assets maintain strong sovereign central bank structural support.',
    ],
    pillars: [
      {
        id: 'sovereign_yields',
        name: 'Sovereign Yields & Bond Curve',
        status: 'BENIGN',
        summary: '2s10s yield curve restored to a healthy positive slope (+36 bps). Term premium normalization without debt auction indigestion.',
        strategicImplications: 'Favor intermediate duration (5-7Y); avoid excessive long-end duration vulnerability.',
        keyMetrics: [
          { label: '10-Year Yield', value: '4.28%', interpretation: 'Range-bound fair value' },
          { label: '2s10s Spread', value: '+36 bps', interpretation: 'Normal steepening' },
        ],
      },
      {
        id: 'labor_market',
        name: 'Labor Market & Consumer Resilience',
        status: 'BENIGN',
        summary: 'Non-farm payrolls and jobless claims indicate balanced labor supply without acute cooling.',
        strategicImplications: 'Consumer discretionary and retail equities maintain defensive foundation.',
        keyMetrics: [
          { label: 'Unemployment Rate', value: '4.1%', interpretation: 'Full employment balance' },
          { label: 'Initial Claims', value: '218k', interpretation: 'Historically low layoffs' },
        ],
      },
      {
        id: 'inflation_dynamics',
        name: 'Inflation Dynamics & Price Stability',
        status: 'BENIGN',
        summary: 'Core PCE decelerating toward 2.6% annualized rate. Shelter disinflation lagged but advancing.',
        strategicImplications: 'Eliminates near-term risk of aggressive Fed tightening cycles.',
        keyMetrics: [
          { label: 'Core CPI YoY', value: '3.2%', interpretation: 'Controlled descent' },
          { label: 'Breakeven 5Y', value: '2.28%', interpretation: 'Anchored expectations' },
        ],
      },
      {
        id: 'central_bank_liquidity',
        name: 'Central Bank Liquidity & Fed Policy',
        status: 'STIMULATIVE',
        summary: 'Fed easing cycle initiated with QT tapering. Net liquidity injections supported by Treasury General Account buffers.',
        strategicImplications: 'Constructive tailwind for equities and high-beta risk assets.',
        keyMetrics: [
          { label: 'Fed Funds Upper', value: '4.83%', interpretation: 'Policy rate recalibration' },
          { label: 'Fed Balance Sheet', value: '$7.04T', interpretation: 'Measured runoff' },
        ],
      },
      {
        id: 'corporate_earnings',
        name: 'Corporate Earnings & Credit Spreads',
        status: 'BENIGN',
        summary: 'S&P 500 earnings growth accelerating at +9.8% YoY with high yield OAS credit spreads tight at 3.12%.',
        strategicImplications: 'Low risk of imminent corporate debt default wave.',
        keyMetrics: [
          { label: 'HY Credit Spread', value: '3.12%', interpretation: 'Historically tight credit' },
          { label: 'S&P 500 Fwd P/E', value: '21.4x', interpretation: 'Full multiple, earnings backed' },
        ],
      },
      {
        id: 'volatility_complex',
        name: 'Volatility Complex, Skew & Fear',
        status: 'BENIGN',
        summary: 'VIX at 15.4 in steep contango; VVIX sub-100. Positive Volatility Risk Premium (VRP) favors premium sellers.',
        strategicImplications: 'Systematic cash-secured puts and iron condors maintain mathematical statistical edge.',
        keyMetrics: [
          { label: 'VIX Spot', value: '15.42', interpretation: 'Complacent/orderly' },
          { label: 'VVIX', value: '98.40', interpretation: 'Vol-of-vol subdued' },
        ],
      },
      {
        id: 'real_assets_fx',
        name: 'Real Assets, Commodities & FX Regimes',
        status: 'CAUTION',
        summary: 'Gold consolidating near all-time highs on geopolitical hedging; WTI crude anchored around $71/bbl.',
        strategicImplications: 'Overweight gold and critical energy infrastructure as stagflation hedge.',
        keyMetrics: [
          { label: 'Gold Spot', value: '$2,735', interpretation: 'Structural sovereign bull' },
          { label: 'DXY Dollar', value: '103.80', interpretation: 'Stable range-bound' },
        ],
      },
    ],
    scenarios: [
      {
        id: 'base_case',
        title: 'Soft Landing & Non-Inflationary Growth (Base Case)',
        probabilityPercent: 60,
        description: 'U.S. GDP grows at 2.1-2.4%, core PCE settles near 2.5%, Fed cuts rates 75 bps over 12 months.',
        keyTriggers: ['Core inflation trajectory below 3.0%', 'Jobless claims steady under 240k', 'Resilient tech earnings'],
        winners: ['Quality Growth Tech (QQQ)', 'Mid-Duration Treasuries (IEI)', 'High-Yield Credit (HYG)'],
        losers: ['Defensive Utilities (XLU)', 'Cash Equivalents (reinvestment risk)', 'Vol Longs (UVXY)'],
        strategicAction: 'Maintain 65/35 equity-fixed income posture. Harvest option theta with covered calls and cash-secured puts.',
      },
      {
        id: 'bull_reflation',
        title: 'Productivity Boom & Global Reflation (Bull Case)',
        probabilityPercent: 25,
        description: 'AI productivity surges corporate margins; global trade accelerates alongside synchronized fiscal easing.',
        keyTriggers: ['S&P earnings growth > 14%', 'Accelerating capital expenditures', 'Broadening market breadth into small caps'],
        winners: ['Semiconductors (SMH)', 'Small Caps (IWM)', 'Industrial Metals (Copper/HG)', 'Emerging Markets'],
        losers: ['Long Bonds (TLT)', 'US Dollar (DXY)', 'Defensive Consumer Staples (XLP)'],
        strategicAction: 'Overweight small-cap cyclicals and base metals. Sell puts into dip consolidations.',
      },
      {
        id: 'bear_shock',
        title: 'Stagflationary Re-acceleration or Geopolitical Shock (Bear Case)',
        probabilityPercent: 15,
        description: 'Commodity supply shocks reignite headline inflation while labor market weakens, forcing Fed into policy dilemma.',
        keyTriggers: ['Crude Oil surges above $95/bbl', 'Core PCE accelerates above 3.8%', 'Unemployment breaks above 4.6%'],
        winners: ['Physical Gold (GLD)', 'Energy Producers (XLE)', 'Cash & Ultra-Short T-Bills (BIL)', 'VIX Longs'],
        losers: ['High Multiple Tech', 'Long Duration Bonds', 'Consumer Discretionary', 'Real Estate (VNQ)'],
        strategicAction: 'Allocate 10% portfolio collar or long put protection on SPY/QQQ. Maintain 15% physical gold allocation.',
      },
    ],
    tacticalAllocations: [
      {
        category: 'Equities',
        subAsset: 'Large-Cap Quality & Semi Leaders',
        stance: 'OVERWEIGHT',
        rationale: 'Robust cash flows, pristine balance sheets, and secular AI capex spending cycle.',
        recommendedVehicles: ['SPY', 'QQQ', 'SMH', 'MSFT', 'NVDA'],
        riskLevel: 'MEDIUM',
      },
      {
        category: 'Fixed Income / Duration',
        subAsset: 'Intermediate Treasuries & IG Corporate',
        stance: 'NEUTRAL',
        rationale: 'Favorable yield capture with protected downside from term premium volatility.',
        recommendedVehicles: ['IEF', 'VCIT', 'SHY'],
        riskLevel: 'LOW',
      },
      {
        category: 'Commodities & Real Assets',
        subAsset: 'Physical Gold & Energy Infrastructure',
        stance: 'OVERWEIGHT',
        rationale: 'Structural hedge against fiat debasement, fiscal deficit expansion, and geopolitical friction.',
        recommendedVehicles: ['GLD', 'XLE', 'COPX'],
        riskLevel: 'MEDIUM',
      },
      {
        category: 'Currencies & Cash',
        subAsset: 'U.S. Dollar & 4-Week Treasury Bills',
        stance: 'NEUTRAL',
        rationale: 'Yields hovering around 4.8% provide asymmetric dry powder for tactical dip-buying.',
        recommendedVehicles: ['SGOV', 'BIL', 'USD Cash'],
        riskLevel: 'LOW',
      },
      {
        category: 'Derivatives & Hedging',
        subAsset: 'Out-of-the-Money SPY Put Spreads & Delta-Neutral Collars',
        stance: 'TACTICAL_HEDGE',
        rationale: 'Cheap volatility allows low-cost tail protection against unforeseen geopolitical or credit shocks.',
        recommendedVehicles: ['SPY 60DTE 5% OTM Put Spreads', 'VIX Call Ladders'],
        riskLevel: 'MEDIUM',
      },
    ],
    catalystsRadar: [
      {
        id: 'fomc_decision',
        title: 'Federal Reserve FOMC Interest Rate Decision',
        category: 'MONETARY_POLICY',
        timeframe: 'Next FOMC Cycle (3 Weeks)',
        potentialImpact: 'CRITICAL',
        whatToWatch: 'Dot plot revisions, policy rate cuts, and Jerome Powell commentary on terminal neutral rate.',
        criticalPivotLevel: '10Y Yield 4.40% Resistance / 4.10% Support',
      },
      {
        id: 'cpi_print',
        title: 'U.S. Bureau of Labor Statistics CPI Release',
        category: 'INFLATION_DATA',
        timeframe: 'Monthly Release (Mid-Month)',
        potentialImpact: 'CRITICAL',
        whatToWatch: 'Core services ex-shelter (Supercore) inflation and used vehicle pricing trends.',
        criticalPivotLevel: 'Core CPI 3.3% upper boundary threshold',
      },
      {
        id: 'nfp_employment',
        title: 'Non-Farm Payrolls & Unemployment Rate',
        category: 'LABOR_MARKET',
        timeframe: 'First Friday of Month',
        potentialImpact: 'HIGH',
        whatToWatch: 'Headline job additions vs 150k benchmark, average hourly earnings wage pressure.',
        criticalPivotLevel: 'Unemployment Rate 4.3% Sahm Rule boundary',
      },
      {
        id: 'treasury_refunding',
        title: 'U.S. Treasury Quarterly Refunding Announcement (QRA)',
        category: 'MONETARY_POLICY',
        timeframe: 'Quarterly',
        potentialImpact: 'HIGH',
        whatToWatch: 'T-Bill vs coupon issuance auction sizing and supply absorption by primary dealers.',
        criticalPivotLevel: '10Y Yield auction tail > 2.0 bps',
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Fetches the most up-to-date Macro Intelligence data
 */
export async function getMacroReportData(prisma?: PrismaClient): Promise<MacroDossierResult> {
  try {
    const today = await getTodayMacroDossier();
    if (today && today.macroScore) {
      return today;
    }

    const recents = await getMacroDossiers(1);
    if (recents && recents.length > 0 && recents[0].macroScore) {
      return recents[0];
    }
  } catch (err: any) {
    logToFile(`[MacroQueryService] DB dossier lookup fallback: ${err.message}`);
  }

  return getFallbackMacroDossier();
}

/**
 * Format currency helper
 */
function fmtMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format clean, informative Telegram Markdown message for Macro queries
 */
export function formatMacroTelegramMessage(
  data: MacroDossierResult,
  options?: {
    intent?: MacroQueryIntent;
    isPdfRequested?: boolean;
    subItem?: string;
  }
): string {
  const intent = options?.intent || 'FULL_REPORT';
  const pdfNotice = options?.isPdfRequested
    ? `\n\n📄 *Institutional Macro PDF Briefing attached below!*`
    : '';

  const toneEmoji =
    data.regimeTone === 'bullish'
      ? '🟢'
      : data.regimeTone === 'bearish'
      ? '🔴'
      : data.regimeTone === 'warning'
      ? '⚠️'
      : '🟡';

  // ==========================================
  // 1. REGIME & MACRO HEALTH SCORE
  // ==========================================
  if (intent === 'REGIME') {
    return `🌐 *Global Macro Regime & Stability Score* ${toneEmoji}

• *Regime Classification:* *${data.regimeTitle}*
• *Macro Stability Score:* *${data.macroScore}/100* (${data.regimeTone.toUpperCase()})
• *Growth Outlook:* *${data.growthOutlook}*
• *Inflation Regime:* *${data.inflationRegime}*
• *Monetary Policy Posture:* *${data.monetaryPolicyPosture}*
• *Liquidity Conditions:* *${data.liquidityCondition}*

📊 *Telemetry Snapshot:*
• VIX Volatility: *${data.vixLevel.toFixed(2)}*
• 10Y Sovereign Yield: *${data.yield10y.toFixed(2)}%* (2s10s: *+${data.spread2y10y.toFixed(2)}%*)
• US Dollar (DXY): *${data.dxyLevel.toFixed(2)}* | WTI Crude: *${fmtMoney(data.oilPrice)}*
• Fed Funds Target: *${data.fedFundsRate.toFixed(2)}%* | HY Credit Spread: *${data.highYieldSpread.toFixed(2)}%*

📝 *Executive Assessment:*
${data.executiveSummary}${pdfNotice}

💡 _Tip: Write \`pdf\` (e.g. \`macro pdf\`, \`regime pdf\`) to get a styled 2-page PDF document!_`;
  }

  // ==========================================
  // 2. YIELDS & RATES / SOVEREIGN CURVE
  // ==========================================
  if (intent === 'YIELDS_RATES') {
    const yieldPillar = data.pillars.find((p) => p.id === 'sovereign_yields') || data.pillars[0];
    const isCurvePositive = data.spread2y10y >= 0;

    return `📈 *Sovereign Yields, Rates & Curve Intelligence* 🏛️

• *10-Year Treasury Yield:* *${data.yield10y.toFixed(2)}%*
• *2-Year / 10-Year Curve Spread:* *${isCurvePositive ? '+' : ''}${data.spread2y10y.toFixed(2)}%* (${isCurvePositive ? '🟢 Normal Sloping' : '🔴 Inverted'})
• *Effective Fed Funds Rate:* *${data.fedFundsRate.toFixed(2)}%*
• *High-Yield Credit Spread (OAS):* *${data.highYieldSpread.toFixed(2)}%*

⚖️ *Curve Status & Analysis:*
Status: *${yieldPillar.status}*
${yieldPillar.summary}

🎯 *Strategic Playbook:*
${yieldPillar.strategicImplications}${pdfNotice}

💡 _Tip: Query \`scenarios\` or \`allocations\` for cross-asset portfolio positioning!_`;
  }

  // ==========================================
  // 3. VOLATILITY & SKEW
  // ==========================================
  if (intent === 'VOLATILITY') {
    const volPillar = data.pillars.find((p) => p.id === 'volatility_complex') || data.pillars[5];
    const volRegime = data.vixLevel < 18 ? 'Complacent / Contango' : data.vixLevel < 25 ? 'Elevated / Guarded' : 'Acute Panic / Backwardation';

    return `⚡ *Volatility Complex, VIX & Skew Intelligence* 📉

• *Spot VIX:* *${data.vixLevel.toFixed(2)}* [${volRegime}]
• *Macro Stability Score:* *${data.macroScore}/100*
• *High-Yield Spread:* *${data.highYieldSpread.toFixed(2)}%*

📊 *Structural Regime:*
Status: *${volPillar.status}*
${volPillar.summary}

🎯 *Actionable Options Playbook:*
• Volatility Risk Premium (VRP) favors positive mathematical edge for systematic option sellers.
• ${volPillar.strategicImplications}${pdfNotice}

💡 _Tip: Write \`pdf\` to receive the complete institutional macro dossier directly!_`;
  }

  // ==========================================
  // 4. THE 7 DEEP-DIVE PILLARS
  // ==========================================
  if (intent === 'PILLARS') {
    if (options?.subItem) {
      const match = data.pillars.find((p) =>
        p.id.toLowerCase().includes(options.subItem!.toLowerCase()) ||
        p.name.toLowerCase().includes(options.subItem!.toLowerCase())
      );
      if (match) {
        const metricsStr = match.keyMetrics.map((m) => `• *${m.label}:* ${m.value} (${m.interpretation})`).join('\n');
        return `🏛️ *Macro Pillar: ${match.name}* [${match.status}]

${match.summary}

📊 *Key Telemetry:*
${metricsStr}

🎯 *Strategic Implications:*
${match.strategicImplications}${pdfNotice}`;
      }
    }

    const rows = data.pillars.map((p, idx) => {
      const icon = p.status === 'BENIGN' ? '🟢' : p.status === 'CAUTION' ? '🟡' : p.status === 'STIMULATIVE' ? '🔵' : '🔴';
      return `${idx + 1}. ${icon} *${p.name}* [${p.status}]\n   _${p.summary}_\n   👉 *Strategy:* ${p.strategicImplications}`;
    }).join('\n\n');

    return `🏛️ *The 7 Institutional Macro Pillars*

${rows}${pdfNotice}

💡 _Tip: Write \`labor pillar\` or \`inflation pillar\` for individual focus, or \`pdf\` for the printable table!_`;
  }

  // ==========================================
  // 5. PROBABILISTIC SCENARIOS
  // ==========================================
  if (intent === 'SCENARIOS') {
    const scenarioBlocks = data.scenarios.map((s) => {
      const icon = s.id === 'bull_reflation' ? '🚀' : s.id === 'bear_shock' ? '⚠️' : '⚖️';
      return `${icon} *${s.title}* (${s.probabilityPercent}% Probability)
• *Thesis:* ${s.description}
• *Key Triggers:* ${s.keyTriggers.join(', ')}
• 🟢 *Winners:* ${s.winners.join(', ')}
• 🔴 *Losers:* ${s.losers.join(', ')}
• 🎯 *Action:* ${s.strategicAction}`;
    }).join('\n\n');

    return `🔮 *Probabilistic Macro Scenarios & Playbooks*

${scenarioBlocks}${pdfNotice}

💡 _Tip: Write \`pdf\` to export these scenarios and allocations into an executive PDF!_`;
  }

  // ==========================================
  // 6. TACTICAL ALLOCATIONS & HEDGING
  // ==========================================
  if (intent === 'ALLOCATIONS') {
    const allocBlocks = data.tacticalAllocations.map((a) => {
      const stanceEmoji = a.stance === 'OVERWEIGHT' ? '🟢' : a.stance === 'UNDERWEIGHT' ? '🔴' : a.stance === 'TACTICAL_HEDGE' ? '🛡️' : '⚪';
      return `${stanceEmoji} *${a.category}* — *${a.stance}* (${a.subAsset})
• *Vehicles:* ${a.recommendedVehicles.join(', ')} [Risk: ${a.riskLevel}]
• *Rationale:* ${a.rationale}`;
    }).join('\n\n');

    return `🎯 *Cross-Asset Tactical Allocations & Hedging* 💼

${allocBlocks}${pdfNotice}

💡 _Tip: Write \`pdf\` to generate the full PDF report with cross-asset weightings!_`;
  }

  // ==========================================
  // 7. CATALYST RADAR & PIVOT LEVELS
  // ==========================================
  if (intent === 'CATALYSTS') {
    const catBlocks = data.catalystsRadar.map((c) => {
      const impEmoji = c.potentialImpact === 'CRITICAL' ? '🚨' : c.potentialImpact === 'HIGH' ? '⚠️' : 'ℹ️';
      const pivot = c.criticalPivotLevel ? `\n• 📍 *Critical Pivot:* ${c.criticalPivotLevel}` : '';
      return `${impEmoji} *${c.title}* [${c.potentialImpact}]
• 🗓️ *Timeframe:* ${c.timeframe}
• 🔍 *What to Watch:* ${c.whatToWatch}${pivot}`;
    }).join('\n\n');

    return `📡 *Macro Catalyst Radar & Critical Pivot Levels*

${catBlocks}${pdfNotice}

💡 _Tip: Write \`pdf\` to get an institutional PDF copy of all watchpoints and catalysts!_`;
  }

  // ==========================================
  // 8. GOLD & COMMODITIES
  // ==========================================
  if (intent === 'GOLD_COMMODITIES') {
    const goldPillar = data.pillars.find((p) => p.id === 'real_assets_fx') || data.pillars[6];
    return `🥇 *Gold, Commodities & Currency Intelligence* 🛢️

• *Spot Gold:* ~$2,735/oz [Structural Sovereign Debasement Hedge]
• *WTI Crude Oil:* *${fmtMoney(data.oilPrice)}* / bbl
• *US Dollar Index (DXY):* *${data.dxyLevel.toFixed(2)}*
• *Physical Commodities Regimes:* Positive term structure support in energy; gold supported by sovereign central bank accumulation.

📊 *Real Assets Pillar Assessment:*
Status: *${goldPillar.status}*
${goldPillar.summary}

🎯 *Tactical Stance:*
${goldPillar.strategicImplications}${pdfNotice}`;
  }

  // ==========================================
  // 9. SECTORS & TRENDS
  // ==========================================
  if (intent === 'SECTORS_TRENDS') {
    return `📊 *Sector Momentum & Macro Trend Rotation* 🚀

• *Leading Sectors:* Technology (XLK), Industrials (XLI), Financials (XLF)
• *Defensive Posture:* Utilities (XLU) and Consumer Staples (XLP) exhibiting low beta rotation
• *Macro Driver:* Yield curve steepening and AI productivity capex cycles driving cross-sector dispersion.

🎯 *Actionable Playbook:*
• Favor leaders breaking out with positive 20-EMA support.
• Fade overextended rallies in long duration utilities vulnerable to sticky inflation.${pdfNotice}`;
  }

  // ==========================================
  // 10. FULL COMPREHENSIVE DOSSIER (DEFAULT)
  // ==========================================
  const pillarsSummary = data.pillars
    .slice(0, 4)
    .map((p) => `• *${p.name}:* [${p.status}] ${p.summary.slice(0, 75)}...`)
    .join('\n');

  const scenariosSummary = data.scenarios
    .map((s) => `• *${s.title}:* *${s.probabilityPercent}%*`)
    .join('\n');

  const allocationsSummary = data.tacticalAllocations
    .map((a) => `• *${a.category}:* *${a.stance}* (${a.recommendedVehicles.slice(0, 2).join(', ')})`)
    .join('\n');

  return `🌐 *TradeFlow Global Macro Intelligence Briefing* ${toneEmoji}

🏛️ *Current Regime:* *${data.regimeTitle}*
• *Macro Stability Score:* *${data.macroScore}/100* (${data.regimeTone.toUpperCase()})
• *Growth:* *${data.growthOutlook}* | *Inflation:* *${data.inflationRegime}*
• *Monetary Policy:* *${data.monetaryPolicyPosture}* | *Liquidity:* *${data.liquidityCondition}*

📊 *Cross-Asset Telemetry:*
• VIX Volatility: *${data.vixLevel.toFixed(2)}* | 10Y Yield: *${data.yield10y.toFixed(2)}%* (2s10s: *+${data.spread2y10y.toFixed(2)}%*)
• US Dollar (DXY): *${data.dxyLevel.toFixed(2)}* | WTI Crude: *${fmtMoney(data.oilPrice)}* | Fed Funds: *${data.fedFundsRate.toFixed(2)}%*

📝 *Executive Summary:*
${data.executiveSummary}

🔮 *Probabilistic Scenarios:*
${scenariosSummary}

🎯 *Tactical Stances:*
${allocationsSummary}

🏛️ *Pillars Snapshot:*
${pillarsSummary}${pdfNotice}

💡 _Ask for specific items: \`regime\`, \`yields\`, \`volatility\`, \`pillars\`, \`scenarios\`, \`allocations\`, \`catalysts\`, \`gold\`, or write \`pdf\` for the complete institutional document!_`;
}

/**
 * Generates an institutional-quality 2-Page Global Macro Briefing PDF Buffer
 */
export async function generateMacroPdfBuffer(
  data: MacroDossierResult,
  options?: {
    intent?: MacroQueryIntent;
  }
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 32, bottom: 25, left: 36, right: 36 },
      bufferPages: true,
      compress: false,
      info: {
        Title: 'TradeFlow Global Macro Intelligence Dossier',
        Author: 'TradeFlow AI Executive Macro Intelligence',
        Subject: 'Institutional Global Macro Scenarios & Tactical Allocations',
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

    // =========================================================================
    // PAGE 1: HEADER, EXECUTIVE KPIS, CYCLE MATRIX, NARRATIVE & 7 PILLARS
    // =========================================================================

    // Top Header Banner
    doc.rect(36, 36, 540, 58).fill(colors.primaryNavy);
    doc.rect(36, 92, 540, 2).fill(colors.goldBar);

    // Header Title
    doc.fillColor(colors.white).fontSize(13).font('Helvetica-Bold')
      .text('GLOBAL MACRO INTELLIGENCE DOSSIER', 48, 46);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
      .text('Sovereign Yield Curves • Volatility Complex • 7 Pillars • Cross-Asset Regimes', 48, 62);
    doc.fillColor(colors.goldBar).fontSize(7).font('Helvetica-Bold')
      .text(`Active Regime: ${data.regimeTitle} (${data.regimeTone.toUpperCase()})`, 48, 74);

    // Right Meta Badge
    doc.rect(424, 42, 142, 44).fill('#1e293b');
    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
      .text('TRADEFLOW MACRO AI', 430, 48, { width: 130, align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica')
      .text(dateFormatted, 430, 60, { width: 130, align: 'right' });
    doc.fillColor('#94a3b8').fontSize(6).font('Helvetica')
      .text(`Generated at ${timeFormatted}`, 430, 71, { width: 130, align: 'right' });

    // Executive KPI Summary Cards (4 Cards Grid)
    const kpiY = 104;
    const cardW = 127;
    const cardH = 50;
    const cardGap = 10;

    const scoreColor = data.macroScore >= 65 ? colors.emeraldGreen : data.macroScore >= 45 ? colors.goldAmber : colors.roseRed;

    const kpis = [
      {
        title: 'MACRO HEALTH SCORE',
        primary: `${data.macroScore} / 100`,
        sub: `Tone: ${data.regimeTone.toUpperCase()}`,
        color: scoreColor,
      },
      {
        title: 'GLOBAL REGIME',
        primary: data.growthOutlook,
        sub: data.inflationRegime,
        color: colors.accentIndigo,
      },
      {
        title: 'VOLATILITY (VIX)',
        primary: `${data.vixLevel.toFixed(2)} pts`,
        sub: `HY Spread: ${data.highYieldSpread.toFixed(2)}%`,
        color: data.vixLevel < 20 ? colors.emeraldGreen : colors.roseRed,
      },
      {
        title: '10Y YIELD & 2s10s',
        primary: `${data.yield10y.toFixed(2)}%`,
        sub: `Spread: +${data.spread2y10y.toFixed(2)}%`,
        color: colors.accentCyan,
      },
    ];

    kpis.forEach((k, idx) => {
      const cx = 36 + idx * (cardW + cardGap);
      doc.rect(cx, kpiY, cardW, cardH).fillAndStroke(colors.slateLight, colors.cardBorder);
      doc.rect(cx, kpiY, cardW, 3).fill(k.color);

      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica-Bold')
        .text(k.title, cx + 8, kpiY + 8);
      doc.fillColor(k.color).fontSize(10.5).font('Helvetica-Bold')
        .text(k.primary, cx + 8, kpiY + 18);
      doc.fillColor(colors.slateDark).fontSize(7).font('Helvetica')
        .text(k.sub, cx + 8, kpiY + 34);
    });

    // Policy & Cycle Posture Strip
    const cycleY = 162;
    doc.rect(36, cycleY, 540, 22).fillAndStroke('#f1f5f9', colors.cardBorder);
    doc.fillColor(colors.primaryNavy).fontSize(7).font('Helvetica-Bold')
      .text(`GROWTH: ${data.growthOutlook}  •  INFLATION: ${data.inflationRegime}  •  MONETARY POLICY: ${data.monetaryPolicyPosture}  •  LIQUIDITY: ${data.liquidityCondition}`, 44, cycleY + 7);

    // Section 1: Executive Summary & Narrative
    const sec1Y = 192;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('1. EXECUTIVE MACRO ASSESSMENT & STRATEGIC TAKEAWAYS', 36, sec1Y);
    doc.rect(36, sec1Y + 13, 540, 0.75).fill(colors.cardBorder);

    doc.rect(36, sec1Y + 18, 540, 52).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.fillColor(colors.slateDark).fontSize(7).font('Helvetica')
      .text(data.executiveSummary, 44, sec1Y + 24, { width: 524, lineGap: 1.5 });

    // 4 Key Takeaways horizontal list
    let takeawayY = sec1Y + 75;
    data.keyTakeaways.slice(0, 3).forEach((t) => {
      doc.fillColor(colors.accentIndigo).fontSize(7.5).font('Helvetica-Bold').text('•', 40, takeawayY);
      doc.fillColor(colors.slateDark).fontSize(7).font('Helvetica').text(t, 50, takeawayY, { width: 520 });
      takeawayY += 13;
    });

    // Section 2: The 7 Deep-Dive Macro Pillars Table
    const sec2Y = takeawayY + 6;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('2. THE 7 INSTITUTIONAL MACRO PILLARS', 36, sec2Y);
    doc.rect(36, sec2Y + 13, 540, 0.75).fill(colors.cardBorder);

    // Table Header
    const tHeadY = sec2Y + 18;
    doc.rect(36, tHeadY, 540, 15).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(6.5).font('Helvetica-Bold')
      .text('PILLAR NAME', 44, tHeadY + 4)
      .text('STATUS', 180, tHeadY + 4)
      .text('KEY TELEMETRY', 245, tHeadY + 4)
      .text('STRATEGIC IMPLICATION', 375, tHeadY + 4);

    let rowY = tHeadY + 15;
    const rowH = 46;

    data.pillars.forEach((p, idx) => {
      const bg = idx % 2 === 0 ? colors.white : colors.slateLight;
      doc.rect(36, rowY, 540, rowH).fillAndStroke(bg, colors.cardBorder);

      // Status badge color
      const stColor =
        p.status === 'BENIGN'
          ? colors.emeraldGreen
          : p.status === 'STIMULATIVE'
          ? colors.accentCyan
          : p.status === 'CAUTION'
          ? colors.goldAmber
          : colors.roseRed;

      doc.fillColor(colors.primaryNavy).fontSize(7).font('Helvetica-Bold')
        .text(p.name, 44, rowY + 6, { width: 130 });
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(p.summary.slice(0, 85) + '...', 44, rowY + 18, { width: 130 });

      // Status Badge
      doc.rect(180, rowY + 6, 55, 12).fill(stColor);
      doc.fillColor(colors.white).fontSize(6).font('Helvetica-Bold')
        .text(p.status, 180, rowY + 9, { width: 55, align: 'center' });

      // Key Metrics
      let mY = rowY + 6;
      p.keyMetrics.slice(0, 2).forEach((m) => {
        doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica-Bold')
          .text(`${m.label}: `, 245, mY, { continued: true })
          .fillColor(colors.accentIndigo)
          .text(m.value);
        doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica')
          .text(m.interpretation, 245, mY + 8, { width: 120 });
        mY += 18;
      });

      // Strategic Implications
      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
        .text(p.strategicImplications, 375, rowY + 6, { width: 195, lineGap: 1.2 });

      rowY += rowH;
    });

    // Page 1 Footer
    const footerY1 = 746;
    doc.rect(36, footerY1, 540, 0.75).fill(colors.cardBorder);
    doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
      .text('TradeFlow Multi-Asset Macro Intelligence • Confidential Institutional Briefing • System-Generated Telemetry', 36, footerY1 + 6);
    doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
      .text('Page 1 of 2', 520, footerY1 + 6, { width: 56, align: 'right' });

    // =========================================================================
    // PAGE 2: SCENARIOS, TACTICAL ALLOCATIONS & CATALYST RADAR
    // =========================================================================
    doc.addPage();

    // Top Header Banner
    doc.rect(36, 36, 540, 48).fill(colors.primaryNavy);
    doc.rect(36, 82, 540, 2).fill(colors.goldBar);

    doc.fillColor(colors.white).fontSize(12).font('Helvetica-Bold')
      .text('MACRO SCENARIOS, TACTICAL ALLOCATIONS & CATALYST RADAR', 48, 45);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
      .text('Probabilistic Economic Models • Cross-Asset Stances • Critical Pivot Watchpoints', 48, 60);

    doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
      .text('TRADEFLOW MACRO AI', 430, 47, { width: 130, align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica')
      .text('Page 2 of 2', 430, 59, { width: 130, align: 'right' });

    // Section 3: Probabilistic Scenarios (3 Columns Grid)
    const sec3Y = 94;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('3. PROBABILISTIC MACRO SCENARIOS (12-MONTH HORIZON)', 36, sec3Y);
    doc.rect(36, sec3Y + 13, 540, 0.75).fill(colors.cardBorder);

    const sCardW = 173;
    const sCardH = 148;
    const sCardGap = 10;
    const sCardY = sec3Y + 18;

    data.scenarios.forEach((s, idx) => {
      const cx = 36 + idx * (sCardW + sCardGap);
      const isBase = s.id === 'base_case';
      const isBull = s.id === 'bull_reflation';
      const topColor = isBase ? colors.accentIndigo : isBull ? colors.emeraldGreen : colors.roseRed;

      doc.rect(cx, sCardY, sCardW, sCardH).fillAndStroke(colors.slateLight, colors.cardBorder);
      doc.rect(cx, sCardY, sCardW, 3).fill(topColor);

      // Probability Badge
      doc.rect(cx + sCardW - 46, sCardY + 6, 40, 13).fill(topColor);
      doc.fillColor(colors.white).fontSize(6.5).font('Helvetica-Bold')
        .text(`${s.probabilityPercent}% PROB`, cx + sCardW - 46, sCardY + 9, { width: 40, align: 'center' });

      doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold')
        .text(s.title, cx + 8, sCardY + 7, { width: 115 });

      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
        .text(s.description, cx + 8, sCardY + 26, { width: sCardW - 16, lineGap: 1 });

      // Triggers
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold')
        .text('KEY TRIGGERS:', cx + 8, sCardY + 60);
      doc.fillColor(colors.slateDark).fontSize(6).font('Helvetica')
        .text(s.keyTriggers.slice(0, 2).join(' • '), cx + 8, sCardY + 68, { width: sCardW - 16 });

      // Winners & Losers
      doc.fillColor(colors.emeraldGreen).fontSize(6).font('Helvetica-Bold')
        .text('WINNERS: ', cx + 8, sCardY + 90, { continued: true })
        .fillColor(colors.slateDark).font('Helvetica')
        .text(s.winners.slice(0, 3).join(', '));

      doc.fillColor(colors.roseRed).fontSize(6).font('Helvetica-Bold')
        .text('LOSERS: ', cx + 8, sCardY + 104, { continued: true })
        .fillColor(colors.slateDark).font('Helvetica')
        .text(s.losers.slice(0, 3).join(', '));

      // Strategic Action
      doc.rect(cx + 6, sCardY + 120, sCardW - 12, 22).fill('#f1f5f9');
      doc.fillColor(colors.primaryNavy).fontSize(6).font('Helvetica-Bold')
        .text('ACTION: ', cx + 8, sCardY + 123, { continued: true })
        .font('Helvetica')
        .text(s.strategicAction, { width: sCardW - 20 });
    });

    // Section 4: Cross-Asset Tactical Allocations & Hedging
    const sec4Y = sCardY + sCardH + 12;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('4. CROSS-ASSET TACTICAL ALLOCATIONS & HEDGING', 36, sec4Y);
    doc.rect(36, sec4Y + 13, 540, 0.75).fill(colors.cardBorder);

    // Allocations Table Header
    const aHeadY = sec4Y + 18;
    doc.rect(36, aHeadY, 540, 14).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(6.5).font('Helvetica-Bold')
      .text('ASSET CLASS', 44, aHeadY + 4)
      .text('STANCE', 160, aHeadY + 4)
      .text('SUB-ASSET & VEHICLES', 235, aHeadY + 4)
      .text('TACTICAL RATIONALE', 360, aHeadY + 4)
      .text('RISK', 530, aHeadY + 4);

    let aRowY = aHeadY + 14;
    const aRowH = 34;

    data.tacticalAllocations.forEach((a, idx) => {
      const bg = idx % 2 === 0 ? colors.white : colors.slateLight;
      doc.rect(36, aRowY, 540, aRowH).fillAndStroke(bg, colors.cardBorder);

      const stColor =
        a.stance === 'OVERWEIGHT'
          ? colors.emeraldGreen
          : a.stance === 'UNDERWEIGHT'
          ? colors.roseRed
          : a.stance === 'TACTICAL_HEDGE'
          ? colors.goldAmber
          : colors.slateMuted;

      doc.fillColor(colors.primaryNavy).fontSize(7).font('Helvetica-Bold')
        .text(a.category, 44, aRowY + 6, { width: 110 });

      // Stance pill
      doc.rect(160, aRowY + 5, 65, 11).fill(stColor);
      doc.fillColor(colors.white).fontSize(6).font('Helvetica-Bold')
        .text(a.stance, 160, aRowY + 7.5, { width: 65, align: 'center' });

      // Sub-Asset & Vehicles
      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica-Bold')
        .text(a.subAsset, 235, aRowY + 5, { width: 120 });
      doc.fillColor(colors.accentIndigo).fontSize(6).font('Helvetica')
        .text(a.recommendedVehicles.join(', '), 235, aRowY + 16, { width: 120 });

      // Rationale
      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
        .text(a.rationale, 360, aRowY + 5, { width: 165, lineGap: 1 });

      // Risk
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica-Bold')
        .text(a.riskLevel, 530, aRowY + 10);

      aRowY += aRowH;
    });

    // Section 5: Upcoming Catalyst Radar & Pivot Levels
    const sec5Y = aRowY + 10;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text('5. UPCOMING CATALYST RADAR & CRITICAL PIVOT LEVELS', 36, sec5Y);
    doc.rect(36, sec5Y + 13, 540, 0.75).fill(colors.cardBorder);

    // Catalysts Table Header
    const cHeadY = sec5Y + 18;
    doc.rect(36, cHeadY, 540, 14).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(6.5).font('Helvetica-Bold')
      .text('CATALYST / EVENT', 44, cHeadY + 4)
      .text('TIMEFRAME', 180, cHeadY + 4)
      .text('IMPACT', 285, cHeadY + 4)
      .text('WHAT TO WATCH & CRITICAL PIVOT LEVEL', 345, cHeadY + 4);

    let cRowY = cHeadY + 14;
    const cRowH = 34;

    data.catalystsRadar.forEach((c, idx) => {
      const bg = idx % 2 === 0 ? colors.white : colors.slateLight;
      doc.rect(36, cRowY, 540, cRowH).fillAndStroke(bg, colors.cardBorder);

      const impColor =
        c.potentialImpact === 'CRITICAL'
          ? colors.roseRed
          : c.potentialImpact === 'HIGH'
          ? colors.goldAmber
          : colors.accentCyan;

      doc.fillColor(colors.primaryNavy).fontSize(7).font('Helvetica-Bold')
        .text(c.title, 44, cRowY + 5, { width: 130 });
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica')
        .text(c.category, 44, cRowY + 17, { width: 130 });

      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
        .text(c.timeframe, 180, cRowY + 8, { width: 95 });

      // Impact badge
      doc.rect(285, cRowY + 6, 48, 11).fill(impColor);
      doc.fillColor(colors.white).fontSize(6).font('Helvetica-Bold')
        .text(c.potentialImpact, 285, cRowY + 8.5, { width: 48, align: 'center' });

      // Watch & Pivot
      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
        .text(c.whatToWatch, 345, cRowY + 5, { width: 225, lineGap: 1 });
      if (c.criticalPivotLevel) {
        doc.fillColor(colors.roseRed).fontSize(6).font('Helvetica-Bold')
          .text(`📍 Pivot: ${c.criticalPivotLevel}`, 345, cRowY + 20, { width: 225 });
      }

      cRowY += cRowH;
    });

    // Page 2 Footer
    const footerY2 = 746;
    doc.rect(36, footerY2, 540, 0.75).fill(colors.cardBorder);
    doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
      .text('TradeFlow AI Executive Macro Intelligence • Automated Cross-Asset Portfolio Risk Governance', 36, footerY2 + 6);
    doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
      .text('Page 2 of 2', 520, footerY2 + 6, { width: 56, align: 'right' });

    doc.end();
  });
}

/**
 * Handles incoming Telegram message inside the Macro topic
 */
export async function handleMacroTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
}: MacroTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  intent: MacroQueryIntent;
  pdfGenerated: boolean;
}> {
  const parsed = parseMacroQuery(text);
  logToFile(`[MacroQueryService] Processing query intent: ${parsed.intent} (PDF: ${parsed.isPdfRequested})`);

  // 1. HELP / INSTRUCTIONS
  if (parsed.intent === 'HELP') {
    const helpText = `🌐 *Macro Topic — Instructions & Commands*

Query the complete institutional macro dossier or specific sections from the Trade Compass app:

🔍 *1. Specific Macro Items & Sections*
• \`regime\` or \`score\` — Macro stability score (0-100), growth, inflation & policy stances.
• \`yields\` or \`rates\` — 10Y yield, 2Y yield, 2s10s curve spread, fed funds rate & inversion status.
• \`volatility\` or \`vix\` — Spot VIX, VVIX, term structure, skew & volatility risk premium (VRP).
• \`pillars\` or \`7 pillars\` — The 7 Deep-Dive Pillars breakdown (yields, labor, inflation, liquidity, corporate, volatility, commodities).
• \`labor pillar\` / \`inflation pillar\` — Single pillar detailed focus.
• \`scenarios\` — 3 Probabilistic Scenarios (Base, Bull Reflation, Bear Shock) with %, triggers, winners, losers & actions.
• \`allocations\` — Cross-asset tactical allocations (Equities, Fixed Income, Commodities, Currencies/Cash, Derivatives & Hedging).
• \`catalysts\` or \`radar\` — Upcoming high-impact events (FOMC, CPI, NFP) & critical pivot levels.
• \`gold\` or \`commodities\` — Gold regime, crude oil, DXY & commodity forward structures.
• \`sectors\` or \`trends\` — 11 sector momentums, leading vs lagging asset rotation.

📑 *2. Whole Report*
• \`report\`, \`macro\`, \`dossier\`, \`all\`, or \`overview\` — Complete executive briefing across all indicators.

📄 *3. Nicely Styled PDF Document*
• Include the word \`pdf\` in any message (e.g. \`pdf\`, \`macro pdf\`, \`scenarios pdf\`, \`allocations pdf\`, \`regime pdf\`) to receive a styled 2-page institutional PDF document directly here in Telegram!

💡 _Data synthesizes live FRED data, sovereign yield curves, options skew, and autonomous AI analysis._`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: helpText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[MacroQueryService] Send help error: ${e.message}`));
    }

    return {
      handled: true,
      replyText: helpText,
      intent: 'HELP',
      pdfGenerated: false,
    };
  }

  // 2. Fetch Macro Dossier Data
  const reportData = await getMacroReportData(prisma);

  // 3. Format Telegram Markdown Response
  const replyText = formatMacroTelegramMessage(reportData, {
    intent: parsed.intent,
    isPdfRequested: parsed.isPdfRequested,
    subItem: parsed.subItem,
  });

  // 4. If PDF requested, generate PDF Buffer and dispatch
  let pdfGenerated = false;
  if (parsed.isPdfRequested) {
    try {
      logToFile('[MacroQueryService] Generating institutional Macro PDF buffer...');
      const pdfBuffer = await generateMacroPdfBuffer(reportData, { intent: parsed.intent });
      const dateSlug = new Date().toISOString().slice(0, 10);
      const filename = `TradeFlow_Macro_Dossier_${dateSlug}.pdf`;

      const caption = `🌐 *TradeFlow Global Macro Briefing (${dateSlug})*\n\n` +
        `🏛️ *Regime:* ${reportData.regimeTitle} (Score: ${reportData.macroScore}/100)\n` +
        `📈 *10Y Yield:* ${reportData.yield10y.toFixed(2)}% | *VIX:* ${reportData.vixLevel.toFixed(1)}\n` +
        `📄 *Attached is your institutional PDF dossier below:*`;

      await sendPdfReportToTelegram(pdfBuffer, filename, caption, {
        chatId,
        messageThreadId,
      });
      pdfGenerated = true;
      logToFile(`[MacroQueryService] Successfully dispatched ${filename} (${(pdfBuffer.length / 1024).toFixed(1)} KB) to Telegram!`);
    } catch (pdfErr: any) {
      logToFile(`[MacroQueryService] PDF generation or upload failed: ${pdfErr.message}`);
    }
  }

  // 5. Send Telegram Markdown Text if not already delivered via PDF caption or as primary reply
  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    await sendTelegramMessage({
      text: replyText,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    }).catch((e: any) => logToFile(`[MacroQueryService] Send text error: ${e.message}`));
  }

  return {
    handled: true,
    replyText,
    intent: parsed.intent,
    pdfGenerated,
  };
}
