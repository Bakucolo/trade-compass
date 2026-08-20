import express from 'express';
import cors from 'cors';
import { IBApi, EventName, ErrorCode, Contract } from '@stoqey/ib';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
dotenv.config({ path: '.env.local' });
dotenv.config();

// Global process error handlers to prevent unexpected server terminations
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

import { PrismaClient } from '@prisma/client';
import { fetchTastyPositions } from './services/tastytradeService';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

// Configure SQLite for high concurrency / WAL mode
prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`)
  .then(() => prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 10000;`))
  .catch(err => console.error('Failed to set SQLite PRAGMA:', err));
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
// positions array removed in favor of DB

const connectToIBKR = async () => {
  // Ensure Broker record exists
  await prisma.broker.upsert({
    where: { name: 'Interactive Brokers' },
    update: { status: 'connecting', lastSyncTime: new Date() },
    create: { name: 'Interactive Brokers', status: 'connecting', lastSyncTime: new Date() }
  });

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

        await prisma.broker.update({
          where: { name: 'Interactive Brokers' },
          data: { status: 'connected', lastSyncTime: new Date() }
        });

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
    await prisma.broker.update({
      where: { name: 'Interactive Brokers' },
      data: { status: 'disconnected', lastSyncTime: new Date() }
    });
    setTimeout(connectToIBKR, 60000);
  }
};

const setupEventListeners = (ibInstance: IBApi) => {
  ibInstance.on(EventName.connected, async () => {
    console.log('Connected to IBKR');
    isConnected = true;
    await prisma.broker.update({
      where: { name: 'Interactive Brokers' },
      data: { status: 'connected', lastSyncTime: new Date() }
    });
    ibInstance.reqPositions();
    ibInstance.reqAllOpenOrders();
  });

  ibInstance.on(EventName.disconnected, async () => {
    console.log('Disconnected from IBKR');
    isConnected = false;
    await prisma.broker.update({
      where: { name: 'Interactive Brokers' },
      data: { status: 'disconnected', lastSyncTime: new Date() }
    });
    // Trigger reconnection logic
    setTimeout(connectToIBKR, 5000);
  });

  ibInstance.on(EventName.error, (err: Error, code: ErrorCode, reqId: number) => {
    console.error(`IBKR Error: ${err.message} (Code: ${code}, ReqId: ${reqId})`);
  });

  let positionWriteQueue = Promise.resolve();
  const queuePositionUpdate = (task: () => Promise<void>) => {
    positionWriteQueue = positionWriteQueue.then(task).catch(err => {
      console.error('Queued position update error:', err);
    });
    return positionWriteQueue;
  };

  ibInstance.on(EventName.position, (account: string, contract: Contract, pos: number, avgCost: number) => {
    queuePositionUpdate(async () => {
      try {
        if (pos === 0) {
          // Remove position if quantity is 0
          await prisma.holding.deleteMany({
            where: {
              broker: { name: 'Interactive Brokers' },
              brokerSpecificId: contract.conId?.toString()
            }
          });
        } else {
          const broker = await prisma.broker.findUnique({ where: { name: 'Interactive Brokers' } });
          if (!broker) return;

          const isOption = contract.secType === 'OPT';

          await prisma.holding.upsert({
            where: {
              brokerId_brokerSpecificId: {
                brokerId: broker.id,
                brokerSpecificId: contract.conId?.toString() || `${contract.symbol}_${contract.secType}`
              }
            },
            update: {
              quantity: pos,
              averageCost: avgCost,
              updatedAt: new Date()
            },
            create: {
              brokerId: broker.id,
              brokerSpecificId: contract.conId?.toString() || `${contract.symbol}_${contract.secType}`,
              symbol: contract.symbol || 'UNKNOWN',
              assetType: isOption ? 'OPTION' : 'EQUITY',
              description: contract.localSymbol,
              quantity: pos,
              averageCost: avgCost,
              currentPrice: 0,
              marketValue: 0,
              dayPnL: 0,
              dayPnLPercent: 0,
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0,
              strikePrice: contract.strike,
              expiryDate: contract.lastTradeDateOrContractMonth,
              optionType: contract.right, // "C" or "P"
              underlyingSymbol: contract.symbol // Approximation
            }
          });
        }
      } catch (err: any) {
        console.error('Error in IBKR position processing:', err?.message || err);
      }
    });
  });
};

