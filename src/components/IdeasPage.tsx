import { ideas } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Lightbulb, Minus, Plus, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';

export function IdeasPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all');

  const filteredIdeas = ideas.filter((idea) => {
    const matchesSearch = 
      idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || idea.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bullish':
        return <TrendingUp className="w-5 h-5 text-success" />;
      case 'bearish':
        return <TrendingDown className="w-5 h-5 text-destructive" />;
      default:
        return <Minus className="w-5 h-5 text-muted-foreground" />;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trading Ideas</h1>
          <p className="text-muted-foreground">Document your research and trading hypotheses</p>
        </div>
        <Button variant="glow" className="gap-2">
          <Plus className="w-4 h-4" />
          New Idea
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="data-label mb-1">Total Ideas</p>
          <p className="text-2xl font-bold text-foreground">{ideas.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-success" />
            <p className="data-label">Bullish</p>
          </div>
          <p className="text-2xl font-bold text-success">{ideas.filter(i => i.type === 'bullish').length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <p className="data-label">Bearish</p>
          </div>
          <p className="text-2xl font-bold text-destructive">{ideas.filter(i => i.type === 'bearish').length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <Minus className="w-4 h-4 text-muted-foreground" />
            <p className="data-label">Neutral</p>
          </div>
          <p className="text-2xl font-bold text-muted-foreground">{ideas.filter(i => i.type === 'neutral').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search ideas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'bullish', 'bearish', 'neutral'] as const).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(type)}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Ideas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIdeas.map((idea, index) => (
          <div
            key={idea.id}
            className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all duration-300 cursor-pointer animate-slide-up group"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">
                    {idea.symbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-foreground ticker-symbol">{idea.symbol}</span>
                  <p className="text-xs text-muted-foreground">{idea.date}</p>
                </div>
              </div>
              <span className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full border capitalize",
                getTypeColor(idea.type)
              )}>
                {idea.type}
              </span>
            </div>

            <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
              {idea.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
              {idea.content}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded bg-accent text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
