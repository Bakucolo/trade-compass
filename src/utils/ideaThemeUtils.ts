import { TradeIdea } from '@/services/ideaService';
import {
  Cpu,
  DollarSign,
  Flame,
  Activity,
  Zap,
  Shield,
  Layers,
  Sparkles,
  Compass,
  Rocket,
  Globe,
  Radio,
  Microscope,
  Target,
  LucideIcon
} from 'lucide-react';

export interface MarketThemeDefinition {
  id: string;
  name: string;
  shortName: string;
  icon?: LucideIcon;
  iconName?: string;
  emoji: string;
  description?: string;
  universeTickers?: string[];
  isCustom?: boolean;
  colorClass: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    gradient: string;
  };
  keywords: string[];
}

export const CUSTOM_THEMES_STORAGE_KEY = 'tradeflow_custom_market_themes';

export const BUILT_IN_THEMES: MarketThemeDefinition[] = [
  {
    id: 'ai-semi',
    name: 'AI Infrastructure & Semiconductor Supercycle',
    shortName: 'AI & Semiconductors',
    icon: Cpu,
    iconName: 'Cpu',
    emoji: '🧠',
    description: 'Datacenter capex, custom ASICs, optical transceivers, and semiconductor supply chain.',
    universeTickers: ['NVDA', 'AVGO', 'TSM', 'AMD', 'MRVL', 'PLTR', 'ARM', 'MSFT', 'MU'],
    isCustom: false,
    colorClass: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-300',
      border: 'border-purple-500/30',
      badge: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
      gradient: 'from-purple-500 to-indigo-600',
    },
    keywords: [
      'ai', 'semi', 'semiconductor', 'blackwell', 'gpu', 'datacenter', 'data center',
      'asic', 'nvda', 'amd', 'tsm', 'avgo', 'mrvl', 'arm', 'smr', 'hardware', 'transceiver',
      'broadcom', 'nvidia', 'server', 'hbm', 'micron', 'chip'
    ],
  },
  {
    id: 'value-fcf',
    name: 'High Free Cash Flow & Value Inflection',
    shortName: 'Value & High FCF',
    icon: DollarSign,
    iconName: 'DollarSign',
    emoji: '💰',
    description: 'Undervalued companies with high FCF yield, low debt-to-equity, and share buybacks.',
    universeTickers: ['BRK-B', 'JNJ', 'PG', 'META', 'GOOGL', 'CVX', 'AAPL', 'UNH'],
    isCustom: false,
    colorClass: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      gradient: 'from-emerald-500 to-teal-600',
    },
    keywords: [
      'value', 'cash flow', 'fcf', 'buyback', 'dividend', 'undervalued', 'low pe',
      'margin', 'yield', 'cash generation', 'share repurchases', 'moat', 'buffett',
      'ebitda', 'distressed', 'turnaround'
    ],
  },
  {
    id: 'momentum-breakout',
    name: 'High Beta, Momentum & Technical Breakouts',
    shortName: 'Momentum & Beta',
    icon: Flame,
    iconName: 'Flame',
    emoji: '🔥',
    description: 'Momentum runners consolidating above key moving averages with high relative volume.',
    universeTickers: ['TSLA', 'COIN', 'MSTR', 'RKLB', 'DKNG', 'HOOD', 'SOFI', 'PLTR'],
    isCustom: false,
    colorClass: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-300',
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      gradient: 'from-amber-500 to-rose-600',
    },
    keywords: [
      'momentum', 'breakout', 'beta', 'high beta', 'volatility', 'short squeeze',
      'squeeze', 'all time high', 'ath', 'ema', 'trend', 'rsi', 'volume surge',
      'relative strength', 'runner', 'growth'
    ],
  },
  {
    id: 'options-catalyst',
    name: 'Options Asymmetry & Earnings Catalyst',
    shortName: 'Options & Earnings',
    icon: Activity,
    iconName: 'Activity',
    emoji: '⚡',
    description: 'Upcoming catalyst mispricing, IV skew anomalies, and earnings event contracts.',
    universeTickers: ['NVDA', 'TSLA', 'AAPL', 'AMZN', 'META', 'NFLX', 'AMD'],
    isCustom: false,
    colorClass: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-300',
      border: 'border-cyan-500/30',
      badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
      gradient: 'from-blue-500 to-cyan-600',
    },
    keywords: [
      'option', 'options', 'earnings', 'volatility skew', 'iv', 'skew', 'catalyst',
      'asymmetry', 'gamma', 'straddle', 'leap', 'contract', 'mispricing', 'event',
      'fda', 'approval', 'binary'
    ],
  },
  {
    id: 'energy-materials',
    name: 'Energy Transition, Nuclear & Critical Materials',
    shortName: 'Energy & Materials',
    icon: Zap,
    iconName: 'Zap',
    emoji: '⚛️',
    description: 'Nuclear SMRs, uranium, grid electrification, power storage, and critical minerals.',
    universeTickers: ['CCJ', 'CEG', 'VST', 'SMR', 'OKLO', 'FCX', 'XOM', 'NEE'],
    isCustom: false,
    colorClass: {
      bg: 'bg-lime-500/10',
      text: 'text-lime-300',
      border: 'border-lime-500/30',
      badge: 'bg-lime-500/15 text-lime-300 border-lime-500/40',
      gradient: 'from-green-500 to-emerald-600',
    },
    keywords: [
      'energy', 'nuclear', 'uranium', 'clean tech', 'lithium', 'copper', 'materials',
      'electrification', 'grid', 'power', 'oil', 'gas', 'solar', 'storage', 'battery',
      'smr', 'commodity', 'commodities', 'oklo', 'cameco'
    ],
  },
  {
    id: 'macro-defense',
    name: 'Macro Regime, Interest Rates & Defense',
    shortName: 'Macro & Defense',
    icon: Shield,
    iconName: 'Shield',
    emoji: '🛡️',
    description: 'Defense technology, sovereign security, interest rate regime hedges, and gold.',
    universeTickers: ['LMT', 'RTX', 'NOC', 'GD', 'GLD', 'TLT', 'KTOS', 'PLTR'],
    isCustom: false,
    colorClass: {
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-300',
      border: 'border-indigo-500/30',
      badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
      gradient: 'from-indigo-500 to-purple-600',
    },
    keywords: [
      'macro', 'fed', 'rate', 'rates', 'defense', 'aerospace', 'yield', 'geopolitics',
      'inflation', 'bonds', 'treasury', 'dollar', 'dxy', 'hedge', 'gold', 'safe haven',
      'drone', 'lockheed', 'palantir'
    ],
  },
];

