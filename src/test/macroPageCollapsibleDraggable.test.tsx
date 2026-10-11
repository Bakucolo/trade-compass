import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MacroPage } from '../components/MacroPage';

// Mock child components that make network calls or render complex recharts
vi.mock('../components/macro/TrendFinderCard', () => ({
  TrendFinderCard: () => <div data-testid="trend-finder-content">Trend Finder Content</div>,
}));

vi.mock('../components/macro/VolatilityMacroCard', () => ({
  VolatilityMacroCard: () => <div data-testid="volatility-content">Volatility Content</div>,
}));

vi.mock('../components/macro/EconomicCycleCard', () => ({
  EconomicCycleCard: () => <div data-testid="economic-cycle-content">Economic Cycle Content</div>,
}));

vi.mock('../components/macro/FedFundsCurveCard', () => ({
  FedFundsCurveCard: () => <div data-testid="fed-funds-curve-content">Fed Funds Curve Content</div>,
}));

vi.mock('../components/macro/YieldsBondsChartCard', () => ({
  YieldsBondsChartCard: () => <div data-testid="yields-bonds-content">Yields Bonds Content</div>,
}));

vi.mock('../components/macro/SectorsAndIndustriesCard', () => ({
  SectorsAndIndustriesCard: () => <div data-testid="sectors-industries-content">Sectors Industries Content</div>,
}));

vi.mock('../components/macro/MacroDossierModal', () => ({
  MacroDossierModal: () => null,
}));

vi.mock('../components/macro/GoldMacroRegimeDashboard', () => ({
  GoldMacroRegimeDashboard: () => <div data-testid="gold-macro-regime-content">Gold Macro Regime Content</div>,
}));

vi.mock('../components/graphs/TradingViewChart', () => ({
  TradingViewChart: () => <div data-testid="tradingview-chart">TradingView Chart</div>,
}));

vi.mock('../components/macro/CommoditiesForwardCurveCard', () => ({
  CommoditiesForwardCurveCard: () => <div data-testid="commodities-content">Commodities Content</div>,
}));

// Mock macro overview hook
vi.mock('@/services/macroService', () => ({
  useMacroOverview: () => ({
    data: {
      regime: {
        tone: 'bullish',
        title: 'Goldilocks Posture',
        description: 'Macro volatility is within normal ranges.',
        vix: 15.42,
        us10y: 4.38,
        oil: 71.40,
        dxy: 100.26,
      },
      categorized: {
        all: [],
        economic: [{ symbol: 'FEDFUNDS', price: 4.83, name: 'Fed Funds Rate' }],
      },
      yieldCurve: [
        { term: '2Y', yield: 4.02, label: '2 Year Treasury' },
        { term: '10Y', yield: 4.38, label: '10 Year Treasury' },
      ],
      spread2y10y: 0.36,
      isCurveInverted: false,
    },
    isLoading: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

vi.mock('@/services/macroDossierService', () => ({
  useMacroDossiers: () => ({ data: [] }),
  isDossierFromToday: () => false,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('MacroPage Collapsible & Draggable Sections', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all 9 sections collapsed by default', () => {
    renderWithClient(<MacroPage />);

    // Check header control bar
    expect(screen.getByText('Macro Dashboard Sections')).toBeDefined();
    expect(screen.getByText('0 of 10 Open')).toBeDefined();
    expect(screen.getByText('Expand All')).toBeDefined();

    // Check all 10 section titles are rendered in the list
    expect(screen.getByText('Commodities Pricing, Forward Curves & Term Structures')).toBeDefined();
    expect(screen.getByText('Gold Macro Regime & Sovereign Debt Stress Station')).toBeDefined();
    expect(screen.getByText('Macro Trend Finder & Lifecycle Scanner')).toBeDefined();
    expect(screen.getByText('Volatility Term Structure, Dispersion & Signals')).toBeDefined();
    expect(screen.getByText('Economic Cycle Stage & Macro Regime Station')).toBeDefined();
    expect(screen.getByText('Fed Funds Futures (ZQ!) Policy Curve & Rate Hike/Cut Barometer')).toBeDefined();
    expect(screen.getByText('Sovereign Yields & Bond Market Chart Station')).toBeDefined();
    expect(screen.getByText('Sectors & Industry Performance & Rotation Analyzer')).toBeDefined();
    expect(screen.getByText('US Sovereign Yield Curve Structure & Credit Spreads')).toBeDefined();
    expect(screen.getByText('Global Macro & FRED Asset Catalog')).toBeDefined();

    // Content should NOT be rendered when collapsed
    expect(screen.queryByTestId('commodities-content')).toBeNull();
    expect(screen.queryByTestId('gold-macro-regime-content')).toBeNull();
    expect(screen.queryByTestId('fed-funds-curve-content')).toBeNull();
    expect(screen.queryByTestId('trend-finder-content')).toBeNull();
    expect(screen.queryByTestId('volatility-content')).toBeNull();
  });

  it('expands an individual section on click and updates the open counter', () => {
    renderWithClient(<MacroPage />);

    const fedFundsSection = screen.getByText('Fed Funds Futures (ZQ!) Policy Curve & Rate Hike/Cut Barometer');
    fireEvent.click(fedFundsSection);

    // Now content should be visible
    expect(screen.getByTestId('fed-funds-curve-content')).toBeDefined();
    expect(screen.getByText('1 of 10 Open')).toBeDefined();

    // Clicking again collapses it
    fireEvent.click(fedFundsSection);
    expect(screen.queryByTestId('fed-funds-curve-content')).toBeNull();
    expect(screen.getByText('0 of 10 Open')).toBeDefined();
  });

  it('expands all sections with Expand All button and collapses with Collapse All', () => {
    renderWithClient(<MacroPage />);

    const expandAllButton = screen.getByRole('button', { name: /Expand All/i });
    fireEvent.click(expandAllButton);

    // All should be open
    expect(screen.getByText('10 of 10 Open')).toBeDefined();
    expect(screen.getByTestId('commodities-content')).toBeDefined();
    expect(screen.getByTestId('gold-macro-regime-content')).toBeDefined();
    expect(screen.getByTestId('trend-finder-content')).toBeDefined();
    expect(screen.getByTestId('volatility-content')).toBeDefined();
    expect(screen.getByTestId('economic-cycle-content')).toBeDefined();
    expect(screen.getByTestId('fed-funds-curve-content')).toBeDefined();

    // Button text changes to Collapse All
    const collapseAllButton = screen.getByRole('button', { name: /Collapse All/i });
    fireEvent.click(collapseAllButton);

    // All should be closed
    expect(screen.getByText('0 of 10 Open')).toBeDefined();
    expect(screen.queryByTestId('commodities-content')).toBeNull();
    expect(screen.queryByTestId('gold-macro-regime-content')).toBeNull();
    expect(screen.queryByTestId('trend-finder-content')).toBeNull();
  });

  it('reorders sections via Move Up / Down buttons and allows Reset Order', () => {
    renderWithClient(<MacroPage />);

    // Find the Move Down button of the first section
    const moveDownButtons = screen.getAllByTitle('Move Section Down');
    expect(moveDownButtons.length).toBe(10);

    // Click Move Down on the first section
    fireEvent.click(moveDownButtons[0]);

    // Reset Order button should now be visible
    const resetButton = screen.getByRole('button', { name: /Reset Order/i });
    expect(resetButton).toBeDefined();

    // Click Reset Order
    fireEvent.click(resetButton);
    expect(screen.queryByRole('button', { name: /Reset Order/i })).toBeNull();
  });
});
