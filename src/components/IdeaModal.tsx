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
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Save,
  Trash2,
  Tag,
  Clock,
  Target,
  ShieldAlert,
  DollarSign,
  FileText,
  Eye,
  Edit3,
  Loader2,
  Percent,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import {
  TradeIdea,
  useCreateTradeIdea,
  useUpdateTradeIdea,
  useDeleteTradeIdea,
} from '@/services/ideaService';

interface IdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideaToEdit?: TradeIdea | null;
  initialSymbol?: string;
}

const PRESET_TAGS = [
  'Growth',
  'Value',
  'AI & Tech',
  'Semiconductors',
  'Earnings Play',
  'Option Play',
  'Swing Trade',
  'Long Term',
  'Dividend',
  'High Beta',
  'Breakout',
];

const TEMPLATES = [
  {
    name: 'Standard Thesis',
    text: `### 🎯 Core Hypothesis
Describe the core reason why this trade has an asymmetric edge.

### 🚀 Key Catalysts
- **Earnings / Guidance:** Expected inflection in revenue or margins.
- **Product Cycle / Expansion:** New launch or enterprise adoption.
- **Macro / Industry Tailwinds:** Favorable interest rates or sector rotation.

### 🛡️ Risk & Execution Plan
- **Entry Range:** Current consolidation support.
- **Stop Loss:** Invalidation level below support.
- **Profit Target:** Upside target based on technical resistance / valuation multiple.`,
  },
  {
    name: 'Earnings Setup',
    text: `### 🎯 Earnings Play Setup
Implied volatility pricing vs historical post-earnings move.

### 📊 Financial Expectations
- **Consensus EPS / Rev:** 
- **Guidance Expectations:** 
- **Whisper Numbers / Checks:** 

### 🛡️ Trade Structure & Risk
- **Strategy:** Long Shares / Call Debit Spread / Protective Put
- **Max Loss / Stop:** 
- **Profit Taking Plan:** `,
  },
  {
    name: 'Breakout & Momentum',
    text: `### 🎯 Technical Setup
Consolidating near key resistance with increasing volume.

### 📈 Technical Levels
- **Trigger Level:** Breakout above resistance with volume expansion.
- **Support / Invalidation:** Prior pivot low.
- **Measured Move Target:** `,
  },
];

