import { describe, it, expect } from 'vitest';

interface MockDividendHolding {
  symbol: string;
  shares: number;
  currentPrice: number;
  marketValueUSD: number;
  dividendRateUSD: number;
  dividendYield: number;
  expectedRaisePercent: number;
  paymentMonths: number[];
}

function calculateMockPortfolioDividendSummary(holdings: MockDividendHolding[]) {
  const totalPortfolioValueUSD = holdings.reduce((s, h) => s + h.marketValueUSD, 0);
  const dividendPayers = holdings.filter((h) => h.dividendRateUSD > 0);
  const totalDividendHoldingsValueUSD = dividendPayers.reduce((s, h) => s + h.marketValueUSD, 0);

  let currentAnnualIncomeUSD = 0;
  let projectedAnnualIncomeUSD = 0;

  const analyzed = holdings.map((h) => {
    const isPayer = h.dividendRateUSD > 0;
    const currentIncome = isPayer ? h.shares * h.dividendRateUSD : 0;
    const projectedIncome = currentIncome * (1 + h.expectedRaisePercent / 100);
    const incrementalRaise = projectedIncome - currentIncome;

    currentAnnualIncomeUSD += currentIncome;
    projectedAnnualIncomeUSD += projectedIncome;

    return {
      symbol: h.symbol,
      currentIncome,
      projectedIncome,
      incrementalRaise,
    };
  });

  const incrementalRaiseIncomeUSD = projectedAnnualIncomeUSD - currentAnnualIncomeUSD;
  const totalProjectedRaisePct = currentAnnualIncomeUSD > 0
    ? ((projectedAnnualIncomeUSD - currentAnnualIncomeUSD) / currentAnnualIncomeUSD) * 100
    : 0;

  const portfolioWeightedYield = totalPortfolioValueUSD > 0
    ? (currentAnnualIncomeUSD / totalPortfolioValueUSD) * 100
    : 0;

  const weightedRaiseSum = dividendPayers.reduce(
    (sum, h) => sum + h.expectedRaisePercent * (h.shares * h.dividendRateUSD),
    0
  );
  const portfolioWeightedExpectedRaise = currentAnnualIncomeUSD > 0
    ? weightedRaiseSum / currentAnnualIncomeUSD
    : 0;

  // Monthly cash flow map
  const monthlyCashflows = new Array(12).fill(0);
  for (const h of dividendPayers) {
    const projected = h.shares * h.dividendRateUSD * (1 + h.expectedRaisePercent / 100);
    const months = h.paymentMonths.length > 0 ? h.paymentMonths : [3, 6, 9, 12];
    const perPayment = projected / months.length;
    for (const m of months) {
      if (m >= 1 && m <= 12) {
        monthlyCashflows[m - 1] += perPayment;
      }
    }
  }

  return {
    totalPortfolioValueUSD,
    totalDividendHoldingsValueUSD,
    currentAnnualIncomeUSD,
    projectedAnnualIncomeUSD,
    incrementalRaiseIncomeUSD,
    totalProjectedRaisePct,
    portfolioWeightedYield,
    portfolioWeightedExpectedRaise,
    monthlyCashflows,
    analyzed,
  };
}

describe('Portfolio Expected Dividend Income & Raise Calculator', () => {
  const sampleHoldings: MockDividendHolding[] = [
    {
      symbol: 'VICI',
      shares: 100,
      currentPrice: 32.0,
      marketValueUSD: 3200,
      dividendRateUSD: 1.84,
      dividendYield: 5.75,
      expectedRaisePercent: 4.5, // 4.5% expected hike
      paymentMonths: [3, 6, 9, 12],
    },
    {
      symbol: 'OXY',
      shares: 50,
      currentPrice: 60.0,
      marketValueUSD: 3000,
      dividendRateUSD: 1.12,
      dividendYield: 1.87,
      expectedRaisePercent: 8.0, // 8% expected hike
      paymentMonths: [3, 6, 9, 12],
    },
    {
      symbol: 'MSFT',
      shares: 20,
      currentPrice: 420.0,
      marketValueUSD: 8400,
      dividendRateUSD: 3.92,
      dividendYield: 0.93,
      expectedRaisePercent: 10.0, // 10% expected hike
      paymentMonths: [3, 6, 9, 12],
    },
    {
      symbol: 'PLTR',
      shares: 100,
      currentPrice: 35.0,
      marketValueUSD: 3500,
      dividendRateUSD: 0, // Non-dividend payer
      dividendYield: 0,
      expectedRaisePercent: 0,
      paymentMonths: [],
    },
  ];

  it('should calculate current annual income accurately across dividend payers', () => {
    const res = calculateMockPortfolioDividendSummary(sampleHoldings);

    // VICI: 100 * 1.84 = $184.00
    // OXY: 50 * 1.12 = $56.00
    // MSFT: 20 * 3.92 = $78.40
    // PLTR: 0
    // Expected Current Total: 184 + 56 + 78.40 = $318.40
    expect(res.currentAnnualIncomeUSD).toBeCloseTo(318.40, 2);
  });

  it('should calculate projected income factoring in expected dividend raises', () => {
    const res = calculateMockPortfolioDividendSummary(sampleHoldings);

    // VICI projected: 184 * 1.045 = 192.28
    // OXY projected: 56 * 1.08 = 60.48
    // MSFT projected: 78.40 * 1.10 = 86.24
    // Total Projected: 192.28 + 60.48 + 86.24 = 339.00
    expect(res.projectedAnnualIncomeUSD).toBeCloseTo(339.00, 2);

    // Incremental gain from dividend hikes: 339.00 - 318.40 = $20.60
    expect(res.incrementalRaiseIncomeUSD).toBeCloseTo(20.60, 2);

    // Overall projected hike %: 20.60 / 318.40 = ~6.47%
    expect(res.totalProjectedRaisePct).toBeCloseTo(6.47, 1);
  });

  it('should compute correct portfolio weighted yield and weighted expected raise', () => {
    const res = calculateMockPortfolioDividendSummary(sampleHoldings);

    // Total Portfolio Value: 3200 + 3000 + 8400 + 3500 = $18,100
    // Weighted Yield: 318.40 / 18,100 = ~1.76%
    expect(res.portfolioWeightedYield).toBeCloseTo(1.76, 1);

    // Weighted Expected Raise:
    // (184 * 4.5 + 56 * 8.0 + 78.4 * 10.0) / 318.40 = (828 + 448 + 784) / 318.40 = 2060 / 318.40 = ~6.47%
    expect(res.portfolioWeightedExpectedRaise).toBeCloseTo(6.47, 1);
  });

  it('should distribute projected cash flows into the 12 calendar months', () => {
    const res = calculateMockPortfolioDividendSummary(sampleHoldings);

    // Quarterly payers [3, 6, 9, 12]: Each gets 1/4 of $339 = $84.75 in March, June, September, December
    expect(res.monthlyCashflows[2]).toBeCloseTo(84.75, 1); // March
    expect(res.monthlyCashflows[5]).toBeCloseTo(84.75, 1); // June
    expect(res.monthlyCashflows[8]).toBeCloseTo(84.75, 1); // September
    expect(res.monthlyCashflows[11]).toBeCloseTo(84.75, 1); // December
    expect(res.monthlyCashflows[0]).toBe(0); // January (0 payers)

    // Sum of all 12 months must equal projectedAnnualIncomeUSD
    const sumMonthly = res.monthlyCashflows.reduce((a, b) => a + b, 0);
    expect(sumMonthly).toBeCloseTo(res.projectedAnnualIncomeUSD, 2);
  });
});
