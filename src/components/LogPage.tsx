import React, { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
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
  Bell,
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
  useMarkThoughtLogAsRead,
  useMarkAllThoughtLogsAsRead,
  extractSymbolsFromText,
  extractPriceAlertCandidates,
} from '@/services/thoughtLogService';
import {
  Smartphone,
  FolderPlus,
  Folder,
  FolderOpen,
  Mic,
  ChevronDown,
  GripVertical,
  MoveRight,
  Check,
  X,
  Eye,
  BarChart2,
  Inbox,
  Mail,
  MailOpen,
  CheckCheck,
} from 'lucide-react';
import { AddToWatchlistModal } from './AddToWatchlistModal';
import { MoveToFolderModal } from './MoveToFolderModal';
import { TradeStructureModal } from './TradeStructureModal';
import { useSendTelegramReport } from '@/services/telegramReportClientService';
import { useCreateTradeIdea, useTradeIdeas } from '@/services/ideaService';
import { AppIdeasChecklist } from './AppIdeasChecklist';
import { useAppIdeas, useToggleAppIdea, AppIdea } from '@/services/appIdeaService';
import { AntigravityCodingModal } from './AntigravityCodingModal';
import { CheckSquare } from 'lucide-react';

interface LogPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToIdeas?: () => void;
  onNavigateToTrades?: () => void;
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

