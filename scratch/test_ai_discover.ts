async function testAiDiscover() {
  console.log('Testing AI Strategy Discovery endpoint...');
  const res = await fetch('http://localhost:3000/api/ai-trading/backtest/ai-discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: 'AAPL',
      objectivePrompt: 'Create a swing pullback strategy for Apple that buys oversold dips in uptrends.',
      lookbackDays: 90,
    }),
  });
  const data = await res.json();
  console.log('AI Discovery Result:');
  console.log({
    hypothesisName: data.strategyHypothesis?.name,
    archetype: data.strategyHypothesis?.targetArchetype,
    hypothesis: data.strategyHypothesis?.hypothesis?.substring(0, 100) + '...',
    winRate: data.backtestResult?.winRatePercent,
    totalReturn: data.backtestResult?.totalReturnPercent,
  });
}

testAiDiscover();
