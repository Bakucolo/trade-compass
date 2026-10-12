import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  Briefcase,
  LineChart,
  NotebookPen,
  Target,
  Bell,
  Lightbulb,
  Smartphone,
  RefreshCw,
  Send,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export interface TelegramTopicsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TopicConfigItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  threadKey: string;
  configEndpoint: string;
  color: string;
  borderColor: string;
  commands: string[];
  metricsKey: string;
}

const TOPICS_CONFIG: TopicConfigItem[] = [
  {
    id: 'BALANCES',
    name: 'Balances',
    description: 'Query cash, buying power, margins, and broker balances',
    icon: Wallet,
    threadKey: 'balancesThreadId',
    configEndpoint: '/api/telegram/config-balances-thread',
    color: 'text-emerald-400 bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    commands: ['balances', 'cash', 'margins', 'tastytrade', 'ibkr', 't212'],
    metricsKey: 'balances',
  },
  {
    id: 'POSITIONS',
    name: 'Positions',
    description: 'Track equities, long options, short options & ticker exposure',
    icon: Briefcase,
    threadKey: 'positionsThreadId',
    configEndpoint: '/api/telegram/config-positions-thread',
    color: 'text-blue-400 bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    commands: ['AAPL', 'options', 'short options', 'long options', 'equities', 'brokers'],
    metricsKey: 'positions',
  },
  {
    id: 'WATCHLIST',
    name: 'Watchlist',
    description: 'Filter watchlists with criteria & AI thematic portfolio curation',
    icon: LineChart,
    threadKey: 'watchlistThreadId',
    configEndpoint: '/api/telegram/config-watchlist-thread',
    color: 'text-cyan-400 bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    commands: ['all watchlists', 'Tech PE < 30', 'Tech AAPL NVDA', 'Quantum Computing'],
    metricsKey: 'watchlists',
  },
  {
    id: 'NOTES',
    name: 'Notes & DD',
    description: 'Check, save, list, and clear stock research notes pinned in app',
    icon: NotebookPen,
    threadKey: 'notesThreadId',
    configEndpoint: '/api/telegram/config-notes-thread',
    color: 'text-amber-400 bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    commands: ['AAPL', 'all notes', 'AAPL Great beat', 'delete note AAPL'],
    metricsKey: 'notes',
  },
  {
    id: 'EXECUTION',
    name: 'Execution Queue',
    description: 'Queue orders, check pending tactical trades & cancel orders',
    icon: Target,
    threadKey: 'executionThreadId',
    configEndpoint: '/api/telegram/config-execution-thread',
    color: 'text-rose-400 bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    commands: ['queue', 'orders', 'BUY 100 AAPL @ 220 SL 210', 'cancel AAPL'],
    metricsKey: 'execution',
  },
  {
    id: 'ALERTS',
    name: 'Price Alerts',
    description: 'Arm 24/7 price triggers, check active monitors & disarm alerts',
    icon: Bell,
    threadKey: 'alertsThreadId',
    configEndpoint: '/api/telegram/config-alerts-thread',
    color: 'text-purple-400 bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    commands: ['alerts', 'Alert NVDA above $145', 'AAPL < 210', 'delete alert NVDA'],
    metricsKey: 'alerts',
  },
  {
    id: 'IDEAS',
    name: 'Market Ideas',
    description: 'Log market observations, catalysts & macro investment theses',
    icon: Lightbulb,
    threadKey: 'ideasThreadId',
    configEndpoint: '/api/telegram/config-ideas-thread',
    color: 'text-yellow-400 bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    commands: ['ideas', 'recent ideas', 'ideas NVDA', 'Long $CCJ uranium thesis'],
    metricsKey: 'ideas',
  },
  {
    id: 'APP',
    name: 'App Roadmap',
    description: 'Submit UI ideas, feature requests & bugs; inspect roadmap backlog',
    icon: Smartphone,
    threadKey: 'appThreadId',
    configEndpoint: '/api/telegram/config-app-thread',
    color: 'text-indigo-400 bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    commands: ['roadmap', 'ideas', '[UI] Add dark mode', '[Bug] Fix timeout'],
    metricsKey: 'app',
  },
];

