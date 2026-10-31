import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  calculatePointToPointReturn,
  FastGraphsDataPoint,
  GraphKey,
  FastGraphsResponse
} from '../services/fastGraphsService';
import { FastGraphs } from '../components/graphs/FastGraphs';

// Mock recharts responsive container for jsdom test environment
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 800, height: 500 }} data-testid="responsive-container">
        {children}
      </div>
    ),
  };
});

const mockFastGraphsData: FastGraphsResponse = {
  symbol: 'SOFI',
  companyName: 'SoFi Technologies, Inc.',
  currentPrice: 16.40,
  priceChange: 1.94,
  priceChangePercent: 13.42,
  lastCloseDate: '2026-10-27',
  metric: 'ADJUSTED_EARNINGS',
  metricLabel: 'Adjusted (Operating) Earnings',
  timeframe: '4Y',
  series: [
    {
      date: '2022-01-28',
      displayDate: 'Jan 2022',
      fiscalYear: '2022',
      fiscalYearLabel: '01/22',
      price: 6.75,
      metricValue: 0.15,
      fairValuePrice: 4.45,
      normalPrice: 7.99,
      dividend: null,
      isEstimate: false,
      yoyGrowth: null
    },
    {
      date: '2023-01-13',
      displayDate: 'Jan 2023',
      fiscalYear: '2023',
      fiscalYearLabel: '01/23',
      price: 3.68,
      metricValue: 0.20,
      fairValuePrice: 5.93,
      normalPrice: 10.66,
      dividend: null,
      isEstimate: false,
      yoyGrowth: 33.3
    },
    {
      date: '2024-03-29',
      displayDate: 'Mar 2024',
      fiscalYear: '2024',
      fiscalYearLabel: '03/24',
      price: 11.93,
      metricValue: 0.24,
      fairValuePrice: 7.12,
      normalPrice: 12.79,
      dividend: null,
      isEstimate: false,
      yoyGrowth: 20.0
    },
    {
      date: '2025-12-31',
      displayDate: 'Dec 2025',
      fiscalYear: '2025',
      fiscalYearLabel: '12/25',
      price: 16.40,
      metricValue: 0.39,
      fairValuePrice: 11.57,
      normalPrice: 20.79,
      dividend: null,
      isEstimate: false,
      isCurrentYearBoundary: true,
      yoyGrowth: 62.5
    },
    {
      date: '2026-12-31',
      displayDate: 'Dec 2026',
      fiscalYear: '2026',
      fiscalYearLabel: '12/26E',
      price: null,
      metricValue: 0.60,
      fairValuePrice: 17.80,
      normalPrice: 31.98,
      dividend: null,
      isEstimate: true,
      yoyGrowth: 53.8
    },
    {
      date: '2027-12-31',
      displayDate: 'Dec 2027',
      fiscalYear: '2027',
      fiscalYearLabel: '12/27E',
      price: null,
      metricValue: 0.87,
      fairValuePrice: 25.81,
      normalPrice: 46.37,
      dividend: null,
      isEstimate: true,
      yoyGrowth: 45.0
    },
    {
      date: '2028-12-31',
      displayDate: 'Dec 2028',
      fiscalYear: '2028',
      fiscalYearLabel: '12/28E',
      price: null,
      metricValue: 1.10,
      fairValuePrice: 32.64,
      normalPrice: 58.64,
      dividend: null,
      isEstimate: true,
      yoyGrowth: 26.4
    }
  ],
  bottomStrip: [
    { fyDate: '12/24', metricValue: '0.39', chgYr: '+62%', chgYrNum: 62, div: '--', isEstimate: false, date: '2024-12-31' },
    { fyDate: '12/25', metricValue: '0.39', chgYr: '0%', chgYrNum: 0, div: '--', isEstimate: false, date: '2025-12-31' },
    { fyDate: '12/26E', metricValue: '0.60E', chgYr: '+54%', chgYrNum: 54, div: '--', isEstimate: true, date: '2026-12-31' },
    { fyDate: '12/27E', metricValue: '0.87E', chgYr: '+45%', chgYrNum: 45, div: '--', isEstimate: true, date: '2027-12-31' },
    { fyDate: '12/28E', metricValue: '1.10E', chgYr: '+26%', chgYrNum: 26, div: '--', isEstimate: true, date: '2028-12-31' }
  ],
  fastFacts: {
    previousClose: 16.40,
    blendedPe: 29.08,
    epsYield: 3.44,
    divYield: 0.00,
    type: 'SHARE',
    lttmDividend: 0
  },
  graphKey: {
    metricName: 'Adjusted (Operating) Earnings',
    growthRate: 29.67,
    fairValueRatio: 29.67,
    fairValueFormula: 'P/E = G (Peter Lynch)',
    normalPeRatio: 53.31
  },
  dividendTrends: {
    hasDividends: false,
    dividendCagr: null,
    avgDivGrowth: null,
    normalYield: null,
    consecutiveIncreases: 0,
    consecutivePaid: 0
  },
  companyInfo: {
    companyName: 'SoFi Technologies, Inc.',
    ticker: 'SOFI:US',
    gicsSubIndustry: 'Consumer Finance',
    country: 'United States',
    marketCap: 21180000000,
    marketCapFormatted: '$21.18B',
    spCreditRating: 'BBB-',
    ltDebtToCapital: 15.05,
    tev: 22130000000,
    tevFormatted: '$22.13B',
    fgScore: 57
  },
  analystScorecard: {
    oneYearForward: { beatPct: 50.0, hitPct: 0.0, missPct: 50.0 },
    twoYearForward: { beatPct: 66.7, hitPct: 0.0, missPct: 33.3 }
  }
};

