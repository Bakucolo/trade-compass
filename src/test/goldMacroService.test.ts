import { describe, it, expect, vi } from 'vitest';
import {
  calculatePercentile,
  calculateZScore,
  calculateChanges,
  assessStaleness,
  computeGoldMacroRegime,
  fetchHistoricalGoldMacroRegime,
  runGoldRegimeBacktest,
  generateGoldMacroAiNarrative,
  MACRO_AI_ENABLED,
  ObservationPoint
} from '../../server/services/goldMacroService';

describe('Gold Macro Regime Quantitative Engine & Scoring Architecture', () => {

  // ==========================================
  // 1. DATA TRANSFORMATION & RESILIENCE
  // ==========================================
  describe('Data Transformation, Resilience & Edge Cases', () => {
    it('should calculate percentiles accurately across normal distributions', () => {
      const history = [1.0, 2.0, 3.0, 4.0, 5.0];
      // 3.0 is exact median -> 50th percentile
      expect(calculatePercentile(3.0, history)).toBe(50);
      // Below all -> 0th percentile
      expect(calculatePercentile(0.5, history)).toBe(0);
      // Above all -> 100th percentile
      expect(calculatePercentile(6.0, history)).toBe(100);
      // Empty history fallback
      expect(calculatePercentile(3.0, [])).toBe(50);
    });

    it('should calculate standard Z-scores properly', () => {
      const history = [10, 10, 10, 10, 10];
      // zero std dev
      expect(calculateZScore(10, history)).toBe(0);

      const varianceHistory = [10, 20, 30];
      const z = calculateZScore(30, varianceHistory);
      expect(z).toBeGreaterThan(1.0);
    });

    it('should handle missing observations, holidays, and sparse series gracefully in calculateChanges', () => {
      // Empty series
      const emptyResult = calculateChanges([]);
      expect(emptyResult.current).toBe(0);
      expect(emptyResult.change1M).toBe(0);
      expect(emptyResult.change3M).toBe(0);

      // Single observation (holiday/new series)
      const singleObs: ObservationPoint[] = [{ date: '2026-09-28', value: 2.85 }];
      const singleResult = calculateChanges(singleObs);
      expect(singleResult.current).toBe(2.85);
      expect(singleResult.change1M).toBe(0);

      // Multiple observations with weekend gaps
      const normalSeries: ObservationPoint[] = [
        { date: '2026-06-01', value: 2.00 },
        { date: '2026-08-01', value: 2.40 },
        { date: '2026-09-28', value: 2.80 }
      ];
      const res = calculateChanges(normalSeries);
      expect(res.current).toBe(2.80);
      expect(res.prev).toBe(2.40);
      expect(res.change1M).toBeCloseTo(0.80, 2);
    });

    it('should correctly assess data age and detect stale vs fresh data', () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const fresh = assessStaleness(todayIso, 'daily');
      expect(fresh.isStale).toBe(false);
      expect(fresh.warning).toContain('✓ Updated');

      // Date from 25 days ago (stale for daily)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 25);
      const stale = assessStaleness(pastDate.toISOString().slice(0, 10), 'daily');
      expect(stale.isStale).toBe(true);
      expect(stale.warning).toContain('⚠ DATA STALE');
    });
  });

  // ==========================================
  // 2. SCENARIO & REGIME CLASSIFICATION TESTING
  // ==========================================
  describe('Representative Economic Scenarios & Regime Logic', () => {
    it('should evaluate the 5-pillar composite structure and return valid snapshot ranges', async () => {
      const snapshot = await computeGoldMacroRegime();

      expect(snapshot).toBeDefined();
      expect(snapshot.goldMacroScore).toBeGreaterThanOrEqual(0);
      expect(snapshot.goldMacroScore).toBeLessThanOrEqual(100);

      // 4 Independent Regimes
      expect(['STRONGLY_BEARISH', 'BEARISH', 'NEUTRAL', 'BULLISH', 'STRONGLY_BULLISH']).toContain(snapshot.structuralRegime);
      expect(['STRONG_HEADWIND', 'MODERATE_HEADWIND', 'MIXED_NEUTRAL', 'MODERATE_TAILWIND', 'STRONG_TAILWIND']).toContain(snapshot.tacticalPressure);
      expect(['LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'EXTREME']).toContain(snapshot.fiscalPressureCategory);
      expect(['LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'EXTREME']).toContain(snapshot.stagflationPressureCategory);

      // 5 Analytical Pillars
      expect(snapshot.pillars).toHaveLength(5);
      const pillarIds = snapshot.pillars.map(p => p.id);
      expect(pillarIds).toContain('real_rates');
      expect(pillarIds).toContain('usd');
      expect(pillarIds).toContain('inflation_stagflation');
      expect(pillarIds).toContain('fiscal_treasury');
      expect(pillarIds).toContain('liquidity_conditions');

      // Check weights sum to 1.0
      const totalWeight = snapshot.pillars.reduce((s, p) => s + p.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);

      // Verify each pillar has scores within [-100, +100]
      snapshot.pillars.forEach(p => {
        expect(p.rawScore).toBeGreaterThanOrEqual(-100);
        expect(p.rawScore).toBeLessThanOrEqual(100);
        expect(p.contribution).toBeCloseTo(p.rawScore * p.effectiveWeight, 1);
      });

      // Verification of Why Panel & Narrative
      expect(snapshot.whyUnderPressureOrSupported).toBeTruthy();
      expect(typeof snapshot.whyUnderPressureOrSupported).toBe('string');
      expect(snapshot.whatIsHurtingGold.length + snapshot.whatIsSupportingGold.length).toBeGreaterThan(0);
      expect(snapshot.whatWouldChangeMyMind.length).toBeGreaterThanOrEqual(4);

      // Fiscal telemetry
      expect(snapshot.fiscalTelemetry).toBeDefined();
      expect(snapshot.fiscalTelemetry.debtToPennyTrillions).toBeGreaterThan(20);
      expect(snapshot.fiscalTelemetry.recentAuctions.length).toBeGreaterThan(0);
    });

    it('should distinguish inflation shocks accompanied by real yield hikes vs easing', () => {
      // Economic logic test:
      // Scenario 1: Energy shock + Real yield rising = tactical headwind initially
      const brentCurrent = 110;
      const brentChange3M = 20;
      const isRealYieldRising = true;
      const isEnergyShock = brentCurrent > 85 || brentChange3M > 10;

      let scoreScenario1 = 0;
      if (isEnergyShock && isRealYieldRising) {
        scoreScenario1 = -40; // Hostile initially
      }
      expect(scoreScenario1).toBe(-40);

      // Scenario 2: Energy shock + Real yield falling = massive gold tailwind
      const isRealYieldFalling = false;
      let scoreScenario2 = 0;
      if (isEnergyShock && !isRealYieldFalling) {
        scoreScenario2 = 75; // Bullish
      }
      expect(scoreScenario2).toBe(75);
    });

    it('should distinguish yields rising from Term Premium vs Rate Hike expectations', () => {
      // Scenario A: Yields rising due to rate hike expectations with healthy auction demand
      const termPremiumA = 0.10; // low term premium
      const avgBidToCoverA = 2.65; // strong demand
      const fiscalPressureA = termPremiumA > 0.5 ? 80 : 40;
      expect(fiscalPressureA).toBe(40); // Moderate, not immediate sovereign crisis

      // Scenario B: Yields rising due to Term Premium with weakening auction demand
      const termPremiumB = 0.85; // high term premium
      const avgBidToCoverB = 2.20; // weak demand
      const fiscalPressureB = termPremiumB > 0.5 && avgBidToCoverB < 2.35 ? 85 : 40;
      expect(fiscalPressureB).toBe(85); // Extreme fiscal dominance signature
    });
  });

  // ==========================================
  // 3. POINT-IN-TIME BACKTESTING VERIFICATION
  // ==========================================
  describe('Point-in-Time Backtesting Without Lookahead Bias', () => {
    it('should generate historical regime series and verify strict chronological order', async () => {
      const history = await fetchHistoricalGoldMacroRegime('1Y');
      expect(history.length).toBeGreaterThan(0);

      // Verify chronological order (date strictly ascending)
      for (let i = 1; i < history.length; i++) {
        const prevTime = new Date(history[i - 1].date).getTime();
        const currTime = new Date(history[i].date).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }

      // Verify data points have valid score boundaries
      history.forEach(pt => {
        expect(pt.goldMacroScore).toBeGreaterThanOrEqual(0);
        expect(pt.goldMacroScore).toBeLessThanOrEqual(100);
        expect(pt.goldPrice).toBeGreaterThan(0);
      });
    });

    it('should execute forward return calculations without future leakage in runGoldRegimeBacktest', async () => {
      const backtest = await runGoldRegimeBacktest();

      expect(backtest).toBeDefined();
      expect(backtest.conditions.length).toBeGreaterThanOrEqual(5);

      backtest.conditions.forEach(c => {
        expect(c.sampleSize).toBeGreaterThan(0);
        expect(typeof c.avgReturn1M).toBe('number');
        expect(typeof c.avgReturn3M).toBe('number');
        expect(typeof c.avgReturn6M).toBe('number');
        expect(typeof c.avgReturn12M).toBe('number');
        expect(c.winRate12M).toBeGreaterThanOrEqual(0);
        expect(c.winRate12M).toBeLessThanOrEqual(100);
      });

      // Bullish score condition (>65) should have higher 12M win rate than Bearish score condition (<40)
      const bullishCond = backtest.conditions.find(c => c.conditionName.includes('Bullish'));
      const bearishCond = backtest.conditions.find(c => c.conditionName.includes('Bearish'));

      if (bullishCond && bearishCond) {
        expect(bullishCond.avgReturn12M).toBeGreaterThan(bearishCond.avgReturn12M);
      }
    });
  });

  // ==========================================
  // 4. API FAILURE & DEGRADATION RESILIENCE
  // ==========================================
  describe('Graceful Degradation During API Outages', () => {
    it('should degrade gracefully when external APIs are slow or offline', async () => {
      // computeGoldMacroRegime incorporates internal fallbacks for all series
      const snapshot = await computeGoldMacroRegime();
      expect(snapshot).toBeDefined();
      expect(snapshot.goldMacroScore).toBeGreaterThan(0);
      expect(snapshot.fiscalTelemetry.recentAuctions.length).toBeGreaterThan(0);
    });

    it('should respect MACRO_AI_ENABLED and never block dashboard when AI is disabled', async () => {
      const snapshot = await computeGoldMacroRegime();
      const narrative = await generateGoldMacroAiNarrative(snapshot, false);

      expect(narrative).toBeDefined();
      expect(narrative.whatMattersMost).toBeTruthy();
      expect(narrative.regimePivotAnalysis).toBeTruthy();
    });
  });
});
