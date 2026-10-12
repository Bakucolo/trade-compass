import { sendTelegramMessage } from './telegramReportService';

export type TelegramTopicType =
  | 'BALANCES'
  | 'POSITIONS'
  | 'WATCHLIST'
  | 'NOTES'
  | 'EXECUTION'
  | 'IDEAS'
  | 'ALERTS'
  | 'APP'
  | 'GENERAL';

/**
 * Checks if incoming text is a help request or instructions inquiry
 */
export function isTopicHelpRequest(rawText: string): boolean {
  if (!rawText) return false;
  const trimmed = rawText.trim();
  if (trimmed === '?' || trimmed === '??' || trimmed === '???') return true;

  const clean = trimmed
    .toLowerCase()
    .replace(/^(?:💼|📋|📝|🎯|💡|🔔|🏦|💰|💵|💳)\s*/, '')
    .replace(/^[/#]+/, '')
    .replace(/[?!.]+$/, '')
    .trim();

  // Exact keywords
  if (/^(help|commands?|usage|info|\?|guide|instructions?)$/i.test(clean)) {
    return true;
  }

  // Common phrases
  if (
    /^(?:help\s+me|help\s+here|topic\s+help|topic\s+guide|how\s+to\s+use|how\s+does\s+this\s+work|what\s+can\s+i\s+(?:do|ask)(?:\s+here)?|what\s+are\s+the\s+commands)\??$/i.test(clean)
  ) {
    return true;
  }

  return false;
}

/**
 * Returns formatted instructions for POSITIONS topic
 */
export function getPositionsTopicHelp(): string {
  return `💼 *Positions Topic — Instructions & Commands*

Track and analyze your live positions across all connected brokers (*Tastytrade*, *Trading 212*, *Interactive Brokers*):

🔍 *1. Specific Ticker Lookup*
Ask for any stock or option position:
• \`AAPL\` or \`$NVDA\` — View shares, option contracts, average cost, spot, market value & unrealized P&L.
• \`positions in PLTR\` or \`show MSFT\`
• \`do I have TSLA?\` or \`how many AMZN shares\`
• \`AAPL options\` or \`NVDA calls\` — Filter options specifically for that ticker.

⚡ *2. Asset Classes*
Get a unified view of all open positions in an asset class:
• \`options\` (or \`all options\`, \`contracts\`, \`calls\`, \`puts\`)
  _Lists every active option contract across brokers with strike, expiry, long/short, mark prices, and total options P&L._
• \`equities\` (or \`stocks\`, \`shares\`, \`all stocks\`)
  _Lists every stock holding across brokers with cost basis, spot prices, and total equities P&L._

🏛️ *3. Broker Portfolios*
Inspect positions by brokerage account:
• \`brokers\` (or \`portfolio\`, \`summary\`, \`all\`) — Grand portfolio summary across all accounts.
• \`tastytrade\` (or \`tasty\`) — Positions in Tastytrade.
• \`trading 212\` (or \`t212\`) — Positions in Trading 212.
• \`ibkr\` (or \`interactive brokers\`) — Positions in Interactive Brokers.

💡 _All amounts and P&L are aggregated across connected brokers in real-time._`;
}

/**
 * Returns formatted instructions for WATCHLIST topic
 */
export function getWatchlistTopicHelp(): string {
  return `📋 *Watchlist Topic — Instructions & Commands*

Create, query, and filter your Trade Compass watchlists:

📊 *1. View All Watchlists*
• \`all watchlists\` or \`watchlists\` / \`list\` / \`all\`
_Lists all watchlists with stock counts, top holdings, and quick filters._

🎯 *2. Filter Watchlist with Criteria*
Query stocks in a watchlist with financial filters:
• \`[Watchlist Name] [Criteria]\`
• \`Semiconductors PE < 30\`
• \`Nuclear Energy price < $50\`
• \`Tech green\` or \`Tech up > 2%\` _(stocks up today)_
• \`AI Stocks red\` or \`AI Stocks dip\` _(stocks down today)_
• \`Growth mcap > 100B\`
• \`Value lowest pe\` or \`Tech top 5 best performers\`

➕ *3. Add Stocks to a Watchlist*
• \`[Watchlist Name] [TICKERS...]\`
• Example: \`Semiconductors NVDA TSM ASML ARM\`
_If the watchlist does not exist, it will be automatically created!_

🤖 *4. AI Thematic Watchlist Agent*
Send just a sector or theme name, and the AI Research Agent will curate 5–8 high-conviction US equities with investment theses:
• \`Quantum Computing\`
• \`Space Tech\`
• \`Cybersecurity Pure Plays\`
• \`Robotics & Automation\``;
}

/**
 * Returns formatted instructions for NOTES topic
 */
export function getNotesTopicHelp(): string {
  return `📝 *Notes Topic — Instructions & Commands*

Save persistent notes, investment theses, and DD on any stock:

✍️ *How to Save a Note*
Start your message with the ticker symbol, followed by your note:
• \`AAPL Great earnings beat, services revenue up 14%. Holding core position.\`
• \`$NVDA Blackwell ramp accelerated, data center demand unbroken. Target $160.\`
• \`PLTR Government pipeline solid, watching support at $55.\`
• \`TSLA FSD v13 rollout catalysts, risk reward favorable here.\`

✨ *What Happens When You Save:*
1. 📌 *Pinned in App*: The note is saved to the stock's profile in Trade Compass.
2. 🔍 *Instant Lookup*: Whenever you search or view the ticker in Trade Compass (Research, Quotes, Dashboard), your notes appear automatically.
3. 🚥 *Sentiment Detection*: Automatically tags sentiment (🟢 Bullish, 🔴 Bearish, 🟡 Caution, ⚪ Neutral).
4. ⏳ *History Preserved*: Subsequent notes append with timestamps, creating a running trade journal for each stock.`;
}

/**
 * Returns formatted instructions for EXECUTION topic
 */
export function getExecutionTopicHelp(): string {
  return `🎯 *Execution Topic — Tactical Queue Instructions*

Queue tactical trade ideas, orders, and option structures directly into Trade Compass:

📈 *1. Equity Orders*
• \`BUY 100 AAPL @ 220 SL 210 TP 245\`
• \`SELL 50 NVDA @ 140\`
• \`BUY 200 PLTR MKT SL 52\`

⚡ *2. Options & Multi-Leg Strategies*
• \`BTO 2 AAPL 230C 01/17 @ 5.50\`
• \`STO 1 NVDA 120P 03/21 @ 3.20\`
• \`Covered Call AAPL 230C Jan 17\`
• \`Cash Secured Put TSLA 200P\`
• \`Bull Call Spread NVDA 130/140C\`

🛡️ *Parameters Supported:*
• *Action*: \`BUY\`, \`SELL\`, \`BTO\` (Buy to Open), \`STO\` (Sell to Open), \`Covered Call\`, \`Put\`
• *Quantity & Price*: \`@ 150\` or \`MKT\` (Market order)
• *Stop Loss*: \`SL 140\` or \`stop 140\`
• *Take Profit / Target*: \`TP 170\` or \`target 170\`
• *Timeframe*: \`DAY\`, \`WEEK\`, or \`SWING\`

_All orders are parsed and queued into the Tactical Execution Queue in Trade Compass with automatic risk parameters._`;
}

/**
 * Returns formatted instructions for IDEAS topic
 */
export function getIdeasTopicHelp(): string {
  return `💡 *Ideas Topic — Market Theses & DD Instructions*

Log market thoughts, earnings catalysts, macro theses, and watch opportunities:

🧠 *What to Share:*
• *Earnings Catalysts*: \`Bullish into AMD earnings given datacenter GPU upside.\`
• *Macro Theses*: \`Watching crude oil $USO curve backwardation, energy supply shock potential.\`
• *Trade Ideas*: \`Long $CCJ uranium pure-play on nuclear utility contract renewals.\`

✨ *Features:*
• 🏷️ *Ticker Linking*: Automatically detects \`$TICKER\` mentions and links them for 1-click lookup in Trade Compass.
• 📊 *Market Telemetry*: Retrieves live quotes and telemetry for mentioned symbols.
• 📋 *Watchlist Sync*: Add \`#watchlist\` or \`watchlist: Name\` in your message to automatically add the tickers to a watchlist!
• 📁 *Repository*: Saved into the *Ideas* folder in Trade Compass ThoughtLog.`;
}

/**
 * Returns formatted instructions for ALERTS topic
 */
export function getAlertsTopicHelp(): string {
  return `🔔 *Alerts Topic — Price Alerts Instructions*

Arm instant real-time price alerts monitored 24/7 by the system:

🎯 *How to Set Alerts:*
• \`Alert NVDA above $145\`
• \`Alert AAPL below $215\`
• \`Notify me when PLTR hits $60\`
• \`TSLA > 250\`
• \`AMD < 130\`

⚡ *Alert Features:*
• 📈 *Direction Detection*: Automatically recognizes above (▲) or below (▼) conditions.
• 📲 *Instant Dispatch*: When the price triggers, a Telegram alert and browser notification fire immediately.
• 🔕 *Bracket Arms*: Automatically tracks target levels until triggered or updated.`;
}

/**
 * Returns formatted instructions for APP topic
 */
export function getAppTopicHelp(): string {
  return `💡 *App Topic — Feature Requests & Feedback Instructions*

Submit feature requests, UI improvements, and bug reports directly into the development roadmap:

🛠️ *Categories & Syntax:*
• \`[UI] Add a dark mode toggle button in header\`
• \`[Portfolio] Show beta-weighted delta across all brokers\`
• \`[Bug] Yahoo finance quote timeout on weekend\`
• \`[Data] Add commodities forward curves to Macro section\`
• \`Add a shortcut for covered call harvesting\`

✨ *Features:*
• 🗂️ *Categorization*: Auto-categorized into UI/UX, Feature, Bug, Data, or Integration.
• 📌 *Roadmap Tracking*: Stored in the Trade Compass App Ideas Backlog.`;
}

/**
 * Returns formatted instructions for BALANCES topic
 */
export function getBalancesTopicHelp(): string {
  return `🏦 *Balances Topic — Instructions & Commands*

Query cash, buying power, margins, and account balances across all connected brokers (*Tastytrade*, *Trading 212*, *Interactive Brokers*):

📊 *1. General Portfolio Overview*
• \`balances\` (or \`all\`, \`summary\`, \`portfolio\`)
  _Displays Net Liquidation Value, Cash, Option/Equity Buying Power, Maintenance Margin, and Margin Cushion across all brokers and combined grand totals._

🏛️ *2. Broker Breakdowns*
• \`tastytrade\` (or \`tasty\`) — Option & Equity Buying Power, Cash, Maintenance Margin Requirement, and Margin Cushion for Tastytrade.
• \`ibkr\` (or \`interactive brokers\`) — Available Funds, Buying Power, Maintenance Margin, and Net Liq for Interactive Brokers.
• \`trading 212\` (or \`t212\`) — Invested Capital, Free Cash (Buying Power), and Portfolio Value in GBP & USD.

💵 *3. Specific Metric Inquiries*
• \`cash\` (or \`free cash\`, \`available cash\`) — Cash balance breakdown per broker and total liquidity.
• \`margins\` (or \`maintenance margin\`, \`cushion\`, \`utilization\`) — Margin requirement and risk safety cushion per broker and portfolio health.
• \`buying power\` (or \`bp\`, \`purchasing power\`) — Total derivative & equity purchasing capacity.

💡 _Data reflects real-time broker sync and exchange rates._`;
}

/**
 * Returns general overview directory across all topics
 */
export function getGeneralTopicDirectoryHelp(): string {
  return `🧭 *Trade Compass Telegram Assistant — Topic Directory*

This Telegram group has dedicated topics tailored to your trading workflows:

• 🏦 *Balances*: Query cash, buying power, margins, and cushion by broker (\`tastytrade\`, \`ibkr\`, \`t212\`) or portfolio-wide (\`balances\`, \`cash\`, \`margins\`).
• 💼 *Positions*: Ask for any ticker (\`AAPL\`, \`$NVDA\`), asset class (\`options\`, \`equities\`), or broker (\`tastytrade\`, \`brokers\`) to see live holdings across all accounts.
• 📋 *Watchlist*: View watchlists (\`all watchlists\`), filter with criteria (\`Semiconductors PE < 30\`), add stocks (\`Tech AAPL NVDA\`), or let the AI Agent create one (\`Quantum Computing\`).
• 📝 *Notes*: Save persistent stock DD (\`AAPL Note here\`) that displays whenever you look up the stock in Trade Compass.
• 🎯 *Execution*: Queue tactical orders (\`BUY 100 AAPL @ 220 SL 210\`) into your execution queue.
• 💡 *Ideas*: Log market theses and catalysts with automatic ticker tracking and telemetry.
• 🔔 *Alerts*: Arm price alerts (\`Alert NVDA above $145\`).
• 💡 *App*: Submit feature ideas and bug reports (\`[UI] Add dark mode\`).

💡 _Type \`help\` inside any topic to get the full detailed instruction manual for that topic!_`;
}

/**
 * Resolves the help instructions for a given topic
 */
export function getHelpMessageForTopic(topic: TelegramTopicType): string {
  switch (topic) {
    case 'BALANCES':
      return getBalancesTopicHelp();
    case 'POSITIONS':
      return getPositionsTopicHelp();
    case 'WATCHLIST':
      return getWatchlistTopicHelp();
    case 'NOTES':
      return getNotesTopicHelp();
    case 'EXECUTION':
      return getExecutionTopicHelp();
    case 'IDEAS':
      return getIdeasTopicHelp();
    case 'ALERTS':
      return getAlertsTopicHelp();
    case 'APP':
      return getAppTopicHelp();
    case 'GENERAL':
    default:
      return getGeneralTopicDirectoryHelp();
  }
}

/**
 * Handles a help request for any topic and dispatches the response to Telegram
 */
export async function handleTopicHelpMessage({
  topic,
  chatId,
  messageThreadId,
}: {
  topic: TelegramTopicType;
  chatId: string | number;
  messageThreadId?: number;
}): Promise<{
  handled: boolean;
  replyText: string;
  topic: TelegramTopicType;
}> {
  const replyText = getHelpMessageForTopic(topic);

  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    await sendTelegramMessage({
      text: replyText,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    }).catch((e: any) => console.log(`[TelegramTopicHelp] Send error: ${e.message}`));
  }

  return {
    handled: true,
    replyText,
    topic,
  };
}