export function LogPage({ onNavigateToResearch, onNavigateToIdeas, onNavigateToTrades }: LogPageProps) {
  const queryClient = useQueryClient();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [sentimentFilter, setSentimentFilter] = useState('ALL');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('UNREAD');

  // Queries & Mutations
  const isTelegramFilter = sentimentFilter === 'TELEGRAM';
  const { data: logs = [], isLoading: isLogsLoading } = useThoughtLogs({
    search: debouncedSearchQuery,
    sentiment: isTelegramFilter ? 'ALL' : sentimentFilter,
    tag: isTelegramFilter ? 'Telegram' : (selectedTagFilter || undefined),
    folder: selectedFolderFilter,
  });

  const { data: foldersData } = useThoughtLogFolders();
  const { data: allLogs = [] } = useThoughtLogs();
  const { data: allIdeas = [] } = useTradeIdeas();
  const totalTelegramCount = allLogs.filter(
    (l) => l.tags?.toLowerCase().includes('telegram') || l.title.includes('📱')
  ).length;
  const totalUnreadCount = foldersData?.unreadCount ?? allLogs.filter((l) => !l.isRead).length;

  const createLogMutation = useCreateThoughtLog();
  const updateLogMutation = useUpdateThoughtLog();
  const deleteLogMutation = useDeleteThoughtLog();
  const markReadMutation = useMarkThoughtLogAsRead();
  const markAllReadMutation = useMarkAllThoughtLogsAsRead();
  const runAgentMutation = useRunThoughtAgent();
  const telegramSyncMutation = useTelegramBufferSync();
  const sendReportMutation = useSendTelegramReport();
  const createIdeaMutation = useCreateTradeIdea();

  // App Ideas Backlog Hooks & State
  const { data: appIdeasData } = useAppIdeas();
  const appIdeasStats = appIdeasData?.stats || { total: 0, pending: 0, fulfilled: 0, completionPercentage: 0 };
  const toggleAppIdeaMutation = useToggleAppIdea();
  const [appFolderViewMode, setAppFolderViewMode] = useState<'checklist' | 'editor'>('checklist');

  // AI Feature Planning Trigger
  const handlePlanFeatureWithAI = (idea: any) => {
    setSelectedFolderFilter('App');
    setAppFolderViewMode('editor');
    setSelectedLogId('new_draft');
    setEditTitle(`Feature Blueprint: ${idea.title}`);
    setEditContent(
      `## Feature Implementation Blueprint: ${idea.title}\n\n` +
      `**Topic / Category**: ${idea.topic} (${idea.category || 'Feature'})\n\n` +
      `### Requirement & Context\n${idea.description || idea.title}\n\n` +
      `### Architecture & Implementation Plan\n- Frontend UI Component:\n- Backend API Routes:\n- Database Models:\n- Validation & Edge Cases:\n`
    );
    setEditFolder('App');
    setEditSentiment('NEUTRAL');
    setEditTags(`App, ${idea.topic}, Implementation, Feature`);
    setActiveActionTab('agent_output');
    handleTriggerAgent('ORGANIZE_THESIS');
  };

  // Antigravity Coding Modal State & Handler
  const [antigravityModalIdea, setAntigravityModalIdea] = useState<AppIdea | null>(null);
  const [antigravityModalLogId, setAntigravityModalLogId] = useState<string | undefined>(undefined);

  const handleOpenAntigravityFromLog = (log: ThoughtLogRecord) => {
    const cleanTitle = log.title.replace(/^💡\s*/, '').trim();
    const matchingIdea = appIdeasData?.ideas.find(
      (i) => i.thoughtLogId === log.id || i.title.toLowerCase() === cleanTitle.toLowerCase()
    );

    if (matchingIdea) {
      setAntigravityModalIdea(matchingIdea);
      setAntigravityModalLogId(log.id);
    } else {
      setAntigravityModalIdea({
        id: log.id,
        title: cleanTitle,
        description: log.content !== cleanTitle ? log.content : null,
        topic: 'App',
        category: 'Feature',
        isFulfilled: Boolean(log.isFulfilled),
        fulfilledAt: log.fulfilledAt || null,
        tags: log.tags || 'App',
        source: 'TELEGRAM',
        telegramMsgId: null,
        thoughtLogId: log.id,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      });
      setAntigravityModalLogId(log.id);
    }
  };

  // Active Selected Log
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // Filter visible logs: if in UNREAD view, only show unread logs or the currently selected log being viewed
  const displayLogs = useMemo(() => {
    if (selectedFolderFilter === 'UNREAD') {
      return logs.filter((l) => !l.isRead || l.id === selectedLogId);
    }
    return logs;
  }, [logs, selectedFolderFilter, selectedLogId]);

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

  // Trade Structurer State
  const [isTradeStructureModalOpen, setIsTradeStructureModalOpen] = useState(false);
  const [tradeStructureSymbol, setTradeStructureSymbol] = useState<string>('');
  const [tradeStructureThesis, setTradeStructureThesis] = useState<string>('');
  const [tradeStructureSentiment, setTradeStructureSentiment] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL'>('BULLISH');

  // Drag & Drop and Folder Management State
  const [draggingLog, setDraggingLog] = useState<ThoughtLogRecord | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [isNewFolderInputOpen, setIsNewFolderInputOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');

  // Drop on folder handler
  const handleDropOnFolder = async (e: React.DragEvent, targetFolderName: string) => {
    e.preventDefault();
    setDragOverFolder(null);

    const logId = e.dataTransfer.getData('text/plain') || draggingLog?.id;
    if (!logId) return;

    const targetLog = allLogs.find((l) => l.id === logId) || (draggingLog?.id === logId ? draggingLog : null);
    const currentFolder = targetLog?.folder || 'General';

    if (currentFolder === targetFolderName) {
      toast.info(`Note is already in folder "${targetFolderName}".`);
      setDraggingLog(null);
      return;
    }

    try {
      await updateLogMutation.mutateAsync({
        id: logId,
        data: { folder: targetFolderName },
      });

      if (selectedLogId === logId) {
        setEditFolder(targetFolderName);
      }

      toast.success(
        `Moved "${(targetLog?.title || 'Note').slice(0, 30)}" to folder "${targetFolderName}"!`
      );
    } catch (err: any) {
      toast.error(`Failed to move note: ${err.message}`);
    } finally {
      setDraggingLog(null);
    }
  };

  const handleCreateNewFolder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFolderNameInput.trim();
    if (!trimmed) return;

    setSelectedFolderFilter(trimmed);
    setNewFolderNameInput('');
    setIsNewFolderInputOpen(false);
    toast.success(`Created & selected folder "${trimmed}"!`);
  };

  // Price Alert Modal State for Log Section
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertModalConfig, setAlertModalConfig] = useState<{
    symbol: string;
    price?: number;
    targetPrice?: number | string;
    condition?: 'ABOVE' | 'BELOW';
    notes?: string;
  } | null>(null);

  // Open Price Alert Modal with Auto-Detected Target or Defaults
  const handleOpenSetAlert = (candidate?: {
    symbol: string;
    price?: number;
    targetPrice?: number | string;
    condition?: 'ABOVE' | 'BELOW' | 'AUTO';
  }, sourceLog?: ThoughtLogRecord) => {
    const rawContent = sourceLog ? `${sourceLog.title} ${sourceLog.content}` : `${editTitle} ${editContent}`;
    const detectedSyms = extractSymbolsFromText(rawContent);
    const sym = candidate?.symbol || detectedSyms[0] || 'AAPL';
    const tgt = candidate?.targetPrice;
    const cond = candidate?.condition && candidate.condition !== 'AUTO' ? candidate.condition : undefined;
    const sourceText = sourceLog ? sourceLog.content : editContent;
    const note = `Created from ThoughtLog: "${(sourceLog?.title || editTitle || sourceText).slice(0, 80)}"`;

    setAlertModalConfig({
      symbol: sym,
      price: candidate?.price,
      targetPrice: tgt,
      condition: cond,
      notes: note,
    });
    setIsAlertModalOpen(true);
  };

  // Open Trade Structurer for Active Thought Log
  const handleOpenTradeStructure = (symbolOverride?: string) => {
    const sym = symbolOverride || (extractSymbolsFromText(`${editTitle} ${editContent}`)[0]) || 'NVDA';
    setTradeStructureSymbol(sym);
    setTradeStructureThesis(editContent || editTitle);
    setTradeStructureSentiment(
      editSentiment === 'BEARISH' ? 'BEARISH' : editSentiment === 'NEUTRAL' ? 'NEUTRAL' : 'BULLISH'
    );
    setIsTradeStructureModalOpen(true);
  };

  // Auto-select first log or populate default
  useEffect(() => {
    if (logs.length > 0) {
      const isCurrentValidInList = logs.some((l) => l.id === selectedLogId);
      if (!selectedLogId || (!isCurrentValidInList && selectedFolderFilter !== 'UNREAD')) {
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

        if (selectedFolderFilter === 'UNREAD' && !first.isRead) {
          markReadMutation.mutate({ id: first.id, isRead: true });
        }
      }
    } else if (selectedLogId === null && selectedFolderFilter !== 'UNREAD') {
      // Empty template state
      setEditTitle('AI Semiconductor Demand vs Power Grid Constraints');
      setEditContent(
        'Thinking through $NVDA and $AVGO datacenter power bottlenecks. Big hyperscalers like $MSFT and $AMZN are locking up nuclear PPAs. $CCJ and $CEG look like direct secondary beneficiaries over the next 18 months.\n\nAssumptions to verify:\n- Can SMRs deploy fast enough or is baseload nuclear the only game in town?\n- What are the downside risks if datacenter capex decelerates in 2026?'
      );
      setEditFolder('General');
      setEditSentiment('BULLISH');
      setEditTags('AI, Energy, Nuclear, Datacenters');
    }
  }, [logs, selectedFolderFilter]);

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

    if (!log.isRead) {
      markReadMutation.mutate({ id: log.id, isRead: true });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllReadMutation.mutateAsync();
      toast.success('All unread notes marked as read');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark all as read');
    }
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
        const created: any = await createLogMutation.mutateAsync(payload);
        setSelectedLogId(created.id);
        if (created.createdAlerts && created.createdAlerts.length > 0) {
          const alertSummary = created.createdAlerts
            .map((a: any) => `${a.symbol} @ $${a.targetPrice} (${a.condition})`)
            .join(', ');
          toast.success(`🔔 Auto-created Price Alert for ${alertSummary}!`, {
            description: `Saved to [${created.folder || 'Alerts'}] folder and actively monitoring spot prices.`,
          });
        } else {
          toast.success(`Created new thought log "${created.title}" in [${created.folder || 'General'}]`);
        }
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

  // Automatically detect price alerts and levels from active draft in real time
  const detectedAlertsInActiveDraft = useMemo(() => {
    return extractPriceAlertCandidates(`${editTitle}\n${editContent}`);
  }, [editTitle, editContent]);

  // Fast map to check which symbols across the app currently have active trade ideas
  const ideasBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const idea of allIdeas) {
      if (idea.symbol) {
        const sym = idea.symbol.toUpperCase();
        map.set(sym, (map.get(sym) || 0) + 1);
      }
    }
    return map;
  }, [allIdeas]);

  // Find linked ideas for the active log / detected symbols
  const linkedIdeasForCurrentLog = useMemo(() => {
    if (!detectedTickers.length && !editTitle) return [];
    const tickersUpper = new Set(detectedTickers.map((t) => t.toUpperCase()));
    return allIdeas.filter((idea) => {
      const sym = idea.symbol?.toUpperCase();
      const matchSymbol = sym && tickersUpper.has(sym);
      const matchTitle = editTitle && idea.title?.toLowerCase().includes(editTitle.toLowerCase().trim().slice(0, 15));
      return matchSymbol || matchTitle;
    });
  }, [allIdeas, detectedTickers, editTitle]);

  // 1-Click: Save Active Thought Log & Thesis to Ideas Section
  const handleSaveToIdeas = async () => {
    const primarySymbol = detectedTickers[0] || (editTitle.match(/\$([A-Z]+)/)?.[1]) || 'GENERAL';
    const ideaSentiment = editSentiment === 'BEARISH' ? 'BEARISH' : editSentiment === 'NEUTRAL' ? 'NEUTRAL' : 'BULLISH';

    // Find current spot price if available from telemetry
    const matchedMarket = currentMarketData.find((m) => m.symbol.toUpperCase() === primarySymbol.toUpperCase());
    const entryPrice = matchedMarket?.price || null;

    let contentToSave = editContent.trim();
    if (currentAgentOutput) {
      contentToSave += `\n\n---\n\n### 🤖 AI Copilot Institutional Analysis\n${currentAgentOutput}`;
    }

    try {
      await createIdeaMutation.mutateAsync({
        title: editTitle || `${primarySymbol.toUpperCase()} Trade Thesis`,
        symbol: primarySymbol.toUpperCase(),
        type: ideaSentiment,
        timeframe: 'SWING',
        entryPrice: entryPrice,
        content: contentToSave,
        tags: editTags ? `${editTags}, ThoughtLog, ${editFolder}` : `ThoughtLog, ${editFolder}`,
        status: 'ACTIVE',
        confidenceScore: 75,
      });

      toast.success(`Saved "${editTitle || primarySymbol}" to Trade Ideas!`, {
        description: 'You can now view, manage, and follow this thesis in your Ideas section.',
        action: onNavigateToIdeas ? {
          label: 'View in Ideas',
          onClick: () => onNavigateToIdeas(),
        } : undefined,
      });
    } catch (err: any) {
      toast.error(`Failed to save to Trade Ideas: ${err.message}`);
    }
  };

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

            {/* Master Folder Hub & Drop Station */}
            <div className="space-y-2 pt-1 border-t border-border/40">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-foreground font-extrabold">
                  <FolderOpen className="w-3.5 h-3.5 text-primary" />
                  Folders & Collections
                </span>
                <div className="flex items-center gap-1.5">
                  {selectedFolderFilter === 'UNREAD' && totalUnreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 transition-all shadow-sm"
                      title="Mark all unread notes as read"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  {selectedFolderFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedFolderFilter('ALL')}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Show All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsNewFolderInputOpen(!isNewFolderInputOpen)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold border border-primary/30 transition-all shadow-sm"
                    title="Create a new folder"
                  >
                    <FolderPlus className="w-3 h-3" />
                    <span>+ Folder</span>
                  </button>
                </div>
              </div>

              {/* Inline New Folder Creator */}
              {isNewFolderInputOpen && (
                <form
                  onSubmit={handleCreateNewFolder}
                  className="flex items-center gap-1.5 p-1.5 rounded-xl bg-background/80 border border-primary/40 shadow-inner animate-in fade-in zoom-in-95 duration-200"
                >
                  <Folder className="w-3.5 h-3.5 text-primary ml-1 shrink-0" />
                  <Input
                    autoFocus
                    placeholder="New folder name (e.g. Biotech, AI)..."
                    value={newFolderNameInput}
                    onChange={(e) => setNewFolderNameInput(e.target.value)}
                    className="h-7 text-xs bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 font-medium"
                  />
                  <Button type="submit" size="sm" className="h-6 px-2 text-[10px] font-bold bg-primary text-primary-foreground shrink-0">
                    Create
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsNewFolderInputOpen(false);
                      setNewFolderNameInput('');
                    }}
                    className="h-6 px-1.5 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </form>
              )}

              {/* Drag & Drop Guidance Banner */}
              {draggingLog && (
                <div className="p-2 rounded-xl bg-gradient-to-r from-primary/20 via-indigo-500/20 to-purple-500/20 border border-primary/50 text-xs text-primary font-bold flex items-center gap-2 animate-pulse shadow-md">
                  <MoveRight className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                  <span className="truncate">
                    Drop <strong>"{draggingLog.title || 'Note'}"</strong> into any folder capsule below:
                  </span>
                </div>
              )}

              {/* Folder Capsules Grid & Drop Targets */}
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5 scrollbar-thin">
                {/* 0. Unread Messages Option (Primary Default View) */}
                <button
                  type="button"
                  onClick={() => setSelectedFolderFilter('UNREAD')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-left font-bold text-xs transition-all flex items-center justify-between border relative group",
                    selectedFolderFilter === 'UNREAD'
                      ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-300 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/40"
                      : "bg-emerald-500/10 text-emerald-300/80 hover:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15"
                  )}
                  title="Unread thoughts & mobile messages (opening notes marks them as read and removes them from this view)"
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <Inbox className={cn("w-3.5 h-3.5 shrink-0", selectedFolderFilter === 'UNREAD' ? "text-emerald-300" : "text-emerald-400")} />
                    <span className="truncate">Unread</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9.5px] px-1.5 py-0 font-mono shrink-0 ml-1 border-0",
                      totalUnreadCount > 0
                        ? "bg-emerald-500 text-slate-950 font-extrabold shadow-sm animate-pulse"
                        : "bg-emerald-500/20 text-emerald-300"
                    )}
                  >
                    {totalUnreadCount}
                  </Badge>
                </button>

                {/* 1. All Folder Option */}
                <button
                  type="button"
                  onClick={() => setSelectedFolderFilter('ALL')}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragEnter={() => setDragOverFolder('General')}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={(e) => handleDropOnFolder(e, 'General')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-left font-bold text-xs transition-all flex items-center justify-between border relative group",
                    selectedFolderFilter === 'ALL'
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-background/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-accent/40",
                    draggingLog && "border-dashed border-primary/60 bg-primary/5",
                    dragOverFolder === 'General' && "scale-105 ring-2 ring-primary border-primary bg-primary/25 text-white font-extrabold shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                  )}
                  title="Drop here to move into General / Unfiled"
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <FolderOpen className={cn("w-3.5 h-3.5 shrink-0", selectedFolderFilter === 'ALL' ? "text-primary-foreground" : "text-primary")} />
                    <span className="truncate">All Notes</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[9.5px] px-1.5 py-0 font-mono shrink-0 ml-1 border-0", selectedFolderFilter === 'ALL' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent text-muted-foreground")}>
                    {allLogs.length}
                  </Badge>
                </button>

                {/* 2. Telegram Buffer Option */}
                {totalTelegramCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderFilter(selectedFolderFilter === 'Telegram' ? 'ALL' : 'Telegram');
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDragEnter={() => setDragOverFolder('Telegram')}
                    onDragLeave={() => setDragOverFolder(null)}
                    onDrop={(e) => handleDropOnFolder(e, 'Telegram')}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-left font-bold text-xs transition-all flex items-center justify-between border relative group",
                      selectedFolderFilter === 'Telegram'
                        ? "bg-sky-500/25 text-sky-300 border-sky-500/50 shadow-md"
                        : "bg-sky-500/10 text-sky-300/80 hover:text-sky-300 border-sky-500/20 hover:bg-sky-500/15",
                      draggingLog && "border-dashed border-sky-400 bg-sky-500/10",
                      dragOverFolder === 'Telegram' && "scale-105 ring-2 ring-sky-400 border-sky-400 bg-sky-500/30 text-white font-extrabold shadow-[0_0_15px_rgba(56,189,248,0.5)]"
                    )}
                    title="Drop here to move into Telegram folder"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">Telegram</span>
                    </div>
                    <Badge variant="outline" className="text-[9.5px] px-1.5 py-0 font-mono bg-sky-500/20 text-sky-300 border-sky-500/30 shrink-0 ml-1">
                      {totalTelegramCount}
                    </Badge>
                  </button>
                )}

                {/* 2.5. App Ideas Checklist Capsule */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFolderFilter(selectedFolderFilter === 'App' ? 'ALL' : 'App');
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragEnter={() => setDragOverFolder('App')}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={(e) => handleDropOnFolder(e, 'App')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-left font-bold text-xs transition-all flex items-center justify-between border relative group",
                    selectedFolderFilter === 'App'
                      ? "bg-gradient-to-r from-purple-500/25 via-indigo-500/25 to-primary/25 text-purple-200 border-purple-500/60 shadow-md ring-1 ring-purple-500/40"
                      : "bg-purple-500/10 text-purple-300/80 hover:text-purple-200 border-purple-500/25 hover:bg-purple-500/15",
                    draggingLog && "border-dashed border-purple-400 bg-purple-500/10",
                    dragOverFolder === 'App' && "scale-105 ring-2 ring-purple-400 border-purple-400 bg-purple-500/30 text-white font-extrabold shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                  )}
                  title="App Ideas & Feature Backlog (synced from Telegram #App topic)"
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <CheckSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">App Ideas</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9.5px] px-1.5 py-0 font-mono shrink-0 ml-1 border-0",
                      appIdeasStats.pending > 0
                        ? "bg-purple-500 text-white font-extrabold shadow-sm"
                        : "bg-purple-500/20 text-purple-300"
                    )}
                  >
                    {appIdeasStats.pending > 0 ? `${appIdeasStats.pending} pending` : appIdeasStats.total}
                  </Badge>
                </button>

                {/* 3. System & Custom Folder Drop Capsules */}
                {[
                  { name: 'General', icon: Folder, color: 'text-slate-400' },
                  { name: 'Ideas', icon: Lightbulb, color: 'text-amber-400' },
                  { name: 'Research', icon: Search, color: 'text-purple-400' },
                  { name: 'Earnings', icon: BarChart2, color: 'text-rose-400' },
                  { name: 'Watchlist', icon: Eye, color: 'text-emerald-400' },
                  { name: 'Alerts', icon: Bell, color: 'text-amber-400' },
                  { name: 'Macro', icon: Globe, color: 'text-blue-400' },
                  { name: 'Trading', icon: Zap, color: 'text-orange-400' },
                  ...((foldersData?.folders || [])
                    .filter((f) => !['General', 'Ideas', 'Research', 'Earnings', 'Watchlist', 'Alerts', 'Macro', 'Trading', 'Telegram', 'App'].includes(f.name))
                    .map((f) => ({ name: f.name, icon: Folder, color: 'text-indigo-400' }))
                  )
                ].map((folder) => {
                  const Icon = folder.icon;
                  const count = (foldersData?.folders.find((f) => f.name === folder.name)?.count) ||
                    (folder.name === 'General' ? (foldersData?.unfiledCount || allLogs.filter(l => !l.folder || l.folder === 'General').length) :
                    allLogs.filter(l => l.folder === folder.name).length);
                  const isSelected = selectedFolderFilter === folder.name;
                  const isHoveredDrop = dragOverFolder === folder.name;

                  return (
                    <button
                      key={folder.name}
                      type="button"
                      onClick={() => setSelectedFolderFilter(isSelected ? 'ALL' : folder.name)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDragEnter={() => setDragOverFolder(folder.name)}
                      onDragLeave={() => setDragOverFolder(null)}
                      onDrop={(e) => handleDropOnFolder(e, folder.name)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-left text-xs transition-all flex items-center justify-between border relative group",
                        isSelected
                          ? "bg-indigo-500/25 text-indigo-200 border-indigo-500/60 font-bold shadow-md"
                          : "bg-background/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-accent/40 font-medium",
                        draggingLog && "border-dashed border-primary/50 bg-primary/5",
                        isHoveredDrop && "scale-105 ring-2 ring-primary border-primary bg-primary/25 text-white font-extrabold shadow-[0_0_16px_rgba(99,102,241,0.5)]"
                      )}
                      title={`Click to filter. Drag note here to move to "${folder.name}"`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <Icon className={cn("w-3.5 h-3.5 shrink-0", folder.color)} />
                        <span className="truncate">{folder.name}</span>
                      </div>
                      {count > 0 && (
                        <Badge variant="outline" className={cn("text-[9.5px] px-1.5 py-0 font-mono shrink-0 ml-1 border-0", isSelected ? "bg-indigo-500/30 text-indigo-200" : "bg-accent/60 text-muted-foreground")}>
                          {count}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sentiment Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px] pt-1.5 border-t border-border/40">
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
                      ? "bg-sky-500/25 text-sky-300 border-sky-500/50 shadow-sm"
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
            ) : displayLogs.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-card/40 border border-dashed border-border/60 space-y-3">
                {selectedFolderFilter === 'UNREAD' ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground">All caught up! 🎉</p>
                      <p className="text-[11px] text-muted-foreground">
                        You have opened and reviewed all unread messages.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedFolderFilter('ALL')}
                      className="text-xs font-bold text-primary border-primary/40 hover:bg-primary/10"
                    >
                      Browse All Notes ({allLogs.length})
                    </Button>
                  </>
                ) : (
                  <>
                    <NotebookPen className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs text-muted-foreground">No thought logs found matching your filter.</p>
                    <Button size="sm" variant="outline" onClick={handleNewDraft} className="text-xs">
                      Create First Thought Log
                    </Button>
                  </>
                )}
              </div>
            ) : (
              displayLogs.map((log) => {
                const isSelected = log.id === selectedLogId;
                const sentimentMatch = SENTIMENT_OPTIONS.find((s) => s.value === log.sentiment);
                const isBeingDragged = draggingLog?.id === log.id;

                return (
                  <div
                    key={log.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', log.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingLog(log);
                    }}
                    onDragEnd={() => {
                      setDraggingLog(null);
                      setDragOverFolder(null);
                    }}
                    onClick={() => handleSelectLog(log)}
                    className={cn(
                      "p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 relative group",
                      isSelected
                        ? "bg-gradient-to-br from-indigo-950/25 via-card/90 to-card/95 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30"
                        : "bg-card/60 hover:bg-card/80 border-border/50 hover:border-border/80",
                      isBeingDragged && "opacity-40 border-dashed border-primary ring-2 ring-primary/40 shadow-2xl scale-[0.98]"
                    )}
                    title="Drag and drop onto any folder above to move this note"
                  >
                    {/* Top Row: Grip Handle, Sentiment & Folder & Pin */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Drag Grip Handle */}
                        <div
                          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 group-hover:text-muted-foreground hover:text-primary transition-colors p-0.5"
                          title="Drag to move to folder"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        {/* Unread badge */}
                        {!log.isRead && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded-full animate-pulse" title="Unread note">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>NEW</span>
                          </span>
                        )}
                        {selectedFolderFilter === 'UNREAD' && log.isRead && (
                          <span className="text-[9px] font-medium text-emerald-400/70 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-full" title="Opened in this session">
                            ✓ Read
                          </span>
                        )}

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
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary border border-border/60 text-[9px] font-medium text-foreground/80 hover:text-foreground transition-all shadow-sm"
                          title="Click to move to another folder (or drag and drop above)"
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
                        {(log.tags?.toLowerCase().includes('alert') || log.folder === 'Alerts' || log.agentOutput?.includes('Auto Price Alert')) && (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-mono flex items-center gap-1 shadow-sm">
                            <Bell className="w-2.5 h-2.5 text-amber-400" />
                            Alert
                          </Badge>
                        )}
                        {log.agentOutput && (
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[9px] font-mono">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-300" />
                            AI Audited
                          </Badge>
                        )}
                        {(log.folder === 'App' || log.isFulfilled) && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const newFulfilled = !log.isFulfilled;
                                await updateLogMutation.mutateAsync({
                                  id: log.id,
                                  data: {
                                    isFulfilled: newFulfilled,
                                    fulfilledAt: newFulfilled ? new Date().toISOString() : null,
                                  } as any,
                                });
                                toast.success(newFulfilled ? 'Marked as fulfilled' : 'Marked as pending');
                              } catch (err: any) {
                                toast.error(err.message);
                              }
                            }}
                            className={cn(
                              "px-1.5 py-0.2 rounded-md text-[9px] font-bold border flex items-center gap-1 transition-all",
                              log.isFulfilled
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25"
                            )}
                            title={log.isFulfilled ? "Fulfilled! Click to mark pending" : "Click to mark fulfilled"}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>{log.isFulfilled ? 'Fulfilled' : 'Tick Done'}</span>
                          </button>
                        )}

                        {/* Antigravity Code Button for App ideas */}
                        {(log.folder === 'App' || (log.tags && log.tags.includes('App'))) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAntigravityFromLog(log);
                            }}
                            className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xs flex items-center gap-1 transition-all shrink-0 border border-indigo-400/30"
                            title="Code this function with Antigravity AI agent"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                            <span>⚡ Code</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate({ id: log.id, isRead: !log.isRead });
                            toast.success(!log.isRead ? 'Marked as read' : 'Marked as unread');
                          }}
                          className="p-1 rounded hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
                          title={log.isRead ? "Mark as unread" : "Mark as read"}
                        >
                          {log.isRead ? <Mail className="w-3.5 h-3.5 text-muted-foreground" /> : <MailOpen className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const cardAlerts = extractPriceAlertCandidates(`${log.title} ${log.content}`);
                            handleOpenSetAlert(cardAlerts[0], log);
                          }}
                          className="p-1 rounded hover:bg-amber-500/20 text-muted-foreground hover:text-amber-300 transition-colors"
                          title="Set price alert for this thought log (auto-detects price if mentioned)"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </button>
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
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {log.symbols.split(',').slice(0, 3).map((sym) => {
                            const clean = sym.trim().toUpperCase();
                            const hasIdea = ideasBySymbol.has(clean);
                            return (
                              <span
                                key={clean}
                                className={cn(
                                  "px-1.5 py-0.2 rounded font-bold text-foreground inline-flex items-center gap-0.5 text-[9.5px]",
                                  hasIdea
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-accent/40"
                                )}
                                title={hasIdea ? `Active idea in Ideas tab for $${clean}` : undefined}
                              >
                                {hasIdea && <Lightbulb className="w-2.5 h-2.5 text-amber-300" />}
                                ${clean}
                              </span>
                            );
                          })}
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
          {/* If viewing App folder: offer view switcher between Checklist and Raw Editor */}
          {selectedFolderFilter === 'App' && (
            <div className="flex items-center justify-between bg-card/60 border border-border/70 p-2.5 px-3.5 rounded-2xl shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-foreground">App Roadmap View:</span>
              </div>
              <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setAppFolderViewMode('checklist')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                    appFolderViewMode === 'checklist'
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Roadmap Checklist</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppFolderViewMode('editor')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                    appFolderViewMode === 'editor'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <NotebookPen className="w-3.5 h-3.5" />
                  <span>Journal Editor</span>
                </button>
              </div>
            </div>
          )}

          {selectedFolderFilter === 'App' && appFolderViewMode === 'checklist' ? (
            <AppIdeasChecklist onPlanFeatureWithAI={handlePlanFeatureWithAI} />
          ) : (
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

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* Code with Antigravity for App ideas */}
                  {(editFolder === 'App' || editTags.includes('App')) && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        const current = logs.find((l) => l.id === selectedLogId);
                        if (current) {
                          handleOpenAntigravityFromLog(current);
                        } else {
                          handleOpenAntigravityFromLog({
                            id: 'draft',
                            title: editTitle || 'New App Idea',
                            content: editContent,
                            folder: editFolder,
                            tags: editTags,
                            sentiment: editSentiment,
                            isPinned: editIsPinned,
                            isRead: true,
                            isFulfilled: false,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          } as any);
                        }
                      }}
                      className="h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 shadow-md shadow-indigo-500/25"
                      title="Pair with Antigravity AI to code this feature"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>Code with Antigravity</span>
                    </Button>
                  )}

                  {/* Linked Ideas shortcut indicator */}
                  {linkedIdeasForCurrentLog.length > 0 && onNavigateToIdeas && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onNavigateToIdeas();
                        toast.info(`Switched to Ideas section (${linkedIdeasForCurrentLog.length} idea(s) found)`);
                      }}
                      className="h-8 text-xs font-bold gap-1.5 bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-sm"
                      title="View linked Trade Idea(s) in Ideas section"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                      <span>View in Ideas ({linkedIdeasForCurrentLog.length})</span>
                    </Button>
                  )}

                  {/* Set Price Alert Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenSetAlert(detectedAlertsInActiveDraft[0])}
                    className="h-8 text-xs font-bold gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/35 text-amber-300 shadow-sm"
                    title="Set a price alert for symbols mentioned in this log (auto-detects price if sent)"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      Set Alert
                      {detectedAlertsInActiveDraft.length > 0
                        ? ` (${detectedAlertsInActiveDraft[0].symbol} @ $${detectedAlertsInActiveDraft[0].targetPrice})`
                        : detectedTickers.length > 0
                        ? ` (${detectedTickers[0]})`
                        : ''}
                    </span>
                  </Button>

                  {/* Save to Trade Ideas Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveToIdeas}
                    disabled={createIdeaMutation.isPending}
                    className="h-8 text-xs font-bold gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/35 text-amber-300 shadow-sm"
                    title="Promote and save this thought log & thesis to Trade Ideas section"
                  >
                    {createIdeaMutation.isPending ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Saving...</span></>
                    ) : (
                      <><Lightbulb className="w-3.5 h-3.5 text-amber-400" /><span>Save to Ideas</span></>
                    )}
                  </Button>

                  {selectedLogId && selectedLogId !== 'new_draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const currentLog = allLogs.find((l) => l.id === selectedLogId);
                        const newReadState = !currentLog?.isRead;
                        markReadMutation.mutate({ id: selectedLogId, isRead: newReadState });
                        toast.success(newReadState ? 'Marked as read' : 'Marked as unread');
                      }}
                      className="h-8 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
                      title="Toggle read / unread status for this note"
                    >
                      {allLogs.find((l) => l.id === selectedLogId)?.isRead ? (
                        <Mail className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <MailOpen className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {allLogs.find((l) => l.id === selectedLogId)?.isRead ? 'Mark Unread' : 'Mark Read'}
                      </span>
                    </Button>
                  )}

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
                      {detectedTickers.map((ticker) => {
                        const hasIdea = ideasBySymbol.has(ticker.toUpperCase());
                        const alertMatch = detectedAlertsInActiveDraft.find((a) => a.symbol === ticker.toUpperCase());
                        return (
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
                              onClick={() => handleOpenSetAlert(alertMatch || { symbol: ticker })}
                              className="text-amber-400 hover:text-amber-300 p-0.5 transition-colors"
                              title={alertMatch ? `Set price alert for ${ticker} @ $${alertMatch.targetPrice}` : `Set price alert for ${ticker}`}
                            >
                              <Bell className="w-3 h-3 text-amber-400" />
                            </button>
                            {hasIdea && onNavigateToIdeas && (
                              <button
                                type="button"
                                onClick={() => onNavigateToIdeas()}
                                className="text-amber-400 hover:text-amber-300 p-0.5 transition-colors"
                                title={`View active Trade Idea for $${ticker} in Ideas tab`}
                              >
                                <Lightbulb className="w-3 h-3 text-amber-300" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Live Price Alert Detection Banner */}
              {detectedAlertsInActiveDraft.length > 0 && (
                <div className="p-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wide">
                          {detectedAlertsInActiveDraft.length === 1 ? '🎯 Detected Price Alert' : `🎯 ${detectedAlertsInActiveDraft.length} Detected Price Alerts`}:
                        </span>
                        {detectedAlertsInActiveDraft.map((cand) => (
                          <span
                            key={`${cand.symbol}-${cand.targetPrice}`}
                            className="inline-flex items-center gap-1 text-xs font-mono font-bold bg-background/80 text-foreground px-2 py-0.5 rounded-md border border-amber-500/40 shadow-xs"
                          >
                            <span className="text-primary font-bold">{cand.symbol}</span>
                            <span className="text-amber-300">@ ${cand.targetPrice}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">({cand.condition})</span>
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Target price parsed from message. Saving will automatically arm this alert, or customize it below.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSetAlert(detectedAlertsInActiveDraft[0])}
                      className="h-7.5 px-3 text-xs font-bold gap-1.5 bg-amber-500/25 text-amber-200 border-amber-500/50 hover:bg-amber-500/35 shadow-xs"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Set Alert ({detectedAlertsInActiveDraft[0].symbol} @ ${detectedAlertsInActiveDraft[0].targetPrice})</span>
                    </Button>
                  </div>
                </div>
              )}

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
                        onClick={() => {
                          if (act.id === 'PROPOSE_STRUCTURES') {
                            handleOpenTradeStructure();
                          }
                          handleTriggerAgent(act.id);
                        }}
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

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => handleOpenTradeStructure()}
                        className="h-7 text-[11px] font-bold gap-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm"
                        title="Pick from structured options/stock execution strategies and save to Trades tab"
                      >
                        <Zap className="w-3 h-3 text-amber-200" />
                        <span>Structure & Follow in Trades</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveToIdeas}
                        disabled={createIdeaMutation.isPending}
                        className="h-7 text-[11px] font-bold gap-1 bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20"
                        title="Save this completed AI institutional analysis directly to the Ideas tab"
                      >
                        <Lightbulb className="w-3 h-3 text-amber-300" />
                        <span>Save as Idea</span>
                      </Button>

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

                  {/* Interactive Trade Structure Fast-Action Banner */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Zap className="w-4 h-4 text-amber-300" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          Execute Derivatives & Follow in Trades
                        </span>
                        <span className="text-[10.5px] text-muted-foreground">
                          Choose from AI-computed Spreads, LEAPs, Covered Calls, or Short Puts and log directly into your Trades tracking table.
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOpenTradeStructure()}
                      className="h-7.5 text-xs font-bold gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm shrink-0"
                    >
                      <Sparkles className="w-3 h-3 text-amber-200" />
                      <span>Pick Structure & Follow</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Live Market Telemetry Chips (if detected) */}
                  {currentMarketData.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-border/40 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block font-sans">
                        Live Market Telemetry Grounding ({currentMarketData.length} Assets)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {currentMarketData.map((m) => {
                          const hasIdea = ideasBySymbol.has(m.symbol.toUpperCase());
                          return (
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
                                {hasIdea && onNavigateToIdeas && (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToIdeas()}
                                    className="text-amber-400 hover:text-amber-300 p-0.5 rounded hover:bg-amber-500/20 transition-colors"
                                    title={`View active Trade Idea for $${m.symbol} in Ideas section`}
                                  >
                                    <Lightbulb className="w-3 h-3 text-amber-300" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenTradeStructure(m.symbol);
                                  }}
                                  className="text-muted-foreground hover:text-amber-400 p-0.5 rounded hover:bg-amber-500/10 transition-colors"
                                  title={`Structure trade on ${m.symbol} & save to Trades`}
                                >
                                  <Zap className="w-3 h-3 text-amber-400" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSetAlert({ symbol: m.symbol, price: m.price });
                                  }}
                                  className="text-muted-foreground hover:text-amber-400 p-0.5 rounded hover:bg-amber-500/10 transition-colors"
                                  title={`Set price alert on ${m.symbol} (Spot: $${m.price.toFixed(2)})`}
                                >
                                  <Bell className="w-3 h-3 text-amber-400" />
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
                          );
                        })}
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
          )}
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

      {/* AI Trade Structuring Modal with 1-Click Save to Trades */}
      <TradeStructureModal
        isOpen={isTradeStructureModalOpen}
        onClose={() => setIsTradeStructureModalOpen(false)}
        initialSymbol={tradeStructureSymbol}
        initialThesis={tradeStructureThesis}
        initialSentiment={tradeStructureSentiment}
        onNavigateToTrades={onNavigateToTrades}
        onNavigateToIdeas={onNavigateToIdeas}
      />

      {/* Price Alert Modal with Auto-Detected Target & Live Quotes */}
      {isAlertModalOpen && (
        <PriceAlertModal
          open={isAlertModalOpen}
          onOpenChange={setIsAlertModalOpen}
          initialSymbol={alertModalConfig?.symbol || ''}
          initialPrice={alertModalConfig?.price || 0}
          initialTargetPrice={alertModalConfig?.targetPrice}
          initialCondition={alertModalConfig?.condition}
          initialNotes={alertModalConfig?.notes}
          onSuccess={() => {
            toast.success(`Price alert created for ${alertModalConfig?.symbol}!`, {
              description: 'Actively monitoring live quotes in your Alerts center.',
            });
          }}
        />
      )}

      {/* Antigravity Autonomous Coding Modal */}
      <AntigravityCodingModal
        isOpen={Boolean(antigravityModalIdea)}
        onOpenChange={(open) => {
          if (!open) {
            setAntigravityModalIdea(null);
            setAntigravityModalLogId(undefined);
          }
        }}
        idea={antigravityModalIdea}
        logId={antigravityModalLogId}
      />
    </div>
  );
}
