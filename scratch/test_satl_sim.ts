import YahooFinance from 'yahoo-finance2';
import { runMonteCarloSimulation } from '../server/services/monteCarloService';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

async function main() {
  console.log('Testing SATL data from Yahoo Finance...');
  const quote = await yahooFinance.quote('SATL', {}, { validateResult: false }).catch((e) => ({ error: e.message }));
  console.log('Quote:', {
    price: quote.regularMarketPrice,
    sharesOutstanding: quote.sharesOutstanding,
    marketCap: quote.marketCap,
    currency: quote.currency,
  });

  const quoteSummary = await yahooFinance.quoteSummary('SATL', {
    modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'incomeStatementHistory']
  }).catch((e) => ({ error: e.message }));

  console.log('quoteSummary sharesOutstanding:', quoteSummary?.defaultKeyStatistics?.sharesOutstanding);
  console.log('quoteSummary sharesOutstanding float:', quoteSummary?.defaultKeyStatistics?.floatShares);
  console.log('quoteSummary totalRevenue:', quoteSummary?.financialData?.totalRevenue);
  console.log('quoteSummary operatingCashflow:', quoteSummary?.financialData?.operatingCashflow);
  console.log('quoteSummary freeCashflow:', quoteSummary?.financialData?.freeCashflow);
  console.log('quoteSummary totalCash:', quoteSummary?.financialData?.totalCash);
  console.log('quoteSummary totalDebt:', quoteSummary?.financialData?.totalDebt);

  console.log('\nRunning runMonteCarloSimulation for SATL...');
  try {
    const res = await runMonteCarloSimulation('SATL', { simulated_paths_count: 500 });
    console.log('Sim output:', {
      current_market_price: res.current_market_price,
      shares_outstanding: res.parameters?.shares_outstanding,
      base_revenue: res.parameters?.base_revenue,
      median_intrinsic_value: res.median_intrinsic_value,
      mean_intrinsic_value: res.mean_intrinsic_value,
      p10: res.confidence_interval_80.p10,
      p90: res.confidence_interval_80.p90,
      prob_undervalued: res.prob_undervalued,
      expected_margin_of_safety_pct: res.expected_margin_of_safety_pct,
    });
  } catch (err: any) {
    console.error('runMonteCarloSimulation error:', err);
  }
}

main();
