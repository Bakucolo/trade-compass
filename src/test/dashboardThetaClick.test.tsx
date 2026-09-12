import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutiveStatsRibbon } from '../components/dashboard/ExecutiveStatsRibbon';

describe('ExecutiveStatsRibbon - Theta Click Interaction', () => {
  it('calls onOpenThetaBreakdown when the Theta card is clicked', () => {
    const onOpenThetaBreakdown = vi.fn();
    render(
      <ExecutiveStatsRibbon
        balancesData={{
          total: {
            netLiquidatingValue: 150000,
            dayPnL: 1200,
            buyingPower: 75000,
            unrealizedPnL: 5000,
          },
        } as any}
        positions={[
          {
            symbol: 'AAPL  260918C00220000',
            quantity: -1,
            assetType: 'Option',
            theta: -0.12,
          },
        ]}
        isPrivacyMode={false}
        onTogglePrivacy={vi.fn()}
        onOpenThetaBreakdown={onOpenThetaBreakdown}
      />
    );

    const thetaCard = screen.getByTitle('Click to view which positions provide this Theta');
    expect(thetaCard).toBeDefined();

    fireEvent.click(thetaCard);
    expect(onOpenThetaBreakdown).toHaveBeenCalledTimes(1);
  });
});
