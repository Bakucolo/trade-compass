import { optionsChainService, OptionsChainData, OptionContractRow } from './optionsChainService';
import { executeWithFallback } from './llmFallbackRouter';

export interface EquidistantStrikePair {
  targetDistancePercent: number; // e.g. 2.5, 5.0, 10.0, 15.0, 20.0
  // Call leg (upside)
  callStrike: number;
  callActualDistancePercent: number;
  callImpliedVol: number;
  callMidPrice: number;
  callDelta: number;
  callVolume: number;
  callOpenInterest: number;
  // Put leg (downside)
  putStrike: number;
  putActualDistancePercent: number;
  putImpliedVol: number;
  putMidPrice: number;
  putDelta: number;
  putVolume: number;
  putOpenInterest: number;
  // Comparison metrics
  ivSkewDiff: number; // Call IV minus Put IV (percentage points, e.g. +3.2 or -5.1)
  ivRatio: number; // Call IV / Put IV
  priceRatio: number; // Call Mid / Put Mid
  isCallHigherIv: boolean;
  skewDescription: string;
}

export interface OptionsSkewMetrics {
  spotPrice: number;
  selectedExpiration: string;
  selectedDte: number;
  atmIv: number;
  
  // 25-Delta Risk Reversal: Call IV (25d) - Put IV (25d)
  delta25CallStrike: number;
  delta25CallIv: number;
  delta25PutStrike: number;
  delta25PutIv: number;
  delta25RiskReversal: number; // Call IV - Put IV

  // 10-Delta Tail Skew: Call IV (10d) - Put IV (10d)
  delta10CallStrike: number;
  delta10CallIv: number;
  delta10PutStrike: number;
  delta10PutIv: number;
  delta10TailSkew: number; // Deep OTM tail risk

  // Butterfly / Smile Curvature (Wings vs ATM)
  butterfly25Delta: number; // (25d Call IV + 25d Put IV) / 2 - ATM IV

  // Skew Slope & Asymmetry
  averageIvSkewDiff: number; // Average (Call IV - Put IV) across all equidistant pairs
  maxPainStrike: number;
  maxPainDistancePercent: number;
  callWallStrike: number;
  putWallStrike: number;
  putCallOiRatio: number;
  putCallVolumeRatio: number;

  // Direct Quantitative Classifications
  arePutsAndCallsEquidistant: boolean; // true only if |averageIvSkewDiff| <= 1.5%
  equidistanceVerdict: 'SYMMETRIC_EQUIDISTANT' | 'PUT_SKEWED_DOWNSIDE_HEAVY' | 'CALL_SKEWED_UPSIDE_HEAVY';
  
  isImplyingUpside: boolean; // true if call skew dominates or market prices upside drift
  impliedDirectionalBias: 'STRONGLY_BULLISH_UPSIDE' | 'MODERATE_UPSIDE_TILT' | 'NEUTRAL_BALANCED' | 'BEARISH_DOWNSIDE_HEDGE';
  directionalConfidenceScore: number; // 0 (extreme bearish) to 100 (extreme bullish)
  
  skewRegime: 
    | 'STEEP_PUT_SKEW'
    | 'NORMAL_PUT_SKEW'
    | 'FLAT_SYMMETRIC'
    | 'CALL_SKEW_BULLISH_UPSIDE'
    | 'EXTREME_REVERSE_SKEW';
}

export interface OptimalSkewStrategy {
  strategyName: string;
  category: 'BULLISH' | 'NEUTRAL_INCOME' | 'HEDGE' | 'VOLATILITY';
  actionVerdict: string;
  rationale: string;
  suggestedSetup: string;
  skewEdge: string;
}

export interface OptionsSkewAgentResponse {
  symbol: string;
  companyName: string;
  timestamp: string;
  metrics: OptionsSkewMetrics;
  equidistantPairs: EquidistantStrikePair[];
  
  // Direct Answers to User Inquiries
  directAnswers: {
    arePutsAndCallsEquidistant: {
      answer: boolean;
      badgeText: string;
      headline: string;
      explanation: string;
    };
    areOptionsImplyingUpside: {
      answer: boolean;
      badgeText: string;
      headline: string;
      explanation: string;
    };
  };

