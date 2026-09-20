import { calculateValuationForecast } from '../src/services/valuationForecastEngine';

const res1 = calculateValuationForecast({
  startingPrice: 5.11,
  startingRevenue: 0.0319,
  startingMargin: 1.7,
  startingShares: 0.1432,
  revenueGrowthRate: 25,
  targetMargin: 15,
  exitMultiple: 20,
  discountRate: 10,
  annualShareChangePct: 0,
  horizonYears: 5
});
console.log('Case 1 (rev=0.0319B, m=15%, pe=20):', {
  projectedTargetPrice: res1.projectedTargetPrice,
  fairVal: res1.discountedFairValue,
  mos: res1.marginOfSafetyPct,
  terminalEps: res1.terminalEps,
  terminalRev: res1.terminalRevenue,
  cagr: res1.annualizedCagrPct
});

const res2 = calculateValuationForecast({
  startingPrice: 5.11,
  startingRevenue: 0.0319,
  startingMargin: -50,
  startingShares: 0.1432,
  revenueGrowthRate: 25,
  targetMargin: -10,
  exitMultiple: 20,
  discountRate: 10,
  annualShareChangePct: 0,
  horizonYears: 5
});
console.log('Case 2 (targetMargin = -10%):', {
  projectedTargetPrice: res2.projectedTargetPrice,
  fairVal: res2.discountedFairValue,
  terminalEps: res2.terminalEps,
  cagr: res2.annualizedCagrPct
});

const res3 = calculateValuationForecast({
  startingPrice: 5.11,
  startingRevenue: 31.9, // user entered in millions
  startingMargin: 15,
  startingShares: 0.1432, // shares left in billions
  revenueGrowthRate: 25,
  targetMargin: 15,
  exitMultiple: 20,
  discountRate: 10,
  annualShareChangePct: 0,
  horizonYears: 5
});
console.log('Case 3 (user typed 31.9 for rev, shares 0.143B):', {
  projectedTargetPrice: res3.projectedTargetPrice,
  fairVal: res3.discountedFairValue,
  cagr: res3.annualizedCagrPct
});

const res4 = calculateValuationForecast({
  startingPrice: 5.11,
  startingRevenue: 0.03,
  startingMargin: 1.7,
  startingShares: 0.143,
  revenueGrowthRate: 10,
  targetMargin: 1.7,
  exitMultiple: -170.3, // default initialized from Yahoo PE
  discountRate: 10,
  annualShareChangePct: -1,
  horizonYears: 5
});
console.log('Case 4 (exitMultiple = -170.3):', {
  projectedTargetPrice: res4.projectedTargetPrice,
  fairVal: res4.discountedFairValue,
  mos: res4.marginOfSafetyPct
});

const res5 = calculateValuationForecast({
  startingPrice: 5.11,
  startingRevenue: 0.03,
  startingMargin: 20,
  startingShares: 0.143,
  revenueGrowthRate: 10,
  targetMargin: 20,
  exitMultiple: 22,
  discountRate: 10,
  annualShareChangePct: -1,
  horizonYears: 5
});
console.log('Case 5 (User sets values: 0.03 rev, 20% margin, 22 PE):', {
  projectedTargetPrice: res5.projectedTargetPrice,
  fairVal: res5.discountedFairValue,
  terminalEps: res5.terminalEps,
  mos: res5.marginOfSafetyPct,
  cagr: res5.annualizedCagrPct
});
