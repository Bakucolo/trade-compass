async function testApi() {
  const res = await fetch('http://localhost:3000/api/ai-trading/backtest/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: 'NVDA',
      strategyType: 'MOMENTUM_TREND_RIDER',
      timeframe: '1Day',
      lookbackDays: 90,
    }),
  });
  const data = await res.json();
  console.log('Backtest API Response:');
  console.log({
    symbol: data.symbol,
    strategyName: data.strategyName,
    totalReturnPercent: data.totalReturnPercent,
    benchmarkReturnPercent: data.benchmarkReturnPercent,
    winRatePercent: data.winRatePercent,
    sharpeRatio: data.sharpeRatio,
    tradesCount: data.trades?.length,
    equityCurveCount: data.equityCurve?.length,
  });
}

testApi();
