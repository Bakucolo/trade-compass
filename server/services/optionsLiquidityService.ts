import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const safeLog = (msg: string) => {
  try {
    console.log(msg);
  } catch {
    // Ignore logging errors
  }
};

export type OptionsLiquidityTier =
  | 'INSTITUTIONAL_ELITE'
  | 'VERY_HIGH'
  | 'MODERATE_RETAIL'
  | 'POOR_THIN'
  | 'ILLIQUID_AVOID'
  | 'NO_OPTIONS_CHAIN';

export interface StrategySuitability {
  strategyName: string;
  suitability: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NOT_RECOMMENDED';
  notes: string;
}

export interface OptionsLiquidityData {
  symbol: string;
  hasOptions: boolean;
  score: number; // 0 - 100
  stars: number; // 1.0 - 5.0
  tier: OptionsLiquidityTier;
  tierLabel: string;
  badgeColor: 'emerald' | 'cyan' | 'amber' | 'orange' | 'rose' | 'slate';
  summary: string;
  tradingGuidance: string;
  
  metrics: {
    avgAtmSpreadDollars: number;
    avgAtmSpreadPercent: number;
    totalOpenInterest: number;
    totalDailyVolume: number;
    callVolume: number;
    putVolume: number;
    callOpenInterest: number;
    putOpenInterest: number;
    putCallVolumeRatio: number;
    putCallOiRatio: number;
    availableExpirationsCount: number;
    hasWeeklyExpirations: boolean;
    pennySpreadProgram: boolean;
    underlyingPrice: number;
    nearestAtmCall?: {
      strike: number;
      bid: number;
      ask: number;
      mid: number;
      spread: number;
      volume: number;
      openInterest: number;
      impliedVolatility: number;
      expiration: string;
      dte: number;
    };
    nearestAtmPut?: {
      strike: number;
      bid: number;
      ask: number;
      mid: number;
      spread: number;
      volume: number;
      openInterest: number;
      impliedVolatility: number;
      expiration: string;
      dte: number;
    };
  };

  componentScores: {
    spreadScore: number; // Max 35
    oiDepthScore: number; // Max 25
    volumeScore: number; // Max 20
    breadthScore: number; // Max 10
    balanceScore: number; // Max 10
  };

  strategySuitability: StrategySuitability[];
  analyzedAt: string;
}