// Initial connection
connectToIBKR();

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({ connected: isConnected });
});

app.get('/api/portfolio', async (req, res) => {
  // Trigger a refresh of positions if connected
  if (isConnected) {
    ib.reqPositions();
  }

  // Fetch from DB
  const holdings = await prisma.holding.findMany({
    include: { broker: true }
  });

  // Transform to match previous frontend expectation if needed, or send as is
  // The frontend expects { account, contract, pos, avgCost } shape roughly for IBKR?
  // Let's inspect frontend expectation. But since user asked for "persistence", returning DB state is key.
  // We can return the unified DB model. Frontend might need adjustment or we map it back.
  // Previous IBKR code returned: { account, contract, pos, avgCost }
  // To minimize frontend breakage, we might want to map it back or update frontend.
  // For now, let's return the DB holdings, as they likely want the unified view.
  res.json(holdings);
});

// Tastytrade Integration (SDK Implementation)
import TastytradeClient from '@tastytrade/api';

const TASTY_LIVE_URL = 'https://api.tastyworks.com';
const TASTY_SANDBOX_URL = 'https://api.cert.tastyworks.com';

let ttClient: TastytradeClient | null = null;
let tastyUser: any = null;

const logToFile = (message: string) => {
  try {
    fs.appendFileSync('server_debug.log', `${new Date().toISOString()} - ${message}\n`);
  } catch (err) {
    console.error('Failed to write to log file', err);
  }
};

// Start a new client session
const initTastyClient = (isSandbox: boolean) => {
  const config = isSandbox ? TastytradeClient.SandboxConfig : TastytradeClient.ProdConfig;
  ttClient = new TastytradeClient(config);
};

// Restore session token from frontend
app.post('/api/tastytrade/set-session', async (req, res) => {
  const { sessionToken, user, isSandbox = false } = req.body;

  if (sessionToken) {
    try {
      initTastyClient(isSandbox);
      if (ttClient) {
        // Manually set the auth token on the client's session
        ttClient.session.authToken = sessionToken;
        ttClient.httpClient.accessToken = null as any; // Clear any stale access token if implementation uses one, but session token is usually enough for legacy/hybrid auth or if authToken is the main one. 
        // Actually, looking at d.ts, session.authToken seems to be the one.

        tastyUser = user || null;
        console.log('Tastytrade session restored from client. Token set on SDK.');
        res.json({ success: true });
      }
    } catch (e) {
      console.error("Error initializing client for restore:", e);
      res.status(500).json({ error: 'Failed to restore session' });
    }
  } else {
    res.status(400).json({ error: 'No session token provided' });
  }
});

app.post('/api/tastytrade/login', async (req, res) => {
  const { username, password, isSandbox = false } = req.body;

  logToFile(`Login attempt for user: ${username} (Sandbox: ${isSandbox})`);

  try {
    initTastyClient(isSandbox);
    if (!ttClient) throw new Error("Failed to initialize Tastytrade SDK");

    const session = await ttClient.sessionService.login(username, password);

    logToFile(`Login successful. User: ${session.user.username}`);

    tastyUser = session.user;
    const sessionToken = session['session-token'];

    res.json({ success: true, user: session.user, sessionToken });

  } catch (error: any) {
    logToFile(`Login error: ${error.message}`);
    console.error('Tastytrade Login Error:', error);
    res.status(401).json({ success: false, error: error.message });
  }
});

