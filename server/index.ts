import express from 'express';
import cors from 'cors';
import { IBApi, EventName, ErrorCode, Contract } from '@stoqey/ib';
import * as fs from 'fs';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// IBKR Connection Settings
const IB_HOST = '127.0.0.1';
const IB_PORTS = [7497, 7496, 4001, 4002];

let ib: IBApi;
let isConnected = false;
let positions: any[] = [];
let trades: any[] = [];

const connectToIBKR = async () => {
  for (const port of IB_PORTS) {
    if (isConnected) break;
    console.log(`Attempting to connect to IBKR on port ${port}...`);

    const tempIB = new IBApi({
      host: IB_HOST,
      port: port,
    });

    try {
      tempIB.connect();
      // Give it a moment to emit 'connected' or 'error'
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (tempIB.isConnected) {
        console.log(`Successfully connected on port ${port}`);
        ib = tempIB;
        setupEventListeners(ib);
        isConnected = true; // Manually set since we might have missed the event
        ib.reqPositions();
        ib.reqAllOpenOrders();
        return;
      } else {
        tempIB.disconnect();
      }
    } catch (e) {
      console.log(`Failed on port ${port}`);
    }
  }

  if (!isConnected) {
    console.log("Could not connect to any IBKR port. Retrying in 60s...");
    setTimeout(connectToIBKR, 60000);
  }
};

const setupEventListeners = (ibInstance: IBApi) => {
  ibInstance.on(EventName.connected, () => {
    console.log('Connected to IBKR');
    isConnected = true;
    ibInstance.reqPositions();
    ibInstance.reqAllOpenOrders();
  });

  ibInstance.on(EventName.disconnected, () => {
    console.log('Disconnected from IBKR');
    isConnected = false;
    // Trigger reconnection logic
    setTimeout(connectToIBKR, 5000);
  });

  ibInstance.on(EventName.error, (err: Error, code: ErrorCode, reqId: number) => {
    console.error(`IBKR Error: ${err.message} (Code: ${code}, ReqId: ${reqId})`);
  });

  ibInstance.on(EventName.position, (account: string, contract: Contract, pos: number, avgCost: number) => {
    const existingIndex = positions.findIndex(p => p.contract.conId === contract.conId);
    const positionData = { account, contract, pos, avgCost };

    if (existingIndex !== -1) {
      if (pos === 0) {
        positions.splice(existingIndex, 1);
      } else {
        positions[existingIndex] = positionData;
      }
    } else if (pos !== 0) {
      positions.push(positionData);
    }
  });
};

// Initial connection
connectToIBKR();

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({ connected: isConnected });
});

app.get('/api/portfolio', (req, res) => {
  // Trigger a refresh of positions
  if (isConnected) {
    ib.reqPositions();
  }
  res.json(positions);
});

// Tastytrade Integration (Custom Implementation)
const TASTY_LIVE_URL = 'https://api.tastyworks.com';
const TASTY_SANDBOX_URL = 'https://api.cert.tastyworks.com';

let tastySessionToken: string | null = null;
let tastyBaseUrl = TASTY_LIVE_URL;

const logToFile = (message: string) => {
  try {
    fs.appendFileSync('server_debug.log', `${new Date().toISOString()} - ${message}\n`);
  } catch (err) {
    console.error('Failed to write to log file', err);
  }
};

