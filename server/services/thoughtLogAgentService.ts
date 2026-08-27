import YahooFinance from 'yahoo-finance2';
import { agentActivityTracker } from './agentActivityService';

const logToFile = (msg: string) => console.log(msg);

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type AgentActionType =
  | 'ADD_CONTEXT'
  | 'CHECK_ASSUMPTIONS'
  | 'RESEARCH_FURTHER'
  | 'ORGANIZE_THESIS'
  | 'PROPOSE_STRUCTURES'
  | 'CUSTOM_QUERY';

export interface ThoughtLogMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  pe?: number;
  operatingMargins?: number;
  debtToEquity?: number;
}

export interface RunAgentOnThoughtParams {
  logId?: string;
  title: string;
  content: string;
  actionType: AgentActionType;
  customPrompt?: string;
  sentiment?: string;
  tags?: string[];
  existingAgentOutput?: string;
}

export interface ThoughtAgentResult {
  markdownOutput: string;
  actionType: AgentActionType;
  detectedSymbols: string[];
  marketData: ThoughtLogMarketData[];
  suggestedTags: string[];
  refinedTitle?: string;
  structuredData?: any;
}

/**
 * Extracts potential stock symbols from freeform text
 */
export function extractSymbolsFromText(text: string): string[] {
  if (!text) return [];

  // Remove timestamps like "09:11 AM", "10:30 PM", "9:15 am", etc. before extracting
  const sanitizedText = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/gi, ' ');

  // 1. High confidence: $TICKER matches (e.g. $NVDA, $PLTR, $AAPL)
  const dollarMatches = (sanitizedText.match(/\$([A-Z]{1,6})\b/g) || []).map((s) => s.replace('$', '').toUpperCase());
  
  // 2. Uppercase word matches (2 to 5 uppercase characters)
  const wordMatches = (sanitizedText.match(/\b[A-Z]{2,5}\b/g) || []).map((s) => s.toUpperCase());

  // Comprehensive stop words & non-ticker acronyms
  const commonWords = new Set([
    // Time & Dates & Timezones
    'AM', 'PM', 'EST', 'EDT', 'PST', 'PDT', 'CST', 'CDT', 'UTC', 'GMT',
    'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    'TODAY', 'WEEK', 'MONTH', 'YEAR', 'TIME', 'DATE', 'HOUR', 'MIN', 'SEC', 'DAILY',
    
    // Common English 2-letter & 3-letter words
    'IS', 'IT', 'AT', 'ON', 'IN', 'TO', 'IF', 'DO', 'GO', 'NO', 'SO', 'UP', 'MY', 'BY',
    'OR', 'AS', 'HE', 'WE', 'ME', 'US', 'OK', 'AN', 'BE', 'OF', 'THE', 'AND', 'FOR',
    'NOT', 'BUT', 'ALL', 'ANY', 'CAN', 'SEE', 'GET', 'SET', 'PUT', 'RUN', 'LET', 'DID',
    'NOW', 'OUT', 'OFF', 'WHY', 'HOW', 'WHO', 'YOU', 'HIS', 'HER', 'OUR', 'ITS', 'LOT',
    'FEW', 'WAY', 'END', 'OLD', 'NEW', 'BIG', 'TOP', 'LOW', 'BAD', 'BOY', 'MAN', 'JOB',
    'KEY', 'PAY', 'BUY', 'HIT', 'TRY', 'ASK', 'OWN', 'TOO', 'YES', 'DIP', 'MID', 'MAX', 'MIN',

    // Common English 4-letter & 5-letter words
    'WITH', 'FROM', 'THIS', 'THAT', 'HAVE', 'WILL', 'WHAT', 'WHEN', 'THEN', 'SOME',
    'JUST', 'MORE', 'VERY', 'MUCH', 'OVER', 'INTO', 'BEEN', 'LIKE', 'THEY', 'THEIR',
    'ABOUT', 'AFTER', 'BEFORE', 'COULD', 'WOULD', 'SHOULD', 'WHICH', 'WHERE', 'THESE',
    'THOSE', 'BECAUSE', 'HERE', 'THERE', 'EACH', 'BOTH', 'MANY', 'SUCH', 'EVEN', 'MOST',
    'ALSO', 'BACK', 'WELL', 'ONLY', 'DOWN', 'REAL', 'GOOD', 'BEST', 'LONG', 'SHORT',
    'OPEN', 'STOP', 'RISK', 'SELL', 'CASH', 'LOSS', 'GAIN', 'DROP', 'PUMP', 'DUMP',
    'HOLD', 'FEEL', 'LOOK', 'SEEM', 'TAKE', 'MAKE', 'KNOW', 'CALL', 'PUTS', 'TRADE',
    'TRADES', 'IDEA', 'IDEAS', 'WATCH', 'PRICE', 'LEVEL', 'MONEY', 'RALLY',

    // Financial / Tech Acronyms (not equities)
    'PE', 'EPS', 'FCF', 'ROE', 'ROIC', 'ROA', 'EBITDA', 'EBIT', 'NAV', 'CAGR',
    'CPI', 'PPI', 'GDP', 'PMI', 'VIX', 'DXY', 'YTD', 'MTD', 'QOQ', 'YOY',
    'DTE', 'ATM', 'OTM', 'ITM', 'IVR', 'IV', 'HV', 'OI', 'VOL',
    'AI', 'SAAS', 'EV', 'GPU', 'CPU', 'SMR', 'CEO', 'CFO', 'CTO', 'COO', 'CIO',
    'IPO', 'LLC', 'INC', 'CORP', 'LTD', 'PDF', 'URL', 'API', 'APP', 'BOT', 'MSG', 'SMS',
    'LOG', 'NOTE', 'POST', 'TEXT', 'SYNC', 'EDIT', 'VIEW', 'CHART', 'GRAPH'
  ]);

  const candidates = [...dollarMatches, ...wordMatches.filter((w) => !commonWords.has(w))];
  return Array.from(new Set(candidates)).slice(0, 6);
}

