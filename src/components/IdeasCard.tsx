import { ideas } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Lightbulb, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Button } from './ui/button';

export function IdeasCard() {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bullish':
        return 'bg-success/10 text-success border-success/20';
      case 'bearish':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-warning" />
          <h3 className="text-lg font-semibold text-foreground">Trading Ideas</h3>
        </div>
        <Button variant="outline" size="sm">
          New Idea
        </Button>
      </div>

      <div className="space-y-3">
        {ideas.map((idea) => (
          <div
            key={idea.id}
            className="p-4 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground ticker-symbol">{idea.symbol}</span>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full border",
                  getTypeColor(idea.type)
                )}>
                  {idea.type}
                </span>
              </div>
              {getTypeIcon(idea.type)}
            </div>
            
            <h4 className="font-medium text-foreground mb-1">{idea.title}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{idea.content}</p>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {idea.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded bg-accent text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{idea.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
