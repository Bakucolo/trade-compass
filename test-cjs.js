const yahooFinance = require('yahoo-finance2').default;
yahooFinance.quote('AAPL').then(q => console.log(q.symbol)).catch(console.error);