app.get('/api/tastytrade/accounts', async (req, res) => {
  if (!ttClient) return res.status(401).json({ error: 'Not authenticated with SDK' });
  try {
    logToFile('Fetching accounts...');

    const accounts = await ttClient.accountsAndCustomersService.getCustomerAccounts();
    // accounts is typically an array of Account objects

    logToFile(`Accounts fetched: ${accounts.length}`);
    res.json({ items: accounts });

  } catch (error: any) {
    logToFile(`Error fetching accounts: ${error.message}`);
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tastytrade/positions/:accountNumber', async (req, res) => {
  try {
    const params = req.params as Record<string, string>;
    const accountNumber = params.accountNumber === 'default' ? undefined : params.accountNumber;
    logToFile(`Fetching positions via OAuth2 Adapter for account ${accountNumber}...`);

    const unifiedPositionsList = await fetchTastyPositions(accountNumber);

    logToFile(`Positions fetched and unified: ${unifiedPositionsList.length}`);

    // Sync to DB
    const broker = await prisma.broker.upsert({
      where: { name: 'Tastytrade' },
      update: { status: 'connected', lastSyncTime: new Date() },
      create: { name: 'Tastytrade', status: 'connected', lastSyncTime: new Date() }
    });

    // Filter out logically closed positions natively before database ingestion
    const activePositions = unifiedPositionsList.filter(p => p.quantity !== 0);

    for (const p of activePositions) {
      await prisma.holding.upsert({
        where: {
          brokerId_brokerSpecificId: {
            brokerId: broker.id,
            brokerSpecificId: p.brokerSpecificId
          }
        },
        update: {
          quantity: p.quantity,
          averageCost: p.averageCost,
          currentPrice: p.currentPrice,
          marketValue: p.marketValue,
          dayPnL: p.dayPnL,
          updatedAt: new Date(),
          optionType: p.optionType,
          strikePrice: p.strikePrice
        },
        create: {
          brokerId: broker.id,
          brokerSpecificId: p.brokerSpecificId,
          symbol: p.symbol,
          assetType: p.assetType,
          description: p.description,
          quantity: p.quantity,
          averageCost: p.averageCost,
          currentPrice: p.currentPrice,
          marketValue: p.marketValue,
          dayPnL: p.dayPnL,
          dayPnLPercent: 0,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          strikePrice: p.strikePrice,
          expiryDate: p.expiryDate,
          optionType: p.optionType,
          underlyingSymbol: p.underlyingSymbol
        }
      });
    }

    // Clean up stale database positions that have rolled off or closed
    const activeIds = activePositions.map(p => p.brokerSpecificId);
    await prisma.holding.deleteMany({
      where: {
        brokerId: broker.id,
        brokerSpecificId: { notIn: activeIds }
      }
    });

    // Provide sanitized array exclusively to frontend
    res.json({ items: activePositions });

  } catch (error: any) {
    logToFile(`Error fetching positions: ${error.message}`);
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yahoo Finance Proxy Route
app.get('/api/yahoo/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    logToFile(`Fetching Yahoo Finance data for ${symbol}...`);

    // Direct REST API bypassing unstable NPM wrapper
    const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) throw new Error("Invalid Yahoo generic response");

    const meta = result.meta || {};
    res.json({
      symbol: meta.symbol,
      currentPrice: meta.regularMarketPrice,
      ...meta
    });
  } catch (error: any) {
    logToFile(`Error fetching Yahoo data: ${error.message}`);
    console.error('Error fetching Yahoo data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Market Data Proxy (REST Snapshot) - Using SDK httpClient
app.get('/api/tastytrade/market-data/:symbol', async (req, res) => {
  if (!ttClient) return res.status(401).json({ error: 'Not authenticated with SDK' });
  try {
    const { symbol } = req.params;
    logToFile(`Fetching market data for ${symbol}...`);

    try {
      const data = await ttClient.httpClient.getData(`/market-data/equity-quotes?symbols=${symbol}`);
      res.json(data);
    } catch (e: any) {
      if (e.response && e.response.status === 404) {
        logToFile(`equity-quotes 404, trying by-type...`);
        try {
          const data = await ttClient.httpClient.getData(`/market-data/by-type?equity=${symbol}`);
          res.json(data);
        } catch (fallbackErr: any) {
          const msg = fallbackErr.response?.data?.error?.message || fallbackErr.message;
          throw new Error(msg);
        }
      } else {
        throw e;
      }
    }

  } catch (error: any) {
    logToFile(`Error fetching market data: ${error.message}`);
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Quote Tokens (for DXLink)
app.get('/api/tastytrade/quote-tokens', async (req, res) => {
  if (!ttClient) return res.status(401).json({ error: 'Not authenticated with SDK' });
  try {
    logToFile(`Fetching quote tokens...`);
    const data = await ttClient.httpClient.getData('/api-quote-tokens');
    res.json(data);
  } catch (error: any) {
    logToFile(`Error fetching quote tokens: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Instrument Lookup
app.get('/api/tastytrade/instruments/:symbol', async (req, res) => {
  if (!ttClient) return res.status(401).json({ error: 'Not authenticated with SDK' });
  try {
    const { symbol } = req.params;
    logToFile(`Looking up instrument ${symbol}...`);

    // SDK has specialized service
    const data = await ttClient.instrumentsService.getActiveEquities({ symbol });

    // SDK returns the full response object usually? Or just the data?
    // checking service definition... usually returns Promise<any>, likely the response body.
    // existing code expected data.data.items[0]

    const item = data.data?.items?.[0] || data.items?.[0]; // Handle variations
    res.json(item || null);

  } catch (error: any) {
    logToFile(`Error looking up instrument: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});
// ==========================================
// RESEARCH DOSSIER ENDPOINT (yfinance)
// ==========================================
app.get('/api/research/dossier/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    logToFile(`Fetching comprehensive research dossier for ${ticker}...`);

    let quoteSummary: any = null;
    let searchData: any = null;

    try {
      // Fetch combined summary data from Yahoo Finance
      quoteSummary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'price', 'summaryDetail']
      });
    } catch (e: any) {
      logToFile(`Warning: quoteSummary failed for ${ticker} - ${e.message}`);
    }

    try {
      // Fetch news specific to this ticker
      searchData = await yahooFinance.search(ticker, { newsCount: 5 });
    } catch (e: any) {
      logToFile(`Warning: news search failed for ${ticker} - ${e.message}`);
    }

    if (!quoteSummary && !searchData) {
      return res.status(404).json({ error: 'Ticker not found or data unavailable.' });
    }

    const price = quoteSummary?.price;
    const profile = quoteSummary?.summaryProfile;
    const stats = quoteSummary?.defaultKeyStatistics;
    const financials = quoteSummary?.financialData;
    const summary = quoteSummary?.summaryDetail;

    // Map to required structure with safe fallbacks
    const dossier = {
      header: {
        shortName: price?.shortName || price?.longName || ticker,
        symbol: price?.symbol || ticker,
        regularMarketPrice: price?.regularMarketPrice ?? null,
        regularMarketChange: price?.regularMarketChange ?? null,
        regularMarketChangePercent: price?.regularMarketChangePercent ?? null,
        sector: profile?.sector || 'N/A',
        industry: profile?.industry || 'N/A'
      },
      profile: {
        longBusinessSummary: profile?.longBusinessSummary || 'No recent business summary available for this equity.'
      },
      fundamentals: {
        marketCap: price?.marketCap ?? summary?.marketCap ?? null,
        trailingPE: summary?.trailingPE ?? null,
        forwardPE: summary?.forwardPE ?? null,
        trailingEps: stats?.trailingEps ?? null,
        forwardEps: stats?.forwardEps ?? null,
        profitMargins: financials?.profitMargins ?? null,
        operatingMargins: financials?.operatingMargins ?? null,
        revenueGrowth: financials?.revenueGrowth ?? null,
        returnOnEquity: financials?.returnOnEquity ?? null,
        debtToEquity: financials?.debtToEquity ?? null,
        enterpriseValue: stats?.enterpriseValue ?? null,
        priceToSales: summary?.priceToSalesTrailing12Months ?? null
      },
      technicals: {
        fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: summary?.fiftyTwoWeekLow ?? null,
        fiftyDayAverage: summary?.fiftyDayAverage ?? null,
        twoHundredDayAverage: summary?.twoHundredDayAverage ?? null,
        beta: stats?.beta ?? summary?.beta ?? null,
        volume: summary?.volume ?? price?.regularMarketVolume ?? null,
        averageVolume: summary?.averageVolume ?? null,
        dayLow: price?.regularMarketDayLow ?? null,
        dayHigh: price?.regularMarketDayHigh ?? null
      },
      news: searchData?.news?.map((n: any) => ({
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        providerPublishTime: n.providerPublishTime
      })) || []
    };

    res.json(dossier);
  } catch (error: any) {
    logToFile(`Error generating dossier: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// AI Analysis Endpoint (OpenRouter)
app.get('/api/research/analyze/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ error: 'OpenRouter API key is missing. Please add it to your .env.local file.' });
    }

    logToFile(`Generating AI Analysis for ${ticker}...`);

    let quoteSummary: any = null;
    try {
      quoteSummary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'price', 'summaryDetail']
      });
    } catch (e: any) {
      logToFile(`Warning: quoteSummary failed for AI on ${ticker} - ${e.message}`);
    }

    if (!quoteSummary) {
      return res.status(404).json({ error: 'Data unavailable to perform AI Analysis.' });
    }

    const price = quoteSummary?.price;
    const profile = quoteSummary?.summaryProfile;
    const stats = quoteSummary?.defaultKeyStatistics;
    const financials = quoteSummary?.financialData;
    const summary = quoteSummary?.summaryDetail;

    const systemPrompt = `You are an Aggressive Growth Investment Agent. 
Your main goals are:
1. Identify companies with strong fundamentals facing temporary challenges.
2. Prioritize companies with a high Free Cash Flow yield.
3. Actively debate the 'Value' perspective if the market is overreacting to negative news.

Provide a concise, hard-hitting analysis of the provided company data. 

IMPORTANT: You must return the analysis ONLY as a valid JSON object with the exact following schema:
{
  "overview": "Company Overview prose (max 2 paragraphs).",
  "keyMetrics": {
    "Market Cap": "value",
    "Trailing P/E": "value",
    "Operating Margin": "value",
    "Return on Equity": "value",
    "Debt to Equity": "value",
    "Current Price": "value",
    "52-Week Range": "value"
  },
  "deepDive": "Deep dive into operational efficacy and financials (1-2 paragraphs).",
  "redFlags": [
    "Array of critical risks or red flags, especially around Free Cash Flow if it is N/A or low"
  ]
}
Return ONLY valid JSON. No markdown formatting outside the JSON keys, no backticks.
`;

    const formatMetric = (num: any, isPercent: boolean = false) => {
      if (num === null || num === undefined) return 'N/A';
      const val = Number(num);
      if (isNaN(val)) return 'N/A';

      const absVal = Math.abs(val);
      if (absVal >= 1e12) return (val / 1e12).toFixed(2) + 'T';
      if (absVal >= 1e9) return (val / 1e9).toFixed(2) + 'B';
      if (absVal >= 1e6) return (val / 1e6).toFixed(2) + 'M';

      if (isPercent) return (val * 100).toFixed(2) + '%';
      return val.toFixed(2);
    };

    const userPrompt = `Analyze the following company data for ${ticker}:
Company Profile: ${profile?.longBusinessSummary?.substring(0, 800) || 'N/A'}
Sector: ${profile?.sector || 'N/A'}
Industry: ${profile?.industry || 'N/A'}
Market Cap: ${formatMetric(price?.marketCap ?? summary?.marketCap)}
Trailing P/E: ${formatMetric(summary?.trailingPE)}
Free Cash Flow: ${formatMetric(financials?.freeCashflow)}
Operating Margin: ${formatMetric(financials?.operatingMargins, true)}
Return on Equity: ${formatMetric(financials?.returnOnEquity, true)}
Debt to Equity: ${formatMetric(financials?.debtToEquity)}
Current Price: $${formatMetric(price?.regularMarketPrice)}
52-Week High: $${formatMetric(summary?.fiftyTwoWeekHigh)}
52-Week Low: $${formatMetric(summary?.fiftyTwoWeekLow)}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // Aggressive model choice per prompt instructions (can be adjusted)
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "No analysis generated.";

    res.json({ analysis });

  } catch (error: any) {
    logToFile(`Error generating AI analysis: ${error.message}`);
    console.error('Error generating AI analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// Autonomous Agent Endpoint
app.get('/api/research/autonomous/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    logToFile(`Spawning autonomous python agent for ${ticker}...`);

    const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
    const pythonArgs = process.platform === 'win32'
      ? ['-3.12', 'agent_research/main.py', ticker]
      : ['agent_research/main.py', ticker];

    const pythonProcess = spawn(pythonCmd, pythonArgs, {
      cwd: process.cwd(),
      env: { ...process.env }
    });

    let pdfPath = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[Python Agent] ${output.trim()}`);

      const match = output.match(/FINAL_PDF_PATH:(.*)/);
      if (match && match[1]) {
        pdfPath = match[1].trim();
      }
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      console.error(`[Python Agent ERR] ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code: number) => {
      if (code !== 0) {
        logToFile(`Python agent exited with code ${code}`);
        return res.status(500).json({ error: 'Agent execution failed.' });
      }
      if (pdfPath) {
        res.download(pdfPath);
      } else {
        res.status(500).json({ error: 'PDF was not generated.' });
      }
    });

  } catch (error: any) {
    logToFile(`Error spawning python agent: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Generic Symbol Search API (Yahoo Finance + Finnhub fallback + Direct ticker synthesis)
app.get('/api/research/search', async (req, res) => {
  const query = (req.query.query as string || '').trim();
  if (!query) return res.json([]);
  logToFile(`Searching ticker for query: "${query}"`);

  let results: any[] = [];

  // 1. Try Yahoo Finance with a 4s timeout
  try {
    const searchPromise = yahooFinance.search(query, { newsCount: 0, quotesCount: 10 }) as Promise<any>;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Yahoo search timeout')), 4000));
    const searchData: any = await Promise.race([searchPromise, timeoutPromise]);
    const quotes = searchData?.quotes || [];

    results = quotes
      .filter((q: any) => q && q.symbol && typeof q.symbol === 'string')
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.name || q.symbol,
        currency: 'USD',
        stockExchange: q.exchange || q.exchDisp || 'N/A',
        exchangeShortName: q.exchDisp || q.exchange || 'N/A'
      }));
  } catch (err: any) {
    logToFile(`Yahoo search error for "${query}": ${err?.message || err}`);
  }

  // 2. If Yahoo Finance returned 0 results or failed, try Finnhub fallback
  if (results.length === 0) {
    const finnhubKey = process.env.VITE_FINNHUB_API_KEY || process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      try {
        logToFile(`Trying Finnhub search fallback for "${query}"...`);
        const fhRes = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${finnhubKey}`);
        if (fhRes.ok) {
          const data: any = await fhRes.json();
          if (data?.result && Array.isArray(data.result)) {
            results = data.result
              .filter((r: any) => r && r.symbol && !r.symbol.includes('.'))
              .slice(0, 10)
              .map((r: any) => ({
                symbol: r.symbol,
                name: r.description || r.displaySymbol || r.symbol,
                currency: 'USD',
                stockExchange: r.type || 'US',
                exchangeShortName: r.type || 'US'
              }));
          }
        }
      } catch (fhErr: any) {
        logToFile(`Finnhub search error for "${query}": ${fhErr?.message || fhErr}`);
      }
    }
  }

  // 3. If still empty, but query looks like a valid ticker symbol (e.g. "AAPL", "MSFT", "BTC-USD")
  if (results.length === 0 && /^[A-Za-z0-9\.\-\=]{1,10}$/.test(query)) {
    const cleanSym = query.toUpperCase();
    results = [{
      symbol: cleanSym,
      name: cleanSym,
      currency: 'USD',
      stockExchange: 'US',
      exchangeShortName: 'US'
    }];
  }

  res.json(results);
});

// Helper to fetch enriched fundamental data for a single symbol
async function fetchEnrichedSymbolData(symbol: string) {
  const cleanSymbol = symbol.trim().toUpperCase();
  try {
    const summary = await yahooFinance.quoteSummary(cleanSymbol, {
      modules: ['price', 'summaryProfile', 'defaultKeyStatistics', 'financialData', 'summaryDetail']
    });

    const price = summary?.price;
    const profile = summary?.summaryProfile;
    const stats = summary?.defaultKeyStatistics;
    const financials = summary?.financialData;
    const detail = summary?.summaryDetail;

    return {
      symbol: cleanSymbol,
      name: price?.shortName || price?.longName || cleanSymbol,
      price: price?.regularMarketPrice ?? 0,
      change: price?.regularMarketChange ?? 0,
      changePercent: price?.regularMarketChangePercent ?? 0,
      sector: profile?.sector || 'General',
      industry: profile?.industry || 'N/A',
      marketCap: price?.marketCap ?? detail?.marketCap ?? null,
      pe: detail?.trailingPE ?? detail?.forwardPE ?? null,
      ps: detail?.priceToSalesTrailing12Months ?? null,
      eps: stats?.trailingEps ?? stats?.forwardEps ?? null,
      operatingMargin: financials?.operatingMargins ?? null,
      roe: financials?.returnOnEquity ?? null,
      debtToEquity: financials?.debtToEquity ?? null,
      fiftyTwoWeekHigh: detail?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: detail?.fiftyTwoWeekLow ?? null,
      volume: detail?.volume ?? price?.regularMarketVolume ?? null,
      error: null
    };
  } catch (err: any) {
    logToFile(`Enrichment failed for ${cleanSymbol}: ${err.message}`);
    return {
      symbol: cleanSymbol,
      name: cleanSymbol,
      price: 0,
      change: 0,
      changePercent: 0,
      sector: 'N/A',
      industry: 'N/A',
      marketCap: null,
      pe: null,
      ps: null,
      eps: null,
      operatingMargin: null,
      roe: null,
      debtToEquity: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      volume: null,
      error: err.message
    };
  }
}

// GET /api/watchlists - Fetch all watchlists (create default if empty)
app.get('/api/watchlists', async (req, res) => {
  try {
    let watchlists = await prisma.watchlist.findMany({
      include: {
        items: {
          orderBy: { addedAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (watchlists.length === 0) {
      // Seed a default watchlist
      const defaultWatchlist = await prisma.watchlist.create({
        data: {
          name: 'Main Watchlist',
          isDefault: true,
          items: {
            create: [
              { symbol: 'AAPL' },
              { symbol: 'NVDA' },
              { symbol: 'MSFT' },
              { symbol: 'TSLA' },
              { symbol: 'AMZN' },
              { symbol: 'ORA' }
            ]
          }
        },
        include: {
          items: true
        }
      });
      watchlists = [defaultWatchlist];
    }

    res.json(watchlists);
  } catch (error: any) {
    logToFile(`Error fetching watchlists: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/watchlists - Create a new watchlist
app.post('/api/watchlists', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Watchlist name is required.' });
    }

    const newWatchlist = await prisma.watchlist.create({
      data: {
        name: name.trim(),
        isDefault: false
      },
      include: {
        items: true
      }
    });

    res.status(201).json(newWatchlist);
  } catch (error: any) {
    logToFile(`Error creating watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/watchlists/:id - Rename a watchlist
app.put('/api/watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Watchlist name is required.' });
    }

    const updated = await prisma.watchlist.update({
      where: { id },
      data: { name: name.trim() },
      include: { items: true }
    });

    res.json(updated);
  } catch (error: any) {
    logToFile(`Error updating watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/watchlists/:id - Delete a watchlist
app.delete('/api/watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.watchlist.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Watchlist deleted successfully.' });
  } catch (error: any) {
    logToFile(`Error deleting watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/watchlists/:id/symbols - Add symbol to watchlist
app.post('/api/watchlists/:id/symbols', async (req, res) => {
  try {
    const { id } = req.params;
    const { symbol } = req.body;
    if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
      return res.status(400).json({ error: 'Symbol is required.' });
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    // Check if already in watchlist
    const existing = await prisma.watchlistItem.findUnique({
      where: {
        watchlistId_symbol: {
          watchlistId: id,
          symbol: cleanSymbol
        }
      }
    });

    if (existing) {
      return res.json({ success: true, item: existing, message: 'Symbol already in watchlist.' });
    }

    const item = await prisma.watchlistItem.create({
      data: {
        watchlistId: id,
        symbol: cleanSymbol
      }
    });

    res.status(201).json({ success: true, item });
  } catch (error: any) {
    logToFile(`Error adding symbol to watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/watchlists/:id/symbols/:symbol - Remove symbol from watchlist
app.delete('/api/watchlists/:id/symbols/:symbol', async (req, res) => {
  try {
    const { id, symbol } = req.params;
    const cleanSymbol = symbol.trim().toUpperCase();

    await prisma.watchlistItem.deleteMany({
      where: {
        watchlistId: id,
        symbol: cleanSymbol
      }
    });

    res.json({ success: true, message: 'Symbol removed from watchlist.' });
  } catch (error: any) {
    logToFile(`Error removing symbol from watchlist: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/watchlists/:id/data - Fetch enriched real-time and fundamental data for all symbols
app.get('/api/watchlists/:id/data', async (req, res) => {
  try {
    const { id } = req.params;
    const watchlist = await prisma.watchlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { addedAt: 'asc' }
        }
      }
    });

    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found.' });
    }

    // Fetch data for all symbols in parallel
    const enrichedItems = await Promise.all(
      watchlist.items.map(async (item) => {
        const enriched = await fetchEnrichedSymbolData(item.symbol);
        return {
          id: item.id,
          watchlistId: item.watchlistId,
          addedAt: item.addedAt,
          ...enriched
        };
      })
    );

    res.json({
      watchlist: {
        id: watchlist.id,
        name: watchlist.name,
        isDefault: watchlist.isDefault,
        createdAt: watchlist.createdAt
      },
      items: enrichedItems
    });
  } catch (error: any) {
    logToFile(`Error fetching watchlist data: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

const server = app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down server...');

  server.close(() => {
    console.log('HTTP server closed.');
  });

  if (isConnected && ib) {
    try {
      console.log('Disconnecting from IBKR...');
      ib.disconnect();
    } catch (e) {
      console.error('Error disconnecting IBKR:', e);
    }
  }

  try {
    await prisma.$disconnect();
    console.log('Database disconnected.');
  } catch (e) {
    console.error('Error disconnecting database:', e);
  }

  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
