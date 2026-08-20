import yahooFinance from 'yahoo-finance2';

yahooFinance.quote('AAPL').then(q => console.log(q.symbol)).catch(console.error);
