export type InvestmentStyle = 'Growth' | 'Value' | 'Dividend' | 'Defensive' | 'Speculative' | 'Blend';

export interface ThematicInfo {
  style: InvestmentStyle;
  themes: string[];
  primaryTheme: string;
  sector?: string;
}

// Master dictionary of known stocks and thematic tags
const KNOWN_THEMATICS: Record<string, { style: InvestmentStyle; themes: string[]; sector?: string }> = {
  // Mega-Cap & AI Tech
  NVDA: { style: 'Growth', themes: ['AI & Semis', 'Accelerated Computing', 'Big Tech'], sector: 'Technology' },
  MSFT: { style: 'Growth', themes: ['AI & Cloud', 'Big Tech', 'Enterprise Software'], sector: 'Technology' },
  AAPL: { style: 'Growth', themes: ['Consumer Tech', 'Big Tech', 'Hardware'], sector: 'Technology' },
  GOOGL: { style: 'Growth', themes: ['AI & Search', 'Big Tech', 'Digital Ads'], sector: 'Communication' },
  GOOG: { style: 'Growth', themes: ['AI & Search', 'Big Tech', 'Digital Ads'], sector: 'Communication' },
  AMZN: { style: 'Growth', themes: ['E-Commerce', 'Cloud & AI', 'Big Tech'], sector: 'Consumer Cyclical' },
  META: { style: 'Growth', themes: ['AI & Social Media', 'Big Tech', 'Digital Ads'], sector: 'Communication' },
  TSLA: { style: 'Growth', themes: ['Autonomous & EV', 'AI & Robotics', 'Clean Energy'], sector: 'Consumer Cyclical' },
  AMD: { style: 'Growth', themes: ['AI & Semis', 'Data Center'], sector: 'Technology' },
  AVGO: { style: 'Growth', themes: ['AI & Semis', 'Infrastructure Software'], sector: 'Technology' },
  QCOM: { style: 'Growth', themes: ['5G & Mobile', 'Semiconductors', 'AI Edge'], sector: 'Technology' },
  TSM: { style: 'Growth', themes: ['Semiconductors Foundry', 'AI Hardware'], sector: 'Technology' },
  ASML: { style: 'Growth', themes: ['EUV Lithography', 'Semiconductor Capital'], sector: 'Technology' },
  ARM: { style: 'Growth', themes: ['Chip Architecture', 'AI & Mobile'], sector: 'Technology' },
  PLTR: { style: 'Growth', themes: ['Enterprise AI', 'Defense Software', 'Big Data'], sector: 'Technology' },
  SNOW: { style: 'Growth', themes: ['Cloud Data', 'Enterprise AI'], sector: 'Technology' },
  CRWD: { style: 'Growth', themes: ['Cybersecurity', 'Cloud Security'], sector: 'Technology' },
  NET: { style: 'Growth', themes: ['Edge Cloud', 'Cybersecurity'], sector: 'Technology' },
  DDOG: { style: 'Growth', themes: ['Cloud Observability', 'DevOps'], sector: 'Technology' },
  FLEX: { style: 'Value', themes: ['Advanced Manufacturing', 'Data Center Supply'], sector: 'Technology' },

  // Nuclear, Uranium & Power
  CCJ: { style: 'Growth', themes: ['Nuclear & Uranium', 'Clean Baseload Energy'], sector: 'Energy' },
  'KAP.L': { style: 'Growth', themes: ['Nuclear & Uranium', 'World Uranium Leader', 'Clean Energy'], sector: 'Energy' },
  KAP: { style: 'Growth', themes: ['Nuclear & Uranium', 'Clean Energy'], sector: 'Energy' },
  URNM: { style: 'Growth', themes: ['Uranium Miners ETF', 'Nuclear Renaissance'], sector: 'Energy' },
  URA: { style: 'Growth', themes: ['Nuclear ETF', 'Clean Energy'], sector: 'Energy' },
  OKLO: { style: 'Speculative', themes: ['Next-Gen Nuclear', 'AI Data Center Power', 'SMR'], sector: 'Energy' },
  SMR: { style: 'Speculative', themes: ['Small Modular Reactors', 'Clean Nuclear'], sector: 'Energy' },
  CEG: { style: 'Growth', themes: ['Nuclear Power', 'Data Center Clean Energy'], sector: 'Utilities' },
  VST: { style: 'Growth', themes: ['Power Generation', 'AI Electricity Demand'], sector: 'Utilities' },
  NEE: { style: 'Dividend', themes: ['Renewable Energy', 'Regulated Utility'], sector: 'Utilities' },

  // Defense, Aerospace & Space Economy
  LMT: { style: 'Defensive', themes: ['Defense & Aerospace', 'Missiles & Fighters', 'Dividend'], sector: 'Industrials' },
  RTX: { style: 'Defensive', themes: ['Defense Systems', 'Commercial Aviation'], sector: 'Industrials' },
  NOC: { style: 'Defensive', themes: ['Strategic Defense', 'B-21 Raider', 'Space Systems'], sector: 'Industrials' },
  GD: { style: 'Defensive', themes: ['Naval Submarines', 'Combat Vehicles', 'Gulfstream'], sector: 'Industrials' },
  BA: { style: 'Value', themes: ['Commercial Aerospace', 'Defense'], sector: 'Industrials' },
  RKLB: { style: 'Speculative', themes: ['Space Launch', 'Satellites & Spacecraft', 'Defense Space'], sector: 'Industrials' },
  KTOS: { style: 'Growth', themes: ['Autonomous Drones', 'Space & Defense Tech'], sector: 'Industrials' },

  // High Yield, Dividends & Consumer Staples
  MO: { style: 'Dividend', themes: ['High Yield (8%+)', 'Cash Flow King', 'Consumer Defensive'], sector: 'Consumer Defensive' },
  PM: { style: 'Dividend', themes: ['Smoke-Free Transition', 'ZYN / Nicotine', 'High Yield'], sector: 'Consumer Defensive' },
  BTI: { style: 'Dividend', themes: ['High Yield (7%+)', 'Global Tobacco', 'Value Cash Cow'], sector: 'Consumer Defensive' },
  VZ: { style: 'Dividend', themes: ['Telecom Infrastructure', 'High Yield (6%+)', 'Defensive'], sector: 'Communication' },
  T: { style: 'Dividend', themes: ['5G Telecom', 'High Yield', 'Defensive Cash Flow'], sector: 'Communication' },
  O: { style: 'Dividend', themes: ['Monthly Dividend REIT', 'Commercial Real Estate'], sector: 'Real Estate' },
  SCHD: { style: 'Dividend', themes: ['US Dividend Equity ETF', 'Quality Income'], sector: 'Financial' },
  JNJ: { style: 'Defensive', themes: ['Healthcare Giant', 'Dividend King', 'Pharma'], sector: 'Healthcare' },
  PG: { style: 'Defensive', themes: ['Consumer Staples', 'Dividend Aristocrat', 'Global Brands'], sector: 'Consumer Defensive' },
  KO: { style: 'Dividend', themes: ['Beverages', 'Dividend Aristocrat', 'Defensive'], sector: 'Consumer Defensive' },
  PEP: { style: 'Dividend', themes: ['Snacks & Beverages', 'Dividend Aristocrat'], sector: 'Consumer Defensive' },
  COST: { style: 'Defensive', themes: ['Subscription Retail', 'High Quality Growth'], sector: 'Consumer Defensive' },
  WMT: { style: 'Defensive', themes: ['Retail Leader', 'E-Commerce & Grocery', 'Defensive'], sector: 'Consumer Defensive' },

  // Banking, Financials & Fintech
  'BARC.L': { style: 'Value', themes: ['Global Banking', 'UK Undervalued', 'Share Buybacks'], sector: 'Financial' },
  BARC: { style: 'Value', themes: ['Global Banking', 'UK Financials'], sector: 'Financial' },
  'WISE.L': { style: 'Growth', themes: ['Cross-Border Payments', 'Fintech Disruptor', 'UK Tech'], sector: 'Financial' },
  WISE: { style: 'Growth', themes: ['Fintech', 'Payments'], sector: 'Financial' },
  JPM: { style: 'Value', themes: ['Tier 1 Global Bank', 'Net Interest Fortress', 'Dividend'], sector: 'Financial' },
  BAC: { style: 'Value', themes: ['US Retail Banking', 'Value & Yield'], sector: 'Financial' },
  MS: { style: 'Value', themes: ['Wealth Management', 'Investment Banking'], sector: 'Financial' },
  GS: { style: 'Value', themes: ['Wall Street Trading', 'Asset Management'], sector: 'Financial' },
  PYPL: { style: 'Value', themes: ['Digital Payments', 'Cash Flow Value', 'Fintech'], sector: 'Financial' },
  SQ: { style: 'Growth', themes: ['Block / Square Ecosystem', 'Cash App', 'Fintech'], sector: 'Financial' },
  COIN: { style: 'Speculative', themes: ['Crypto Exchange', 'Bitcoin Ecosystem', 'Web3 Infrastructure'], sector: 'Financial' },
  HOOD: { style: 'Growth', themes: ['Retail Brokerage', 'Crypto Trading', 'Fintech'], sector: 'Financial' },
  SOFI: { style: 'Growth', themes: ['Digital Neo-Bank', 'Student Loans & Lending', 'Fintech'], sector: 'Financial' },
  MELI: { style: 'Growth', themes: ['Latin America E-Commerce', 'Mercado Pago Fintech'], sector: 'Consumer Cyclical' },

  // Commodities, Energy & Materials
  'BP.L': { style: 'Dividend', themes: ['Global Integrated Oil', 'High Yield & Buybacks', 'Energy Transition'], sector: 'Energy' },
  BP: { style: 'Dividend', themes: ['Oil & Gas', 'Dividend Cash Flow'], sector: 'Energy' },
  'RIO.L': { style: 'Dividend', themes: ['Iron Ore & Copper', 'Mining Giant', 'High Yield'], sector: 'Basic Materials' },
  RIO: { style: 'Dividend', themes: ['Global Mining', 'Copper & Commodities'], sector: 'Basic Materials' },
  'SOI.L': { style: 'Value', themes: ['Maritime Shipping', 'Commodities Transport', 'Value Asset'], sector: 'Industrials' },
  XOM: { style: 'Value', themes: ['Permian & Guyana Oil', 'Cash Flow Fortress', 'Dividend'], sector: 'Energy' },
  CVX: { style: 'Value', themes: ['Global LNG & Oil', 'Dividend Aristocrat'], sector: 'Energy' },
  SHEL: { style: 'Dividend', themes: ['Global LNG Leader', 'Integrated Energy', 'High Yield'], sector: 'Energy' },
  OXY: { style: 'Value', themes: ['Permian Basin Oil', 'Carbon Capture', 'Buffett Bet'], sector: 'Energy' },
  VALE: { style: 'Value', themes: ['Iron Ore Leader', 'Nickel & EV Metals', 'Deep Value'], sector: 'Basic Materials' },
  FCX: { style: 'Growth', themes: ['Copper Mining', 'Electrification / EV Grid'], sector: 'Basic Materials' },
  GLD: { style: 'Defensive', themes: ['Physical Gold', 'Inflation Hedge', 'Macro Hedge'], sector: 'Commodity' },
  SLV: { style: 'Speculative', themes: ['Silver Physical', 'Solar & Industrial Demand'], sector: 'Commodity' },
  FET: { style: 'Value', themes: ['Oilfield Equipment', 'Energy Services Turnaround'], sector: 'Energy' },
  'CRON.TO': { style: 'Speculative', themes: ['Cannabis & Wellness', 'Cash Rich Balance Sheet'], sector: 'Healthcare' },
  CRON: { style: 'Speculative', themes: ['Cannabis & Wellness'], sector: 'Healthcare' },

  // Automotive, Industrials & Mobility
  GM: { style: 'Value', themes: ['Legacy Auto Value', 'Cruise Autonomous', 'Trucks & Cash Flow'], sector: 'Consumer Cyclical' },
  F: { style: 'Value', themes: ['Ford Pro Commercial', 'Hybrid Fleet', 'High Yield'], sector: 'Consumer Cyclical' },
  RIVN: { style: 'Speculative', themes: ['EV Trucks & Vans', 'VW Joint Venture'], sector: 'Consumer Cyclical' },
  CAT: { style: 'Value', themes: ['Global Heavy Equipment', 'Mining & Construction Cycle'], sector: 'Industrials' },
  DE: { style: 'Value', themes: ['Precision Agriculture', 'Farm Automation'], sector: 'Industrials' },

  // Healthcare, Pharma & Biotech
  LLY: { style: 'Growth', themes: ['GLP-1 Weight Loss', 'Alzheimer Treatment', 'Pharma Mega-Cap'], sector: 'Healthcare' },
  NVO: { style: 'Growth', themes: ['Ozempic & Wegovy', 'Diabetes & Obesity Leader'], sector: 'Healthcare' },
  UNH: { style: 'Defensive', themes: ['Managed Care Giant', 'Optum Health Services'], sector: 'Healthcare' },
  PFE: { style: 'Dividend', themes: ['Deep Value Pharma', 'High Yield (6%+)', 'Cancer Pipeline'], sector: 'Healthcare' },
  ABBV: { style: 'Dividend', themes: ['Immunology & Botox', 'Dividend Aristocrat'], sector: 'Healthcare' },
  MRNA: { style: 'Speculative', themes: ['mRNA Therapeutics', 'Cancer Vaccines', 'Biotech'], sector: 'Healthcare' },
};

