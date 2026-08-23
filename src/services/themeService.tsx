import React, { useState, useEffect, createContext, useContext } from 'react';

export type ThemeId =
  | 'cyber-emerald'
  | 'bloomberg-terminal'
  | 'midnight-sapphire'
  | 'synthwave-purple'
  | 'tokyo-jade'
  | 'monochrome-slate'
  | 'daylight-platinum';

export type GlowIntensity = 'vibrant' | 'subtle' | 'minimal';
export type RadiusStyle = 'rounded' | 'sharp' | 'pill';
export type DensityStyle = 'comfortable' | 'compact';

export interface ThemePreset {
  id: ThemeId;
  name: string;
  category: 'Dark' | 'Light' | 'Pro Terminal';
  tagline: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  cardColor: string;
  previewGradient: string;
  accentBadge: string;
  popular?: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'cyber-emerald',
    name: 'Cyber Emerald',
    category: 'Dark',
    tagline: 'Fintech Luxe & Neon Cyan',
    description: 'Deep midnight obsidian with electric emerald & neon cyan accents. Default high-precision styling.',
    primaryColor: '#14b8a6',
    accentColor: '#06b6d4',
    bgColor: '#080d1a',
    cardColor: '#0d1527',
    previewGradient: 'linear-gradient(135deg, #080d1a 0%, #0d1527 50%, #14b8a6 100%)',
    accentBadge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    popular: true,
  },
  {
    id: 'bloomberg-terminal',
    name: 'Bloomberg Pro Terminal',
    category: 'Pro Terminal',
    tagline: 'High-Contrast Institutional Gold',
    description: 'Pure pitch black canvas with institutional amber-gold telemetry and crisp monospace fonts.',
    primaryColor: '#f59e0b',
    accentColor: '#fbbf24',
    bgColor: '#050505',
    cardColor: '#111111',
    previewGradient: 'linear-gradient(135deg, #050505 0%, #111111 50%, #f59e0b 100%)',
    accentBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    popular: true,
  },
  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    category: 'Dark',
    tagline: 'Electric Cobalt & Deep Navy',
    description: 'Deep royal sapphire backdrop with radiant cobalt blue and vibrant cyan glows.',
    primaryColor: '#3b82f6',
    accentColor: '#60a5fa',
    bgColor: '#030712',
    cardColor: '#0b132b',
    previewGradient: 'linear-gradient(135deg, #030712 0%, #0b132b 50%, #3b82f6 100%)',
    accentBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    id: 'synthwave-purple',
    name: 'Synthwave Neon',
    category: 'Dark',
    tagline: 'Neon Fuchsia & Violet Cyber',
    description: 'Vibrant cyberpunk violet with glowing magenta and purple neon edges for derivatives & flow traders.',
    primaryColor: '#d946ef',
    accentColor: '#a855f7',
    bgColor: '#0f051d',
    cardColor: '#1a0d33',
    previewGradient: 'linear-gradient(135deg, #0f051d 0%, #1a0d33 50%, #d946ef 100%)',
    accentBadge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
  },
  {
    id: 'tokyo-jade',
    name: 'Tokyo Jade Forest',
    category: 'Dark',
    tagline: 'Zen Mint & Slate Obsidian',
    description: 'Dark botanical slate background paired with calming luminous jade and bamboo green highlights.',
    primaryColor: '#10b981',
    accentColor: '#34d399',
    bgColor: '#04130d',
    cardColor: '#092117',
    previewGradient: 'linear-gradient(135deg, #04130d 0%, #092117 50%, #10b981 100%)',
    accentBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    id: 'monochrome-slate',
    name: 'Stealth Platinum',
    category: 'Dark',
    tagline: 'Minimalist Titanium & Silver',
    description: 'Ultra-clean monochromatic slate with crisp silver and titanium highlights for pure data clarity.',
    primaryColor: '#e2e8f0',
    accentColor: '#94a3b8',
    bgColor: '#090a0f',
    cardColor: '#12141c',
    previewGradient: 'linear-gradient(135deg, #090a0f 0%, #12141c 50%, #e2e8f0 100%)',
    accentBadge: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
  },
  {
    id: 'daylight-platinum',
    name: 'Daylight Pro Light',
    category: 'Light',
    tagline: 'Crisp Clean Daylight Platinum',
    description: 'High-visibility light theme with crisp white card surfaces and deep navy/indigo accents.',
    primaryColor: '#2563eb',
    accentColor: '#0284c7',
    bgColor: '#f8fafc',
    cardColor: '#ffffff',
    previewGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #2563eb 100%)',
    accentBadge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
];

interface ThemeContextType {
  currentTheme: ThemeId;
  glowIntensity: GlowIntensity;
  radiusStyle: RadiusStyle;
  densityStyle: DensityStyle;
  setTheme: (theme: ThemeId) => void;
  setGlowIntensity: (glow: GlowIntensity) => void;
  setRadiusStyle: (radius: RadiusStyle) => void;
  setDensityStyle: (density: DensityStyle) => void;
  activePreset: ThemePreset;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'tradeflow-active-theme';
const GLOW_STORAGE_KEY = 'tradeflow-glow-intensity';
const RADIUS_STORAGE_KEY = 'tradeflow-radius-style';
const DENSITY_STORAGE_KEY = 'tradeflow-density-style';

export function applyThemeToDOM(
  theme: ThemeId,
  glow: GlowIntensity = 'vibrant',
  radius: RadiusStyle = 'rounded',
  density: DensityStyle = 'comfortable'
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-glow', glow);
  root.setAttribute('data-radius', radius);
  root.setAttribute('data-density', density);

  if (theme === 'daylight-platinum') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
      if (saved && THEME_PRESETS.some(p => p.id === saved)) return saved;
    }
    return 'cyber-emerald';
  });

  const [glowIntensity, setGlowIntensityState] = useState<GlowIntensity>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(GLOW_STORAGE_KEY) as GlowIntensity;
      if (saved) return saved;
    }
    return 'vibrant';
  });

  const [radiusStyle, setRadiusStyleState] = useState<RadiusStyle>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(RADIUS_STORAGE_KEY) as RadiusStyle;
      if (saved) return saved;
    }
    return 'rounded';
  });

  const [densityStyle, setDensityStyleState] = useState<DensityStyle>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY) as DensityStyle;
      if (saved) return saved;
    }
    return 'comfortable';
  });

  useEffect(() => {
    applyThemeToDOM(currentTheme, glowIntensity, radiusStyle, densityStyle);
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    localStorage.setItem(GLOW_STORAGE_KEY, glowIntensity);
    localStorage.setItem(RADIUS_STORAGE_KEY, radiusStyle);
    localStorage.setItem(DENSITY_STORAGE_KEY, densityStyle);
  }, [currentTheme, glowIntensity, radiusStyle, densityStyle]);

  const setTheme = (theme: ThemeId) => {
    setCurrentTheme(theme);
  };

  const setGlowIntensity = (glow: GlowIntensity) => {
    setGlowIntensityState(glow);
  };

  const setRadiusStyle = (radius: RadiusStyle) => {
    setRadiusStyleState(radius);
  };

  const setDensityStyle = (density: DensityStyle) => {
    setDensityStyleState(density);
  };

  const activePreset = THEME_PRESETS.find(p => p.id === currentTheme) || THEME_PRESETS[0];

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        glowIntensity,
        radiusStyle,
        densityStyle,
        setTheme,
        setGlowIntensity,
        setRadiusStyle,
        setDensityStyle,
        activePreset,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