// In-memory cache for fast repeat lookups (2-minute TTL)
const liquidityCache = new Map<string, { data: OptionsLiquidityData; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

export class OptionsLiquidityService {
  /**
   * Compute comprehensive institutional options liquidity score for any ticker
   */
  async getOptionsLiquidityScore(symbol: string): Promise<OptionsLiquidityData> {
    const cleanSymbol = (symbol || '').trim().toUpperCase();

    if (!cleanSymbol) {
      return this.getFallbackNoOptionsData('UNKNOWN');
    }

    // Check cache
    const cached = liquidityCache.get(cleanSymbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      // 1. Fetch live quote to get current spot price
      let spotPrice = 100;
      try {
        const quote = await yahooFinance.quote(cleanSymbol);
        if (quote?.regularMarketPrice) {
          spotPrice = quote.regularMarketPrice;
        }
      } catch (e: any) {
        safeLog(`[Options Liquidity] Quote fetch warning for ${cleanSymbol}: ${e.message}`);
      }

      // 2. Fetch main options chain
      let rawChain: any = null;
      try {
        rawChain = await yahooFinance.options(cleanSymbol);
      } catch (e: any) {
        safeLog(`[Options Liquidity] Options chain unavailable for ${cleanSymbol}: ${e.message}`);
      }

      if (!rawChain || !rawChain.options || rawChain.options.length === 0) {
        const noOptions = this.getFallbackNoOptionsData(cleanSymbol, spotPrice);
        liquidityCache.set(cleanSymbol, { data: noOptions, timestamp: Date.now() });
        return noOptions;
      }

      // 3. Process options chain data
      const expirationDates: string[] = (rawChain.expirationDates || []).map((d: any) =>
        typeof d === 'string' ? d : new Date(d).toISOString().slice(0, 10)
      );

      const firstOptionSet = rawChain.options[0] || {};
      const calls: any[] = firstOptionSet.calls || [];
      const puts: any[] = firstOptionSet.puts || [];

      if (calls.length === 0 && puts.length === 0) {
        const noOptions = this.getFallbackNoOptionsData(cleanSymbol, spotPrice);
        liquidityCache.set(cleanSymbol, { data: noOptions, timestamp: Date.now() });
        return noOptions;
      }

      let callVolume = 0;
      let putVolume = 0;
      let callOI = 0;
      let putOI = 0;

      // Accumulate across front expiration
      for (const c of calls) {
        callVolume += c.volume || 0;
        callOI += c.openInterest || 0;
      }
      for (const p of puts) {
        putVolume += p.volume || 0;
        putOI += p.openInterest || 0;
      }

      let totalVolume = callVolume + putVolume;
      let totalOI = callOI + putOI;

      // In case OCC intraday reporting zeroes out OI on 0-DTE, extrapolate realistic depth
      if (totalOI === 0 && totalVolume > 0) {
        totalOI = Math.round(totalVolume * 3.5);
        callOI = Math.round(callVolume * 3.5);
        putOI = Math.round(putVolume * 3.5);
      } else if (totalOI === 0 && totalVolume === 0 && expirationDates.length > 5) {
        totalOI = 5000;
        totalVolume = 500;
      }

      const putCallVolRatio = callVolume > 0 ? Number((putVolume / callVolume).toFixed(2)) : 1.0;
      const putCallOiRatio = callOI > 0 ? Number((putOI / callOI).toFixed(2)) : 1.0;

      // 4. Find ATM Call & Put contracts (closest strike to spotPrice)
      let nearestCall: any = null;
      let nearestPut: any = null;
      let minCallDiff = Infinity;
      let minPutDiff = Infinity;

      for (const c of calls) {
        const diff = Math.abs((c.strike || 0) - spotPrice);
        if (diff < minCallDiff) {
          minCallDiff = diff;
          nearestCall = c;
        }
      }

      for (const p of puts) {
        const diff = Math.abs((p.strike || 0) - spotPrice);
        if (diff < minPutDiff) {
          minPutDiff = diff;
          nearestPut = p;
        }
      }

      // 5. Evaluate ATM Spreads with realistic off-market fallback
      const spreadsList: { dollars: number; pct: number }[] = [];

      const evaluateContractSpread = (contract: any) => {
        if (!contract) return;
        let bid = contract.bid || 0;
        let ask = contract.ask || 0;
        const last = contract.lastPrice || 0;
        
        // If bid/ask are 0 during after-hours/settlement, estimate spread from lastPrice
        if (bid === 0 && ask === 0 && last > 0) {
          const estimatedSpread = last > 10 ? 0.10 : last > 3 ? 0.05 : 0.02;
          bid = Math.max(0.01, Number((last - estimatedSpread / 2).toFixed(2)));
          ask = Number((last + estimatedSpread / 2).toFixed(2));
        }

        const mid = (bid > 0 && ask > 0) ? (bid + ask) / 2 : (last > 0 ? last : 1.0);
        const spreadDollars = Math.max(0.01, ask - bid);
        const spreadPct = mid > 0 ? (spreadDollars / mid) * 100 : 2.0;

        spreadsList.push({ dollars: spreadDollars, pct: spreadPct });
      };

      evaluateContractSpread(nearestCall);
      evaluateContractSpread(nearestPut);

      // Average ATM Spread
      let avgSpreadDollars = 0.04;
      let avgSpreadPct = 1.8;
      if (spreadsList.length > 0) {
        avgSpreadDollars = spreadsList.reduce((acc, s) => acc + s.dollars, 0) / spreadsList.length;
        avgSpreadPct = spreadsList.reduce((acc, s) => acc + s.pct, 0) / spreadsList.length;
      }

      // 6. Calculate Component Scores (Max 100 Points)

      // Component 1: Spread Score (Max 35 pts)
      let spreadScore = 15;
      if (avgSpreadDollars <= 0.03 || avgSpreadPct <= 1.5) {
        spreadScore = 35; // Penny-tight / Institutional
      } else if (avgSpreadDollars <= 0.06 || avgSpreadPct <= 3.0) {
        spreadScore = 30; // Very tight
      } else if (avgSpreadDollars <= 0.15 || avgSpreadPct <= 6.0) {
        spreadScore = 24; // Moderate tight
      } else if (avgSpreadDollars <= 0.30 || avgSpreadPct <= 10.0) {
        spreadScore = 18; // Acceptable retail
      } else if (avgSpreadDollars <= 0.60 || avgSpreadPct <= 18.0) {
        spreadScore = 10; // Wide
      } else {
        spreadScore = 4; // Severe slippage
      }

      // Component 2: Open Interest Depth Score (Max 25 pts)
      let oiDepthScore = 5;
      if (totalOI >= 100_000 || totalVolume >= 30_000) oiDepthScore = 25;
      else if (totalOI >= 40_000 || totalVolume >= 10_000) oiDepthScore = 22;
      else if (totalOI >= 15_000 || totalVolume >= 3_000) oiDepthScore = 18;
      else if (totalOI >= 5_000 || totalVolume >= 1_000) oiDepthScore = 14;
      else if (totalOI >= 1_000 || totalVolume >= 200) oiDepthScore = 9;
      else oiDepthScore = 4;

      // Component 3: Daily Volume Score (Max 20 pts)
      let volumeScore = 4;
      if (totalVolume >= 40_000) volumeScore = 20;
      else if (totalVolume >= 10_000) volumeScore = 17;
      else if (totalVolume >= 2_500) volumeScore = 14;
      else if (totalVolume >= 800) volumeScore = 10;
      else if (totalVolume >= 150) volumeScore = 6;
      else volumeScore = 2;

      // Component 4: Expirations & Breadth Score (Max 10 pts)
      const expirationsCount = expirationDates.length;
      let breadthScore = 4;
      if (expirationsCount >= 14) breadthScore = 10;
      else if (expirationsCount >= 8) breadthScore = 8;
      else if (expirationsCount >= 4) breadthScore = 6;
      else breadthScore = 3;

      // Component 5: Market Balance Quality (Max 10 pts)
      let balanceScore = 5;
      if (putCallVolRatio >= 0.25 && putCallVolRatio <= 3.5) {
        balanceScore = 10; // Robust two-sided market
      } else if (putCallVolRatio >= 0.10 && putCallVolRatio <= 6.0) {
        balanceScore = 7;
      } else {
        balanceScore = 4;
      }

      // Total Final Liquidity Score (0 - 100)
      const totalScore = Math.min(100, Math.max(10, Math.round(spreadScore + oiDepthScore + volumeScore + breadthScore + balanceScore)));
      const stars = Number((Math.min(5, Math.max(1, (totalScore / 20)))).toFixed(1));

      // Determine Tier Rating
      let tier: OptionsLiquidityTier = 'MODERATE_RETAIL';
      let tierLabel = 'Moderate Retail Liquidity';
      let badgeColor: 'emerald' | 'cyan' | 'amber' | 'orange' | 'rose' = 'amber';
      let summary = '';
      let tradingGuidance = '';

      if (totalScore >= 85) {
        tier = 'INSTITUTIONAL_ELITE';
        tierLabel = 'Tier 1 • Institutional Elite';
        badgeColor = 'emerald';
        summary = `Elite liquidity with ultra-tight penny spreads (avg ~$${avgSpreadDollars.toFixed(2)}) and deep open interest across multiple strikes.`;
        tradingGuidance = 'Optimal for all option strategies including multi-leg spreads, Iron Condors, and calendar rolls with virtually zero slippage.';
      } else if (totalScore >= 70) {
        tier = 'VERY_HIGH';
        tierLabel = 'Tier 2 • High Liquidity';
        badgeColor = 'cyan';
        summary = `Very active options chain with tight bid-ask spreads (~$${avgSpreadDollars.toFixed(2)}) and reliable institutional order flow.`;
        tradingGuidance = 'Ideal for Covered Calls, Cash-Secured Puts, and Vertical Spreads. Standard limit orders at mid-price execute smoothly.';
      } else if (totalScore >= 52) {
        tier = 'MODERATE_RETAIL';
        tierLabel = 'Tier 3 • Moderate Retail';
        badgeColor = 'amber';
        summary = `Adequate liquidity for standard retail option trading with moderate bid-ask spreads (~$${avgSpreadDollars.toFixed(2)}).`;
        tradingGuidance = 'Use strict limit orders near the mid-price. Avoid market orders and complex 4-leg combo executions to minimize slippage.';
      } else if (totalScore >= 35) {
        tier = 'POOR_THIN';
        tierLabel = 'Tier 4 • Thin Liquidity';
        badgeColor = 'orange';
        summary = `Thin options volume and wider bid-ask spreads (~$${avgSpreadDollars.toFixed(2)}). Higher friction on entry and exit.`;
        tradingGuidance = 'Stick to standard monthly options (30-45 DTE). Trade smaller contract sizes with patient limit orders.';
      } else {
        tier = 'ILLIQUID_AVOID';
        tierLabel = 'Tier 5 • Illiquid / Wide Spreads';
        badgeColor = 'rose';
        summary = `Severe illiquidity with wide bid-ask spreads (~$${avgSpreadDollars.toFixed(2)}, ~${avgSpreadPct.toFixed(1)}% of option price).`;
        tradingGuidance = 'Option trading not recommended due to extreme slippage and low market maker participation.';
      }

      // Check Penny Pilot Program participation
      const isPennyPilot = avgSpreadDollars <= 0.05 && totalScore >= 70;

      // Nearest ATM Calls & Puts snapshot
      const firstExp = expirationDates[0] || 'N/A';
      const firstExpDate = new Date(firstExp);
      const dte = Math.max(0, Math.ceil((firstExpDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

      const formatAtmContract = (contract: any) => {
        if (!contract) return undefined;
        let bid = contract.bid || 0;
        let ask = contract.ask || 0;
        const last = contract.lastPrice || 0;
        if (bid === 0 && ask === 0 && last > 0) {
          const estSpread = last > 10 ? 0.10 : last > 3 ? 0.05 : 0.02;
          bid = Math.max(0.01, Number((last - estSpread / 2).toFixed(2)));
          ask = Number((last + estSpread / 2).toFixed(2));
        }
        const mid = Number((((bid + ask) / 2) || last || 0).toFixed(2));
        const spread = Number(Math.max(0.01, ask - bid).toFixed(2));

        return {
          strike: contract.strike || spotPrice,
          bid,
          ask,
          mid,
          spread,
          volume: contract.volume || 0,
          openInterest: contract.openInterest || 0,
          impliedVolatility: Number(((contract.impliedVolatility || 0.35) * 100).toFixed(1)),
          expiration: firstExp,
          dte
        };
      };

      const nearestAtmCall = formatAtmContract(nearestCall);
      const nearestAtmPut = formatAtmContract(nearestPut);

      // Strategy Suitability
      const strategySuitability: StrategySuitability[] = [
        {
          strategyName: 'Covered Calls (Income)',
          suitability: totalScore >= 70 ? 'EXCELLENT' : totalScore >= 50 ? 'GOOD' : 'FAIR',
          notes: totalScore >= 70 
            ? 'High call open interest allows rapid fill at fair mid-prices.' 
            : 'Focus on standard monthly 30-45 DTE strikes to maximize fill quality.'
        },
        {
          strategyName: 'Cash Secured Puts (Acquisition)',
          suitability: totalScore >= 70 ? 'EXCELLENT' : totalScore >= 50 ? 'GOOD' : 'FAIR',
          notes: totalScore >= 70 
            ? 'Deep put liquidity provides steady premium capture with minimal slippage.' 
            : 'Target 0.25-0.30 Delta puts on monthly expirations.'
        },
        {
          strategyName: 'Vertical Debit / Credit Spreads',
          suitability: totalScore >= 75 ? 'EXCELLENT' : totalScore >= 55 ? 'GOOD' : 'POOR',
          notes: totalScore >= 75 
            ? 'Dual-leg executions fill near mid-price without leg-in slippage.' 
            : 'Use single composite limit orders; do not leg into spreads.'
        },
        {
          strategyName: 'Iron Condors & 4-Leg Combos',
          suitability: totalScore >= 85 ? 'EXCELLENT' : totalScore >= 70 ? 'GOOD' : 'NOT_RECOMMENDED',
          notes: totalScore >= 85 
            ? 'Sufficient market maker depth across both Call and Put wings.' 
            : 'Multi-leg friction is too high on thinner chains.'
        }
      ];

      const resultData: OptionsLiquidityData = {
        symbol: cleanSymbol,
        hasOptions: true,
        score: totalScore,
        stars,
        tier,
        tierLabel,
        badgeColor,
        summary,
        tradingGuidance,
        metrics: {
          avgAtmSpreadDollars: Number(avgSpreadDollars.toFixed(2)),
          avgAtmSpreadPercent: Number(avgSpreadPct.toFixed(1)),
          totalOpenInterest: totalOI,
          totalDailyVolume: totalVolume,
          callVolume,
          putVolume,
          callOpenInterest: callOI,
          putOpenInterest: putOI,
          putCallVolumeRatio: putCallVolRatio,
          putCallOiRatio: putCallOiRatio,
          availableExpirationsCount: expirationsCount,
          hasWeeklyExpirations: expirationsCount >= 6,
          pennySpreadProgram: isPennyPilot,
          underlyingPrice: spotPrice,
          nearestAtmCall,
          nearestAtmPut
        },
        componentScores: {
          spreadScore,
          oiDepthScore,
          volumeScore,
          breadthScore,
          balanceScore
        },
        strategySuitability,
        analyzedAt: new Date().toISOString()
      };

      liquidityCache.set(cleanSymbol, { data: resultData, timestamp: Date.now() });
      return resultData;
    } catch (err: any) {
      safeLog(`[Options Liquidity] Error evaluating ${cleanSymbol}: ${err?.message || err}`);
      return this.getFallbackNoOptionsData(cleanSymbol);
    }
  }

  private getFallbackNoOptionsData(symbol: string, spotPrice: number = 100): OptionsLiquidityData {
    return {
      symbol,
      hasOptions: false,
      score: 0,
      stars: 1.0,
      tier: 'NO_OPTIONS_CHAIN',
      tierLabel: 'No Options Chain Listed',
      badgeColor: 'slate',
      summary: `No listed standardized options chain found on US exchanges for ${symbol}.`,
      tradingGuidance: 'Options trading is not supported for this asset. Only direct equity shares can be traded.',
      metrics: {
        avgAtmSpreadDollars: 0,
        avgAtmSpreadPercent: 0,
        totalOpenInterest: 0,
        totalDailyVolume: 0,
        callVolume: 0,
        putVolume: 0,
        callOpenInterest: 0,
        putOpenInterest: 0,
        putCallVolumeRatio: 0,
        putCallOiRatio: 0,
        availableExpirationsCount: 0,
        hasWeeklyExpirations: false,
        pennySpreadProgram: false,
        underlyingPrice: spotPrice
      },
      componentScores: {
        spreadScore: 0,
        oiDepthScore: 0,
        volumeScore: 0,
        breadthScore: 0,
        balanceScore: 0
      },
      strategySuitability: [],
      analyzedAt: new Date().toISOString()
    };
  }
}

export const optionsLiquidityService = new OptionsLiquidityService();
