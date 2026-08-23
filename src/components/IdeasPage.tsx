import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Lightbulb,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  Bot,
  User,
  Clock,
  Target,
  ShieldAlert,
  Loader2,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  CheckCircle2,
  Trash2,
  Edit3,
  SlidersHorizontal,
  Compass,
  ArrowUpDown,
  LayoutGrid,
  ListTree,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  TradeIdea,
  useTradeIdeas,
  useDeleteTradeIdea,
} from '@/services/ideaService';
import { IdeaModal } from './IdeaModal';
import { AIIdeaGeneratorModal } from './AIIdeaGeneratorModal';
import { IdeaDetailModal } from './IdeaDetailModal';
import {
  MARKET_THEMES,
  DEFAULT_THEME,
  MarketThemeDefinition,
  getIdeaMarketTheme,
  calculatePotentialROI,
} from '@/utils/ideaThemeUtils';

interface IdeasPageProps {
  onNavigateToResearch?: (symbol: string) => void;
}

export type IdeaSortOption = 'CONFIDENCE' | 'DATE' | 'POTENTIAL_ROI' | 'THEME' | 'SYMBOL';
export type IdeaViewMode = 'GRID' | 'GROUPED';

export function IdeasPage({ onNavigateToResearch }: IdeasPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'>('ALL');
  const [filterSource, setFilterSource] = useState<'ALL' | 'AI_AGENT' | 'MANUAL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'WATCHING' | 'PLAYED_OUT' | 'ARCHIVED'>('ALL');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<IdeaSortOption>('CONFIDENCE');
  const [viewMode, setViewMode] = useState<IdeaViewMode>('GRID');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Modal States
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedIdeaForDetail, setSelectedIdeaForDetail] = useState<TradeIdea | null>(null);
  const [ideaToEdit, setIdeaToEdit] = useState<TradeIdea | null>(null);

  const { data: rawIdeas = [], isLoading, isError, refetch } = useTradeIdeas({
    type: filterType,
    source: filterSource,
    status: filterStatus,
    search: searchQuery,
  });

  const deleteMutation = useDeleteTradeIdea();

  // Map each idea with its classified Market Theme and potential ROI
  const ideasWithTheme = useMemo(() => {
    return rawIdeas.map((idea) => ({
      ...idea,
      marketTheme: getIdeaMarketTheme(idea),
      potentialROI: calculatePotentialROI(idea),
    }));
  }, [rawIdeas]);

  // Aggregate theme counts across the loaded dataset
  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: rawIdeas.length };
    for (const theme of MARKET_THEMES) {
      counts[theme.id] = 0;
    }
    counts[DEFAULT_THEME.id] = 0;

    for (const item of ideasWithTheme) {
      const themeId = item.marketTheme.id;
      counts[themeId] = (counts[themeId] || 0) + 1;
    }
    return counts;
  }, [ideasWithTheme, rawIdeas.length]);

  // Filter ideas by selected Market Theme
  const filteredIdeas = useMemo(() => {
    if (selectedThemeId === 'ALL') return ideasWithTheme;
    return ideasWithTheme.filter((idea) => idea.marketTheme.id === selectedThemeId);
  }, [ideasWithTheme, selectedThemeId]);

  // Sort filtered ideas
  const sortedIdeas = useMemo(() => {
    return [...filteredIdeas].sort((a, b) => {
      if (sortBy === 'CONFIDENCE') {
        return (b.confidenceScore || 0) - (a.confidenceScore || 0);
      }
      if (sortBy === 'DATE') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'POTENTIAL_ROI') {
        return (b.potentialROI || 0) - (a.potentialROI || 0);
      }
      if (sortBy === 'THEME') {
        return a.marketTheme.name.localeCompare(b.marketTheme.name);
      }
      if (sortBy === 'SYMBOL') {
        return a.symbol.localeCompare(b.symbol);
      }
      return 0;
    });
  }, [filteredIdeas, sortBy]);

  // Group ideas by Market Theme (for Grouped View mode)
  const groupedIdeas = useMemo(() => {
    const groups: { theme: MarketThemeDefinition; items: typeof sortedIdeas }[] = [];

    for (const theme of [...MARKET_THEMES, DEFAULT_THEME]) {
      const items = sortedIdeas.filter((idea) => idea.marketTheme.id === theme.id);
      if (items.length > 0) {
        groups.push({ theme, items });
      }
    }
    return groups;
  }, [sortedIdeas]);

  // Aggregate stats from the full list
  const bullishCount = rawIdeas.filter((i) => i.type === 'BULLISH').length;
  const bearishCount = rawIdeas.filter((i) => i.type === 'BEARISH').length;
  const aiCount = rawIdeas.filter((i) => i.source === 'AI_AGENT').length;
  const activeCount = rawIdeas.filter((i) => i.status === 'ACTIVE').length;

  const toggleGroupCollapse = (themeId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [themeId]: !prev[themeId] }));
  };

  const handleEditClick = (idea: TradeIdea, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIdeaToEdit(idea);
    setIsWriteModalOpen(true);
  };

  const handleCardClick = (idea: TradeIdea) => {
    setSelectedIdeaForDetail(idea);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-24">
      {/* Header with Title and Primary Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
                Trading Ideas Pipeline
              </h1>
              <p className="text-sm text-muted-foreground">
                Discover high-conviction trade setups filtered by market themes, macro catalysts & autonomous AI agent scans.
              </p>
            </div>
          </div>
        </div>

        {/* Dual Primary Actions: 1) AI Idea Hunter 2) Manual Writing */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* AI Idea Hunter Agent Button */}
          <Button
            onClick={() => setIsAIModalOpen(true)}
            className="h-10 px-4 gap-2 font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            AI Idea Hunter
          </Button>

          {/* Write Idea Button */}
          <Button
            variant="default"
            onClick={() => {
              setIdeaToEdit(null);
              setIsWriteModalOpen(true);
            }}
            className="h-10 px-4 gap-2 font-semibold text-xs shadow-md"
          >
            <Plus className="w-4 h-4" />
            Write Trade Idea
          </Button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="bg-card/50 backdrop-blur-md border-border/60 hover:border-primary/30 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                Total Ideas
              </p>
              <p className="text-2xl font-black font-mono text-foreground">{rawIdeas.length}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md border-border/60 hover:border-emerald-500/30 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90 mb-0.5">
                Bullish
              </p>
              <p className="text-2xl font-black font-mono text-emerald-400">{bullishCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md border-border/60 hover:border-rose-500/30 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400/90 mb-0.5">
                Bearish
              </p>
              <p className="text-2xl font-black font-mono text-rose-400">{bearishCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md border-border/60 hover:border-purple-500/30 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400/90 mb-0.5">
                AI Agent
              </p>
              <p className="text-2xl font-black font-mono text-purple-400">{aiCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1 bg-card/50 backdrop-blur-md border-border/60 hover:border-primary/30 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                Active Setups
              </p>
              <p className="text-2xl font-black font-mono text-foreground">{activeCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-accent text-muted-foreground">
              <Target className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Themes Horizontal Filter Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-primary" /> Filter by Market Theme
          </label>
          <span className="text-[11px] text-muted-foreground font-mono">
            Showing {sortedIdeas.length} of {rawIdeas.length} ideas
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {/* ALL Themes Chip */}
          <button
            type="button"
            onClick={() => setSelectedThemeId('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border',
              selectedThemeId === 'ALL'
                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                : 'bg-card/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-accent/40'
            )}
          >
            <span>🌐 All Themes</span>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] px-1.5 py-0 h-4 font-mono font-bold',
                selectedThemeId === 'ALL' ? 'bg-primary-foreground/20 text-white' : 'bg-background/80 text-muted-foreground'
              )}
            >
              {themeCounts.ALL || 0}
            </Badge>
          </button>

          {/* Theme-Specific Chips */}
          {MARKET_THEMES.map((theme) => {
            const count = themeCounts[theme.id] || 0;
            const isSelected = selectedThemeId === theme.id;
            const Icon = theme.icon;

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedThemeId(theme.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border',
                  isSelected
                    ? cn(theme.colorClass.bg, theme.colorClass.text, theme.colorClass.border, 'ring-1 ring-primary/40 shadow-sm')
                    : 'bg-card/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-accent/40'
                )}
              >
                <span>{theme.emoji}</span>
                <span>{theme.shortName}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 h-4 font-mono font-bold',
                    isSelected
                      ? theme.colorClass.badge
                      : 'bg-background/50 border-border/60 text-muted-foreground'
                  )}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter, Sort & Search Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card/60 backdrop-blur-md p-3.5 rounded-2xl border border-border/60 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by symbol, theme, catalyst, thesis, or #tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/60 border-border/60 focus:border-primary/50 text-xs h-9"
          />
        </div>

        {/* Filters & Sorting Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sentiment Filter Tabs */}
          <div className="flex items-center bg-background/70 p-1 rounded-xl border border-border/60">
            {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all capitalize',
                  filterType === type
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {type.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-background/80 border border-border/60 rounded-xl px-2.5 h-9">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as IdeaSortOption)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="CONFIDENCE">🎯 Confidence Score</option>
              <option value="DATE">📅 Date (Newest)</option>
              <option value="POTENTIAL_ROI">🚀 Highest Upside ROI</option>
              <option value="THEME">🏷️ Market Theme (A–Z)</option>
              <option value="SYMBOL">🔤 Symbol (A–Z)</option>
            </select>
          </div>

          {/* Source Filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as any)}
            className="bg-background/80 border border-border/60 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer h-9"
          >
            <option value="ALL">All Sources</option>
            <option value="AI_AGENT">🤖 AI Agent</option>
            <option value="MANUAL">✍️ Manual</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-background/80 border border-border/60 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer h-9"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">🟢 Active</option>
            <option value="WATCHING">👀 Watching</option>
            <option value="PLAYED_OUT">✅ Played Out</option>
            <option value="ARCHIVED">📦 Archived</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-background/70 p-0.5 rounded-xl border border-border/60 h-9">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={cn(
                'p-1.5 rounded-lg text-xs transition-all',
                viewMode === 'GRID' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Standard Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GROUPED')}
              className={cn(
                'p-1.5 rounded-lg text-xs transition-all',
                viewMode === 'GROUPED' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Group by Market Theme"
            >
              <ListTree className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Ideas Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse font-medium">
            Fetching trade theses & live market valuations...
          </p>
        </div>
      ) : isError ? (
        <Card className="p-8 text-center bg-destructive/5 border-destructive/20">
          <p className="text-destructive font-semibold mb-2">Failed to load trade ideas</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
            Retry
          </Button>
        </Card>
      ) : sortedIdeas.length === 0 ? (
        <Card className="p-12 text-center bg-card/30 border-dashed border-2 border-border/60">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-4">
            <Lightbulb className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">No Trade Ideas Found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            {searchQuery || filterType !== 'ALL' || filterSource !== 'ALL' || selectedThemeId !== 'ALL'
              ? 'No trade ideas matched your active filters. Try clearing theme filters or broadening your search.'
              : 'Start your trading pipeline by deploying the AI Idea Hunter or writing your first investment thesis.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {selectedThemeId !== 'ALL' && (
              <Button
                variant="outline"
                onClick={() => setSelectedThemeId('ALL')}
                className="text-xs"
              >
                Clear Theme Filter
              </Button>
            )}
            <Button
              onClick={() => setIsAIModalOpen(true)}
              className="gap-2 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Summon AI Hunter
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIdeaToEdit(null);
                setIsWriteModalOpen(true);
              }}
              className="gap-2 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Write Idea
            </Button>
          </div>
        </Card>
      ) : viewMode === 'GROUPED' ? (
        /* ================= GROUPED BY THEME VIEW ================= */
        <div className="space-y-8">
          {groupedIdeas.map(({ theme, items }) => {
            const isCollapsed = collapsedGroups[theme.id];
            const Icon = theme.icon;

            return (
              <div key={theme.id} className="space-y-4">
                {/* Themed Section Header */}
                <div
                  onClick={() => toggleGroupCollapse(theme.id)}
                  className={cn(
                    'p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all',
                    theme.colorClass.bg,
                    theme.colorClass.border,
                    'hover:opacity-90'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-xl bg-gradient-to-br text-white shadow-sm', theme.colorClass.gradient)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">{theme.name}</h3>
                        <Badge variant="outline" className={cn('text-[10px] font-mono font-bold px-2 py-0', theme.colorClass.badge)}>
                          {items.length} {items.length === 1 ? 'Idea' : 'Ideas'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{theme.shortName} setup cluster</p>
                    </div>
                  </div>

                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Grouped Grid */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {items.map((idea, index) => renderIdeaCard(idea, index))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= STANDARD GRID VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedIdeas.map((idea, index) => renderIdeaCard(idea, index))}
        </div>
      )}

      {/* Idea Creation / Editing Modal */}
      <IdeaModal
        isOpen={isWriteModalOpen}
        onClose={() => {
          setIsWriteModalOpen(false);
          setIdeaToEdit(null);
        }}
        ideaToEdit={ideaToEdit}
      />

      {/* AI Idea Hunter Modal */}
      <AIIdeaGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
      />

      {/* Full Idea Detail Modal */}
      <IdeaDetailModal
        isOpen={Boolean(selectedIdeaForDetail)}
        onClose={() => setSelectedIdeaForDetail(null)}
        idea={selectedIdeaForDetail}
        onEdit={(idea) => {
          setIdeaToEdit(idea);
          setIsWriteModalOpen(true);
        }}
        onNavigateResearch={onNavigateToResearch}
      />
    </div>
  );

  // Helper to render individual Idea Card
  function renderIdeaCard(idea: typeof ideasWithTheme[0], index: number) {
    const isBullish = idea.type === 'BULLISH';
    const isBearish = idea.type === 'BEARISH';
    const isAIGenerated = idea.source === 'AI_AGENT';
    const theme = idea.marketTheme;

    const tagsList = idea.tags
      ? idea.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    // Calculate Risk/Reward ratio
    let rrRatio: string | null = null;
    if (idea.entryPrice && idea.targetPrice && idea.stopLoss) {
      const reward = Math.abs(idea.targetPrice - idea.entryPrice);
      const risk = Math.abs(idea.entryPrice - idea.stopLoss);
      if (risk > 0) rrRatio = (reward / risk).toFixed(1);
    }

    return (
      <Card
        key={idea.id}
        onClick={() => handleCardClick(idea)}
        className="group relative overflow-hidden bg-card/60 hover:bg-card/90 backdrop-blur-xl border border-border/70 hover:border-primary/40 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
        style={{ animationDelay: `${index * 40}ms` }}
      >
        {/* Top Glowing Gradient accent line based on Sentiment */}
        <div
          className={cn(
            'h-1 w-full',
            isBullish
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
              : isBearish
              ? 'bg-gradient-to-r from-rose-500 via-pink-400 to-rose-600'
              : 'bg-gradient-to-r from-primary via-indigo-400 to-primary'
          )}
        />

        <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
          {/* Card Header: Symbol, Sentiment, Market Theme & Live Price */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-sm border shadow-sm',
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
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base tracking-tight text-foreground font-mono">
                      {idea.symbol}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border',
                        isBullish
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : isBearish
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-primary/10 text-primary border-primary/30'
                      )}
                    >
                      {idea.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                    {idea.stockName || idea.symbol}
                  </p>
                </div>
              </div>

              {/* Right: Live Price & Day Change */}
              {idea.currentPrice ? (
                <div className="text-right">
                  <span className="font-mono font-black text-sm text-foreground block">
                    ${idea.currentPrice.toFixed(2)}
                  </span>
                  {idea.dayChangePercent !== undefined && idea.dayChangePercent !== null && (
                    <span
                      className={cn(
                        'text-[10px] font-mono font-bold flex items-center justify-end',
                        idea.dayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {idea.dayChangePercent >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 inline" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 inline" />
                      )}
                      {Math.abs(idea.dayChangePercent).toFixed(2)}%
                    </span>
                  )}
                </div>
              ) : (
                idea.confidenceScore && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono text-[10px]">
                    {idea.confidenceScore}% Conf
                  </Badge>
                )
              )}
            </div>

            {/* Market Theme Pill */}
            <div className="mb-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-md border gap-1 font-sans',
                  theme.colorClass.badge
                )}
              >
                <span>{theme.emoji}</span>
                <span>{theme.shortName}</span>
              </Badge>
            </div>

            {/* Title */}
            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug mb-2">
              {idea.title}
            </h3>

            {/* Truncated Markdown Thesis Preview */}
            <div className="text-xs text-muted-foreground/90 line-clamp-3 leading-relaxed mb-3 font-normal prose-sm">
              {idea.content ? (
                idea.content.replace(/###|##|#|\*\*|\*/g, '').slice(0, 180)
              ) : (
                <span className="italic">No detailed thesis written.</span>
              )}
            </div>
          </div>

          {/* Pricing / Risk Strip */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="grid grid-cols-3 gap-2 text-center bg-accent/20 p-2 rounded-xl border border-border/40">
              <div>
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Entry</span>
                <span className="font-mono text-xs font-bold text-foreground">
                  {idea.entryPrice ? `$${idea.entryPrice.toFixed(1)}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-emerald-400 block">Target</span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {idea.targetPrice ? `$${idea.targetPrice.toFixed(1)}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-rose-400 block">Stop</span>
                <span className="font-mono text-xs font-bold text-rose-400">
                  {idea.stopLoss ? `$${idea.stopLoss.toFixed(1)}` : '—'}
                </span>
              </div>
            </div>

            {/* Meta: Source, R:R, Potential ROI & Quick Edit */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isAIGenerated ? (
                  <Badge
                    variant="outline"
                    className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[9px] px-1.5 py-0 h-4 font-mono uppercase"
                  >
                    <Bot className="w-2.5 h-2.5 mr-1" /> AI Agent
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-muted text-muted-foreground border-border text-[9px] px-1.5 py-0 h-4 font-mono uppercase"
                  >
                    <User className="w-2.5 h-2.5 mr-1" /> Manual
                  </Badge>
                )}

                {rrRatio && (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0 h-4 font-mono"
                  >
                    {rrRatio}:1 R:R
                  </Badge>
                )}

                {idea.potentialROI > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25 text-[9px] px-1.5 py-0 h-4 font-mono font-bold"
                  >
                    +{idea.potentialROI.toFixed(0)}% ROI
                  </Badge>
                )}
              </div>

              {/* Quick Edit Action on Card */}
              <button
                type="button"
                onClick={(e) => handleEditClick(idea, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                title="Edit Idea"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tag Chips */}
            {tagsList.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {tagsList.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-accent/40 text-muted-foreground border border-border/30"
                  >
                    #{tag}
                  </span>
                ))}
                {tagsList.length > 3 && (
                  <span className="text-[10px] text-muted-foreground self-center">
                    +{tagsList.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
}
