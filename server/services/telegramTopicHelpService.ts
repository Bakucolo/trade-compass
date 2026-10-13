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
  | 'MACRO'
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
• \`AAPL short options\` or \`NVDA longs\` — Filter short or long option contracts for a ticker.

⚡ *2. Asset Classes & Options Filtering*
Get a unified view of all open positions in an asset class:
• \`options\` (or \`all options\`, \`contracts\`, \`calls\`, \`puts\`)
  _Lists every active option contract across brokers with strike, expiry, DTE, long/short, mark prices, and total options P&L._
• \`short options\` (or \`shorts\`, \`short calls\`, \`short puts\`)
  _Filters specifically for short option positions (sold contracts) across all brokers._
• \`long options\` (or \`longs\`, \`long calls\`, \`long puts\`)
  _Filters specifically for long option positions (bought contracts) across all brokers._
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
/**
 * Returns formatted instructions for NOTES topic
 */
export function getNotesTopicHelp(): string {
  return `📝 *Notes Topic — Instructions & Commands*

Check, manage, and save persistent notes and investment theses for any stock:

🔍 *1. Check / Look Up Saved Notes*
• \`AAPL\` or \`read AAPL\` — View full research note, sentiment, and timestamp for $AAPL.
• \`notes for NVDA\` or \`show PLTR\`

📋 *2. List All Saved Notes*
• \`all notes\` (or \`list\`, \`recent\`, \`notes\`)
  _Displays a directory of all stocks that currently have pinned research notes in Trade Compass._

✍️ *3. Save or Append a Note*
Start your message with the ticker symbol, followed by your thesis:
• \`AAPL Great earnings beat, services revenue up 14%. Holding core position.\`
• \`$NVDA Blackwell ramp accelerated, data center demand unbroken. Target $160.\`
• \`PLTR Government pipeline solid, watching support at $55.\`

🗑️ *4. Delete a Note*
• \`delete note AAPL\` or \`clear note NVDA\` — Removes the saved note from Trade Compass.

✨ *What Happens When You Save:*
1. 📌 *Pinned in App*: Note appears automatically in Trade Compass (Research, Quotes, Dashboard).
2. 🚥 *Sentiment Detection*: Automatically tags sentiment (🟢 Bullish, 🔴 Bearish, 🟡 Caution, ⚪ Neutral).
3. ⏳ *History Preserved*: Subsequent notes append with timestamps, creating a running trade journal.`;
}

/**
 * Returns formatted instructions for EXECUTION topic
 */
