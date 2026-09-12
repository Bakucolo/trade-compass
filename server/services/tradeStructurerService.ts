import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import YahooFinance from 'yahoo-finance2';
import { agentActivityTracker } from './agentActivityService';
import { generateJsonCompletion } from './llmFallbackRouter';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface StructuredTradeApproach {
  id: string;
  category: 'STOCK' | 'OPTIONS_LONG' | 'COVERED_CALL' | 'COLLAR' | 'SHORT_PUT' | 'SYNTHETIC' | 'SPREAD' | 'HYBRID_STOCK_CALL';
  title: string;
  subtitle: string;
  suitability: 'Conservative / Income' | 'Aggressive Growth' | 'Defined Risk / Hedged' | 'Capital Efficient / Leveraged' | 'Balanced Core';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

  // Entry, Targets & Stops
  primaryEntry: number;
  scaledEntryMin: number;
  scaledEntryMax: number;
  targetPrice: number;
  target2Price?: number;
  stopLoss: number;

  // Options details if applicable
  optionDetails?: {
    strategyName: string;
    recommendedDte: number;
    expiryDescription: string;
    longStrike?: number;
    shortStrike?: number;
    putStrike?: number;
    callStrike?: number;
    estimatedCost: number;
    isCredit: boolean;
    breakEvenPrice: number;
  };

  // Financial Metrics
  capitalRequiredEstimate: string;
  maxProfit: string;
  maxRisk: string;
  riskRewardRatio: string;
  winProbabilityEstimate: number;

  // Execution Playbook
  executionRules: string[];
  invalidationTrigger: string;
  profitTakingPlan: string;
}

export interface TradeStructureResult {
  symbol: string;
  companyName: string;
  currentPrice: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  ideaTitle?: string;
  ideaThesis?: string;
  approaches: StructuredTradeApproach[];
  macroContextSummary: string;
  generatedAt: string;
}

export interface StructureTradeRequest {
  ideaId?: string;
  symbol: string;
  title?: string;
  content?: string;
  type?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe?: string;
}

/**
 * Intelligent deterministic trade structuring engine with AI augmentation.
 */
