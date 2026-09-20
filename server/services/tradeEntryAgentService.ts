import YahooFinance from 'yahoo-finance2';
import { technicalAnalysisService } from './technicalAnalysisService';
import { generateJsonCompletion } from './llmFallbackRouter';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

export interface TradeEntryProposal {
  symbol: string;
  companyName: string;
  currentPrice: number;
  action: string;
  orderType: string;
  timeframe: string;
  
  // Three Tactical Entry Points
  primaryEntryPrice: number;
  conservativeEntryPrice: number;
  aggressiveEntryPrice: number;

  // Invalidation & Targets
  stopLoss: number;
  stopLossPercent: number;
  targetExit: number;
  targetExitPercent: number;
  rewardToRiskRatio: number;

  // Setup Quality & Guidance
  setupQuality: 'PRIME' | 'GOOD' | 'CHOPPY' | 'HIGH_RISK';
  recommendedOrderType: 'LIMIT' | 'STOP_LIMIT';
  recommendedTimeframe: 'DAY' | 'WEEK';
  
  // Tactical Narrative
  tacticalRationale: string;
  invalidationCondition: string;
  keySupportLevels: number[];
  keyResistanceLevels: number[];

  // Technical Indicators Snapshot
  rsi?: number;
  atr?: number;
  marketStage?: string;
  analyzedAt: string;
}

export interface ProposeEntryOptions {
  symbol: string;
  action?: string;
  timeframe?: string;
  orderType?: string;
  quantity?: number;
  currentPrice?: number | null;
  existingTargetPrice?: number | null;
  existingStopLoss?: number | null;
  existingTargetExit?: number | null;
  notes?: string | null;
}

/**
 * Technical Entry Proposal Agent
 * Pulls live market telemetry, support/resistance levels, EMAs, RSI, and ATR
 * to calculate high-probability limit entry prices, structural stop-loss invalidation,
 * and profit targets with asymmetrical Reward-to-Risk ratios.
 */
