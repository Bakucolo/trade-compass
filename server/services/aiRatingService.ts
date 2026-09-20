import YahooFinance from 'yahoo-finance2';
import { circuitBreaker, ChatMessage } from './llmFallbackRouter';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type AiRatingGrade = 'BUY' | 'HOLD' | 'SELL';
export type ConsensusGrade = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export interface ModelRatingResult {
  modelId: string;
  modelName: string;
  provider: string;
  rating: AiRatingGrade;
  conviction: number; // 1 to 10
  targetPrice?: number | null;
  upsidePercent?: number | null;
  bullThesis: string;
  bearRisk: string;
  summary: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface AiRatingConsensus {
  symbol: string;
  companyName: string;
  currentPrice: number;
  sector?: string;
  industry?: string;
  consensusRating: ConsensusGrade;
  blendedConviction: number; // 1.0 to 10.0
  convictionStrength: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'SPECULATIVE';
  ratingsCount: {
    BUY: number;
    HOLD: number;
    SELL: number;
  };
  buyPercentage: number;
  holdPercentage: number;
  sellPercentage: number;
  blendedTargetPrice?: number | null;
  impliedUpsidePercent?: number | null;
  consensusSummary: string;
  topBullDriver: string;
  topBearRisk: string;
  modelResults: ModelRatingResult[];
  analyzedAt: string;
}

interface EvaluatorConfig {
  id: string;
  name: string;
  provider: 'openrouter' | 'google-ai-studio' | 'groq';
  primaryModel: string;
  openRouterFallbackModel: string;
}

const EVALUATORS: EvaluatorConfig[] = [
  {
    id: 'claude-3-5',
    name: 'Claude 3.5 / Haiku',
    provider: 'openrouter',
    primaryModel: 'anthropic/claude-3-haiku',
    openRouterFallbackModel: 'anthropic/claude-3-haiku',
  },
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'openrouter',
    primaryModel: 'openai/gpt-4o-mini',
    openRouterFallbackModel: 'openai/gpt-3.5-turbo',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 / V3',
    provider: 'openrouter',
    primaryModel: 'deepseek/deepseek-chat',
    openRouterFallbackModel: 'deepseek/deepseek-r1:free',
  },
  {
    id: 'llama-3-3',
    name: 'Meta Llama 3.3 70B',
    provider: 'groq',
    primaryModel: 'llama-3.3-70b-versatile',
    openRouterFallbackModel: 'meta-llama/llama-3.3-70b-instruct',
  },
  {
    id: 'gemini-2-flash',
    name: 'Google Gemini Flash',
    provider: 'google-ai-studio',
    primaryModel: 'gemini-3.6-flash',
    openRouterFallbackModel: 'google/gemini-2.5-flash',
  },
];

/**
 * Strips markdown code fences from LLM response
 */
function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/, '');
  return cleaned.trim();
}

/**
 * Fetch live stock data to anchor the AI analysis with hard facts
 */
async function fetchStockContext(symbol: string) {
  const cleanSymbol = symbol.trim().toUpperCase();
  let quoteData: any = null;
  let summaryDetail: any = null;
  let defaultKeyStats: any = null;
  let financialData: any = null;
  let assetProfile: any = null;

  try {
    const summary = await yahooFinance.quoteSummary(cleanSymbol, {
      modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
    });
    quoteData = summary.price;
    summaryDetail = summary.summaryDetail;
    defaultKeyStats = summary.defaultKeyStatistics;
    financialData = summary.financialData;
    assetProfile = summary.assetProfile;
  } catch (err: any) {
    console.warn(`[AiRating] quoteSummary failed for ${cleanSymbol}:`, err.message);
    try {
      quoteData = await yahooFinance.quote(cleanSymbol);
    } catch (e: any) {
      console.warn(`[AiRating] fallback quote failed for ${cleanSymbol}:`, e.message);
    }
  }

  const currentPrice = Number(quoteData?.regularMarketPrice || quoteData?.price || 0);
  const companyName = quoteData?.longName || quoteData?.shortName || cleanSymbol;
  const sector = assetProfile?.sector || quoteData?.sector || 'Equities';
  const industry = assetProfile?.industry || quoteData?.industry || 'General';

  return {
    symbol: cleanSymbol,
    companyName,
    currentPrice,
    sector,
    industry,
    marketCap: quoteData?.marketCap || summaryDetail?.marketCap || defaultKeyStats?.enterpriseValue,
    pe: summaryDetail?.trailingPE || quoteData?.trailingPE,
    forwardPE: summaryDetail?.forwardPE || defaultKeyStats?.forwardPE,
    pegRatio: defaultKeyStats?.pegRatio,
    priceToSales: summaryDetail?.priceToSalesRaw || defaultKeyStats?.priceToSales,
    fiftyTwoWeekHigh: summaryDetail?.fiftyTwoWeekHigh || quoteData?.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: summaryDetail?.fiftyTwoWeekLow || quoteData?.fiftyTwoWeekLow,
    revenueGrowth: financialData?.revenueGrowth,
    operatingMargins: financialData?.operatingMargins,
    returnOnEquity: financialData?.returnOnEquity,
    freeCashflow: financialData?.freeCashflow,
    debtToEquity: financialData?.debtToEquity,
    targetMeanPrice: financialData?.targetMeanPrice,
    recommendationKey: financialData?.recommendationKey,
    businessSummary: assetProfile?.longBusinessSummary ? assetProfile.longBusinessSummary.slice(0, 300) : '',
  };
}