  // Agent Synthesis & Tactical Playbook
  agentSynthesis: {
    executiveSummary: string;
    volatilitySmileAnalysis: string;
    institutionalTailRisk: string;
    optimalDerivativesStrategies: OptimalSkewStrategy[];
    catalystsAndRisks: string[];
    source: 'LLM_AGENT' | 'QUANTITATIVE_ENGINE';
  };
}

// In-memory cache for skew agent results (60 seconds)
const skewCache = new Map<string, { data: OptionsSkewAgentResponse; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000;

export class OptionsSkewAgentService {
  /**
   * Main entry point: Analyzes options skew, strike equidistance, and upside implications
   */
  async analyzeOptionsSkew(symbol: string, targetExpiration?: string): Promise<OptionsSkewAgentResponse> {
    const cleanSymbol = symbol.trim().toUpperCase();
    const cacheKey = `${cleanSymbol}:${targetExpiration || 'FRONT'}`;
    const cached = skewCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // 1. Fetch raw options chain
    const chain = await optionsChainService.getOptionsChain(cleanSymbol, targetExpiration);
    
    // 2. Perform Quantitative Skew Modeling
    const quantResult = this.computeQuantitativeSkew(chain);

    // 3. Perform AI Agent Synthesis (with LLM or Fallback)
    const agentSynthesis = await this.generateAgentSynthesis(cleanSymbol, chain, quantResult);

    const response: OptionsSkewAgentResponse = {
      symbol: cleanSymbol,
      companyName: chain.companyName,
      timestamp: new Date().toISOString(),
      metrics: quantResult.metrics,
      equidistantPairs: quantResult.equidistantPairs,
      directAnswers: agentSynthesis.directAnswers,
      agentSynthesis: {
        executiveSummary: agentSynthesis.executiveSummary,
        volatilitySmileAnalysis: agentSynthesis.volatilitySmileAnalysis,
        institutionalTailRisk: agentSynthesis.institutionalTailRisk,
        optimalDerivativesStrategies: agentSynthesis.optimalDerivativesStrategies,
        catalystsAndRisks: agentSynthesis.catalystsAndRisks,
        source: agentSynthesis.source,
      },
    };

    skewCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return response;
  }

  /**
   * Computes mathematical equidistant strike pairs, risk reversals, and skew slope
   */
  computeQuantitativeSkew(chain: OptionsChainData): {
    metrics: OptionsSkewMetrics;
    equidistantPairs: EquidistantStrikePair[];
  } {
    const spot = chain.underlyingPrice || 100;
    const strikes = chain.strikes || [];

    // Separate available Call and Put options with valid implied volatility
    const callContracts: OptionContractRow[] = [];
    const putContracts: OptionContractRow[] = [];

    for (const row of strikes) {
      if (row.call && row.call.impliedVolatility > 0) {
        callContracts.push(row.call);
      }
      if (row.put && row.put.impliedVolatility > 0) {
        putContracts.push(row.put);
      }
    }

    // ATM Implied Volatility
    const atmIv = chain.analytics?.impliedVolatilityAtm || 30.0;

    // 1. Calculate Equidistant Strike Pairs at target percentage offsets from spot
    const targetPercentages = [2.5, 5.0, 7.5, 10.0, 15.0, 20.0];
    const equidistantPairs: EquidistantStrikePair[] = [];

    for (const pct of targetPercentages) {
      const targetCallStrike = spot * (1 + pct / 100);
      const targetPutStrike = spot * (1 - pct / 100);

      // Find closest call contract
      let closestCall: OptionContractRow | null = null;
      let minCallDiff = Infinity;
      for (const call of callContracts) {
        const diff = Math.abs(call.strike - targetCallStrike);
        if (diff < minCallDiff) {
          minCallDiff = diff;
          closestCall = call;
        }
      }

      // Find closest put contract
      let closestPut: OptionContractRow | null = null;
      let minPutDiff = Infinity;
      for (const put of putContracts) {
        const diff = Math.abs(put.strike - targetPutStrike);
        if (diff < minPutDiff) {
          minPutDiff = diff;
          closestPut = put;
        }
      }

      if (closestCall && closestPut) {
        const callActualDist = ((closestCall.strike - spot) / spot) * 100;
        const putActualDist = ((spot - closestPut.strike) / spot) * 100;
        const ivDiff = closestCall.impliedVolatility - closestPut.impliedVolatility;
        const ivRatio = closestPut.impliedVolatility > 0 ? closestCall.impliedVolatility / closestPut.impliedVolatility : 1;
        const priceRatio = closestPut.mid > 0 ? closestCall.mid / closestPut.mid : 1;

        let skewDesc = '';
        if (Math.abs(ivDiff) <= 1.0) {
          skewDesc = 'Equidistant IV Balance (Symmetric pricing)';
        } else if (ivDiff > 1.0) {
          skewDesc = `Call Skew (+${ivDiff.toFixed(1)}% IV): Upside calls priced at volatility premium`;
        } else {
          skewDesc = `Put Skew (${ivDiff.toFixed(1)}% IV): Downside puts command higher crash hedge premium`;
        }

        equidistantPairs.push({
          targetDistancePercent: pct,
          callStrike: closestCall.strike,
          callActualDistancePercent: parseFloat(callActualDist.toFixed(1)),
          callImpliedVol: parseFloat(closestCall.impliedVolatility.toFixed(1)),
          callMidPrice: parseFloat(closestCall.mid.toFixed(2)),
          callDelta: parseFloat(closestCall.delta.toFixed(2)),
          callVolume: closestCall.volume || 0,
          callOpenInterest: closestCall.openInterest || 0,

          putStrike: closestPut.strike,
          putActualDistancePercent: parseFloat(putActualDist.toFixed(1)),
          putImpliedVol: parseFloat(closestPut.impliedVolatility.toFixed(1)),
          putMidPrice: parseFloat(closestPut.mid.toFixed(2)),
          putDelta: parseFloat(closestPut.delta.toFixed(2)),
          putVolume: closestPut.volume || 0,
          putOpenInterest: closestPut.openInterest || 0,

          ivSkewDiff: parseFloat(ivDiff.toFixed(2)),
          ivRatio: parseFloat(ivRatio.toFixed(2)),
          priceRatio: parseFloat(priceRatio.toFixed(2)),
          isCallHigherIv: ivDiff > 0,
          skewDescription: skewDesc,
        });
      }
    }

    // 2. Find 25-Delta Call and 25-Delta Put for Risk Reversal (RR25)
    let delta25Call = callContracts[0];
    let minDelta25CallDiff = Infinity;
    for (const call of callContracts) {
      const diff = Math.abs(call.delta - 0.25);
      if (diff < minDelta25CallDiff) {
        minDelta25CallDiff = diff;
        delta25Call = call;
      }
    }

    let delta25Put = putContracts[0];
    let minDelta25PutDiff = Infinity;
    for (const put of putContracts) {
      // Delta for puts is negative, so look for put closest to -0.25
      const diff = Math.abs(Math.abs(put.delta) - 0.25);
      if (diff < minDelta25PutDiff) {
        minDelta25PutDiff = diff;
        delta25Put = put;
      }
    }

    const d25CallIv = delta25Call ? delta25Call.impliedVolatility : atmIv;
    const d25PutIv = delta25Put ? delta25Put.impliedVolatility : atmIv;
    const delta25RiskReversal = parseFloat((d25CallIv - d25PutIv).toFixed(2));

    // 3. Find 10-Delta Call and 10-Delta Put for Tail Skew (RR10)
    let delta10Call = callContracts[0];
    let minDelta10CallDiff = Infinity;
    for (const call of callContracts) {
      const diff = Math.abs(call.delta - 0.10);
      if (diff < minDelta10CallDiff) {
        minDelta10CallDiff = diff;
        delta10Call = call;
      }
    }

    let delta10Put = putContracts[0];
    let minDelta10PutDiff = Infinity;
    for (const put of putContracts) {
      const diff = Math.abs(Math.abs(put.delta) - 0.10);
      if (diff < minDelta10PutDiff) {
        minDelta10PutDiff = diff;
        delta10Put = put;
      }
    }

    const d10CallIv = delta10Call ? delta10Call.impliedVolatility : atmIv;
    const d10PutIv = delta10Put ? delta10Put.impliedVolatility : atmIv;
    const delta10TailSkew = parseFloat((d10CallIv - d10PutIv).toFixed(2));

    // 4. Butterfly / Kurtosis (Wings vs Center ATM)
    const butterfly25Delta = parseFloat((((d25CallIv + d25PutIv) / 2) - atmIv).toFixed(2));

    // 5. Compute Average Skew Difference across equidistant pairs
    const validPairs = equidistantPairs.filter(p => !isNaN(p.ivSkewDiff));
    const averageIvSkewDiff = validPairs.length > 0
      ? parseFloat((validPairs.reduce((acc, p) => acc + p.ivSkewDiff, 0) / validPairs.length).toFixed(2))
      : 0;

    // 6. Direct Inquiries Determination
    // Question 1: Are puts and calls equidistant in IV pricing?
    const arePutsAndCallsEquidistant = Math.abs(averageIvSkewDiff) <= 1.5;
    let equidistanceVerdict: 'SYMMETRIC_EQUIDISTANT' | 'PUT_SKEWED_DOWNSIDE_HEAVY' | 'CALL_SKEWED_UPSIDE_HEAVY' = 'SYMMETRIC_EQUIDISTANT';
    if (!arePutsAndCallsEquidistant) {
      equidistanceVerdict = averageIvSkewDiff < -1.5 ? 'PUT_SKEWED_DOWNSIDE_HEAVY' : 'CALL_SKEWED_UPSIDE_HEAVY';
    }

    // Question 2: Are options implying a stock upside?
    // In equities, typical SPY / stock skew has puts 4-8 points higher than calls (RR25 is -4% to -8%).
    // If RR25 is > 0 (calls higher than puts), options are emphatically implying explosive upside or speculative squeeze.
    // If RR25 is between -2.0% and 0%, calls are abnormally bid relative to standard put skew (moderate upside tilt).
    // If RR25 is < -5.0%, heavy downside crash protection is priced in.
    let isImplyingUpside = false;
    let impliedDirectionalBias: 'STRONGLY_BULLISH_UPSIDE' | 'MODERATE_UPSIDE_TILT' | 'NEUTRAL_BALANCED' | 'BEARISH_DOWNSIDE_HEDGE' = 'NEUTRAL_BALANCED';
    let directionalConfidenceScore = 50;

    const maxPain = chain.keyLevels?.maxPain;
    const isMaxPainBullish = maxPain?.pullDirection === 'BULLISH_PULL';

    if (delta25RiskReversal > 2.0) {
      isImplyingUpside = true;
      impliedDirectionalBias = 'STRONGLY_BULLISH_UPSIDE';
      directionalConfidenceScore = Math.min(95, Math.round(75 + delta25RiskReversal * 2));
    } else if (delta25RiskReversal >= -1.5) {
      isImplyingUpside = true;
      impliedDirectionalBias = 'MODERATE_UPSIDE_TILT';
      directionalConfidenceScore = isMaxPainBullish ? 68 : 60;
    } else if (delta25RiskReversal >= -4.5) {
      isImplyingUpside = false;
      impliedDirectionalBias = 'NEUTRAL_BALANCED';
      directionalConfidenceScore = 50;
    } else {
      isImplyingUpside = false;
      impliedDirectionalBias = 'BEARISH_DOWNSIDE_HEDGE';
      directionalConfidenceScore = Math.max(10, Math.round(50 + delta25RiskReversal * 3));
    }

    // Determine Skew Regime
    let skewRegime: OptionsSkewMetrics['skewRegime'] = 'NORMAL_PUT_SKEW';
    if (delta25RiskReversal > 4.0) {
      skewRegime = 'EXTREME_REVERSE_SKEW';
    } else if (delta25RiskReversal > 0.5) {
      skewRegime = 'CALL_SKEW_BULLISH_UPSIDE';
    } else if (Math.abs(delta25RiskReversal) <= 1.5) {
      skewRegime = 'FLAT_SYMMETRIC';
    } else if (delta25RiskReversal < -6.0) {
      skewRegime = 'STEEP_PUT_SKEW';
    } else {
      skewRegime = 'NORMAL_PUT_SKEW';
    }

    const metrics: OptionsSkewMetrics = {
      spotPrice: spot,
      selectedExpiration: chain.selectedExpiration,
      selectedDte: chain.selectedDte,
      atmIv: parseFloat(atmIv.toFixed(1)),

      delta25CallStrike: delta25Call?.strike || spot * 1.05,
      delta25CallIv: parseFloat(d25CallIv.toFixed(1)),
      delta25PutStrike: delta25Put?.strike || spot * 0.95,
      delta25PutIv: parseFloat(d25PutIv.toFixed(1)),
      delta25RiskReversal,

      delta10CallStrike: delta10Call?.strike || spot * 1.10,
      delta10CallIv: parseFloat(d10CallIv.toFixed(1)),
      delta10PutStrike: delta10Put?.strike || spot * 0.90,
      delta10PutIv: parseFloat(d10PutIv.toFixed(1)),
      delta10TailSkew,

      butterfly25Delta,
      averageIvSkewDiff,

      maxPainStrike: maxPain?.strike || spot,
      maxPainDistancePercent: maxPain?.distancePercent || 0,
      callWallStrike: chain.keyLevels?.callWall?.strike || spot * 1.1,
      putWallStrike: chain.keyLevels?.putWall?.strike || spot * 0.9,
      putCallOiRatio: chain.analytics?.putCallOiRatio || 1.0,
      putCallVolumeRatio: chain.analytics?.putCallVolumeRatio || 1.0,

      arePutsAndCallsEquidistant,
      equidistanceVerdict,
      isImplyingUpside,
      impliedDirectionalBias,
      directionalConfidenceScore,
      skewRegime,
    };

    return { metrics, equidistantPairs };
  }

  /**
   * Generates natural language AI agent analysis using multi-tier fallback LLMs or quant rules
   */
  private async generateAgentSynthesis(
    symbol: string,
    chain: OptionsChainData,
    quant: { metrics: OptionsSkewMetrics; equidistantPairs: EquidistantStrikePair[] }
  ) {
    const { metrics, equidistantPairs } = quant;

    const equidistantTableSummary = equidistantPairs.map(p => 
      `±${p.targetDistancePercent}% OTM: Call $${p.callStrike} (IV: ${p.callImpliedVol}%, Mid: $${p.callMidPrice}) vs Put $${p.putStrike} (IV: ${p.putImpliedVol}%, Mid: $${p.putMidPrice}) -> Net IV Skew: ${p.ivSkewDiff > 0 ? '+' : ''}${p.ivSkewDiff}%`
    ).join('\n');

    const prompt = `You are a Senior Quantitative Derivatives Strategist and Volatility Skew Specialist.
Analyze the empirical options volatility skew and strike pricing for ${symbol}.

CRITICAL QUESTIONS TO DIRECTLY ANSWER:
1. ARE PUTS AND CALLS EQUIDISTANT?
Does the options market price equidistant strikes symmetrically, or is volatility heavily skewed towards puts (crash protection) or calls (upside demand)?
2. ARE OPTIONS IMPLYING A STOCK UPSIDE?
Does the 25-Delta Risk Reversal, OTM Call-to-Put IV ratio, and directional distribution signal that institutional traders are pricing in upside momentum/expansion, or downside hedging?

EMPIRICAL DERIVATIVES TELEMETRY:
- Symbol: ${symbol} (${chain.companyName})
- Spot Price: $${metrics.spotPrice.toFixed(2)}
- Active Expiration: ${metrics.selectedExpiration} (${metrics.selectedDte} Days to Expiration)
- ATM Implied Volatility: ${metrics.atmIv}%
- 25-Delta Risk Reversal (Call IV minus Put IV): ${metrics.delta25RiskReversal > 0 ? '+' : ''}${metrics.delta25RiskReversal}% (Call IV: ${metrics.delta25CallIv}% vs Put IV: ${metrics.delta25PutIv}%)
- 10-Delta Deep OTM Tail Skew: ${metrics.delta10TailSkew > 0 ? '+' : ''}${metrics.delta10TailSkew}% (Call IV: ${metrics.delta10CallIv}% vs Put IV: ${metrics.delta10PutIv}%)
- Smile Curvature (Butterfly): ${metrics.butterfly25Delta}%
- Average IV Skew Difference across Equidistant Strikes: ${metrics.averageIvSkewDiff > 0 ? '+' : ''}${metrics.averageIvSkewDiff}%
- Max Pain Strike: $${metrics.maxPainStrike} (${metrics.maxPainDistancePercent >= 0 ? '+' : ''}${metrics.maxPainDistancePercent.toFixed(1)}% vs Spot)
- Call Wall (Overhead Resistance): $${metrics.callWallStrike}
- Put Wall (Floor Support): $${metrics.putWallStrike}
- Put/Call Open Interest Ratio: ${metrics.putCallOiRatio}x
- Put/Call Volume Ratio: ${metrics.putCallVolumeRatio}x

EQUIDISTANT STRIKE MATRIX:
${equidistantTableSummary}

QUANTITATIVE SIGNALS:
- Equidistant Verdict: ${metrics.equidistanceVerdict} (Are equidistant: ${metrics.arePutsAndCallsEquidistant})
- Implied Upside Verdict: ${metrics.impliedDirectionalBias} (Is implying upside: ${metrics.isImplyingUpside})
- Skew Regime: ${metrics.skewRegime}

Generate a structured JSON response matching this EXACT schema:
{
  "directAnswers": {
    "arePutsAndCallsEquidistant": {
      "answer": boolean,
      "badgeText": "string (e.g. 'NO: Put-Skewed Downside Heavy' or 'YES: Symmetric IV Balance')",
      "headline": "string (concise 1-sentence verdict)",
      "explanation": "string (detailed 2-3 sentence institutional explanation comparing strike pricing)"
    },
    "areOptionsImplyingUpside": {
      "answer": boolean,
      "badgeText": "string (e.g. 'YES: Bullish Call Skew' or 'NO: Downside Protection Biased')",
      "headline": "string (concise 1-sentence verdict)",
      "explanation": "string (detailed 2-3 sentence institutional explanation on directional bias)"
    }
  },
  "executiveSummary": "string (2-3 sentences synthesizing current options market expectation)",
  "volatilitySmileAnalysis": "string (analysis of 25d risk reversal, 10d tails, and skew curvature)",
  "institutionalTailRisk": "string (where market participants are paying the highest insurance/lottery tickets)",
  "optimalDerivativesStrategies": [
    {
      "strategyName": "string",
      "category": "BULLISH" | "NEUTRAL_INCOME" | "HEDGE" | "VOLATILITY",
      "actionVerdict": "string",
      "rationale": "string",
      "suggestedSetup": "string",
      "skewEdge": "string (how this trade directly exploits the observed skew)"
    }
  ],
  "catalystsAndRisks": ["string", "string", "string"]
}`;

    try {
      const llmResult = await executeWithFallback({
        userPrompt: prompt,
        systemPrompt: 'You are an institutional derivatives structurer. Always respond with valid JSON.',
        jsonMode: true,
        temperature: 0.2,
        timeoutMs: 14000,
        tag: `OptionsSkewAgent-${symbol}`,
      });

      if (llmResult.data && llmResult.data.directAnswers) {
        return {
          ...llmResult.data,
          source: 'LLM_AGENT' as const,
        };
      }
    } catch (err: any) {
      console.warn(`[Options Skew Agent] LLM invocation failed or timed out (${err.message}). Using deterministic quant fallback.`);
    }

    // Deterministic Quantitative Engine Fallback
    return this.buildDeterministicAgentSynthesis(symbol, chain, metrics, equidistantPairs);
  }

  /**
   * Deterministic fallback synthesizing pure quantitative signals when LLM is offline
   */
  private buildDeterministicAgentSynthesis(
    symbol: string,
    chain: OptionsChainData,
    metrics: OptionsSkewMetrics,
    equidistantPairs: EquidistantStrikePair[]
  ) {
    const isEquidistant = metrics.arePutsAndCallsEquidistant;
    const isUpside = metrics.isImplyingUpside;

    let eqBadge = 'NO: Put-Skewed Downside Heavy';
    let eqHeadline = `Options market is not equidistant; puts trade at an average ${Math.abs(metrics.averageIvSkewDiff).toFixed(1)}% IV premium over calls.`;
    let eqExplanation = `In ${symbol}, equidistant out-of-the-money puts command higher volatility pricing than equidistant calls. For example, the 10% OTM put trades at higher implied volatility than the 10% OTM call, reflecting persistent institutional demand for downside portfolio hedging.`;

    if (metrics.equidistanceVerdict === 'CALL_SKEWED_UPSIDE_HEAVY') {
      eqBadge = 'NO: Call-Skewed Upside Heavy';
      eqHeadline = `Options market is not equidistant; calls trade at an abnormal ${metrics.averageIvSkewDiff.toFixed(1)}% IV premium over puts.`;
      eqExplanation = `Traders are bidding up upside calls aggressively compared to equidistant downside puts. This upside skew asymmetry indicates call buyers are paying inflated premiums for upside convexity.`;
    } else if (isEquidistant) {
      eqBadge = 'YES: Symmetric IV Balance';
      eqHeadline = `Puts and calls trade with nearly identical implied volatility (average IV gap of only ${Math.abs(metrics.averageIvSkewDiff).toFixed(1)}%).`;
      eqExplanation = `Equidistant strikes show minimal volatility distortion. Market participants are not paying a disproportionate premium for either direction, creating a balanced, symmetric volatility smile around spot $${metrics.spotPrice.toFixed(2)}.`;
    }

    let upBadge = 'NO: Downside Protection Biased';
    let upHeadline = `Derivatives market is pricing conventional downside tail risk rather than aggressive upside.`;
    let upExplanation = `The 25-Delta Risk Reversal sits at ${metrics.delta25RiskReversal > 0 ? '+' : ''}${metrics.delta25RiskReversal}%, indicating options traders are paying standard or elevated premiums for downside put protection. Market-implied distribution does not reflect an upside directional breakout.`;

    if (metrics.impliedDirectionalBias === 'STRONGLY_BULLISH_UPSIDE') {
      upBadge = 'YES: Bullish Call Skew';
      upHeadline = `Options pricing strongly implies institutional anticipation of stock upside.`;
      upExplanation = `The 25-Delta Risk Reversal is positive at +${metrics.delta25RiskReversal}%, which is an uncommon market anomaly where OTM calls are more expensive than OTM puts. This reflects intense demand for upside gamma and momentum exposure.`;
    } else if (metrics.impliedDirectionalBias === 'MODERATE_UPSIDE_TILT') {
      upBadge = 'YES: Moderate Upside Tilt';
      upHeadline = `Options show an above-average upside tilt with flatter-than-normal put skew.`;
      upExplanation = `While put skew is not entirely inverted, the 25-Delta Risk Reversal (${metrics.delta25RiskReversal}%) is materially flatter than normal equity baselines, accompanied by strong overhead call volume and an upward Max Pain pull to $${metrics.maxPainStrike}.`;
    } else if (metrics.impliedDirectionalBias === 'NEUTRAL_BALANCED') {
      upBadge = 'NEUTRAL: Balanced Distribution';
      upHeadline = `Options imply a balanced, range-bound distribution with no distinct directional bias.`;
      upExplanation = `The volatility smile exhibits standard curvature without aggressive skew in either wing. Options pricing implies the stock is likely to consolidate within the expected move buffer.`;
    }

    const strategies: OptimalSkewStrategy[] = [];

    if (metrics.skewRegime === 'CALL_SKEW_BULLISH_UPSIDE' || metrics.skewRegime === 'EXTREME_REVERSE_SKEW') {
      strategies.push({
        strategyName: 'Bull Call Debit Vertical Spread',
        category: 'BULLISH',
        actionVerdict: 'Exploit Call Skew',
        rationale: 'Because upside calls are trading at elevated IV, selling a higher-strike OTM call subsidizes the long ATM call, capturing directional upside while neutralizing rich volatility.',
        suggestedSetup: `Buy ATM $${metrics.spotPrice.toFixed(0)} Call / Sell OTM $${metrics.callWallStrike.toFixed(0)} Call`,
        skewEdge: 'Short leg sells overvalued call IV, boosting return on capital and lowering breakeven.',
      });
      strategies.push({
        strategyName: 'Covered Call / Buy-Write',
        category: 'NEUTRAL_INCOME',
        actionVerdict: 'Harvest Rich Call Premiums',
        rationale: 'Selling out-of-the-money calls against stock equity harvests the inflated call volatility premium.',
        suggestedSetup: `Long Stock + Sell $${metrics.delta25CallStrike.toFixed(0)} Call`,
        skewEdge: 'Captures top-decile option premium yields due to upside call skew bidding.',
      });
    } else {
      strategies.push({
        strategyName: 'Bull Put Credit Spread (Cash-Secured Alternative)',
        category: 'BULLISH',
        actionVerdict: 'Harvest Put Skew Premium',
        rationale: 'Because OTM puts command a steep volatility premium over calls, selling put credit spreads yields high return on risk with a wide margin of safety.',
        suggestedSetup: `Sell $${metrics.delta25PutStrike.toFixed(0)} Put / Buy $${metrics.delta10PutStrike.toFixed(0)} Put`,
        skewEdge: 'Sells the high-IV downside skew; theta decay accelerates as long as support holds.',
      });
      strategies.push({
        strategyName: 'Long Stock or Synthetic Long (Zebra / Long Call)',
        category: 'BULLISH',
        actionVerdict: 'Cheap Upside Leverage',
        rationale: 'Because upside call IV is relatively cheap compared to puts, purchasing directional call exposure incurs lower volatility drag.',
        suggestedSetup: `Buy $${metrics.spotPrice.toFixed(0)} Call (${metrics.selectedDte}d DTE)`,
        skewEdge: 'Enters upside convexity without overpaying for implied volatility.',
      });
    }

    return {
      directAnswers: {
        arePutsAndCallsEquidistant: {
          answer: isEquidistant,
          badgeText: eqBadge,
          headline: eqHeadline,
          explanation: eqExplanation,
        },
        areOptionsImplyingUpside: {
          answer: isUpside,
          badgeText: upBadge,
          headline: upHeadline,
          explanation: upExplanation,
        },
      },
      executiveSummary: `${symbol} options for the ${metrics.selectedExpiration} cycle (${metrics.selectedDte}d DTE) reflect an ATM volatility of ${metrics.atmIv}% with a ${metrics.skewRegime.replace(/_/g, ' ')} structure. 25-Delta Risk Reversal stands at ${metrics.delta25RiskReversal > 0 ? '+' : ''}${metrics.delta25RiskReversal}%, while Max Pain is at $${metrics.maxPainStrike} (${metrics.maxPainDistancePercent >= 0 ? '+' : ''}${metrics.maxPainDistancePercent.toFixed(1)}% from spot).`,
      volatilitySmileAnalysis: `Comparing equidistant strikes across the chain reveals an average IV spread of ${metrics.averageIvSkewDiff > 0 ? '+' : ''}${metrics.averageIvSkewDiff}%. The 25-Delta Call sits at ${metrics.delta25CallIv}% IV ($${metrics.delta25CallStrike}) versus ${metrics.delta25PutIv}% IV ($${metrics.delta25PutStrike}) for the 25-Delta Put. Butterfly curvature of ${metrics.butterfly25Delta}% denotes ${metrics.butterfly25Delta > 0 ? 'elevated tail risk wings' : 'compressed tail expectations'}.`,
      institutionalTailRisk: `Deep out-of-the-money 10-Delta tail skew is ${metrics.delta10TailSkew > 0 ? '+' : ''}${metrics.delta10TailSkew}%. Institutional open interest is anchored between Call Wall at $${metrics.callWallStrike} and Put Wall at $${metrics.putWallStrike}. Put/Call OI ratio is ${metrics.putCallOiRatio}x.`,
      optimalDerivativesStrategies: strategies,
      catalystsAndRisks: [
        `Earnings & Macro Catalysts: Implied move of ${chain.analytics?.expectedMovePercent || 5}% priced into front cycle.`,
        `Pinning Pressure: Expiration convergence toward Max Pain $${metrics.maxPainStrike}.`,
        `Gamma Flip Threshold: Dealer hedging behavior switches regimes near $${chain.keyLevels?.gammaFlip?.estimatedStrike || metrics.spotPrice}.`,
      ],
      source: 'QUANTITATIVE_ENGINE' as const,
    };
  }
}

export const optionsSkewAgentService = new OptionsSkewAgentService();
