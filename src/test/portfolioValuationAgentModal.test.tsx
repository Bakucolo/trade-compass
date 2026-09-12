import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortfolioValuationModal } from '../components/portfolio/PortfolioValuationModal';

vi.mock('../services/portfolioValuationService', () => ({
  usePortfolioValuationAudits: vi.fn(() => ({
    data: [
      {
        id: 'audit-101',
        title: 'Scatter-Gather Portfolio Valuation & Alerting Audit',
        overallValuationStatus: 'FAIRLY_VALUED',
        portfolioDiscountPercent: 12.5,
        portfolioScore: 78,
        totalMarketValue: 50000,
        totalFairValue: 56250,
        undervaluedCount: 2,
        fairlyValuedCount: 1,
        overvaluedCount: 1,
        totalHoldingsCount: 4,
        executiveSummary: 'Portfolio exhibits sound fundamental valuation with 2 high-conviction undervalued positions.',
        keyOpportunitiesSummary: 'NVDA and AAPL trade at attractive discounts.',
        valuationRisksSummary: 'TSLA flagged as overextended.',
        holdings: [
          {
            symbol: 'NVDA',
            companyName: 'NVIDIA Corporation',
            currentPrice: 130.50,
            blendedFairValue: 165.00,
            marginOfSafetyPercent: 26.4,
            upsideDownsidePercent: 26.4,
            valuationStatus: 'UNDERVALUED',
            valuationScore: 88,
            actionVerdict: 'STRONG_BUY_ACCUMULATE',
            actionRationale: 'Blackwell architecture dominance',
            aiDiagnosisSummary: 'Deep value multiple compression',
            keyDrivers: ['Datacenter AI revenue acceleration']
          },
          {
            symbol: 'TSLA',
            companyName: 'Tesla Inc',
            currentPrice: 240.00,
            blendedFairValue: 195.00,
            marginOfSafetyPercent: -18.7,
            upsideDownsidePercent: -18.7,
            valuationStatus: 'EXTREMELY_OVERVALUED',
            valuationScore: 42,
            actionVerdict: 'TRIM_TAKE_PROFITS',
            actionRationale: 'Multiples extended',
            aiDiagnosisSummary: 'Robotaxi execution priced in prematurely',
            keyDrivers: ['FSD v13 regulatory approval']
          }
        ],
        rawReportJson: JSON.stringify({
          audit_id: 'audit-101',
          created_alerts: [
            {
              symbol: 'TSLA',
              target_price: 245.00,
              condition: 'ABOVE',
              alert_id: 'alert-123'
            }
          ]
        }),
        createdAt: '2026-09-09T07:00:00.000Z'
      }
    ],
    refetch: vi.fn(),
    isLoading: false
  })),
  useDeletePortfolioValuation: vi.fn(() => ({
    mutateAsync: vi.fn()
  }))
}));

vi.mock('../services/portfolioValuationAgentClient', () => ({
  useRunScatterGatherValuation: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({
      success: true,
      result: {
        audit_id: 'audit-new-1',
        timestamp: '2026-09-09T08:00:00.000Z',
        total_tickers_audited: 2,
        concurrency_batch_size: 5,
        total_batches: 1,
        overextended_count: 1,
        undervalued_count: 1,
        fairly_valued_count: 0,
        alerts_created_count: 1,
        portfolio_summary: 'Scatter-Gather audit completed successfully.',
        stock_reports: [
          {
            symbol: 'NVDA',
            company_name: 'NVIDIA Corporation',
            current_price: 130.50,
            target_price_1y: 165.00,
            valuation_status: 'UNDERVALUED',
            is_overextended: false,
            overextended_threshold_price: 175.00,
            upside_downside_pct: 26.44,
            conviction_score: 88,
            valuation_thesis: 'Dominant accelerated computing moat.',
            key_drivers: ['Blackwell architecture'],
            key_risks: ['Custom ASIC silicon'],
            action_recommendation: 'BUY'
          }
        ],
        created_alerts: [
          {
            symbol: 'TSLA',
            target_price: 245.00,
            condition: 'ABOVE',
            alert_id: 'alert-123'
          }
        ]
      }
    }),
    isPending: false
  })),
  usePortfolioValuationReports: vi.fn(() => ({
    data: [
      {
        id: 'rep-1',
        symbol: 'NVDA',
        reportType: 'portfolio_valuation_worker',
        title: 'NVDA Valuation & Alerting Agent Audit',
        convictionScore: 88,
        summary: 'Deep value multiple compression',
        contentJson: JSON.stringify({
          symbol: 'NVDA',
          company_name: 'NVIDIA Corporation',
          current_price: 130.50,
          target_price_1y: 165.00,
          is_overextended: false
        }),
        pdfPath: '/agent_research/valuation_NVDA.pdf',
        createdAt: '2026-09-09T07:30:00.000Z',
        updatedAt: '2026-09-09T07:30:00.000Z'
      }
    ],
    refetch: vi.fn()
  })),
  portfolioValuationAgentClient: {
    getStockPdfUrl: (symbol: string) => `/api/portfolio/valuation-agent/stock-pdf/${symbol}`,
    getPortfolioPdfUrl: (id: string) => `/api/portfolio/valuation-agent/portfolio-pdf/${id}`
  }
}));

describe('PortfolioValuationModal Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PortfolioValuationModal isOpen={true} onClose={vi.fn()} positions={[]} />
      </QueryClientProvider>
    );

  it('renders modal header with Scatter-Gather Map-Reduce architecture badge', () => {
    renderComponent();

    expect(screen.getByText('Portfolio Valuation & Automated Alerting Agent')).toBeInTheDocument();
    expect(screen.getByText('Scatter-Gather Map-Reduce Architecture')).toBeInTheDocument();
    expect(screen.getByText('Batch Concurrency: 5 Workers')).toBeInTheDocument();
    expect(screen.getByText('Run Scatter-Gather Pipeline')).toBeInTheDocument();
  });

  it('renders automated overextension alerts banner when active alerts exist', () => {
    renderComponent();

    expect(screen.getByText(/Automated Overextension Alerts Armed/i)).toBeInTheDocument();
    expect(screen.getByText(/TSLA > \$245.00/i)).toBeInTheDocument();
  });

  it('renders holding cards with 1-Year target prices and download PDF buttons', () => {
    renderComponent();

    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText('$165.00')).toBeInTheDocument();
    expect(screen.getByText('$195.00')).toBeInTheDocument();

    const pdfButtons = screen.getAllByRole('button', { name: /PDF/i });
    expect(pdfButtons.length).toBeGreaterThan(0);
  });

  it('switches to Watch Later & Saved PDFs tab', async () => {
    renderComponent();

    const savedPdfsTab = screen.getByRole('tab', { name: /Watch Later & Saved PDFs/i });
    fireEvent.pointerDown(savedPdfsTab, { button: 0 });
    fireEvent.click(savedPdfsTab);
    fireEvent.keyDown(savedPdfsTab, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Saved Stock Valuation Reports/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();
  });
});