export const MARKET_THEMES = BUILT_IN_THEMES;

export const DEFAULT_THEME: MarketThemeDefinition = {
  id: 'tactical-alpha',
  name: 'Tactical Alpha & Sector Opportunities',
  shortName: 'Tactical Alpha',
  icon: Layers,
  iconName: 'Layers',
  emoji: '🎯',
  description: 'Diversified broad market tactical catalysts and alpha generation setups.',
  universeTickers: [],
  isCustom: false,
  colorClass: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-300',
    border: 'border-slate-500/30',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
    gradient: 'from-slate-600 to-slate-800',
  },
  keywords: [],
};

// Map of icon names to Lucide icons
export const ICON_MAP: Record<string, LucideIcon> = {
  Cpu,
  DollarSign,
  Flame,
  Activity,
  Zap,
  Shield,
  Layers,
  Sparkles,
  Compass,
  Rocket,
  Globe,
  Radio,
  Microscope,
  Target,
};

/**
 * Load user-defined market themes from localStorage
 */
export function getCustomMarketThemes(): MarketThemeDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: MarketThemeDefinition[] = JSON.parse(raw);
    return parsed.map((item) => ({
      ...item,
      icon: item.iconName && ICON_MAP[item.iconName] ? ICON_MAP[item.iconName] : Compass,
      isCustom: true,
    }));
  } catch (err) {
    console.warn('Failed to load custom market themes:', err);
    return [];
  }
}