export function TelegramTopicsModal({ isOpen, onClose }: TelegramTopicsModalProps) {
  const queryClient = useQueryClient();
  const [threadInputs, setThreadInputs] = useState<Record<string, string>>({});
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [testingTopicId, setTestingTopicId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Fetch live summary and config status
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['telegramTopicsSummary'],
    queryFn: async () => {
      const res = await fetch('/api/telegram/topics-summary');
      if (!res.ok) throw new Error('Failed to fetch topics summary');
      return res.json();
    },
    enabled: isOpen,
    refetchInterval: 10000,
  });

  const status = data?.status || {};
  const metrics = data?.metrics || {};

  // Sync buffer mutation
  const syncBufferMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/telegram/sync-buffer', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: (resData) => {
      toast({
        title: 'Buffer Synchronized',
        description: `Ingested ${resData.consumedCount || 0} mobile messages from Telegram.`,
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['thoughtLogs'] });
      queryClient.invalidateQueries({ queryKey: ['plannedTrades'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Sync Error',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Save thread ID mutation
  const saveThreadMutation = useMutation({
    mutationFn: async ({ endpoint, threadId }: { endpoint: string; threadId: string }) => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      });
      if (!res.ok) throw new Error('Failed to save thread ID');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Thread ID Saved',
        description: 'Topic mapping persisted to configuration.',
      });
      setEditingTopicId(null);
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: 'Save Failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Test ping mutation
  const testTopicMutation = useMutation({
    mutationFn: async ({ topicName, threadId }: { topicName: string; threadId?: string }) => {
      const res = await fetch('/api/telegram/test-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicName, threadId }),
      });
      if (!res.ok) throw new Error('Test message failed');
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({
        title: 'Verification Ping Sent',
        description: `Delivered test ping to ${vars.topicName} topic in Telegram.`,
      });
      setTestingTopicId(null);
    },
    onError: (err: any) => {
      toast({
        title: 'Test Failed',
        description: err.message,
        variant: 'destructive',
      });
      setTestingTopicId(null);
    },
  });

  const handleSaveThread = (topic: TopicConfigItem) => {
    const val = threadInputs[topic.id] ?? status[topic.threadKey] ?? '';
    saveThreadMutation.mutate({
      endpoint: topic.configEndpoint,
      threadId: val,
    });
  };

  const handleTestPing = (topic: TopicConfigItem) => {
    setTestingTopicId(topic.id);
    const threadId = status[topic.threadKey];
    testTopicMutation.mutate({
      topicName: topic.name,
      threadId,
    });
  };

  const getMetricSummary = (topicId: string) => {
    switch (topicId) {
      case 'BALANCES':
        return `${metrics.balances?.brokersCount || 0} Brokers • $${(metrics.balances?.totalPortfolioValue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      case 'POSITIONS':
        return `${metrics.positions?.totalHoldings || 0} Holdings (${metrics.positions?.shortOptionsCount || 0} Short, ${metrics.positions?.longOptionsCount || 0} Long)`;
      case 'WATCHLIST':
        return `${metrics.watchlists?.watchlistsCount || 0} Watchlists • ${metrics.watchlists?.watchlistItemCount || 0} Stocks`;
      case 'NOTES':
        return `${metrics.notes?.notesCount || 0} Pinned Notes`;
      case 'EXECUTION':
        return `${metrics.execution?.pendingTradesCount || 0} Queued Orders`;
      case 'ALERTS':
        return `${metrics.alerts?.activeAlertsCount || 0} Armed Alerts`;
      case 'IDEAS':
        return `${metrics.ideas?.ideasCount || 0} Logged Theses`;
      case 'APP':
        return `${metrics.app?.appIdeasCount || 0} Open Items`;
      default:
        return 'Active';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-card border border-border/60 bg-background/95 backdrop-blur-xl p-6 sm:p-8">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Telegram Topics Operations Hub
                  <Badge variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-500/10 text-xs">
                    8 Topics Integrated
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Check, manage, and configure real-time communication across all Telegram topics
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => syncBufferMutation.mutate()}
              disabled={syncBufferMutation.isPending}
              className="gap-2 border-sky-500/30 text-sky-300 hover:bg-sky-500/10 text-xs"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncBufferMutation.isPending && "animate-spin")} />
              Sync Buffer
            </Button>
          </div>
        </DialogHeader>

        {/* Status Telemetry Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border/50 bg-card/40 my-2 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="font-semibold text-foreground">Bot Webhook Active</div>
              <div className="text-[11px] text-muted-foreground">Listening for mobile commands</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-primary" />
            <div>
              <div className="font-semibold text-foreground">Global Control Command</div>
              <div className="text-[11px] text-muted-foreground font-mono">Send `topics` in Telegram</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-semibold text-foreground">Routing Engine</div>
              <div className="text-[11px] text-muted-foreground">Thread-Aware + AI Fallback</div>
            </div>
          </div>
        </div>

        {/* Topics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-2">
          {TOPICS_CONFIG.map((topic) => {
            const Icon = topic.icon;
            const currentThreadId = status[topic.threadKey];
            const isEditing = editingTopicId === topic.id;
            const inputValue = threadInputs[topic.id] ?? (currentThreadId ? String(currentThreadId) : '');
            const isTesting = testingTopicId === topic.id;

            return (
              <div
                key={topic.id}
                className={cn(
                  "p-4 rounded-xl border bg-card/30 hover:bg-card/50 transition-all flex flex-col justify-between space-y-3",
                  topic.borderColor
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", topic.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {topic.name}
                        {currentThreadId ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                            Thread #{currentThreadId}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-muted-foreground/30 text-muted-foreground">
                            Auto-Discover
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{topic.description}</p>
                    </div>
                  </div>
                </div>

                {/* Metrics Pill */}
                <div className="bg-muted/40 rounded-lg px-2.5 py-1 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                  <span>Live Telemetry:</span>
                  <span className="font-semibold text-foreground">{getMetricSummary(topic.id)}</span>
                </div>

                {/* Command Cheatsheet Preview */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Supported Inquiries:</div>
                  <div className="flex flex-wrap gap-1">
                    {topic.commands.map((cmd) => (
                      <span
                        key={cmd}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 border border-border/50 text-foreground/90 font-mono"
                      >
                        {cmd}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions & Thread Configuration */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        type="number"
                        placeholder="Thread ID"
                        value={inputValue}
                        onChange={(e) =>
                          setThreadInputs((prev) => ({ ...prev, [topic.id]: e.target.value }))
                        }
                        className="h-7 text-xs font-mono py-1 px-2"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveThread(topic)}
                        disabled={saveThreadMutation.isPending}
                        className="h-7 px-2 text-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingTopicId(null)}
                        className="h-7 px-2 text-xs text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingTopicId(topic.id);
                          setThreadInputs((prev) => ({
                            ...prev,
                            [topic.id]: currentThreadId ? String(currentThreadId) : '',
                          }));
                        }}
                        className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                      >
                        {currentThreadId ? 'Change Thread ID' : 'Assign Thread ID'}
                      </button>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestPing(topic)}
                    disabled={isTesting || testTopicMutation.isPending}
                    className="h-7 px-2.5 text-[11px] gap-1.5 border-border/60 hover:border-primary/40"
                  >
                    <Send className={cn("w-3 h-3 text-sky-400", isTesting && "animate-spin")} />
                    Test Ping
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Collapsible Topic Setup Guide */}
        <div className="border border-border/50 rounded-xl overflow-hidden mt-2 bg-card/20">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-card/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-sky-400" />
              <span>How to find and link Topic Thread IDs in Telegram</span>
            </div>
            <ChevronRight className={cn("w-4 h-4 transition-transform", showGuide && "rotate-90")} />
          </button>

          {showGuide && (
            <div className="p-4 pt-1 border-t border-border/40 text-xs text-muted-foreground space-y-2 bg-background/40">
              <p>
                1. <strong>In Telegram Desktop / Web</strong>: Right-click any topic in your Trade Compass group and select <strong>"Copy Link to Topic"</strong>.
              </p>
              <p>
                2. <strong>Extract the ID</strong>: The URL ends with numbers (e.g., <code>https://t.me/c/1234567890/<strong>294</strong></code>). The last number (<code>294</code>) is your Topic Thread ID.
              </p>
              <p>
                3. <strong>Automatic Detection</strong>: You can also simply type <code>set topic [name] [id]</code> directly inside Telegram, e.g. <code>set topic balances 307</code>, and Trade Compass will automatically link and persist it!
              </p>
              <p>
                4. <strong>Master Status Command</strong>: Type <code>topics</code> in any topic in Telegram to get the real-time Topic Operations Dashboard right in your chat!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
