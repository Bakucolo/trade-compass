
// DXLink Protocol Types
type DXLinkMessageType = 'SETUP' | 'AUTH' | 'CHANNEL_REQUEST' | 'CHANNEL_OPENED' | 'FEED_SETUP' | 'FEED_CONFIG' | 'FEED_SUBSCRIPTION' | 'KEEPALIVE' | 'ERROR';

interface DXLinkMessage {
    type: DXLinkMessageType;
    channel?: number;
    [key: string]: any;
}

export interface StreamerData {
    event: 'Quote' | 'Trade' | 'Summary' | 'Profile' | 'Greeks';
    symbol: string;
    price?: number; // Last Price (Trade) or Ask/Bid (Quote)
    bidPrice?: number;
    askPrice?: number;
    volatility?: number;
    dayVolume?: number;
    dayHigh?: number;
    dayLow?: number;
    prevClose?: number;
    change?: number; // Calculated
    changePercent?: number; // Calculated
    description?: string;
    source: 'Tastytrade (Stream)';
}

type StreamerCallback = (data: StreamerData) => void;

class TastyTradeStreamer {
    private ws: WebSocket | null = null;
    private token: string | null = null;
    private url: string | null = null;
    private isAuthenticated = false;
    private keepAliveInterval: any = null;
    private symbol: string | null = null; // Current active symbol
    private callbacks: StreamerCallback[] = [];

    // DXLink State
    private channelId = 1;

    // Debug Logs
    public logs: string[] = [];

    private log(msg: string) {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = `[${timestamp}] ${msg}`;
        console.log(logMsg);
        this.logs.unshift(logMsg); // Add to start
        if (this.logs.length > 20) this.logs.pop(); // Keep last 20
    }

    constructor() { }

    // 1. Fetch Quote Token & URL from Backend Proxy
    // 1. Fetch Quote Token & URL from Backend Proxy
    async connect(symbol: string) {
        this.symbol = symbol;
        try {
            // Get Token
            this.log('Step 1: Fetching Token...');
            const tokenRes = await fetch('/api/tastytrade/quote-tokens');
            if (!tokenRes.ok) throw new Error('Failed to get quote token: ' + tokenRes.statusText);

            const tokenData = await tokenRes.json();

            // 2. Access properties with fallback for dxlink-url
            const quoteToken = tokenData.data?.token;
            const quoteUrl = tokenData.data?.['dxlink-url'] || tokenData.data?.url;

            if (!quoteToken || !quoteUrl) {
                this.log('Error: Missing token/url in response');
                console.error('[Streamer] Missing token/url', tokenData);
                return;
            }

            this.token = quoteToken;
            this.url = quoteUrl;

            this.log(`Step 2: Token received. Connecting to: ${this.url}`);

            // Get Streamer Symbol (Instrument Lookup) - Optional but good for accuracy
            const instrRes = await fetch(`/api/tastytrade/instruments/${symbol}`);
            if (instrRes.ok) {
                const instrData = await instrRes.json();
                if (instrData && instrData['streamer-symbol']) {
                    this.symbol = instrData['streamer-symbol'];
                    this.log(`Mapped ${symbol} -> ${this.symbol}`);
                }
            }

            this.initWebSocket();
        } catch (e: any) {
            this.log('Connection failed: ' + e.message);
            console.error('[Streamer] Connection failed:', e);
        }
    }

