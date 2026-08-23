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
import {
  useAgentActivities,
  useClearAgentActivities,
  AgentActivityEvent,
  AgentType
} from '@/services/agentActivityService';
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
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AgentActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentActivityDrawer({ isOpen, onClose }: AgentActivityDrawerProps) {
  const { data: activities = [], refetch, isLoading } = useAgentActivities(50);
  const clearMutation = useClearAgentActivities();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const runningTask = activities.find(a => a.status === 'RUNNING');

  const handleClear = async () => {
    try {
      await clearMutation.mutateAsync();
      toast.success('Agent execution telemetry cleared');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear activities');
    }
  };

  const getAgentBadge = (type: AgentType) => {
    switch (type) {
      case 'PORTFOLIO_AUDIT':
        return {
          label: 'Portfolio Analyser',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        };
      case 'POSITION_DEFENSE':
        return {
          label: 'Position Advisor',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
        };
      case 'RESEARCH_AGENT':
        return {
          label: 'Deep Research Agent',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: <Terminal className="w-3.5 h-3.5 text-blue-400" />
        };
      case 'STOCK_ANALYSIS':
        return {
          label: 'Stock Analyst',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          icon: <Activity className="w-3.5 h-3.5 text-cyan-400" />
        };
      case 'TRADE_IDEA_GENERATOR':
        return {
          label: 'Idea Hunter',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <Zap className="w-3.5 h-3.5 text-emerald-400" />
        };
      default:
        return {
          label: 'AI Agent',
          badge: 'bg-muted text-muted-foreground',
          icon: <Bot className="w-3.5 h-3.5" />
        };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-3xl h-[85vh] max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl border border-primary/30 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-slate-950/40 shrink-0">
          <div className="flex items-center justify-between gap-4 pr-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary text-white font-bold text-xs uppercase tracking-wider px-2 py-0.5 shadow-sm">
                  Agent Telemetry
                </Badge>
                {runningTask ? (
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    Agent Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Agents Idle
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 pt-1">
                <Bot className="w-5 h-5 text-primary" />
                AI Agent Execution Telemetry
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Real-time tracking of every autonomous task, model inference duration, and outcome across the platform.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              </Button>
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
            </div>
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

        {/* Activities Timeline List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin">
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
                      "bg-card/40 border transition-all text-xs",
                      isRunning
                        ? "border-purple-500/60 bg-purple-950/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                        : isSuccess
                        ? "border-border/50 hover:border-border/80 hover:bg-card/60"
                        : "border-rose-500/40 bg-rose-950/10"
                    )}
                  >
                    <CardContent className="p-3.5 space-y-2">
                      {/* Top row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn("text-[10px] font-bold flex items-center gap-1", badgeInfo.badge)}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
