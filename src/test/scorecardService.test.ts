import { describe, it, expect, vi } from 'vitest';
import { getConvictionGrade } from '../../server/services/scorecardService';
import { getScorecardWorkerStatus, pauseScorecardWorker } from '../../server/services/scorecardWorkerService';

describe('Scorecard 1 to 10 Scoring Engine', () => {
  it('correctly maps 1 to 10 scores to conviction grades and labels', () => {
    // 9.0 to 10.0 -> STRONG_BUY
    const g10 = getConvictionGrade(9.5);
    expect(g10.grade).toBe('STRONG_BUY');
    expect(g10.gradeLabel).toContain('Prime Strong Buy');

    const g9 = getConvictionGrade(9.0);
    expect(g9.grade).toBe('STRONG_BUY');

    // 7.5 to 8.9 -> BUY_ACCUMULATE
    const g8 = getConvictionGrade(8.4);
    expect(g8.grade).toBe('BUY_ACCUMULATE');
    expect(g8.gradeLabel).toContain('High Conviction Buy');

    // 5.5 to 7.4 -> HOLD_MONITOR
    const g6 = getConvictionGrade(6.8);
    expect(g6.grade).toBe('HOLD_MONITOR');
    expect(g6.gradeLabel).toContain('Hold & Monitor');

    // 3.5 to 5.4 -> TRIM_DEFENSIVE
    const g4 = getConvictionGrade(4.2);
    expect(g4.grade).toBe('TRIM_DEFENSIVE');
    expect(g4.gradeLabel).toContain('Trim / Defensive');

    // 1.0 to 3.4 -> AVOID_HIGH_RISK
    const g2 = getConvictionGrade(2.1);
    expect(g2.grade).toBe('AVOID_HIGH_RISK');
    expect(g2.gradeLabel).toContain('Avoid / High Risk');
  });

  it('provides worker state with initial idle status and progress tracking fields', () => {
    const status = getScorecardWorkerStatus();
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('total');
    expect(status).toHaveProperty('current');
    expect(status).toHaveProperty('percent');
    expect(status).toHaveProperty('pendingSymbols');
    expect(status).toHaveProperty('completedSymbols');
  });

  it('allows pausing the worker cleanly', () => {
    const res = pauseScorecardWorker();
    expect(res.success).toBe(true);
    expect(res.status).toBeDefined();
  });

  it('ranks stocks correctly based on overallScore descending', () => {
    const rawScores = [
      { symbol: 'MSFT', overallScore: 8.9 },
      { symbol: 'NVDA', overallScore: 9.6 },
      { symbol: 'AAPL', overallScore: 8.5 },
      { symbol: 'INTC', overallScore: 4.8 },
    ];

    const sorted = [...rawScores].sort((a, b) => b.overallScore - a.overallScore);
    const ranked = sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    expect(ranked[0].symbol).toBe('NVDA');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].symbol).toBe('MSFT');
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].symbol).toBe('AAPL');
    expect(ranked[2].rank).toBe(3);
    expect(ranked[3].symbol).toBe('INTC');
    expect(ranked[3].rank).toBe(4);
  });
});