export async function proposeTradeEntryLevels(options: ProposeEntryOptions): Promise<TradeEntryProposal> {
  const rawSymbol = options.symbol.trim().toUpperCase();
  const resolvedSymbol = resolveYahooFinanceSymbol(rawSymbol) || rawSymbol;
  const action = (options.action || 'BUY').toUpperCase();
  const timeframe = (options.timeframe || 'DAY').toUpperCase();
  const isLong = action === 'BUY' || action === 'BTO' || action === 'LONG';

  // 1. Fetch live quote data
  let quoteData: any = null;
  try {
    quoteData = await yahooFinance.quote(resolvedSymbol, {}, { validateResult: false }).catch(() => null);
  } catch (err) {
    console.warn(`[TradeEntryAgent] Quote fetch failed for ${resolvedSymbol}:`, err);
  }

  const currentPrice = Number(
    quoteData?.regularMarketPrice || options.currentPrice || 100
  );
  const companyName = quoteData?.shortName || quoteData?.longName || rawSymbol;
  const dayHigh = Number(quoteData?.regularMarketDayHigh || currentPrice * 1.01);
  const dayLow = Number(quoteData?.regularMarketDayLow || currentPrice * 0.99);
  const fiftyTwoWeekHigh = Number(quoteData?.fiftyTwoWeekHigh || currentPrice * 1.2);
  const fiftyTwoWeekLow = Number(quoteData?.fiftyTwoWeekLow || currentPrice * 0.8);

  // 2. Fetch technical support/resistance pivots, moving averages, RSI, ATR
  let techAnalysis: any = null;
  try {
    techAnalysis = await technicalAnalysisService.getTechnicalAnalysis(resolvedSymbol).catch(() => null);
  } catch (err) {
    console.warn(`[TradeEntryAgent] Technical analysis failed for ${resolvedSymbol}:`, err);
  }

  const supportLevels = (techAnalysis?.supportResistance?.supportLevels || [])
    .map((l: any) => Number(l.price))
    .filter((p: number) => !isNaN(p) && p > 0);
  const resistanceLevels = (techAnalysis?.supportResistance?.resistanceLevels || [])
    .map((l: any) => Number(l.price))
    .filter((p: number) => !isNaN(p) && p > 0);
  
  const rsi = techAnalysis?.indicators?.rsi ? Number(techAnalysis.indicators.rsi.toFixed(1)) : 50;
  const atr = techAnalysis?.indicators?.atr ? Number(techAnalysis.indicators.atr.toFixed(2)) : Number((currentPrice * 0.02).toFixed(2));
  const marketStage = techAnalysis?.marketPhase?.stageName || 'Stage 2: Markup Phase';
  const ema20 = techAnalysis?.movingAverages?.ema20 || currentPrice;
  const ema50 = techAnalysis?.movingAverages?.ema50 || currentPrice * 0.98;
  const ema200 = techAnalysis?.movingAverages?.ema200 || currentPrice * 0.92;

  // Fallback calculations if LLM fails or is throttled
  const defaultSupport1 = supportLevels[0] || Number((currentPrice - atr * 1.2).toFixed(2));
  const defaultSupport2 = supportLevels[1] || Number((currentPrice - atr * 2.5).toFixed(2));
  const defaultResistance1 = resistanceLevels[0] || Number((currentPrice + atr * 2.5).toFixed(2));
  const defaultResistance2 = resistanceLevels[1] || Number((currentPrice + atr * 4.0).toFixed(2));

  const fallbackPrimaryEntry = isLong
    ? Number((currentPrice - atr * 0.35).toFixed(2))
    : Number((currentPrice + atr * 0.35).toFixed(2));
  const fallbackConservativeEntry = isLong
    ? Number(defaultSupport1.toFixed(2))
    : Number(defaultResistance1.toFixed(2));
  const fallbackAggressiveEntry = isLong
    ? Number((currentPrice + atr * 0.15).toFixed(2))
    : Number((currentPrice - atr * 0.15).toFixed(2));

  const fallbackStopLoss = isLong
    ? Number((defaultSupport2 > 0 ? defaultSupport2 * 0.99 : fallbackPrimaryEntry * 0.95).toFixed(2))
    : Number((defaultResistance2 > 0 ? defaultResistance2 * 1.01 : fallbackPrimaryEntry * 1.05).toFixed(2));
  
  const fallbackTargetExit = isLong
    ? Number((defaultResistance1 > fallbackPrimaryEntry ? defaultResistance1 : fallbackPrimaryEntry * 1.10).toFixed(2))
    : Number((defaultSupport1 < fallbackPrimaryEntry ? defaultSupport1 : fallbackPrimaryEntry * 0.90).toFixed(2));

  const fallbackRisk = Math.abs(fallbackPrimaryEntry - fallbackStopLoss);
  const fallbackReward = Math.abs(fallbackTargetExit - fallbackPrimaryEntry);
  const fallbackRR = fallbackRisk > 0 ? Number((fallbackReward / fallbackRisk).toFixed(2)) : 2.0;

  // 3. Prompt LLM Execution Specialist via llmFallbackRouter
  const systemPrompt = `You are a Senior Head Trader and Technical Positioning Specialist at an elite quantitative execution desk.
Your job is to analyze live market telemetry, support/resistance structure, moving averages, and volatility for a stock to propose institutional-grade entry levels.
Rules for Long Trades:
- Primary Entry: High-probability limit price slightly below current market price (e.g. into nearest intraday/daily liquidity or 20 EMA pullback).
- Conservative Entry: Patient limit bid positioned at major underlying support / 50 EMA.
- Aggressive Entry: Momentum breakout price slightly above recent resistance pivot.
- Stop Loss: Structural invalidation point placed safely below key support (NOT an arbitrary round number).
- Target Exit: First major structural resistance with an asymmetrical reward-to-risk ratio (minimum 2.0 : 1 R:R).

Rules for Short Trades:
- Primary Entry: High-probability limit offer into overhead resistance.
- Conservative Entry: Major resistance test.
- Aggressive Entry: Breakdown trigger below support.
- Stop Loss: Placed above structural resistance.
- Target Exit: Major support level.

You must respond strictly with valid JSON conforming to the requested schema.`;

  const userPrompt = `Analyze tactical entry levels for the following trade order:
Symbol: ${rawSymbol} (${companyName})
Action: ${action} (${isLong ? 'LONG' : 'SHORT'})
Current Market Price: $${currentPrice.toFixed(2)}
Today's Range: $${dayLow.toFixed(2)} - $${dayHigh.toFixed(2)}
52-Week Range: $${fiftyTwoWeekLow.toFixed(2)} - $${fiftyTwoWeekHigh.toFixed(2)}
Timeframe: ${timeframe}
Technical Context:
- Market Stage: ${marketStage}
- RSI (14): ${rsi}
- ATR (14): $${atr}
- Key Support Levels: ${supportLevels.slice(0, 3).map((s: number) => `$${s.toFixed(2)}`).join(', ') || `$${defaultSupport1.toFixed(2)}, $${defaultSupport2.toFixed(2)}`}
- Key Resistance Levels: ${resistanceLevels.slice(0, 3).map((r: number) => `$${r.toFixed(2)}`).join(', ') || `$${defaultResistance1.toFixed(2)}, $${defaultResistance2.toFixed(2)}`}
- 20 EMA: $${Number(ema20).toFixed(2)}, 50 EMA: $${Number(ema50).toFixed(2)}, 200 EMA: $${Number(ema200).toFixed(2)}
${options.notes ? `User Planned Trade Notes: "${options.notes}"` : ''}

Output JSON schema:
{
  "primaryEntryPrice": number,
  "conservativeEntryPrice": number,
  "aggressiveEntryPrice": number,
  "stopLoss": number,
  "targetExit": number,
  "setupQuality": "PRIME" | "GOOD" | "CHOPPY" | "HIGH_RISK",
  "recommendedOrderType": "LIMIT" | "STOP_LIMIT",
  "recommendedTimeframe": "DAY" | "WEEK",
  "tacticalRationale": "2-3 concise paragraphs explaining market structure, moving average posture, reason for limit entry, and stop loss invalidation point",
  "invalidationCondition": "Specific price or technical condition that invalidates the trade setup",
  "keySupportLevels": [number, number],
  "keyResistanceLevels": [number, number]
}`;

  try {
    const aiRes = await generateJsonCompletion<{
      primaryEntryPrice?: number;
      conservativeEntryPrice?: number;
      aggressiveEntryPrice?: number;
      stopLoss?: number;
      targetExit?: number;
      setupQuality?: 'PRIME' | 'GOOD' | 'CHOPPY' | 'HIGH_RISK';
      recommendedOrderType?: 'LIMIT' | 'STOP_LIMIT';
      recommendedTimeframe?: 'DAY' | 'WEEK';
      tacticalRationale?: string;
      invalidationCondition?: string;
      keySupportLevels?: number[];
      keyResistanceLevels?: number[];
    }>({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 1200,
      tag: `trade-entry-agent-${rawSymbol}`,
    });

    const primaryEntryPrice = Number(aiRes?.primaryEntryPrice || fallbackPrimaryEntry);
    const conservativeEntryPrice = Number(aiRes?.conservativeEntryPrice || fallbackConservativeEntry);
    const aggressiveEntryPrice = Number(aiRes?.aggressiveEntryPrice || fallbackAggressiveEntry);
    const stopLoss = Number(aiRes?.stopLoss || fallbackStopLoss);
    const targetExit = Number(aiRes?.targetExit || fallbackTargetExit);

    const riskDollar = Math.abs(primaryEntryPrice - stopLoss);
    const rewardDollar = Math.abs(targetExit - primaryEntryPrice);
    const rewardToRiskRatio = riskDollar > 0 ? Number((rewardDollar / riskDollar).toFixed(2)) : fallbackRR;

    const stopLossPercent = primaryEntryPrice > 0 ? Number(((riskDollar / primaryEntryPrice) * 100).toFixed(1)) : 5.0;
    const targetExitPercent = primaryEntryPrice > 0 ? Number(((rewardDollar / primaryEntryPrice) * 100).toFixed(1)) : 10.0;

    return {
      symbol: rawSymbol,
      companyName,
      currentPrice,
      action,
      orderType: options.orderType || 'LIMIT',
      timeframe,
      primaryEntryPrice,
      conservativeEntryPrice,
      aggressiveEntryPrice,
      stopLoss,
      stopLossPercent,
      targetExit,
      targetExitPercent,
      rewardToRiskRatio,
      setupQuality: aiRes?.setupQuality || 'GOOD',
      recommendedOrderType: aiRes?.recommendedOrderType || 'LIMIT',
      recommendedTimeframe: aiRes?.recommendedTimeframe || (timeframe as any) || 'DAY',
      tacticalRationale: aiRes?.tacticalRationale || `Stock is trading at $${currentPrice.toFixed(2)}. Accumulation near $${primaryEntryPrice.toFixed(2)} aligns with key support and moving average structure, targeting $${targetExit.toFixed(2)} with risk defined at $${stopLoss.toFixed(2)}.`,
      invalidationCondition: aiRes?.invalidationCondition || (isLong ? `Sustained close below $${stopLoss.toFixed(2)}` : `Sustained breakout above $${stopLoss.toFixed(2)}`),
      keySupportLevels: aiRes?.keySupportLevels?.length ? aiRes.keySupportLevels : [defaultSupport1, defaultSupport2],
      keyResistanceLevels: aiRes?.keyResistanceLevels?.length ? aiRes.keyResistanceLevels : [defaultResistance1, defaultResistance2],
      rsi,
      atr,
      marketStage,
      analyzedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn(`[TradeEntryAgent] LLM completion failed for ${rawSymbol}, using technical fallback:`, err.message);

    const riskDollar = Math.abs(fallbackPrimaryEntry - fallbackStopLoss);
    const rewardDollar = Math.abs(fallbackTargetExit - fallbackPrimaryEntry);
    const rewardToRiskRatio = riskDollar > 0 ? Number((rewardDollar / riskDollar).toFixed(2)) : fallbackRR;
    const stopLossPercent = fallbackPrimaryEntry > 0 ? Number(((riskDollar / fallbackPrimaryEntry) * 100).toFixed(1)) : 5.0;
    const targetExitPercent = fallbackPrimaryEntry > 0 ? Number(((rewardDollar / fallbackPrimaryEntry) * 100).toFixed(1)) : 10.0;

    return {
      symbol: rawSymbol,
      companyName,
      currentPrice,
      action,
      orderType: options.orderType || 'LIMIT',
      timeframe,
      primaryEntryPrice: fallbackPrimaryEntry,
      conservativeEntryPrice: fallbackConservativeEntry,
      aggressiveEntryPrice: fallbackAggressiveEntry,
      stopLoss: fallbackStopLoss,
      stopLossPercent,
      targetExit: fallbackTargetExit,
      targetExitPercent,
      rewardToRiskRatio,
      setupQuality: 'GOOD',
      recommendedOrderType: 'LIMIT',
      recommendedTimeframe: timeframe as any,
      tacticalRationale: `Technical analysis for ${rawSymbol} shows support at $${defaultSupport1.toFixed(2)} and overhead resistance at $${defaultResistance1.toFixed(2)}. Positioning a limit entry at $${fallbackPrimaryEntry.toFixed(2)} offers a ${rewardToRiskRatio}:1 reward-to-risk ratio with risk defined below $${fallbackStopLoss.toFixed(2)}.`,
      invalidationCondition: isLong ? `Daily close below $${fallbackStopLoss.toFixed(2)}` : `Daily close above $${fallbackStopLoss.toFixed(2)}`,
      keySupportLevels: [defaultSupport1, defaultSupport2],
      keyResistanceLevels: [defaultResistance1, defaultResistance2],
      rsi,
      atr,
      marketStage,
      analyzedAt: new Date().toISOString(),
    };
  }
}
