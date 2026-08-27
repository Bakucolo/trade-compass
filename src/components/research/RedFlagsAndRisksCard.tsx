import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  TrendingDown,
  FileText,
  Sparkles,
  Download,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ExternalLink,
  DollarSign,
  Scale,
  Layers,
  ArrowDownRight,
  RotateCw,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { AutonomousReport, reportService, useAutonomousReports } from '@/services/reportService';
import { useReportPrompts } from '@/services/promptService';
import { AutonomousReportViewerModal } from '../AutonomousReportViewerModal';

interface RedFlagsAndRisksCardProps {
  symbol: string;
  dossier?: any;
  optionsChain?: any;
  onOpenReportViewer?: (report: AutonomousReport) => void;
}

export function RedFlagsAndRisksCard({
  symbol,
  dossier,
  optionsChain,
  onOpenReportViewer,
}: RedFlagsAndRisksCardProps) {
  const queryClient = useQueryClient();
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [activeViewerReport, setActiveViewerReport] = useState<AutonomousReport | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const { data: allReports = [], refetch: refetchReports, isFetching: isFetchingReports } = useAutonomousReports(symbol);
  const { data: reportPrompts = [] } = useReportPrompts();

  // Filter reports to red flags / risk reports or all reports for this symbol
  const redFlagsReports = allReports.filter(
    (r) =>
      r.reportType === 'red_flags_and_risks' ||
      r.title.toLowerCase().includes('risk') ||
      r.title.toLowerCase().includes('red flag') ||
      r.title.toLowerCase().includes('forensic')
  );

  const latestRiskReport = redFlagsReports[0] || null;

  // Extract key metrics from dossier
  const price = dossier?.header?.regularMarketPrice || 0;
  const pe = dossier?.fundamentals?.trailingPE;
  const debtToEquity = dossier?.fundamentals?.debtToEquity;
  const operatingMargin = dossier?.fundamentals?.operatingMargins;
  const fcf = dossier?.fundamentals?.freeCashflow;
  const yearHigh = dossier?.technicals?.fiftyTwoWeekHigh || price;
  const yearLow = dossier?.technicals?.fiftyTwoWeekLow || price;
  const drawdownFromHigh = yearHigh > 0 ? ((price - yearHigh) / yearHigh) * 100 : 0;
  const putCallOiRatio = optionsChain?.analytics?.putCallOiRatio || 1.0;

  // Algorithmic Risk Checks
  const riskChecks = [
    {
      id: 'debt',
      title: 'Balance Sheet & Debt Leverage',
      status: debtToEquity && debtToEquity > 150 ? 'CRITICAL' : debtToEquity && debtToEquity > 80 ? 'WARNING' : 'HEALTHY',
      value: debtToEquity ? `${debtToEquity.toFixed(1)}% D/E` : 'Healthy / Low Debt',
      detail:
        debtToEquity && debtToEquity > 150
          ? 'High leverage elevates refinancing & interest rate sensitivity.'
          : debtToEquity && debtToEquity > 80
          ? 'Moderate debt load requiring consistent operating cash flows.'
          : 'Conservative balance sheet with strong solvency buffer.',
    },
    {
      id: 'margin',
      title: 'Profitability & Operating Margins',
      status: operatingMargin && operatingMargin < 0 ? 'CRITICAL' : operatingMargin && operatingMargin < 0.1 ? 'WARNING' : 'HEALTHY',
      value: operatingMargin ? `${(operatingMargin * 100).toFixed(1)}% Margin` : 'Profitable',
      detail:
        operatingMargin && operatingMargin < 0
          ? 'Operating at an operating loss; burns cash on core operations.'
          : operatingMargin && operatingMargin < 0.1
          ? 'Thin operating margins leave vulnerability to input cost inflation.'
          : 'Healthy operating margins offering pricing power buffer.',
    },
    {
      id: 'valuation',
      title: 'Valuation Multiple Extension',
      status: pe && pe > 65 ? 'CRITICAL' : pe && pe > 35 ? 'WARNING' : 'HEALTHY',
      value: pe ? `${pe.toFixed(1)}x Trailing P/E` : 'Normal Multiples',
      detail:
        pe && pe > 65
          ? 'Priced for perfection; any earnings miss risks severe multiple contraction.'
          : pe && pe > 35
          ? 'Elevated growth premium relative to broader market averages.'
          : 'Reasonable valuation multiple aligned with earnings power.',
    },
    {
      id: 'drawdown',
      title: 'Momentum & 52-Week Breakdown',
      status: drawdownFromHigh < -35 ? 'CRITICAL' : drawdownFromHigh < -20 ? 'WARNING' : 'HEALTHY',
      value: `${drawdownFromHigh.toFixed(1)}% vs 52W High`,
      detail:
        drawdownFromHigh < -35
          ? 'Severe multi-month structural downtrend or broken growth thesis.'
          : drawdownFromHigh < -20
          ? 'Technical correction zone with overhead supply resistance.'
          : 'Trading near high-momentum technical strength.',
    },
    {
      id: 'derivatives_hedging',
      title: 'Options Market Downside Hedging',
      status: putCallOiRatio > 1.4 ? 'CRITICAL' : putCallOiRatio > 1.1 ? 'WARNING' : 'HEALTHY',
      value: `${putCallOiRatio.toFixed(2)}x Put/Call OI`,
      detail:
        putCallOiRatio > 1.4
          ? 'Aggressive institutional put buying signals elevated tail-risk hedging.'
          : putCallOiRatio > 1.1
          ? 'Moderate downside protection demand from derivatives market makers.'
          : 'Balanced options structure with low tail-risk hedging pressure.',
    },
  ];

  // Calculate composite risk score
  const criticalCount = riskChecks.filter((r) => r.status === 'CRITICAL').length;
  const warningCount = riskChecks.filter((r) => r.status === 'WARNING').length;
  const compositeRiskScore = Math.min(95, Math.max(15, 20 + criticalCount * 22 + warningCount * 12));

  const riskTier =
    compositeRiskScore >= 65
      ? { label: 'HIGH RISK & RED FLAGS', color: 'rose', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
      : compositeRiskScore >= 40
      ? { label: 'MODERATE RISK PROFILE', color: 'amber', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
      : { label: 'LOW RISK / CLEAN AUDIT', color: 'emerald', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };

  const handleTriggerRedFlagsAgent = async () => {
    if (!symbol || isAgentLoading) return;
    setIsAgentLoading(true);

    try {
      toast.info(`Forensic Agent scanning SEC 10-K filings, debt solvency & red flags for ${symbol}...`);

      const targetTemplate =
        reportPrompts.find((p) => p.slug === 'red_flags_and_risks') ||
        reportPrompts.find((p) => p.category === 'RISK_AND_RED_FLAGS');
      const promptId = targetTemplate ? targetTemplate.id : undefined;

      const result = await reportService.generateReport(symbol, 'red_flags_and_risks', promptId);

      toast.success(`Forensic Red Flags & Risks Report generated for ${symbol}!`);
      await queryClient.invalidateQueries({ queryKey: ['autonomousReports', symbol] });
      await queryClient.invalidateQueries({ queryKey: ['allAutonomousReports'] });
      await refetchReports();

      if (result?.report) {
        if (onOpenReportViewer) {
          onOpenReportViewer(result.report);
        } else {
          setActiveViewerReport(result.report);
          setIsViewerOpen(true);
        }
      }
    } catch (err: any) {
      console.error('Error generating Red Flags report:', err);
      toast.error(err.message || 'Failed to generate red flags report. Please check API keys.');
    } finally {
      setIsAgentLoading(false);
    }
  };

  const handleViewReport = (report: AutonomousReport) => {
    if (onOpenReportViewer) {
      onOpenReportViewer(report);
    } else {
      setActiveViewerReport(report);
      setIsViewerOpen(true);
    }
  };

  return (
    <Card className="bg-card/70 backdrop-blur-2xl border border-border/70 shadow-xl hover:border-rose-500/40 transition-all rounded-2xl overflow-hidden">
      {/* Top red flags accent glow strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 animate-pulse" />

      {/* ================= HEADER ================= */}
      <CardHeader className="p-6 pb-4 border-b border-border/40 bg-accent/15">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                Forensic Risk & Red Flags Engine
              </Badge>
              <Badge className={cn("text-[10px] font-mono font-bold uppercase", riskTier.badgeClass)}>
                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                {riskTier.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono font-bold bg-slate-900 border-slate-700">
                Composite Risk Score: <b className="text-rose-400 ml-1">{compositeRiskScore}/100</b>
              </Badge>
            </div>

            <CardTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5 pt-0.5">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>{symbol} Red Flags, Warnings & Forensic Risk Audit</span>
            </CardTitle>

            <CardDescription className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
              Autonomous forensic audit probing SEC 10-K risk factors, balance sheet solvency, revenue recognition quality, customer concentration, and downside short-seller catalysts.
            </CardDescription>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <Button
              onClick={handleTriggerRedFlagsAgent}
              disabled={isAgentLoading}
              className="h-10 text-xs font-bold gap-2 bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all px-4"
            >
              {isAgentLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Auditing 10-K & SEC Filings...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>Generate AI Red Flags & Risks Report</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* ================= 1. ALGORITHMIC RISK HEURISTICS GRID ================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-sans">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Real-Time Algorithmic Red Flag Surveillance
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {criticalCount} Critical • {warningCount} Warnings • {riskChecks.length - criticalCount - warningCount} Healthy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
            {riskChecks.map((rc) => {
              const isCrit = rc.status === 'CRITICAL';
              const isWarn = rc.status === 'WARNING';

              return (
                <div
                  key={rc.id}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all space-y-2 relative overflow-hidden",
                    isCrit
                      ? "bg-rose-950/20 border-rose-500/40 shadow-sm"
                      : isWarn
                      ? "bg-amber-950/20 border-amber-500/40"
                      : "bg-card/60 border-border/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-sans font-bold text-foreground truncate">{rc.title}</span>
                    <Badge
                      className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0",
                        isCrit
                          ? "bg-rose-500 text-white"
                          : isWarn
                          ? "bg-amber-500 text-black"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      )}
                    >
                      {rc.status}
                    </Badge>
                  </div>

                  <div className="flex items-baseline justify-between pt-0.5">
                    <strong className={cn("text-base font-black", isCrit ? "text-rose-400" : isWarn ? "text-amber-300" : "text-emerald-400")}>
                      {rc.value}
                    </strong>
                  </div>

                  <p className="text-[10.5px] text-muted-foreground font-sans leading-tight">
                    {rc.detail}
                  </p>
                </div>
              );
            })}

            {/* Quick Agent Launcher Box */}
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/10 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[11px] font-sans font-bold text-primary flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Deep Forensic Agent
                </span>
                <p className="text-[10.5px] text-muted-foreground font-sans leading-tight mt-1">
                  Performs an unsparing analysis of SEC footnotes, executive turnover, and distressed valuations.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerRedFlagsAgent}
                disabled={isAgentLoading}
                className="h-7 text-xs font-bold gap-1 border-primary/40 text-primary hover:bg-primary/20"
              >
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span>Run Agent Now</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ================= 2. LATEST GENERATED RED FLAGS & RISKS REPORT SNAPSHOT ================= */}
        {latestRiskReport ? (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/20 via-card/80 to-slate-950/60 border border-rose-500/30 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-rose-500 text-white font-mono text-[9px] font-black uppercase">
                    LATEST FORENSIC DOSSIER
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    Generated on {new Date(latestRiskReport.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <h4 className="text-base font-black text-foreground pt-1">
                  {latestRiskReport.title}
                </h4>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <Button
                  size="sm"
                  onClick={() => handleViewReport(latestRiskReport)}
                  className="h-8 text-xs font-bold gap-1.5 bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Read Full Audit</span>
                </Button>

                {latestRiskReport.pdfPath && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(reportService.getPdfDownloadUrl(latestRiskReport.id), '_blank')}
                    className="h-8 text-xs font-bold gap-1.5 border-border/60 hover:bg-accent/40"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    <span>PDF</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Executive Summary Warning Bullets */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-300 font-sans flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                Critical Red Flags & Main Risks Identified:
              </span>

              {(() => {
                let bullets: string[] = [];
                try {
                  const content = reportService.parseContentJson(latestRiskReport);
                  if (Array.isArray(content.executive_summary)) {
                    bullets = content.executive_summary;
                  } else if (typeof content.executive_summary === 'string') {
                    bullets = [content.executive_summary];
                  }
                } catch {
                  bullets = [];
                }

                if (bullets.length === 0 && latestRiskReport.summary) {
                  try {
                    const parsed = JSON.parse(latestRiskReport.summary);
                    if (Array.isArray(parsed)) bullets = parsed;
                  } catch {
                    bullets = [latestRiskReport.summary];
                  }
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {bullets.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950/60 border border-rose-500/25 text-xs text-foreground/90 leading-relaxed flex items-start gap-2"
                      >
                        <span className="text-rose-400 font-bold shrink-0 mt-0.5">•</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* Empty State prompt to generate */
          <div className="p-6 rounded-2xl bg-slate-950/40 border border-dashed border-rose-500/30 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="text-sm font-bold text-foreground">No Forensic Red Flags Report Yet</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click the button below to have the Autonomous Research Agent perform an exhaustive 10-K/10-Q risk audit, solvency stress-test, and short seller breakdown for {symbol}.
              </p>
            </div>
            <Button
              onClick={handleTriggerRedFlagsAgent}
              disabled={isAgentLoading}
              className="h-9 text-xs font-bold gap-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-md shadow-rose-500/20"
            >
              {isAgentLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Compiling Forensic Dossier...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-300" />
                  <span>Generate {symbol} Red Flags & Risks Report</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* ================= 3. HISTORICAL REPORTS LIST (IF MULTIPLE EXIST) ================= */}
        {redFlagsReports.length > 1 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
              Previous Risk Audit Reports ({redFlagsReports.length})
            </span>
            <div className="divide-y divide-border/30 font-mono text-xs">
              {redFlagsReports.slice(1).map((rep) => (
                <div key={rep.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block">{rep.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(rep.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • Score: {rep.convictionScore}/100
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewReport(rep)}
                      className="h-7 text-xs font-bold gap-1 border-border/60 hover:bg-accent/40"
                    >
                      <Eye className="w-3 h-3 text-rose-400" />
                      <span>View</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Standalone Viewer Modal */}
      {activeViewerReport && (
        <AutonomousReportViewerModal
          report={activeViewerReport}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </Card>
  );
}