/**
 * Intelligent classifier that extracts clean symbol and resolves investment style & thematic badges.
 */
export function getCompanyStyleAndThemes(symbol: string, description?: string): ThematicInfo {
  // Normalize symbol (e.g. "AAPL 260116C00200000" -> "AAPL", "BARC.L" -> "BARC.L")
  let clean = symbol.trim().toUpperCase();

  // Strip option suffix if option contract
  const match = clean.match(/^[A-Z0-9.\-]+/);
  if (match) {
    clean = match[0];
  }

  // Direct lookup in known database
  if (KNOWN_THEMATICS[clean]) {
    const info = KNOWN_THEMATICS[clean];
    return {
      style: info.style,
      themes: info.themes,
      primaryTheme: info.themes[0] || 'General Equity',
      sector: info.sector,
    };
  }

  // Check without exchange suffix (e.g. "KAP.L" -> "KAP")
  const baseSym = clean.split('.')[0];
  if (KNOWN_THEMATICS[baseSym]) {
    const info = KNOWN_THEMATICS[baseSym];
    return {
      style: info.style,
      themes: info.themes,
      primaryTheme: info.themes[0] || 'General Equity',
      sector: info.sector,
    };
  }

  // Algorithmic Heuristic Classifier for unlisted symbols
  const descLower = (description || '').toLowerCase();
  const symLower = clean.toLowerCase();

  let style: InvestmentStyle = 'Blend';
  const themes: string[] = [];

  // Theme deductions
  if (descLower.includes('uranium') || descLower.includes('nuclear') || symLower.includes('ura') || symLower.includes('urnm')) {
    style = 'Growth';
    themes.push('Nuclear & Uranium', 'Clean Energy');
  } else if (descLower.includes('semiconductor') || descLower.includes('chip') || descLower.includes('ai') || descLower.includes('software')) {
    style = 'Growth';
    themes.push('AI & Tech', 'Semiconductors');
  } else if (descLower.includes('bank') || descLower.includes('financial') || descLower.includes('insurance')) {
    style = 'Value';
    themes.push('Financial Services', 'Banking');
  } else if (descLower.includes('oil') || descLower.includes('gas') || descLower.includes('energy') || descLower.includes('petroleum')) {
    style = 'Value';
    themes.push('Oil & Gas', 'Energy');
  } else if (descLower.includes('gold') || descLower.includes('silver') || descLower.includes('mining') || descLower.includes('metals')) {
    style = 'Value';
    themes.push('Commodities & Mining', 'Materials');
  } else if (descLower.includes('defense') || descLower.includes('aerospace') || descLower.includes('military')) {
    style = 'Defensive';
    themes.push('Defense & Aerospace');
  } else if (descLower.includes('health') || descLower.includes('pharma') || descLower.includes('biotech') || descLower.includes('medical')) {
    style = 'Growth';
    themes.push('Healthcare & Biotech');
  } else if (descLower.includes('reit') || descLower.includes('real estate') || descLower.includes('dividend')) {
    style = 'Dividend';
    themes.push('High Yield & Real Estate');
  } else if (clean.endsWith('.L')) {
    style = 'Dividend';
    themes.push('UK Listed', 'International Equity');
  } else if (clean.endsWith('.TO')) {
    style = 'Value';
    themes.push('Canadian Resources', 'Commodities');
  } else {
    // Default fallback
    style = 'Growth';
    themes.push('Equities & Growth');
  }

  return {
    style,
    themes,
    primaryTheme: themes[0] || 'Core Holding',
  };
}

