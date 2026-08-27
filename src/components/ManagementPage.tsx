import { useState } from 'react';
import {
  Briefcase,
  Layers,
  ShieldCheck,
  Zap,
  DollarSign,
  TrendingDown,
  Sparkles,
  Sliders,
  Scale,
  Activity,
  History,
  ArrowRight,
  ShieldAlert,
  Bot
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CoveredCallsAnalyser } from './management/CoveredCallsAnalyser';
import { OptionsRadarCard } from './dashboard/OptionsRadarCard';
import { DipOpportunityRadarCard } from './dashboard/DipOpportunityRadarCard';
import { PortfolioAuditModal } from './portfolio/PortfolioAuditModal';
import { CriticalDefenseModal } from './portfolio/CriticalDefenseModal';
import { PositionAdvisorModal } from './portfolio/PositionAdvisorModal';
import { PortfolioValuationModal } from './portfolio/PortfolioValuationModal';
import { useIBKRPortfolio } from '@/services/ibkr';
import { useTastytradePositions } from '@/services/tastytrade';
import { useTrading212Positions } from '@/services/trading212';
import { cn } from '@/lib/utils';

interface ManagementPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToPortfolio?: () => void;
  onNavigateToGraphs?: (symbol?: string) => void;
}

export function ManagementPage({
  onNavigateToResearch,
  onNavigateToPortfolio,
  onNavigateToGraphs,
}: ManagementPageProps) {
  const [activeTab, setActiveTab] = useState('covered-calls');
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isValuationModalOpen, setIsValuationModalOpen] = useState(false);
  const [isDefenseModalOpen, setIsDefenseModalOpen] = useState(false);
  const [isAdvisorModalOpen, setIsAdvisorModalOpen] = useState(false);
  const [selectedAdvisorPosition, setSelectedAdvisorPosition] = useState<any>(null);

  // Position queries for sub-tools
  const { data: ibkrPositions = [] } = useIBKRPortfolio();
  const { data: tastyPositions = [] } = useTastytradePositions();
  const { data: t212Positions = [] } = useTrading212Positions();

  const allPositions = [
    ...(Array.isArray(ibkrPositions) ? ibkrPositions : []),
    ...(Array.isArray(tastyPositions) ? tastyPositions : []),
    ...(Array.isArray(t212Positions) ? t212Positions : []),
  ];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 via-emerald-500/20 to-indigo-500/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                Portfolio & Position Management Hub
              </h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono font-bold">
                Tactical Playbooks
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Institutional tools to harvest yield, hedge directional risk, manage delta, and execute tactical position playbooks.
            </p>
          </div>
        </div>

        {/* Global Quick Action Modals */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsValuationModalOpen(true)}
            className="h-8 text-xs gap-1.5 border-emerald-500/30 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-900/30 font-semibold"
          >
            <Scale className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Valuation Audit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAuditModalOpen(true)}
            className="h-8 text-xs gap-1.5 border-purple-500/30 bg-purple-950/20 text-purple-300 hover:bg-purple-900/30 font-semibold"
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Risk Audit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDefenseModalOpen(true)}
            className="h-8 text-xs gap-1.5 border-amber-500/30 bg-amber-950/20 text-amber-300 hover:bg-amber-900/30 font-semibold"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Options Defense Suite</span>
          </Button>
        </div>
      </div>

      {/* ================= MANAGEMENT TOOLS TABS ================= */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card/80 border border-border/60 p-1 rounded-2xl flex flex-wrap gap-1 w-full sm:w-auto h-auto">
          {/* Covered Calls Tab */}
          <TabsTrigger
            value="covered-calls"
            className="gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Covered Calls Harvester</span>
          </TabsTrigger>

          {/* Options Defense & Expirations */}
          <TabsTrigger
            value="options-defense"
            className="gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Options Defense & Rolling</span>
          </TabsTrigger>

          {/* AI Dip DCA Planner */}
          <TabsTrigger
            value="dip-recovery"
            className="gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
          >
            <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Dip & Opportunity Radar</span>
          </TabsTrigger>

          {/* Tactical Position Advisor */}
          <TabsTrigger
            value="position-advisor"
            className="gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
          >
            <Scale className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tactical Position Sizing</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= 1. COVERED CALLS ANALYSER ================= */}
        <TabsContent value="covered-calls" className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-foreground">
                    Covered Calls Income Harvester (Net Delta &ge; 100)
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    Tastytrade &amp; IBKR GIA
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Identifies stock and LEAPs positions in options-eligible accounts (Tastytrade &amp; IBKR GIA) with surplus unhedged delta (&ge;100 Delta), excluding cash/ISA accounts.
                </p>
              </div>
            </div>
          </div>

          <CoveredCallsAnalyser
            onNavigateToResearch={onNavigateToResearch}
            onNavigateToPortfolio={onNavigateToPortfolio}
          />
        </TabsContent>

        {/* ================= 2. OPTIONS DEFENSE & EXPIRATIONS ================= */}
        <TabsContent value="options-defense" className="space-y-6 animate-in fade-in duration-200">
          <OptionsRadarCard
            positions={allPositions}
            onNavigateToPortfolio={onNavigateToPortfolio}
            onNavigateToResearch={onNavigateToResearch}
          />
        </TabsContent>

        {/* ================= 3. AI DIP DCA & RECOVERY PLANNER ================= */}
        <TabsContent value="dip-recovery" className="space-y-6 animate-in fade-in duration-200">
          <DipOpportunityRadarCard
            onNavigateToPortfolio={onNavigateToPortfolio}
            onNavigateToResearch={onNavigateToResearch}
          />
        </TabsContent>

        {/* ================= 4. TACTICAL POSITION ADVISOR ================= */}
        <TabsContent value="position-advisor" className="space-y-6 animate-in fade-in duration-200">
          <div className="glass-card rounded-2xl p-6 border border-border/60 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" />
                  Tactical Position Advisor & Risk Sizing
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Analyze individual holdings for overweight concentration, take-profit triggers, and trailing stop-loss tiers.
                </p>
              </div>

              <Button
                variant="glow"
                size="sm"
                onClick={() => setIsAdvisorModalOpen(true)}
                className="text-xs font-semibold bg-primary text-primary-foreground gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Launch Position Advisor
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-card/60 border border-border/50 space-y-2">
                <span className="text-xs uppercase tracking-wider font-bold text-primary">
                  1. Trim Overweights
                </span>
                <p className="text-xs text-muted-foreground">
                  Identifies assets exceeding 15% portfolio allocation and suggests scaling tranches into lower-beta assets.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card/60 border border-border/50 space-y-2">
                <span className="text-xs uppercase tracking-wider font-bold text-emerald-400">
                  2. Profit-Taking Tiers
                </span>
                <p className="text-xs text-muted-foreground">
                  Calculates upside profit targets (+25%, +50%, +100%) and generates limit orders to lock in realized gains.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card/60 border border-border/50 space-y-2">
                <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
                  3. Invalidation & Defense
                </span>
                <p className="text-xs text-muted-foreground">
                  Monitors critical support levels, 200-day moving averages, and defines max risk stop-losses.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL SUITES ================= */}
      <PortfolioAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        positions={allPositions}
      />

      <CriticalDefenseModal
        isOpen={isDefenseModalOpen}
        onClose={() => setIsDefenseModalOpen(false)}
        positions={allPositions}
        onOpenAdvisorForPosition={(pos) => {
          setSelectedAdvisorPosition(pos);
          setIsAdvisorModalOpen(true);
        }}
        onNavigateToResearch={onNavigateToResearch}
        onNavigateToGraphs={onNavigateToGraphs}
      />

      <PortfolioValuationModal
        isOpen={isValuationModalOpen}
        onClose={() => setIsValuationModalOpen(false)}
        positions={allPositions}
        onNavigateToResearch={onNavigateToResearch}
      />

      <PositionAdvisorModal
        position={selectedAdvisorPosition}
        isOpen={isAdvisorModalOpen && Boolean(selectedAdvisorPosition)}
        onClose={() => {
          setIsAdvisorModalOpen(false);
          setSelectedAdvisorPosition(null);
        }}
      />
    </div>
  );
}
