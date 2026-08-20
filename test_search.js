import yahooFinance from 'yahoo-finance2';

async function test() {
  const result = await yahooFinance.search('AAPL', { quotesCount: 5, newsCount: 0 });
  console.log(JSON.stringify(result.quotes, null, 2));
}

test();
