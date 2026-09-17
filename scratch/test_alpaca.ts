import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testAlpaca() {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_SECRET_KEY;
  console.log('Testing Alpaca with Key ID prefix:', key?.substring(0, 4));

  try {
    const res = await fetch('https://paper-api.alpaca.markets/v2/account', {
      headers: {
        'APCA-API-KEY-ID': key || '',
        'APCA-API-SECRET-KEY': secret || '',
      }
    });
    const data = await res.json();
    console.log('Alpaca Account Response Status:', res.status);
    console.log('Account Info:', {
      id: data.id,
      status: data.status,
      currency: data.currency,
      buying_power: data.buying_power,
      cash: data.cash,
      portfolio_value: data.portfolio_value,
      pattern_day_trader: data.pattern_day_trader,
      trading_blocked: data.trading_blocked,
      transfers_blocked: data.transfers_blocked,
      account_blocked: data.account_blocked
    });
  } catch (err) {
    console.error('Alpaca Error:', err);
  }
}

testAlpaca();