app.post('/api/tastytrade/login', async (req, res) => {
  const { username, password, isSandbox = false } = req.body;
  tastyBaseUrl = isSandbox ? TASTY_SANDBOX_URL : TASTY_LIVE_URL;

  logToFile(`Login attempt for user: ${username} (Sandbox: ${isSandbox})`);

  try {
    const response = await fetch(`${tastyBaseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TradeCompass/1.0'
      },
      body: JSON.stringify({ login: username, password, "remember-me": true })
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();

      logToFile(`Login response: ${JSON.stringify(data)}`);

      if (!response.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }
      tastySessionToken = data.data['session-token'];
      res.json({ success: true, user: data.data.user });
    } else {
      const text = await response.text();
      logToFile(`Login non-JSON response: ${text}`);
      console.error("Tastytrade API returned non-JSON:", text);

      // Try to extract title if HTML
      const titleMatch = text.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Unknown Error';

      throw new Error(`Tastytrade API returned ${response.status} (${title}). Check server logs.`);
    }

  } catch (error: any) {
    logToFile(`Login error: ${error.message}`);
    console.error('Tastytrade Login Error:', error);
    res.status(401).json({ success: false, error: error.message });
  }
});

app.get('/api/tastytrade/accounts', async (req, res) => {
  if (!tastySessionToken) return res.status(401).json({ error: 'Not authenticated' });
  try {
    logToFile('Fetching accounts...');
    const response = await fetch(`${tastyBaseUrl}/customers/me/accounts`, {
      headers: {
        'Authorization': tastySessionToken,
        'User-Agent': 'TradeCompass/1.0'
      }
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();

      logToFile(`Accounts response data: ${JSON.stringify(data)}`);

      if (!response.ok) throw new Error(data.error?.message);

      console.log('Tastytrade Accounts:', JSON.stringify(data, null, 2));

      // Defensive coding: ensure items is an array
      const items = data.data?.items;
      res.json({ items: Array.isArray(items) ? items : [] });
    } else {
      const text = await response.text();
      logToFile(`Accounts non-JSON response: ${text}`);
      console.error("Tastytrade Accounts API returned non-JSON:", text);
      const titleMatch = text.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Unknown Error';
      throw new Error(`Tastytrade API returned ${response.status} (${title})`);
    }
  } catch (error: any) {
    logToFile(`Error fetching accounts: ${error.message}`);
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tastytrade/positions/:accountNumber', async (req, res) => {
  if (!tastySessionToken) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { accountNumber } = req.params;
    logToFile(`Fetching positions for account ${accountNumber}...`);

    const response = await fetch(`${tastyBaseUrl}/accounts/${accountNumber}/positions`, {
      headers: {
        'Authorization': tastySessionToken,
        'User-Agent': 'TradeCompass/1.0'
      }
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      logToFile(`Positions response data: ${JSON.stringify(data)}`);

      if (!response.ok) throw new Error(data.error?.message);

      // Defensive coding
      const items = data.data?.items;
      res.json({ items: Array.isArray(items) ? items : [] });
    } else {
      const text = await response.text();
      logToFile(`Positions non-JSON response: ${text}`);
      console.error("Tastytrade Positions API returned non-JSON:", text);
      const titleMatch = text.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Unknown Error';
      throw new Error(`Tastytrade API returned ${response.status} (${title})`);
    }
  } catch (error: any) {
    logToFile(`Error fetching positions: ${error.message}`);
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Market Data Proxy (REST Snapshot)
app.get('/api/tastytrade/market-data/:symbol', async (req, res) => {
  if (!tastySessionToken) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { symbol } = req.params;
    logToFile(`Fetching market data for ${symbol}...`);

    // Tastytrade uses specialized endpoints. "by-type" is common for equity quotes.
    // URL: /market-data/by-type?equity=AAPL
    // Note: This endpoint might return an array of data objects.
    const response = await fetch(`${tastyBaseUrl}/market-data/equity-quotes?symbols=${symbol}`, {
      headers: {
        'Authorization': tastySessionToken,
        'User-Agent': 'TradeCompass/1.0'
      }
    });

    // If equity-quotes fails (404), try by-type (legacy or different plan)
    if (response.status === 404) {
      logToFile(`equity-quotes 404, trying by-type...`);
      const fallbackResponse = await fetch(`${tastyBaseUrl}/market-data/by-type?equity=${symbol}`, {
        headers: {
          'Authorization': tastySessionToken,
          'User-Agent': 'TradeCompass/1.0'
        }
      });

      const data = await fallbackResponse.json();
      if (!fallbackResponse.ok) throw new Error(data.error?.message || 'Failed to fetch market data');
      return res.json(data);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      // logToFile(`Market Data response: ${JSON.stringify(data)}`); // Verbose
      if (!response.ok) throw new Error(data.error?.message);
      res.json(data);
    } else {
      const text = await response.text();
      logToFile(`Market Data non-JSON response: ${text}`);
      throw new Error(`Tastytrade API returned ${response.status}`);
    }

  } catch (error: any) {
    logToFile(`Error fetching market data: ${error.message}`);
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Quote Tokens (for DXLink)
app.get('/api/tastytrade/quote-tokens', async (req, res) => {
  if (!tastySessionToken) return res.status(401).json({ error: 'Not authenticated' });
  try {
    logToFile(`Fetching quote tokens...`);
    const response = await fetch(`${tastyBaseUrl}/api-quote-tokens`, {
      headers: {
        'Authorization': tastySessionToken,
        'User-Agent': 'TradeCompass/1.0'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get quote tokens: ${text}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    logToFile(`Error fetching quote tokens: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Instrument Lookup
app.get('/api/tastytrade/instruments/:symbol', async (req, res) => {
  if (!tastySessionToken) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { symbol } = req.params;
    logToFile(`Looking up instrument ${symbol}...`);
    // Tastytrade active-equities endpoint to find the instrument
    const response = await fetch(`${tastyBaseUrl}/instruments/equities?symbol=${symbol}`, {
      headers: {
        'Authorization': tastySessionToken,
        'User-Agent': 'TradeCompass/1.0'
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Instrument lookup failed');

    // Return the first match
    const item = data.data?.items?.[0];
    res.json(item || null);
  } catch (error: any) {
    logToFile(`Error looking up instrument: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});