/**
 * Save or update a custom market theme in localStorage
 */
export function saveCustomMarketTheme(theme: MarketThemeDefinition): MarketThemeDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getCustomMarketThemes();
    const existingIndex = current.findIndex((t) => t.id === theme.id);
    let updated: MarketThemeDefinition[];

    const sanitized: MarketThemeDefinition = {
      ...theme,
      isCustom: true,
      iconName: theme.iconName || 'Compass',
    };

    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = sanitized;
    } else {
      updated = [...current, sanitized];
    }

    // Strip actual React components before saving to JSON
    const toSave = updated.map(({ icon, ...rest }) => rest);
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(toSave));

    window.dispatchEvent(new CustomEvent('market-themes-updated'));
    return getCustomMarketThemes();
  } catch (err) {
    console.error('Failed to save custom market theme:', err);
    return getCustomMarketThemes();
  }
}

/**
 * Delete a custom market theme from localStorage
 */
export function deleteCustomMarketTheme(themeId: string): MarketThemeDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getCustomMarketThemes();
    const updated = current.filter((t) => t.id !== themeId);
    const toSave = updated.map(({ icon, ...rest }) => rest);
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(toSave));

    window.dispatchEvent(new CustomEvent('market-themes-updated'));
    return getCustomMarketThemes();
  } catch (err) {
    console.error('Failed to delete custom market theme:', err);
    return getCustomMarketThemes();
  }
}

/**
 * Get all available market themes (Built-in + Custom User Themes)
 */
export function getAllMarketThemes(): MarketThemeDefinition[] {
  const custom = getCustomMarketThemes();
  return [...BUILT_IN_THEMES, ...custom];
}

/**
 * Detect the best-matching Market Theme for a trade idea based on tags, title, content and symbol.
 */
export function getIdeaMarketTheme(
  idea: TradeIdea,
  availableThemes: MarketThemeDefinition[] = getAllMarketThemes()
): MarketThemeDefinition {
  const symbol = (idea.symbol || '').toUpperCase().trim();
  const combinedText = [
    idea.tags || '',
    idea.title || '',
    idea.symbol || '',
    idea.content || '',
  ].join(' ').toLowerCase();

  // 1. Direct Ticker Universe match check first
  for (const theme of availableThemes) {
    if (theme.universeTickers && theme.universeTickers.some((t) => t.toUpperCase() === symbol)) {
      return theme;
    }
  }

  // 2. Keyword score matching
  let bestMatch: MarketThemeDefinition | null = null;
  let highestScore = 0;

  for (const theme of availableThemes) {
    let score = 0;
    for (const kw of theme.keywords) {
      if (kw && combinedText.includes(kw.toLowerCase())) {
        if (idea.tags && idea.tags.toLowerCase().includes(kw.toLowerCase())) {
          score += 3;
        } else if (idea.title.toLowerCase().includes(kw.toLowerCase())) {
          score += 2;
        } else {
          score += 1;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = theme;
    }
  }

  return highestScore > 0 && bestMatch ? bestMatch : DEFAULT_THEME;
}

/**
 * Calculate potential upside ROI % from entry to target
 */
export function calculatePotentialROI(idea: TradeIdea): number {
  if (!idea.entryPrice || !idea.targetPrice || idea.entryPrice <= 0) return 0;
  if (idea.type === 'BEARISH') {
    return ((idea.entryPrice - idea.targetPrice) / idea.entryPrice) * 100;
  }
  return ((idea.targetPrice - idea.entryPrice) / idea.entryPrice) * 100;
}
