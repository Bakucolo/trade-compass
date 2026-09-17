import { describe, it, expect } from 'vitest';
import { optionsSkewAgentService } from '../../server/services/optionsSkewAgentService';
import { OptionsChainData } from '../../server/services/optionsChainService';

describe('Options Skew & Upside Bias Agent - Quant & Agent Engine', () => {
  const createMockChain = (options: {
    spot: number;
    callIvOffset: number; // Positive means call IV > put IV
    maxPainPull?: 'BULLISH_PULL' | 'BEARISH_PULL' | 'PINNED';
  }): OptionsChainData => {
    const spot = options.spot;
    const baseAtmIv = 35.0;

    // Generate strikes around spot from -25% to +25%
    const offsets = [-0.20, -0.15, -0.10, -0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.10, 0.15, 0.20];
    const strikes = offsets.map((offset) => {
      const strike = Math.round(spot * (1 + offset));
      const isAtm = offset === 0;

      // When callIvOffset > 0, Call IV is higher than Put IV
      // When callIvOffset < 0, Put IV is higher (standard put skew)
      const putIv = baseAtmIv - (offset * 15) + (options.callIvOffset < 0 ? Math.abs(options.callIvOffset) : 0);
      const callIv = baseAtmIv + (offset * 10) + (options.callIvOffset > 0 ? options.callIvOffset : -Math.abs(options.callIvOffset));

      // Delta approximations
      const callDelta = Math.max(0.05, Math.min(0.95, 0.50 - offset * 2));
      const putDelta = -Math.max(0.05, Math.min(0.95, 0.50 + offset * 2));

      return {
        strike,
        isAtm,
        call: {
          contractSymbol: `TEST_C_${strike}`,
          strike,
          optionType: 'CALL' as const,
          expiration: '2026-10-16',
          dte: 32,
          bid: Math.max(0.1, 5 - offset * 20),
          ask: Math.max(0.2, 5.2 - offset * 20),
          mid: Math.max(0.15, 5.1 - offset * 20),
          lastPrice: 5.1,
          change: 0,
          percentChange: 0,
          volume: 500,
          openInterest: 2000,
          impliedVolatility: parseFloat(callIv.toFixed(1)),
          inTheMoney: offset < 0,
          spread: 0.2,
          spreadPercent: 4.0,
          delta: parseFloat(callDelta.toFixed(2)),
          gamma: 0.03,
          theta: -0.12,
          vega: 0.25,
        },
        put: {
          contractSymbol: `TEST_P_${strike}`,
          strike,
          optionType: 'PUT' as const,
          expiration: '2026-10-16',
          dte: 32,
          bid: Math.max(0.1, 5 + offset * 20),
          ask: Math.max(0.2, 5.2 + offset * 20),
          mid: Math.max(0.15, 5.1 + offset * 20),
          lastPrice: 5.1,
          change: 0,
          percentChange: 0,
          volume: 450,
          openInterest: 1800,
          impliedVolatility: parseFloat(putIv.toFixed(1)),
          inTheMoney: offset > 0,
          spread: 0.2,
          spreadPercent: 4.0,
          delta: parseFloat(putDelta.toFixed(2)),
          gamma: 0.03,
          theta: -0.12,
          vega: 0.25,
        },
      };
    });

    return {
      symbol: 'TEST',
      companyName: 'Test Corporation',
      underlyingPrice: spot,
      underlyingChange: 1.5,
      underlyingChangePercent: 1.5,
      selectedExpiration: '2026-10-16',
      selectedDte: 32,
      expirations: [
        { date: '2026-10-16', dte: 32, formattedDate: 'Oct 16, 2026', type: 'MONTHLY' },
      ],
      strikes,
      analytics: {
        totalCallVolume: 10000,
        totalPutVolume: 8000,
        totalCallOpenInterest: 50000,
        totalPutOpenInterest: 45000,
        putCallVolumeRatio: 0.8,
        putCallOiRatio: 0.9,
        impliedVolatilityAtm: baseAtmIv,
        expectedMoveDollars: spot * 0.06,
        expectedMovePercent: 6.0,
        maxPainStrike: spot * 1.02,
      },
      keyLevels: {
        maxPain: {
          strike: spot * 1.02,
          distanceDollars: spot * 0.02,
          distancePercent: 2.0,
          pullDirection: options.maxPainPull || 'BULLISH_PULL',
          description: 'Pinning level',
        },
        callWall: {
          strike: spot * 1.10,
          openInterest: 12000,
          notionalDollars: 12000000,
          distancePercent: 10.0,
          role: 'PRIMARY_RESISTANCE',
          description: 'Call wall',
        },
        putWall: {
          strike: spot * 0.90,
          openInterest: 9000,
          notionalDollars: 9000000,
          distancePercent: -10.0,
          role: 'PRIMARY_SUPPORT',
          description: 'Put wall',
        },
        secondaryLevels: { callResistances: [], putSupports: [] },
        gammaFlip: {
          estimatedStrike: spot * 0.98,
          currentRegime: 'POSITIVE_GAMMA',
          description: 'Positive gamma pinning',
        },
      },
      bigOiStrikes: [],
      bigOiExpirations: [],
      underlyingDynamics: {
        headline: 'Normal dynamic',
        supportResistanceRange: 'Range',
        pinningPressure: 'Moderate',
        institutionalBias: 'Balanced',
        tradingImplication: 'Standard',
      },
      fetchedAt: new Date().toISOString(),
    };
  };

  it('correctly detects conventional Put Skew and answers questions accurately', () => {
    // Standard stock with put skew (puts are priced with higher IV than calls)
    const mockChain = createMockChain({ spot: 100, callIvOffset: -6.0 });
    const { metrics, equidistantPairs } = optionsSkewAgentService.computeQuantitativeSkew(mockChain);

    expect(equidistantPairs.length).toBeGreaterThan(0);
    
    // Check that puts have higher IV on average
    expect(metrics.averageIvSkewDiff).toBeLessThan(0);
    expect(metrics.arePutsAndCallsEquidistant).toBe(false);
    expect(metrics.equidistanceVerdict).toBe('PUT_SKEWED_DOWNSIDE_HEAVY');

    // Check that it does NOT imply upside
    expect(metrics.isImplyingUpside).toBe(false);
    expect(['BEARISH_DOWNSIDE_HEDGE', 'NEUTRAL_BALANCED']).toContain(metrics.impliedDirectionalBias);
  });

  it('correctly detects Bullish Call Skew / Reverse Skew and flags stock upside expectation', () => {
    // Momentum / squeeze stock where calls trade at higher IV than puts
    const mockChain = createMockChain({ spot: 100, callIvOffset: 6.0, maxPainPull: 'BULLISH_PULL' });
    const { metrics, equidistantPairs } = optionsSkewAgentService.computeQuantitativeSkew(mockChain);

    expect(equidistantPairs.length).toBeGreaterThan(0);
    
    // Check that calls have higher IV
    expect(metrics.averageIvSkewDiff).toBeGreaterThan(0);
    expect(metrics.arePutsAndCallsEquidistant).toBe(false);
    expect(metrics.equidistanceVerdict).toBe('CALL_SKEWED_UPSIDE_HEAVY');

    // 25-Delta risk reversal should be positive
    expect(metrics.delta25RiskReversal).toBeGreaterThan(0);

    // Should indicate options ARE implying stock upside
    expect(metrics.isImplyingUpside).toBe(true);
    expect(['STRONGLY_BULLISH_UPSIDE', 'MODERATE_UPSIDE_TILT']).toContain(metrics.impliedDirectionalBias);
    expect(metrics.directionalConfidenceScore).toBeGreaterThan(60);
  });

  it('computes equidistant pairs with matched offsets (±2.5%, ±5%, ±10%, etc.)', () => {
    const mockChain = createMockChain({ spot: 200, callIvOffset: 0 });
    const { equidistantPairs } = optionsSkewAgentService.computeQuantitativeSkew(mockChain);

    // Verify pairs match target offsets
    const offsets = equidistantPairs.map(p => p.targetDistancePercent);
    expect(offsets).toContain(5);
    expect(offsets).toContain(10);

    const pair10 = equidistantPairs.find(p => p.targetDistancePercent === 10);
    expect(pair10).toBeDefined();
    if (pair10) {
      expect(pair10.callStrike).toBeGreaterThan(200);
      expect(pair10.putStrike).toBeLessThan(200);
      expect(pair10.callImpliedVol).toBeGreaterThan(0);
      expect(pair10.putImpliedVol).toBeGreaterThan(0);
      expect(pair10.ivSkewDiff).toBeDefined();
      expect(pair10.skewDescription).toBeDefined();
    }
  });

  it('generates rich deterministic synthesis with direct answers and optimal derivatives strategies', async () => {
    const mockChain = createMockChain({ spot: 100, callIvOffset: 5.0 });
    const quant = optionsSkewAgentService.computeQuantitativeSkew(mockChain);

    // Direct deterministic fallback test
    const synthesis = (optionsSkewAgentService as any).buildDeterministicAgentSynthesis(
      'TEST',
      mockChain,
      quant.metrics,
      quant.equidistantPairs
    );

    expect(synthesis.directAnswers).toBeDefined();
    expect(synthesis.directAnswers.arePutsAndCallsEquidistant).toBeDefined();
    expect(synthesis.directAnswers.arePutsAndCallsEquidistant.badgeText).toContain('NO');
    expect(synthesis.directAnswers.areOptionsImplyingUpside.answer).toBe(true);
    expect(synthesis.directAnswers.areOptionsImplyingUpside.badgeText).toContain('YES');

    // Strategies
    expect(synthesis.optimalDerivativesStrategies.length).toBeGreaterThan(0);
    const strat = synthesis.optimalDerivativesStrategies[0];
    expect(strat.strategyName).toBeDefined();
    expect(strat.rationale).toBeDefined();
    expect(strat.suggestedSetup).toBeDefined();
    expect(strat.skewEdge).toBeDefined();
  });
});
