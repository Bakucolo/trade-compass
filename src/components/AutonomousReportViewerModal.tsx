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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AutonomousReport,
  ReportStructuredContent,
  ScorecardData,
  reportService
} from '@/services/reportService';
import {
  Sparkles,
  Download,
  Trash2,
  Share2,
  Check,
  Building2,
  BarChart3,
  AlertTriangle,
  Globe,
  Target,
  Users,
  Briefcase,
  Layers,
  FileText,
  Calendar,
  Code2,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Percent,
  CheckCircle2,
  Compass,
  Zap,
  Award,
  BookOpen,
  Minus,
  CheckCheck,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AutonomousReportViewerModalProps {
  report: AutonomousReport | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteSuccess?: (deletedId: string) => void;
}

// Helper to detect if a text/phrase has bullish or bearish sentiment
export function detectSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  if (!text || typeof text !== 'string') return 'neutral';
  const lower = text.toLowerCase();

  const bullishKeywords = [
    'beat', 'exceed', 'outperform', 'surpass', 'strong growth', 'robust', 'record high',
    'tailwind', 'accelerat', 'bullish', 'undervalued', 'upgrade', 'wide moat', 'pricing power',
    'margin expansion', 'upside', 'dominant', 'market share gain', 'buy rating', 'favorable',
    'free cash flow growth', 'dividend increase', 'soaring', 'competitive advantage',
    'cash reserves', 'unparalleled', 'innovation leader', 'positive'
  ];

  const bearishKeywords = [
    'miss', 'missed', 'decline', 'headwind', 'bearish', 'risk', 'red flag', 'slowdown',
    'downside', 'overvalued', 'compress', 'margin contraction', 'regulatory pressure',
    'antitrust', 'dilution', 'debt burden', 'supply constraint', 'litigation', 'downgrade',
    'underperform', 'sell rating', 'deteriorat', 'loss', 'weakness', 'stagnant', 'scrutiny',
    'vulnerab', 'caution'
  ];

  let bullishCount = 0;
  let bearishCount = 0;

  for (const kw of bullishKeywords) {
    if (lower.includes(kw)) bullishCount++;
  }
  for (const kw of bearishKeywords) {
    if (lower.includes(kw)) bearishCount++;
  }

  if (bullishCount > bearishCount) return 'bullish';
  if (bearishCount > bullishCount) return 'bearish';
  return 'neutral';
}

