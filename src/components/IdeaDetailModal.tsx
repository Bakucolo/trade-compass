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
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Edit3,
  Trash2,
  Tag,
  Clock,
  Target,
  ShieldAlert,
  DollarSign,
  Calendar,
  ExternalLink,
  Bot,
  User,
  Loader2,
  Search,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { TradeIdea, useDeleteTradeIdea, useUpdateTradeIdea } from '@/services/ideaService';
import { TradeStructureModal } from './TradeStructureModal';

interface IdeaDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  idea: TradeIdea | null;
  onEdit: (idea: TradeIdea) => void;
  onNavigateResearch?: (symbol: string) => void;
}

export function IdeaDetailModal({
  isOpen,
  onClose,
  idea,
  onEdit,
  onNavigateResearch,
}: IdeaDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const deleteMutation = useDeleteTradeIdea();
  const updateMutation = useUpdateTradeIdea();

  if (!idea) return null;

  const isBullish = idea.type === 'BULLISH';
  const isBearish = idea.type === 'BEARISH';

  const entry = idea.entryPrice ?? null;
  const target = idea.targetPrice ?? null;
  const stop = idea.stopLoss ?? null;
  const current = idea.currentPrice ?? null;

  // Calculate live progress percentage towards target
  let progressPercent = 50;
  if (entry && target && current) {
    if (isBullish && target > entry) {
      progressPercent = Math.min(100, Math.max(0, ((current - (stop || entry * 0.9)) / (target - (stop || entry * 0.9))) * 100));
    } else if (isBearish && entry > target) {
      progressPercent = Math.min(100, Math.max(0, (((stop || entry * 1.1) - current) / ((stop || entry * 1.1) - target)) * 100));
    }
  }

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(idea.id);
    onClose();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateMutation.mutateAsync({ id: idea.id, status: newStatus });
  };

  const tagsList = idea.tags
    ? idea.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-accent/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-black text-lg border shadow-lg',
                  isBullish
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : isBearish
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : 'bg-primary/15 text-primary border-primary/30'
                )}
              >
                {idea.symbol.slice(0, 4)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                    {idea.symbol}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      isBullish
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : isBearish
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-primary/10 text-primary border-primary/30'
                    )}
                  >
                    {isBullish ? <TrendingUp className="w-3 h-3 mr-1 inline" /> : isBearish ? <TrendingDown className="w-3 h-3 mr-1 inline" /> : <Minus className="w-3 h-3 mr-1 inline" />}
                    {idea.type}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] font-mono uppercase bg-accent">
                    {idea.source === 'AI_AGENT' ? (
                      <span className="flex items-center gap-1 text-purple-400">
                        <Bot className="w-3 h-3" /> AI Agent
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <User className="w-3 h-3" /> Manual
                      </span>
                    )}
                  </Badge>
                  {idea.confidenceScore && (
                    <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border-amber-500/30">
                      <Sparkles className="w-2.5 h-2.5 mr-1" /> {idea.confidenceScore}% Conviction
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {idea.stockName ? `${idea.stockName} • ` : ''}
                  Created {new Date(idea.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </DialogDescription>
              </div>
            </div>

            {/* Current Price Display */}
            {current && (
              <div className="text-left sm:text-right bg-background/50 px-3.5 py-2 rounded-xl border border-border/60">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Live Price
                </span>
                <span className="text-xl font-black font-mono text-foreground">
                  ${current.toFixed(2)}
                </span>
                {idea.dayChangePercent !== undefined && idea.dayChangePercent !== null && (
                  <span
                    className={cn(
                      'text-xs font-mono font-semibold block',
                      idea.dayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}
                  >
                    {idea.dayChangePercent >= 0 ? '+' : ''}
                    {idea.dayChangePercent.toFixed(2)}% Today
                  </span>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Main Idea Title */}
          <div>
            <h3 className="text-lg font-bold text-foreground leading-snug">
              {idea.title}
            </h3>
          </div>

          {/* Trade Execution Strip (Entry, Stop, Target, PnL) */}
          {(entry || target || stop) && (
            <div className="p-4 rounded-xl bg-accent/20 border border-border/60 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {entry && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Entry Price
                    </span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      ${entry.toFixed(2)}
                    </span>
                  </div>
                )}
                {target && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block flex items-center gap-1">
                      <Target className="w-3 h-3" /> Target Price
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      ${target.toFixed(2)}
                      {idea.targetDistancePercent !== undefined && idea.targetDistancePercent !== null && (
                        <span className="text-[10px] ml-1 opacity-80">
                          ({idea.targetDistancePercent >= 0 ? '+' : ''}{idea.targetDistancePercent.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {stop && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Stop Loss
                    </span>
                    <span className="font-mono text-sm font-bold text-rose-400">
                      ${stop.toFixed(2)}
                      {idea.stopDistancePercent !== undefined && idea.stopDistancePercent !== null && (
                        <span className="text-[10px] ml-1 opacity-80">
                          ({idea.stopDistancePercent.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {idea.pnlPercent !== undefined && idea.pnlPercent !== null && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Current Return
                    </span>
                    <span
                      className={cn(
                        'font-mono text-sm font-black',
                        idea.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {idea.pnlPercent >= 0 ? '+' : ''}
                      {idea.pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar towards Target */}
              {entry && target && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Stop: ${stop?.toFixed(2) || 'N/A'}</span>
                    <span>Entry: ${entry.toFixed(2)}</span>
                    <span className="text-emerald-400 font-semibold">Target: ${target.toFixed(2)}</span>
                  </div>
                  <div className="relative h-2 bg-accent rounded-full overflow-hidden border border-border/40">
                    <div
                      className={cn(
                        'h-full transition-all duration-500 rounded-full',
                        isBullish
                          ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500'
                          : 'bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500'
                      )}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status & Timeframe Chips */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground font-semibold">Status:</span>
            <select
              value={idea.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-background border border-border/70 rounded-lg px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="ACTIVE">🟢 Active</option>
              <option value="WATCHING">👀 Watching</option>
              <option value="PLAYED_OUT">✅ Target Reached / Played Out</option>
              <option value="ARCHIVED">📦 Archived</option>
            </select>

            <span className="text-border mx-1">|</span>

            <span className="text-muted-foreground font-semibold">Timeframe:</span>
            <Badge variant="secondary" className="text-xs font-mono capitalize">
              <Clock className="w-3 h-3 mr-1" />
              {idea.timeframe?.toLowerCase().replace('_', ' ') || 'Swing'}
            </Badge>
          </div>

          {/* Tags */}
          {tagsList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {tagsList.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Markdown Content / Thesis */}
          <div className="p-5 rounded-xl bg-background/40 border border-border/60">
            <div className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-headings:text-foreground prose-headings:tracking-tight prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-a:text-primary">
              {idea.content ? (
                <ReactMarkdown>{idea.content}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic text-xs">No thesis text documented.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/50 bg-accent/10 flex items-center justify-between">
          <div>
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
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setIsStructureModalOpen(true)}
              className="h-9 px-3.5 text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 gap-1.5"
              title="Summon AI Agent to structure multi-approach execution plans (Stocks, Options, Collars, Spreads) and set entry alerts"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Structure Trade (AI)</span>
            </Button>

            {onNavigateResearch && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onNavigateResearch(idea.symbol);
                  onClose();
                }}
                className="h-9 text-xs gap-1.5 border-border/80 hover:bg-accent/40"
              >
                <Search className="w-3.5 h-3.5 text-primary" /> Research {idea.symbol}
              </Button>
            )}

            <Button
              type="button"
              onClick={() => {
                onClose();
                onEdit(idea);
              }}
              className="h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground shadow-md gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Idea
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* AI Trade Structuring Modal */}
      {isStructureModalOpen && (
        <TradeStructureModal
          isOpen={isStructureModalOpen}
          onClose={() => setIsStructureModalOpen(false)}
          idea={idea}
        />
      )}
    </Dialog>
  );
}
