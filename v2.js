import yahooFinance from 'yahoo-finance2';
async function test() {
   try {
       const q = await yahooFinance.quote('AAPL');
       console.log('Success:', q.symbol);
   } catch(e) {
       console.log('Failure:', e.message);
   }
}
test();
