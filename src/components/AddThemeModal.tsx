import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Compass,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Globe,
  Rocket,
  Cpu,
  Zap,
  Flame,
  Shield,
  Layers,
  Activity,
  DollarSign,
  Radio,
  Microscope,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MarketThemeDefinition,
  saveCustomMarketTheme,
  deleteCustomMarketTheme,
  ICON_MAP,
} from '@/utils/ideaThemeUtils';

interface AddThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeSaved?: (newTheme: MarketThemeDefinition) => void;
  initialTheme?: MarketThemeDefinition | null;
}

const COLOR_PALETTES = [
  {
    id: 'purple',
    label: 'Purple',
    bg: 'bg-purple-500/10',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    gradient: 'from-purple-500 to-indigo-600',
    swatch: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    gradient: 'from-emerald-500 to-teal-600',
    swatch: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'cyan',
    label: 'Cyan',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-300',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    gradient: 'from-cyan-500 to-blue-600',
    swatch: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'amber',
    label: 'Amber',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    gradient: 'from-amber-500 to-rose-600',
    swatch: 'from-amber-500 to-rose-600',
  },
  {
    id: 'rose',
    label: 'Rose',
    bg: 'bg-rose-500/10',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    gradient: 'from-rose-500 to-pink-600',
    swatch: 'from-rose-500 to-pink-600',
  },
  {
    id: 'indigo',
    label: 'Indigo',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-300',
    border: 'border-indigo-500/30',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
    gradient: 'from-indigo-500 to-purple-600',
    swatch: 'from-indigo-500 to-purple-600',
  },
  {
    id: 'lime',
    label: 'Lime',
    bg: 'bg-lime-500/10',
    text: 'text-lime-300',
    border: 'border-lime-500/30',
    badge: 'bg-lime-500/15 text-lime-300 border-lime-500/40',
    gradient: 'from-green-500 to-emerald-600',
    swatch: 'from-green-500 to-emerald-600',
  },
  {
    id: 'fuchsia',
    label: 'Fuchsia',
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-300',
    border: 'border-fuchsia-500/30',
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40',
    gradient: 'from-fuchsia-500 to-rose-600',
    swatch: 'from-fuchsia-500 to-rose-600',
  },
];

const PRESET_EMOJIS = ['🔮', '🧠', '⚡', '🛡️', '🚀', '⚛️', '💰', '🔥', '🔬', '🎯', '🌊', '🛰️', '🤖', '💊', '🌐', '🔋'];

