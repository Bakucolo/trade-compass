import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useAgentActivities,
  useClearAgentActivities,
  AgentActivityEvent,
  AgentType,
} from '@/services/agentActivityService';
import {
  useLLMAllowances,
  useResetLLMCooldown,
  ProviderAllowance,
} from '@/services/llmAllowancesService';
import {
  Bot,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Zap,
  Terminal,
  Activity,
  Gauge,
  Cpu,
  Server,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AgentActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentActivityDrawer({ isOpen, onClose }: AgentActivityDrawerProps) {
  const [activeTab, setActiveTab] = useState<'allowances' | 'activity'>('allowances');
  const { data: activities = [], refetch: refetchActivities, isLoading: isLoadingActivities } = useAgentActivities(50);
  const { data: allowancesReport, refetch: refetchAllowances, isLoading: isLoadingAllowances } = useLLMAllowances();
  const clearMutation = useClearAgentActivities();
  const resetCooldownMutation = useResetLLMCooldown();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const runningTask = activities.find((a) => a.status === 'RUNNING');
  const isRefreshing = isLoadingActivities || isLoadingAllowances;

  const handleRefreshAll = async () => {
    try {
      await Promise.all([refetchActivities(), refetchAllowances()]);
      toast.success('Telemetry & Allowances updated');
    } catch {
      toast.error('Failed to refresh data');
    }
  };

  const handleClear = async () => {
    try {
      await clearMutation.mutateAsync();
      toast.success('Agent execution telemetry cleared');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear activities');
    }
  };

  const handleResetCooldown = async (providerId?: string) => {
    try {
      await resetCooldownMutation.mutateAsync(providerId);
      toast.success(`Circuit breaker reset for ${providerId || 'all providers'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset cooldown');
    }
  };

  const getAgentBadge = (type: AgentType) => {
    switch (type) {
      case 'PORTFOLIO_AUDIT':
        return {
          label: 'Portfolio Analyser',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
        };
      case 'POSITION_DEFENSE':
        return {
          label: 'Position Advisor',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'RESEARCH_AGENT':
        return {
          label: 'Deep Research Agent',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: <Terminal className="w-3.5 h-3.5 text-blue-400" />,
        };
      case 'STOCK_ANALYSIS':
        return {
          label: 'Stock Analyst',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          icon: <Activity className="w-3.5 h-3.5 text-cyan-400" />,
        };
      case 'MACRO_DOSSIER':
        return {
          label: 'Macro Dossier Agent',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          icon: <Activity className="w-3.5 h-3.5 text-cyan-400" />,
        };
      case 'PORTFOLIO_VALUATION':
        return {
          label: 'Valuation Auditor',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <Layers className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case 'DIP_ANALYZER':
        return {
          label: 'Dip Diagnostic',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'TRADE_IDEA_GENERATOR':
        return {
          label: 'Idea Hunter',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <Zap className="w-3.5 h-3.5 text-emerald-400" />,
        };
      default:
        return {
          label: 'AI Agent',
          badge: 'bg-muted text-muted-foreground',
          icon: <Bot className="w-3.5 h-3.5" />,
        };
    }
  };

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'openrouter':
        return <Sparkles className="w-4 h-4 text-sky-400" />;
      case 'google-ai-studio':
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'groq':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'ollama':
        return <Server className="w-4 h-4 text-indigo-400" />;
      default:
        return <Bot className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-4xl h-[88vh] max-h-[88vh] p-0 flex flex-col gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl border border-primary/30 shadow-2xl rounded-2xl">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-slate-950/40 shrink-0">
            <div className="flex items-center justify-between gap-4 pr-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-primary text-white font-bold text-xs uppercase tracking-wider px-2 py-0.5 shadow-sm">
                    Agent Telemetry & Quotas
                  </Badge>
                  {runningTask ? (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs animate-pulse flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                      Agent Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Cascade Healthy
                    </Badge>
                  )}
                  {allowancesReport && (
                    <Badge variant="secondary" className="text-[11px] font-mono">
                      Today: {allowancesReport.totalCallsToday} inferences
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 pt-1">
                  <Bot className="w-5 h-5 text-primary" />
                  AI Agent Activity & Allowances
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Monitor your free-tier allowances, token consumption, remaining limits, and autonomous agent execution logs.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshAll}
                  disabled={isRefreshing}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  title="Refresh telemetry and live allowances"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isRefreshing && 'animate-spin')} />
                  Refresh
                </Button>
                {activeTab === 'activity' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    disabled={activities.length === 0}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="pt-3">
              <TabsList className="grid w-full grid-cols-2 bg-slate-900/60 p-1 border border-border/40">
                <TabsTrigger
                  value="allowances"
                  className="text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center justify-center gap-2"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span>Model Allowances & Quotas</span>
                  {allowancesReport && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary-foreground/30 text-inherit">
                      {allowancesReport.providers.filter((p) => p.isAvailable).length} Active
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center justify-center gap-2"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Execution Telemetry Log</span>
                  {activities.length > 0 && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary-foreground/30 text-inherit">
                      {activities.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </DialogHeader>

          {/* Running Task Glowing Banner */}
          {runningTask && (
            <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border-b border-purple-500/30 shrink-0 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="truncate">
                  <span className="font-bold text-purple-300 block truncate">
                    ⚡ {runningTask.agentName}
                  </span>
                  <span className="text-muted-foreground text-[11px] block truncate">
                    {runningTask.taskDescription}
                  </span>
                </div>
              </div>
              <Badge className="bg-purple-500 text-white font-mono text-[10px] shrink-0 animate-pulse">
                EXECUTING NOW
              </Badge>
            </div>
          )}

          {/* Content Body: Allowances Tab */}
          <TabsContent value="allowances" className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin m-0 focus-visible:outline-none">
            {/* Cascade Architecture Diagram Banner */}
            <div className="p-3.5 rounded-xl bg-slate-900/50 border border-border/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Zero-Downtime Fallback Cascade Chain
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Auto-switches if primary hits 429 rate limit or 5xx error
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40">
                  1. OpenRouter (Primary)
                </Badge>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                  2. Google AI Studio (Secondary)
                </Badge>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                  3. Groq LPUs (Tertiary)
                </Badge>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40">
                  4. Ollama (Offline Local)
                </Badge>
              </div>
            </div>

            {/* Provider Allowance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {allowancesReport?.providers.map((provider: ProviderAllowance) => {
                const isCooling = provider.isCoolingDown;
                const isAvailable = provider.isAvailable;
                const hasKey = provider.hasKey;

                // Determine progress value & display text
                let progressPercent = provider.percentRemaining;
                let consumedDisplay = '';
                let remainingDisplay = '';

                if (provider.quotaType === 'usd') {
                  consumedDisplay = `$${provider.consumed.toFixed(4)}`;
                  remainingDisplay = provider.remaining !== null
                    ? `$${provider.remaining.toFixed(4)} balance`
                    : 'Free Tier';
                } else if (provider.quotaType === 'requests_daily') {
                  consumedDisplay = `${provider.consumed.toLocaleString()} reqs`;
                  remainingDisplay = provider.remaining !== null
                    ? `${provider.remaining.toLocaleString()} left today`
                    : 'Unlimited';
                } else {
                  consumedDisplay = `${provider.consumed} calls`;
                  remainingDisplay = 'Unlimited (Local)';
                }

                return (
                  <Card
                    key={provider.providerId}
                    className={cn(
                      'border transition-all text-xs bg-card/60 backdrop-blur-sm',
                      isCooling
                        ? 'border-amber-500/60 bg-amber-950/15 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                        : isAvailable
                        ? 'border-border/60 hover:border-border/90'
                        : 'border-rose-500/40 bg-rose-950/10 opacity-70'
                    )}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Header: Name, Tier, Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-background/80 border border-border/50">
                            {getProviderIcon(provider.providerId)}
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              {provider.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="secondary"
                                className="text-[10px] py-0 px-1.5 font-medium"
                              >
                                {provider.tier}
                              </Badge>
                              {!hasKey && provider.providerId !== 'ollama' && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1 text-rose-400 border-rose-500/40">
                                  No Key
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Circuit Breaker Status */}
                        <div className="flex flex-col items-end gap-1">
                          {isCooling ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3" />
                              Cooldown ({provider.cooldownRemainingSeconds}s)
                            </Badge>
                          ) : isAvailable ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Available
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              Unavailable
                            </Badge>
                          )}

                          {isCooling && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetCooldown(provider.providerId)}
                              className="h-6 px-1.5 text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Consumption & Allowance Progress Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            Consumed: <b className="text-foreground">{consumedDisplay}</b>
                          </span>
                          <span className="font-semibold text-emerald-400">
                            {remainingDisplay}
                          </span>
                        </div>

                        <div className="relative">
                          <Progress
                            value={progressPercent}
                            className="h-2 bg-slate-800"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                          <span>
                            Allowance: {provider.totalQuota ? `${provider.totalQuota.toLocaleString()} ${provider.unitLabel}` : 'Unlimited Local'}
                          </span>
                          <span className="font-mono">
                            {progressPercent}% capacity
                          </span>
                        </div>
                      </div>

                      {/* Rate Limits & Active Model */}
                      <div className="p-2.5 rounded-lg bg-background/50 border border-border/40 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Active Model:</span>
                          <span className="font-mono font-medium text-foreground truncate max-w-[200px]" title={provider.activeModel}>
                            {provider.activeModel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-1 pt-1 border-t border-border/20 text-[10px]">
                          <span className="text-muted-foreground">Rate Limits:</span>
                          <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                            {provider.rateLimits.rpm && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1">
                                {provider.rateLimits.rpm} RPM
                              </Badge>
                            )}
                            {provider.rateLimits.rpd && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1">
                                {provider.rateLimits.rpd.toLocaleString()} RPD
                              </Badge>
                            )}
                            {provider.rateLimits.tpm && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1">
                                {(provider.rateLimits.tpm / 1000).toFixed(0)}k TPM
                              </Badge>
                            )}
                          </div>
                        </div>

                        {provider.notes && (
                          <p className="text-[10px] text-muted-foreground/80 italic pt-0.5">
                            ℹ️ {provider.notes}
                          </p>
                        )}
                      </div>

                      {/* Inferences statistics */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                        <span>Today: {provider.requestsToday} reqs</span>
                        <span>Lifetime: {provider.successfulCalls} / {provider.totalCalls} ok</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Tips & Strategy Footer */}
            <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/30 text-[11px] text-blue-200/90 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <b className="text-blue-300">Intelligent Free-Tier Routing:</b> When OpenRouter hits its free tier rate limit or quota, requests automatically failover to Google Gemini (1,500 free daily requests), followed by Groq (14,400 free daily requests at 300+ tokens/sec), and finally your local Ollama server.
              </div>
            </div>
          </TabsContent>

          {/* Content Body: Activity Tab */}
          <TabsContent value="activity" className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin m-0 focus-visible:outline-none">
            {activities.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                <h4 className="text-base font-bold text-foreground">No Agent Activity Logged Yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Whenever you trigger the AI Portfolio Analyser, Position Defense Advisor, Deep Research Agent, or Trade Idea Hunter, live telemetry will print here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activities.map((item) => {
                  const badgeInfo = getAgentBadge(item.agentType);
                  const isExpanded = expandedId === item.id;
                  const isRunning = item.status === 'RUNNING';
                  const isSuccess = item.status === 'SUCCESS';

                  return (
                    <Card
                      key={item.id}
                      className={cn(
                        'bg-card/40 border transition-all text-xs',
                        isRunning
                          ? 'border-purple-500/60 bg-purple-950/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                          : isSuccess
                          ? 'border-border/50 hover:border-border/80 hover:bg-card/60'
                          : 'border-rose-500/40 bg-rose-950/10'
                      )}
                    >
                      <CardContent className="p-3.5 space-y-2">
                        {/* Top row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn('text-[10px] font-bold flex items-center gap-1', badgeInfo.badge)}
                            >
                              {badgeInfo.icon}
                              {badgeInfo.label}
                            </Badge>

                            {item.targetSymbol && (
                              <Badge variant="secondary" className="font-mono text-[10px] font-bold">
                                {item.targetSymbol}
                              </Badge>
                            )}

                            <span className="font-semibold text-foreground text-xs">
                              {item.taskDescription}
                            </span>
                          </div>

                          {/* Status & Duration */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {item.durationMs !== undefined && (
                              <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                                {(item.durationMs / 1000).toFixed(2)}s
                              </Badge>
                            )}

                            {isRunning ? (
                              <Badge className="bg-purple-500 text-white font-mono text-[10px] animate-pulse">
                                RUNNING
                              </Badge>
                            ) : isSuccess ? (
                              <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Success
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                                <XCircle className="w-3.5 h-3.5" /> Failed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Outcome summary */}
                        {item.outcomeSummary && (
                          <div className="p-2 rounded-lg bg-background/60 border border-border/40 text-[11px] text-foreground/90 font-medium">
                            <b className="text-primary mr-1">Outcome:</b> {item.outcomeSummary}
                          </div>
                        )}

                        {/* Error message if any */}
                        {item.error && (
                          <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-300">
                            <b>Error:</b> {item.error}
                          </div>
                        )}

                        {/* Bottom timestamp & expander */}
                        <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground border-t border-border/20">
                          <span className="font-mono">
                            {new Date(item.startedAt).toLocaleTimeString()} • {new Date(item.startedAt).toLocaleDateString()}
                          </span>

                          {item.metadata && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span>Metadata</span>
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                          )}
                        </div>

                        {/* Expanded Metadata JSON */}
                        {isExpanded && item.metadata && (
                          <pre className="p-2.5 rounded-lg bg-slate-950 text-[10px] text-muted-foreground font-mono overflow-x-auto border border-border/40">
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
