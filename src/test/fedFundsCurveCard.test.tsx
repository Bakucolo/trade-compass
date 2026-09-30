import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FedFundsCurveCard } from '../components/macro/FedFundsCurveCard';
import * as macroService from '../services/macroService';

const mockCurveData: macroService.FedFundsCurveResponse = {
  timestamp: new Date().toISOString(),
  continuousZq: {
    symbol: 'ZQ=F',
    price: 95.94,
    change: 0.005,
    changePercent: 0.01,
    impliedRate: 4.06,
  },
  summary: {
    currentEffr: 4.83,
    frontMonthRate: 3.75,
    frontMonthLabel: "Sep '26",
    troughRate: 3.75,
    troughExpiry: "September 2026",
    peakRate: 4.84,
    peakExpiry: "October 2027",
    curveSpread18M: 107.2,
    totalCutsCurrentYearBps: -63.0,
    totalCutsCurrentYearCount: -2.52,
    totalCutsNextYearBps: -105.0,
    totalCutsNextYearCount: -4.20,
    nextFomc: {
      date: '2026-11-05',
      label: 'Nov 4-5, 2026',
      daysUntil: 42,
      impliedMoveBps: -18.5,
      probabilities: {
        cut50: 0,
        cut25: 74,
        pause: 26,
        hike25: 0,
      },
    },
    policyStance: 'MEASURED_EASING',
    policyHeadline: 'Measured Easing: 2.52 Cuts Priced by Year-End 2026',
    policyNarrative: 'Futures curve indicates an orderly recalibration cycle with terminal rate expected at 3.75% in September 2026.',
  },
  contracts: [
    {
      symbol: 'ZQU26.CBT',
      cleanSymbol: 'ZQU26',
      tradingViewSymbol: 'CBOT:ZQU26',
      monthCode: 'U',
      monthName: 'Sep',
      monthNumber: 9,
      year: 2026,
      expiryLabel: "Sep '26",
      fullMonthYear: 'September 2026',
      daysInMonth: 30,
      price: 96.2525,
      prevClose: 96.255,
      priceChange: -0.0025,
      impliedRate: 3.748,
      impliedRateChangeBps: 0.3,
      marginalBps: -108.2,
      marginalCuts: -4.33,
      cumulativeBpsFromSpot: -108.2,
      cumulativeCutsFromSpot: -4.33,
      cumulativeBpsFromFront: 0,
      cumulativeCutsFromFront: 0,
      hasFomc: true,
      fomcMeeting: {
        date: '2026-09-16',
        label: 'Sep 15-16, 2026',
        dayOfMonth: 16,
        year: 2026,
        month: 9,
      },
      fomcImpliedStepBps: -25.0,
      fomcProbabilities: { cut50: 0, cut25: 100, pause: 0, hike25: 0 },
    },
    {
      symbol: 'ZQV26.CBT',
      cleanSymbol: 'ZQV26',
      tradingViewSymbol: 'CBOT:ZQV26',
      monthCode: 'V',
      monthName: 'Oct',
      monthNumber: 10,
      year: 2026,
      expiryLabel: "Oct '26",
      fullMonthYear: 'October 2026',
      daysInMonth: 31,
      price: 96.105,
      prevClose: 96.105,
      priceChange: 0,
      impliedRate: 3.895,
      impliedRateChangeBps: 0,
      marginalBps: 14.7,
      marginalCuts: 0.59,
      cumulativeBpsFromSpot: -93.5,
      cumulativeCutsFromSpot: -3.74,
      cumulativeBpsFromFront: 14.7,
      cumulativeCutsFromFront: 0.59,
      hasFomc: false,
    },
    {
      symbol: 'ZQX26.CBT',
      cleanSymbol: 'ZQX26',
      tradingViewSymbol: 'CBOT:ZQX26',
      monthCode: 'X',
      monthName: 'Nov',
      monthNumber: 11,
      year: 2026,
      expiryLabel: "Nov '26",
      fullMonthYear: 'November 2026',
      daysInMonth: 30,
      price: 95.94,
      prevClose: 95.945,
      priceChange: -0.005,
      impliedRate: 4.06,
      impliedRateChangeBps: 0.5,
      marginalBps: 16.5,
      marginalCuts: 0.66,
      cumulativeBpsFromSpot: -77.0,
      cumulativeCutsFromSpot: -3.08,
      cumulativeBpsFromFront: 31.2,
      cumulativeCutsFromFront: 1.25,
      hasFomc: true,
      fomcMeeting: {
        date: '2026-11-05',
        label: 'Nov 4-5, 2026',
        dayOfMonth: 5,
        year: 2026,
        month: 11,
      },
      fomcImpliedStepBps: -18.5,
      fomcProbabilities: { cut50: 0, cut25: 74, pause: 26, hike25: 0 },
    },
  ],
};

describe('FedFundsCurveCard Component', () => {
  it('renders the header barometers, policy narrative and display toggles', () => {
    vi.spyOn(macroService, 'useFedFundsCurve').mockReturnValue({
      data: mockCurveData,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <FedFundsCurveCard />
      </QueryClientProvider>
    );

    // Title and badges
    expect(screen.getAllByText(/Fed Funds Futures/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ZQ!/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/CBOT 30-Day Fed Funds/i)).toBeDefined();

    // Barometers
    expect(screen.getByText('4.83%')).toBeDefined(); // Spot EFFR
    expect(screen.getByText(/2026 Year-End/i)).toBeDefined();
    expect(screen.getByText(/2027 Year-End/i)).toBeDefined();
    expect(screen.getByText(/Cycle Trough/i)).toBeDefined();

    // Toggles exist
    expect(screen.getByRole('button', { name: /Implied Rate Curve/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Cumulative Bps/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Marginal Bps/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Contract Expiry Matrix/i })).toBeDefined();
  });

  it('switches to Contract Expiry Matrix table view and displays contracts with basis points', () => {
    vi.spyOn(macroService, 'useFedFundsCurve').mockReturnValue({
      data: mockCurveData,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <FedFundsCurveCard />
      </QueryClientProvider>
    );

    // Click on Contract Expiry Matrix tab
    const matrixBtn = screen.getByRole('button', { name: /Contract Expiry Matrix/i });
    fireEvent.click(matrixBtn);

    // Check table headers and contract data
    expect(screen.getByText('Expiry Month')).toBeDefined();
    expect(screen.getByText('Futures Price')).toBeDefined();
    expect(screen.getByText('ZQU26')).toBeDefined();
    expect(screen.getByText('ZQV26')).toBeDefined();
    expect(screen.getByText('ZQX26')).toBeDefined();

    // Check rate and cuts display
    expect(screen.getAllByText('3.748%').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-108.2/i).length).toBeGreaterThan(0);
    expect(screen.getByText('-4.33 cuts')).toBeDefined();
  });

  it('displays Upcoming FOMC Decision Pricing Matrix with color-coded hike, pause, and cut percentages', () => {
    vi.spyOn(macroService, 'useFedFundsCurve').mockReturnValue({
      data: mockCurveData,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <FedFundsCurveCard />
      </QueryClientProvider>
    );

    // Header of matrix
    expect(screen.getByText('Upcoming FOMC Decision Pricing Matrix')).toBeDefined();

    // Check hike percent displayed
    expect(screen.getAllByText(/\+25bp Hike/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-25bp Cut/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pause/i).length).toBeGreaterThan(0);
  });
});