export async function generateTradeStructures(req: StructureTradeRequest): Promise<TradeStructureResult> {
  const symbol = (req.symbol || 'NVDA').trim().toUpperCase();
  const sentiment = req.type || 'BULLISH';
  const ideaTitle = req.title || `${sentiment} Tactical Trade Idea on ${symbol}`;
  const ideaThesis = req.content || '';

  const task = agentActivityTracker.startTask({
    agentName: 'AI Trade Structuring & Execution Agent',
    agentType: 'TRADE_IDEA_GENERATOR',
    taskDescription: `Structuring multi-approach trade playbook for ${symbol} (${sentiment})`,
    targetSymbol: symbol,
    metadata: { symbol, sentiment, timeframe: req.timeframe },
  });

  try {
    // 1. Fetch live market price & metrics from Yahoo Finance
    let quote: any = null;
    try {
      quote = await yahooFinance.quoteSummary(symbol, {
        modules: ['price', 'defaultKeyStatistics', 'summaryDetail', 'financialData'],
      });
    } catch (e: any) {
      console.warn(`Could not fetch quote summary for ${symbol}: ${e.message}`);
    }

    const currentPrice = Number(
      quote?.price?.regularMarketPrice ||
      quote?.defaultKeyStatistics?.currentPrice ||
      req.entryPrice ||
      100
    );
    const companyName = quote?.price?.shortName || quote?.price?.longName || symbol;
    const fiftyTwoWeekHigh = quote?.summaryDetail?.fiftyTwoWeekHigh || (currentPrice * 1.25);
    const fiftyTwoWeekLow = quote?.summaryDetail?.fiftyTwoWeekLow || (currentPrice * 0.75);
    const beta = quote?.defaultKeyStatistics?.beta || 1.2;

    // Determine baseline targets & stops if not provided
    const isBull = sentiment === 'BULLISH';
    const isBear = sentiment === 'BEARISH';

    const defaultEntry = req.entryPrice && req.entryPrice > 0 ? req.entryPrice : currentPrice;
    const defaultTarget = req.targetPrice && req.targetPrice > 0
      ? req.targetPrice
      : isBull
      ? Number((defaultEntry * 1.22).toFixed(2))
      : isBear
      ? Number((defaultEntry * 0.82).toFixed(2))
      : Number((defaultEntry * 1.10).toFixed(2));

    const defaultStop = req.stopLoss && req.stopLoss > 0
      ? req.stopLoss
      : isBull
      ? Number((defaultEntry * 0.92).toFixed(2))
      : isBear
      ? Number((defaultEntry * 1.08).toFixed(2))
      : Number((defaultEntry * 0.95).toFixed(2));

    // Try AI generation via Multi-Tier Fallback Router (OpenRouter -> Gemini -> Groq)
    let aiApproaches: StructuredTradeApproach[] | null = null;

    try {
      const prompt = `You are an elite quantitative derivatives strategist and execution trader.
Symbol: ${symbol} (${companyName})
Current Market Price: $${currentPrice.toFixed(2)}
52-Week Range: $${fiftyTwoWeekLow.toFixed(2)} - $${fiftyTwoWeekHigh.toFixed(2)}
Trader Sentiment: ${sentiment}
Timeframe: ${req.timeframe || 'SWING (2-8 Weeks)'}
Thesis: "${ideaThesis.slice(0, 500) || ideaTitle}"
Provided Baseline Entry: $${defaultEntry}, Target: $${defaultTarget}, Stop: $${defaultStop}

Formulate 6 to 8 distinct, institutional-grade trade execution structures tailored for this exact stock:
1. "Direct Outright Stock" (Equity approach with scaled entry zones)
2. "Long Directional Options / LEAPS" (Call or Put with specific DTE & strike delta)
3. "Covered Call / Buy-Write" (100 Shares + Short OTM Call for yield & buffer)
4. "Collared Position" (Long stock + Long protective put financed by Short OTM call)
5. "Cash-Secured Short Put" (Selling OTM put to buy at discount or collect premium)
6. "Synthetic Long or Short" (ATM Call + Short ATM Put for capital efficiency)
7. "Vertical Debit/Credit Spread" (Bull Call Spread or Bear Put Spread)
8. "Core Stock + Leveraged Call Overlay" (70% stock + 30% call kicker)

Respond with ONLY valid JSON with this schema:
{
  "macroContextSummary": "string describing market volatility and setup catalyst",
  "approaches": [
    {
      "id": "stock_direct",
      "category": "STOCK",
      "title": "Direct Equity Position (Core Scaled Accumulation)",
      "subtitle": "Unleveraged long stock with structured 2-tranche limit order entry",
      "suitability": "Balanced Core",
      "sentiment": "${sentiment}",
      "primaryEntry": ${defaultEntry},
      "scaledEntryMin": ${(defaultEntry * 0.96).toFixed(2)},
      "scaledEntryMax": ${defaultEntry},
      "targetPrice": ${defaultTarget},
      "target2Price": ${(defaultTarget * 1.08).toFixed(2)},
      "stopLoss": ${defaultStop},
      "capitalRequiredEstimate": "$10,000 per 100 shares (or fractional)",
      "maxProfit": "+22.5% to Target 1, +32% to Target 2",
      "maxRisk": "-8.0% ($800 per 100 shares at Stop Loss)",
      "riskRewardRatio": "2.8:1",
      "winProbabilityEstimate": 62,
      "executionRules": ["Rule 1...", "Rule 2..."],
      "invalidationTrigger": "Trigger...",
      "profitTakingPlan": "Scale 50% at Target 1, trail stop to break-even"
    }
  ]
}`;

      const aiRes = await generateJsonCompletion<any>({
        userPrompt: prompt,
        temperature: 0.2,
        tag: `TradeStructurer-${symbol}`,
      });

      if (aiRes.data && Array.isArray(aiRes.data.approaches) && aiRes.data.approaches.length > 0) {
        aiApproaches = aiRes.data.approaches;
      }
    } catch (aiErr: any) {
      console.warn(`[TradeStructurer] Fallback router exhausted (${aiErr.message}), using deterministic financial model.`);
    }

    // Deterministic fallback generator if AI is unavailable or missed specific approaches
    const fallbackApproaches: StructuredTradeApproach[] = [
      // 1. Direct Stock Approach
      {
        id: `stock_${symbol.toLowerCase()}`,
        category: 'STOCK',
        title: 'Direct Equity (Scaled Tranche Entry)',
        subtitle: 'Uncapped upside participation with structured limit order pullback entries',
        suitability: 'Balanced Core',
        sentiment,
        primaryEntry: defaultEntry,
        scaledEntryMin: Number((defaultEntry * (isBull ? 0.95 : 1.03)).toFixed(2)),
        scaledEntryMax: defaultEntry,
        targetPrice: defaultTarget,
        target2Price: Number((defaultTarget * (isBull ? 1.08 : 0.92)).toFixed(2)),
        stopLoss: defaultStop,
        capitalRequiredEstimate: `$${(currentPrice * 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} per 100 shares`,
        maxProfit: `${isBull ? '+' : '-'}${Math.abs(((defaultTarget - defaultEntry) / defaultEntry) * 100).toFixed(1)}% to Target 1`,
        maxRisk: `-${Math.abs(((defaultEntry - defaultStop) / defaultEntry) * 100).toFixed(1)}% at Stop Loss`,
        riskRewardRatio: `${(Math.abs(defaultTarget - defaultEntry) / Math.abs(defaultEntry - defaultStop)).toFixed(1)}:1`,
        winProbabilityEstimate: 60,
        executionRules: [
          `Deploy 50% initial allocation at $${defaultEntry.toFixed(2)}.`,
          `Place secondary limit order for remaining 50% at support level $${(defaultEntry * (isBull ? 0.96 : 1.04)).toFixed(2)}.`,
          `Set GTC Stop Loss order immediately upon fill at $${defaultStop.toFixed(2)}.`,
        ],
        invalidationTrigger: `Daily candle close beyond $${defaultStop.toFixed(2)} invalidates the technical thesis.`,
        profitTakingPlan: `Trim 50% at Target 1 ($${defaultTarget.toFixed(2)}) and move stop on remainder to entry break-even.`,
      },

      // 2. Long Directional Options / LEAPS
      {
        id: `options_long_${symbol.toLowerCase()}`,
        category: 'OPTIONS_LONG',
        title: isBull ? 'Long Call Options (Delta 0.70 ITM)' : 'Long Put Options (Delta 0.70 ITM)',
        subtitle: isBull ? 'Deep ITM Call for stock replacement with built-in catastrophic downside protection' : 'Deep ITM Put for defined-risk bearish leverage',
        suitability: 'Aggressive Growth',
        sentiment,
        primaryEntry: defaultEntry,
        scaledEntryMin: Number((defaultEntry * 0.96).toFixed(2)),
        scaledEntryMax: defaultEntry,
        targetPrice: defaultTarget,
        target2Price: Number((defaultTarget * 1.10).toFixed(2)),
        stopLoss: defaultStop,
        optionDetails: {
          strategyName: isBull ? 'Long Single Call (Stock Replacement)' : 'Long Single Put',
          recommendedDte: 60,
          expiryDescription: '45-60 DTE (Monthly Expiration)',
          longStrike: Number((currentPrice * (isBull ? 0.93 : 1.07)).toFixed(2)),
          estimatedCost: Number((currentPrice * 0.12 * 100).toFixed(0)),
          isCredit: false,
          breakEvenPrice: Number((currentPrice * (isBull ? 1.05 : 0.95)).toFixed(2)),
        },
        capitalRequiredEstimate: `$${(currentPrice * 12).toFixed(0)} - $${(currentPrice * 18).toFixed(0)} per contract (85% capital savings vs 100 shares)`,
        maxProfit: '+75% to +140% Return on Premium at Target 1',
        maxRisk: '100% of Premium paid (Capped, No margin call)',
        riskRewardRatio: '3.4:1',
        winProbabilityEstimate: 58,
        executionRules: [
          `Buy Delta ~0.65-0.75 Call with 45 to 90 DTE to mitigate aggressive Theta decay.`,
          `Avoid buying weekly or OTM options to prevent volatility crush.`,
          `Cut trade if underlying stock hits $${defaultStop.toFixed(2)} or option loses 40% of purchase value.`,
        ],
        invalidationTrigger: `Underlying price breaches $${defaultStop.toFixed(2)} or DTE drops below 21 days without price expansion.`,
        profitTakingPlan: `Sell 50% of contracts at +50% gain; trail remaining contracts with a 20% trailing stop.`,
      },

      // 3. Covered Call / Buy-Write
      {
        id: `covered_call_${symbol.toLowerCase()}`,
        category: 'COVERED_CALL',
        title: 'Covered Call (Buy-Write Income & Buffer)',
        subtitle: 'Own 100 shares and sell an OTM Call to harvest premium and lower net cost basis',
        suitability: 'Conservative / Income',
        sentiment: 'BULLISH',
        primaryEntry: defaultEntry,
        scaledEntryMin: Number((defaultEntry * 0.96).toFixed(2)),
        scaledEntryMax: defaultEntry,
        targetPrice: defaultTarget,
        stopLoss: defaultStop,
        optionDetails: {
          strategyName: 'Covered Call (Buy-Write)',
          recommendedDte: 35,
          expiryDescription: '30-45 DTE (Delta 0.25-0.30 OTM)',
          shortStrike: Number((currentPrice * 1.08).toFixed(2)),
          estimatedCost: Number((currentPrice * 0.035 * 100).toFixed(0)),
          isCredit: true,
          breakEvenPrice: Number((currentPrice * 0.965).toFixed(2)),
        },
        capitalRequiredEstimate: `$${(currentPrice * 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} for 100 shares (Offset by ~$${(currentPrice * 3.5).toFixed(0)} Call premium credit)`,
        maxProfit: `+11.5% in 35 days ($${(currentPrice * 11.5).toFixed(0)} if called away at strike)`,
        maxRisk: `Stock downside below net cost basis of $${(currentPrice * 0.965).toFixed(2)}`,
        riskRewardRatio: '2.5:1',
        winProbabilityEstimate: 74,
        executionRules: [
          `Buy 100 shares at $${currentPrice.toFixed(2)} and sell 1x 30-45 DTE Call at $${(currentPrice * 1.08).toFixed(2)} strike.`,
          `Collect ~$${(currentPrice * 3.5).toFixed(0)} upfront credit to provide an immediate 3.5% downside cushion.`,
          `If stock rallies above short strike, allow shares to be called away for max profit or roll strike up and out.`,
        ],
        invalidationTrigger: `Severe structural breakdown below $${defaultStop.toFixed(2)}.`,
        profitTakingPlan: `Close short call at 80% profit (when value drops to $0.50) and sell next monthly cycle.`,
      },

      // 4. Collared Position (Zero-Cost / Low-Cost Hedge)
      {
        id: `collar_${symbol.toLowerCase()}`,
        category: 'COLLAR',
        title: 'Zero-Cost Protective Collar',
        subtitle: '100 Long Shares + Long Protective Put financed by selling an OTM Call',
        suitability: 'Defined Risk / Hedged',
        sentiment: 'BULLISH',
        primaryEntry: defaultEntry,
        scaledEntryMin: Number((defaultEntry * 0.96).toFixed(2)),
        scaledEntryMax: defaultEntry,
        targetPrice: defaultTarget,
        stopLoss: Number((currentPrice * 0.92).toFixed(2)),
        optionDetails: {
          strategyName: 'Collared Equity Position',
          recommendedDte: 60,
          expiryDescription: '60 DTE Collar',
          putStrike: Number((currentPrice * 0.92).toFixed(2)),
          callStrike: Number((currentPrice * 1.10).toFixed(2)),
          estimatedCost: 0,
          isCredit: false,
          breakEvenPrice: currentPrice,
        },
        capitalRequiredEstimate: `$${(currentPrice * 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} for 100 shares (Net zero option debit)`,
        maxProfit: `+10.0% capped upside ($${(currentPrice * 10).toFixed(0)} per 100 shares)`,
        maxRisk: `-8.0% hard floor ($${(currentPrice * 8).toFixed(0)} maximum possible loss, guaranteed by Long Put)`,
        riskRewardRatio: '1.25:1 (Guaranteed Capital Floor)',
        winProbabilityEstimate: 70,
        executionRules: [
          `Hold 100 shares, buy 1x 60 DTE Put at $${(currentPrice * 0.92).toFixed(2)} and sell 1x 60 DTE Call at $${(currentPrice * 1.10).toFixed(2)}.`,
          `Call premium received directly funds 100% of the Protective Put cost.`,
          `Provides ironclad downside protection against earnings shocks or market pullbacks.`,
        ],
        invalidationTrigger: `None required; position has a guaranteed contractual floor at $${(currentPrice * 0.92).toFixed(2)}.`,
        profitTakingPlan: `If stock reaches short call strike, let shares get called away or roll collar into next quarter.`,
      },

      // 5. Cash-Secured Short Put (Discount Entry / Premium Harvest)
      {
        id: `short_put_${symbol.toLowerCase()}`,
        category: 'SHORT_PUT',
        title: 'Cash-Secured Short Put (Discount Accumulator)',
        subtitle: 'Sell an OTM Put at strong support to buy the stock at a discount or pocket the cash premium',
        suitability: 'Conservative / Income',
        sentiment: 'BULLISH',
        primaryEntry: Number((currentPrice * 0.93).toFixed(2)),
        scaledEntryMin: Number((currentPrice * 0.90).toFixed(2)),
        scaledEntryMax: Number((currentPrice * 0.93).toFixed(2)),
        targetPrice: defaultTarget,
        stopLoss: defaultStop,
        optionDetails: {
          strategyName: 'Cash-Secured Short Put',
          recommendedDte: 35,
          expiryDescription: '30-45 DTE (Delta 0.20-0.25 OTM)',
          putStrike: Number((currentPrice * 0.93).toFixed(2)),
          estimatedCost: Number((currentPrice * 0.03 * 100).toFixed(0)),
          isCredit: true,
          breakEvenPrice: Number((currentPrice * 0.90).toFixed(2)),
        },
        capitalRequiredEstimate: `$${(currentPrice * 93).toLocaleString(undefined, { maximumFractionDigits: 0 })} collateral held in cash`,
        maxProfit: `$${(currentPrice * 3.0).toFixed(0)} Premium (3.2% return on cash in 35 days = ~34% annualized)`,
        maxRisk: `Assigned 100 shares at effective cost basis of $${(currentPrice * 0.90).toFixed(2)} (-10% below market)`,
        riskRewardRatio: 'High Win Probability (Theta Positive)',
        winProbabilityEstimate: 78,
        executionRules: [
          `Sell 1x 30-45 DTE Put at $${(currentPrice * 0.93).toFixed(2)} strike (key support).`,
          `Keep $${(currentPrice * 93).toFixed(0)} cash collateral earning risk-free money market interest.`,
          `If unassigned at expiry, keep 100% of the premium and repeat. If assigned, gladly own shares at a 10% discount.`,
        ],
        invalidationTrigger: `Stock breaches $${(currentPrice * 0.85).toFixed(2)} on catastrophic news.`,
        profitTakingPlan: `Buy back short put when it reaches 75% max profit (at $0.40 - $0.60 remaining value).`,
      },

      // 6. Synthetic Long Position (Capital Efficient Synthetic Stock)
      {
        id: `synthetic_${symbol.toLowerCase()}`,
        category: 'SYNTHETIC',
        title: 'Synthetic Long Stock (Delta 1.00 Exposure)',
        subtitle: 'Long ATM Call + Short ATM Put to replicate 100 shares with minimal capital outlay',
        suitability: 'Capital Efficient / Leveraged',
        sentiment: 'BULLISH',
        primaryEntry: defaultEntry,
        scaledEntryMin: Number((defaultEntry * 0.96).toFixed(2)),
        scaledEntryMax: defaultEntry,
        targetPrice: defaultTarget,
        stopLoss: defaultStop,
        optionDetails: {
          strategyName: 'Synthetic Long (Combo)',
          recommendedDte: 90,
          expiryDescription: '90-120 DTE Expiry',
          longStrike: currentPrice,
          shortStrike: currentPrice,
          estimatedCost: 0,
          isCredit: false,
          breakEvenPrice: currentPrice,
        },
        capitalRequiredEstimate: `Margin requirement only (~20% of stock price = ~$${(currentPrice * 20).toFixed(0)})`,
        maxProfit: `1:1 identical to holding 100 shares with 5x leverage on cash`,
        maxRisk: `Identical downside dollar-for-dollar to 100 shares below $${currentPrice.toFixed(2)}`,
        riskRewardRatio: '3.0:1 (High Leverage)',
        winProbabilityEstimate: 62,
        executionRules: [
          `Buy 1x 90 DTE ATM Call at $${currentPrice.toFixed(2)} and sell 1x 90 DTE ATM Put at $${currentPrice.toFixed(2)}.`,
          `Net debit is approximately zero; position has a Net Delta of ~1.00 (mimics 100 shares).`,
          `Maintain strict stop discipline at $${defaultStop.toFixed(2)} to avoid margin assignment.`,
        ],
        invalidationTrigger: `Price drops below key support $${defaultStop.toFixed(2)}.`,
        profitTakingPlan: `Close both legs simultaneously when underlying stock reaches Target 1 ($${defaultTarget.toFixed(2)}).`,
      },

      // 7. Bull Call Vertical Debit Spread
      {
        id: `spread_${symbol.toLowerCase()}`,
        category: 'SPREAD',
        title: isBull ? 'Bull Call Debit Spread' : 'Bear Put Debit Spread',
        subtitle: 'Buy ATM Call & Sell OTM Call to cap cost and slash volatility risk',
        suitability: 'Defined Risk / Hedged',
        sentiment,
        primaryEntry: defaultEntry,
        scaledEntryMin: Number((defaultEntry * 0.96).toFixed(2)),
        scaledEntryMax: defaultEntry,
        targetPrice: defaultTarget,
        stopLoss: defaultStop,
        optionDetails: {
          strategyName: isBull ? 'Vertical Bull Call Spread' : 'Vertical Bear Put Spread',
          recommendedDte: 45,
          expiryDescription: '45 DTE Monthly',
          longStrike: currentPrice,
          shortStrike: Number((currentPrice * (isBull ? 1.12 : 0.88)).toFixed(2)),
          estimatedCost: Number((currentPrice * 0.045 * 100).toFixed(0)),
          isCredit: false,
          breakEvenPrice: Number((currentPrice * (isBull ? 1.045 : 0.955)).toFixed(2)),
        },
        capitalRequiredEstimate: `$${(currentPrice * 4.5).toFixed(0)} per spread contract`,
        maxProfit: `+165% ROI ($${(currentPrice * 7.5).toFixed(0)} net profit at short strike)`,
        maxRisk: `$${(currentPrice * 4.5).toFixed(0)} (Debit paid is absolute maximum risk)`,
        riskRewardRatio: '2.65:1 (Defined Risk)',
        winProbabilityEstimate: 65,
        executionRules: [
          `Buy 1x 45 DTE Call at $${currentPrice.toFixed(2)} and Sell 1x 45 DTE Call at $${(currentPrice * 1.12).toFixed(2)}.`,
          `Short call reduces total entry cost by 45% and cushions against IV crush.`,
          `Exit if stock approaches short strike into expiry for max profit capture.`,
        ],
        invalidationTrigger: `Underlying price invalidation below $${defaultStop.toFixed(2)}.`,
        profitTakingPlan: `Close spread at 80% of max spread width ($${((currentPrice * 0.12) * 0.80 * 100).toFixed(0)}).`,
      },

      // 8. Hybrid Core Stock + Call Overlay
      {
        id: `hybrid_${symbol.toLowerCase()}`,
        category: 'HYBRID_STOCK_CALL',
        title: 'Core Stock (70%) + Call Overlay (30%)',
        subtitle: 'Long-term equity stability with asymmetric short-term option kicker',
        suitability: 'Balanced Core',
        sentiment: 'BULLISH',
        primaryEntry: defaultEntry,
        scaledEntryMin: Number((defaultEntry * 0.96).toFixed(2)),
        scaledEntryMax: defaultEntry,
        targetPrice: defaultTarget,
        target2Price: Number((defaultTarget * 1.15).toFixed(2)),
        stopLoss: defaultStop,
        capitalRequiredEstimate: '70% Core Capital in Equity, 30% in 60-90 DTE Calls',
        maxProfit: '+45% Blended Portfolio Return at Target 1',
        maxRisk: '-14% Blended Maximum Drawdown at Stop Loss',
        riskRewardRatio: '3.2:1',
        winProbabilityEstimate: 64,
        executionRules: [
          `Allocate 70% of intended position capital into outright shares.`,
          `Allocate remaining 30% into 1x Delta 0.60 Call option (60-90 DTE).`,
          `Allows capturing outsized torque if the stock gaps up while keeping 70% principal in real equity.`,
        ],
        invalidationTrigger: `Breach of support at $${defaultStop.toFixed(2)}.`,
        profitTakingPlan: `Take profit on Call option at +100% gain; continue holding stock for long-term compound growth.`,
      },
    ];

    const finalApproaches = (aiApproaches && aiApproaches.length >= 4) ? aiApproaches : fallbackApproaches;

    const result: TradeStructureResult = {
      symbol,
      companyName,
      currentPrice,
      sentiment,
      ideaTitle,
      ideaThesis,
      approaches: finalApproaches,
      macroContextSummary: `Technical setup on ${symbol} ($${currentPrice.toFixed(2)}) is positioned within 52W range ($${fiftyTwoWeekLow.toFixed(2)} - $${fiftyTwoWeekHigh.toFixed(2)}) with beta of ${beta.toFixed(2)}.`,
      generatedAt: new Date().toISOString(),
    };

    agentActivityTracker.completeTask(task.id, {
      status: 'COMPLETED',
      resultSummary: `Generated ${finalApproaches.length} structured trade approaches for ${symbol} (${sentiment})`,
      outputPayload: { symbol, approachCount: finalApproaches.length },
    });

    return result;
  } catch (err: any) {
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      error: err.message,
    });
    throw err;
  }
}
