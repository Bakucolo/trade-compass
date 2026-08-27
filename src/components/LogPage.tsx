import React, { useState, useEffect, useMemo } from 'react';
import {
  NotebookPen,
  Sparkles,
  Plus,
  Search,
  Trash2,
  Pin,
  PinOff,
  TrendingUp,
  TrendingDown,
  Globe,
  ShieldAlert,
  HelpCircle,
  Layers,
  ArrowRight,
  Send,
  Loader2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Tag,
  Calendar,
  Save,
  RotateCcw,
  Zap,
  Activity,
  DollarSign,
  PieChart,
  Lightbulb,
  FileText,
  Clock,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  ThoughtLogRecord,
  AgentActionType,
  ThoughtLogMarketData,
  useThoughtLogs,
  useCreateThoughtLog,
  useUpdateThoughtLog,
  useDeleteThoughtLog,
  useRunThoughtAgent,
  useTelegramBufferSync,
  useThoughtLogFolders,
  extractSymbolsFromText,
} from '@/services/thoughtLogService';
import { Smartphone, FolderPlus, Folder, FolderOpen, Mic, ChevronDown } from 'lucide-react';
import { AddToWatchlistModal } from './AddToWatchlistModal';
import { MoveToFolderModal } from './MoveToFolderModal';
import { useSendTelegramReport } from '@/services/telegramReportClientService';

interface LogPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToIdeas?: () => void;
}

const SENTIMENT_OPTIONS = [
  { value: 'BULLISH', label: 'Bullish', color: 'emerald', icon: TrendingUp },
  { value: 'BEARISH', label: 'Bearish', color: 'rose', icon: TrendingDown },
  { value: 'NEUTRAL', label: 'Neutral', color: 'amber', icon: Activity },
  { value: 'MACRO', label: 'Macro Theme', color: 'indigo', icon: Globe },
  { value: 'CAUTION', label: 'High Risk / Caution', color: 'purple', icon: ShieldAlert },
];

const AGENT_ACTION_BUTTONS: Array<{
  id: AgentActionType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
}> = [
  {
    id: 'ADD_CONTEXT',
    label: 'Add Context & Live Data',
    shortLabel: 'Market Context',
    description: 'Enrich with live spot quotes, valuation ratios, industry trends & macro backdrop',
    icon: Globe,
    gradient: 'from-blue-600 to-cyan-600',
  },
  {
    id: 'CHECK_ASSUMPTIONS',
    label: "Check Assumptions & Devil's Advocate",
    shortLabel: 'Red Team',
    description: "Stress-test thesis, spot cognitive biases, unpriced risks & invalidation triggers",
    icon: ShieldAlert,
    gradient: 'from-rose-600 to-amber-600',
  },
  {
    id: 'RESEARCH_FURTHER',
    label: 'Research Further & Catalysts',
    shortLabel: 'Deep Research',
    description: 'Investigate customer/supplier concentration, regulatory overhangs & calendar milestones',
    icon: Search,
    gradient: 'from-purple-600 to-indigo-600',
  },
  {
    id: 'ORGANIZE_THESIS',
    label: 'Organize into Institutional Thesis',
    shortLabel: 'Structure Thesis',
    description: 'Transform raw thoughts into Executive Thesis, Core Pillars, Catalysts & Exit rules',
    icon: Layers,
    gradient: 'from-emerald-600 to-teal-600',
  },
  {
    id: 'PROPOSE_STRUCTURES',
    label: 'Propose Derivatives & Execution',
    shortLabel: 'Trade Structures',
    description: 'Design asymmetric options spreads, LEAPs, collars, and DCA risk levels',
    icon: Zap,
    gradient: 'from-amber-600 to-orange-600',
  },
];