export function IdeaModal({
  isOpen,
  onClose,
  ideaToEdit,
  initialSymbol = '',
}: IdeaModalProps) {
  const isEditing = Boolean(ideaToEdit);

  const [title, setTitle] = useState('');
  const [symbol, setSymbol] = useState(initialSymbol);
  const [type, setType] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL'>('BULLISH');
  const [timeframe, setTimeframe] = useState<'SHORT_TERM' | 'SWING' | 'LONG_TERM'>('SWING');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [confidenceScore, setConfidenceScore] = useState<number>(80);
  const [status, setStatus] = useState<'ACTIVE' | 'WATCHING' | 'PLAYED_OUT' | 'ARCHIVED'>('ACTIVE');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createMutation = useCreateTradeIdea();
  const updateMutation = useUpdateTradeIdea();
  const deleteMutation = useDeleteTradeIdea();

  useEffect(() => {
    if (isOpen) {
      if (ideaToEdit) {
        setTitle(ideaToEdit.title || '');
        setSymbol(ideaToEdit.symbol || '');
        setType(ideaToEdit.type || 'BULLISH');
        setTimeframe((ideaToEdit.timeframe as any) || 'SWING');
        setEntryPrice(ideaToEdit.entryPrice ? String(ideaToEdit.entryPrice) : '');
        setTargetPrice(ideaToEdit.targetPrice ? String(ideaToEdit.targetPrice) : '');
        setStopLoss(ideaToEdit.stopLoss ? String(ideaToEdit.stopLoss) : '');
        setConfidenceScore(ideaToEdit.confidenceScore ?? 80);
        setStatus(ideaToEdit.status || 'ACTIVE');
        setContent(ideaToEdit.content || '');
        setTags(
          ideaToEdit.tags
            ? ideaToEdit.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : []
        );
      } else {
        setTitle('');
        setSymbol(initialSymbol ? initialSymbol.toUpperCase() : '');
        setType('BULLISH');
        setTimeframe('SWING');
        setEntryPrice('');
        setTargetPrice('');
        setStopLoss('');
        setConfidenceScore(80);
        setStatus('ACTIVE');
        setContent(TEMPLATES[0].text);
        setTags(['Growth', 'Swing Trade']);
      }
      setConfirmDelete(false);
      setActiveTab('edit');
    }
  }, [isOpen, ideaToEdit, initialSymbol]);

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Calculate Risk / Reward Ratio live
  const entryNum = parseFloat(entryPrice);
  const targetNum = parseFloat(targetPrice);
  const stopNum = parseFloat(stopLoss);

  let riskRewardRatio: string | null = null;
  let potentialGainPercent: string | null = null;
  let potentialLossPercent: string | null = null;

  if (!isNaN(entryNum) && entryNum > 0 && !isNaN(targetNum) && !isNaN(stopNum)) {
    const reward = Math.abs(targetNum - entryNum);
    const risk = Math.abs(entryNum - stopNum);
    if (risk > 0) {
      riskRewardRatio = (reward / risk).toFixed(2);
    }
    potentialGainPercent = (((targetNum - entryNum) / entryNum) * 100).toFixed(1);
    potentialLossPercent = (((entryNum - stopNum) / entryNum) * 100).toFixed(1);
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('Please enter an idea title.');
      return;
    }
    if (!symbol.trim()) {
      alert('Please enter a ticker symbol.');
      return;
    }

    const payload = {
      title: title.trim(),
      symbol: symbol.trim().toUpperCase(),
      type,
      timeframe,
      entryPrice: entryNum > 0 ? entryNum : null,
      targetPrice: targetNum > 0 ? targetNum : null,
      stopLoss: stopNum > 0 ? stopNum : null,
      confidenceScore,
      status,
      content: content.trim(),
      tags: tags.join(', '),
    };

    if (isEditing && ideaToEdit) {
      await updateMutation.mutateAsync({ id: ideaToEdit.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (ideaToEdit) {
      await deleteMutation.mutateAsync(ideaToEdit.id);
      onClose();
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border border-border/70 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-accent/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {isEditing ? `Edit Trade Idea: ${ideaToEdit?.symbol}` : 'New Trade Idea'}
                  {isEditing && (
                    <Badge variant="outline" className="text-xs uppercase font-mono">
                      {ideaToEdit?.source === 'AI_AGENT' ? '🤖 AI Generated' : '✍️ Manual'}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Formulate a structured investment thesis with entry targets, stop loss, and catalysts.
                </DialogDescription>
              </div>
            </div>

            {/* Sentiment Selector */}
            <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setType('BULLISH')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  type === 'BULLISH'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Bullish
              </button>
              <button
                type="button"
                onClick={() => setType('NEUTRAL')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  type === 'NEUTRAL'
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Minus className="w-3.5 h-3.5" /> Neutral
              </button>
              <button
                type="button"
                onClick={() => setType('BEARISH')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  type === 'BEARISH'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <TrendingDown className="w-3.5 h-3.5" /> Bearish
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          {/* Title & Ticker Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Ticker Symbol
              </label>
              <Input
                placeholder="e.g. NVDA"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="font-mono font-bold uppercase bg-background/50 border-border/70 text-base"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Idea Title / Core Hook
              </label>
              <Input
                placeholder="e.g. Blackwell Architecture Ramp & Hyperscaler Capex Surge"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background/50 border-border/70 font-semibold"
              />
            </div>
          </div>

          {/* Timeframe, Confidence & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-accent/15 p-4 rounded-xl border border-border/40">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" /> Timeframe
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="w-full bg-background border border-border/70 rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
              >
                <option value="SHORT_TERM">⚡ Short Term (1–10 Days)</option>
                <option value="SWING">🌊 Swing Trade (2–8 Weeks)</option>
                <option value="LONG_TERM">🏛️ Long Term (1+ Years)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Conviction Score ({confidenceScore}%)
              </label>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={confidenceScore}
                  onChange={(e) => setConfidenceScore(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <span className="font-mono text-xs font-bold w-9 text-right text-foreground">
                  {confidenceScore}%
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Target className="w-3 h-3 text-emerald-400" /> Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-background border border-border/70 rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
              >
                <option value="ACTIVE">🟢 Active Trade</option>
                <option value="WATCHING">👀 Watching / Pending Entry</option>
                <option value="PLAYED_OUT">✅ Target Hit / Played Out</option>
                <option value="ARCHIVED">📦 Archived</option>
              </select>
            </div>
          </div>

          {/* Pricing & Risk Management Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" /> Execution & Risk Parameters
              </label>
              {riskRewardRatio && (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    R:R = {riskRewardRatio} : 1
                  </Badge>
                  {potentialGainPercent && (
                    <span className="text-emerald-400 font-semibold">+{potentialGainPercent}%</span>
                  )}
                  {potentialLossPercent && (
                    <span className="text-rose-400 font-semibold">-{potentialLossPercent}%</span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-muted-foreground font-semibold">Entry $</span>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="pl-16 font-mono bg-background/50 border-border/70"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-emerald-400 font-semibold">Target $</span>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="pl-16 font-mono bg-background/50 border-emerald-500/30 text-emerald-300"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-rose-400 font-semibold">Stop $</span>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="pl-16 font-mono bg-background/50 border-rose-500/30 text-rose-300"
                />
              </div>
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-primary" /> Strategy Tags
            </label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="text-xs px-2.5 py-0.5 gap-1.5 bg-primary/10 text-primary border border-primary/20"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-destructive text-[10px]"
                  >
                    ×
                  </button>
                </Badge>
              ))}

              <div className="inline-flex items-center gap-1">
                <Input
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  className="h-7 w-28 text-xs bg-background/50 border-border/70"
                />
              </div>
            </div>

            {/* Preset Tag Chips */}
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-[10px] text-muted-foreground mr-1 self-center">Suggested:</span>
              {PRESET_TAGS.filter((t) => !tags.includes(t))
                .slice(0, 6)
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleAddTag(t)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-accent/40 hover:bg-accent text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
                  >
                    +{t}
                  </button>
                ))}
            </div>
          </div>

          {/* Content / Markdown Thesis */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" /> Investment Thesis & Catalysts (Markdown)
                </label>
                {/* Template picker */}
                <select
                  onChange={(e) => {
                    const found = TEMPLATES.find((t) => t.name === e.target.value);
                    if (found) setContent(found.text);
                  }}
                  className="bg-accent/40 border border-border/60 text-[10px] rounded px-2 py-0.5 text-muted-foreground focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Insert template...
                  </option>
                  {TEMPLATES.map((tpl) => (
                    <option key={tpl.name} value={tpl.name}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Edit vs Preview Toggle */}
              <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all',
                    activeTab === 'edit'
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all',
                    activeTab === 'preview'
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Eye className="w-3 h-3" /> Preview
                </button>
              </div>
            </div>

            {activeTab === 'edit' ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your investment thesis, catalysts, key risks, and trade invalidation rules..."
                className="min-h-[220px] font-mono text-xs leading-relaxed bg-background/50 border-border/70 focus:border-primary/50"
              />
            ) : (
              <div className="min-h-[220px] p-4 rounded-xl bg-background/40 border border-border/70 overflow-y-auto prose prose-invert prose-xs max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground">
                {content ? (
                  <ReactMarkdown>{content}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground italic text-xs">No thesis content entered yet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t border-border/50 bg-accent/10 flex items-center justify-between">
          <div>
            {isEditing && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-400 font-semibold">Delete idea?</span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="h-8 text-xs"
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 gap-1.5 h-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="h-9 px-4 text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> {isEditing ? 'Update Idea' : 'Save Idea'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