export function AddThemeModal({
  isOpen,
  onClose,
  onThemeSaved,
  initialTheme,
}: AddThemeModalProps) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [emoji, setEmoji] = useState('🔮');
  const [description, setDescription] = useState('');
  const [universeInput, setUniverseInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('purple');
  const [iconName, setIconName] = useState('Compass');

  useEffect(() => {
    if (initialTheme) {
      setName(initialTheme.name || '');
      setShortName(initialTheme.shortName || '');
      setEmoji(initialTheme.emoji || '🔮');
      setDescription(initialTheme.description || '');
      setUniverseInput((initialTheme.universeTickers || []).join(', '));
      setKeywordsInput((initialTheme.keywords || []).join(', '));
      setIconName(initialTheme.iconName || 'Compass');
    } else {
      setName('');
      setShortName('');
      setEmoji('🔮');
      setDescription('');
      setUniverseInput('');
      setKeywordsInput('');
      setSelectedColorId('purple');
      setIconName('Compass');
    }
  }, [initialTheme, isOpen]);

  const handleSave = () => {
    if (!name.trim()) return;

    const chosenColor = COLOR_PALETTES.find((c) => c.id === selectedColorId) || COLOR_PALETTES[0];
    const cleanUniverse = universeInput
      .split(/[, ]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const cleanKeywords = keywordsInput
      .split(/[, ]+/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    // Auto-add tickers and short name to keywords
    const mergedKeywords = Array.from(
      new Set([
        ...cleanKeywords,
        ...cleanUniverse.map((t) => t.toLowerCase()),
        (shortName || name).toLowerCase(),
      ])
    );

    const id = initialTheme?.id || `custom-theme-${Date.now()}`;
    const newTheme: MarketThemeDefinition = {
      id,
      name: name.trim(),
      shortName: (shortName.trim() || name.trim().slice(0, 14)),
      emoji: emoji.trim() || '🔮',
      description: description.trim(),
      universeTickers: cleanUniverse,
      keywords: mergedKeywords,
      iconName,
      icon: ICON_MAP[iconName] || Compass,
      isCustom: true,
      colorClass: {
        bg: chosenColor.bg,
        text: chosenColor.text,
        border: chosenColor.border,
        badge: chosenColor.badge,
        gradient: chosenColor.gradient,
      },
    };

    saveCustomMarketTheme(newTheme);
    if (onThemeSaved) onThemeSaved(newTheme);
    onClose();
  };

  const parsedTickers = universeInput
    .split(/[, ]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-primary/25 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-gradient-to-r from-purple-950/40 via-background to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-purple-500/25">
              {emoji}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {initialTheme ? 'Edit Market Theme & Universe' : 'Create Market Theme & Scanning Universe'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Define a custom market sector, investment theme, or basket of candidate tickers for the AI Idea Hunter.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          {/* Name & Short Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Theme Full Name *
              </label>
              <Input
                placeholder="e.g. Quantum Computing & Photonics Supercycle"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs bg-background/60 border-border/70 focus:border-primary/60 font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Short Name / Badge
              </label>
              <Input
                placeholder="e.g. Quantum"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="h-9 text-xs bg-background/60 border-border/70 focus:border-primary/60 font-semibold"
              />
            </div>
          </div>

          {/* Emoji & Color Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-accent/20 p-4 rounded-xl border border-border/50">
            {/* Emoji Quick Picker */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Theme Emoji Icon
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setEmoji(em)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all border',
                      emoji === em
                        ? 'bg-primary/20 border-primary ring-1 ring-primary/40 scale-110'
                        : 'bg-background/60 border-border/60 hover:bg-accent/40'
                    )}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette Picker */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Color Accent
              </label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PALETTES.map((palette) => (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => setSelectedColorId(palette.id)}
                    className={cn(
                      'h-8 rounded-lg flex items-center justify-center transition-all border relative',
                      palette.bg,
                      palette.border,
                      selectedColorId === palette.id
                        ? 'ring-2 ring-primary scale-105 shadow-sm'
                        : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    <div className={cn('w-3 h-3 rounded-full bg-gradient-to-r', palette.swatch)} />
                    {selectedColorId === palette.id && (
                      <Check className="w-3 h-3 text-white absolute" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scanning Universe Tickers Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" /> Scanning Universe Tickers (Optional)
              </label>
              <span className="text-[10px] text-muted-foreground">Comma or space separated</span>
            </div>
            <Input
              placeholder="e.g. IONQ, RGAT, QBTS, IBM, HON, GOOGL"
              value={universeInput}
              onChange={(e) => setUniverseInput(e.target.value)}
              className="h-9 text-xs font-mono font-bold bg-background/60 border-cyan-500/30 focus:border-cyan-400 uppercase"
            />
            {parsedTickers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsedTickers.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="font-mono text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground leading-tight">
              When this theme is selected in the AI Hunter, the agent will prioritize and quote these candidate stocks.
            </p>
          </div>

          {/* Description & Scanning Thesis */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Thesis & Description
            </label>
            <Textarea
              placeholder="e.g. Focus on pure-play trapped ion and neutral atom quantum hardware developers experiencing accelerating commercial enterprise pilots and government grants."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[70px] text-xs bg-background/60 border-border/70 focus:border-primary/60 leading-relaxed font-sans"
            />
          </div>

          {/* Classification Keywords */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Auto-Classification Keywords
            </label>
            <Input
              placeholder="e.g. quantum, qubit, ionq, photonic, annealing, trapped ion"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              className="h-9 text-xs bg-background/60 border-border/70"
            />
            <span className="text-[10px] text-muted-foreground">
              Trade ideas containing these tags or phrases will automatically classify under this theme.
            </span>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/50 bg-accent/10 flex items-center justify-between">
          <div>
            {initialTheme && initialTheme.isCustom && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  deleteCustomMarketTheme(initialTheme.id);
                  onClose();
                }}
                className="h-8 text-xs text-rose-400 hover:bg-rose-500/10 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Theme
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!name.trim()}
              className="h-8 px-4 text-xs font-bold bg-primary text-primary-foreground shadow-md gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> {initialTheme ? 'Update Theme' : 'Save Theme & Universe'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
