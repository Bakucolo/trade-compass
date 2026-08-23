import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AutonomousReport,
  reportService,
  useAutonomousReports
} from '@/services/reportService';
import { useReportPrompts } from '@/services/promptService';
import { AutonomousReportViewerModal } from './AutonomousReportViewerModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  FileText,
  Download,
  Eye,
  Trash2,
  Loader2,
  Calendar,
  ShieldCheck,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AutonomousReportsListProps {
  symbol: string;
  className?: string;
  compact?: boolean;
}

export function AutonomousReportsList({
  symbol,
  className,
  compact = false
}: AutonomousReportsListProps) {
  const queryClient = useQueryClient();
  const cleanSymbol = symbol.trim().toUpperCase();

  const {
    data: reports = [],
    isLoading,
    isError,
    refetch
  } = useAutonomousReports(cleanSymbol);

  const { data: reportPrompts = [] } = useReportPrompts();
  const [selectedPromptSlug, setSelectedPromptSlug] = useState<string>('company_research');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');

  // Selected report for modal
  const [activeReport, setActiveReport] = useState<AutonomousReport | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const handleGenerate = async () => {
    if (!cleanSymbol || isGenerating) return;
    setIsGenerating(true);
    setGenerationStep('Deploying autonomous research agent...');

    try {
      const activeTemplate = reportPrompts.find(p => p.slug === selectedPromptSlug) || reportPrompts[0];
      const promptId = activeTemplate ? activeTemplate.id : undefined;

      const result = await reportService.generateReport(cleanSymbol, selectedPromptSlug, promptId);

      toast.success(`Autonomous report generated for ${cleanSymbol}!`);
      
      // Invalidate queries so lists update
      await queryClient.invalidateQueries({ queryKey: ['autonomousReports', cleanSymbol] });
      await queryClient.invalidateQueries({ queryKey: ['allAutonomousReports'] });

      // Automatically open the newly generated report
      if (result?.report) {
        setActiveReport(result.report);
        setIsViewerOpen(true);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate autonomous report. Check API keys in Settings.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleOpenReport = (report: AutonomousReport) => {
    setActiveReport(report);
    setIsViewerOpen(true);
  };

  const handleDeleteReport = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    if (!confirm(`Delete this research report?`)) return;

    try {
      await reportService.deleteReport(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['autonomousReports', cleanSymbol] });
      queryClient.invalidateQueries({ queryKey: ['allAutonomousReports'] });
      if (activeReport?.id === reportId) {
        setIsViewerOpen(false);
        setActiveReport(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete report');
    }
  };

  const handleDownloadPdf = (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    window.open(reportService.getPdfDownloadUrl(reportId), '_blank');
  };

  return (
    <div className={cn("space-y-4", className)}>
      
      {/* Top Generator Control Strip */}
      <Card className="bg-card/40 border-primary/20 backdrop-blur-md shadow-sm">
        <CardContent className={cn("p-4", compact ? "py-3" : "p-4")}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-foreground">
                  Autonomous AI Research for {cleanSymbol}
                </h4>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {reports.length} Saved
                </Badge>
              </div>
              {!compact && (
                <p className="text-xs text-muted-foreground">
                  Multi-agent fundamental analysis, SEC filing scanner, macro drivers, and moat evaluation.
                </p>
              )}
            </div>

            {/* Prompt Selector & Generate Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <select
                value={selectedPromptSlug}
                onChange={(e) => setSelectedPromptSlug(e.target.value)}
                disabled={isGenerating}
                className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer h-9 shrink-0 flex-1 sm:flex-none max-w-full sm:max-w-[200px]"
              >
                {reportPrompts.map((p) => (
                  <option key={p.id} value={p.slug} className="bg-popover text-popover-foreground">
                    {p.name}
                  </option>
                ))}
              </select>

              <Button
                variant="default"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating || !cleanSymbol}
                className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-md shrink-0 h-9 text-xs flex-1 sm:flex-none"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Generate Report</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Generating Progress Bar */}
          {isGenerating && (
            <div className="mt-3 pt-3 border-t border-border/40 space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-xs text-purple-300">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                  Running autonomous multi-step analyst agent...
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">Est. 15-25s</span>
              </div>
              <div className="w-full bg-accent/40 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-primary w-full animate-pulse" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading saved reports...</p>
        </div>
      ) : isError ? (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to load reports for {cleanSymbol}.</span>
        </div>
      ) : reports.length === 0 ? (
        <Card className="bg-card/20 border-dashed border-2 py-10">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">No Research Reports Yet</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Generate your first comprehensive Wall Street style equity research report for {cleanSymbol} above.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-1.5 text-xs h-8"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Generate First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const content = reportService.parseContentJson(report);
            const scorecard = content.scorecard || reportService.extractScorecard(content, report);
            const score = scorecard.convictionScore ?? report.convictionScore ?? 75;
            const scoreColor =
              score >= 70
                ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : score >= 40
                ? 'text-amber-400 border-amber-500/40 bg-amber-500/15 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                : 'text-rose-400 border-rose-500/40 bg-rose-500/15 shadow-[0_0_8px_rgba(244,63,94,0.2)]';

            const dateStr = new Date(report.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            // Extract first takeaway bullet
            let summarySnippet = '';
            if (Array.isArray(content.executive_summary) && content.executive_summary.length > 0) {
              summarySnippet = content.executive_summary[0];
            } else if (typeof content.executive_summary === 'string') {
              summarySnippet = content.executive_summary;
            } else if (report.summary) {
              try {
                const parsedSum = JSON.parse(report.summary);
                summarySnippet = Array.isArray(parsedSum) ? parsedSum[0] : report.summary;
              } catch {
                summarySnippet = report.summary;
              }
            }

            const ratingUpper = (scorecard.rating || '').toUpperCase();
            const isRatingBuy = ratingUpper.includes('BUY') || ratingUpper.includes('OUTPERFORM');
            const isRatingSell = ratingUpper.includes('SELL') || ratingUpper.includes('UNDERPERFORM');

            return (
              <Card
                key={report.id}
                onClick={() => handleOpenReport(report)}
                className="bg-card/50 hover:bg-card/80 border-border/70 hover:border-primary/40 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-indigo-600 opacity-60 group-hover:opacity-100 transition-opacity" />

                <CardContent className="p-4 pl-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    {/* Left: Info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                          {report.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                          {report.reportType.replace(/_/g, ' ')}
                        </Badge>
                        
                        {scorecard.rating && (
                          <Badge className={cn(
                            "text-[10px] font-black font-mono px-2 py-0 uppercase border",
                            isRatingBuy
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : isRatingSell
                              ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                              : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          )}>
                            {scorecard.rating}
                          </Badge>
                        )}

                        {scorecard.priceTarget && (
                          <span className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Target: {String(scorecard.priceTarget).startsWith('$') ? scorecard.priceTarget : `$${scorecard.priceTarget}`}
                          </span>
                        )}

                        <Badge className="bg-blue-950/60 text-blue-300 border border-blue-500/30 text-[9px] font-mono flex items-center gap-1">
                          <Bot className="w-2.5 h-2.5" />
                          Autonomous Deep Research Agent
                        </Badge>

                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {dateStr}
                        </span>
                      </div>

                      {summarySnippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {summarySnippet}
                        </p>
                      )}
                    </div>

                    {/* Right: Conviction Badge & Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <div className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold",
                        scoreColor
                      )}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{score}/100</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReport(report);
                        }}
                        className="h-8 px-2.5 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                        title="Read report in browser"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Read</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDownloadPdf(e, report.id)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        title="Download PDF report"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteReport(e, report.id)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Report Viewer Modal */}
      <AutonomousReportViewerModal
        report={activeReport}
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setActiveReport(null);
        }}
        onDeleteSuccess={(deletedId) => {
          queryClient.invalidateQueries({ queryKey: ['autonomousReports', cleanSymbol] });
          queryClient.invalidateQueries({ queryKey: ['allAutonomousReports'] });
        }}
      />

    </div>
  );
}
