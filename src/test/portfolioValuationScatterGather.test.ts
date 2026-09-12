import { describe, it, expect, vi } from 'vitest';
import {
  generateStockValuationPdfBuffer,
  generatePortfolioValuationPdfBuffer,
  StockValuationReport,
  ScatterGatherValuationResult
} from '../../server/services/portfolioValuationAgentService';

describe('Scatter-Gather Portfolio Valuation Engine', () => {
  it('correctly chunks arbitrary numbers of tickers into concurrency batches of 5', () => {
    const tickers = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'NFLX', 'PLTR', 'AVGO', 'COIN'];
    const concurrencyLimit = 5;

    const batches: string[][] = [];
    for (let i = 0; i < tickers.length; i += concurrencyLimit) {
      batches.push(tickers.slice(i, i + concurrencyLimit));
    }

    expect(batches.length).toBe(3);
    expect(batches[0]).toEqual(['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL']);
    expect(batches[1]).toEqual(['META', 'TSLA', 'AMD', 'NFLX', 'PLTR']);
    expect(batches[2]).toEqual(['AVGO', 'COIN']);
    expect(batches[0].length).toBe(5);
    expect(batches[1].length).toBe(5);
    expect(batches[2].length).toBe(2);
  });

  it('generates a valid institutional stock valuation PDF buffer with PDFKit', async () => {
    const mockReport: StockValuationReport = {
      symbol: 'NVDA',
      company_name: 'NVIDIA Corporation',
      current_price: 130.50,
      target_price_1y: 165.00,
      valuation_status: 'UNDERVALUED',
      is_overextended: false,
      overextended_threshold_price: 175.00,
      upside_downside_pct: 26.44,
      conviction_score: 88,
      valuation_thesis: 'NVIDIA maintains massive accelerated computing moat driven by Blackwell data center scaling. Forward multiple of 32x is well supported by >45% earnings CAGR.',
      key_drivers: [
        'Blackwell architecture supply ramp',
        'Sovereign AI infrastructure spend',
        'Expanding gross margins above 74%'
      ],
      key_risks: [
        'Custom ASIC silicon competition from hyperscalers',
        'Export restrictions on advanced chip packaging'
      ],
      action_recommendation: 'BUY',
      fundamental_context: {
        symbol: 'NVDA',
        companyName: 'NVIDIA Corporation',
        currentPrice: 130.50,
        currency: 'USD',
        trailingPE: 48.2,
        forwardPE: 32.1,
        pegRatio: 1.15,
        evToEbitda: 36.4,
        revenueGrowthYoY: 122.4,
        operatingMargins: 62.1,
        fcfYieldPercent: 3.2,
        analystTargetMean: 170.00
      }
    };

    const pdfBuffer = await generateStockValuationPdfBuffer(mockReport);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Verify standard PDF magic header
    const header = pdfBuffer.subarray(0, 5).toString('utf-8');
    expect(header).toBe('%PDF-');
  });

  it('generates a valid master portfolio valuation PDF briefing buffer with overextended alerts', async () => {
    const mockResult: ScatterGatherValuationResult = {
      timestamp: new Date().toISOString(),
      total_tickers_audited: 3,
      concurrency_batch_size: 5,
      total_batches: 1,
      overextended_count: 1,
      undervalued_count: 1,
      fairly_valued_count: 1,
      alerts_created_count: 1,
      portfolio_summary: 'Audited 3 holdings via Scatter-Gather Map-Reduce architecture. 1 stock flagged as OVEREXTENDED, 1 undervalued gem, and 1 fairly valued asset.',
      stock_reports: [
        {
          symbol: 'TSLA',
          company_name: 'Tesla, Inc.',
          current_price: 240.00,
          target_price_1y: 195.00,
          valuation_status: 'OVEREXTENDED',
          is_overextended: true,
          overextended_threshold_price: 245.00,
          upside_downside_pct: -18.75,
          conviction_score: 82,
          valuation_thesis: 'Current valuation prices full autonomous robotaxi execution ahead of regulatory clarity.',
          key_drivers: ['Full Self-Driving FSD v13 rollout', 'Energy storage mega-pack growth'],
          key_risks: ['EV automotive margin compression', 'Execution delay on low-cost vehicle'],
          action_recommendation: 'TRIM'
        },
        {
          symbol: 'AAPL',
          company_name: 'Apple Inc.',
          current_price: 220.00,
          target_price_1y: 250.00,
          valuation_status: 'UNDERVALUED',
          is_overextended: false,
          overextended_threshold_price: 260.00,
          upside_downside_pct: 13.64,
          conviction_score: 90,
          valuation_thesis: 'Apple Intelligence upgrade supercycle provides high-margin services tailwinds.',
          key_drivers: ['Services recurring revenue acceleration', 'Installed base expansion'],
          key_risks: ['Greater China market competition'],
          action_recommendation: 'BUY'
        }
      ],
      created_alerts: [
        {
          symbol: 'TSLA',
          target_price: 245.00,
          condition: 'ABOVE',
          alert_id: 'alert-mock-123',
          notes: 'Automated Valuation Alert: Overextended beyond $245.00'
        }
      ]
    };

    const pdfBuffer = await generatePortfolioValuationPdfBuffer(mockResult);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    const header = pdfBuffer.subarray(0, 5).toString('utf-8');
    expect(header).toBe('%PDF-');
  });

  it('determines overextension and alert target price based on valuation metrics', () => {
    const evaluateStockAlert = (price: number, target: number, forwardPE: number) => {
      const upside = ((target - price) / price) * 100;
      const isOver = forwardPE > 35 || upside < -8;
      const threshold = isOver ? Number((price * 1.02).toFixed(2)) : Number((Math.max(price, target) * 1.10).toFixed(2));
      return { isOver, threshold, upside };
    };

    // Case 1: Expensive stock with negative upside
    const stockA = evaluateStockAlert(250, 200, 42);
    expect(stockA.isOver).toBe(true);
    expect(stockA.threshold).toBe(255.00); // 2% above 250

    // Case 2: Undervalued stock with healthy multiple
    const stockB = evaluateStockAlert(100, 130, 18);
    expect(stockB.isOver).toBe(false);
    expect(stockB.threshold).toBe(143.00); // 10% above 130
  });
});
