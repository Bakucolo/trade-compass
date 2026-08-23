import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedPosition } from './types';
import { PortfolioBalancesData } from '@/services/portfolioBalanceService';
import {
  PortfolioAuditReport,
  ActionablePlaybookItem,
  useRunPortfolioAudit,
  usePortfolioAudits,
  useDeletePortfolioAudit
} from '@/services/portfolioAuditService';
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Compass,
  ArrowRight,
  Target,
  Zap,
  Layers,
  Clock,
  DollarSign,
  Activity,
  Maximize2,
  Minimize2,
  Trash2,
  FileText,
  BookmarkPlus,
  TrendingUp,
  TrendingDown,
  PieChart,
  History,
  CheckCircle2,
  Calendar,
  Bot,
  Terminal,
  Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PortfolioAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions?: UnifiedPosition[];
  balancesData?: PortfolioBalancesData;
  totals?: {
    netLiquidValue: number;
    dailyPL: number;
    unrealizedPL: number;
    buyingPower: number;
  };
  isPrivacyMode?: boolean;
}

export function PortfolioAuditModal({
  isOpen,
  onClose,
  positions = [],
  balancesData,
  totals,
  isPrivacyMode = false
}: PortfolioAuditModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeReport, setActiveReport] = useState<PortfolioAuditReport | null>(null);
  const [copiedPlaybookId, setCopiedPlaybookId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const auditMutation = useRunPortfolioAudit();
  const { data: auditHistory = [], refetch: refetchHistory, isLoading: isLoadingHistory } = usePortfolioAudits(20);
  const deleteMutation = useDeletePortfolioAudit();

  // On open, if no active report, run audit or load most recent
  useEffect(() => {
    if (isOpen) {
      if (!activeReport) {
        if (auditHistory.length > 0 && !auditMutation.isPending) {
          setActiveReport(auditHistory[0]);
        } else {
          handleRunAudit();
        }
      }
    }
  }, [isOpen]);

  const handleRunAudit = async () => {
    try {
      const res = await auditMutation.mutateAsync({
        positions,
        balancesData,
        totals
      });
      setActiveReport(res.audit);
      setActiveTab('overview');
      toast.success('Portfolio Tactical Audit generated & saved to database!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to complete portfolio audit');
    }
  };

  const handleDeleteAudit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Audit report deleted');
      if (activeReport?.id === id) {
        const remaining = auditHistory.filter(a => a.id !== id);
        setActiveReport(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete audit report');
    }
  };

  const handleCopyPlaybook = async (item: ActionablePlaybookItem) => {
    const stepsText = (item.executionSteps || []).map(s => `- ${s}`).join('\n');
    const text = `[Priority ${item.priority}: ${item.title}]\nSymbol: ${item.symbol}\nRationale: ${item.rationale}\nSteps:\n${stepsText}\nExpected Impact: ${item.expectedImpact}`;
    await navigator.clipboard.writeText(text);
    setCopiedPlaybookId(item.priority);
    toast.success(`Copied "${item.title}" playbook to clipboard!`);
    setTimeout(() => setCopiedPlaybookId(null), 2000);
  };

  const formatCurr = (val?: number, decimals = 2) => {
    if (val === undefined || isNaN(val)) return '$0.00';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const getHealthBadge = (score: number, level: string) => {
    if (score >= 80 || level === 'OPTIMAL') {
      return {
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
        gauge: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/30',
        title: 'OPTIMAL RESILIENCE',
        icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />
      };
    }
    if (score >= 60 || level === 'BALANCED') {
      return {
        badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]',
        gauge: 'text-cyan-400 border-cyan-500/50 bg-cyan-950/30',
        title: 'BALANCED STRUCTURE',
        icon: <Activity className="w-5 h-5 text-cyan-400" />
      };
    }
    if (score >= 40 || level === 'HIGH_RISK') {
      return {
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
        gauge: 'text-amber-400 border-amber-500/50 bg-amber-950/30',
        title: 'HIGH RISK / DRAWDOWN',
        icon: <AlertTriangle className="w-5 h-5 text-amber-400" />
      };
    }
    return {
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.3)]',
      gauge: 'text-rose-400 border-rose-500/50 bg-rose-950/30',
      title: 'CRITICAL DEFENSE REQUIRED',
      icon: <ShieldAlert className="w-5 h-5 text-rose-400" />
    };
  };

  const health = activeReport ? getHealthBadge(activeReport.healthScore, activeReport.riskLevel) : getHealthBadge(75, 'BALANCED');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl transition-all duration-150",
        isFullScreen
          ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 !m-0"
          : "w-[95vw] sm:max-w-6xl h-[92vh] max-h-[92vh] border border-primary/30 shadow-2xl rounded-2xl"
      )}>
        {/* ================= HEADER ================= */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-slate-950/40 relative shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-8">
            
            {/* Title & Badge */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-wider px-2.5 py-0.5 shadow-sm">
                  Autonomous Risk Engine
                </Badge>
                <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                  {(positions || []).length} Positions Audited
                </Badge>
                {activeReport?.createdAt && (
                  <Badge variant="secondary" className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(activeReport.createdAt).toLocaleDateString()} {new Date(activeReport.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight text-foreground pt-1 flex items-center gap-2.5">
                <Sparkles className="w-6 h-6 text-purple-400" />
                AI Portfolio Tactical Analyser & Risk Audit
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Institutional cross-brokerage risk synthesis, multi-factor Greeks diagnosis, concentration audit, and ranked playbooks.
              </DialogDescription>
            </div>

            {/* Health Score Meter & Controls */}
            <div className="flex items-center gap-3">
              {activeReport && (
                <div className={cn("flex items-center gap-3 px-4 py-2 rounded-2xl border shrink-0 font-mono transition-all", health.gauge)}>
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block font-sans">
                      Health Score
                    </span>
                    <span className="text-2xl font-black tracking-tight">
                      {activeReport.healthScore}<span className="text-xs opacity-70">/100</span>
                    </span>
                  </div>
                  <div className="border-l border-white/10 pl-3">
                    <Badge variant="outline" className={cn("text-[10px] font-sans font-bold uppercase", health.badge)}>
                      {health.title}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRunAudit}
                  disabled={auditMutation.isPending}
                  className="h-8 text-xs gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-sm"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", auditMutation.isPending && "animate-spin")} />
                  <span>{auditMutation.isPending ? 'Auditing...' : 'Run Audit'}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>

            </div>

          </div>

          {/* Top KPI Banner & Agent Provenance */}
          {activeReport && (
            <div className="space-y-3 mt-4 pt-3 border-t border-border/40">
              {/* Prominent Agent Creator Banner */}
              <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-purple-950/30 border border-purple-500/40 text-xs shadow-sm flex-wrap">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                    <Bot className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Report Created By Agent:</span>
                  </div>
                  <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-mono text-[10px] py-0 px-2 shadow-sm font-bold">
                    AI Portfolio Tactical Analyser
                  </Badge>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">Engine:</span>
                  <span className="text-foreground font-medium">Chief Risk Officer (CRO) Multi-Broker Engine</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">Model:</span>
                  <span className="text-cyan-300 font-mono font-semibold">GPT-4o-mini / Gemini-1.5-Flash</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  Autonomous Run
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="bg-card/50 p-2.5 rounded-xl border border-border/40">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground block">Net Liquidation</span>
                  <strong className={cn("text-base font-black text-foreground mt-0.5 block", isPrivacyMode && "blur-sm")}>
                    {formatCurr(activeReport.totalNetLiq)}
                  </strong>
                </div>

                <div className="bg-card/50 p-2.5 rounded-xl border border-amber-500/30">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-400 block">Total Buying Power</span>
                  <strong className={cn("text-base font-black text-amber-300 mt-0.5 block", isPrivacyMode && "blur-sm")}>
                    {formatCurr(activeReport.totalBuyingPower)}
                  </strong>
                </div>

                <div className="bg-card/50 p-2.5 rounded-xl border border-border/40">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground block">Today's P&L</span>
                  <strong className={cn("text-base font-black mt-0.5 block", activeReport.totalDayPnL >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-sm")}>
                    {activeReport.totalDayPnL >= 0 ? '+' : ''}{formatCurr(activeReport.totalDayPnL)}
                  </strong>
                </div>

                <div className="bg-card/50 p-2.5 rounded-xl border border-border/40">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground block">Open Unrealized P&L</span>
                  <strong className={cn("text-base font-black mt-0.5 block", activeReport.totalUnrealizedPnL >= 0 ? "text-purple-300" : "text-rose-400", isPrivacyMode && "blur-sm")}>
                    {activeReport.totalUnrealizedPnL >= 0 ? '+' : ''}{formatCurr(activeReport.totalUnrealizedPnL)}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* ================= MODAL BODY / TABS ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          
          {auditMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="p-4 bg-purple-500/10 rounded-3xl border border-purple-500/30 shadow-2xl animate-pulse">
                <Sparkles className="w-12 h-12 text-purple-400 animate-spin" />
              </div>
              <div className="text-center space-y-1 max-w-md">
                <h4 className="text-lg font-bold text-foreground">AI Portfolio Risk Agent Auditing Holdings...</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Evaluating {(positions || []).length} active contracts and equities across Interactive Brokers & Tastytrade, computing multi-factor delta exposures, testing margin cushions, and generating tactical defense playbooks.
                </p>
              </div>
            </div>
          ) : activeReport ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
              <TabsList className="bg-muted/40 border border-border/40 p-1 grid grid-cols-2 sm:grid-cols-5 h-auto gap-1">
                <TabsTrigger value="overview" className="text-xs py-2 gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Overview
                </TabsTrigger>
                <TabsTrigger value="playbooks" className="text-xs py-2 gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-purple-400" /> Strategic Playbooks ({activeReport.actionablePlaybooks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="greeks" className="text-xs py-2 gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" /> Greeks & Risk
                </TabsTrigger>
                <TabsTrigger value="allocation" className="text-xs py-2 gap-1.5">
                  <PieChart className="w-3.5 h-3.5 text-emerald-400" /> Allocation & Capital
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs py-2 gap-1.5">
                  <History className="w-3.5 h-3.5 text-amber-400" /> Audit History ({auditHistory.length})
                </TabsTrigger>
              </TabsList>

              {/* ================= TAB 1: OVERVIEW ================= */}
              <TabsContent value="overview" className="m-0 space-y-4">
                {/* Critical Alerts Banner */}
                {activeReport.criticalAlerts && activeReport.criticalAlerts.length > 0 && (
                  <Card className="border-rose-500/40 bg-rose-950/20 shadow-lg">
                    <CardHeader className="pb-2 border-b border-rose-500/30">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        Urgent Critical Threat Alerts ({activeReport.criticalAlerts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5">
                      {activeReport.criticalAlerts.map((alert, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-card/60 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-rose-500 text-white font-mono font-bold text-[10px]">
                                {alert.symbol}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold text-rose-300 border-rose-500/40">
                                {alert.type.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="text-foreground/90 font-medium">{alert.message}</p>
                          </div>
                          <div className="bg-background/80 px-3 py-1.5 rounded-lg border border-border/50 text-[11px] text-amber-300 shrink-0 font-medium">
                            <b>Action:</b> {alert.suggestedAction}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Executive Summary */}
                <Card className="bg-card/40 border-border/60 shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Executive Portfolio Audit Synthesis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3 text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                    {activeReport.executiveSummary}
                  </CardContent>
                </Card>

                {/* Macro & Hedging Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Macro Context */}
                  <Card className="bg-card/40 border-border/60 shadow-sm p-4 space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-primary" /> Macro & Market Regime Assessment
                    </h5>
                    <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                      {activeReport.macroAssessment || 'Macro environment stable within expected volatility bounds.'}
                    </p>
                  </Card>

                  {/* Hedging Suggestions */}
                  <Card className="bg-gradient-to-br from-card/80 to-purple-950/10 border-purple-500/20 shadow-sm p-4 space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Portfolio Hedging & Tail-Risk Overlays
                    </h5>
                    {activeReport.hedgingSuggestions && activeReport.hedgingSuggestions.length > 0 ? (
                      <div className="space-y-2 text-xs">
                        {activeReport.hedgingSuggestions.map((h, i) => (
                          <div key={i} className="p-2 rounded-lg bg-background/60 border border-border/40 space-y-0.5">
                            <div className="flex items-center gap-2 font-mono font-bold">
                              <span className="text-cyan-300">{h.instrument}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-foreground">{h.strategy}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{h.rationale}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Portfolio is currently well-balanced without requiring immediate index put hedges.</p>
                    )}
                  </Card>
                </div>
              </TabsContent>

              {/* ================= TAB 2: STRATEGIC PLAYBOOKS ================= */}
              <TabsContent value="playbooks" className="m-0 space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                      Prioritized Execution Playbooks ({activeReport.actionablePlaybooks?.length || 0})
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Ranked by Risk Reduction & P/L Optimization</span>
                </div>

                <div className="space-y-3">
                  {activeReport.actionablePlaybooks && activeReport.actionablePlaybooks.map((playbook, idx) => (
                    <Card key={idx} className="bg-card/40 border-border/60 hover:border-purple-500/40 transition-all shadow-md">
                      <CardHeader className="pb-3 border-b border-border/40">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-purple-600 text-white font-mono font-bold text-xs px-2 py-0.5">
                              PRIORITY #{playbook.priority || idx + 1}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-xs font-bold text-foreground">
                              {playbook.symbol}
                            </Badge>
                            <CardTitle className="text-sm font-bold text-foreground">
                              {playbook.title}
                            </CardTitle>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyPlaybook(playbook)}
                            className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            {copiedPlaybookId === playbook.priority ? (
                              <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copy Orders</>
                            )}
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs text-foreground/90 leading-relaxed">
                          {playbook.rationale}
                        </p>

                        {playbook.executionSteps && playbook.executionSteps.length > 0 && (
                          <div className="bg-background/80 border border-border/70 rounded-xl p-3 space-y-2 font-mono text-xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-sans">
                              <Layers className="w-3.5 h-3.5 text-primary" /> Execution Legs:
                            </div>
                            <div className="space-y-1 pl-1">
                              {playbook.executionSteps.map((step, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-2 text-foreground font-semibold">
                                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] shrink-0 font-sans">
                                    {sIdx + 1}
                                  </span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/40 text-xs flex items-center justify-between">
                          <span className="text-muted-foreground">Expected Impact:</span>
                          <strong className="text-emerald-400 font-mono">{playbook.expectedImpact}</strong>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* ================= TAB 3: GREEKS & RISK ================= */}
              <TabsContent value="greeks" className="m-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Delta Bias Card */}
                  <Card className="bg-card/40 border-border/60 shadow-sm p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-cyan-400" /> Portfolio Delta Bias
                      </span>
                      <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs font-mono">
                        {activeReport.greeksExposure?.deltaBias?.replace(/_/g, ' ') || 'NEUTRAL DELTA'}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeReport.greeksExposure?.deltaAssessment}
                    </p>
                  </Card>

                  {/* Theta Income Card */}
                  <Card className="bg-card/40 border-border/60 shadow-sm p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-400" /> Theta Cash-Flow Rate
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono">
                        Positive Decay
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeReport.greeksExposure?.thetaIncomePerDay}
                    </p>
                  </Card>

                  {/* Gamma Risk */}
                  <Card className="bg-card/40 border-border/60 shadow-sm p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-400" /> Gamma Acceleration Risk
                      </span>
                      <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300">
                        Expiration Threat
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeReport.greeksExposure?.gammaRisk}
                    </p>
                  </Card>

                  {/* Assignment Risk */}
                  <Card className="bg-card/40 border-border/60 shadow-sm p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-400" /> Assignment Vulnerability
                      </span>
                      <Badge variant="outline" className="text-xs border-rose-500/40 text-rose-300">
                        Short Options
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeReport.greeksExposure?.assignmentRisk}
                    </p>
                  </Card>
                </div>
              </TabsContent>

              {/* ================= TAB 4: ALLOCATION & CAPITAL ================= */}
              <TabsContent value="allocation" className="m-0 space-y-4">
                <Card className="bg-card/40 border-border/60 shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
                      <PieChart className="w-4 h-4 text-emerald-400" />
                      Asset Allocation, Cash Drag & Concentration Diagnostic
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4 text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                    {activeReport.allocationAnalysis}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ================= TAB 5: AUDIT HISTORY ================= */}
              <TabsContent value="history" className="m-0 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                      Stored Portfolio Audits ({auditHistory.length})
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Persisted in SQLite Database</span>
                </div>

                {auditHistory.length === 0 ? (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    No past audits found. Click "Run Audit" to generate and store your first report.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {auditHistory.map((item) => {
                      const h = getHealthBadge(item.healthScore, item.riskLevel);
                      const isCurrent = activeReport.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setActiveReport(item)}
                          className={cn(
                            "p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs",
                            isCurrent
                              ? "bg-purple-950/20 border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                              : "bg-card/50 border-border/50 hover:border-border hover:bg-card/70"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm font-mono">
                                Health Score: {item.healthScore}/100
                              </span>
                              <Badge variant="outline" className={cn("text-[10px] font-bold", h.badge)}>
                                {item.riskLevel.replace(/_/g, ' ')}
                              </Badge>
                              {isCurrent && (
                                <Badge className="bg-purple-500 text-white text-[9px] font-bold">CURRENTLY VIEWING</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-purple-950/60 text-purple-300 border border-purple-500/30 text-[9px] font-mono flex items-center gap-1">
                                <Bot className="w-2.5 h-2.5" />
                                AI Portfolio Tactical Analyser
                              </Badge>
                              <span className="text-muted-foreground font-mono text-[11px]">
                                Net Liq: {formatCurr(item.totalNetLiq)} • Buying Power: {formatCurr(item.totalBuyingPower)} • {item.positionsCount} Positions
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                            </span>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDeleteAudit(item.id!, e)}
                              className="h-7 w-7 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                              title="Delete Report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-16 space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <h4 className="text-base font-bold text-foreground">No Audit Report Available</h4>
              <p className="text-xs text-muted-foreground">Click "Run Audit" to start the autonomous portfolio analysis.</p>
              <Button onClick={handleRunAudit} className="bg-primary text-white text-xs">
                Run Live Portfolio Audit
              </Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