/**
 * Fetches live market telemetry for detected symbols
 */
export async function fetchMarketTelemetryForSymbols(symbols: string[]): Promise<ThoughtLogMarketData[]> {
  if (symbols.length === 0) return [];

  const results: ThoughtLogMarketData[] = [];

  for (const sym of symbols) {
    try {
      const quote: any = await yahooFinance.quote(sym);
      if (quote && quote.regularMarketPrice !== undefined) {
        results.push({
          symbol: sym,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
          marketCap: quote.marketCap,
          pe: quote.trailingPE || quote.forwardPE,
          operatingMargins: quote.operatingMargins,
          debtToEquity: quote.debtToEquity,
        });
      }
    } catch {
      // Graceful fallback for non-ticker abbreviations
    }
  }

  return results;
}

/**
 * Builds system & user prompts for specific agent action
 */
function buildPrompts(
  params: RunAgentOnThoughtParams,
  detectedSymbols: string[],
  marketData: ThoughtLogMarketData[]
): { systemPrompt: string; userPrompt: string } {
  const { title, content, actionType, customPrompt, sentiment, tags } = params;

  const marketSummaryText = marketData.length > 0
    ? `\n\nLIVE MARKET TELEMETRY ON DETECTED ASSETS:\n` +
      marketData
        .map((m) => {
          return `• **${m.symbol}**: Price $${m.price.toFixed(2)} (${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}%), 52W High $${m.fiftyTwoWeekHigh || 'N/A'}, 52W Low $${m.fiftyTwoWeekLow || 'N/A'}, Trailing P/E: ${m.pe ? m.pe.toFixed(1) + 'x' : 'N/A'}, Market Cap: ${m.marketCap ? '$' + (m.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}`;
        })
        .join('\n')
    : '';

  let actionSpecificInstructions = '';

  switch (actionType) {
    case 'ADD_CONTEXT':
      actionSpecificInstructions = `
YOUR OBJECTIVE: ENRICH WITH CONTEXT & MARKET TRUTH.
1. Provide essential fundamental, macro, and competitive context for the ideas or tickers mentioned.
2. Outline recent earnings/catalyst backdrop, industry trends, pricing power dynamics, and valuation sanity checks.
3. Highlight key external variables (interest rates, commodity inputs, regulatory landscape) that could impact the thoughts.
4. Format cleanly using Markdown with bold headings, bullet points, and data callout boxes.`;
      break;

    case 'CHECK_ASSUMPTIONS':
      actionSpecificInstructions = `
YOUR OBJECTIVE: RED TEAM / DEVIL'S ADVOCATE & ASSUMPTION STRESS-TEST.
1. Scrutinize the user's premise with rigorous objectivity.
2. Identify potential cognitive biases (e.g., recency bias, narrative fallacy, anchoring).
3. Identify hidden risks, margin compression vulnerabilities, debt refinancing cliffs, or competitive threats the author may have overlooked.
4. What has the market already priced in? Why might the consensus disagree?
5. State explicit **Thesis Invalidation Criteria**: What exact data point, metric drop, or price level would definitively prove this thesis wrong?`;
      break;

    case 'RESEARCH_FURTHER':
      actionSpecificInstructions = `
YOUR OBJECTIVE: DEEP FORENSIC RESEARCH & CATALYST MAPPING.
1. Investigate supply chain dependencies, customer concentration risks, and product roadmap milestones.
2. Map out upcoming calendar events: earnings dates, OpEx, product launches, or policy decisions.
3. Compare key valuation and profitability metrics to direct industry peers.
4. Uncover subtle SEC 10-K/10-Q risk disclosures and short-seller counter-theses.`;
      break;

    case 'ORGANIZE_THESIS':
      actionSpecificInstructions = `
YOUR OBJECTIVE: TRANSFORM RAW STREAM-OF-CONSCIOUSNESS INTO INSTITUTIONAL DOSSIER.
Synthesize the user's thoughts into a world-class Hedge Fund Investment Thesis formatted as follows:
- **🎯 Executive Thesis & Core Premise**: Crisp 2-3 sentence executive thesis statement.
- **📊 Fundamental & Valuation Pillars**: 3-4 structural supporting pillars with quantitative metrics.
- **🚀 High-Probability Catalysts**: Chronological roadmap of upcoming triggers.
- **⚠️ Key Risks & Invalidation Triggers**: Clear exit/stop-loss criteria.
- **💼 Tactical Execution & Sizing Stance**: Recommended conviction score (1-100), holding timeframe, and risk allocation.`;
      break;

    case 'PROPOSE_STRUCTURES':
      actionSpecificInstructions = `
YOUR OBJECTIVE: GENERATE ACTIONABLE DERIVATIVES & EXECUTION STRUCTURES.
Based on the user's directional bias, volatility outlook, and thesis timeframe, propose 2-3 specific tactical execution structures:
1. **Asymmetric Growth Play**: (e.g., Bull Call Spread, Long Call LEAPs, or Ratio Spread) with optimal strike selection and DTE.
2. **Defensive / Income Generation**: (e.g., Cash-Secured Put, Covered Strangle, or Put Credit Spread) to monetize elevated implied volatility.
3. **Downside / Tail-Risk Hedge**: (e.g., Collar, Put Debit Spread, or VIX Call Hedge) to protect capital.
Specify target strikes, risk/reward ratios, max profit, and break-even levels.`;
      break;

    case 'CUSTOM_QUERY':
      actionSpecificInstructions = `
YOUR OBJECTIVE: ANSWER THE USER'S SPECIFIC INQUIRY WITH DEEP FINANCIAL EXPERTISE.
User's Question/Directive: "${customPrompt || 'Analyze and critique these thoughts.'}"
Provide a thorough, mathematically sound, and insightful analysis directly addressing their query.`;
      break;
  }

  const systemPrompt = `You are the Lead Portfolio Strategist and AI Research Copilot for TradeFlow.
You assist professional traders, hedge fund analysts, and active investors in refining their thoughts, fact-checking hypotheses, identifying unpriced risks, and organizing messy ideas into actionable institutional investment theses.
Always be intellectually honest, rigorous, data-driven, and clear. Avoid generic fluff. Use institutional finance terminology correctly.

${actionSpecificInstructions}`;

  const userPrompt = `HERE ARE THE TRADER'S THOUGHTS TO ANALYZE:
==================================================
Title: ${title || 'Untitled Thought Log'}
Sentiment Tag: ${sentiment || 'NEUTRAL'}
Tags: ${tags?.join(', ') || 'None specified'}
Detected Tickers: ${detectedSymbols.join(', ') || 'None explicitly detected'}

USER CONTENT:
"""
${content}
"""
${marketSummaryText}

Please execute your analysis now.`;

  return { systemPrompt, userPrompt };
}

