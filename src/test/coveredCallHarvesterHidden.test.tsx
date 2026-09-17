import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoveredCallsAnalyser } from '../components/management/CoveredCallsAnalyser';

// Mock coveredCallService
vi.mock('@/services/coveredCallService', () => ({
  useCoveredCallsAnalysis: vi.fn(() => ({
    data: {
      scanTimestamp: new Date().toISOString(),
      totalPortfolioNetDelta: 300,
      totalEligiblePositionsCount: 2,
      uncoveredPositionsCount: 2,
      partiallyCoveredCount: 0,
      fullyCoveredCount: 0,
      activePositionsCount: 0,
      totalActiveCallsCount: 0,
      totalUncoveredCallCapacity: 3,
      potentialMonthlyIncomeEstimate: 1200,
      potentialAnnualizedYieldEstimate: 24,
      candidates: [
        {
          symbol: 'AAPL',
          companyName: 'Apple Inc.',
          assetType: 'EQUITY',
          currentPrice: 180,
          totalMarketValue: 36000,
          shareCount: 200,
          totalCapacity: 2,
          coveredCallCapacity: 2,
          coveredSharesCount: 0,
          uncoveredSharesCount: 200,
          hasActiveCalls: false,
          longCallsCount: 0,
          shortCallsCount: 0,
          netPositionDelta: 200,
          unhedgedDelta: 200,
          coverageStatus: 'UNCOVERED_OPPORTUNITY',
          activeCoveredCalls: [],
          proposedCalls: {
            conservative: {
              tier: 'CONSERVATIVE',
              tierName: 'Conservative',
              targetDelta: 0.18,
              strike: 195,
              expiration: '2026-10-16',
              dte: 32,
              estimatedBid: 1.8,
              estimatedAsk: 2.0,
              estimatedMid: 1.9,
              premiumPerContract: 190,
              totalPotentialIncome: 380,
              annualizedYieldPercent: 12,
              otmBufferPercent: 8.3,
              probabilityOfProfitPercent: 82,
              breakEvenPrice: 196.9,
              impliedVolatility: 0.25,
              isRealQuote: false,
            },
            balanced: {
              tier: 'BALANCED',
              tierName: 'Balanced',
              targetDelta: 0.28,
              strike: 190,
              expiration: '2026-10-16',
              dte: 32,
              estimatedBid: 3.8,
              estimatedAsk: 4.2,
              estimatedMid: 4.0,
              premiumPerContract: 400,
              totalPotentialIncome: 800,
              annualizedYieldPercent: 25,
              otmBufferPercent: 5.5,
              probabilityOfProfitPercent: 72,
              breakEvenPrice: 194.0,
              impliedVolatility: 0.25,
              isRealQuote: false,
            },
            aggressive: {
              tier: 'AGGRESSIVE',
              tierName: 'Aggressive',
              targetDelta: 0.4,
              strike: 185,
              expiration: '2026-10-16',
              dte: 32,
              estimatedBid: 6.0,
              estimatedAsk: 6.5,
              estimatedMid: 6.25,
              premiumPerContract: 625,
              totalPotentialIncome: 1250,
              annualizedYieldPercent: 39,
              otmBufferPercent: 2.7,
              probabilityOfProfitPercent: 60,
              breakEvenPrice: 191.25,
              impliedVolatility: 0.25,
              isRealQuote: false,
            },
          },
          impliedVolatility: 24.0,
          ivRank: 32,
          ivPercentile: 38,
          isOptimalToSellCalls: false,
          callSellingEnvironment: 'FAIR',
          optimalSellingVerdict: 'Moderate IV: Steady baseline option pricing',
          nextEarningsDate: 'Oct 24, 2026',
          daysUntilEarnings: 40,
          earningsBeforeExpiration: false,
          brokers: ['Tastytrade'],
        },
        {
          symbol: 'TSLA',
          companyName: 'Tesla Inc.',
          assetType: 'EQUITY',
          currentPrice: 250,
          totalMarketValue: 25000,
          shareCount: 100,
          totalCapacity: 1,
          coveredCallCapacity: 1,
          coveredSharesCount: 0,
          uncoveredSharesCount: 100,
          hasActiveCalls: false,
          longCallsCount: 0,
          shortCallsCount: 0,
          netPositionDelta: 100,
          unhedgedDelta: 100,
          coverageStatus: 'UNCOVERED_OPPORTUNITY',
          activeCoveredCalls: [],
          proposedCalls: {
            balanced: {
              tier: 'BALANCED',
              tierName: 'Balanced',
              targetDelta: 0.28,
              strike: 270,
              expiration: '2026-10-16',
              dte: 32,
              estimatedBid: 4.0,
              estimatedAsk: 4.5,
              estimatedMid: 4.25,
              premiumPerContract: 425,
              totalPotentialIncome: 425,
              annualizedYieldPercent: 22,
              otmBufferPercent: 8.0,
              probabilityOfProfitPercent: 72,
              breakEvenPrice: 274.25,
              impliedVolatility: 0.45,
              isRealQuote: false,
            },
          },
          impliedVolatility: 58.0,
          ivRank: 78,
          ivPercentile: 84,
          isOptimalToSellCalls: true,
          callSellingEnvironment: 'OPTIMAL',
          optimalSellingVerdict: 'Optimal Call Selling: Elevated IV Rank provides rich option premiums',
          nextEarningsDate: 'Oct 02, 2026',
          daysUntilEarnings: 18,
          earningsBeforeExpiration: true,
          brokers: ['Tastytrade'],
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  })),
  useDetailedOptionChain: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CoveredCallsAnalyser - Hide Stocks Feature', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders candidates with "Don\'t Sell Calls" hide button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CoveredCallsAnalyser />
      </QueryClientProvider>
    );

    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TSLA').length).toBeGreaterThan(0);

    const hideButtons = screen.getAllByRole('button', { name: /don't sell calls/i });
    expect(hideButtons.length).toBe(2);
  });

  it('hides a stock when "Don\'t Sell Calls" is clicked, updates localStorage, and reveals Hidden tab', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CoveredCallsAnalyser />
      </QueryClientProvider>
    );

    // Initial state: 2 uncovered opportunities
    expect(screen.getByRole('button', { name: /uncovered opportunities \(2\)/i })).toBeDefined();

    // Click "Don't Sell Calls" for AAPL
    const aaplHideBtn = screen.getAllByTitle(/temporarily hide aapl/i)[0];
    fireEvent.click(aaplHideBtn);

    // AAPL should now be excluded from the active list
    expect(screen.queryByText(/200 Shares/i)).toBeNull();
    // TSLA should still be visible
    expect(screen.getAllByText('TSLA').length).toBeGreaterThan(0);

    // LocalStorage should now record AAPL
    const stored = JSON.parse(localStorage.getItem('coveredCalls_hidden_symbols') || '[]');
    expect(stored).toContain('AAPL');

    // Uncovered Opportunities count drops to 1
    expect(screen.getByRole('button', { name: /uncovered opportunities \(1\)/i })).toBeDefined();

    // "Hidden (1)" tab should now appear
    const hiddenTab = screen.getByRole('button', { name: /hidden \(1\)/i });
    expect(hiddenTab).toBeDefined();

    // Click "Hidden (1)" tab
    fireEvent.click(hiddenTab);

    // AAPL should appear in Hidden tab with "Unhide Stock" button and "Call Selling Paused" badge
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/call selling paused/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('TSLA')).toBeNull();

    const unhideBtn = screen.getByRole('button', { name: /unhide stock/i });
    expect(unhideBtn).toBeDefined();

    // Click "Unhide Stock"
    fireEvent.click(unhideBtn);

    // LocalStorage should now be empty of AAPL
    const storedAfter = JSON.parse(localStorage.getItem('coveredCalls_hidden_symbols') || '[]');
    expect(storedAfter).not.toContain('AAPL');
  });

  it('restores all hidden stocks with "Restore All" button', () => {
    // Pre-populate localStorage with AAPL and TSLA hidden
    localStorage.setItem('coveredCalls_hidden_symbols', JSON.stringify(['AAPL', 'TSLA']));

    render(
      <QueryClientProvider client={queryClient}>
        <CoveredCallsAnalyser />
      </QueryClientProvider>
    );

    // In Uncovered Opportunities tab, both are hidden
    expect(screen.getByRole('button', { name: /uncovered opportunities \(0\)/i })).toBeDefined();
    const hiddenTab = screen.getByRole('button', { name: /hidden \(2\)/i });
    expect(hiddenTab).toBeDefined();

    // Switch to Hidden tab
    fireEvent.click(hiddenTab);

    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TSLA').length).toBeGreaterThan(0);

    // Click "Restore All"
    const restoreAllBtn = screen.getByRole('button', { name: /restore all \(2\)/i });
    fireEvent.click(restoreAllBtn);

    // LocalStorage should be cleared
    const stored = JSON.parse(localStorage.getItem('coveredCalls_hidden_symbols') || '[]');
    expect(stored).toHaveLength(0);

    // Empty state should be shown in Hidden tab
    expect(screen.getByText(/no hidden stocks/i)).toBeDefined();
  });

  it('displays IV, IVR, IVP, optimal call selling verdict, and next earnings date', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CoveredCallsAnalyser />
      </QueryClientProvider>
    );

    // IV telemetry for AAPL (IV: 24%, IVR: 32%, IVP: 38%)
    expect(screen.getByText('24%')).toBeDefined();
    expect(screen.getByText('32%')).toBeDefined();
    expect(screen.getByText('38%')).toBeDefined();
    expect(screen.getByText(/Oct 24, 2026/i)).toBeDefined();
    expect(screen.getByText(/Safe: Post-Exp \(40d\)/i)).toBeDefined();

    // IV telemetry for TSLA (IV: 58%, IVR: 78%, IVP: 84%)
    expect(screen.getByText('58%')).toBeDefined();
    expect(screen.getByText('78%')).toBeDefined();
    expect(screen.getByText('84%')).toBeDefined();
    expect(screen.getByText(/Oct 02, 2026/i)).toBeDefined();
    expect(screen.getByText(/Optimal to Sell Calls/i)).toBeDefined();
    expect(screen.getByText(/Earnings Inside Cycle/i)).toBeDefined();
  });

  it('filters candidates by Optimal IV Only (IVR >= 50%) when toggled', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CoveredCallsAnalyser />
      </QueryClientProvider>
    );

    // Initially both AAPL and TSLA are visible
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TSLA').length).toBeGreaterThan(0);

    // Toggle "Optimal IV Only (IVR >= 50%)"
    const optimalFilterBtn = screen.getByRole('button', { name: /optimal iv \(ivr \u2265 50%\)/i });
    fireEvent.click(optimalFilterBtn);

    // TSLA (IVR: 78%) should remain visible
    expect(screen.getAllByText('TSLA').length).toBeGreaterThan(0);
    // AAPL (IVR: 32%) should be filtered out
    expect(screen.queryByText('AAPL')).toBeNull();

    // Toggle off
    fireEvent.click(optimalFilterBtn);
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
  });
});