export function LogPage({ onNavigateToResearch, onNavigateToIdeas }: LogPageProps) {
  const queryClient = useQueryClient();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('ALL');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('ALL');

  // Queries & Mutations
  const isTelegramFilter = sentimentFilter === 'TELEGRAM';
  const { data: logs = [], isLoading: isLogsLoading } = useThoughtLogs({
    search: searchQuery,
    sentiment: isTelegramFilter ? 'ALL' : sentimentFilter,
    tag: isTelegramFilter ? 'Telegram' : (selectedTagFilter || undefined),
    folder: selectedFolderFilter !== 'ALL' ? selectedFolderFilter : undefined,
  });

  const { data: foldersData } = useThoughtLogFolders();
  const { data: allLogs = [] } = useThoughtLogs();
  const totalTelegramCount = allLogs.filter(
    (l) => l.tags?.toLowerCase().includes('telegram') || l.title.includes('📱')
  ).length;

  const createLogMutation = useCreateThoughtLog();
  const updateLogMutation = useUpdateThoughtLog();
  const deleteLogMutation = useDeleteThoughtLog();
  const runAgentMutation = useRunThoughtAgent();
  const telegramSyncMutation = useTelegramBufferSync();
  const sendReportMutation = useSendTelegramReport();

  // Active Selected Log
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // Workspace Edit States
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFolder, setEditFolder] = useState('General');
  const [editSentiment, setEditSentiment] = useState('BULLISH');
  const [editTags, setEditTags] = useState('');
  const [editIsPinned, setEditIsPinned] = useState(false);
  const [currentAgentOutput, setCurrentAgentOutput] = useState<string | null>(null);
  const [currentMarketData, setCurrentMarketData] = useState<ThoughtLogMarketData[]>([]);
  const [customPromptInput, setCustomPromptInput] = useState('');
  const [isAgentExecuting, setIsAgentExecuting] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<'editor' | 'agent_output'>('editor');
  const [watchlistModalSymbol, setWatchlistModalSymbol] = useState<string | null>(null);
  const [moveToFolderTarget, setMoveToFolderTarget] = useState<ThoughtLogRecord | null>(null);

  // Auto-select first log or populate default
  useEffect(() => {
    if (logs.length > 0) {
      if (!selectedLogId || !logs.some((l) => l.id === selectedLogId)) {
        const first = logs[0];
        setSelectedLogId(first.id);
        setEditTitle(first.title);
        setEditContent(first.content);
        setEditFolder(first.folder || 'General');
        setEditSentiment(first.sentiment || 'BULLISH');
        setEditTags(first.tags || '');
        setEditIsPinned(first.isPinned);
        setCurrentAgentOutput(first.agentOutput);
        if (first.marketDataJson) {
          try {
            setCurrentMarketData(JSON.parse(first.marketDataJson));
          } catch {
            setCurrentMarketData([]);
          }
        } else {
          setCurrentMarketData([]);
        }
      }
    } else if (selectedLogId === null) {
      // Empty template state
      setEditTitle('AI Semiconductor Demand vs Power Grid Constraints');
      setEditContent(
        'Thinking through $NVDA and $AVGO datacenter power bottlenecks. Big hyperscalers like $MSFT and $AMZN are locking up nuclear PPAs. $CCJ and $CEG look like direct secondary beneficiaries over the next 18 months.\n\nAssumptions to verify:\n- Can SMRs deploy fast enough or is baseload nuclear the only game in town?\n- What are the downside risks if datacenter capex decelerates in 2026?'
      );
      setEditFolder('General');
      setEditSentiment('BULLISH');
      setEditTags('AI, Energy, Nuclear, Datacenters');
    }
  }, [logs]);

  // When selecting a log from the list
  const handleSelectLog = (log: ThoughtLogRecord) => {
    setSelectedLogId(log.id);
    setEditTitle(log.title);
    setEditContent(log.content);
    setEditFolder(log.folder || 'General');
    setEditSentiment(log.sentiment || 'NEUTRAL');
    setEditTags(log.tags || '');
    setEditIsPinned(log.isPinned);
    setCurrentAgentOutput(log.agentOutput);
    if (log.marketDataJson) {
      try {
        setCurrentMarketData(JSON.parse(log.marketDataJson));
      } catch {
        setCurrentMarketData([]);
      }
    } else {
      setCurrentMarketData([]);
    }
    setActiveActionTab(log.agentOutput ? 'agent_output' : 'editor');
  };

  // Create fresh thought draft
  const handleNewDraft = () => {
    setSelectedLogId('new_draft');
    setEditTitle('');
    setEditContent('');
    setEditFolder(selectedFolderFilter !== 'ALL' && selectedFolderFilter !== 'Telegram' && selectedFolderFilter !== 'Voice Notes' ? selectedFolderFilter : 'General');
    setEditSentiment('BULLISH');
    setEditTags('');
    setEditIsPinned(false);
    setCurrentAgentOutput(null);
    setCurrentMarketData([]);
    setActiveActionTab('editor');
  };

  // Save current log
  const handleSaveLog = async () => {
    if (!editContent.trim()) {
      toast.error('Please write some thoughts before saving.');
      return;
    }

    const payload = {
      title: editTitle.trim() || 'Untitled Thought Log',
      content: editContent.trim(),
      folder: editFolder.trim() || 'General',
      sentiment: editSentiment,
      tags: editTags.trim(),
      isPinned: editIsPinned,
      agentOutput: currentAgentOutput,
      marketDataJson: currentMarketData.length > 0 ? JSON.stringify(currentMarketData) : null,
    };

    try {
      if (selectedLogId && selectedLogId !== 'new_draft') {
        const updated = await updateLogMutation.mutateAsync({
          id: selectedLogId,
          data: payload,
        });
        toast.success(`Saved "${updated.title}" in folder [${updated.folder || 'General'}]`);
      } else {
        const created = await createLogMutation.mutateAsync(payload);
        setSelectedLogId(created.id);
        toast.success(`Created new thought log "${created.title}" in [${created.folder || 'General'}]`);
      }
    } catch (err: any) {
      toast.error(`Failed to save thought log: ${err.message}`);
    }
  };

  // Delete Log
  const handleDeleteLog = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteLogMutation.mutateAsync(id);
      toast.success('Thought log deleted');
      if (selectedLogId === id) {
        setSelectedLogId(null);
      }
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  // Toggle Pin status
  const handleTogglePin = async (log: ThoughtLogRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await updateLogMutation.mutateAsync({
        id: log.id,
        data: { isPinned: !log.isPinned },
      });
      toast.success(log.isPinned ? 'Unpinned thought log' : 'Pinned thought log to top');
    } catch (err: any) {
      toast.error(`Failed to update pin: ${err.message}`);
    }
  };

  // Run AI Agent Action on current thoughts
  const handleTriggerAgent = async (actionType: AgentActionType, customPrompt?: string) => {
    if (!editContent.trim()) {
      toast.error('Please write some thoughts or thesis notes first so the Agent has context.');
      return;
    }

    setIsAgentExecuting(true);
    toast.info(`Calling AI Copilot (${actionType.replace('_', ' ')})...`);

    try {
      const res = await runAgentMutation.mutateAsync({
        logId: selectedLogId && selectedLogId !== 'new_draft' ? selectedLogId : undefined,
        title: editTitle,
        content: editContent,
        actionType,
        customPrompt,
        sentiment: editSentiment,
        tags: editTags ? editTags.split(',').map((t) => t.trim()) : [],
        saveToLog: Boolean(selectedLogId && selectedLogId !== 'new_draft'),
      });

      setCurrentAgentOutput(res.markdownOutput);
      setCurrentMarketData(res.marketData || []);

      if (res.suggestedTags && res.suggestedTags.length > 0 && !editTags) {
        setEditTags(res.suggestedTags.join(', '));
      }

      setActiveActionTab('agent_output');
      toast.success(`Agent analysis completed! (${res.marketData.length} live tickers scanned)`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Agent execution failed. Check API keys in Settings.');
    } finally {
      setIsAgentExecuting(false);
    }
  };

  // Extract detected tickers from editContent and editTitle
  const detectedTickers = useMemo(() => {
    return extractSymbolsFromText(`${editTitle} ${editContent}`);
  }, [editTitle, editContent]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* ================= 1. HEADER RIBBON ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-primary/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
            <NotebookPen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
                Log & Research Journal
              </h1>
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 text-[10px] font-mono uppercase font-bold">
                {logs.length} Entries
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Draft your raw market thoughts, trade theses, and musings — then deploy the AI Agent to add context, check assumptions, and structure institutional research.
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await telegramSyncMutation.mutateAsync();
                if (res.consumedCount > 0) {
                  toast.success(`Ingested ${res.consumedCount} new notes from Telegram!`);
                } else {
                  toast.info(res.message || 'Telegram buffer is empty (0 new notes).');
                }
              } catch (err: any) {
                toast.error(err.message || 'Failed to sync Telegram buffer. Check .env.local configuration.');
              }
            }}
            disabled={telegramSyncMutation.isPending}
            className="h-9 gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 font-bold text-xs"
            title="Pull and ingest pending notes from your Cloudflare Telegram buffer"
          >
            <Smartphone className={cn("w-3.5 h-3.5", telegramSyncMutation.isPending && "animate-spin text-primary")} />
            <span>Sync Telegram</span>
          </Button>

          {/* Send PDF Briefing to Telegram */}
          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendReportMutation.mutate()}
              disabled={sendReportMutation.isPending}
              className="h-9 text-xs gap-1.5 font-bold bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/35 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.15)] transition-all rounded-r-none border-r-0"
              title="Synthesize and upload executive PDF briefing to your Telegram bot"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              {sendReportMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending PDF...</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3 text-sky-400" />
                  <span>PDF Briefing</span>
                </>
              )}
            </Button>
            <a
              href="/api/telegram/preview-report-pdf"
              target="_blank"
              rel="noreferrer"
              className="h-9 px-2 flex items-center justify-center rounded-r-lg border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 transition-colors"
              title="Preview / Download raw PDF in browser"
            >
              <ExternalLink className="w-3 h-3 text-sky-400" />
            </a>
          </div>

          <Button
            onClick={handleNewDraft}
            className="h-9 gap-1.5 bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:from-primary/90 hover:to-indigo-600/90 text-white font-bold text-xs shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Thought Log</span>
          </Button>
        </div>
      </div>

      {/* ================= 2. MAIN TWO-COLUMN WORKSPACE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: LOG ENTRIES STREAM (4 COLS) ================= */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search & Filter Bar */}
          <div className="space-y-2.5 bg-card/60 backdrop-blur-xl border border-border/60 p-3 rounded-2xl shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search thoughts, tickers ($NVDA), tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8.5 text-xs bg-background/60 border-border/60 focus:border-primary rounded-xl"
              />
            </div>

            {/* Folder Navigator Ribbon */}
            <div className="space-y-1.5 pt-0.5 border-t border-border/40">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-0.5 pt-1">
                <span className="flex items-center gap-1 uppercase tracking-wider text-[10px]">
                  <Folder className="w-3 h-3 text-primary" />
                  Folders
                </span>
                {selectedFolderFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedFolderFilter('ALL')}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Clear folder filter
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedFolderFilter('ALL')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1",
                    selectedFolderFilter === 'ALL'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background/60 text-muted-foreground hover:text-foreground border border-border/60"
                  )}
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>All ({allLogs.length})</span>
                </button>

                {(foldersData?.folders || []).map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setSelectedFolderFilter(selectedFolderFilter === f.name ? 'ALL' : f.name)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 flex items-center gap-1",
                      selectedFolderFilter === f.name
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm"
                        : "bg-background/60 text-muted-foreground hover:text-foreground border border-border/60 hover:bg-accent/40"
                    )}
                  >
                    <Folder className="w-3 h-3 text-indigo-400" />
                    <span>{f.name}</span>
                    {f.count > 0 && (
                      <span className="text-[10px] font-mono opacity-70">({f.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sentiment Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px] pt-1 border-t border-border/40">
              <button
                type="button"
                onClick={() => setSentimentFilter('ALL')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all shrink-0",
                  sentimentFilter === 'ALL'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground bg-accent/20"
                )}
              >
                All Sentiments
              </button>
              {totalTelegramCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSentimentFilter(sentimentFilter === 'TELEGRAM' ? 'ALL' : 'TELEGRAM')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1",
                    sentimentFilter === 'TELEGRAM'
                      ? "bg-sky-500/25 text-sky-300 border border-sky-500/50 shadow-sm"
                      : "text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20"
                  )}
                  title="Show only notes received from Telegram"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Telegram ({totalTelegramCount})</span>
                </button>
              )}
              {SENTIMENT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSentimentFilter(s.value)}
                  className={cn(
                    "px-2 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1",
                    sentimentFilter === s.value
                      ? "bg-accent text-foreground border border-border/80 shadow-sm"
                      : "text-muted-foreground hover:text-foreground bg-accent/10"
                  )}
                >
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Log Items Stream List */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {isLogsLoading ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                <p className="text-xs text-muted-foreground">Loading thought stream...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-card/40 border border-dashed border-border/60 space-y-3">
                <NotebookPen className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">No thought logs found matching your filter.</p>
                <Button size="sm" variant="outline" onClick={handleNewDraft} className="text-xs">
                  Create First Thought Log
                </Button>
              </div>
            ) : (
              logs.map((log) => {
                const isSelected = log.id === selectedLogId;
                const sentimentMatch = SENTIMENT_OPTIONS.find((s) => s.value === log.sentiment);

                return (
                  <div
                    key={log.id}
                    onClick={() => handleSelectLog(log)}
                    className={cn(
                      "p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 relative group",
                      isSelected
                        ? "bg-gradient-to-br from-indigo-950/25 via-card/90 to-card/95 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30"
                        : "bg-card/60 hover:bg-card/80 border-border/50 hover:border-border/80"
                    )}
                  >
                    {/* Top Row: Sentiment & Folder & Pin */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {log.isPinned && (
                          <span className="p-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30" title="Pinned to top">
                            <Pin className="w-3 h-3" />
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] uppercase font-bold px-1.5 py-0.2",
                            sentimentMatch
                              ? sentimentMatch.color === 'emerald'
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : sentimentMatch.color === 'rose'
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : sentimentMatch.color === 'indigo'
                                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-slate-500/10 text-muted-foreground"
                          )}
                        >
                          {log.sentiment || 'NEUTRAL'}
                        </Badge>
                        {/* Folder badge */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveToFolderTarget(log);
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary border border-border/60 text-[9px] font-medium text-foreground/80 hover:text-foreground transition-all"
                          title="Move to another folder"
                        >
                          <Folder className="w-2.5 h-2.5 text-primary" />
                          <span>{log.folder || 'General'}</span>
                        </button>
                        {(log.tags?.toLowerCase().includes('telegram') || log.title.includes('📱')) && (
                          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[9px] font-mono flex items-center gap-1 shadow-sm">
                            <Smartphone className="w-2.5 h-2.5 text-sky-400" />
                            Telegram
                          </Badge>
                        )}
                        {(log.tags?.toLowerCase().includes('voice') || log.title.includes('🎙️')) && (
                          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[9px] font-mono flex items-center gap-1 shadow-sm">
                            <Mic className="w-2.5 h-2.5 text-sky-400" />
                            Voice
                          </Badge>
                        )}
                        {log.agentOutput && (
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[9px] font-mono">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-300" />
                            AI Audited
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(log, e)}
                          className="p-1 rounded hover:bg-accent/60 text-muted-foreground hover:text-amber-400"
                          title={log.isPinned ? "Unpin" : "Pin to top"}
                        >
                          {log.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteLog(log.id, e)}
                          className="p-1 rounded hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-bold text-foreground leading-snug line-clamp-1">
                      {log.title || 'Untitled Thought Log'}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {log.content}
                    </p>

                    {/* Footer Row: Date & Tickers */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1 font-mono">
                      <span>
                        {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {log.symbols && (
                        <div className="flex items-center gap-1">
                          {log.symbols.split(',').slice(0, 3).map((sym) => (
                            <span key={sym.trim()} className="px-1.5 py-0.2 rounded bg-accent/40 font-bold text-foreground">
                              ${sym.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: ACTIVE THOUGHT WORKSPACE & AGENT COPILOT (8 COLS) ================= */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="bg-card/80 backdrop-blur-2xl border border-border/70 shadow-xl rounded-2xl overflow-hidden">
            {/* Header Toolbar */}
            <CardHeader className="p-5 pb-3 border-b border-border/50 bg-accent/15">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {SENTIMENT_OPTIONS.map((s) => {
                      const isSelected = editSentiment === s.value;
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setEditSentiment(s.value)}
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border",
                            isSelected
                              ? s.color === 'emerald'
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                                : s.color === 'rose'
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                                : s.color === 'indigo'
                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                              : "bg-card/40 text-muted-foreground border-border/40 hover:bg-accent/40"
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Folder Selector Dropdown in Editor Header */}
                  <button
                    type="button"
                    onClick={() => {
                      const current = logs.find((l) => l.id === selectedLogId);
                      if (current) {
                        setMoveToFolderTarget(current);
                      } else {
                        setMoveToFolderTarget({
                          id: 'draft',
                          title: editTitle || 'Current Draft',
                          content: editContent,
                          folder: editFolder,
                          tags: editTags,
                          symbols: null,
                          sentiment: editSentiment,
                          isPinned: editIsPinned,
                          agentOutput: currentAgentOutput,
                          agentActionType: null,
                          agentHistory: null,
                          marketDataJson: null,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border/60 bg-background/60 hover:bg-accent/40 text-xs font-semibold text-foreground/90 transition-all shadow-sm group"
                    title="Change folder destination for this thought log"
                  >
                    <Folder className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-muted-foreground font-normal text-[11px]">Folder:</span>
                    <span className="font-bold text-primary">{editFolder || 'General'}</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditIsPinned(!editIsPinned)}
                    className={cn(
                      "h-8 text-xs font-bold gap-1 transition-all",
                      editIsPinned ? "bg-amber-500/15 text-amber-400 border-amber-500/40" : "text-muted-foreground"
                    )}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    <span>{editIsPinned ? 'Pinned' : 'Pin'}</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleSaveLog}
                    disabled={updateLogMutation.isPending || createLogMutation.isPending}
                    className="h-8 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Log</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Title & Tags */}
              <div className="space-y-2">
                <Input
                  placeholder="Log Title (e.g. AI Datacenter Power thesis, Nuclear vs Solar, Short Carvana)..."
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-10 text-base font-bold bg-background/60 border-border/60 focus:border-primary rounded-xl"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Tags (e.g. AI, Nuclear, Earnings, Valuation, Swing)..."
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="pl-9 h-8 text-xs bg-background/40 border-border/50 focus:border-primary rounded-lg font-mono"
                    />
                  </div>

                  {/* Detected Ticker Badges */}
                  {detectedTickers.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">Detected:</span>
                      {detectedTickers.map((ticker) => (
                        <div
                          key={ticker}
                          className="inline-flex items-center gap-1 bg-primary/15 border border-primary/30 rounded-lg px-2 py-0.5 shadow-sm"
                        >
                          <button
                            type="button"
                            onClick={() => onNavigateToResearch?.(ticker)}
                            className="text-xs font-mono font-bold text-primary hover:text-white transition-colors flex items-center gap-1"
                            title={`Open ${ticker} in Research page`}
                          >
                            <span>${ticker}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWatchlistModalSymbol(ticker);
                            }}
                            className="text-muted-foreground hover:text-amber-300 p-0.5 rounded hover:bg-amber-500/15 transition-all ml-0.5"
                            title={`Save ${ticker} to Watchlist`}
                          >
                            <FolderPlus className="w-3 h-3 text-amber-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Main Thoughts Text Area */}
              <div className="space-y-1.5">
                <Textarea
                  placeholder="Write your raw thoughts, market observations, trade ideas, or investment thesis here... Use $TICKER (e.g. $NVDA, $CCJ, $MSFT) to auto-link live market quotes."
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="bg-background/60 border-border/60 focus:border-primary font-sans text-xs sm:text-sm leading-relaxed p-4 rounded-xl resize-y"
                />
              </div>

              {/* ================= 3. AGENT COPILOT COMMAND DECK ================= */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/20 via-purple-950/15 to-card/60 border border-indigo-500/30 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground font-sans block">
                        AI Thought Copilot & Research Agent
                      </span>
                      <span className="text-[10.5px] text-muted-foreground">
                        Select an action below to deploy the agent with live market intelligence.
                      </span>
                    </div>
                  </div>

                  {isAgentExecuting && (
                    <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px] animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Agent Running...
                    </Badge>
                  )}
                </div>

                {/* 5 One-Click Agent Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
                  {AGENT_ACTION_BUTTONS.map((act) => {
                    const Icon = act.icon;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => handleTriggerAgent(act.id)}
                        disabled={isAgentExecuting}
                        className="p-2.5 rounded-xl bg-card/70 hover:bg-card border border-border/60 hover:border-indigo-500/50 text-left transition-all group flex flex-col justify-between space-y-1 hover:shadow-md disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between w-full">
                          <Icon className="w-4 h-4 text-indigo-400 group-hover:text-amber-300 transition-colors" />
                          <ArrowRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-foreground block leading-tight group-hover:text-primary transition-colors">
                            {act.shortLabel}
                          </span>
                          <span className="text-[9.5px] text-muted-foreground leading-tight line-clamp-1">
                            {act.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Conversational Prompt Bar */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Ask the Agent anything about these thoughts (e.g. 'What are the main margin risks?' or 'How does this compare to $MSFT?')..."
                      value={customPromptInput}
                      onChange={(e) => setCustomPromptInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customPromptInput.trim()) {
                          handleTriggerAgent('CUSTOM_QUERY', customPromptInput.trim());
                        }
                      }}
                      className="h-9 text-xs bg-background/80 border-border/60 focus:border-indigo-500 rounded-xl pr-10"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleTriggerAgent('CUSTOM_QUERY', customPromptInput.trim())}
                    disabled={isAgentExecuting || !customPromptInput.trim()}
                    className="h-9 text-xs font-bold gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-sm shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ask Copilot</span>
                  </Button>
                </div>
              </div>

              {/* ================= 4. AGENT OUTPUT STATION ================= */}
              {currentAgentOutput && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/20 via-card/90 to-slate-950/80 border border-indigo-500/40 space-y-4 shadow-lg animate-in fade-in">
                  {/* Top Bar of Output */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        <Sparkles className="w-4 h-4 text-amber-300" />
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-foreground font-sans block">
                          AI Copilot Institutional Analysis
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Grounded with live market data & objective risk audit
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(currentAgentOutput);
                          toast.success('Agent analysis copied to clipboard!');
                        }}
                        className="h-7 text-[11px] font-bold gap-1 border-border/60 hover:bg-accent/40"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={handleSaveLog}
                        className="h-7 text-[11px] font-bold gap-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save to Log</span>
                      </Button>

                      {onNavigateToIdeas && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onNavigateToIdeas();
                            toast.info('Switched to Trade Ideas tab');
                          }}
                          className="h-7 text-[11px] font-bold gap-1 border-primary/40 text-primary hover:bg-primary/10"
                        >
                          <Lightbulb className="w-3 h-3 text-amber-300" />
                          <span>Ideas Tab</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Live Market Telemetry Chips (if detected) */}
                  {currentMarketData.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-border/40 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block font-sans">
                        Live Market Telemetry Grounding ({currentMarketData.length} Assets)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {currentMarketData.map((m) => (
                          <div
                            key={m.symbol}
                            className="p-2 rounded-lg bg-card/60 border border-border/40 hover:border-primary/40 transition-all flex items-center justify-between text-xs font-mono group"
                          >
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onNavigateToResearch?.(m.symbol)}
                                className="font-bold text-foreground hover:text-primary flex items-center gap-1 transition-colors"
                                title={`Open ${m.symbol} in Research page`}
                              >
                                ${m.symbol}
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWatchlistModalSymbol(m.symbol);
                                }}
                                className="text-muted-foreground hover:text-amber-400 p-0.5 rounded hover:bg-amber-500/10 transition-colors"
                                title={`Save ${m.symbol} to Watchlist`}
                              >
                                <FolderPlus className="w-3 h-3 text-amber-400" />
                              </button>
                            </div>
                            <div className="text-right">
                              <span className="font-bold block">${m.price.toFixed(2)}</span>
                              <span className={cn("text-[10px] font-bold", m.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {m.changePercent >= 0 ? '+' : ''}{m.changePercent.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rendered Markdown Output */}
                  <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed p-2 font-sans space-y-3">
                    <ReactMarkdown>{currentAgentOutput}</ReactMarkdown>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add To Watchlist Modal */}
      <AddToWatchlistModal
        isOpen={Boolean(watchlistModalSymbol)}
        onClose={() => setWatchlistModalSymbol(null)}
        symbol={watchlistModalSymbol || ''}
      />

      {/* Move To Folder Modal */}
      <MoveToFolderModal
        isOpen={Boolean(moveToFolderTarget)}
        onClose={() => setMoveToFolderTarget(null)}
        targetLog={moveToFolderTarget}
        onMoved={(newFolder) => {
          setEditFolder(newFolder);
          if (selectedLogId && selectedLogId === moveToFolderTarget?.id) {
            setEditFolder(newFolder);
          }
        }}
      />
    </div>
  );
}
