import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Zap,
  RefreshCw,
  Loader2,
  ExternalLink,
  DollarSign,
  Percent,
  Compass,
  Layers,
  FileText,
  Copy,
  Check,
  BarChart3,
  Scale,
  Crosshair,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Info,
  Database,
  History,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDiagnoseDip,
  useDipReportHistory,
  useDeleteSavedDipReport,
  DipDiagnosticResult,
  DipDriverClassification,
  DipOpportunityVerdict,
  SavedDipReportRecord,
} from '@/services/dipRadarService';
import { toast } from 'sonner';

interface DipDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  onNavigateToResearch?: (symbol: string) => void;
  onOpenTradeIdea?: (symbol: string, initialThesis?: string) => void;
}

export function DipDiagnosticModal({
  isOpen,
  onClose,
  symbol,
  onNavigateToResearch,
  onOpenTradeIdea,
}: DipDiagnosticModalProps) {
  const [forceRefresh, setForceRefresh] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewingHistoryReport, setViewingHistoryReport] = useState<DipDiagnosticResult | null>(null);

  const {
    data: liveDiagnostic,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useDiagnoseDip(symbol, isOpen, forceRefresh);

  // History of past saved reports for this symbol
  const { data: historyRecords = [], refetch: refetchHistory } = useDipReportHistory(symbol, isOpen);
  const deleteReportMutation = useDeleteSavedDipReport();

  // Active diagnostic data being viewed (either current latest or selected historical snapshot)
  const diagnostic = viewingHistoryReport || liveDiagnostic;

  const handleForceRefresh = () => {
    setViewingHistoryReport(null);
    setForceRefresh(true);
    refetch().finally(() => {
      setForceRefresh(false);
      refetchHistory();
    });
  };

  const handleSelectHistoryReport = (record: SavedDipReportRecord) => {
    try {
      const parsed: DipDiagnosticResult = JSON.parse(record.contentJson);
      parsed.isSavedReport = true;
      parsed.savedReportId = record.id;
      parsed.savedAt = record.createdAt;
      parsed.analyzedAt = record.createdAt;
      setViewingHistoryReport(parsed);
      setActiveTab('overview');
      toast.info(`Viewing historical diagnostic from ${new Date(record.createdAt).toLocaleString()}`);
    } catch (e) {
      toast.error('Failed to parse historical report snapshot.');
    }
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteReportMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Historical diagnostic report deleted.');
        if (viewingHistoryReport?.savedReportId === id) {
          setViewingHistoryReport(null);
        }
      },
    });
  };

  const handleCopyActionPlan = () => {
    if (!diagnostic) return;
    const planText = `[AI DIP DIAGNOSTIC: ${diagnostic.symbol}]
Verdict: ${diagnostic.verdict} | Opportunity Score: ${diagnostic.opportunityScore}/100
Classification: ${diagnostic.classification} (Volatility: ${diagnostic.volatilityFactorPercent}% | Fundamental: ${diagnostic.fundamentalFactorPercent}%)
Summary: ${diagnostic.primaryDriverSummary}

TACTICAL ENTRY PLAYBOOK:
- Target Entry Zone: ${diagnostic.tacticalActionPlan.recommendedEntryZone}
- DCA Pacing: ${diagnostic.tacticalActionPlan.dcaStrategy}
- Options Play: ${diagnostic.tacticalActionPlan.optionsStrategy}
- Invalidation / Stop: ${diagnostic.tacticalActionPlan.stopLossOrInvalidation}
- Horizon: ${diagnostic.tacticalActionPlan.timeHorizon}`;

    navigator.clipboard.writeText(planText);
    setIsCopied(true);
    toast.success('Tactical action plan copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Format currency helper
  const fmtCurr = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '—';
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getVerdictBadge = (verdict?: DipOpportunityVerdict) => {
    switch (verdict) {
      case 'STRONG_BUY_DIP':
        return {
          label: 'Strong Buy on Dip',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/10 shadow-lg',
          icon: <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />,
          desc: 'High conviction buying opportunity. Valuation disconnected from solid fundamentals.',
        };
      case 'ACCUMULATE_PULLBACK':
        return {
          label: 'Accumulate Pullback',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-cyan-500/10 shadow-lg',
          icon: <TrendingUp className="w-4 h-4 text-cyan-400" />,
          desc: 'Favorable risk/reward. Recommend initiating initial accumulation tranches.',
        };
      case 'HOLD_WAIT_FOR_BASE':
        return {
          label: 'Hold / Wait for Base',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <Activity className="w-4 h-4 text-amber-400" />,
          desc: 'Neutral/Mixed setup. Allow volatility to contract and support to solidify.',
        };
      case 'AVOID_FALLING_KNIFE':
        return {
          label: 'Avoid — Broken Thesis',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/10 shadow-lg',
          icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
          desc: 'Fundamental impairment or guidance cut detected. High risk of further downside.',
        };
      case 'TRIM_DEFENSIVE':
        return {
          label: 'Trim / Defensive Exit',
          badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
          icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
          desc: 'Elevated risk profile. Consider hedging or reducing position exposure.',
        };
      default:
        return {
          label: 'Analyzing...',
          badge: 'bg-muted text-muted-foreground border-border',
          icon: <Sparkles className="w-4 h-4 text-primary" />,
          desc: 'Evaluating fundamental vs volatility drivers.',
        };
    }
  };

  const getClassificationBadge = (cls?: DipDriverClassification) => {
    switch (cls) {
      case 'VOLATILITY_DRIVEN':
        return {
          label: 'Market Volatility / Beta Dip',
          className: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          icon: <Zap className="w-3.5 h-3.5 text-indigo-400" />,
        };
      case 'OVERREACTION_OPPORTUNITY':
        return {
          label: 'Headline Overreaction',
          className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: <Flame className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case 'MACRO_SECTOR_ROTATION':
        return {
          label: 'Macro / Sector Rotation',
          className: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          icon: <Compass className="w-3.5 h-3.5 text-purple-400" />,
        };
      case 'FUNDAMENTAL_IMPAIRMENT':
        return {
          label: 'Fundamental Deterioration',
          className: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
        };
      default:
        return {
          label: 'Classification Pending',
          className: 'bg-muted text-muted-foreground border-border',
          icon: <Activity className="w-3.5 h-3.5" />,
        };
    }
  };

  const verdictMeta = getVerdictBadge(diagnostic?.verdict);
  const classMeta = getClassificationBadge(diagnostic?.classification);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border/80 p-0 shadow-2xl">
        {/* ================= MODAL HEADER ================= */}
        <div className="p-6 border-b border-border/60 bg-gradient-to-br from-card via-card/90 to-primary/5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-sm font-black text-sm">
                  {symbol.slice(0, 4)}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <DialogTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                      <span>{diagnostic?.companyName || symbol}</span>
                      <span className="text-base font-mono text-muted-foreground">({symbol})</span>
                    </DialogTitle>
                    <Badge variant="outline" className={cn('text-xs font-semibold gap-1.5 py-0.5 px-2.5', classMeta.className)}>
                      {classMeta.icon}
                      {classMeta.label}
                    </Badge>

                    {/* Saved Database Report Badge */}
                    {diagnostic?.isSavedReport && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        <span>Saved in Database</span>
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Drawdown Diagnostic</span>
                    <span>•</span>
                    {diagnostic?.analyzedAt && (
                      <span className="font-mono text-muted-foreground">
                        Analyzed {new Date(diagnostic.analyzedAt).toLocaleString()}
                      </span>
                    )}
                    {viewingHistoryReport && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-300">
                        Viewing Historical Snapshot
                      </Badge>
                    )}
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Quick Price Badge & Actions */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              {diagnostic && (
                <div className="text-right">
                  <div className="text-xl font-bold font-mono text-foreground">
                    ${diagnostic.currentPrice.toFixed(2)}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-xs font-mono font-medium">
                    <span className={cn(diagnostic.dayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                      {diagnostic.dayChangePercent >= 0 ? '+' : ''}{diagnostic.dayChangePercent.toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-amber-400/90">
                      {diagnostic.distanceFrom52WHigh.toFixed(1)}% from 52W High
                    </span>
                  </div>
                </div>
              )}

              {/* Re-Analyze with AI (Force Fresh) */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceRefresh}
                disabled={isLoading || isFetching}
                className="h-8 text-xs gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/20 text-primary font-semibold"
                title="Trigger a fresh autonomous AI analysis and save new report"
              >
                <Sparkles className={cn('w-3.5 h-3.5 text-amber-300', (isLoading || isFetching) && 'animate-spin')} />
                <span className="hidden sm:inline">Re-Analyze with AI</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ================= LOADING STATE ================= */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary animate-pulse">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Analyzing {symbol} Drawdown Drivers...
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                Gathering live news headlines, valuation multiples, balance sheet liquidity, and benchmark index beta to determine fundamental vs volatility factors.
              </p>
            </div>
          </div>
        ) : isError || !diagnostic ? (
          <div className="p-12 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <h3 className="text-lg font-bold text-foreground">Diagnostic Failed</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {error instanceof Error ? error.message : 'Unable to complete AI drawdown diagnostic.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* ================= 1. VERDICT & DUAL GAUGES HERO ================= */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Verdict Card */}
              <div className={cn('rounded-2xl border p-5 flex flex-col justify-between', verdictMeta.badge)}>
                <div className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider font-bold opacity-80 flex items-center gap-1.5">
                    {verdictMeta.icon}
                    AI Opportunity Verdict
                  </div>
                  <div className="text-2xl font-black tracking-tight">
                    {verdictMeta.label}
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed pt-1">
                    {verdictMeta.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-current/20 flex items-center justify-between text-xs font-mono">
                  <span>Horizon:</span>
                  <span className="font-bold">{diagnostic.tacticalActionPlan.timeHorizon?.replace(/_/g, ' ') || 'SWING 1-3M'}</span>
                </div>
              </div>

              {/* Opportunity Score Gauge */}
              <div className="rounded-2xl border border-border/80 bg-card/60 p-5 flex flex-col justify-between shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Opportunity Score
                    </span>
                    <span className={cn(
                      'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                      diagnostic.opportunityScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                      diagnostic.opportunityScore >= 60 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    )}>
                      {diagnostic.opportunityScore >= 80 ? 'HIGH CONVICTION' : diagnostic.opportunityScore >= 60 ? 'FAVORABLE' : 'MODERATE'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 pt-2">
                    <span className="text-3xl font-black font-mono text-foreground">
                      {diagnostic.opportunityScore}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">/ 100</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 mt-3">
                  <div className="w-full h-2 rounded-full bg-secondary/50 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        diagnostic.opportunityScore >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                        diagnostic.opportunityScore >= 60 ? 'bg-gradient-to-r from-cyan-500 to-blue-400' :
                        'bg-gradient-to-r from-amber-500 to-orange-400'
                      )}
                      style={{ width: `${diagnostic.opportunityScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>Weak (0)</span>
                    <span>Generational Buy (100)</span>
                  </div>
                </div>
              </div>

              {/* Fundamental Health Score Gauge */}
              <div className="rounded-2xl border border-border/80 bg-card/60 p-5 flex flex-col justify-between shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Fundamental Health
                    </span>
                    <span className={cn(
                      'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                      diagnostic.fundamentalHealthScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                      diagnostic.fundamentalHealthScore >= 60 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    )}>
                      {diagnostic.fundamentalAnalysis.balanceSheetStrength}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 pt-2">
                    <span className="text-3xl font-black font-mono text-foreground">
                      {diagnostic.fundamentalHealthScore}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">/ 100</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 mt-3">
                  <div className="w-full h-2 rounded-full bg-secondary/50 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        diagnostic.fundamentalHealthScore >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                        diagnostic.fundamentalHealthScore >= 60 ? 'bg-gradient-to-r from-cyan-500 to-indigo-400' :
                        'bg-gradient-to-r from-rose-500 to-rose-400'
                      )}
                      style={{ width: `${diagnostic.fundamentalHealthScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>Vulnerable (0)</span>
                    <span>Pristine (100)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= 2. ATTRIBUTION BREAKDOWN BAR ================= */}
            <div className="rounded-2xl border border-border/70 bg-card/40 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Driver Attribution Breakdown:
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Why is {symbol} down?
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    Market/Beta Volatility: {diagnostic.volatilityFactorPercent}%
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Fundamental Risk: {diagnostic.fundamentalFactorPercent}%
                  </span>
                </div>
              </div>

              {/* Two-Tone Stacked Progress Bar */}
              <div className="w-full h-3 rounded-full bg-secondary/50 overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 transition-all duration-500"
                  style={{ width: `${diagnostic.volatilityFactorPercent}%` }}
                  title={`Volatility / Beta Factor: ${diagnostic.volatilityFactorPercent}%`}
                />
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                  style={{ width: `${diagnostic.fundamentalFactorPercent}%` }}
                  title={`Fundamental Factor: ${diagnostic.fundamentalFactorPercent}%`}
                />
              </div>

              {/* Primary Conclusion Quote */}
              <div className="bg-muted/40 rounded-xl p-3 border border-border/50 text-xs text-foreground/90 font-medium leading-relaxed">
                💡 <span className="font-bold text-foreground">Core Diagnostic:</span> {diagnostic.primaryDriverSummary}
              </div>
            </div>

            {/* ================= 3. USER POSITION CONTEXT (IF HELD) ================= */}
            {diagnostic.portfolioContext?.isCurrentlyHeld && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 text-[10px] font-bold">
                      Active Portfolio Holding
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">
                      You currently hold {diagnostic.portfolioContext.quantity} units @ ${diagnostic.portfolioContext.averageCost?.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Action Guide: {diagnostic.portfolioContext.suggestedPortfolioAction}
                  </p>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div className="font-mono text-xs">
                    <div className="text-muted-foreground text-[10px]">Unrealized Return</div>
                    <div className={cn(
                      'font-bold',
                      (diagnostic.portfolioContext.unrealizedPLPercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}>
                      {(diagnostic.portfolioContext.unrealizedPLPercent || 0) >= 0 ? '+' : ''}
                      {diagnostic.portfolioContext.unrealizedPLPercent?.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= 4. DETAILED ANALYSIS TABS ================= */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-5 bg-muted/60 p-1 rounded-xl h-10">
                <TabsTrigger value="overview" className="text-xs font-semibold gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Diagnostic</span> Overview
                </TabsTrigger>
                <TabsTrigger value="tactical" className="text-xs font-semibold gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tactical</span> Entry Plan
                </TabsTrigger>
                <TabsTrigger value="valuation" className="text-xs font-semibold gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Valuation <span className="hidden sm:inline">& Stats</span>
                </TabsTrigger>
                <TabsTrigger value="catalysts" className="text-xs font-semibold gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  Risks <span className="hidden sm:inline">& Catalysts</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs font-semibold gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  History ({historyRecords.length})
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: OVERVIEW & NEWS */}
              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Executive Institutional Assessment
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-2 whitespace-pre-line">
                      {diagnostic.executiveDiagnosis}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                        <Zap className="w-4 h-4 text-indigo-400" />
                        Volatility & Technical Market Beta
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {diagnostic.volatilityAnalysis.details}
                      </p>
                    </div>

                    <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        Fundamental Durability & Health
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {diagnostic.fundamentalAnalysis.details}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent News Articles */}
                {diagnostic.recentNewsHeadlines && diagnostic.recentNewsHeadlines.length > 0 && (
                  <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-3">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Recent News & Market Headlines
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {diagnostic.recentNewsHeadlines.map((news, idx) => (
                        <a
                          key={idx}
                          href={news.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group p-3 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 hover:border-primary/40 transition-all flex justify-between items-start gap-2"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                              {news.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                              <span>{news.publisher}</span>
                              {news.publishTime && (
                                <span>• {new Date(news.publishTime).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 opacity-60" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: TACTICAL ENTRY PLAN */}
              <TabsContent value="tactical" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Buy Target Zone */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-2">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Crosshair className="w-4 h-4" />
                      Target Buy / Accumulation Zone
                    </div>
                    <div className="text-2xl font-black font-mono text-foreground">
                      {diagnostic.tacticalActionPlan.recommendedEntryZone}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Statistically optimal entry range balancing support confluence and margin of safety.
                    </p>
                  </div>

                  {/* Stop Loss / Invalidation */}
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-950/10 p-5 space-y-2">
                    <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      Hard Stop-Loss / Thesis Invalidation
                    </div>
                    <div className="text-2xl font-black font-mono text-foreground">
                      {diagnostic.tacticalActionPlan.stopLossOrInvalidation}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Sustained close below this level indicates thesis breach or deeper structural breakdown.
                    </p>
                  </div>
                </div>

                {/* DCA Tranches & Options Playbook */}
                <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      Dollar-Cost Averaging (DCA) Pacing Schedule
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 bg-muted/30 p-3 rounded-xl border border-border/50">
                      {diagnostic.tacticalActionPlan.dcaStrategy}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                      <Zap className="w-4 h-4 text-purple-400" />
                      Recommended Derivatives & Options Playbook
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 bg-muted/30 p-3 rounded-xl border border-border/50">
                      {diagnostic.tacticalActionPlan.optionsStrategy}
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: VALUATION & FINANCIALS */}
              <TabsContent value="valuation" className="space-y-4 pt-4">
                <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">
                      Valuation Multiples & Financial Durability
                    </h4>
                    <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                      Live Telemetry
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <div className="text-[10px] text-muted-foreground">Trailing P/E</div>
                      <div className="text-base font-bold font-mono text-foreground mt-0.5">
                        {diagnostic.valuationMetrics.trailingPE ? `${diagnostic.valuationMetrics.trailingPE.toFixed(1)}x` : 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <div className="text-[10px] text-muted-foreground">Forward P/E</div>
                      <div className="text-base font-bold font-mono text-foreground mt-0.5">
                        {diagnostic.valuationMetrics.forwardPE ? `${diagnostic.valuationMetrics.forwardPE.toFixed(1)}x` : 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <div className="text-[10px] text-muted-foreground">Price to Sales</div>
                      <div className="text-base font-bold font-mono text-foreground mt-0.5">
                        {diagnostic.valuationMetrics.priceToSales ? `${diagnostic.valuationMetrics.priceToSales.toFixed(1)}x` : 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <div className="text-[10px] text-muted-foreground">Free Cash Flow</div>
                      <div className="text-base font-bold font-mono text-foreground mt-0.5">
                        {fmtCurr(diagnostic.valuationMetrics.freeCashflow)}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <div className="text-[10px] text-muted-foreground">Operating Margin</div>
                      <div className="text-base font-bold font-mono text-foreground mt-0.5">
                        {diagnostic.valuationMetrics.operatingMarginPercent ? `${diagnostic.valuationMetrics.operatingMarginPercent.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <div className="text-[10px] text-muted-foreground">Debt to Equity</div>
                      <div className="text-base font-bold font-mono text-foreground mt-0.5">
                        {diagnostic.valuationMetrics.debtToEquity !== null ? diagnostic.valuationMetrics.debtToEquity.toFixed(2) : 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <div className="text-[10px] text-muted-foreground">Beta (Market Sens.)</div>
                      <div className="text-base font-bold font-mono text-foreground mt-0.5">
                        {diagnostic.valuationMetrics.beta !== null ? diagnostic.valuationMetrics.beta.toFixed(2) : '1.0'}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <div className="text-[10px] text-muted-foreground">Short % of Float</div>
                      <div className="text-base font-bold font-mono text-foreground mt-0.5">
                        {diagnostic.valuationMetrics.shortPercentOfFloat !== null ? `${diagnostic.valuationMetrics.shortPercentOfFloat.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Valuation Commentary */}
                  <div className="bg-muted/30 p-3.5 rounded-xl border border-border/50 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground">Valuation Verdict: </span>
                    {diagnostic.valuationAssessment.summary} • {diagnostic.valuationAssessment.currentDiscountVs52WHigh}.
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: RISKS VS CATALYSTS */}
              <TabsContent value="catalysts" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Upside Catalysts */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-card/60 p-5 space-y-3">
                    <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4" />
                      Key Upside Catalysts
                    </h4>
                    <ul className="space-y-2">
                      {diagnostic.upsideCatalysts.map((cat, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{cat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risk Factors */}
                  <div className="rounded-2xl border border-rose-500/30 bg-card/60 p-5 space-y-3">
                    <h4 className="text-xs font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4" />
                      Downside Risk Factors
                    </h4>
                    <ul className="space-y-2">
                      {diagnostic.keyRiskFactors.map((risk, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-rose-400 font-bold">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 5: SAVED REPORTS HISTORY */}
              <TabsContent value="history" className="space-y-4 pt-4">
                <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-400" />
                        Saved Diagnostic Reports in Database
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Permanent records saved for {symbol}. Click any snapshot to review past diagnostic telemetry without calling the AI agent.
                      </p>
                    </div>

                    {viewingHistoryReport && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingHistoryReport(null)}
                        className="h-8 text-xs text-primary border-primary/40 hover:bg-primary/10"
                      >
                        Reset to Latest
                      </Button>
                    )}
                  </div>

                  {historyRecords.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No past reports saved for {symbol} yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {historyRecords.map((rec) => {
                        const isCurrentActive = (viewingHistoryReport?.savedReportId === rec.id) || (!viewingHistoryReport && liveDiagnostic?.savedReportId === rec.id);
                        return (
                          <div
                            key={rec.id}
                            onClick={() => handleSelectHistoryReport(rec)}
                            className={cn(
                              'p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3',
                              isCurrentActive
                                ? 'bg-primary/10 border-primary/50 shadow-sm'
                                : 'bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-border'
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn(
                                  'text-[10px] font-bold',
                                  rec.verdict === 'STRONG_BUY_DIP' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                  rec.verdict === 'ACCUMULATE_PULLBACK' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
                                  'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                )}>
                                  {rec.verdict.replace(/_/g, ' ')}
                                </Badge>
                                <span className="text-xs font-bold text-foreground">
                                  Score: {rec.opportunityScore}/100
                                </span>
                                {isCurrentActive && (
                                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-semibold">
                                    Currently Viewing
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {rec.primaryDriverSummary}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <div className="text-right font-mono text-[11px] text-muted-foreground">
                                <div>{new Date(rec.createdAt).toLocaleDateString()}</div>
                                <div className="text-[10px]">{new Date(rec.createdAt).toLocaleTimeString()}</div>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteHistoryItem(rec.id, e)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                                title="Delete this saved report"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* ================= MODAL FOOTER ================= */}
        <div className="p-5 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Dip Opportunity Telemetry • Saved in Database</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyActionPlan}
              disabled={!diagnostic}
              className="h-9 text-xs gap-1.5 border-border/70 hover:bg-accent/40"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy Plan'}</span>
            </Button>

            {onNavigateToResearch && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onNavigateToResearch(symbol);
                }}
                className="h-9 text-xs gap-1.5 border-border/70 hover:bg-accent/40 text-primary hover:text-primary"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Research</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
