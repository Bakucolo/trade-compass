import { describe, it, expect, vi } from 'vitest';
import {
  fetchImpliedExpectations,
  getVerdictStyle,
  getDifficultyBadge,
  ImpliedExpectationsAnalysis,
} from '../services/impliedExpectationsService';

describe('impliedExpectationsService (Frontend API & Helpers)', () => {
  it('returns correct styling for all verdict types', () => {
    const perfectionStyle = getVerdictStyle('PRICED_FOR_PERFECTION');
    expect(perfectionStyle.text).toContain('rose');
    expect(perfectionStyle.card).toContain('rose');

    const aggressiveStyle = getVerdictStyle('PRICED_FOR_AGGRESSIVE_GROWTH');
    expect(aggressiveStyle.text).toContain('amber');

    const consensusStyle = getVerdictStyle('PRICED_FOR_CONSENSUS');
    expect(consensusStyle.text).toContain('cyan');

    const bufferStyle = getVerdictStyle('PRICED_WITH_SAFETY_BUFFER');
    expect(bufferStyle.text).toContain('emerald');

    const distressStyle = getVerdictStyle('PRICED_FOR_DECLINE_DISTRESS');
    expect(distressStyle.text).toContain('purple');
  });

  it('returns correct badge classes for milestone difficulty ratings', () => {
    expect(getDifficultyBadge('EXTREME')).toContain('rose');
    expect(getDifficultyBadge('HIGH')).toContain('amber');
    expect(getDifficultyBadge('MODERATE')).toContain('cyan');
    expect(getDifficultyBadge('ACHIEVABLE')).toContain('emerald');
  });

  it('fetches implied expectations via fetch with symbol and optional price override', async () => {
    const mockData: Partial<ImpliedExpectationsAnalysis> = {
      symbol: 'NVDA',
      currentPrice: 120.0,
      impliedGrowth: {
        horizon3YGrowthPct: 28.5,
        horizon5YGrowthPct: 24.0,
        horizon7YGrowthPct: 19.5,
        impliedTargetMarginPct: 52.0,
        impliedTerminalMultiple: 35.0,
        impliedCapDurationYears: 5,
      },
      verdict: {
        type: 'PRICED_FOR_PERFECTION',
        badgeLabel: '🚀 Priced for Perfection',
        headline: 'Extreme Expectation Bar',
        riskScore: 88,
        sentiment: 'EUPHORIC',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await fetchImpliedExpectations('NVDA', 120.0);
    expect(global.fetch).toHaveBeenCalledWith('/api/implied-expectations/NVDA?price=120');
    expect(result.symbol).toBe('NVDA');
    expect(result.impliedGrowth.horizon5YGrowthPct).toBe(24.0);
    expect(result.verdict.type).toBe('PRICED_FOR_PERFECTION');
  });
});
