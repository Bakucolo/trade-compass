import { describe, it, expect, vi } from 'vitest';
import { proposeTradeEntryLevels, TradeEntryProposal } from '../../server/services/tradeEntryAgentService';

describe('Trade Entry Agent Service', () => {
  it('should generate structured entry levels with asymmetrical R:R ratio for a LONG trade', async () => {
    const proposal = await proposeTradeEntryLevels({
      symbol: 'AAPL',
      action: 'BUY',
      timeframe: 'DAY',
      currentPrice: 225.50,
      notes: 'Dip buying after earnings consolidation',
    });

    expect(proposal).toBeDefined();
    expect(proposal.symbol).toBe('AAPL');
    expect(proposal.action).toBe('BUY');
    expect(proposal.currentPrice).toBeGreaterThan(0);
    expect(proposal.primaryEntryPrice).toBeGreaterThan(0);
    expect(proposal.conservativeEntryPrice).toBeGreaterThan(0);
    expect(proposal.aggressiveEntryPrice).toBeGreaterThan(0);
    expect(proposal.stopLoss).toBeGreaterThan(0);
    expect(proposal.targetExit).toBeGreaterThan(0);

    // For a BUY order: Stop Loss must be BELOW primary entry, and Target Exit must be ABOVE primary entry
    expect(proposal.stopLoss).toBeLessThan(proposal.primaryEntryPrice);
    expect(proposal.targetExit).toBeGreaterThan(proposal.primaryEntryPrice);

    // Reward to risk ratio should be calculated
    expect(proposal.rewardToRiskRatio).toBeGreaterThan(0);
    expect(proposal.setupQuality).toMatch(/PRIME|GOOD|CHOPPY|HIGH_RISK/);
    expect(proposal.tacticalRationale).toBeTruthy();
    expect(proposal.invalidationCondition).toBeTruthy();
    expect(Array.isArray(proposal.keySupportLevels)).toBe(true);
    expect(Array.isArray(proposal.keyResistanceLevels)).toBe(true);
  }, 25000);

  it('should generate inverted levels for a SHORT trade', async () => {
    const proposal = await proposeTradeEntryLevels({
      symbol: 'TSLA',
      action: 'SHORT',
      timeframe: 'WEEK',
      currentPrice: 210.00,
      notes: 'Testing major overhead resistance',
    });

    expect(proposal).toBeDefined();
    expect(proposal.symbol).toBe('TSLA');
    expect(proposal.action).toBe('SHORT');

    // For a SHORT order: Stop Loss must be ABOVE primary entry, and Target Exit must be BELOW primary entry
    expect(proposal.stopLoss).toBeGreaterThan(proposal.primaryEntryPrice);
    expect(proposal.targetExit).toBeLessThan(proposal.primaryEntryPrice);
    expect(proposal.rewardToRiskRatio).toBeGreaterThan(0);
  }, 25000);
});
