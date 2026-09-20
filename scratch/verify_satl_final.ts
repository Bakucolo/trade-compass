import { calculateValuationForecast } from '../src/services/valuationForecastEngine';

const satlBaseline = {
  startingPrice: 5.12,
  startingRevenue: 0.0319, // 31.9 Million USD = 0.0319 Billion
  startingShares: 0.1432,  // 143.2 Million shares = 0.1432 Billion
  revenueGrowthRate: 25,
  targetMargin: 15,     // mature target margin 15%
  startingMargin: -30,  // currently unprofitable
  discountRate: 10,
  horizonYears: 5,
  annualShareChangePct: 3,
  exitMultiple: 22,
  valuationMetric: 'PE' as const
};

const peForecast = calculateValuationForecast(satlBaseline);
console.log('=== SATL PE Mode Forecast ===');
console.log('Starting Price:', satlBaseline.currentPrice);
console.log('Year 5 Projected Price:', peForecast.projectedTargetPrice);
console.log('Discounted Fair Value (Today):', peForecast.discountedFairValue);
console.log('Margin of Safety %:', peForecast.marginOfSafetyPct);
console.log('Expected CAGR %:', peForecast.annualizedCagrPct);
console.log('5-Year Projected EPS:', peForecast.path.map(p => `${p.yearLabel}: $${p.epsOrFcfPerShare}`));
console.log('5-Year Projected Revenue ($B):', peForecast.path.map(p => `${p.yearLabel}: $${p.revenue}B`));

const psForecast = calculateValuationForecast({
  ...satlBaseline,
  exitMultiple: 6.0,
  valuationMetric: 'PS' as const
});
console.log('\n=== SATL PS Mode Forecast (6x Sales) ===');
console.log('Year 5 Projected Price:', psForecast.projectedTargetPrice);
console.log('Discounted Fair Value (Today):', psForecast.discountedFairValue);
console.log('Margin of Safety %:', psForecast.marginOfSafetyPct);
console.log('Expected CAGR %:', psForecast.annualizedCagrPct);
console.log('5-Year Projected Prices:', psForecast.path.map(p => `${p.yearLabel}: $${p.projectedPrice}`));