export function AutonomousReportViewerModal({
  report,
  isOpen,
  onClose,
  onDeleteSuccess
}: AutonomousReportViewerModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewRawJson, setViewRawJson] = useState(false);

  if (!report) return null;

  const content: ReportStructuredContent = reportService.parseContentJson(report);
  const scorecard: ScorecardData = content.scorecard || reportService.extractScorecard(content, report);

  const score = scorecard.convictionScore ?? report.convictionScore ?? 75;
  const isHighConviction = score >= 70;
  const isLowConviction = score <= 45;

  const scoreColor = isHighConviction
    ? 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
    : isLowConviction
    ? 'from-rose-500/20 to-red-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
    : 'from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]';

  const formattedDate = new Date(report.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const handleDownloadPdf = () => {
    window.open(reportService.getPdfDownloadUrl(report.id), '_blank');
  };

  const handleCopySummary = async () => {
    try {
      const summaryText = Array.isArray(content.executive_summary)
        ? content.executive_summary.join('\n• ')
        : (content.executive_summary || report.summary || '');
      
      const fullText = `# ${report.title}\nTicker: ${report.symbol}\nDate: ${formattedDate}\nConviction Score: ${score}/100\nRating: ${scorecard.rating || 'N/A'}\nPrice Target: ${scorecard.priceTarget || 'N/A'}\n\n## Executive Summary\n• ${summaryText}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success('Report summary copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete this research report for ${report.symbol}?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await reportService.deleteReport(report.id);
      toast.success('Research report deleted');
      onDeleteSuccess?.(report.id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete report');
    } finally {
      setIsDeleting(false);
    }
  };

  // Extract executive summary bullets
  const execSummary: string[] = [];
  if (Array.isArray(content.executive_summary)) {
    execSummary.push(...content.executive_summary);
  } else if (typeof content.executive_summary === 'string' && content.executive_summary) {
    execSummary.push(content.executive_summary);
  } else if (report.summary) {
    try {
      const parsed = JSON.parse(report.summary);
      if (Array.isArray(parsed)) execSummary.push(...parsed);
      else execSummary.push(report.summary);
    } catch {
      execSummary.push(report.summary);
    }
  }

  // Find root sections container (unwrap "report" if present)
  const reportBody = (content.report && typeof content.report === 'object') ? content.report : content;

  // Format rating badge color & sentiment
  const getRatingBadgeInfo = (r?: string) => {
    const ratingUpper = (r || '').toUpperCase();
    if (ratingUpper.includes('BUY') || ratingUpper.includes('OUTPERFORM')) {
      return {
        badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
        label: 'Bullish Stance',
        icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
      };
    }
    if (ratingUpper.includes('SELL') || ratingUpper.includes('UNDERPERFORM')) {
      return {
        badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]',
        label: 'Bearish Stance',
        icon: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
      };
    }
    return {
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
      label: 'Neutral Stance',
      icon: <Minus className="w-3.5 h-3.5 text-amber-400" />
    };
  };

  // Moat sentiment
  const moatScore = scorecard.moatRating ?? 8;
  const isMoatBullish = moatScore >= 7;
  const isMoatBearish = moatScore <= 4;

  // Management sentiment
  const mgmtScore = scorecard.managementRating ?? 8;
  const isMgmtBullish = mgmtScore >= 7;
  const isMgmtBearish = mgmtScore <= 4;

  // Helper to format financial numbers (e.g. Market cap 5252323999744 -> $5.25T)
  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'number') {
      if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
      if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
      if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
      return String(val);
    }
    return String(val);
  };

  // Helper to render nested values recursively with zero raw JSON and full sentiment styling
  const renderStructuredValue = (val: any, depth: number = 0): React.ReactNode => {
    if (val === null || val === undefined) return <span className="text-muted-foreground italic">None</span>;

    // Primitive String
    if (typeof val === 'string') {
      const sentiment = detectSentiment(val);
      const isBullish = sentiment === 'bullish';
      const isBearish = sentiment === 'bearish';

      return (
        <div className={cn(
          "text-sm leading-relaxed p-2.5 rounded-lg transition-colors",
          isBullish && "bg-emerald-500/5 border-l-2 border-emerald-500/50 text-foreground",
          isBearish && "bg-rose-500/5 border-l-2 border-rose-500/50 text-foreground",
          !isBullish && !isBearish && "text-foreground/90"
        )}>
          {val}
        </div>
      );
    }

    // Primitive Number or Boolean
    if (typeof val === 'number' || typeof val === 'boolean') {
      return <p className="text-sm font-mono font-bold text-foreground">{String(val)}</p>;
    }

    // Array of items
    if (Array.isArray(val)) {
      return (
        <div className="space-y-2.5">
          {val.map((item, idx) => {
            const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
            const sentiment = detectSentiment(itemStr);
            const isBullish = sentiment === 'bullish';
            const isBearish = sentiment === 'bearish';

            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border transition-all",
                  isBullish && "bg-emerald-950/15 border-emerald-500/30 text-emerald-50 shadow-sm",
                  isBearish && "bg-rose-950/15 border-rose-500/30 text-rose-50 shadow-sm",
                  !isBullish && !isBearish && "bg-card/40 border-border/50 text-foreground/90"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {isBullish ? (
                    <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                  ) : isBearish ? (
                    <div className="p-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                      <TrendingDown className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="p-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-sm leading-relaxed">
                  {typeof item === 'string' ? item : renderStructuredValue(item, depth + 1)}
                </div>

                {isBullish && (
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shrink-0 self-start">
                    Bullish
                  </Badge>
                )}
                {isBearish && (
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-rose-400 border-rose-500/30 bg-rose-500/10 shrink-0 self-start">
                    Risk Factor
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // Object / Dictionary
    if (typeof val === 'object') {
      const entries = Object.entries(val);
      const isSimpleKeyValue = entries.every(
        ([_, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null
      );

      // Simple Key-Value Stat Grid
      if (isSimpleKeyValue && entries.length > 0 && depth > 0) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-1">
            {entries.map(([k, v]) => {
              const vStr = String(v || '');
              const sentiment = detectSentiment(k + ' ' + vStr);
              const isBullish = sentiment === 'bullish';
              const isBearish = sentiment === 'bearish';

              return (
                <div
                  key={k}
                  className={cn(
                    "border rounded-xl p-3 flex flex-col justify-between transition-all",
                    isBullish && "bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
                    isBearish && "bg-rose-950/20 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.1)]",
                    !isBullish && !isBearish && "bg-card/70 border-border/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {k.replace(/_/g, ' ')}
                    </span>
                    {isBullish && <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />}
                    {isBearish && <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />}
                  </div>

                  <span className={cn(
                    "text-sm font-bold font-mono",
                    isBullish && "text-emerald-400",
                    isBearish && "text-rose-400",
                    !isBullish && !isBearish && "text-foreground"
                  )}>
                    {formatValue(v)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      }

      // Deeper nested object: render formatted cards
      return (
        <div className="space-y-3">
          {entries.map(([k, v]) => {
            const readableKey = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const isRiskKey = k.toLowerCase().includes('risk') || k.toLowerCase().includes('flag') || k.toLowerCase().includes('bear');
            const isBullishKey = k.toLowerCase().includes('moat') || k.toLowerCase().includes('catalyst') || k.toLowerCase().includes('tailwinds') || k.toLowerCase().includes('advantage');

            return (
              <div
                key={k}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  isRiskKey
                    ? "bg-rose-950/20 border-rose-500/35 text-rose-100 shadow-sm"
                    : isBullishKey
                    ? "bg-emerald-950/10 border-emerald-500/25 text-emerald-50 shadow-sm"
                    : "bg-card/50 border-border/60 text-foreground"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isRiskKey ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : isBullishKey ? (
                      <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                    <h5 className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      isRiskKey ? "text-rose-300" : isBullishKey ? "text-emerald-300" : "text-foreground"
                    )}>
                      {readableKey}
                    </h5>
                  </div>

                  {isRiskKey && (
                    <Badge variant="outline" className="text-[9px] uppercase font-bold text-rose-400 border-rose-500/40 bg-rose-500/10">
                      Downside Risk
                    </Badge>
                  )}
                  {isBullishKey && (
                    <Badge variant="outline" className="text-[9px] uppercase font-bold text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                      Bullish Driver
                    </Badge>
                  )}
                </div>

                <div className="pl-1">
                  {renderStructuredValue(v, depth + 1)}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return String(val);
  };

  // Helper to pick section header icon
  const getSectionIcon = (keyName: string) => {
    const k = keyName.toLowerCase();
    if (k.includes('moat') || k.includes('competitive')) return <Award className="w-4 h-4 text-emerald-400" />;
    if (k.includes('management') || k.includes('leadership') || k.includes('governance')) return <Users className="w-4 h-4 text-purple-400" />;
    if (k.includes('financial') || k.includes('valuation') || k.includes('numbers')) return <BarChart3 className="w-4 h-4 text-cyan-400" />;
    if (k.includes('bear') || k.includes('risk') || k.includes('red flag')) return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    if (k.includes('verdict') || k.includes('conviction') || k.includes('recommendation')) return <Target className="w-4 h-4 text-amber-400" />;
    if (k.includes('strategy') || k.includes('entry') || k.includes('mechanic')) return <Zap className="w-4 h-4 text-yellow-400" />;
    if (k.includes('macro') || k.includes('industry') || k.includes('tailwinds')) return <Globe className="w-4 h-4 text-blue-400" />;
    if (k.includes('earnings') || k.includes('quarterly')) return <Layers className="w-4 h-4 text-indigo-400" />;
    return <BookOpen className="w-4 h-4 text-primary" />;
  };

  const ignoredKeys = new Set([
    'ticker',
    'report_title',
    'conviction_score',
    'executive_summary',
    'date',
    'scorecard'
  ]);

  const verdictInfo = getRatingBadgeInfo(scorecard.rating);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
        
        {/* ================= MODAL TOP HEADER BAR ================= */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-card/40 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/40 font-mono font-bold text-sm px-2.5 py-0.5 shadow-sm">
                  {report.symbol}
                </Badge>
                <Badge variant="outline" className="text-xs uppercase tracking-wider text-muted-foreground">
                  {report.reportType.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {formattedDate}
                </span>
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground pt-1">
                {report.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Autonomous fundamental equity research with real-time bullish & bearish sentiment highlighting.
              </DialogDescription>
            </div>

            {/* Score Pill in Top Right */}
            <div className={cn(
              "flex flex-col items-center justify-center px-4 py-2 rounded-2xl border shrink-0 bg-gradient-to-b shadow-md",
              scoreColor
            )}>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Analyst Conviction</span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight mt-0.5">
                {score}<span className="text-xs font-normal opacity-70">/100</span>
              </div>
            </div>
          </div>

          {/* Top Actions: Download PDF, Copy Summary, Raw JSON, Delete */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/40 flex-wrap justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadPdf}
                className="h-8 text-xs gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySummary}
                className="h-8 text-xs gap-1.5 border-border/80 hover:bg-accent/50"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewRawJson(!viewRawJson)}
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{viewRawJson ? 'Formatted View' : 'Raw JSON'}</span>
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-8 text-xs gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Report</span>
            </Button>
          </div>

          {/* Agent Creator Attestation */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-blue-950/30 border border-blue-500/40 text-xs shadow-sm mt-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <div className="flex items-center gap-1.5 text-blue-300 font-bold">
                <Bot className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Report Created By Agent:</span>
              </div>
              <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-mono text-[10px] py-0 px-2 shadow-sm font-bold">
                Autonomous Deep Research Agent (Python 3.12)
              </Badge>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Pipeline:</span>
              <span className="text-foreground font-medium">Multi-Agent SEC 10-K/10-Q & Financial Dossier Engine</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Synthesizer:</span>
              <span className="text-cyan-300 font-mono font-semibold">LLM Consensus & Structured Parser</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Autonomous Verification Active
            </div>
          </div>
        </DialogHeader>

        {/* ================= SCROLLABLE REPORT BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          
          {viewRawJson ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-border/60 overflow-x-auto">
              <pre className="text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(content, null, 2)}
              </pre>
            </div>
          ) : (
            <>
              {/* ================= 1. EXECUTIVE SCORECARD DASHBOARD ================= */}
              <div className="space-y-4">
                
                {/* 4 Scorecard KPI Hero Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  
                  {/* KPI 1: Investment Verdict */}
                  <Card className={cn(
                    "border shadow-sm relative overflow-hidden transition-all",
                    verdictInfo.label.includes('Bullish')
                      ? "bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      : verdictInfo.label.includes('Bearish')
                      ? "bg-rose-950/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                      : "bg-card/70 border-border/70"
                  )}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Investment Verdict</span>
                        {verdictInfo.icon}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "text-sm font-black font-mono px-3 py-1 uppercase rounded-lg border",
                          verdictInfo.badgeClass
                        )}>
                          {scorecard.rating || 'HOLD'}
                        </Badge>
                        <span className={cn(
                          "text-xs font-mono font-bold",
                          verdictInfo.label.includes('Bullish') ? "text-emerald-400" : verdictInfo.label.includes('Bearish') ? "text-rose-400" : "text-amber-400"
                        )}>
                          {verdictInfo.label}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* KPI 2: 1-Year Price Target */}
                  <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/70 shadow-sm relative overflow-hidden">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>1-Year Price Target</span>
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-2xl font-black font-mono text-emerald-400">
                        {scorecard.priceTarget ? (
                          String(scorecard.priceTarget).startsWith('$') ? scorecard.priceTarget : `$${scorecard.priceTarget}`
                        ) : (
                          'N/A'
                        )}
                      </p>
                      {scorecard.targetRationale && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {scorecard.targetRationale}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* KPI 3: Economic Moat Score */}
                  <Card className={cn(
                    "border shadow-sm relative overflow-hidden transition-all",
                    isMoatBullish
                      ? "bg-emerald-950/15 border-emerald-500/35"
                      : isMoatBearish
                      ? "bg-rose-950/15 border-rose-500/35"
                      : "bg-card/70 border-border/70"
                  )}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Economic Moat</span>
                        <Award className={cn("w-4 h-4", isMoatBullish ? "text-emerald-400" : isMoatBearish ? "text-rose-400" : "text-amber-400")} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-lg font-black font-mono", isMoatBullish ? "text-emerald-400" : isMoatBearish ? "text-rose-400" : "text-amber-400")}>
                          {moatScore}/10
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase font-bold",
                          isMoatBullish ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" : isMoatBearish ? "text-rose-300 border-rose-500/40 bg-rose-500/10" : "text-amber-300 border-amber-500/40 bg-amber-500/10"
                        )}>
                          {scorecard.moatTier || (isMoatBullish ? 'Wide Moat (Bullish)' : 'Narrow Moat')}
                        </Badge>
                      </div>
                      <div className="w-full bg-accent/40 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", isMoatBullish ? "bg-emerald-500" : isMoatBearish ? "bg-rose-500" : "bg-amber-500")}
                          style={{ width: `${Math.min(100, (moatScore / 10) * 100)}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* KPI 4: Management & Governance */}
                  <Card className={cn(
                    "border shadow-sm relative overflow-hidden transition-all",
                    isMgmtBullish
                      ? "bg-emerald-950/15 border-emerald-500/35"
                      : isMgmtBearish
                      ? "bg-rose-950/15 border-rose-500/35"
                      : "bg-card/70 border-border/70"
                  )}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Management Quality</span>
                        <Users className={cn("w-4 h-4", isMgmtBullish ? "text-emerald-400" : isMgmtBearish ? "text-rose-400" : "text-purple-400")} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-lg font-black font-mono", isMgmtBullish ? "text-emerald-400" : isMgmtBearish ? "text-rose-400" : "text-foreground")}>
                          {mgmtScore}/10
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase font-bold",
                          isMgmtBullish ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" : isMgmtBearish ? "text-rose-300 border-rose-500/40 bg-rose-500/10" : "text-purple-300 border-purple-500/40 bg-purple-500/10"
                        )}>
                          {scorecard.managementTier || (isMgmtBullish ? 'Exemplary' : 'Adequate')}
                        </Badge>
                      </div>
                      <div className="w-full bg-accent/40 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", isMgmtBullish ? "bg-emerald-500" : isMgmtBearish ? "bg-rose-500" : "bg-purple-500")}
                          style={{ width: `${Math.min(100, (mgmtScore / 10) * 100)}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                </div>

                {/* Scorecard Detailed Table & Actionable Strategy Bar */}
                <Card className="bg-card/60 border-primary/20 backdrop-blur-md shadow-md overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Compass className="w-4 h-4 text-purple-400" /> Executive Scorecard & Valuation Multiples
                      </CardTitle>
                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="flex items-center gap-1 text-emerald-400"><TrendingUp className="w-3 h-3" /> Bullish Green</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="flex items-center gap-1 text-rose-400"><TrendingDown className="w-3 h-3" /> Bearish Red</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    
                    {/* Valuation & Financial Multiples Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-card/70 border border-border/50 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Trailing P/E
                        </span>
                        <p className="font-mono text-base font-bold text-foreground mt-0.5">
                          {formatValue(scorecard.peRatio)}
                        </p>
                      </div>

                      <div className="bg-card/70 border border-border/50 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Price / Sales
                        </span>
                        <p className="font-mono text-base font-bold text-foreground mt-0.5">
                          {formatValue(scorecard.psRatio)}
                        </p>
                      </div>

                      <div className="bg-card/70 border border-border/50 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Dividend Yield
                        </span>
                        <p className="font-mono text-base font-bold text-emerald-400 mt-0.5">
                          {scorecard.dividendYield ? (
                            typeof scorecard.dividendYield === 'number'
                              ? `${(scorecard.dividendYield * (scorecard.dividendYield < 1 ? 100 : 1)).toFixed(2)}%`
                              : String(scorecard.dividendYield)
                          ) : 'N/A'}
                        </p>
                      </div>

                      <div className="bg-card/70 border border-border/50 rounded-xl p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Market Cap
                        </span>
                        <p className="font-mono text-base font-bold text-foreground mt-0.5">
                          {formatValue(scorecard.marketCap)}
                        </p>
                      </div>
                    </div>

                    {/* Actionable Strategy & Entry Levels */}
                    {(scorecard.supportLevel || scorecard.fairValueRange || scorecard.entryStrategy || scorecard.advancedOptionsStrategy) && (
                      <div className="pt-3 border-t border-border/40 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Actionable Entry Strategy & Levels</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {scorecard.supportLevel && (
                            <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
                              <span className="text-muted-foreground font-medium">Support Level</span>
                              <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                                <TrendingUp className="w-3.5 h-3.5" /> {scorecard.supportLevel}
                              </span>
                            </div>
                          )}
                          {scorecard.fairValueRange && (
                            <div className="bg-card/70 border border-border/50 rounded-xl p-3 flex items-center justify-between">
                              <span className="text-muted-foreground font-medium">Fair Value Range</span>
                              <span className="font-mono font-bold text-foreground">{scorecard.fairValueRange}</span>
                            </div>
                          )}
                        </div>

                        {scorecard.entryStrategy && (
                          <div className="bg-emerald-950/10 border border-emerald-500/25 rounded-xl p-3 text-xs text-foreground/90 leading-relaxed">
                            <span className="font-bold text-emerald-400 mr-1">Entry Strategy:</span>
                            {scorecard.entryStrategy}
                          </div>
                        )}

                        {scorecard.advancedOptionsStrategy && (
                          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-xs text-amber-200 leading-relaxed flex items-start gap-2">
                            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-amber-300 mr-1">Options Mechanic:</span>
                              {scorecard.advancedOptionsStrategy}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </CardContent>
                </Card>
              </div>

              {/* ================= 2. EXECUTIVE SUMMARY HERO CARD ================= */}
              {execSummary.length > 0 && (
                <Card className="bg-gradient-to-br from-card/90 to-card/40 border-purple-500/25 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                    <Sparkles className="w-24 h-24 text-purple-400" />
                  </div>
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground uppercase tracking-wider">
                      <div className="p-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                      </div>
                      Executive Summary & Key Takeaways
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {execSummary.map((bullet, idx) => {
                      const sentiment = detectSentiment(bullet);
                      const isBullish = sentiment === 'bullish';
                      const isBearish = sentiment === 'bearish';

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all",
                            isBullish && "bg-emerald-950/15 border-emerald-500/30 shadow-sm",
                            isBearish && "bg-rose-950/15 border-rose-500/30 shadow-sm",
                            !isBullish && !isBearish && "bg-card/40 border-border/40"
                          )}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isBullish ? (
                              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                <TrendingUp className="w-3.5 h-3.5" />
                              </div>
                            ) : isBearish ? (
                              <div className="p-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                <TrendingDown className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="p-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 text-sm leading-relaxed text-foreground/90">
                            {bullet}
                          </div>

                          {isBullish && (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shrink-0 self-start">
                              Bullish
                            </Badge>
                          )}
                          {isBearish && (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-rose-400 border-rose-500/30 bg-rose-500/10 shrink-0 self-start">
                              Bearish
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* ================= 3. DETAILED ANALYSIS SECTIONS ================= */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Detailed Fundamental & Qualitative Dossier
                  </h3>
                </div>

                {/* Render All Sections with Zero Raw JSON and Sentiment Styling */}
                <div className="space-y-4">
                  {Object.entries(reportBody).map(([sectionKey, sectionContent]) => {
                    if (ignoredKeys.has(sectionKey) || sectionContent === null || sectionContent === undefined) {
                      return null;
                    }

                    const readableTitle = sectionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const isRiskSection =
                      sectionKey.toLowerCase().includes('risk') ||
                      sectionKey.toLowerCase().includes('bear') ||
                      sectionKey.toLowerCase().includes('red flag');

                    const isBullishSection =
                      sectionKey.toLowerCase().includes('moat') ||
                      sectionKey.toLowerCase().includes('catalyst') ||
                      sectionKey.toLowerCase().includes('tailwinds');

                    return (
                      <Card
                        key={sectionKey}
                        className={cn(
                          "shadow-sm transition-all duration-200 border",
                          isRiskSection
                            ? "bg-rose-950/15 border-rose-500/35"
                            : isBullishSection
                            ? "bg-card/50 border-emerald-500/25"
                            : "bg-card/40 border-border/60 hover:border-border"
                        )}
                      >
                        <CardHeader className={cn(
                          "pb-3 border-b flex flex-row items-center justify-between",
                          isRiskSection ? "border-rose-500/25" : isBullishSection ? "border-emerald-500/20" : "border-border/40"
                        )}>
                          <CardTitle className={cn(
                            "text-sm font-bold uppercase tracking-wider flex items-center gap-2",
                            isRiskSection ? "text-rose-300" : isBullishSection ? "text-emerald-300" : "text-foreground"
                          )}>
                            <div className={cn(
                              "p-1.5 rounded-lg border",
                              isRiskSection
                                ? "bg-rose-500/15 border-rose-500/30"
                                : isBullishSection
                                ? "bg-emerald-500/15 border-emerald-500/30"
                                : "bg-primary/10 border-primary/20"
                            )}>
                              {getSectionIcon(sectionKey)}
                            </div>
                            {readableTitle}
                          </CardTitle>

                          {isRiskSection && (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-rose-400 border-rose-500/40 bg-rose-500/10">
                              Downside Risk Area
                            </Badge>
                          )}
                          {isBullishSection && (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                              Growth Tailwind
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent className="pt-4">
                          {renderStructuredValue(sectionContent)}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