/**
 * Main execution function for running AI Copilot on a Thought Log
 */
export async function runAgentOnThoughtLog(params: RunAgentOnThoughtParams): Promise<ThoughtAgentResult> {
  const { title, content, actionType } = params;

  // 1. Register task with live telemetry
  const task = agentActivityTracker.startTask({
    agentType: 'RESEARCH',
    symbol: params.tags?.[0] || 'LOG_COPILOT',
    taskDescription: `Thought Log Copilot: ${actionType.replace('_', ' ')} for "${title || 'Draft Log'}"`,
  });

  try {
    // 2. Detect Symbols & Fetch Live Market Data
    const detectedSymbols = extractSymbolsFromText(`${title} ${content}`);
    const marketData = await fetchMarketTelemetryForSymbols(detectedSymbols);

    // 3. Build Prompts
    const { systemPrompt, userPrompt } = buildPrompts(params, detectedSymbols, marketData);

    let markdownOutput = '';

    // 4. Query LLM via OpenRouter or Gemini
    if (process.env.OPENROUTER_API_KEY) {
      logToFile(`[ThoughtLogAgent] Querying OpenRouter for action: ${actionType}...`);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      markdownOutput = data.choices?.[0]?.message?.content || '';
    } else if (process.env.GEMINI_API_KEY) {
      logToFile(`[ThoughtLogAgent] Querying Gemini for action: ${actionType}...`);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      markdownOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Algorithmic Fallback when API keys are not yet configured
      logToFile(`[ThoughtLogAgent] No LLM API key present, using structured financial heuristic template...`);
      markdownOutput = generateAlgorithmicThoughtAnalysis(params, detectedSymbols, marketData);
    }

    // 5. Derive Suggested Tags
    const suggestedTags = Array.from(
      new Set([
        ...detectedSymbols,
        actionType.replace('_', ' ').toLowerCase(),
        params.sentiment?.toLowerCase() || 'thesis',
      ])
    ).filter(Boolean);

    agentActivityTracker.completeTask(task.id, {
      status: 'COMPLETED',
      resultSummary: `Generated ${actionType.replace('_', ' ')} analysis (${markdownOutput.length} chars) with ${marketData.length} live market quotes.`,
    });

    return {
      markdownOutput,
      actionType,
      detectedSymbols,
      marketData,
      suggestedTags,
    };
  } catch (error: any) {
    logToFile(`[ThoughtLogAgent] Error during execution: ${error.message}`);
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: error.message,
    });
    throw error;
  }
}

