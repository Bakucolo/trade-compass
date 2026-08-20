// Native fetch in Node 18+
import 'dotenv/config';

const BASE_URL = 'http://localhost:3000/api/tastytrade';
const USERNAME = process.env.TASTY_USERNAME;
const PASSWORD = process.env.TASTY_PASSWORD;
const IS_SANDBOX = process.env.TASTY_IS_SANDBOX === 'true';

async function testEndpoints() {
    if (!USERNAME || !PASSWORD) {
        console.error("Please set TASTY_USERNAME and TASTY_PASSWORD in .env");
        return;
    }

    console.log(`Testing with User: ${USERNAME}, Sandbox: ${IS_SANDBOX}`);

    // 1. Login
    console.log('\n--- 1. Testing Login ---');
    let sessionToken = '';
    let accountNumber = '';

    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: USERNAME, password: PASSWORD, isSandbox: IS_SANDBOX })
        });

        // Check if response is OK
        if (!res.ok) {
            console.error(`Login HTTP Error: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error('Response:', text);
            return;
        }

        const data = await res.json();
        if (data.success) {
            console.log('Login Successful!');
            sessionToken = data.sessionToken;
            console.log('Session Token:', sessionToken ? 'Received' : 'Missing');
        } else {
            console.error('Login Failed:', data);
            return;
        }
    } catch (e) {
        console.error('Login Exception:', e);
        return;
    }

    // 2. Get Accounts
    console.log('\n--- 2. Testing Accounts ---');
    try {
        const res = await fetch(`${BASE_URL}/accounts`);
        if (!res.ok) console.error(`Accounts HTTP Error: ${res.status}`);
        else {
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                console.log(`Found ${data.items.length} accounts.`);
                accountNumber = data.items[0]['account-number'];
                console.log(`Using Account: ${accountNumber}`);
            } else {
                console.error('No accounts found or error:', data);
            }
        }
    } catch (e) {
        console.error('Accounts Exception:', e);
    }

    // 3. Get Positions
    if (accountNumber) {
        console.log('\n--- 3. Testing Positions ---');
        try {
            const res = await fetch(`${BASE_URL}/positions/${accountNumber}`);
            if (!res.ok) console.error(`Positions HTTP Error: ${res.status}`);
            else {
                const data = await res.json();
                console.log(`Positions result: ${data.items ? data.items.length : 'Error'} items`);
            }
        } catch (e) {
            console.error('Positions Exception:', e);
        }
    }

    // 4. Market Data (Equity Quotes)
    console.log('\n--- 4. Testing Market Data (SPY) ---');
    try {
        const res = await fetch(`${BASE_URL}/market-data/SPY`);
        if (!res.ok) console.error(`Market Data HTTP Error: ${res.status}`);
        else {
            const data = await res.json();
            console.log('Market Data Response:', JSON.stringify(data).substring(0, 200) + '...');
        }
    } catch (e) {
        console.error('Market Data Exception:', e);
    }

    // 5. Quote Tokens
    console.log('\n--- 5. Testing Quote Tokens ---');
    try {
        const res = await fetch(`${BASE_URL}/quote-tokens`);
        if (!res.ok) console.error(`Quote Tokens HTTP Error: ${res.status}`);
        else {
            const data = await res.json();
            console.log('Quote Tokens Response:', JSON.stringify(data).substring(0, 200) + '...');
        }
    } catch (e) {
        console.error('Quote Tokens Exception:', e);
    }

    // 6. Instrument Lookup
    console.log('\n--- 6. Testing Instrument Lookup (SPY) ---');
    try {
        const res = await fetch(`${BASE_URL}/instruments/SPY`);
        if (!res.ok) console.error(`Instrument HTTP Error: ${res.status}`);
        else {
            const data = await res.json();
            console.log('Instrument Response:', JSON.stringify(data).substring(0, 200) + '...');
        }
    } catch (e) {
        console.error('Instrument Exception:', e);
    }
}

testEndpoints();