export function getExecutionTopicHelp(): string {
  return `🎯 *Execution Topic — Tactical Queue Instructions*

Check, manage, and queue tactical trade ideas, orders, and option structures directly into Trade Compass:

📋 *1. Check Tactical Execution Queue*
• \`queue\` (or \`orders\`, \`pending\`, \`list\`, \`status\`)
  _Displays every active order in the tactical execution queue with entry price, stop loss, take profit, and status._
• \`status AAPL\` or \`order NVDA\` — Check orders specifically for that ticker.

🗑️ *2. Cancel / Remove an Order*
• \`cancel AAPL\` or \`remove NVDA\` — Cancels and removes pending orders from the tactical queue.

📈 *3. Queue Equity Orders*
• \`BUY 100 AAPL @ 220 SL 210 TP 245\`
• \`SELL 50 NVDA @ 140\`
• \`BUY 200 PLTR MKT SL 52\`

⚡ *4. Queue Options & Multi-Leg Strategies*
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

Check and log market thoughts, earnings catalysts, macro theses, and watch opportunities:

📋 *1. Check Recent Ideas*
• \`ideas\` (or \`recent ideas\`, \`list\`, \`recent\`)
  _Displays the latest market theses, catalysts, and tracked stocks logged in Trade Compass._
• \`ideas AAPL\` or \`ideas NVDA\` — Filter logged theses for a specific ticker.

🧠 *2. Log New Market Ideas*
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

Check, arm, and manage instant real-time price alerts monitored 24/7 by the system:

📋 *1. Check Active Alerts*
• \`alerts\` (or \`list\`, \`active\`, \`my alerts\`, \`show alerts\`)
  _Lists every armed price alert with trigger condition (▲ above / ▼ below), spot price, and distance._

🗑️ *2. Cancel / Disarm an Alert*
• \`delete alert NVDA\` or \`cancel alert AAPL\` (or \`clear TSLA\`)
  _Disarms and removes the alert monitor for that stock._

🎯 *3. Arm New Price Alerts*
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

Check the roadmap and submit feature requests, UI improvements, and bug reports directly into development:

📋 *1. Check Open Roadmap & Backlog*
• \`roadmap\` (or \`ideas\`, \`backlog\`, \`list\`, \`status\`)
  _Displays all open feature requests, UI improvements, and bugs currently queued in the Trade Compass backlog._

🛠️ *2. Submit New Ideas or Bugs*
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
• \`ibkr\` (or \`interactive brokers\`) — Complete dual-account overview of both ISA and GIA accounts with partitioned metrics.
• \`isa\` (or \`ibkr isa\`) — Stocks & Shares ISA (\`U14522424\`) cash, net liq, and cash buying power.
• \`gia\` (or \`ibkr gia\`) — Margin GIA (\`U15491236\`) cash, margin buying power, and maintenance requirements.
• \`trading 212\` (or \`t212\`) — Invested Capital, Free Cash (Buying Power), and Portfolio Value in GBP & USD.

💵 *3. Specific Metric Inquiries*
• \`cash\` (or \`free cash\`, \`available cash\`) — Cash balance breakdown per broker and account (including ISA vs GIA).
• \`margins\` (or \`maintenance margin\`, \`cushion\`, \`utilization\`) — Margin requirement and risk safety cushion per broker and portfolio health.
• \`buying power\` (or \`bp\`, \`purchasing power\`) — Total derivative & equity purchasing capacity.

💳 *4. Fees & Commissions Inquiries*
• \`fees\` (or \`fee\`, \`commissions\`) — Multi-timeframe comparison (Today, 7D, 30D, YTD, All-Time) across all broker accounts.
• \`fees 7d\` (or \`fees today\`, \`fees 30d\`, \`fees ytd\`) — Fees and commissions for a specific timeframe.
• \`fees ibkr\` (or \`fees isa\`, \`fees gia\`, \`fees tasty\`) — Fees and commissions for a specific broker or account across all periods.

📈 *5. Dividends & Capital Gains Reports*
• \`dividends\` (or \`capital gains\`, \`gains\`, \`pnl\`, \`dividends and gains\`) — Comprehensive report of cash dividends received, realized capital gains, open unrealized P&L, and net return across all brokers and timeframes.
• \`dividends 30d\` (or \`gains ytd\`, \`pnl 7d\`, \`dividends all\`) — Focus on a specific timeframe.
• \`dividends isa\` (or \`gains gia\`, \`tastytrade pnl\`, \`t212 gains\`) — Performance breakdown for a specific broker or account.

📄 *6. Nicely Styled PDF Briefing Document*
• Include the word \`pdf\` in any inquiry (e.g. \`pdf\`, \`dividend pdf\`, \`gains pdf\`, \`pnl pdf\`, \`balances pdf\`, \`30d pdf\`) to receive an executive institutional PDF document sent directly to this topic!

💡 _Data reflects real-time broker sync, transaction ledgers, and live exchange rates._`;
}

/**
 * Returns formatted instructions for MACRO topic
 */
