import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerateAIIdeas } from '@/services/ideaService';

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

  const generateMutation = useGenerateAIIdeas();

  const activeTheme = STRATEGY_THEMES.find((t) => t.id === selectedThemeId);

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
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
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
                Deploy an autonomous hedge-fund analyst agent to scan market fundamentals, valuations, and catalysts.
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
                className="w-full bg-background border border-border/70 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none"
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

          {/* Custom Thesis / Instructions */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Custom Instructions / Specific Thesis (Optional)
              </label>
              <span className="text-[10px] text-muted-foreground">{'E.g., "Look for >25% gross margins"'}</span>
            </div>
            <Textarea

              placeholder="e.g. Focus on companies with upcoming product releases or earnings where market sentiment is overly pessimistic. Require a minimum 2.5:1 Risk/Reward ratio."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="min-h-[80px] text-xs bg-background/50 border-border/70 focus:border-purple-500/50 leading-relaxed"
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
