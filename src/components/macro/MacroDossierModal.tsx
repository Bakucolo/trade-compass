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
import {
  MacroDossierReport,
  MacroPillar,
  MacroScenario,
  TacticalAllocationItem,
  CatalystRadarItem,
  useMacroDossiers,
  useGenerateMacroDossier,
  useDeleteMacroDossier,
  isDossierFromToday
} from '@/services/macroDossierService';
import {
  Globe,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Trash2,
  Building2,
  Landmark,
  Zap,
  DollarSign,
  Flame,
  Coins,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Compass,
  ArrowRight,
  Activity,
  Layers,
  History,
  ExternalLink,
  Info,
  Calendar,
  PieChart,
  BarChart3,
  Bot,
  Target,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MacroDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

export function MacroDossierModal({
  isOpen,
  onClose,
  onNavigateToResearch,
  onNavigateToGraphs,
}: MacroDossierModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeDossier, setActiveDossier] = useState<MacroDossierReport | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(false);

  const { data: dossiersHistory = [], refetch: refetchHistory, isLoading: isLoadingHistory } = useMacroDossiers(20);
  const generateMutation = useGenerateMacroDossier();
  const deleteMutation = useDeleteMacroDossier();

  // Find if today's dossier already exists in SQLite history
  const todayDossier = React.useMemo(() => {
    return dossiersHistory.find(d => isDossierFromToday(d.createdAt)) || null;
  }, [dossiersHistory]);

  const hasAttemptedAutoRunRef = React.useRef(false);

  // On open, check if today's dossier exists. If it exists, load it immediately with 0 compute.
  // If NO dossier exists for today, automatically trigger generation ONCE for today.
  useEffect(() => {
    if (isOpen) {
      if (!isLoadingHistory) {
        if (todayDossier) {
          // Today's dossier already exists: load it immediately with 0 AI compute!
          if (!activeDossier || activeDossier.id !== todayDossier.id) {
            setActiveDossier(todayDossier);
          }
        } else if (!hasAttemptedAutoRunRef.current && !generateMutation.isPending) {
          // No dossier exists for today yet: run AI thinking ONCE and save for the day
          hasAttemptedAutoRunRef.current = true;
          handleGenerateDossier(false);
        } else if (!activeDossier && dossiersHistory.length > 0) {
          setActiveDossier(dossiersHistory[0]);
        }
      }
    } else {
      hasAttemptedAutoRunRef.current = false;
      setShowForceConfirm(false);
    }
  }, [isOpen, isLoadingHistory, todayDossier?.id, dossiersHistory.length]);

  const handleGenerateDossier = async (force = false) => {
    try {
      const res = await generateMutation.mutateAsync({
        force,
        clientDate: new Date().toISOString()
      });
      setActiveDossier(res.dossier);
      setActiveTab('overview');
      if (res.cachedDaily) {
        toast.info("Loaded today's saved dossier (0 AI compute consumed)");
      } else {
        toast.success("Global Macro Intelligence Dossier synthesized & saved for today!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate macro dossier');
    }
  };

  const handleDeleteDossier = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Macro dossier removed');
      if (activeDossier?.id === id) {
        const remaining = dossiersHistory.filter(d => d.id !== id);
        setActiveDossier(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete macro dossier');
    }
  };

  const handleCopyMarkdown = async () => {
    if (!activeDossier) return;
    try {
      const takeaways = (activeDossier.keyTakeaways || []).map(t => `- ${t}`).join('\n');
      const pillars = (activeDossier.pillars || []).map(p => `### ${p.name} [${p.status}]\n${p.summary}\n**Strategic Implication:** ${p.strategicImplications}\n`).join('\n');
      const scenarios = (activeDossier.scenarios || []).map(s => `### ${s.title} (${s.probabilityPercent}%)\n${s.description}\n- **Winners:** ${s.winners.join(', ')}\n- **Losers:** ${s.losers.join(', ')}\n- **Action:** ${s.strategicAction}\n`).join('\n');
      const allocations = (activeDossier.tacticalAllocations || []).map(a => `- **${a.category} - ${a.subAsset}**: ${a.stance} (Vehicles: ${a.recommendedVehicles.join(', ')}) -> ${a.rationale}`).join('\n');

      const markdown = `# ${activeDossier.title}
**Regime:** ${activeDossier.regimeTitle} | **Macro Stability Score:** ${activeDossier.macroScore}/100 | **Tone:** ${activeDossier.regimeTone.toUpperCase()}
**Date:** ${activeDossier.createdAt ? new Date(activeDossier.createdAt).toLocaleDateString() : 'Live'}

## Executive Summary
${activeDossier.executiveSummary}

## Key Takeaways
${takeaways}

## Macro Narrative Overview
${activeDossier.narrativeOverview}

## 7 Core Macro Pillars
${pillars}

## Probabilistic Scenarios
${scenarios}

## Tactical Asset Allocation Matrix
${allocations}
`;

      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast.success('Markdown dossier copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400 border-emerald-500/50 bg-emerald-950/30';
    if (score >= 60) return 'text-cyan-400 border-cyan-500/50 bg-cyan-950/30';
    if (score >= 45) return 'text-amber-400 border-amber-500/50 bg-amber-950/30';
    return 'text-rose-400 border-rose-500/50 bg-rose-950/30';
  };

  const getStanceBadge = (stance: string) => {
    switch (stance) {
      case 'OVERWEIGHT':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'NEUTRAL':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'UNDERWEIGHT':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'TACTICAL_HEDGE':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-card text-foreground border-border';
    }
  };

  const getPillarStatusBadge = (status: string) => {
    switch (status) {
      case 'BENIGN':
      case 'STIMULATIVE':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'CAUTION':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'SEVERE':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "bg-slate-950/95 border border-slate-800 text-foreground transition-all duration-300 flex flex-col p-0 overflow-hidden shadow-2xl backdrop-blur-2xl",
          isFullScreen
            ? "fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none z-[100]"
            : "sm:max-w-[1250px] w-[95vw] h-[90vh] rounded-2xl"
        )}
      >
        {/* ================= HEADER ================= */}
        <div className="p-4 sm:p-5 border-b border-border/40 bg-gradient-to-r from-card/80 via-slate-900/60 to-purple-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/30 via-cyan-500/20 to-purple-500/30 border border-primary/40 flex items-center justify-center text-primary shadow-inner">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                  Global Macro Intelligence Dossier
                </DialogTitle>
                {activeDossier && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold tracking-wider uppercase border",
                      activeDossier.regimeTone === 'bullish' ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" :
                      activeDossier.regimeTone === 'bearish' ? "bg-rose-500/15 text-rose-300 border-rose-500/40" :
                      activeDossier.regimeTone === 'warning' ? "bg-amber-500/15 text-amber-300 border-amber-500/40" :
                      "bg-primary/15 text-primary border-primary/40"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                    {activeDossier.regimeTitle}
                  </Badge>
                )}
                {isDossierFromToday(activeDossier?.createdAt) ? (
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] gap-1 py-0.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Today's Saved Dossier (0 Compute)</span>
                  </Badge>
                ) : activeDossier?.createdAt ? (
                  <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] gap-1 py-0.5">
                    <History className="w-3 h-3 text-slate-400" />
                    <span>Archive ({new Date(activeDossier.createdAt).toLocaleDateString()})</span>
                  </Badge>
                ) : null}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                <span>Autonomous Cross-Asset Macroeconomic Assessment & Playbook</span>
                {activeDossier?.createdAt && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    • {new Date(activeDossier.createdAt).toLocaleDateString()} {new Date(activeDossier.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* History Selector Dropdown / Pills if multiple dossiers */}
            {dossiersHistory.length > 1 && (
              <select
                value={activeDossier?.id || ''}
                onChange={(e) => {
                  const target = dossiersHistory.find(d => d.id === e.target.value);
                  if (target) setActiveDossier(target);
                }}
                className="h-8 text-xs bg-slate-900 border border-slate-700/60 rounded-xl px-2 text-muted-foreground focus:outline-none focus:border-primary"
              >
                {dossiersHistory.map((d, idx) => {
                  const isToday = isDossierFromToday(d.createdAt);
                  return (
                    <option key={d.id} value={d.id}>
                      {isToday ? '🟢 [Saved Today] ' : idx === 0 ? 'Latest: ' : ''}
                      {d.regimeTitle} ({d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Dossier'})
                    </option>
                  );
                })}
              </select>
            )}

            {/* Run Agent / Refresh Button with allowance guard */}
            <Button
              size="sm"
              onClick={() => {
                if (todayDossier) {
                  setShowForceConfirm(true);
                } else {
                  handleGenerateDossier(false);
                }
              }}
              disabled={generateMutation.isPending}
              className={cn(
                "h-8 text-xs font-bold gap-1.5 shadow-md rounded-xl transition-all",
                todayDossier
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  : "bg-gradient-to-r from-primary via-cyan-600 to-purple-600 hover:opacity-90 text-white"
              )}
              title={todayDossier ? "Today's dossier is already saved. Click to force re-run." : "Synthesize Today's Macro Dossier"}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", generateMutation.isPending && "animate-spin")} />
              <span>
                {generateMutation.isPending
                  ? 'Synthesizing...'
                  : todayDossier
                  ? 'Re-run (Uses Compute)'
                  : 'Run Macro Agent'}
              </span>
            </Button>

            {/* Copy Markdown */}
            {activeDossier && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMarkdown}
                className="h-8 text-xs font-semibold gap-1.5 border-border/60 hover:bg-accent/40 rounded-xl"
                title="Copy Markdown Dossier"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            )}

            {/* Delete Dossier */}
            {activeDossier?.id && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDeleteDossier(activeDossier.id!, e)}
                disabled={deleteMutation.isPending}
                className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-950/20 rounded-xl"
                title="Delete Dossier Report"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Daily Save Status Notification Strip */}
        {activeDossier && (
          <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-6 py-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-2">
              {isDossierFromToday(activeDossier.createdAt) ? (
                <>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-300 font-semibold">Daily Intelligence Active:</span>
                  <span>
                    Saved today at {new Date(activeDossier.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                    0 compute allowance used on re-opening.
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                  <span className="text-slate-400">Historical Archive:</span>
                  <span>Viewing saved report from {new Date(activeDossier.createdAt).toLocaleDateString()}.</span>
                </>
              )}
            </div>
            {isDossierFromToday(activeDossier.createdAt) && (
              <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400/90 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                0 Compute Spent
              </span>
            )}
          </div>
        )}

        {/* ================= TELEMETRY EXECUTIVE STRIP ================= */}
        {activeDossier && (
          <div className="bg-slate-900/60 border-b border-border/40 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto scrollbar-none shrink-0 text-xs">
            {/* Macro Health Score */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground font-semibold">Macro Stability Score:</span>
              <div className={cn("px-2 py-0.5 rounded-lg border font-mono font-black text-xs flex items-center gap-1", getScoreColor(activeDossier.macroScore))}>
                <Compass className="w-3 h-3" />
                <span>{activeDossier.macroScore}/100</span>
              </div>
            </div>

            {/* Snapshot Chips */}
            <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>VIX:</span>
                <span className="font-bold text-foreground">{activeDossier.vixLevel?.toFixed(2) || '15.42'}</span>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <Landmark className="w-3 h-3 text-cyan-400" />
                <span>10Y Yield:</span>
                <span className="font-bold text-cyan-300">{activeDossier.yield10y?.toFixed(2) || '4.38'}%</span>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <Scale className="w-3 h-3 text-purple-400" />
                <span>2s10s Curve:</span>
                <span className={cn("font-bold", (activeDossier.spread2y10y || 0) < 0 ? "text-rose-400" : "text-emerald-400")}>
                  {(activeDossier.spread2y10y || 0) >= 0 ? '+' : ''}{(activeDossier.spread2y10y || 0).toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span>DXY:</span>
                <span className="font-bold text-foreground">{activeDossier.dxyLevel?.toFixed(2) || '103.80'}</span>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <Flame className="w-3 h-3 text-rose-400" />
                <span>WTI Oil:</span>
                <span className="font-bold text-rose-300">${activeDossier.oilPrice?.toFixed(2) || '71.40'}</span>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="w-3 h-3 text-blue-400" />
                <span>HY Spread:</span>
                <span className="font-bold text-emerald-300">+{activeDossier.highYieldSpread?.toFixed(2) || '3.12'}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= BODY CONTENT WITH TABS ================= */}
        {generateMutation.isPending ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-primary/20 border border-primary/40 flex items-center justify-center animate-pulse">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Synthesizing Global Macro Intelligence Dossier
              </h3>
              <p className="text-xs text-muted-foreground max-w-md">
                In-depth processing of Federal Reserve FRED telemetry, sovereign yield curves, credit spreads, foreign exchange, commodities, and cross-asset tactical allocation...
              </p>
            </div>
          </div>
        ) : !activeDossier ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
            <Globe className="w-12 h-12 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">No Macro Dossier Available</h3>
              <p className="text-xs text-muted-foreground">
                Click below to deploy the Global Macro Dossier Agent and synthesize the macro backdrop.
              </p>
            </div>
            <Button
              onClick={handleGenerateDossier}
              className="text-xs font-bold gap-1.5 bg-primary text-primary-foreground rounded-xl"
            >
              <Sparkles className="w-3.5 h-3.5" /> Generate First Dossier
            </Button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              {/* Tabs Navigation Strip */}
              <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-border/40 bg-card/20 shrink-0">
                <TabsList className="bg-slate-900/80 border border-slate-800 p-1 rounded-xl h-auto flex flex-wrap gap-1">
                  <TabsTrigger value="overview" className="text-xs font-bold gap-1.5 py-1.5 px-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Executive Summary & Narrative</span>
                  </TabsTrigger>
                  <TabsTrigger value="pillars" className="text-xs font-bold gap-1.5 py-1.5 px-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Layers className="w-3.5 h-3.5" />
                    <span>7 Core Macro Pillars</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-muted-foreground data-[state=active]:bg-black/30 data-[state=active]:text-white">
                      {activeDossier.pillars?.length || 7}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="scenarios" className="text-xs font-bold gap-1.5 py-1.5 px-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Probabilistic Scenarios</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-muted-foreground data-[state=active]:bg-black/30 data-[state=active]:text-white">
                      {activeDossier.scenarios?.length || 3}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="allocations" className="text-xs font-bold gap-1.5 py-1.5 px-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <PieChart className="w-3.5 h-3.5" />
                    <span>Tactical Allocations & Hedging</span>
                  </TabsTrigger>
                  <TabsTrigger value="catalysts" className="text-xs font-bold gap-1.5 py-1.5 px-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Target className="w-3.5 h-3.5" />
                    <span>Catalyst Radar</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Scrollable Tab Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                
                {/* ================= TAB 1: EXECUTIVE SUMMARY & NARRATIVE ================= */}
                <TabsContent value="overview" className="mt-0 space-y-6 animate-fade-in">
                  
                  {/* Executive Summary Card */}
                  <Card className="bg-card/70 border border-border/60 shadow-md rounded-2xl overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <CardTitle className="text-sm font-bold text-foreground">
                          Institutional Executive Synthesis
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                        CRO / PM Briefing
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal whitespace-pre-line">
                        {activeDossier.executiveSummary}
                      </p>

                      {/* Key Takeaways Bullets */}
                      {activeDossier.keyTakeaways && activeDossier.keyTakeaways.length > 0 && (
                        <div className="pt-3 border-t border-border/40 space-y-2">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Key Strategic Takeaways
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {activeDossier.keyTakeaways.map((takeaway, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-slate-900/70 border border-border/40 flex items-start gap-2.5 text-xs text-foreground/90"
                              >
                                <span className="w-5 h-5 rounded-lg bg-primary/20 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">
                                  {idx + 1}
                                </span>
                                <span className="leading-snug">{takeaway}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Comprehensive Macro Narrative Card */}
                  <Card className="bg-card/70 border border-border/60 shadow-md rounded-2xl overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <CardTitle className="text-sm font-bold text-foreground">
                          The Macro Environment Narrative
                        </CardTitle>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Deep-Dive Economic Cycle Analysis</span>
                    </CardHeader>
                    <CardContent className="p-5">
                      <div className="prose prose-invert max-w-none text-xs sm:text-sm text-foreground/85 leading-relaxed space-y-4 font-normal whitespace-pre-line">
                        {activeDossier.narrativeOverview}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Macro Quadrant Status Barometer */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex flex-col justify-between gap-1 shadow-sm">
                      <span className="text-[10px] text-muted-foreground font-semibold">Growth Outlook</span>
                      <span className="text-xs font-black font-mono text-cyan-300">
                        {activeDossier.growthOutlook || 'MODERATING'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex flex-col justify-between gap-1 shadow-sm">
                      <span className="text-[10px] text-muted-foreground font-semibold">Inflation Regime</span>
                      <span className="text-xs font-black font-mono text-emerald-300">
                        {activeDossier.inflationRegime || 'DISINFLATION'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex flex-col justify-between gap-1 shadow-sm">
                      <span className="text-[10px] text-muted-foreground font-semibold">Monetary Policy</span>
                      <span className="text-xs font-black font-mono text-purple-300">
                        {activeDossier.monetaryPolicyPosture || 'DOVISH_EASING'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex flex-col justify-between gap-1 shadow-sm">
                      <span className="text-[10px] text-muted-foreground font-semibold">Liquidity Condition</span>
                      <span className="text-xs font-black font-mono text-amber-300">
                        {activeDossier.liquidityCondition || 'NEUTRAL'}
                      </span>
                    </div>
                  </div>
                </TabsContent>

                {/* ================= TAB 2: 7 MACRO PILLARS ================= */}
                <TabsContent value="pillars" className="mt-0 space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeDossier.pillars?.map((pillar) => (
                      <Card
                        key={pillar.id}
                        className="bg-card/70 border border-border/60 hover:border-primary/40 transition-all rounded-2xl shadow-md overflow-hidden flex flex-col justify-between"
                      >
                        <CardHeader className="p-4 pb-2 border-b border-border/30 bg-accent/5 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
                              {pillar.id === 'monetary_policy' ? '🏛️' :
                               pillar.id === 'yield_curve' ? '📈' :
                               pillar.id === 'inflation_labor' ? '🛒' :
                               pillar.id === 'liquidity_fx' ? '💵' :
                               pillar.id === 'commodities_geopolitics' ? '🛢️' :
                               pillar.id === 'credit_corporate' ? '💳' : '⚡'}
                            </div>
                            <CardTitle className="text-xs font-bold text-foreground">
                              {pillar.name}
                            </CardTitle>
                          </div>
                          <Badge variant="outline" className={cn("text-[9px] font-bold uppercase border", getPillarStatusBadge(pillar.status))}>
                            {pillar.status}
                          </Badge>
                        </CardHeader>

                        <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <p className="text-xs text-foreground/85 leading-relaxed">
                            {pillar.summary}
                          </p>

                          {/* Pillar Metrics Table */}
                          {pillar.keyMetrics && pillar.keyMetrics.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-border/30">
                              {pillar.keyMetrics.map((km, idx) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded-xl bg-slate-900/60 border border-border/30 flex items-center justify-between text-[11px]"
                                >
                                  <span className="text-muted-foreground font-medium">{km.label}</span>
                                  <div className="flex items-center gap-2 font-mono">
                                    <span className="font-bold text-foreground">{km.value}</span>
                                    {km.interpretation && (
                                      <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                        ({km.interpretation})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Strategic Implication Callout */}
                          {pillar.strategicImplications && (
                            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs flex items-start gap-2 text-primary/90 mt-2">
                              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block text-[10.5px] uppercase tracking-wider text-primary">Strategic Implication</span>
                                <span className="text-[11px] leading-snug">{pillar.strategicImplications}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* ================= TAB 3: PROBABILISTIC SCENARIOS ================= */}
                <TabsContent value="scenarios" className="mt-0 space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {activeDossier.scenarios?.map((scenario) => {
                      const isBase = scenario.id === 'base_case';
                      const isBull = scenario.id === 'bull_reflation';
                      const isBear = scenario.id === 'bear_shock';

                      return (
                        <Card
                          key={scenario.id}
                          className={cn(
                            "bg-card/70 border rounded-2xl shadow-lg overflow-hidden flex flex-col justify-between backdrop-blur-xl transition-all",
                            isBase ? "border-cyan-500/40 ring-1 ring-cyan-500/20" :
                            isBull ? "border-emerald-500/40" : "border-rose-500/40"
                          )}
                        >
                          <CardHeader className="p-4 pb-3 border-b border-border/40 bg-accent/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-bold border uppercase",
                                  isBase ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" :
                                  isBull ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                                  "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                )}
                              >
                                {isBase ? '🎯 Base Case' : isBull ? '🚀 Bull Reflation' : '⚠️ Bear Shock'}
                              </Badge>
                              <span className="text-sm font-black font-mono text-foreground">
                                {scenario.probabilityPercent}% Probability
                              </span>
                            </div>

                            {/* Probability Progress Bar */}
                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${scenario.probabilityPercent}%` }}
                                className={cn(
                                  "h-full rounded-full",
                                  isBase ? "bg-cyan-400" : isBull ? "bg-emerald-400" : "bg-rose-400"
                                )}
                              />
                            </div>

                            <CardTitle className="text-sm font-bold text-foreground pt-1">
                              {scenario.title}
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="p-4 space-y-4 text-xs flex-1 flex flex-col justify-between">
                            <p className="text-foreground/85 leading-relaxed">
                              {scenario.description}
                            </p>

                            {/* Key Triggers */}
                            {scenario.keyTriggers && scenario.keyTriggers.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Catalysts / Triggers
                                </span>
                                <ul className="space-y-1">
                                  {scenario.keyTriggers.map((t, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5 text-muted-foreground text-[11px]">
                                      <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Winners & Losers */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                              <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" /> Outperforming
                                </span>
                                <div className="text-[11px] font-mono text-emerald-200/90 leading-tight">
                                  {scenario.winners?.join(', ')}
                                </div>
                              </div>

                              <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1">
                                <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                                  <TrendingDown className="w-3 h-3" /> Vulnerable
                                </span>
                                <div className="text-[11px] font-mono text-rose-200/90 leading-tight">
                                  {scenario.losers?.join(', ')}
                                </div>
                              </div>
                            </div>

                            {/* Strategic Action */}
                            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-border/40 space-y-1">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Tactical Playbook Execution
                              </span>
                              <p className="text-[11px] font-medium text-foreground">
                                {scenario.strategicAction}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* ================= TAB 4: TACTICAL ALLOCATIONS & HEDGING ================= */}
                <TabsContent value="allocations" className="mt-0 space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 gap-3">
                    {activeDossier.tacticalAllocations?.map((item, idx) => (
                      <Card
                        key={idx}
                        className="bg-card/70 border border-border/60 hover:border-primary/40 transition-all rounded-2xl shadow-sm p-4 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[9px] border-white/10 text-muted-foreground uppercase">
                              {item.category}
                            </Badge>
                            <h4 className="text-xs font-bold text-foreground">
                              {item.subAsset}
                            </h4>
                            <Badge variant="outline" className={cn("text-[9.5px] font-bold uppercase border", getStanceBadge(item.stance))}>
                              {item.stance.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                            {item.rationale}
                          </p>
                        </div>

                        {/* Recommended Vehicles & Actions */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {item.recommendedVehicles?.map((veh) => (
                            <Button
                              key={veh}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const cleanSym = veh.split(' ')[0].replace(/[^a-zA-Z0-9^=]/g, '');
                                if (onNavigateToResearch && cleanSym) onNavigateToResearch(cleanSym);
                              }}
                              className="h-7 text-xs font-mono font-semibold gap-1 bg-slate-900/80 border-slate-700 hover:border-primary/50 hover:bg-primary/10 rounded-xl"
                            >
                              <span>{veh}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                            </Button>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* ================= TAB 5: CATALYST RADAR ================= */}
                <TabsContent value="catalysts" className="mt-0 space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeDossier.catalystsRadar?.map((catalyst) => (
                      <Card
                        key={catalyst.id}
                        className="bg-card/70 border border-border/60 rounded-2xl shadow-md overflow-hidden p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-purple-400" />
                            <h4 className="text-xs font-bold text-foreground">
                              {catalyst.title}
                            </h4>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-bold uppercase border",
                              catalyst.potentialImpact === 'CRITICAL' ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
                              catalyst.potentialImpact === 'HIGH' ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                              "bg-primary/20 text-primary border-primary/40"
                            )}
                          >
                            {catalyst.potentialImpact} IMPACT
                          </Badge>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Calendar className="w-3 h-3 text-cyan-400" />
                            <span>Timeframe: <strong className="text-foreground">{catalyst.timeframe}</strong></span>
                          </div>

                          <p className="text-muted-foreground leading-relaxed">
                            {catalyst.whatToWatch}
                          </p>

                          {catalyst.criticalPivotLevel && (
                            <div className="p-2 rounded-xl bg-slate-900 border border-border/40 text-[11px] text-cyan-300 font-mono">
                              <strong>Key Pivot Threshold:</strong> {catalyst.criticalPivotLevel}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

              </div>
            </Tabs>
          </div>
        )}

        {/* Force Re-run Allowance Confirmation Overlay */}
        {showForceConfirm && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="bg-slate-900 border border-slate-700 max-w-md w-full shadow-2xl p-6 rounded-2xl">
              <div className="flex items-center gap-3 text-amber-400 mb-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Re-run Today's AI Macro Dossier?
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Allowance compute protection</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed my-3">
                Today's macro intelligence dossier was already synthesized and saved in the database.
                <br /><br />
                Re-running will query AI models again and <strong className="text-rose-400">consume your compute allowance</strong>.
                <br /><br />
                Are you sure you want to regenerate today's report?
              </p>
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForceConfirm(false)}
                  className="text-xs rounded-xl border-slate-700 hover:bg-slate-800"
                >
                  Cancel (Save Allowance)
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowForceConfirm(false);
                    handleGenerateDossier(true);
                  }}
                  className="text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Yes, Re-run (Use Allowance)
                </Button>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
