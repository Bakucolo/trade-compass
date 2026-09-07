import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Sparkles,
  Plus,
  Search,
  Trash2,
  Edit3,
  Calendar,
  Clock,
  Smartphone,
  CheckCircle2,
  Circle,
  Filter,
  Layers,
  Bot,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Lightbulb,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AppIdea,
  useAppIdeas,
  useToggleAppIdea,
  useCreateAppIdea,
  useUpdateAppIdea,
  useDeleteAppIdea,
} from '@/services/appIdeaService';
import { useTelegramBufferSync } from '@/services/thoughtLogService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AntigravityCodingModal } from './AntigravityCodingModal';

interface AppIdeasChecklistProps {
  onPlanFeatureWithAI?: (idea: AppIdea) => void;
}

export function AppIdeasChecklist({ onPlanFeatureWithAI }: AppIdeasChecklistProps) {
  // Query States
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'fulfilled'>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [antigravityIdea, setAntigravityIdea] = useState<AppIdea | null>(null);

  const { data, isLoading } = useAppIdeas({
    filter: activeFilter,
    topic: selectedTopic,
    search: searchQuery,
  });

  const toggleMutation = useToggleAppIdea();
  const createMutation = useCreateAppIdea();
  const updateMutation = useUpdateAppIdea();
  const deleteMutation = useDeleteAppIdea();
  const telegramSyncMutation = useTelegramBufferSync();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTopic, setNewTopic] = useState('App');
  const [newCategory, setNewCategory] = useState('Feature');

  // Edit Modal State
  const [editingIdea, setEditingIdea] = useState<AppIdea | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTopic, setEditTopic] = useState('App');
  const [editCategory, setEditCategory] = useState('Feature');

  const ideas = data?.ideas || [];
  const stats = data?.stats || { total: 0, pending: 0, fulfilled: 0, completionPercentage: 0 };
  const topicCounts = data?.topics || {};

  // Formatted date helper
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleToggle = async (idea: AppIdea) => {
    try {
      const res = await toggleMutation.mutateAsync(idea.id);
      if (res.isFulfilled) {
        toast.success(`Marked as fulfilled: "${idea.title}"`, {
          description: 'Great job! Checked off in your roadmap.',
        });
      } else {
        toast.info(`Moved back to pending: "${idea.title}"`);
      }
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Please enter an idea title');
      return;
    }

    try {
      await createMutation.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        topic: newTopic.trim() || 'App',
        category: newCategory,
      });

      toast.success(`Added new app idea: "${newTitle.trim()}"`);
      setIsCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewTopic('App');
      setNewCategory('Feature');
    } catch (err: any) {
      toast.error(`Failed to create idea: ${err.message}`);
    }
  };

  const handleOpenEdit = (idea: AppIdea) => {
    setEditingIdea(idea);
    setEditTitle(idea.title);
    setEditDescription(idea.description || '');
    setEditTopic(idea.topic || 'App');
    setEditCategory(idea.category || 'Feature');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIdea || !editTitle.trim()) return;

    try {
      await updateMutation.mutateAsync({
        id: editingIdea.id,
        data: {
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
          topic: editTopic.trim() || 'App',
          category: editCategory,
        },
      });

      toast.success('App idea updated');
      setEditingIdea(null);
    } catch (err: any) {
      toast.error(`Failed to update idea: ${err.message}`);
    }
  };

  const handleDelete = async (idea: AppIdea) => {
    if (!confirm(`Are you sure you want to delete "${idea.title}"?`)) return;
    try {
      await deleteMutation.mutateAsync(idea.id);
      toast.success('App idea deleted');
    } catch (err: any) {
      toast.error(`Failed to delete idea: ${err.message}`);
    }
  };

  const handleSyncTelegram = async () => {
    try {
      const res = await telegramSyncMutation.mutateAsync();
      if (res.consumedCount > 0) {
        toast.success(`Ingested ${res.consumedCount} ideas from Telegram!`);
      } else {
        toast.info(res.message || 'Telegram buffer is empty (0 new ideas).');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync with Telegram.');
    }
  };

  // Color helper for topics
  const getTopicBadgeStyle = (topic: string) => {
    const t = topic.toLowerCase();
    if (t.includes('ui') || t.includes('ux') || t.includes('design')) {
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }
    if (t.includes('portfolio') || t.includes('holdings')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (t.includes('alert')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    if (t.includes('bug') || t.includes('fix')) {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    if (t.includes('data') || t.includes('api')) {
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
    return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-card/80 via-card/50 to-background border border-border/70 p-5 rounded-2xl shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/25 via-purple-500/25 to-primary/25 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-inner">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground glow-text-white">
                App Ideas & Feature Backlog
              </h2>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono uppercase font-bold">
                Telegram #App Topic
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Messages and voice notes sent to your Telegram <strong>#App</strong> topic appear here automatically. Check them off as you build.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncTelegram}
            disabled={telegramSyncMutation.isPending}
            className="h-9 gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 font-bold text-xs"
            title="Poll Cloudflare buffer immediately"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", telegramSyncMutation.isPending && "animate-spin text-primary")} />
            <span>Sync Telegram</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-9 gap-1.5 bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:from-primary/90 hover:to-indigo-600/90 text-white font-bold text-xs shadow-md shadow-primary/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New App Idea</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card/60 border-border/60 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Ideas</div>
              <div className="text-2xl font-black text-foreground mt-0.5">{stats.total}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pending To-Do</div>
              <div className="text-2xl font-black text-amber-300 mt-0.5">{stats.pending}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60 backdrop-blur-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Fulfilled</span>
                <span className="text-[10px] text-muted-foreground font-mono">({stats.completionPercentage}%)</span>
              </div>
              <div className="text-2xl font-black text-emerald-300 mt-0.5">{stats.fulfilled}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Filter Controls & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 border border-border/60 p-3 rounded-xl backdrop-blur-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-background/80 p-1 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-md transition-all",
              activeFilter === 'all'
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
              activeFilter === 'pending'
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                : "text-muted-foreground hover:text-amber-300"
            )}
          >
            <Clock className="w-3 h-3" />
            <span>Pending ({stats.pending})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('fulfilled')}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
              activeFilter === 'fulfilled'
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-muted-foreground hover:text-emerald-300"
            )}
          >
            <Check className="w-3 h-3" />
            <span>Fulfilled ({stats.fulfilled})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ideas or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-background/80 border-border/60 rounded-lg focus:border-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Topic Filter Chips */}
      {Object.keys(topicCounts).length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Topic:
          </span>
          <button
            type="button"
            onClick={() => setSelectedTopic('ALL')}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 border",
              selectedTopic === 'ALL'
                ? "bg-primary/20 text-primary border-primary/50"
                : "bg-card/60 text-muted-foreground hover:text-foreground border-border/60"
            )}
          >
            All Topics ({stats.total})
          </button>
          {Object.entries(topicCounts).map(([topic, counts]) => (
            <button
              key={topic}
              type="button"
              onClick={() => setSelectedTopic(topic === selectedTopic ? 'ALL' : topic)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 border flex items-center gap-1",
                selectedTopic === topic
                  ? "bg-indigo-500/25 text-indigo-200 border-indigo-500/60 shadow-sm"
                  : "bg-card/60 text-muted-foreground hover:text-foreground border-border/60"
              )}
            >
              <span>{topic}</span>
              <span className="text-[10px] font-mono opacity-70">({counts.total})</span>
            </button>
          ))}
        </div>
      )}

      {/* 4. The Checklist Items Stream */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-medium">Loading app ideas...</p>
        </div>
      ) : ideas.length === 0 ? (
        <div className="py-16 px-4 text-center border border-dashed border-border/70 rounded-2xl bg-card/30 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-3">
            <Lightbulb className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">No ideas found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Send ideas to your Telegram <strong>#App</strong> topic in the Dashboard chat, or click below to add one manually.
          </p>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 gap-1.5 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First App Idea</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {ideas.map((idea) => {
            const isChecked = idea.isFulfilled;
            return (
              <div
                key={idea.id}
                className={cn(
                  "group relative p-4 rounded-xl border transition-all duration-200 flex items-start gap-3.5",
                  isChecked
                    ? "bg-card/30 border-border/40 opacity-75 hover:opacity-100"
                    : "bg-card/70 border-border/70 hover:border-primary/50 hover:bg-card/90 shadow-sm hover:shadow-md"
                )}
              >
                {/* 1. Large Animated Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggle(idea)}
                  disabled={toggleMutation.isPending}
                  className={cn(
                    "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer",
                    isChecked
                      ? "bg-emerald-500 border-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20"
                      : "border-muted-foreground/40 hover:border-primary bg-background/60 hover:scale-105"
                  )}
                  title={isChecked ? "Click to mark pending" : "Click to mark fulfilled"}
                >
                  {isChecked ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <div className="w-2 h-2 rounded-sm bg-transparent group-hover:bg-primary/40 transition-colors" />
                  )}
                </button>

                {/* 2. Content & Metadata */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Topic Badge, Date, Source */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Topic Badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.2 rounded-md uppercase tracking-wider",
                        getTopicBadgeStyle(idea.topic || 'App')
                      )}
                    >
                      {idea.topic || 'App'}
                    </Badge>

                    {/* Category if different */}
                    {idea.category && idea.category !== 'Feature' && (
                      <Badge variant="outline" className="text-[9.5px] px-1.5 py-0 font-medium bg-muted/30 text-muted-foreground border-border/60">
                        {idea.category}
                      </Badge>
                    )}

                    {/* Date */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                      <Calendar className="w-3 h-3 opacity-70" />
                      <span>{formatDate(idea.createdAt)}</span>
                      <span className="opacity-40">•</span>
                      <span>{formatTime(idea.createdAt)}</span>
                    </span>

                    {/* Source */}
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-accent/40 px-1.5 py-0.5 rounded-md">
                      {idea.source === 'TELEGRAM' ? (
                        <>
                          <Smartphone className="w-3 h-3 text-sky-400" />
                          <span className="text-sky-300 font-medium">Telegram</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Manual</span>
                      )}
                    </span>

                    {/* Fulfilled Badge */}
                    {isChecked && idea.fulfilledAt && (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        <span>Fulfilled {formatDate(idea.fulfilledAt)}</span>
                      </Badge>
                    )}
                  </div>

                  {/* Title */}
                  <h4
                    className={cn(
                      "text-sm font-bold tracking-tight text-foreground transition-all leading-snug",
                      isChecked && "line-through text-muted-foreground"
                    )}
                  >
                    {idea.title}
                  </h4>

                  {/* Description / Bullet Notes */}
                  {idea.description && (
                    <div
                      className={cn(
                        "text-xs text-muted-foreground/90 whitespace-pre-wrap rounded-lg bg-background/50 p-2.5 border border-border/40 font-mono text-[11.5px]",
                        isChecked && "opacity-75"
                      )}
                    >
                      {idea.description}
                    </div>
                  )}
                </div>

                {/* 3. Action Buttons */}
                <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity shrink-0">
                  {/* ANTIGRAVITY CODING BUTTON */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setAntigravityIdea(idea)}
                    className="h-7 px-2.5 text-[11px] font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm shadow-indigo-500/25 border-0 gap-1.5 transition-all"
                    title="Code this function with Antigravity AI agent"
                  >
                    <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                    <span>Code with Antigravity</span>
                  </Button>

                  {onPlanFeatureWithAI && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPlanFeatureWithAI(idea)}
                      className="h-7 px-2 text-[10.5px] font-bold text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/15 gap-1 border border-transparent hover:border-indigo-500/30"
                      title="Generate architectural implementation blueprint in Journal"
                    >
                      <Bot className="w-3 h-3 text-indigo-400" />
                      <span className="hidden md:inline">Plan</span>
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(idea)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    title="Edit idea"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(idea)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete idea"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: CREATE APP IDEA ================= */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span>Add New App Idea</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a feature request, bug, or idea to your backlog.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Idea Title *</label>
              <Input
                placeholder="e.g. Add dividend tracking calendar with ex-dividend dates"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Topic</label>
                <Input
                  placeholder="e.g. Portfolio, UI, Alerts, App"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Feature">Feature</option>
                  <option value="UI/UX">UI / UX</option>
                  <option value="Data">Data & API</option>
                  <option value="Integration">Integration</option>
                  <option value="Bug">Bug Fix</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Details & Notes (Optional)</label>
              <Textarea
                placeholder="Add bullet points, calculations, or context..."
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="text-xs resize-none font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
                className="text-xs font-bold bg-primary text-primary-foreground"
              >
                {createMutation.isPending ? 'Saving...' : 'Add Idea'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: EDIT APP IDEA ================= */}
      <Dialog open={Boolean(editingIdea)} onOpenChange={(open) => !open && setEditingIdea(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Edit3 className="w-4 h-4 text-primary" />
              <span>Edit App Idea</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Idea Title *</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Topic</label>
                <Input
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Feature">Feature</option>
                  <option value="UI/UX">UI / UX</option>
                  <option value="Data">Data & API</option>
                  <option value="Integration">Integration</option>
                  <option value="Bug">Bug Fix</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Details & Notes</label>
              <Textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="text-xs resize-none font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingIdea(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateMutation.isPending}
                className="text-xs font-bold bg-primary text-primary-foreground"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: CODE WITH ANTIGRAVITY ================= */}
      <AntigravityCodingModal
        isOpen={Boolean(antigravityIdea)}
        onOpenChange={(open) => !open && setAntigravityIdea(null)}
        idea={antigravityIdea}
      />
    </div>
  );
}