export function getMacroTopicHelp(): string {
  return `🌐 *Macro Topic — Instructions & Commands*

Query the complete institutional macro dossier or specific items from the Trade Compass app:

🔍 *1. Specific Macro Items & Sections*
• \`regime\` or \`score\` — Macro stability score (0-100), growth, inflation & policy stances.
• \`yields\` or \`rates\` — 10Y yield, 2Y yield, 2s10s curve spread, fed funds rate & inversion status.
• \`volatility\` or \`vix\` — Spot VIX, VVIX, term structure, skew & volatility risk premium (VRP).
• \`pillars\` or \`7 pillars\` — The 7 Deep-Dive Pillars breakdown (yields, labor, inflation, liquidity, corporate, volatility, commodities).
• \`labor pillar\` / \`inflation pillar\` — Single pillar detailed focus.
• \`scenarios\` — 3 Probabilistic Scenarios (Base, Bull Reflation, Bear Shock) with %, triggers, winners, losers & actions.
• \`allocations\` — Cross-asset tactical allocations (Equities, Fixed Income, Commodities, Currencies/Cash, Derivatives & Hedging).
• \`catalysts\` or \`radar\` — Upcoming high-impact events (FOMC, CPI, NFP) & critical pivot levels.
• \`gold\` or \`commodities\` — Gold regime, crude oil, DXY & commodity forward structures.
• \`sectors\` or \`trends\` — 11 sector momentums, leading vs lagging asset rotation.

📑 *2. Whole Report*
• \`report\`, \`macro\`, \`dossier\`, \`all\`, or \`overview\` — Complete executive briefing across all indicators.

📄 *3. Nicely Styled PDF Document*
• Include the word \`pdf\` in any message (e.g. \`pdf\`, \`macro pdf\`, \`scenarios pdf\`, \`allocations pdf\`, \`regime pdf\`) to receive a styled 2-page institutional PDF document directly here in Telegram!

💡 _Data synthesizes live FRED data, sovereign yield curves, options skew, and autonomous AI analysis._`;
}

/**
 * Returns general overview directory across all topics
 */
export function getGeneralTopicDirectoryHelp(): string {
  return `🧭 *Trade Compass Telegram Assistant — Topic Directory*

This Telegram group has dedicated topics tailored to your trading workflows:

• 🏦 *Balances*: Query cash, buying power, margins, fees, and cushion by broker (\`tastytrade\`, \`ibkr\`, \`isa\`, \`gia\`, \`t212\`) or portfolio-wide (\`balances\`, \`cash\`, \`fees\`, \`margins\`).
• 💼 *Positions*: Ask for any ticker (\`AAPL\`, \`$NVDA\`), asset class (\`options\`, \`short options\`, \`long options\`, \`equities\`), or broker (\`tastytrade\`, \`brokers\`) to see live holdings.
• 📋 *Watchlist*: View watchlists (\`all watchlists\`), filter with criteria (\`Semiconductors PE < 30\`), add stocks (\`Tech AAPL NVDA\`), or let the AI Agent create one (\`Quantum Computing\`).
• 📝 *Notes*: Check notes (\`AAPL\`, \`all notes\`), save persistent DD (\`AAPL Note here\`), or clear notes (\`delete note AAPL\`).
• 🎯 *Execution*: Check queue (\`queue\`, \`orders\`), queue tactical trades (\`BUY 100 AAPL @ 220 SL 210\`), or cancel orders (\`cancel AAPL\`).
• 🔔 *Alerts*: Check active alerts (\`alerts\`), arm new price monitors (\`Alert NVDA above $145\`), or cancel alerts (\`delete alert NVDA\`).
• 💡 *Ideas*: Check recent market theses (\`ideas\`, \`ideas NVDA\`) and log catalysts with automatic ticker telemetry.
• 💡 *App*: Check backlog (\`roadmap\`, \`ideas\`) and submit feature ideas and bug reports (\`[UI] Add dark mode\`).
• 🌐 *Macro*: Query the full institutional dossier (\`macro\`, \`report\`), specific items (\`regime\`, \`yields\`, \`volatility\`, \`pillars\`, \`scenarios\`, \`allocations\`, \`catalysts\`, \`gold\`), or write \`pdf\` for a styled PDF document!

⚙️ *Topics Operations:*
• Send \`topics\` in any topic for the full Live Topic Dashboard & Status Control Center!
• Send \`set topic [name] [threadId]\` to map or update topic thread routing!
• Type \`help\` inside any topic to get the full detailed instruction manual for that topic.`;
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
    case 'MACRO':
      return getMacroTopicHelp();
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