/**
 * Call a specific model and parse its structured rating
 */
async function querySingleModel(
  evaluator: EvaluatorConfig,
  stockContext: any
): Promise<ModelRatingResult> {
  const startTime = Date.now();
  const timeoutMs = 25000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const systemPrompt = `You are an elite institutional equity research analyst.
Evaluate the provided financial metrics and valuation context for the stock.
You must provide an objective rating ("BUY", "HOLD", or "SELL"), an integer conviction score from 1 (lowest) to 10 (highest), a 6-12 month price target, and a concise thesis.

Return ONLY a valid JSON object matching this schema:
{
  "rating": "BUY", // "BUY" | "HOLD" | "SELL"
  "conviction": 8, // Integer from 1 to 10
  "targetPrice": 165.0, // Numerical 6-12 month target price or null
  "upsidePercent": 15.0, // Expected upside/downside percentage
  "bullThesis": "Core 1-2 sentence bullish catalyst or quality compounder thesis.",
  "bearRisk": "Core 1-2 sentence primary downside risk or valuation headwind.",
  "summary": "Concise 1-2 sentence overall analytical assessment."
}`;

  const userPrompt = `Analyze ${stockContext.symbol} (${stockContext.companyName}):
• Sector: ${stockContext.sector} | Industry: ${stockContext.industry}
• Spot Price: $${stockContext.currentPrice.toFixed(2)}
• 52W Range: $${stockContext.fiftyTwoWeekLow || '—'} - $${stockContext.fiftyTwoWeekHigh || '—'}
• Trailing P/E: ${stockContext.pe ? stockContext.pe.toFixed(1) : 'N/A'} | Forward P/E: ${stockContext.forwardPE ? stockContext.forwardPE.toFixed(1) : 'N/A'}
• PEG Ratio: ${stockContext.pegRatio || 'N/A'} | Price/Sales: ${stockContext.priceToSales ? stockContext.priceToSales.toFixed(1) : 'N/A'}
• Revenue Growth: ${stockContext.revenueGrowth ? (stockContext.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}
• Operating Margin: ${stockContext.operatingMargins ? (stockContext.operatingMargins * 100).toFixed(1) + '%' : 'N/A'}
• ROE: ${stockContext.returnOnEquity ? (stockContext.returnOnEquity * 100).toFixed(1) + '%' : 'N/A'}
• Wall Street Mean Target: ${stockContext.targetMeanPrice ? '$' + stockContext.targetMeanPrice : 'N/A'}
${stockContext.businessSummary ? `• Overview: ${stockContext.businessSummary}` : ''}

Provide your institutional rating (BUY, HOLD, SELL), conviction (1-10), target price, and thesis.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    let rawText = '';

    // Route 1: Try primary provider if configured
    const openRouterKey = circuitBreaker.getApiKey('openrouter');
    const groqKey = circuitBreaker.getApiKey('groq');
    const geminiKey = circuitBreaker.getApiKey('google-ai-studio');

    if (evaluator.provider === 'groq' && groqKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: evaluator.primaryModel,
            messages,
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          rawText = data.choices?.[0]?.message?.content || '';
        }
      } catch (err: any) {
        console.warn(`[AiRating] Groq call failed for ${evaluator.name}:`, err.message);
      }
    } else if (evaluator.provider === 'google-ai-studio' && geminiKey) {
      try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${geminiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: evaluator.primaryModel,
            messages,
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          rawText = data.choices?.[0]?.message?.content || '';
        }
      } catch (err: any) {
        console.warn(`[AiRating] Gemini direct call failed for ${evaluator.name}:`, err.message);
      }
    }

    // Route 2: Fallback to OpenRouter (or primary for openrouter models)
    if (!rawText && openRouterKey) {
      const targetModel = evaluator.provider === 'openrouter' ? evaluator.primaryModel : evaluator.openRouterFallbackModel;
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://trade-compass.internal',
          'X-Title': 'Trade Compass AI Rating Matrix',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        rawText = data.choices?.[0]?.message?.content || '';
      } else {
        const errText = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 120)}`);
      }
    }

    clearTimeout(timeoutId);

    if (!rawText) {
      throw new Error(`No response received from model provider for ${evaluator.name}`);
    }

    const cleaned = cleanJsonText(rawText);
    const parsed = JSON.parse(cleaned);

    let rating: AiRatingGrade = 'HOLD';
    const rawRating = String(parsed.rating || '').toUpperCase();
    if (rawRating.includes('BUY')) rating = 'BUY';
    else if (rawRating.includes('SELL')) rating = 'SELL';
    else rating = 'HOLD';

    let conviction = Math.min(10, Math.max(1, Number(parsed.conviction) || 5));
    conviction = Math.round(conviction * 10) / 10;

    let targetPrice = parsed.targetPrice !== undefined && parsed.targetPrice !== null ? Number(parsed.targetPrice) : null;
    if (targetPrice !== null && (isNaN(targetPrice) || targetPrice <= 0)) targetPrice = null;

    let upsidePercent = parsed.upsidePercent !== undefined && parsed.upsidePercent !== null ? Number(parsed.upsidePercent) : null;
    if (upsidePercent === null && targetPrice && stockContext.currentPrice > 0) {
      upsidePercent = Math.round(((targetPrice - stockContext.currentPrice) / stockContext.currentPrice) * 1000) / 10;
    }

    return {
      modelId: evaluator.id,
      modelName: evaluator.name,
      provider: evaluator.provider,
      rating,
      conviction,
      targetPrice,
      upsidePercent,
      bullThesis: parsed.bullThesis || 'Durable competitive positioning.',
      bearRisk: parsed.bearRisk || 'Macro headwind sensitivity.',
      summary: parsed.summary || `${rating} recommendation with ${conviction}/10 conviction.`,
      latencyMs: Date.now() - startTime,
      success: true,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      modelId: evaluator.id,
      modelName: evaluator.name,
      provider: evaluator.provider,
      rating: 'HOLD',
      conviction: 5,
      bullThesis: 'Analysis unavailable.',
      bearRisk: 'Model timeout or rate limit.',
      summary: `Failed to evaluate via ${evaluator.name}: ${err.message}`,
      latencyMs: Date.now() - startTime,
      success: false,
      error: err.message,
    };
  }
}

