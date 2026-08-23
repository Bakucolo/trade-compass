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
  LucideIcon
} from 'lucide-react';

export interface MarketThemeDefinition {
  id: string;
  name: string;
  shortName: string;
  icon: LucideIcon;
  emoji: string;
  colorClass: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    gradient: string;
  };
  keywords: string[];
}

export const MARKET_THEMES: MarketThemeDefinition[] = [
  {
    id: 'ai-semi',
    name: 'AI Infrastructure & Semiconductor Supercycle',
    shortName: 'AI & Semiconductors',
    icon: Cpu,
    emoji: '🧠',
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
    emoji: '💰',
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
    emoji: '🔥',
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
    emoji: '⚡',
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
    emoji: '⚛️',
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
      'smr', 'commodity', 'commodities'
    ],
  },
  {
    id: 'macro-defense',
    name: 'Macro Regime, Interest Rates & Defense',
    shortName: 'Macro & Defense',
    icon: Shield,
    emoji: '🛡️',
    colorClass: {
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-300',
      border: 'border-indigo-500/30',
      badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
      gradient: 'from-indigo-500 to-purple-600',
    },
    keywords: [
      'macro', 'fed', 'rate', 'rates', 'defense', 'aerospace', 'yield', 'geopolitics',
      'inflation', 'bonds', 'treasury', 'dollar', 'dxy', 'hedge', 'gold', 'safe haven'
    ],
  },
];

export const DEFAULT_THEME: MarketThemeDefinition = {
  id: 'tactical-alpha',
  name: 'Tactical Alpha & Sector Opportunities',
  shortName: 'Tactical Alpha',
  icon: Layers,
  emoji: '🎯',
  colorClass: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-300',
    border: 'border-slate-500/30',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
    gradient: 'from-slate-600 to-slate-800',
  },
  keywords: [],
};

/**
 * Detect the best-matching Market Theme for a trade idea based on tags, title, content and symbol.
 */
export function getIdeaMarketTheme(idea: TradeIdea): MarketThemeDefinition {
  const combinedText = [
    idea.tags || '',
    idea.title || '',
    idea.symbol || '',
    idea.content || '',
  ].join(' ').toLowerCase();

  let bestMatch: MarketThemeDefinition | null = null;
  let highestScore = 0;

  for (const theme of MARKET_THEMES) {
    let score = 0;
    for (const kw of theme.keywords) {
      if (combinedText.includes(kw.toLowerCase())) {
        // Tag match is weighted higher than body match
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