/**
 * Visual styling tokens for Investment Styles
 */
export const STYLE_CONFIG: Record<InvestmentStyle, { label: string; badgeClass: string; borderClass: string; dotColor: string }> = {
  Growth: {
    label: 'Growth',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25',
    borderClass: 'border-cyan-500/40',
    dotColor: 'bg-cyan-400',
  },
  Value: {
    label: 'Value',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
    borderClass: 'border-amber-500/40',
    dotColor: 'bg-amber-400',
  },
  Dividend: {
    label: 'Dividend',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
    borderClass: 'border-emerald-500/40',
    dotColor: 'bg-emerald-400',
  },
  Defensive: {
    label: 'Defensive',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25',
    borderClass: 'border-blue-500/40',
    dotColor: 'bg-blue-400',
  },
  Speculative: {
    label: 'Speculative',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25',
    borderClass: 'border-purple-500/40',
    dotColor: 'bg-purple-400',
  },
  Blend: {
    label: 'Blend',
    badgeClass: 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700/70',
    borderClass: 'border-slate-600',
    dotColor: 'bg-slate-400',
  },
};

/**
 * Visual styling tokens for common themes
 */
export function getThemeBadgeStyle(themeName: string): { icon: string; badgeClass: string } {
  const t = themeName.toLowerCase();
  if (t.includes('ai') || t.includes('semis') || t.includes('computing')) {
    return { icon: '⚡', badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30' };
  }
  if (t.includes('nuclear') || t.includes('uranium')) {
    return { icon: '☢️', badgeClass: 'bg-lime-500/15 text-lime-300 border-lime-500/30' };
  }
  if (t.includes('defense') || t.includes('aero') || t.includes('space')) {
    return { icon: '🛡️', badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
  }
  if (t.includes('dividend') || t.includes('yield') || t.includes('income')) {
    return { icon: '💰', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  }
  if (t.includes('bank') || t.includes('fintech') || t.includes('payment')) {
    return { icon: '🏦', badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
  }
  if (t.includes('energy') || t.includes('oil') || t.includes('gas')) {
    return { icon: '⛽', badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
  }
  if (t.includes('mining') || t.includes('copper') || t.includes('gold') || t.includes('metal')) {
    return { icon: '💎', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  }
  if (t.includes('health') || t.includes('pharma') || t.includes('bio') || t.includes('glp')) {
    return { icon: '💊', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
  }
  if (t.includes('commerce') || t.includes('retail') || t.includes('consumer')) {
    return { icon: '🛍️', badgeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' };
  }
  if (t.includes('auto') || t.includes('ev') || t.includes('autonomous')) {
    return { icon: '🚗', badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30' };
  }
  if (t.includes('cloud') || t.includes('software') || t.includes('tech')) {
    return { icon: '☁️', badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
  }
  return { icon: '🏷️', badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' };
}
