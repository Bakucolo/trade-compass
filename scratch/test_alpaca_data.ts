import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testAlpacaMarketData() {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_SECRET_KEY;

  try {
    const symbol = 'AAPL';
    const start = '2026-08-01T00:00:00Z';
    const end = '2026-09-01T00:00:00Z';
    const url = `https://data.alpaca.markets/v2/stocks/bars?symbols=${symbol}&timeframe=1Day&start=${start}&end=${end}&feed=iex`;

    const res = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': key || '',
        'APCA-API-SECRET-KEY': secret || '',
      }
    });
    const data = await res.json();
    console.log('Alpaca Market Data Status:', res.status);
    console.log('Bars count for AAPL:', data.bars?.AAPL?.length);
    if (data.bars?.AAPL?.length > 0) {
      console.log('First bar:', data.bars.AAPL[0]);
      console.log('Last bar:', data.bars.AAPL[data.bars.AAPL.length - 1]);
    } else {
      console.log('Response body:', data);
    }
  } catch (err) {
    console.error('Market data error:', err);
  }
}

testAlpacaMarketData();