describe('FAST Graphs Fundamental Valuation Visualizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockFastGraphsData
    });
  });

  describe('1. Point-to-Point Rate of Return & Fundamental CAGR Calculation', () => {
    it('calculates invested capital, shares, total return, and EPS CAGR correctly between two dates', () => {
      const startPt: FastGraphsDataPoint = {
        date: '2022-01-28',
        displayDate: 'Jan 28, 2022',
        fiscalYear: '2022',
        fiscalYearLabel: '01/22',
        price: 6.75,
        metricValue: 0.015,
        fairValuePrice: 1.48,
        normalPrice: 0.44,
        dividend: null,
        isEstimate: false,
        yoyGrowth: null
      };

      const endPt: FastGraphsDataPoint = {
        date: '2023-01-13',
        displayDate: 'Jan 13, 2023',
        fiscalYear: '2023',
        fiscalYearLabel: '01/23',
        price: 3.68,
        metricValue: 0.24,
        fairValuePrice: 23.76,
        normalPrice: 7.12,
        dividend: null,
        isEstimate: false,
        yoyGrowth: 1500
      };

      const key: GraphKey = {
        metricName: 'Adjusted (Operating) Earnings',
        growthRate: 131.58,
        fairValueRatio: 99.00,
        fairValueFormula: 'P/E = G (Peter Lynch)',
        normalPeRatio: 29.68
      };

      const res = calculatePointToPointReturn(startPt, endPt, key, 10000.0);

      // Verify shares purchased: $10,000 / $6.75 = 1481.48
      expect(res.shares).toBeCloseTo(1481.48, 1);
      // Verify market value: 1481.48 * $3.68 = $5,451.85
      expect(res.marketValue).toBeCloseTo(5451.85, 0);
      // Verify negative total return (-45.48%)
      expect(res.totalReturnPct).toBeLessThan(0);
      expect(res.totalReturnPct).toBeCloseTo(-45.48, 1);
      // Verify metric (EPS) CAGR is positive and high
      expect(res.metricCagrPct).toBeGreaterThan(100);
      // Verify Fair value and Normal PE multiples at end date
      expect(res.fairValueMultiple).toBe(99.00);
      expect(res.normalPeMultiple).toBe(29.68);
    });
  });

  describe('2. FastGraphs UI Component Rendering & Controls', () => {
    it('renders ticker summary header with company name, price, day change, Blended PE, and Market Cap', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <FastGraphs symbol="SOFI" />
        </QueryClientProvider>
      );

      // Verify header elements
      await waitFor(() => {
        expect(screen.getByText(/SoFi Technologies, Inc./i)).toBeDefined();
        expect(screen.getAllByText(/USD 16.40/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Blended P\/E/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/29.08x/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/\$21.18B/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/57\/100/i)).toBeDefined();
      });
    });

    it('renders "Price Correlated with:" selector and timeframe toggle buttons (MAX to 1Y)', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <FastGraphs symbol="SOFI" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Price Correlated with:/i)).toBeDefined();
        expect(screen.getByDisplayValue(/Adjusted \(Operating\) Earnings/i)).toBeDefined();
        // Timeframe buttons
        expect(screen.getByRole('button', { name: 'MAX' })).toBeDefined();
        expect(screen.getByRole('button', { name: '6Y' })).toBeDefined();
        expect(screen.getByRole('button', { name: '5Y' })).toBeDefined();
        expect(screen.getByRole('button', { name: '4Y' })).toBeDefined();
        expect(screen.getByRole('button', { name: '3Y' })).toBeDefined();
        expect(screen.getByRole('button', { name: '2Y' })).toBeDefined();
        expect(screen.getByRole('button', { name: '1Y' })).toBeDefined();
      });

      // Click timeframe button 5Y
      const btn5Y = screen.getByRole('button', { name: '5Y' });
      fireEvent.click(btn5Y);
      await waitFor(() => {
        const updatedBtn = screen.getByRole('button', { name: '5Y' });
        expect(updatedBtn.className).toContain('bg-amber-500');
      });
    });

    it('renders sidebar panels: FAST Facts, Graph Key, Company Info, and Analyst Scorecard', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <FastGraphs symbol="SOFI" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        // FAST Facts
        expect(screen.getByText('FAST Facts')).toBeDefined();
        expect(screen.getByText(/EPS Yld:/i)).toBeDefined();
        expect(screen.getByText(/3.44%/i)).toBeDefined();

        // Graph Key
        expect(screen.getByText('Graph Key')).toBeDefined();
        expect(screen.getAllByText(/Fair Value Ratio/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/29.67x/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Normal P\/E/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/53.31x/i).length).toBeGreaterThan(0);

        // Company Info
        expect(screen.getByText('Company Info')).toBeDefined();
        expect(screen.getByText('Consumer Finance')).toBeDefined();
        expect(screen.getByText('United States')).toBeDefined();
        expect(screen.getByText('BBB-')).toBeDefined();
        expect(screen.getByText('15.05%')).toBeDefined();

        // Analyst Scorecard
        expect(screen.getByText('Analyst Scorecard')).toBeDefined();
        expect(screen.getByText('1Y Forward')).toBeDefined();
        expect(screen.getByText('2Y Forward')).toBeDefined();
        expect(screen.getAllByText(/Beat:/i).length).toBeGreaterThan(0);
      });
    });

    it('renders bottom data alignment matrix with FY Date, Metric per share, YoY growth, and Div', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <FastGraphs symbol="SOFI" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Metric Strip')).toBeDefined();
        expect(screen.getByText('FY Date')).toBeDefined();
        expect(screen.getByText('EPS / Metric')).toBeDefined();
        expect(screen.getByText('Chg/Yr')).toBeDefined();
        expect(screen.getByText('Div')).toBeDefined();
        expect(screen.getAllByText(/12\/26E/i).length).toBeGreaterThan(0);
        expect(screen.getByText('0.60E')).toBeDefined();
      });
    });

    it('activates Rate of Return tool and displays interactive calculation pop-up', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <FastGraphs symbol="SOFI" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Rate of Return Tool/i)).toBeDefined();
      });

      // Toggle Rate of Return tool
      fireEvent.click(screen.getByText(/Rate of Return Tool/i));

      // Pop-up calculation card should be rendered
      await waitFor(() => {
        expect(screen.getByText(/Rate Of Return & CAGR/i)).toBeDefined();
        expect(screen.getByText(/Market Value:/i)).toBeDefined();
        expect(screen.getByText(/Total Return:/i)).toBeDefined();
        expect(screen.getByText(/Annualized CAGR:/i)).toBeDefined();
      });
    });

    it('renders Full Page button and triggers onToggleFullPage when clicked', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const mockToggle = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <FastGraphs symbol="SOFI" onToggleFullPage={mockToggle} isFullPage={false} />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /full page/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /full page/i }));
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it('renders ticker searchbox in header and triggers onSelectSymbol on submit or selection', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const mockSelectSymbol = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <FastGraphs symbol="SOFI" onSelectSymbol={mockSelectSymbol} />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('fast-graphs-ticker-search')).toBeDefined();
      });

      const searchInput = screen.getByTestId('fast-graphs-ticker-search');

      // Focus input to open dropdown
      fireEvent.focus(searchInput);
      expect(screen.getByTestId('fast-graphs-search-dropdown')).toBeDefined();
      expect(screen.getByText('Popular Benchmarks')).toBeDefined();

      // Type NVDA and submit
      fireEvent.change(searchInput, { target: { value: 'NVDA' } });
      fireEvent.submit(searchInput.closest('form')!);

      expect(mockSelectSymbol).toHaveBeenCalledWith('NVDA');
    });
  });
});
