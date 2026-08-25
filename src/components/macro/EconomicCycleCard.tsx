import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Compass,
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Layers,
  ArrowRight,
  Landmark,
  Zap,
  Activity,
  DollarSign,
  PieChart,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  Flame,
  Globe,
  Coins,
  Building2,
  BarChart3,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EconomicCycleDiagnosis,
  CycleStage,
  useEconomicCycle,
  useGenerateMacroStockPicks,
  MacroStockAgentResponse,
} from '@/services/economicCycleService';
import { MacroStockAgentModal } from './MacroStockAgentModal';
import { toast } from 'sonner';

interface EconomicCycleCardProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

const CYCLE_PHASES: {
  id: CycleStage;
  name: string;
  shortDesc: string;
  typicalWinners: string;
  typicalLosers: string;
}[] = [
  {
    id: 'EARLY_CYCLE',
    name: '1. Early Cycle (Recovery)',
    shortDesc: 'Monetary easing, credit rebound, bottoming earnings.',
    typicalWinners: 'High-Beta, Small-Caps, Discretionary, Financials',
    typicalLosers: 'Cash, Defensive Utilities, Long Treasuries',
  },
  {
    id: 'MID_CYCLE',
    name: '2. Mid Cycle (Expansion)',
    shortDesc: 'Peak GDP growth, broad industrial & AI capex, healthy balance sheets.',
    typicalWinners: 'Tech Hardware, Industrials, Semiconductors',
    typicalLosers: 'Defensive Staples, Precious Metals',
  },
  {
    id: 'LATE_CYCLE',
    name: '3. Late Cycle (Moderation)',
    shortDesc: 'Restrictive interest rates, tight labor, margin compression & un-inversion.',
    typicalWinners: 'Power Utilities, Energy, Healthcare, High-FCF Quality, Cash',
    typicalLosers: 'Unprofitable Tech, Indebted Small Caps, CRE REITs',
  },
  {
    id: 'RECESSION',
    name: '4. Recession (Contraction)',
    shortDesc: 'Negative GDP growth, credit spread blowout, earnings downgrades.',
    typicalWinners: 'Long Treasuries (TLT), Cash, Gold, Consumer Staples',
    typicalLosers: 'Cyclical Equities, High-Yield Debt, Real Estate',
  },
];

