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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Sparkles,
  Zap,
  TrendingUp,
  TrendingDown,
  Compass,
  Cpu,
  DollarSign,
  Flame,
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Loader2,
  Bookmark,
  BookmarkPlus,
  Trash2,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerateAIIdeas } from '@/services/ideaService';

export interface InstructionPreset {
  id: string;
  title: string;
  prompt: string;
  sentiment?: 'ANY' | 'BULLISH' | 'BEARISH';
  timeframe?: 'SHORT_TERM' | 'SWING' | 'LONG_TERM';
  themeId?: string;
  isBuiltIn?: boolean;
  createdAt: string;
}

const BUILT_IN_PRESETS: InstructionPreset[] = [
  {
    id: 'preset-asymmetric-rr',
    title: '🎯 3:1 Asymmetry & High FCF',
    prompt: 'Focus exclusively on setups offering at least 3.0:1 Risk/Reward asymmetry with positive free cash flow yield and upcoming catalysts.',
    sentiment: 'BULLISH',
    timeframe: 'SWING',
    themeId: 'value-fcf',
    isBuiltIn: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'preset-options-skew',
    title: '⚡ Options Skew & Earnings Vol',
    prompt: 'Scan for asymmetric options setups around earnings announcements where implied volatility skew is underpricing positive guidance surprises.',
    sentiment: 'ANY',
    timeframe: 'SHORT_TERM',
    themeId: 'options-catalyst',
    isBuiltIn: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'preset-momentum-breakout',
    title: '🔥 Momentum Breakout above 20 EMA',
    prompt: 'Identify momentum leaders consolidating near 52-week highs with heavy accumulation volume, low float, and expanding margins.',
    sentiment: 'BULLISH',
    timeframe: 'SWING',
    themeId: 'momentum-beta',
    isBuiltIn: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'preset-ai-infrastructure',
    title: '🧠 Datacenter Power & AI ASICs',
    prompt: 'Target semiconductor, custom ASIC, and power infrastructure beneficiaries of hyper-scaler capex deployments with expanding backlogs.',
    sentiment: 'BULLISH',
    timeframe: 'LONG_TERM',
    themeId: 'ai-semi',
    isBuiltIn: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'preset-hedging-bearish',
    title: '🛡️ Overvalued Multiple Contraction',
    prompt: 'Look for companies with decelerating revenue, negative operating margins, high debt refinancing maturities, and deteriorating technicals.',
    sentiment: 'BEARISH',
    timeframe: 'SWING',
    themeId: 'value-fcf',
    isBuiltIn: true,
    createdAt: '2026-01-01',
  },
];

interface AIIdeaGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STRATEGY_THEMES = [
  {
    id: 'ai-semi',
    name: 'AI Infrastructure & Blackwell Supercycle',
    icon: Cpu,
    color: 'from-purple-500 to-indigo-500',
    description: 'Datacenter capex, custom ASICs, optical transceivers, and semiconductor supply chain.',
    themeQuery: 'AI & Semiconductor Infrastructure',
  },
  {
    id: 'value-fcf',
    name: 'High Free Cash Flow & Value Inflection',
    icon: DollarSign,
    color: 'from-emerald-500 to-teal-500',
    description: 'Undervalued companies with high FCF yield, low debt-to-equity, and share buyback catalysts.',
    themeQuery: 'High Free Cash Flow & Value Inflection',
  },
  {
    id: 'momentum-beta',
    name: 'High Beta & Technical Breakout',
    icon: Flame,
    color: 'from-amber-500 to-rose-500',
    description: 'Momentum runners consolidating above 20/50 EMAs with high short interest or volatility.',
    themeQuery: 'High Beta, Momentum & Technical Breakouts',
  },
  {
    id: 'options-catalyst',
    name: 'Options Asymmetry & Earnings Play',
    icon: Activity,
    color: 'from-blue-500 to-cyan-500',
    description: 'Upcoming catalyst mispricing, IV skew anomalies, and earnings event contracts.',
    themeQuery: 'Options Volatility & Earnings Mispricing',
  },
  {
    id: 'clean-energy',
    name: 'Energy Transition & Critical Materials',
    icon: Zap,
    color: 'from-green-500 to-emerald-600',
    description: 'Nuclear SMRs, uranium, grid electrification, power storage, and copper/lithium producers.',
    themeQuery: 'Energy Transition & Critical Materials',
  },
];

