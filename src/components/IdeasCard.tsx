import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Lightbulb, TrendingDown, TrendingUp, Minus, Bot, Sparkles, Plus, Loader2, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useTradeIdeas } from '@/services/ideaService';
import { IdeaModal } from './IdeaModal';
import { IdeaDetailModal } from './IdeaDetailModal';
import { AIIdeaGeneratorModal } from './AIIdeaGeneratorModal';
import { getIdeaMarketTheme } from '@/utils/ideaThemeUtils';

interface IdeasCardProps {
  onNavigateToIdeas?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function IdeasCard({ onNavigateToIdeas, onNavigateToResearch }: IdeasCardProps) {
  const { data: ideas = [], isLoading } = useTradeIdeas();
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BULLISH':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'BEARISH':
        return <TrendingDown className="w-4 h-4 text-rose-400" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BULLISH':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'BEARISH':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in border border-border/70">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Lightbulb className="w-4 h-4" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Trading Ideas</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onNavigateToIdeas && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToIdeas}
              className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 font-semibold"
              title="Open full Trading Ideas Pipeline"
            >
              <span>All Ideas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAIModalOpen(true)}
            className="h-8 text-xs gap-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            title="Deploy AI Idea Hunter"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">AI Hunter</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsWriteModalOpen(true)}
            className="h-8 text-xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-xs text-muted-foreground">No trading ideas logged yet.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAIModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Summon AI Agent
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.slice(0, 3).map((idea) => {
            const tagsList = idea.tags
              ? idea.tags.split(',').map((t) => t.trim()).filter(Boolean)
              : [];
            const theme = getIdeaMarketTheme(idea);

            return (
              <div
                key={idea.id}
                onClick={() => setSelectedIdea(idea)}
                className="p-4 rounded-xl bg-accent/20 hover:bg-accent/40 border border-border/50 hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground ticker-symbol font-mono">
                      {idea.symbol}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border',
                        getTypeColor(idea.type)
                      )}
                    >
                      {idea.type}
                    </span>
                    {idea.source === 'AI_AGENT' && (
                      <Badge
                        variant="outline"
                        className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[9px] px-1 py-0 h-4 font-mono"
                      >
                        <Bot className="w-2.5 h-2.5 mr-0.5" /> AI
                      </Badge>
                    )}
                  </div>
                  {getTypeIcon(idea.type)}
                </div>

                <div className="mb-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] font-semibold px-1.5 py-0 h-4 rounded border gap-1',
                      theme.colorClass.badge
                    )}
                  >
                    <span>{theme.emoji}</span>
                    <span>{theme.shortName}</span>
                  </Badge>
                </div>

                <h4 className="font-semibold text-sm text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                  {idea.title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed">
                  {idea.content ? idea.content.replace(/###|##|#|\*\*|\*/g, '') : ''}
                </p>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex gap-1 flex-wrap">
                    {tagsList.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] font-mono">
                    {new Date(idea.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <IdeaModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
      />

      <AIIdeaGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
      />

      <IdeaDetailModal
        isOpen={Boolean(selectedIdea)}
        onClose={() => setSelectedIdea(null)}
        idea={selectedIdea}
        onEdit={(idea) => {
          setSelectedIdea(null);
          setIsWriteModalOpen(true);
        }}
        onNavigateResearch={onNavigateToResearch}
      />
    </div>
  );
}
