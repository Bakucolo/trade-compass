// src/components/aiTrading/BuyingPowerComparisonCard.tsx
// Side-by-Side Buying Power, Margin & Commission Comparison Card (Tastytrade vs. IBKR)

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  ShieldCheck,
  Trophy,
  Sparkles,
  Loader2,
  RefreshCw,
  Info,
  Check,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import {
  BuyingPowerComparisonResult,
  BrokerMarginImpact,
  StagedDraftOrder,
  switchDraftBroker,
  analyzeBuyingPower
} from '@/services/tastytrade';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface BuyingPowerComparisonCardProps {
  comparison?: BuyingPowerComparisonResult;
  draft?: StagedDraftOrder;
  onBrokerSwitched?: (updatedDraft: StagedDraftOrder) => void;
  compact?: boolean;
  className?: string;
}

export const BuyingPowerComparisonCard: React.FC<BuyingPowerComparisonCardProps> = ({
  comparison: initialComparison,
  draft,
  onBrokerSwitched,
  compact = false,
  className
}) => {
  const [comparison, setComparison] = useState<BuyingPowerComparisonResult | undefined>(
    initialComparison || draft?.buyingPowerComparison
  );
  const [isSwitching, setIsSwitching] = useState<'tastytrade' | 'ibkr' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // If draft updates from outside, sync comparison if changed
  React.useEffect(() => {
    if (draft?.buyingPowerComparison) {
      setComparison(draft.buyingPowerComparison);
    } else if (initialComparison) {
      setComparison(initialComparison);
    }
  }, [draft?.buyingPowerComparison, initialComparison]);

  const activeBroker = draft?.broker || 'tastytrade';

  const handleSwitchBroker = async (targetBroker: 'tastytrade' | 'ibkr') => {
    if (!draft || draft.status !== 'PENDING_APPROVAL' || isSwitching) return;
    if (draft.broker === targetBroker) return;

    setIsSwitching(targetBroker);
    try {
      const res = await switchDraftBroker(draft.draftId, targetBroker);
      if (res.draft.buyingPowerComparison) {
        setComparison(res.draft.buyingPowerComparison);
      }
      onBrokerSwitched?.(res.draft);
      toast.success(`Order Re-Routed to ${targetBroker === 'ibkr' ? 'Interactive Brokers' : 'Tastytrade'}`, {
        description: `Preflight margin & buying power recalculated for account ${res.draft.accountNumber}.`
      });
    } catch (err: any) {
      console.error('Failed to switch broker:', err);
      toast.error('Re-Routing Failed', {
        description: err.message || 'Could not switch order draft broker.'
      });
    } finally {
      setIsSwitching(null);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await analyzeBuyingPower({
        draftId: draft?.draftId,
        symbol: comparison?.symbol || draft?.symbol,
        action: comparison?.action || draft?.action,
        quantity: comparison?.quantity || draft?.quantity,
        price: comparison?.price || draft?.price,
        orderType: comparison?.orderType || draft?.orderType,
        instrumentType: comparison?.instrumentType || draft?.instrumentType,
        optionDetails: draft?.optionDetails
      });
      if (res.comparison) {
        setComparison(res.comparison);
        toast.success('Buying Power Refreshed', {
          description: 'Recalculated latest margin requirements & account buffers.'
        });
      }
    } catch (err: any) {
      toast.error('Refresh Failed', { description: err.message });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!comparison) {
    return (
      <Card className={cn("p-4 bg-slate-900/60 border border-slate-800 text-slate-300 text-xs", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <span className="font-semibold text-slate-200">Buying Power Analyser</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-7 text-[11px] font-mono border-slate-700"
          >
            {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Analyze Now
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          No buying power telemetry cached. Click "Analyze Now" to compare Tastytrade vs. IBKR capital requirements.
        </p>
      </Card>
    );
  }

  const { tastytrade, ibkr, verdict } = comparison;

  const getWinnerBadge = () => {
    if (verdict.recommendedBroker === 'tastytrade') {
      return (
        <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono flex items-center gap-1 py-0.5">
          <Trophy className="w-3 h-3 text-rose-400" />
          <span>Tastytrade Recommended</span>
        </Badge>
      );
    }
    if (verdict.recommendedBroker === 'ibkr') {
      return (
        <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-mono flex items-center gap-1 py-0.5">
          <Trophy className="w-3 h-3 text-blue-400" />
          <span>IBKR Recommended</span>
        </Badge>
      );
    }
    return (
      <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono flex items-center gap-1 py-0.5">
        <Scale className="w-3 h-3 text-purple-400" />
        <span>Equivalent Capital Impact</span>
      </Badge>
    );
  };

  const renderBrokerColumn = (impact: BrokerMarginImpact, brokerKey: 'tastytrade' | 'ibkr') => {
    const isTasty = brokerKey === 'tastytrade';
    const isCurrentActive = activeBroker === brokerKey;
    const isPendingDraft = draft?.status === 'PENDING_APPROVAL';

    const headerGradient = isTasty
      ? 'from-rose-500/10 via-slate-900/80 to-transparent border-rose-500/30'
      : 'from-blue-500/10 via-slate-900/80 to-transparent border-blue-500/30';

    const accentColor = isTasty ? 'text-rose-400' : 'text-blue-400';
    const activeBorder = isCurrentActive
      ? isTasty
        ? 'ring-1 ring-rose-500/50 border-rose-500/60'
        : 'ring-1 ring-blue-500/50 border-blue-500/60'
      : 'border-slate-800/90';

    return (
      <div className={cn("rounded-xl border bg-slate-950/70 p-3.5 space-y-3 transition-all flex flex-col justify-between", activeBorder)}>
        <div>
          {/* Broker Column Header */}
          <div className={cn("pb-2.5 border-b flex items-center justify-between gap-2 bg-gradient-to-r", headerGradient)}>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={cn("font-bold text-xs tracking-wide uppercase font-mono", accentColor)}>
                  {isTasty ? 'Tastytrade' : 'Interactive Brokers'}
                </span>
                {isCurrentActive && (
                  <Badge variant="outline" className="text-[9px] font-mono py-0 px-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                    Active Route
                  </Badge>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                Acct: {impact.accountNumber} ({isTasty ? 'Cert Sandbox' : 'Paper DU'})
              </span>
            </div>

            {/* Feasibility Badge */}
            {impact.isFeasible ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Feasible
              </Badge>
            ) : (
              <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-mono flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Insufficient BP
              </Badge>
            )}
          </div>

          {/* Core Telemetry Metrics */}
          <div className="mt-3 space-y-2 text-xs font-mono">
            {/* Required Buying Power */}
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400 text-[11px]">Required BP</span>
              <span className="font-bold text-white text-xs">
                ${impact.buyingPowerRequirement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Initial Margin */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <span>Initial Margin</span>
                <span className="text-[9px] text-slate-400">({comparison.instrumentType === 'Equity Option' ? '100% Debit' : '50% Reg-T'})</span>
              </span>
              <span className="text-slate-200">
                ${impact.initialMarginRequirement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Maintenance Margin */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 text-[11px]">Maintenance Margin</span>
              <span className="text-slate-200">
                ${impact.maintenanceMarginRequirement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Commissions */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 text-[11px]">Commission</span>
              <span className={cn("font-medium", impact.estimatedCommission === 0 ? "text-emerald-400" : "text-slate-200")}>
                {impact.estimatedCommission === 0 ? '$0.00 (Free)' : `$${impact.estimatedCommission.toFixed(2)}`}
              </span>
            </div>

            {/* Reg Fees */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 text-[11px]">Reg & Exchange Fees</span>
              <span className="text-slate-400">${impact.estimatedRegulatoryFees.toFixed(2)}</span>
            </div>

            {/* Total Cash Outlay */}
            <div className="flex items-center justify-between py-1 bg-slate-900/50 px-2 rounded border border-slate-800/80">
              <span className="text-slate-300 font-semibold text-[11px]">Total Cash Outlay</span>
              <span className="text-emerald-300 font-bold">
                ${impact.totalCashOutlay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Post-Trade Available BP & Buffer */}
            <div className="pt-1.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Post-Trade BP</span>
                <span className="text-slate-300 font-semibold">
                  ${impact.postTradeAvailableBuyingPower.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Headroom Progress Bar */}
              <div>
                <div className="flex justify-between text-[9px] text-slate-400 mb-0.5 font-mono">
                  <span>Remaining Buffer</span>
                  <span className={cn(
                    "font-bold",
                    impact.remainingBufferPercentage > 40 ? "text-emerald-400" : impact.remainingBufferPercentage > 15 ? "text-amber-400" : "text-rose-400"
                  )}>
                    {impact.remainingBufferPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      impact.remainingBufferPercentage > 40
                        ? "bg-emerald-500"
                        : impact.remainingBufferPercentage > 15
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, impact.remainingBufferPercentage))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Warnings / Notes */}
            {impact.warnings && impact.warnings.length > 0 && (
              <div className="pt-1 text-[10px] text-amber-300/80 space-y-0.5">
                {impact.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <Info className="w-2.5 h-2.5 mt-0.5 shrink-0 text-amber-400" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Re-Routing Action Button */}
        {draft && isPendingDraft && (
          <div className="pt-2">
            {isCurrentActive ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="w-full h-7 text-[11px] font-mono border-emerald-500/40 bg-emerald-500/10 text-emerald-300 cursor-default"
              >
                <Check className="w-3 h-3 mr-1 text-emerald-400" />
                Active Route
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isSwitching !== null || !impact.isFeasible}
                onClick={() => handleSwitchBroker(brokerKey)}
                className={cn(
                  "w-full h-7 text-[11px] font-mono transition-all font-semibold",
                  isTasty
                    ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/70"
                    : "border-blue-500/40 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/70"
                )}
              >
                {isSwitching === brokerKey ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Re-routing...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3 h-3 mr-1" />
                    Route via {isTasty ? 'Tastytrade' : 'IBKR'}
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={cn(
      "border border-slate-800 bg-slate-950/90 text-slate-100 rounded-xl overflow-hidden shadow-lg space-y-3 p-4",
      className
    )}>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-white">Buying Power & Margin Analyser</span>
              <Badge variant="outline" className="text-[9px] font-mono py-0 px-1 border-slate-700 text-slate-400">
                {comparison.quantity} {comparison.instrumentType === 'Equity Option' ? 'Contracts' : 'Shares'} {comparison.symbol}
              </Badge>
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">
              Pre-flight requirement evaluation: Tastytrade vs. Interactive Brokers
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getWinnerBadge()}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
            title="Refresh buying power metrics"
          >
            <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin text-primary")} />
          </Button>
        </div>
      </div>

      {/* Side-by-Side Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderBrokerColumn(tastytrade, 'tastytrade')}
        {renderBrokerColumn(ibkr, 'ibkr')}
      </div>

      {/* Rationale & Smart Decision Banner */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Smart Routing Recommendation</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-slate-400">Fee Winner:</span>
            <Badge variant="outline" className={cn(
              "py-0 px-1.5 font-bold",
              verdict.feeWinner === 'tastytrade'
                ? "border-rose-500/40 text-rose-300 bg-rose-500/10"
                : verdict.feeWinner === 'ibkr'
                ? "border-blue-500/40 text-blue-300 bg-blue-500/10"
                : "border-slate-700 text-slate-300"
            )}>
              {verdict.feeWinner.toUpperCase()}
            </Badge>

            <span className="text-slate-400 ml-1">Capital Winner:</span>
            <Badge variant="outline" className={cn(
              "py-0 px-1.5 font-bold",
              verdict.capitalEfficiencyWinner === 'tastytrade'
                ? "border-rose-500/40 text-rose-300 bg-rose-500/10"
                : verdict.capitalEfficiencyWinner === 'ibkr'
                ? "border-blue-500/40 text-blue-300 bg-blue-500/10"
                : "border-slate-700 text-slate-300"
            )}>
              {verdict.capitalEfficiencyWinner.toUpperCase()}
            </Badge>
          </div>
        </div>

        <p className="text-[11px] text-slate-300 font-mono">
          {verdict.summary}
        </p>

        {verdict.rationale && verdict.rationale.length > 0 && (
          <ul className="space-y-1 text-[10px] text-slate-400 font-mono list-disc list-inside">
            {verdict.rationale.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};