/**
 * High-quality fallback template when no external LLM key is configured
 */
function generateAlgorithmicThoughtAnalysis(
  params: RunAgentOnThoughtParams,
  detectedSymbols: string[],
  marketData: ThoughtLogMarketData[]
): string {
  const { title, content, actionType } = params;

  return `### 🤖 AI Copilot Analysis: ${actionType.replace('_', ' ')}

> **Note:** To unlock live LLM reasoning, please configure your OpenRouter or Gemini API key in **Settings**.

#### 📊 Detected Market Context
${
  marketData.length > 0
    ? marketData
        .map(
          (m) =>
            `- **${m.symbol}**: Spot Price **$${m.price.toFixed(2)}** (${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}%) | 52W Range: $${m.fiftyTwoWeekLow || 'N/A'} - $${m.fiftyTwoWeekHigh || 'N/A'} | Trailing P/E: ${m.pe ? m.pe.toFixed(1) + 'x' : 'N/A'}`
        )
        .join('\n')
    : `- *No specific equity ticker detected in text. Analysis applies to macro/thematic framework.*`
}

#### 🎯 Key Thesis Takeaways & Premises
- **Primary Focus:** ${title || 'Active Market Journal Entry'}
- **Core Stance:** ${params.sentiment || 'NEUTRAL'} positioning.
- **Log Synthesis:** The author explores fundamental drivers, sentiment shifts, and execution timing.

#### 🛡️ Assumption Stress-Testing & Devil's Advocate
1. **Valuation Sensitivity:** Confirm whether current multiples already discount expected growth over the next 12-18 months.
2. **Macro Interdependencies:** Monitor real interest rate changes, dollar strength (DXY), and credit spread widening.
3. **Invalidation Trigger:** Set explicit stop-loss or fundamental invalidation thresholds (e.g., broken 200 DMA or margin degradation).

#### 💡 Recommended Next Actions
- Set specific price alerts in the **Alerts** tab to track breakout/breakdown pivots.
- Model derivatives asymmetric payoff using the **Structures** tab.
`;
}