export function EconomicCycleCard({
  onNavigateToResearch,
  onNavigateToGraphs,
}: EconomicCycleCardProps) {
  const { data: cycle, isLoading, refetch, isFetching } = useEconomicCycle();
  const stockAgentMutation = useGenerateMacroStockPicks();

  const [activeTab, setActiveTab] = useState<'assets' | 'sectors' | 'industries'>('assets');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockAgentResult, setStockAgentResult] = useState<MacroStockAgentResponse | null>(null);

  // Trigger Macro Stock Selection Agent
  const handleSummonStockAgent = async () => {
    try {
      const data = await stockAgentMutation.mutateAsync(undefined);
      setStockAgentResult(data);
      setIsStockModalOpen(true);
    } catch (err: any) {
      toast.error(`Failed to summon Macro Stock Agent: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-3xl p-8 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-foreground">
            Diagnosing Real-Time Macro Variables & Economic Cycle Stage...
          </p>
          <p className="text-xs text-muted-foreground">
            Synthesizing yield curve spreads, inflation trends, labor market health, and sector rotation metrics.
          </p>
        </div>
      </Card>
    );
  }

  if (!cycle) return null;

  const isLateCycle = cycle.stage === 'LATE_CYCLE' || cycle.stage === 'STAGFLATION';
  const isMidCycle = cycle.stage === 'MID_CYCLE';
  const isEarlyCycle = cycle.stage === 'EARLY_CYCLE';
  const isRecession = cycle.stage === 'RECESSION';

  return (
    <Card className="relative overflow-hidden bg-card/80 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-3xl">
      {/* Ambient gradient glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 -mb-10 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <CardHeader className="p-6 pb-4 border-b border-border/50 bg-accent/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/20 to-purple-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black shadow-lg">
              <Compass className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl font-black tracking-tight text-foreground glow-text-white">
                  Economic Cycle Stage & Macro Regime
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-3 py-0.5 font-bold uppercase tracking-wider border font-mono shadow-sm",
                    cycle.regimeTone === 'bullish' ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" :
                    cycle.regimeTone === 'warning' ? "bg-amber-500/15 text-amber-300 border-amber-500/40" :
                    "bg-rose-500/15 text-rose-300 border-rose-500/40"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-current mr-1.5 animate-pulse inline-block" />
                  {cycle.stageName} ({cycle.confidenceScore}% Confidence)
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cycle.stageSubtitle}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 px-3 text-xs gap-1.5 font-semibold"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-primary")} />
              <span>Re-Analyze</span>
            </Button>

            <Button
              onClick={handleSummonStockAgent}
              disabled={stockAgentMutation.isPending}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-primary to-purple-600 hover:opacity-95 text-white font-bold text-xs gap-2 shadow-lg shadow-amber-500/20 border border-white/10"
            >
              {stockAgentMutation.isPending ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Screening Universe...</>
              ) : (
                <><Sparkles className="w-4 h-4 text-amber-300 animate-pulse" /> Summon Macro Stock Agent</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        
        {/* ================= 1. THE 4-STAGE ECONOMIC CYCLE PROGRESS WHEEL ================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground uppercase tracking-wider text-[11px]">
              Active Economic Cycle Quadrant
            </span>
            <span className="text-primary font-mono font-bold">
              Current Focus: {cycle.stageName}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CYCLE_PHASES.map((phase) => {
              const isActive =
                (phase.id === 'LATE_CYCLE' && (cycle.stage === 'LATE_CYCLE' || cycle.stage === 'STAGFLATION')) ||
                phase.id === cycle.stage;

              return (
                <div
                  key={phase.id}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all duration-300 relative space-y-2",
                    isActive
                      ? "bg-gradient-to-br from-amber-500/15 via-primary/10 to-card border-amber-500/50 shadow-lg ring-1 ring-amber-500/30"
                      : "bg-card/40 border-border/50 opacity-60 hover:opacity-85"
                  )}
                >
                  {isActive && (
                    <div className="absolute top-2.5 right-2.5">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs font-black", isActive ? "text-amber-300" : "text-foreground")}>
                      {phase.name}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {phase.shortDesc}
                  </p>

                  <div className="pt-1.5 border-t border-border/40 space-y-1 text-[10px] font-mono">
                    <div className="truncate">
                      <strong className="text-emerald-400 font-sans">Benefiting:</strong> {phase.typicalWinners}
                    </div>
                    <div className="truncate text-muted-foreground">
                      <strong className="text-rose-400 font-sans">Lagging:</strong> {phase.typicalLosers}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= 2. EXECUTIVE MACRO THESIS ================= */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-border/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Info className="w-4 h-4 text-amber-400" />
            <span>Macro Regime Diagnostic Summary</span>
          </div>
          <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-sans">
            {cycle.executiveSummary}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/30">
            <strong className="text-primary">Tactical Allocation Rule:</strong> {cycle.macroThesis}
          </p>
        </div>

        {/* ================= 3. MACRO TELEMETRY SIGNALS ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono">
          {cycle.signals.map((sig) => (
            <div key={sig.id} className="p-2.5 rounded-xl bg-card/60 border border-border/40 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-sans">
                <span className="truncate">{sig.name}</span>
              </div>
              <div className="text-sm font-black text-foreground">
                {sig.formattedValue}
              </div>
              <div className="text-[9.5px] text-muted-foreground truncate" title={sig.cycleImplication}>
                {sig.cycleImplication}
              </div>
            </div>
          ))}
        </div>

        {/* ================= 4. DEEP-DIVE PLAYBOOKS (ASSETS, SECTORS, INDUSTRIES) ================= */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                Regime Impact Playbooks: Benefiting vs Losing Exposures
              </span>
            </div>

            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-auto">
              <TabsList className="bg-card border border-border/60 h-8 p-1 rounded-xl">
                <TabsTrigger value="assets" className="text-xs font-bold px-3 h-6 rounded-lg">
                  <Coins className="w-3 h-3 mr-1" /> Asset Classes
                </TabsTrigger>
                <TabsTrigger value="sectors" className="text-xs font-bold px-3 h-6 rounded-lg">
                  <PieChart className="w-3 h-3 mr-1" /> Sectors
                </TabsTrigger>
                <TabsTrigger value="industries" className="text-xs font-bold px-3 h-6 rounded-lg">
                  <Building2 className="w-3 h-3 mr-1" /> Sub-Industries
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* TAB 1: ASSET CLASSES */}
          {activeTab === 'assets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              {/* Benefiting Assets */}
              <div className="space-y-3 p-4 rounded-2xl bg-emerald-950/10 border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Assets That Benefit (Overweight)
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-mono">
                    {cycle.assets.benefiting.length} Classes
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {cycle.assets.benefiting.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-card/60 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {item.name}
                        </span>
                        <Badge variant="outline" className="text-[9.5px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold">
                          {item.stance}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground/80 leading-snug">
                        {item.expectedBehavior}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        <strong className="text-foreground/70">Rationale:</strong> {item.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losing Assets */}
              <div className="space-y-3 p-4 rounded-2xl bg-rose-950/10 border border-rose-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" /> Assets That Lose (Underweight)
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-300 border-rose-500/40 font-mono">
                    {cycle.assets.losing.length} Classes
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {cycle.assets.losing.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-card/60 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {item.name}
                        </span>
                        <Badge variant="outline" className="text-[9.5px] font-mono bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold">
                          {item.stance}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground/80 leading-snug">
                        {item.expectedBehavior}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        <strong className="text-foreground/70">Rationale:</strong> {item.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SECTORS PLAYBOOK */}
          {activeTab === 'sectors' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              {/* Benefiting Sectors */}
              <div className="space-y-3 p-4 rounded-2xl bg-emerald-950/10 border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Benefiting Sectors (Outperforming)
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-mono">
                    {cycle.sectors.benefiting.length} Sectors
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {cycle.sectors.benefiting.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-card/60 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono font-bold text-xs bg-slate-900 border-border/60">
                            {item.symbol}
                          </Badge>
                          <span className="text-xs font-bold text-foreground">
                            {item.sector}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[9.5px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold">
                          {item.stance}
                        </Badge>
                      </div>

                      <p className="text-xs text-foreground/90 font-medium leading-snug">
                        {item.catalyst}
                      </p>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.topIndustries.map((ind, i) => (
                          <span key={i} className="text-[9.5px] px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground border border-border/30">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losing Sectors */}
              <div className="space-y-3 p-4 rounded-2xl bg-rose-950/10 border border-rose-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" /> Losing Sectors (Underperforming)
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-300 border-rose-500/40 font-mono">
                    {cycle.sectors.losing.length} Sectors
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {cycle.sectors.losing.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-card/60 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono font-bold text-xs bg-slate-900 border-border/60">
                            {item.symbol}
                          </Badge>
                          <span className="text-xs font-bold text-foreground">
                            {item.sector}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[9.5px] font-mono bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold">
                          {item.stance}
                        </Badge>
                      </div>

                      <p className="text-xs text-foreground/90 font-medium leading-snug">
                        {item.catalyst}
                      </p>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.topIndustries.map((ind, i) => (
                          <span key={i} className="text-[9.5px] px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground border border-border/30">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SUB-INDUSTRIES & SPECIFIC THEMES */}
          {activeTab === 'industries' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              {/* Benefiting Industries */}
              <div className="space-y-3 p-4 rounded-2xl bg-emerald-950/10 border border-emerald-500/30">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Niche Industries Benefiting
                </span>

                <div className="space-y-2.5">
                  {cycle.industries.benefiting.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-card/60 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-foreground">
                          {item.industry}
                        </span>
                        <Badge variant="secondary" className="text-[9px] font-semibold">
                          {item.sector}
                        </Badge>
                      </div>

                      <p className="text-xs text-foreground/90 leading-snug">
                        {item.tailwindsOrHeadwinds}
                      </p>

                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground font-sans">Tickers:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.representativeTickers.map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              onClick={() => onNavigateToResearch?.(t)}
                              className="text-[9.5px] font-mono font-bold bg-primary/10 text-primary border-primary/30 cursor-pointer hover:bg-primary/20"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losing Industries */}
              <div className="space-y-3 p-4 rounded-2xl bg-rose-950/10 border border-rose-500/30">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Niche Industries Losing
                </span>

                <div className="space-y-2.5">
                  {cycle.industries.losing.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-card/60 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-foreground">
                          {item.industry}
                        </span>
                        <Badge variant="secondary" className="text-[9px] font-semibold">
                          {item.sector}
                        </Badge>
                      </div>

                      <p className="text-xs text-foreground/90 leading-snug">
                        {item.tailwindsOrHeadwinds}
                      </p>

                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground font-sans">Tickers:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.representativeTickers.map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              onClick={() => onNavigateToResearch?.(t)}
                              className="text-[9.5px] font-mono font-bold bg-rose-500/10 text-rose-400 border-rose-500/30 cursor-pointer hover:bg-rose-500/20"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= 5. CYCLE TRANSITION TRIGGERS ALERT ================= */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Cycle Stage Transition Invalidation Triggers</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-foreground/80 space-y-0.5 pl-1">
            {cycle.transitionTriggers.map((trig, i) => (
              <li key={i}>{trig}</li>
            ))}
          </ul>
        </div>
      </CardContent>

      {/* AI Macro Stock Agent Modal */}
      {isStockModalOpen && (
        <MacroStockAgentModal
          isOpen={isStockModalOpen}
          onClose={() => setIsStockModalOpen(false)}
          initialData={stockAgentResult}
          onNavigateToResearch={onNavigateToResearch}
        />
      )}
    </Card>
  );
}