const PRESETS_STORAGE_KEY = 'tradeflow_ai_idea_presets';

export function AIIdeaGeneratorModal({
  isOpen,
  onClose,
  onSuccess,
}: AIIdeaGeneratorModalProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<string>('ai-semi');
  const [sentiment, setSentiment] = useState<'ANY' | 'BULLISH' | 'BEARISH'>('BULLISH');
  const [timeframe, setTimeframe] = useState<'SHORT_TERM' | 'SWING' | 'LONG_TERM'>('SWING');
  const [count, setCount] = useState<number>(2);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Preset Management State
  const [presets, setPresets] = useState<InstructionPreset[]>(() => {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return [...BUILT_IN_PRESETS, ...parsed.filter((p: InstructionPreset) => !p.isBuiltIn)];
      }
    } catch (e) {
      console.warn('Failed to load custom presets from localStorage', e);
    }
    return BUILT_IN_PRESETS;
  });

  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const generateMutation = useGenerateAIIdeas();

  const activeTheme = STRATEGY_THEMES.find((t) => t.id === selectedThemeId);

  // Apply a preset
  const handleApplyPreset = (preset: InstructionPreset) => {
    setCustomPrompt(preset.prompt);
    setActivePresetId(preset.id);
    if (preset.sentiment) setSentiment(preset.sentiment);
    if (preset.timeframe) setTimeframe(preset.timeframe);
    if (preset.themeId) {
      const exists = STRATEGY_THEMES.some((t) => t.id === preset.themeId);
      if (exists) setSelectedThemeId(preset.themeId);
    }
  };

  // Save current instructions as a new preset
  const handleSavePreset = () => {
    if (!customPrompt.trim() || !newPresetTitle.trim()) return;

    const newPreset: InstructionPreset = {
      id: `user-preset-${Date.now()}`,
      title: newPresetTitle.trim(),
      prompt: customPrompt.trim(),
      sentiment,
      timeframe,
      themeId: selectedThemeId,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };

    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    setActivePresetId(newPreset.id);

    // Save only user presets to localStorage
    const userOnly = updatedPresets.filter((p) => !p.isBuiltIn);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(userOnly));

    setIsSavingPreset(false);
    setNewPresetTitle('');
    setSaveSuccessMsg(`Preset "${newPreset.title}" saved!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Delete a user preset
  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedPresets = presets.filter((p) => p.id !== id);
    setPresets(updatedPresets);
    if (activePresetId === id) setActivePresetId(null);

    const userOnly = updatedPresets.filter((p) => !p.isBuiltIn);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(userOnly));
  };

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        theme: activeTheme?.themeQuery || 'High Conviction Tactical Ideas',
        customPrompt: customPrompt.trim(),
        sentiment,
        timeframe,
        count,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to generate AI ideas:', err);
      alert(`AI Idea Hunter error: ${err.message || 'Please verify your OpenRouter API key.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !generateMutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-gradient-to-r from-purple-950/40 via-background to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Autonomous AI Idea Hunter
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] tracking-wider uppercase font-mono">
                  GPT-4o Agent
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Deploy an autonomous hedge-fund analyst agent to scan market fundamentals, valuations, catalysts & custom theses.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Strategy Theme Cards */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-primary" /> Select Market Theme / Scanning Universe
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STRATEGY_THEMES.map((theme) => {
                const Icon = theme.icon;
                const isSelected = selectedThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={cn(
                      'p-3.5 rounded-xl text-left transition-all duration-300 border flex flex-col justify-between relative overflow-hidden group',
                      isSelected
                        ? 'bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(var(--primary),0.15)] ring-1 ring-primary/30'
                        : 'bg-background/40 border-border/50 hover:bg-accent/40 hover:border-border/80'
                    )}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div
                        className={cn(
                          'p-2 rounded-lg bg-gradient-to-br text-white shadow-sm',
                          theme.color
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-xs text-foreground tracking-tight">
                        {theme.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {theme.description}
                    </p>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-primary absolute top-3 right-3" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parameters Grid: Sentiment, Timeframe, Number of Ideas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-accent/20 p-4 rounded-xl border border-border/50">
            {/* Sentiment */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Bias / Sentiment
              </label>
              <div className="grid grid-cols-3 gap-1 bg-background/80 p-1 rounded-lg border border-border/60">
                {(['BULLISH', 'ANY', 'BEARISH'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSentiment(s)}
                    className={cn(
                      'py-1 rounded text-[10px] font-bold transition-all capitalize',
                      sentiment === s
                        ? s === 'BULLISH'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : s === 'BEARISH'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {s.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" /> Target Horizon
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="w-full bg-background border border-border/70 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                <option value="SHORT_TERM">⚡ Short Term (1–10 Days)</option>
                <option value="SWING">🌊 Swing Trade (2–8 Weeks)</option>
                <option value="LONG_TERM">🏛️ Long Term (1+ Years)</option>
              </select>
            </div>

            {/* Count */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <Layers className="w-3 h-3 text-primary" /> Ideas Count
              </label>
              <div className="grid grid-cols-3 gap-1 bg-background/80 p-1 rounded-lg border border-border/60">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCount(num)}
                    className={cn(
                      'py-1 rounded text-xs font-bold transition-all',
                      count === num
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {num} {num === 1 ? 'Idea' : 'Ideas'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Thesis & Saved Instructions Presets */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Custom Instructions & Thesis
              </label>

              <div className="flex items-center gap-2">
                {customPrompt && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSavingPreset((prev) => !prev)}
                    className="h-6 text-[11px] px-2 text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 gap-1"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    <span>{isSavingPreset ? 'Close' : 'Save As Preset'}</span>
                  </Button>
                )}
                {customPrompt && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomPrompt('');
                      setActivePresetId(null);
                    }}
                    className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-foreground"
                    title="Clear instructions"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Saved Presets Quick Selector Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Bookmark className="w-3 h-3 text-purple-400" />
                <span className="font-semibold">Quick Instruction Presets:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 group',
                        isActive
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm ring-1 ring-purple-500/30'
                          : 'bg-background/60 text-muted-foreground hover:text-foreground border-border/60 hover:border-purple-500/30'
                      )}
                      title={preset.prompt}
                    >
                      <span>{preset.title}</span>
                      {!preset.isBuiltIn && (
                        <button
                          type="button"
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity ml-1"
                          title="Delete preset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save Preset Inline Input */}
            {isSavingPreset && (
              <div className="p-3 bg-purple-950/20 rounded-xl border border-purple-800/40 space-y-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <BookmarkPlus className="w-3.5 h-3.5" /> Save Custom Instructions Preset
                  </span>
                  <span className="text-[10px] text-muted-foreground">Will be saved locally for one-click re-use</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g., Strict 3:1 R:R & High Free Cash Flow"
                    value={newPresetTitle}
                    onChange={(e) => setNewPresetTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                    className="h-8 text-xs bg-background/80 border-purple-500/40 focus:border-purple-400 flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSavePreset}
                    disabled={!newPresetTitle.trim() || !customPrompt.trim()}
                    className="h-8 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white gap-1.5 px-3"
                  >
                    <Check className="w-3.5 h-3.5" /> Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSavingPreset(false)}
                    className="h-8 text-xs text-muted-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {saveSuccessMsg && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {saveSuccessMsg}
              </div>
            )}

            <Textarea
              placeholder="e.g. Focus on companies with upcoming product releases or earnings where market sentiment is overly pessimistic. Require a minimum 2.5:1 Risk/Reward ratio."
              value={customPrompt}
              onChange={(e) => {
                setCustomPrompt(e.target.value);
                if (activePresetId) setActivePresetId(null);
              }}
              className="min-h-[85px] text-xs bg-background/50 border-border/70 focus:border-purple-500/50 leading-relaxed font-sans"
            />
          </div>

          {/* Scanning Progress Banner during Agent execution */}
          {generateMutation.isPending && (
            <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/50 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-bold text-purple-200">
                  Agent actively querying live quotes and evaluating catalysts...
                </p>
                <p className="text-[11px] text-purple-300/70 mt-0.5">
                  Calculating entry ranges, stop loss invalidations, and assembling trade briefs.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/50 bg-accent/10 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={generateMutation.isPending}
            className="h-9 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="h-9 px-5 text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all gap-2"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Hunting Trade Ideas...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" /> Summon AI Idea Hunter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