/**
 * Synthesize blended consensus from multiple model outputs
 */
export function calculateConsensus(
  symbol: string,
  companyName: string,
  currentPrice: number,
  sector: string,
  industry: string,
  modelResults: ModelRatingResult[]
): AiRatingConsensus {
  const successful = modelResults.filter((m) => m.success);
  const total = successful.length > 0 ? successful.length : 1;

  const ratingsCount = { BUY: 0, HOLD: 0, SELL: 0 };
  let totalConviction = 0;
  const targetPrices: number[] = [];

  for (const m of successful) {
    ratingsCount[m.rating] = (ratingsCount[m.rating] || 0) + 1;
    totalConviction += m.conviction;
    if (m.targetPrice && m.targetPrice > 0) {
      targetPrices.push(m.targetPrice);
    }
  }

  const buyPercentage = Math.round((ratingsCount.BUY / total) * 100);
  const holdPercentage = Math.round((ratingsCount.HOLD / total) * 100);
  const sellPercentage = Math.round((ratingsCount.SELL / total) * 100);

  const blendedConviction = successful.length > 0 ? Math.round((totalConviction / total) * 10) / 10 : 5.0;

  // Determine Consensus Grade
  let consensusRating: ConsensusGrade = 'HOLD';
  if (buyPercentage >= 65 && blendedConviction >= 7.0) {
    consensusRating = 'STRONG_BUY';
  } else if (buyPercentage >= 50) {
    consensusRating = 'BUY';
  } else if (sellPercentage >= 65 && blendedConviction >= 7.0) {
    consensusRating = 'STRONG_SELL';
  } else if (sellPercentage >= 50) {
    consensusRating = 'SELL';
  } else {
    consensusRating = 'HOLD';
  }

  // Conviction strength qualitative category
  let convictionStrength: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'SPECULATIVE' = 'MODERATE';
  if (blendedConviction >= 8.5) convictionStrength = 'VERY_HIGH';
  else if (blendedConviction >= 7.0) convictionStrength = 'HIGH';
  else if (blendedConviction >= 5.5) convictionStrength = 'MODERATE';
  else if (blendedConviction >= 4.0) convictionStrength = 'LOW';
  else convictionStrength = 'SPECULATIVE';

  // Blended Target Price
  let blendedTargetPrice: number | null = null;
  let impliedUpsidePercent: number | null = null;
  if (targetPrices.length > 0) {
    const avgTarget = targetPrices.reduce((a, b) => a + b, 0) / targetPrices.length;
    blendedTargetPrice = Math.round(avgTarget * 100) / 100;
    if (currentPrice > 0) {
      impliedUpsidePercent = Math.round(((blendedTargetPrice - currentPrice) / currentPrice) * 1000) / 10;
    }
  }

  // Find top bull thesis & top bear risk
  const topBullDriver = successful.find((m) => m.rating === 'BUY')?.bullThesis || successful[0]?.bullThesis || 'Positive long-term industry outlook.';
  const topBearRisk = successful.find((m) => m.rating === 'SELL' || m.rating === 'HOLD')?.bearRisk || successful[0]?.bearRisk || 'Multiple contraction risk under elevated interest rates.';

  // Construct short executive summary
  let consensusSummary = '';
  if (consensusRating === 'STRONG_BUY' || consensusRating === 'BUY') {
    consensusSummary = `Multi-LLM consensus leans decidedly bullish on ${symbol} with ${buyPercentage}% buy conviction and an aggregate score of ${blendedConviction}/10. Models highlight ${topBullDriver.toLowerCase().replace(/\.$/, '')}, while noting ${topBearRisk.toLowerCase().replace(/\.$/, '')} as the key risk to monitor.`;
  } else if (consensusRating === 'STRONG_SELL' || consensusRating === 'SELL') {
    consensusSummary = `Consensus is defensive/bearish on ${symbol} with ${sellPercentage}% sell votes and conviction of ${blendedConviction}/10. Major headwinds cited include ${topBearRisk.toLowerCase().replace(/\.$/, '')}.`;
  } else {
    consensusSummary = `Models reflect a balanced hold posture on ${symbol} (${holdPercentage}% hold, ${buyPercentage}% buy) with moderate ${blendedConviction}/10 conviction. While supported by ${topBullDriver.toLowerCase().replace(/\.$/, '')}, analysts recommend waiting for valuation decompression or improved margin visibility before initiating positions.`;
  }

  return {
    symbol,
    companyName,
    currentPrice,
    sector,
    industry,
    consensusRating,
    blendedConviction,
    convictionStrength,
    ratingsCount,
    buyPercentage,
    holdPercentage,
    sellPercentage,
    blendedTargetPrice,
    impliedUpsidePercent,
    consensusSummary,
    topBullDriver,
    topBearRisk,
    modelResults,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Orchestrates multi-LLM consensus rating for a given ticker
 */
export async function getAiRatingForStock(symbol: string): Promise<AiRatingConsensus> {
  const stockContext = await fetchStockContext(symbol);

  // Dispatch all LLM requests concurrently
  const promises = EVALUATORS.map((evaluator) => querySingleModel(evaluator, stockContext));
  const settled = await Promise.allSettled(promises);

  const modelResults: ModelRatingResult[] = settled.map((res, index) => {
    if (res.status === 'fulfilled') {
      return res.value;
    }
    return {
      modelId: EVALUATORS[index].id,
      modelName: EVALUATORS[index].name,
      provider: EVALUATORS[index].provider,
      rating: 'HOLD',
      conviction: 5,
      bullThesis: 'Execution interrupted.',
      bearRisk: 'Model exception occurred.',
      summary: `Failed to poll model: ${res.reason?.message || 'Unknown error'}`,
      latencyMs: 0,
      success: false,
      error: res.reason?.message || 'Promise rejected',
    };
  });

  return calculateConsensus(
    stockContext.symbol,
    stockContext.companyName,
    stockContext.currentPrice,
    stockContext.sector,
    stockContext.industry,
    modelResults
  );
}