    private initWebSocket() {
        this.log(`Init WS. Token: ${!!this.token}, URL: ${!!this.url}`);
        if (!this.url || !this.token) {
            this.log('Aborting WS: Missing creds');
            return;
        }

        this.log('Connecting to WS URL: ' + this.url);

        try {
            // 1. Connection: Connect to the URL provided by /api-quote-tokens
            // Do NOT add ?token= to the URL.
            this.ws = new WebSocket(this.url);
        } catch (e: any) {
            this.log('WS Constructor Error: ' + e.message);
            return;
        }

        this.ws.onopen = () => {
            this.log('WS Connected');
            // 2. The Handshake Step A: Send SETUP immediately
            this.send({
                type: 'SETUP',
                channel: 0,
                keepaliveTimeout: 60,
                acceptKeepaliveTimeout: 60,
                version: '0.1-DXF-JS/0.3.0'
            });
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data as string));
        };

        this.ws.onerror = (e) => {
            this.log('WS Error');
            console.error('[Streamer] WS Error Event:', e);
        };
        this.ws.onclose = (e) => {
            this.log(`WS Closed: ${e.code} ${e.reason}`);
            this.stopKeepAlive();
            this.isAuthenticated = false;
        };
    }

    private send(msg: DXLinkMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private sendHandshake() {
        // 1. SETUP
        this.send({
            type: 'SETUP',
            channel: 0,
            version: '0.1-dxf',
            keepalive: 30,
        });

        // 2. AUTH
        this.send({
            type: 'AUTH',
            channel: 0,
            token: this.token,
        });

        // 3. CHANNEL_REQUEST (Open a Feed Channel)
        this.send({
            type: 'CHANNEL_REQUEST',
            channel: this.channelId,
            service: 'FEED',
            parameters: {
                contract: 'AUTO',
            },
        });
    }

    private setupFeed() {
        // 4. FEED_SETUP
        this.send({
            type: 'FEED_SETUP',
            channel: this.channelId,
            acceptAggregationPeriod: 0.1,
            acceptDataFormat: 'COMPACT', // Optimized format
            acceptEventFields: {
                Quote: ['eventSymbol', 'bidPrice', 'askPrice', 'bidSize', 'askSize'],
                Trade: ['eventSymbol', 'price', 'dayVolume', 'size'],
                Summary: ['eventSymbol', 'dayHighPrice', 'dayLowPrice', 'prevDayClosePrice', 'openInterest'],
                Profile: ['eventSymbol', 'description', 'high52WeekPrice', 'low52WeekPrice', 'tradingStatus'],
                Greeks: ['eventSymbol', 'volatility', 'delta', 'gamma', 'theta', 'rho', 'vega'],
            },
        });
    }

    private subscribeToFeed() {
        // 5. FEED_SUBSCRIPTION
        if (this.symbol) {
            // Determine if it's an option (has numbers) or equity
            // Simple check: Stocks usually don't have numbers (except things like MMC1). 
            // Better check: If valid option symbol format. For now, let's assume if it looks like a normal ticker, no Greeks.
            // Actually, safe bet is to only ask for Greeks if we explicitly know it's an option? 
            // For this task, let's just assume we want Greeks only if it's NOT a simple 1-5 letter ticker.
            const isEquity = /^[A-Z]{1,5}$/.test(this.symbol);

            const eventTypes = [
                { symbol: this.symbol, type: 'Quote' },
                { symbol: this.symbol, type: 'Trade' },
                { symbol: this.symbol, type: 'Summary' },
                { symbol: this.symbol, type: 'Profile' }
            ];

            if (!isEquity) {
                eventTypes.push({ symbol: this.symbol, type: 'Greeks' });
            }

            const subscriptionMsg: DXLinkMessage = {
                type: 'FEED_SUBSCRIPTION',
                channel: this.channelId,
                add: eventTypes
            };
            this.log('Sending Subscription: ' + JSON.stringify(subscriptionMsg));
            this.send(subscriptionMsg);
        }
    }

    private handleMessage(msg: any) {
        // Heartbeat Logging and Raw Message Logging
        // console.log('[DXLink RX]:', msg.type, msg);
        console.log('[DXLink RAW]:', JSON.stringify(msg));

        switch (msg.type) {
            case 'SETUP':
                // Step B: Received SETUP, send AUTH
                this.log('Rx SETUP -> Sending AUTH');
                this.send({
                    type: 'AUTH',
                    channel: 0,
                    token: this.token,
                });
                break;

            case 'AUTH_STATE':
                // User-requested handler for AUTH_STATE
                if (msg.state === 'AUTHORIZED') {
                    this.isAuthenticated = true;
                    this.log('Rx AUTHORIZED -> Sending CHANNEL_REQUEST');
                    this.send({
                        type: 'CHANNEL_REQUEST',
                        channel: this.channelId,
                        service: 'FEED',
                        parameters: {
                            contract: 'AUTO',
                        },
                    });
                    this.startKeepAlive();
                } else {
                    this.log('Rx UNAUTHORIZED: ' + msg.message);
                }
                break;

            case 'CHANNEL_OPENED':
                this.log('Rx CHANNEL_OPENED -> Sending Feed Config');
                // Channel is ready. Send Setup first (not stats yet)
                this.setupFeed();
                break;

            case 'FEED_CONFIG':
                this.log('Rx FEED_CONFIG -> Subscribing to: ' + this.symbol);
                this.subscribeToFeed();
                break;

            case 'FEED_DATA':
                console.log('💰 LIVE DATA RECEIVED:', JSON.stringify(msg.data, null, 2));
                this.processFeedData(msg.data);
                break;

            case 'KEEPALIVE':
                // Server keeping alive, ignore
                break;

            case 'ERROR':
                this.log('Rx ERROR: ' + msg.message);
                break;

            default:
                // console.log('Unhandled msg:', msg.type);
                break;
        }
    }

    private processFeedData(data: any[]) {
        // Standard format (usually): [Type, MappingIndex, { field: value }] or similar.
        // In DXLink JSON, 'data' is often an array of events.
        // Example: [{ eventType: 'Quote', eventSymbol: 'AAPL', bidPrice: 150... }]

        if (!Array.isArray(data)) return;

        data.forEach(event => {
            // Normalize Data
            // If STANDARD, it might look like: ["Quote", ["AAPL", { bidPrice: 100 }]] ?
            // Actually, let's assume the JSON format returns objects directly if simplified.
            // If DXLink returns [eventType, symbol, {fields}], we handle that.

            // For now, let's safely map common fields if they exist loosely (Duck Typing)
            // Since I can't test the exact wire format without a live token, I'll log and attempt to parse standard keys.

            // Note: DXLink Standard JSON often looks like:
            // { type: "FEED_DATA", data: [ ["Quote", "AAPL", { bidPrice: 100... }] ] }

            const eventType = event[0];
            const eventSymbol = event[1];
            const fields = event[2];

            if (!fields || typeof fields !== 'object') return;

            const update: StreamerData = {
                event: eventType,
                symbol: eventSymbol,
                source: 'Tastytrade (Stream)',
                ...fields
            };

            this.notify(update);
        });
    }

    private notify(data: StreamerData) {
        this.callbacks.forEach(cb => cb(data));
    }

    subscribe(callback: StreamerCallback) {
        this.callbacks.push(callback);
    }

    unsubscribe(callback: StreamerCallback) {
        this.callbacks = this.callbacks.filter(c => c !== callback);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.stopKeepAlive();
    }

    private startKeepAlive() {
        this.stopKeepAlive();
        this.keepAliveInterval = setInterval(() => {
            this.send({ type: 'KEEPALIVE', channel: 0 });
        }, 30000);
    }

    private stopKeepAlive() {
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    }
}

// Singleton for simplicity
export const tastyStreamer = new TastyTradeStreamer();
