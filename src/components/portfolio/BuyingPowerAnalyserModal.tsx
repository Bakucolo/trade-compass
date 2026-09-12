import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Sparkles,
  Sliders,
  Scale,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Calculator,
  Flame,
  PieChart,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioBalances } from '@/services/portfolioBalanceService';
import {
  calculateBuyingPowerRisk,
  simulateTradeImpact,
  runStressScenarios,
  RiskLevel,
  TradeSimulationInput,
} from '@/services/buyingPowerRiskService';

interface BuyingPowerAnalyserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTrades?: () => void;
}

export function BuyingPowerAnalyserModal({
  isOpen,
  onClose,
  onNavigateToTrades,
}: BuyingPowerAnalyserModalProps) {
  const { data: balancesData, isLoading, refetch } = usePortfolioBalances();
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Trade Simulator Input State
  const [simBroker, setSimBroker] = useState<'tastytrade' | 'ibkrGia' | 'ibkrIsa' | 'trading212'>('tastytrade');
  const [simAssetType, setSimAssetType] = useState<'EQUITY' | 'LONG_OPTION' | 'SHORT_OPTION' | 'SPREAD'>('SHORT_OPTION');
  const [simSymbol, setSimSymbol] = useState<string>('NVDA');
  const [simPrice, setSimPrice] = useState<number>(130);
  const [simUnits, setSimUnits] = useState<number>(1);
  const [simPremium, setSimPremium] = useState<number>(3.50);

  // Compute Risk Assessment
  const assessment = useMemo(() => {
    return calculateBuyingPowerRisk(balancesData);
  }, [balancesData]);

  // Compute Trade Simulation
  const simulationResult = useMemo(() => {
    const input: TradeSimulationInput = {
      broker: simBroker,
      assetType: simAssetType,
      symbol: simSymbol,
      contractsOrShares: Number(simUnits) || 1,
      underlyingPrice: Number(simPrice) || 100,
      premiumOrCostPerUnit: Number(simPremium) || 0,
    };
    return simulateTradeImpact(assessment, input);
  }, [assessment, simBroker, simAssetType, simSymbol, simPrice, simUnits, simPremium]);

  // Compute Stress Scenarios
  const stressScenarios = useMemo(() => {
    return runStressScenarios(assessment);
  }, [assessment]);

  const formatUSD = (val: number, decimals: number = 0) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(val || 0);
  };

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'OPTIMAL':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-mono font-bold px-2.5 py-0.5 flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            OPTIMAL SAFE ZONE
          </Badge>
        );
      case 'MODERATE':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono font-bold px-2.5 py-0.5 flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            MODERATE / CONTROLLED
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-xs font-mono font-bold px-2.5 py-0.5 flex items-center gap-1.5 shadow-[0_0_12px_rgba(249,115,22,0.25)]">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            ELEVATED RISK ZONE
          </Badge>
        );
      case 'DANGER_ZONE':
        return (
          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs font-mono font-bold px-2.5 py-0.5 flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.35)] animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            DANGER ZONE / LIQUIDATION RISK
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "overflow-y-auto bg-card/95 backdrop-blur-2xl p-6 shadow-2xl transition-all duration-200 scrollbar-thin",
          isFullScreen
            ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 !m-0 z-50"
            : "max-w-4xl w-[95vw] max-h-[90vh] border border-border/80 rounded-2xl"
        )}
      >
        <DialogHeader className="pb-4 border-b border-border/50 pr-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/20 to-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                    Buying Power & Margin Analyser
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase bg-accent/40">
                    Risk Engine
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Institutional margin buffer, stress drawdown simulator & danger zone early warning protocol.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getRiskBadge(assessment.riskLevel)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="h-8 px-2.5 text-xs gap-1 border-border/60 hover:bg-accent/40"
                title="Refresh balances"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                <span className="hidden sm:inline">Sync</span>
              </Button>

              {/* Fullscreen Toggle Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl border-border/60 hover:bg-accent/40 shrink-0 transition-all shadow-sm"
                title={isFullScreen ? "Restore window size (Exit Fullscreen)" : "Full size simulate window (Fullscreen)"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 space-y-5">
          <TabsList className="grid w-full grid-cols-4 bg-background/60 p-1 rounded-xl border border-border/60">
            <TabsTrigger value="overview" className="text-xs font-bold gap-1.5 rounded-lg py-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Overview & Safety</span>
            </TabsTrigger>
            <TabsTrigger value="brokers" className="text-xs font-bold gap-1.5 rounded-lg py-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Broker Breakdown</span>
            </TabsTrigger>
            <TabsTrigger value="simulator" className="text-xs font-bold gap-1.5 rounded-lg py-2">
              <Calculator className="w-3.5 h-3.5 text-cyan-400" />
              <span>What-If Simulator</span>
            </TabsTrigger>
            <TabsTrigger value="stress" className="text-xs font-bold gap-1.5 rounded-lg py-2">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Crash Stress Test</span>
            </TabsTrigger>
          </TabsList>

          {/* ================= TAB 1: OVERVIEW & SAFETY GAUGES ================= */}
          <TabsContent value="overview" className="space-y-5 animate-in fade-in">
            {/* 4 Core Telemetry Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Total Buying Power */}
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-4 rounded-2xl relative overflow-hidden group shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Total Buying Power
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-amber-500/10 text-amber-300 border-amber-500/30">
                    LIVE
                  </Badge>
                </div>
                <div className="text-2xl font-black font-mono text-amber-400 mt-1">
                  {formatUSD(assessment.totalAvailableBuyingPower)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between pt-2 border-t border-border/40 font-mono">
                  <span>Cash: {formatUSD(assessment.totalCash)}</span>
                  <span>Net: {formatUSD(assessment.totalNetLiquidatingValue)}</span>
                </div>
              </Card>

              {/* 2. Margin Cushion */}
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-4 rounded-2xl relative overflow-hidden group shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-primary" /> Margin Cushion
                  </span>
                  <span className={cn(
                    "text-xs font-mono font-bold px-2 py-0.5 rounded-md",
                    assessment.marginCushionPercent >= 50 ? "bg-emerald-500/15 text-emerald-400" :
                    assessment.marginCushionPercent >= 25 ? "bg-amber-500/15 text-amber-400" :
                    "bg-rose-500/15 text-rose-400"
                  )}>
                    {assessment.marginCushionPercent}%
                  </span>
                </div>
                <div className={cn(
                  "text-2xl font-black font-mono mt-1",
                  assessment.marginCushionPercent >= 50 ? "text-emerald-400" :
                  assessment.marginCushionPercent >= 25 ? "text-amber-400" :
                  "text-rose-400"
                )}>
                  {assessment.marginCushionPercent >= 50 ? 'Ample Safety' : assessment.marginCushionPercent >= 25 ? 'Moderate' : 'Danger Zone'}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between pt-2 border-t border-border/40 font-mono">
                  <span>Utilization: {assessment.marginUtilizationPercent}%</span>
                  <span>Maint: {formatUSD(assessment.totalMaintenanceMargin)}</span>
                </div>
              </Card>

              {/* 3. Recommended Safe Deployable */}
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-4 rounded-2xl relative overflow-hidden group shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Max Safe Deploy
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                    GUIDELINE
                  </Badge>
                </div>
                <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
                  {formatUSD(assessment.maxRecommendedDeployableBP)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between pt-2 border-t border-border/40 font-mono">
                  <span>Reserve: {formatUSD(assessment.recommendedReserveCapital)}</span>
                  <span>Safety: 50% Max</span>
                </div>
              </Card>

              {/* 4. Margin Call Buffer */}
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-4 rounded-2xl relative overflow-hidden group shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-400" /> Liq. Distance
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-300">
                    -{assessment.portfolioDrawdownTolerancePercent}%
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-purple-300 mt-1">
                  {formatUSD(assessment.marginCallBufferUSD)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between pt-2 border-t border-border/40 font-mono">
                  <span>Buffer before Call</span>
                  <span className="text-emerald-400 font-bold">Protected</span>
                </div>
              </Card>
            </div>

            {/* Visual Risk Gauge Ribbon */}
            <Card className="bg-card/40 border-border/60 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Portfolio Margin Cushion Zone Spectrum
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Real-time gauge of distance from forced broker liquidations under market selloffs.
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-bold text-muted-foreground">Current Cushion: </span>
                  <span className={cn(
                    "text-sm font-black",
                    assessment.marginCushionPercent >= 50 ? "text-emerald-400" :
                    assessment.marginCushionPercent >= 25 ? "text-amber-400" :
                    "text-rose-400"
                  )}>
                    {assessment.marginCushionPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Spectrum Bar */}
              <div className="relative h-4 w-full bg-accent/40 rounded-full overflow-hidden border border-border/60">
                <div className="absolute inset-0 bg-gradient-to-r from-rose-600 via-amber-500 via-50% to-emerald-500 opacity-80" />
                {/* Pointer marker */}
                <div
                  className="absolute top-0 bottom-0 w-3 bg-white rounded-full border-2 border-background shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all duration-500 -translate-x-1/2"
                  style={{ left: `${Math.max(2, Math.min(98, assessment.marginCushionPercent))}%` }}
                />
              </div>

              {/* Spectrum Threshold Markers */}
              <div className="grid grid-cols-4 text-center text-[10px] font-mono pt-1">
                <div className="text-rose-400 font-bold border-r border-border/40">
                  🔴 &lt; 15% Danger Zone
                </div>
                <div className="text-orange-400 font-bold border-r border-border/40">
                  🟠 15–25% Warning
                </div>
                <div className="text-amber-400 font-bold border-r border-border/40">
                  🟡 25–50% Moderate
                </div>
                <div className="text-emerald-400 font-bold">
                  🟢 &gt; 50% Optimal Safe
                </div>
              </div>
            </Card>

            {/* Contextual Warnings & AI Recommendations */}
            <div className="space-y-3">
              {assessment.warnings.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Active Margin Risk Alerts</span>
                  </div>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    {assessment.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-foreground space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Sparkles className="w-4 h-4" />
                  <span>Institutional Capital Deployment Directives</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  {assessment.recommendations.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* ================= TAB 2: BROKER-BY-BROKER BREAKDOWN ================= */}
          <TabsContent value="brokers" className="space-y-4 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Tastytrade Card */}
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-xs">
                      TT
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tastytrade Derivatives</h4>
                      <p className="text-[10px] text-muted-foreground font-mono">Options Margin Account</p>
                    </div>
                  </div>
                  {getRiskBadge(assessment.brokerBreakdowns.tastytrade.riskLevel)}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-muted-foreground block">Net Liquidity</span>
                    <span className="text-sm font-bold text-foreground">{formatUSD(assessment.brokerBreakdowns.tastytrade.netLiq)}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-amber-400 block">Derivative BP</span>
                    <span className="text-sm font-bold text-amber-400">{formatUSD(assessment.brokerBreakdowns.tastytrade.derivativeBP)}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-muted-foreground block">Equity BP</span>
                    <span className="font-bold text-foreground">{formatUSD(assessment.brokerBreakdowns.tastytrade.equityBP)}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-muted-foreground block">Options BPR Usage</span>
                    <span className="font-bold text-foreground">{assessment.brokerBreakdowns.tastytrade.bprPercent}%</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-accent/20 border border-border/40 text-[11px] text-muted-foreground space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Options Market Value:</span>
                    <span className="text-foreground font-bold">{formatUSD(assessment.brokerBreakdowns.tastytrade.optionsValue)}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Account Cushion:</span>
                    <span className="text-emerald-400 font-bold">{assessment.brokerBreakdowns.tastytrade.cushionPercent}%</span>
                  </div>
                </div>
              </Card>

              {/* 2. IBKR GIA Margin Card */}
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                      IB
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">IBKR GIA ({assessment.brokerBreakdowns.ibkrGia.accountNumber})</h4>
                      <p className="text-[10px] text-muted-foreground font-mono">General Investment Margin</p>
                    </div>
                  </div>
                  {getRiskBadge(assessment.brokerBreakdowns.ibkrGia.riskLevel)}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-muted-foreground block">Net Liquidity</span>
                    <span className="text-sm font-bold text-foreground">{formatUSD(assessment.brokerBreakdowns.ibkrGia.netLiq)}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-amber-400 block">Available Funds</span>
                    <span className="text-sm font-bold text-amber-400">{formatUSD(assessment.brokerBreakdowns.ibkrGia.availableFunds)}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-muted-foreground block">Excess Liquidity</span>
                    <span className="font-bold text-emerald-400">{formatUSD(assessment.brokerBreakdowns.ibkrGia.excessLiquidity)}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-muted-foreground block">Maint. Margin</span>
                    <span className="font-bold text-foreground">{formatUSD(assessment.brokerBreakdowns.ibkrGia.maintMargin)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-accent/20 border border-border/40 text-[11px] text-muted-foreground space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Leverage Ratio:</span>
                    <span className="text-foreground font-bold">{assessment.brokerBreakdowns.ibkrGia.leverage}x</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>IBKR Cushion:</span>
                    <span className="text-emerald-400 font-bold">{assessment.brokerBreakdowns.ibkrGia.cushionPercent}%</span>
                  </div>
                </div>
              </Card>

              {/* 3. IBKR ISA (U14522424) */}
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                      ISA
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">IBKR ISA ({assessment.brokerBreakdowns.ibkrIsa.accountNumber})</h4>
                      <p className="text-[10px] text-emerald-400 font-mono">Tax-Free Registered Account</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                    100% Cash / Margin Free
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-muted-foreground block">Net Liquidity</span>
                    <span className="text-sm font-bold text-foreground">{formatUSD(assessment.brokerBreakdowns.ibkrIsa.netLiq)}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-emerald-400 block">Settled Cash</span>
                    <span className="text-sm font-bold text-emerald-400">{formatUSD(assessment.brokerBreakdowns.ibkrIsa.cash)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground bg-accent/20 p-2.5 rounded-xl border border-border/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
                  ISAs do not use margin borrowing and are immune to margin calls.
                </p>
              </Card>

              {/* 4. Trading 212 Card */}
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                      T212
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Trading 212</h4>
                      <p className="text-[10px] text-blue-400 font-mono">Cash Equity Account</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] font-mono">
                    100% Cash / Margin Free
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-muted-foreground block">Net Liquidity</span>
                    <span className="text-sm font-bold text-foreground">{formatUSD(assessment.brokerBreakdowns.trading212.netLiqUSD)}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase text-blue-400 block">Free Cash</span>
                    <span className="text-sm font-bold text-blue-400">{formatUSD(assessment.brokerBreakdowns.trading212.freeCashUSD)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground bg-accent/20 p-2.5 rounded-xl border border-border/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 inline mr-1" />
                  Cash account. Free cash is available for instant stock purchases without leverage.
                </p>
              </Card>
            </div>
          </TabsContent>

          {/* ================= TAB 3: WHAT-IF TRADE SIMULATOR ================= */}
          <TabsContent value="simulator" className="space-y-4 animate-in fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Trade Parameter Inputs */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-4 rounded-2xl space-y-3.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-cyan-400" />
                    Configure Proposed Trade
                  </h4>

                  {/* Broker Selection */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground">Target Broker Account:</label>
                    <select
                      value={simBroker}
                      onChange={(e) => setSimBroker(e.target.value as any)}
                      className="w-full bg-background/80 border border-border/70 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary/50"
                    >
                      <option value="tastytrade">Tastytrade (Derivatives BP: {formatUSD(assessment.brokerBreakdowns.tastytrade.derivativeBP)})</option>
                      <option value="ibkrGia">IBKR GIA Margin (Available: {formatUSD(assessment.brokerBreakdowns.ibkrGia.availableFunds)})</option>
                      <option value="ibkrIsa">IBKR ISA (Cash: {formatUSD(assessment.brokerBreakdowns.ibkrIsa.cash)})</option>
                      <option value="trading212">Trading 212 (Cash: {formatUSD(assessment.brokerBreakdowns.trading212.freeCashUSD)})</option>
                    </select>
                  </div>

                  {/* Asset Type */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground">Strategy / Asset Type:</label>
                    <select
                      value={simAssetType}
                      onChange={(e) => setSimAssetType(e.target.value as any)}
                      className="w-full bg-background/80 border border-border/70 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary/50"
                    >
                      <option value="SHORT_OPTION">Short Put / Naked Call (Margin BPR ~20%)</option>
                      <option value="SPREAD">Defined-Risk Vertical Spread (Max Loss Cap)</option>
                      <option value="LONG_OPTION">Long Option Call / Put (100% Premium)</option>
                      <option value="EQUITY">Long Equities / Shares (50% Margin Req)</option>
                    </select>
                  </div>

                  {/* Symbol & Price */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">Symbol:</label>
                      <Input
                        value={simSymbol}
                        onChange={(e) => setSimSymbol(e.target.value.toUpperCase())}
                        className="bg-background/80 text-xs font-mono font-bold uppercase h-8"
                        placeholder="NVDA"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">Underlying Price ($):</label>
                      <Input
                        type="number"
                        value={simPrice}
                        onChange={(e) => setSimPrice(Number(e.target.value))}
                        className="bg-background/80 text-xs font-mono h-8"
                        placeholder="130"
                      />
                    </div>
                  </div>

                  {/* Contracts & Premium */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        {simAssetType === 'EQUITY' ? 'Shares Count:' : 'Contracts Count:'}
                      </label>
                      <Input
                        type="number"
                        value={simUnits}
                        onChange={(e) => setSimUnits(Number(e.target.value))}
                        className="bg-background/80 text-xs font-mono h-8"
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        {simAssetType === 'SPREAD' ? 'Spread Width ($):' : 'Option Premium ($):'}
                      </label>
                      <Input
                        type="number"
                        step="0.10"
                        value={simPremium}
                        onChange={(e) => setSimPremium(Number(e.target.value))}
                        className="bg-background/80 text-xs font-mono h-8"
                        placeholder="3.50"
                      />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Column: Projected Live Impact & Verdict */}
              <div className="lg:col-span-7 space-y-4">
                <Card className={cn(
                  "border-2 p-5 rounded-2xl space-y-4 transition-all shadow-md",
                  simulationResult.verdict === 'SAFE' ? "bg-emerald-950/20 border-emerald-500/40" :
                  simulationResult.verdict === 'CAUTION' ? "bg-amber-950/20 border-amber-500/40" :
                  "bg-rose-950/20 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
                )}>
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      {simulationResult.verdict === 'SAFE' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : simulationResult.verdict === 'CAUTION' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 animate-pulse" />
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {simulationResult.verdict === 'SAFE' ? 'Trade Cleared for Execution' :
                           simulationResult.verdict === 'CAUTION' ? 'Trade Caution: Moderate Usage' :
                           'CRITICAL WARNING: High Danger Trade'}
                        </h4>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Simulated order impact on {simSymbol}
                        </span>
                      </div>
                    </div>

                    <Badge className={cn(
                      "text-xs font-mono font-bold",
                      simulationResult.verdict === 'SAFE' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                      simulationResult.verdict === 'CAUTION' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                      "bg-rose-500/20 text-rose-400 border-rose-500/30"
                    )}>
                      {simulationResult.verdict}
                    </Badge>
                  </div>

                  <p className="text-xs text-foreground/90 leading-relaxed bg-background/50 p-3 rounded-xl border border-border/40">
                    {simulationResult.feedback}
                  </p>

                  {/* Impact Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                    <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                      <span className="text-[10px] uppercase text-muted-foreground block font-sans">Required BPR / Cost:</span>
                      <span className="text-sm font-bold text-amber-400">{formatUSD(simulationResult.estimatedCostOrBPR)}</span>
                    </div>

                    <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                      <span className="text-[10px] uppercase text-muted-foreground block font-sans">Remaining Acct BP:</span>
                      <span className="text-sm font-bold text-foreground">{formatUSD(simulationResult.newAccountBP)}</span>
                    </div>

                    <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                      <span className="text-[10px] uppercase text-muted-foreground block font-sans">New Cushion %:</span>
                      <span className={cn(
                        "text-sm font-bold",
                        simulationResult.newAccountCushionPercent >= 50 ? "text-emerald-400" :
                        simulationResult.newAccountCushionPercent >= 25 ? "text-amber-400" :
                        "text-rose-400"
                      )}>
                        {simulationResult.newAccountCushionPercent}%
                      </span>
                    </div>
                  </div>

                  {onNavigateToTrades && simulationResult.verdict !== 'CRITICAL_RISK' && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => {
                          onClose();
                          onNavigateToTrades();
                        }}
                        className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-8"
                      >
                        <span>Proceed to Trades Page</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ================= TAB 4: CRASH STRESS TEST ================= */}
          <TabsContent value="stress" className="space-y-4 animate-in fade-in">
            <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-5 rounded-2xl space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-400" />
                  Portfolio Margin Stress & Vega Shock Matrix
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Simulates how sudden market declines and volatility expansions (VIX spikes) expand maintenance margin requirements.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground text-left">
                      <th className="p-2.5 font-sans font-bold">Scenario Description</th>
                      <th className="p-2.5 text-right font-sans font-bold">Projected Net Liq</th>
                      <th className="p-2.5 text-right font-sans font-bold">Expanded Maint.</th>
                      <th className="p-2.5 text-right font-sans font-bold">Excess Liquidity</th>
                      <th className="p-2.5 text-right font-sans font-bold">Projected Cushion</th>
                      <th className="p-2.5 text-center font-sans font-bold">Margin Call Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stressScenarios.map((s, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b border-border/30 hover:bg-accent/20 transition-colors",
                          s.wouldTriggerMarginCall ? "bg-rose-500/10 text-rose-300" : ""
                        )}
                      >
                        <td className="p-2.5 font-sans font-semibold text-foreground">
                          {s.scenarioName}
                        </td>
                        <td className="p-2.5 text-right">{formatUSD(s.projectedNetLiq)}</td>
                        <td className="p-2.5 text-right text-amber-400">{formatUSD(s.projectedMaintMargin)}</td>
                        <td className="p-2.5 text-right text-emerald-400">{formatUSD(s.projectedExcessLiquidity)}</td>
                        <td className="p-2.5 text-right font-bold">
                          <span className={cn(
                            s.projectedCushionPercent >= 40 ? "text-emerald-400" :
                            s.projectedCushionPercent >= 20 ? "text-amber-400" :
                            "text-rose-400"
                          )}>
                            {s.projectedCushionPercent}%
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          {s.wouldTriggerMarginCall ? (
                            <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/40 text-[10px] font-mono">
                              MARGIN CALL
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-mono">
                              SURVIVED (SAFE)
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 rounded-xl bg-accent/20 border border-border/40 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  Institutional Risk Principle:
                </p>
                <p className="text-[11px] leading-relaxed">
                  During market crashes, option implied volatility typically surges 50% to 100%, causing naked short put margin requirements to double instantly. Maintaining a margin cushion above 40% ensures your account never faces forced broker liquidations during market panics.
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
