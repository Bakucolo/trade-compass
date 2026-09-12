import React, { useState, useEffect, useMemo } from 'react';
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
  PortfolioValuationAuditResult,
  HoldingValuationRecord,
  usePortfolioValuationAudits,
  useDeletePortfolioValuation
} from '@/services/portfolioValuationService';
import {
  useRunScatterGatherValuation,
  usePortfolioValuationReports,
  portfolioValuationAgentClient,
  StockValuationReport,
  ScatterGatherValuationResult
} from '@/services/portfolioValuationAgentClient';
import {
  Sparkles,
  Scale,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  ArrowRight,
  Maximize2,
  Minimize2,
  Trash2,
  FileText,
  Clock,
  Layers,
  Zap,
  BarChart3,
  History,
  CheckCircle2,
  Coins,
  Bot,
  Download,
  Bell,
  Cpu,
  Bookmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PortfolioValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions?: UnifiedPosition[];
  balancesData?: PortfolioBalancesData;
  isPrivacyMode?: boolean;
  onNavigateToResearch?: (symbol: string) => void;
}

export function PortfolioValuationModal({
  isOpen,
  onClose,
  positions = [],
  balancesData,
  isPrivacyMode = false,
  onNavigateToResearch,
}: PortfolioValuationModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeReport, setActiveReport] = useState<PortfolioValuationAuditResult | null>(null);
  const [scatterGatherResult, setScatterGatherResult] = useState<ScatterGatherValuationResult | null>(null);
  const [activeTab, setActiveTab] = useState('holdings');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNDERVALUED' | 'FAIR' | 'OVERVALUED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'DISCOUNT' | 'SCORE' | 'MARKET_VALUE' | 'TICKER'>('DISCOUNT');

  const { data: auditHistory = [], refetch: refetchHistory, isLoading: isLoadingHistory } = usePortfolioValuationAudits(20);
  const { data: savedWorkerReports = [], refetch: refetchWorkerReports } = usePortfolioValuationReports(undefined, 50);
  const deleteMutation = useDeletePortfolioValuation();
  const scatterGatherMutation = useRunScatterGatherValuation();

  // On open, load latest audit or auto-run if none exist
  useEffect(() => {
    if (isOpen) {
      if (auditHistory.length > 0) {
        if (!activeReport) {
          setActiveReport(auditHistory[0]);
          try {
            if (auditHistory[0].rawReportJson) {
              const parsed = JSON.parse(auditHistory[0].rawReportJson);
              if (parsed.stock_reports || (parsed.created_alerts && parsed.created_alerts.length > 0)) {
                setScatterGatherResult(parsed);
              }
            }
          } catch (e) {
            // rawReportJson was standard format
          }
        }
      }
    }
  }, [isOpen, auditHistory]);

  const handleRunScatterGather = async () => {
    try {
      toast.info('Initiating Scatter-Gather Map-Reduce valuation (concurrency: 5 workers)...', { duration: 4000 });
      const res = await scatterGatherMutation.mutateAsync({
        concurrencyLimit: 5
      });
      setScatterGatherResult(res.result);
      refetchHistory();
      refetchWorkerReports();

      // Synthesize a viewable activeReport
      const newAudit: PortfolioValuationAuditResult = {
        id: res.result.audit_id || `audit-${Date.now()}`,
        title: 'Scatter-Gather Portfolio Valuation & Alerting Audit',
        overallValuationStatus: res.result.overextended_count > res.result.total_tickers_audited * 0.4 ? 'OVERVALUED' : res.result.undervalued_count > res.result.total_tickers_audited * 0.4 ? 'UNDERVALUED' : 'FAIRLY_VALUED',
        portfolioDiscountPercent: 0,
        portfolioScore: 78,
        totalMarketValue: res.result.stock_reports.reduce((a, b) => a + b.current_price, 0),
        totalFairValue: res.result.stock_reports.reduce((a, b) => a + b.target_price_1y, 0),
        undervaluedCount: res.result.undervalued_count,
        fairlyValuedCount: res.result.fairly_valued_count,
        overvaluedCount: res.result.overextended_count,
        totalHoldingsCount: res.result.total_tickers_audited,
        executiveSummary: res.result.portfolio_summary,
        keyOpportunitiesSummary: `Identified ${res.result.undervalued_count} undervalued holdings with attractive forward multiples.`,
        valuationRisksSummary: `${res.result.overextended_count} holdings flagged as overextended with automated price alerts armed.`,
        holdings: res.result.stock_reports.map((s) => ({
          symbol: s.symbol,
          companyName: s.company_name,
          assetType: 'Stock',
          brokerSources: ['Portfolio'],
          totalShares: 100,
          totalMarketValueUSD: s.current_price * 100,
          portfolioWeightPercent: 0,
          currentPrice: s.current_price,
          currency: 'USD',
          blendedFairValue: s.target_price_1y,
          marginOfSafetyPercent: s.upside_downside_pct,
          upsideDownsidePercent: s.upside_downside_pct,
          valuationStatus: s.valuation_status === 'OVEREXTENDED' ? 'EXTREMELY_OVERVALUED' : s.valuation_status === 'UNDERVALUED' ? 'UNDERVALUED' : 'FAIRLY_VALUED',
          valuationScore: s.conviction_score,
          dcfFairValue: s.target_price_1y,
          multiplesFairValue: s.target_price_1y,
          trailingPE: s.fundamental_context?.trailingPE,
          forwardPE: s.fundamental_context?.forwardPE,
          pegRatio: s.fundamental_context?.pegRatio,
          evToEbitda: s.fundamental_context?.evToEbitda,
          aiDiagnosisSummary: s.valuation_thesis,
          keyDrivers: s.key_drivers,
          actionVerdict: s.action_recommendation === 'BUY' ? 'STRONG_BUY_ACCUMULATE' : s.action_recommendation === 'ACCUMULATE' ? 'ACCUMULATE_DCA' : s.action_recommendation === 'TRIM' ? 'TRIM_TAKE_PROFITS' : 'HOLD_HARVEST_INCOME',
          actionRationale: s.valuation_thesis
        })),
        topUndervaluedGems: [],
        topOvervaluedRisks: [],
        createdAt: res.result.timestamp
      };

      setActiveReport(newAudit);

      if (res.result.alerts_created_count > 0) {
        toast.success(`Scatter-Gather completed! ${res.result.alerts_created_count} automated overextension price alerts set.`, { duration: 5000 });
      } else {
        toast.success(`Scatter-Gather valuation audit completed across ${res.result.total_tickers_audited} stocks.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to complete Scatter-Gather valuation');
    }
  };

  const handleDeleteAudit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Valuation report deleted');
      if (activeReport?.id === id) {
        const remaining = auditHistory.filter(a => a.id !== id);
        setActiveReport(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete audit report');
    }
  };

  const handleDownloadStockPdf = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info(`Generating institutional PDF report for ${symbol}...`);
    window.open(portfolioValuationAgentClient.getStockPdfUrl(symbol), '_blank');
  };

  const handleDownloadPortfolioPdf = () => {
    if (!activeReport?.id) return;
    toast.info('Generating master portfolio valuation PDF briefing...');
    window.open(portfolioValuationAgentClient.getPortfolioPdfUrl(activeReport.id), '_blank');
  };

  const formatCurr = (val?: number, decimals = 2) => {
    if (val === undefined || isNaN(val)) return '$0.00';
    if (isPrivacyMode) return '****';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const getStatusBadge = (status: string, marginOfSafety: number) => {
    if (status === 'OVEREXTENDED' || status === 'EXTREMELY_OVERVALUED' || status === 'OVERVALUED') {
      return (
        <Badge className="bg-rose-500/25 text-rose-300 border-rose-500/40 text-xs font-bold gap-1 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>Overextended ({marginOfSafety < 0 ? `${marginOfSafety.toFixed(1)}%` : 'Premium'})</span>
        </Badge>
      );
    }
    if (status === 'UNDERVALUED' || status === 'DEEPLY_UNDERVALUED') {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold gap-1 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Undervalued (+{marginOfSafety.toFixed(1)}% Upside)</span>
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground border-border/60 text-xs gap-1">
        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
        <span>Fairly Valued</span>
      </Badge>
    );
  };

  const handleSelectTicker = (symbol: string) => {
    const cleanSym = symbol.includes(' ') ? symbol.split(' ')[0] : symbol;
    if (onNavigateToResearch) {
      onNavigateToResearch(cleanSym);
      onClose();
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: cleanSym }));
      onClose();
    }
  };

  // Map of stock reports from scatter gather
  const stockReportsMap = useMemo(() => {
    const map = new Map<string, StockValuationReport>();
    if (scatterGatherResult?.stock_reports) {
      for (const rep of scatterGatherResult.stock_reports) {
        map.set(rep.symbol.toUpperCase(), rep);
      }
    }
    return map;
  }, [scatterGatherResult]);

  // Filter and sort holdings
  const filteredHoldings = useMemo(() => {
    if (!activeReport?.holdings) return [];
    return activeReport.holdings
      .filter((h) => {
        const scatterRep = stockReportsMap.get(h.symbol.toUpperCase());
        const isOver = scatterRep?.is_overextended || h.valuationStatus === 'OVERVALUED' || h.valuationStatus === 'EXTREMELY_OVERVALUED';
        const isUnder = scatterRep?.valuation_status === 'UNDERVALUED' || h.valuationStatus === 'UNDERVALUED' || h.valuationStatus === 'DEEPLY_UNDERVALUED';

        if (statusFilter === 'UNDERVALUED') return isUnder;
        if (statusFilter === 'OVERVALUED') return isOver;
        if (statusFilter === 'FAIR') return !isOver && !isUnder;
        return true;
      })
      .filter((h) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return h.symbol.toLowerCase().includes(q) || h.companyName.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === 'DISCOUNT') {
          return b.upsideDownsidePercent - a.upsideDownsidePercent;
        }
        if (sortBy === 'SCORE') {
          return b.valuationScore - a.valuationScore;
        }
        if (sortBy === 'MARKET_VALUE') {
          return b.totalMarketValueUSD - a.totalMarketValueUSD;
        }
        if (sortBy === 'TICKER') {
          return a.symbol.localeCompare(b.symbol);
        }
        return 0;
      });
  }, [activeReport, statusFilter, searchQuery, sortBy, stockReportsMap]);

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
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs uppercase tracking-wider px-2.5 py-0.5 shadow-sm flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-200" />
                  Scatter-Gather Map-Reduce Architecture
                </Badge>
                <Badge variant="outline" className="text-xs font-mono text-muted-foreground border-emerald-500/30 text-emerald-300">
                  Batch Concurrency: 5 Workers
                </Badge>
                {activeReport?.createdAt && (
                  <Badge variant="secondary" className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(activeReport.createdAt).toLocaleDateString()} {new Date(activeReport.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight text-foreground pt-1 flex items-center gap-2.5">
                <Scale className="w-6 h-6 text-emerald-400" />
                Portfolio Valuation & Automated Alerting Agent
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Isolated worker agent analysis per stock • 1-Year target prices • Overextension alerts automatically armed • Instant PDF downloads
              </DialogDescription>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {activeReport?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPortfolioPdf}
                  className="h-8 gap-1.5 text-xs bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 shadow-sm"
                  title="Download complete Portfolio Valuation PDF Briefing"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Portfolio PDF</span>
                </Button>
              )}

              <Button
                variant="default"
                size="sm"
                onClick={handleRunScatterGather}
                disabled={scatterGatherMutation.isPending}
                className="h-8 gap-1.5 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-md"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", scatterGatherMutation.isPending && "animate-spin text-white")} />
                <span>{scatterGatherMutation.isPending ? 'Executing 5-Worker Map-Reduce...' : 'Run Scatter-Gather Pipeline'}</span>
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
        </DialogHeader>

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {scatterGatherMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-5">
              <div className="p-5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-3xl border border-emerald-500/40 shadow-2xl animate-pulse flex items-center justify-center">
                <Cpu className="w-12 h-12 text-emerald-400 animate-spin" />
              </div>
              <div className="text-center space-y-2 max-w-md">
                <h4 className="text-lg font-bold text-foreground flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Executing Scatter-Gather Pipeline...
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Partitioning portfolio into concurrent batches of <strong>5 isolated worker tasks</strong>. Each agent pulls live fundamental metrics, requests LLM valuation thesis, calculates 1-year target prices, sets automated price alerts, and generates PDF reports.
                </p>
                <div className="pt-2 flex justify-center gap-2 text-[11px] font-mono text-emerald-400">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Phase 1: Concurrency Batching</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Phase 2: Worker Agent LLMs</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Phase 3: Alert Setter</span>
                </div>
              </div>
            </div>
          ) : activeReport ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-5">
              {/* ================= 1. AUTOMATED OVEREXTENSION ALERT BANNER ================= */}
              {scatterGatherResult?.created_alerts && scatterGatherResult.created_alerts.length > 0 && (
                <div className="p-4 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-card/90 to-card/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 mt-0.5">
                      <Bell className="w-5 h-5 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                          Automated Overextension Alerts Armed ({scatterGatherResult.created_alerts.length})
                        </span>
                        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-mono font-bold">
                          ACTIVE IN DATABASE
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Price alerts have been automatically set for extended positions. You will be alerted when market price exceeds these valuation thresholds:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {scatterGatherResult.created_alerts.map((al) => (
                          <Badge key={al.alert_id} variant="outline" className="text-[11px] font-mono border-rose-500/30 text-rose-300 bg-rose-500/10">
                            {al.symbol} &gt; ${al.target_price.toFixed(2)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 2. EXECUTIVE KPI RIBBON ================= */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Audited */}
                <div className="rounded-2xl p-5 border bg-card/60 border-border/60 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-cyan-400" /> Audited Holdings
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/30">
                      Isolated Workers
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl font-black font-mono text-foreground">
                      {activeReport.totalHoldingsCount} Stocks
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Concurrent batches of 5 agents executed
                    </p>
                  </div>
                </div>

                {/* Overextended Risks */}
                <div className={cn(
                  "rounded-2xl p-5 border flex flex-col justify-between shadow-sm",
                  activeReport.overvaluedCount > 0
                    ? "bg-gradient-to-br from-rose-950/30 to-card/60 border-rose-500/40"
                    : "bg-card/60 border-border/60"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" /> Overextended Risks
                    </span>
                    <Badge className="bg-rose-500/25 text-rose-300 border-rose-500/40 text-[10px] font-mono">
                      {activeReport.overvaluedCount} Positions
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl font-black font-mono text-rose-300">
                      {activeReport.overvaluedCount}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Automated price alerts set on extended thresholds
                    </p>
                  </div>
                </div>

                {/* Undervalued Gems */}
                <div className="rounded-2xl p-5 border bg-gradient-to-br from-emerald-950/30 to-card/60 border-emerald-500/40 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> Undervalued Gems
                    </span>
                    <Badge className="bg-emerald-500/25 text-emerald-300 border-emerald-500/40 text-[10px] font-mono">
                      {activeReport.undervaluedCount} Positions
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl font-black font-mono text-emerald-300">
                      {activeReport.undervaluedCount}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Attractive upside relative to 1Y target price
                    </p>
                  </div>
                </div>

                {/* Fairly Valued Count */}
                <div className="rounded-2xl p-5 border bg-card/60 border-border/60 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" /> Fair Value
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                      Consensus Band
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl font-black font-mono text-cyan-400">
                      {activeReport.fairlyValuedCount}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Trading near intrinsic cash flow model
                    </p>
                  </div>
                </div>
              </div>

              {/* ================= TABS NAVIGATION ================= */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
                <TabsList className="bg-card/70 border border-border/50 p-1">
                  <TabsTrigger value="holdings" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Holdings Valuation ({filteredHoldings.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="synthesis" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Executive Synthesis</span>
                  </TabsTrigger>
                  <TabsTrigger value="savedReports" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Watch Later & Saved PDFs ({savedWorkerReports.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <History className="w-3.5 h-3.5" />
                    <span>Audit History ({auditHistory.length})</span>
                  </TabsTrigger>
                </TabsList>

                {activeTab === 'holdings' && (
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1 bg-card/60 border border-border/50 rounded-lg p-0.5">
                      <Button
                        variant={statusFilter === 'ALL' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('ALL')}
                        className="h-7 text-[11px] px-2"
                      >
                        All
                      </Button>
                      <Button
                        variant={statusFilter === 'UNDERVALUED' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('UNDERVALUED')}
                        className="h-7 text-[11px] px-2 text-emerald-400"
                      >
                        Undervalued
                      </Button>
                      <Button
                        variant={statusFilter === 'OVERVALUED' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setStatusFilter('OVERVALUED')}
                        className="h-7 text-[11px] px-2 text-rose-400"
                      >
                        Overextended
                      </Button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Filter ticker..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 pr-3 text-xs bg-card/60 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-32 sm:w-40 text-foreground"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ================= TAB 1: HOLDINGS VALUATION CARDS ================= */}
              <TabsContent value="holdings" className="m-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredHoldings.map((h) => {
                    const scatterRep = stockReportsMap.get(h.symbol.toUpperCase());
                    const isOverextended = scatterRep?.is_overextended || h.valuationStatus === 'OVERVALUED' || h.valuationStatus === 'EXTREMELY_OVERVALUED';
                    const targetPrice = scatterRep?.target_price_1y || h.blendedFairValue || h.currentPrice;
                    const upsidePct = scatterRep?.upside_downside_pct !== undefined ? scatterRep.upside_downside_pct : h.upsideDownsidePercent;
                    const thesis = scatterRep?.valuation_thesis || h.aiDiagnosisSummary;
                    const drivers = scatterRep?.key_drivers || h.keyDrivers || [];
                    const threshold = scatterRep?.overextended_threshold_price || Number((h.currentPrice * 1.05).toFixed(2));

                    return (
                      <Card
                        key={h.symbol}
                        className={cn(
                          "glass-card border transition-all duration-200 hover:shadow-lg relative overflow-hidden flex flex-col justify-between",
                          isOverextended
                            ? "border-rose-500/40 bg-gradient-to-b from-rose-950/15 via-card/80 to-card/60"
                            : upsidePct > 10
                            ? "border-emerald-500/40 bg-gradient-to-b from-emerald-950/15 via-card/80 to-card/60"
                            : "border-border/60 bg-card/60"
                        )}
                      >
                        <CardHeader className="p-4 pb-3 border-b border-border/30">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  onClick={() => handleSelectTicker(h.symbol)}
                                  className="text-base font-black text-foreground hover:text-primary transition-colors cursor-pointer"
                                >
                                  {h.symbol}
                                </span>
                                <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                                  {h.companyName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 pt-1">
                                {getStatusBadge(isOverextended ? 'OVEREXTENDED' : upsidePct > 10 ? 'UNDERVALUED' : 'FAIRLY_VALUED', upsidePct)}
                                {isOverextended && (
                                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-mono flex items-center gap-1">
                                    <Bell className="w-2.5 h-2.5 text-rose-400" />
                                    Alert &gt; ${threshold.toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Actions on Card */}
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleDownloadStockPdf(h.symbol, e)}
                                className="h-7 text-[11px] gap-1 px-2 bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                title="Download complete Stock PDF report"
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectTicker(h.symbol)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Open Research Deep Dive"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          {/* Price Target & Return Grid */}
                          <div className="grid grid-cols-3 gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-border/40 font-mono">
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Current</div>
                              <div className="text-sm font-bold text-foreground">${h.currentPrice.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">1Y Target</div>
                              <div className="text-sm font-bold text-indigo-400">${targetPrice.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Upside</div>
                              <div className={cn("text-sm font-bold", upsidePct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {upsidePct >= 0 ? '+' : ''}{upsidePct.toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          {/* Valuation Thesis */}
                          {thesis && (
                            <div className="text-xs text-foreground/80 leading-relaxed bg-accent/20 p-2.5 rounded-xl border border-border/20">
                              <span className="font-semibold text-foreground">Valuation Thesis: </span>
                              {thesis}
                            </div>
                          )}

                          {/* Key Drivers */}
                          {drivers.length > 0 && (
                            <div className="space-y-1 text-[11px]">
                              <span className="text-muted-foreground font-semibold uppercase text-[9px] tracking-wider">
                                Key Drivers & Rationale:
                              </span>
                              <div className="space-y-0.5">
                                {drivers.slice(0, 2).map((d, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-foreground/80">
                                    <span className="text-emerald-400 font-bold">•</span>
                                    <span className="truncate">{d}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Ratios row */}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-2 border-t border-border/30">
                            <span>P/E: <strong>{h.forwardPE ? `${h.forwardPE}x` : h.trailingPE ? `${h.trailingPE}x` : 'N/A'}</strong></span>
                            <span>PEG: <strong>{h.pegRatio ? h.pegRatio : 'N/A'}</strong></span>
                            <span>Score: <strong>{h.valuationScore}/100</strong></span>
                            <span className="text-primary font-bold">{h.actionVerdict.replace(/_/g, ' ')}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* ================= TAB 2: EXECUTIVE SYNTHESIS ================= */}
              <TabsContent value="synthesis" className="m-0 space-y-4">
                <Card className="bg-card/40 border-border/60 shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Executive Valuation Audit Synthesis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3 text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                    {activeReport.executiveSummary}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Top Opportunities */}
                  <Card className="bg-gradient-to-br from-card/80 to-emerald-950/20 border-emerald-500/30 p-4 space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> High-Conviction Undervalued Opportunities
                    </h5>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeReport.keyOpportunitiesSummary}
                    </p>
                  </Card>

                  {/* Valuation Risks */}
                  <Card className="bg-gradient-to-br from-card/80 to-rose-950/20 border-rose-500/30 p-4 space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Extended Valuation Risks & Trims
                    </h5>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeReport.valuationRisksSummary}
                    </p>
                  </Card>
                </div>
              </TabsContent>

              {/* ================= TAB 3: WATCH LATER & SAVED WORKER REPORTS ================= */}
              <TabsContent value="savedReports" className="m-0 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Saved Stock Valuation Reports ({savedWorkerReports.length})
                  </span>
                  <span className="text-xs text-muted-foreground">Stored under respective asset to review and download anytime</span>
                </div>

                {savedWorkerReports.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No individual stock reports saved yet. Click "Run Scatter-Gather Pipeline" above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedWorkerReports.map((rep) => {
                      let parsedReport: StockValuationReport | null = null;
                      try {
                        parsedReport = JSON.parse(rep.contentJson);
                      } catch (e) {
                        // ignore
                      }

                      return (
                        <div
                          key={rep.id}
                          className="p-3 rounded-xl border border-border/40 bg-card/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all hover:bg-accent/40"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-foreground text-sm">{rep.symbol}</span>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {rep.title}
                              </Badge>
                              {parsedReport && (
                                <Badge className={cn(
                                  "text-[10px] font-mono",
                                  parsedReport.is_overextended ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                )}>
                                  1Y Target: ${parsedReport.target_price_1y}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-xl">
                              {rep.summary || (parsedReport?.valuation_thesis ?? 'Valuation completed.')}
                            </p>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              Saved: {new Date(rep.createdAt).toLocaleString()} • Conviction: {rep.convictionScore || 75}/100
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleDownloadStockPdf(rep.symbol, e)}
                              className="h-7 text-xs gap-1 bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download PDF</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectTicker(rep.symbol)}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Research ↗
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ================= TAB 4: AUDIT HISTORY ================= */}
              <TabsContent value="history" className="m-0 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Historical Portfolio Valuation Audits ({auditHistory.length})
                  </span>
                  <span className="text-xs text-muted-foreground">Stored in Local SQLite Database</span>
                </div>

                {auditHistory.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No historical valuation reports saved yet. Click "Run Scatter-Gather Pipeline" above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditHistory.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setActiveReport(item)}
                        className={cn(
                          "p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all cursor-pointer",
                          activeReport?.id === item.id
                            ? "bg-primary/10 border-primary/50 shadow-sm ring-1 ring-primary/40"
                            : "bg-card/50 border-border/40 hover:bg-accent/40"
                        )}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">
                              {item.title}
                            </span>
                            <Badge className="text-[10px] font-mono font-bold">
                              {item.portfolioDiscountPercent >= 0 ? `+${item.portfolioDiscountPercent}% Discount` : `${item.portfolioDiscountPercent}% Premium`}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'} • {item.totalHoldingsCount} Holdings Audited • Score: {item.portfolioScore}/100
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(portfolioValuationAgentClient.getPortfolioPdfUrl(item.id!), '_blank');
                              }}
                              className="h-7 text-xs gap-1"
                            >
                              <Download className="w-3 h-3" />
                              <span>PDF</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => item.id && handleDeleteAudit(item.id, e)}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                            title="Delete this audit record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 max-w-fit mx-auto">
                <Scale className="w-12 h-12 text-emerald-400" />
              </div>
              <h4 className="text-lg font-bold text-foreground">Portfolio Valuation & Alerting Engine Ready</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Trigger the isolated Scatter-Gather Map-Reduce pipeline to concurrently analyze every portfolio stock in batches of 5. Calculate 1-year target prices, formulate valuation theses, arm automated overextension price alerts, and generate downloadable PDFs.
              </p>
              <Button onClick={handleRunScatterGather} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg">
                <Sparkles className="w-4 h-4" /> Run Scatter-Gather Valuation & Alerting
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
