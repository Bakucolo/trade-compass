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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sparkles,
  Target,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  Bell,
  RefreshCw,
  Layers,
  Activity,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  PlannedTrade,
  TradeEntryProposal,
  useUpdatePlannedTrade,
} from '@/services/plannedTradeService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TradeEntryProposalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trade: PlannedTrade | null;
  proposal: TradeEntryProposal | null;
  isLoading: boolean;
  onReanalyze?: () => void;
  onOpenPriceAlert?: (trade: PlannedTrade, targetPrice: number) => void;
}

export function TradeEntryProposalModal({
  isOpen,
  onOpenChange,
  trade,
  proposal,
  isLoading,
  onReanalyze,
  onOpenPriceAlert,
}: TradeEntryProposalModalProps) {
  const updateMutation = useUpdatePlannedTrade();

  // Selected entry type: 'PRIMARY' | 'CONSERVATIVE' | 'AGGRESSIVE'
  const [selectedEntryType, setSelectedEntryType] = useState<'PRIMARY' | 'CONSERVATIVE' | 'AGGRESSIVE'>('PRIMARY');

  // Editable fields before submitting
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [targetExit, setTargetExit] = useState<number>(0);

  // Sync state when proposal updates or selectedEntryType changes
  useEffect(() => {
    if (!proposal) return;

    let targetP = proposal.primaryEntryPrice;
    if (selectedEntryType === 'CONSERVATIVE') {
      targetP = proposal.conservativeEntryPrice;
    } else if (selectedEntryType === 'AGGRESSIVE') {
      targetP = proposal.aggressiveEntryPrice;
    }

    setEntryPrice(targetP);
    setStopLoss(proposal.stopLoss);
    setTargetExit(proposal.targetExit);
  }, [proposal, selectedEntryType]);

  if (!trade) return null;

  const handleApplyToTrade = async () => {
    if (!entryPrice || entryPrice <= 0) {
      toast.error('Please enter a valid entry price');
      return;
    }

    try {
      const summaryNote = proposal
        ? `[AI Entry Agent]: Set entry to $${entryPrice.toFixed(2)} (${selectedEntryType.toLowerCase()}), SL $${stopLoss.toFixed(2)}, TP $${targetExit.toFixed(2)}. ${trade.notes ? `| ${trade.notes}` : ''}`
        : trade.notes;

      await updateMutation.mutateAsync({
        id: trade.id,
        data: {
          targetPrice: entryPrice,
          stopLoss: stopLoss > 0 ? stopLoss : null,
          targetExit: targetExit > 0 ? targetExit : null,
          notes: summaryNote,
        },
      });

      toast.success(`Applied AI Entry Levels to ${trade.symbol}! Limit: $${entryPrice.toFixed(2)}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Failed to update planned trade: ${err.message}`);
    }
  };

  const handleSetAlert = () => {
    if (onOpenPriceAlert && entryPrice > 0) {
      onOpenPriceAlert(trade, entryPrice);
      onOpenChange(false);
    }
  };

  const isLong = trade.action.toUpperCase().includes('BUY') || trade.action.toUpperCase() === 'BTO';

  // Dynamic R:R calculation based on user edited inputs
  const currentRisk = Math.abs(entryPrice - stopLoss);
  const currentReward = Math.abs(targetExit - entryPrice);
  const currentRR = currentRisk > 0 ? (currentReward / currentRisk).toFixed(1) : '—';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border border-border/70 shadow-2xl p-6 rounded-2xl">
        <DialogHeader className="space-y-2 border-b border-border/50 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 via-indigo-500/20 to-purple-500/20 border border-primary/40 flex items-center justify-center text-primary shadow-sm">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold font-mono tracking-tight text-foreground">
                    {trade.symbol}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5',
                      isLong
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    )}
                  >
                    {trade.action}
                  </Badge>
                  {proposal && (
                    <Badge
                      className={cn(
                        'text-[10px] font-bold',
                        proposal.setupQuality === 'PRIME'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : proposal.setupQuality === 'GOOD'
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : proposal.setupQuality === 'CHOPPY'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      )}
                    >
                      {proposal.setupQuality} Setup
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  AI Tactical Entry Level Proposal &amp; Structural Invalidation Desk
                </DialogDescription>
              </div>
            </div>

            {proposal && onReanalyze && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReanalyze}
                disabled={isLoading}
                className="h-8 text-xs gap-1.5 border-border/70 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin text-primary')} />
                <span>Re-Analyze</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-14 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto text-primary">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                Analyzing Market Structure for {trade.symbol}...
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Synthesizing support/resistance pivots, moving averages, RSI momentum, and ATR volatility to build optimal limit entries.
              </p>
            </div>
          </div>
        ) : proposal ? (
          <div className="space-y-5 pt-2">
            {/* Live Price Banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-accent/20 border border-border/50 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Current Market Price:</span>
                <span className="text-base font-black text-foreground">${proposal.currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {proposal.marketStage && <span>{proposal.marketStage}</span>}
                {proposal.rsi != null && (
                  <Badge variant="outline" className="text-[10px] font-mono border-border/60">
                    RSI {proposal.rsi}
                  </Badge>
                )}
                {proposal.atr != null && (
                  <Badge variant="outline" className="text-[10px] font-mono border-border/60">
                    ATR ±${proposal.atr.toFixed(2)}
                  </Badge>
                )}
              </div>
            </div>

            {/* 3 Entry Strategy Cards */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                Choose Strategic Entry Profile
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Primary Entry */}
                <div
                  onClick={() => setSelectedEntryType('PRIMARY')}
                  className={cn(
                    'p-3.5 rounded-xl border transition-all cursor-pointer space-y-1 relative',
                    selectedEntryType === 'PRIMARY'
                      ? 'bg-primary/15 border-primary shadow-sm shadow-primary/20 ring-1 ring-primary'
                      : 'bg-card/60 hover:bg-card border-border/60'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                      Primary Limit
                    </span>
                    {selectedEntryType === 'PRIMARY' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                  <p className="text-lg font-black font-mono text-foreground">
                    ${proposal.primaryEntryPrice.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Recommended high-probability limit bid
                  </p>
                </div>

                {/* 2. Conservative Pullback */}
                <div
                  onClick={() => setSelectedEntryType('CONSERVATIVE')}
                  className={cn(
                    'p-3.5 rounded-xl border transition-all cursor-pointer space-y-1 relative',
                    selectedEntryType === 'CONSERVATIVE'
                      ? 'bg-teal-500/15 border-teal-500 shadow-sm shadow-teal-500/20 ring-1 ring-teal-500'
                      : 'bg-card/60 hover:bg-card border-border/60'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-teal-400 tracking-wider">
                      Conservative
                    </span>
                    {selectedEntryType === 'CONSERVATIVE' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    )}
                  </div>
                  <p className="text-lg font-black font-mono text-foreground">
                    ${proposal.conservativeEntryPrice.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Patient limit bid near major support / 50 EMA
                  </p>
                </div>

                {/* 3. Aggressive Breakout */}
                <div
                  onClick={() => setSelectedEntryType('AGGRESSIVE')}
                  className={cn(
                    'p-3.5 rounded-xl border transition-all cursor-pointer space-y-1 relative',
                    selectedEntryType === 'AGGRESSIVE'
                      ? 'bg-purple-500/15 border-purple-500 shadow-sm shadow-purple-500/20 ring-1 ring-purple-500'
                      : 'bg-card/60 hover:bg-card border-border/60'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-purple-400 tracking-wider">
                      Aggressive
                    </span>
                    {selectedEntryType === 'AGGRESSIVE' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    )}
                  </div>
                  <p className="text-lg font-black font-mono text-foreground">
                    ${proposal.aggressiveEntryPrice.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Breakout / momentum trigger level
                  </p>
                </div>
              </div>
            </div>

            {/* Risk, Targets & R:R Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-accent/20 border border-border/60 font-mono text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground font-sans uppercase block">
                  Stop-Loss Invalidation
                </span>
                <span className="text-sm font-bold text-rose-400">
                  ${stopLoss.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {entryPrice > 0 ? `-${Math.abs(((entryPrice - stopLoss) / entryPrice) * 100).toFixed(1)}% Risk` : ''}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground font-sans uppercase block">
                  Target Profit Exit
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  ${targetExit.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {entryPrice > 0 ? `+${Math.abs(((targetExit - entryPrice) / entryPrice) * 100).toFixed(1)}% Reward` : ''}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground font-sans uppercase block">
                  Reward-to-Risk Ratio
                </span>
                <span className="text-sm font-black text-primary">
                  1 : {currentRR} R:R
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {Number(currentRR) >= 2.0 ? '✓ Asymmetrical setup' : '⚠ Narrow margin'}
                </span>
              </div>
            </div>

            {/* Technical Context & Invalidation */}
            <div className="space-y-3 p-3.5 rounded-xl bg-card/60 border border-border/50 text-xs">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  Tactical Rationale
                </span>
                <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span>Supp: {proposal.keySupportLevels.map((s) => `$${s.toFixed(2)}`).join(', ')}</span>
                  <span>|</span>
                  <span>Res: {proposal.keyResistanceLevels.map((r) => `$${r.toFixed(2)}`).join(', ')}</span>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11px] whitespace-pre-line">
                {proposal.tacticalRationale}
              </p>
              {proposal.invalidationCondition && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Invalidation Condition:</span>
                    <span>{proposal.invalidationCondition}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Editable Level Inputs Before Applying */}
            <div className="p-3.5 rounded-xl bg-accent/20 border border-border/60 space-y-3">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block font-sans">
                Fine-Tune Parameters for Planned Trade
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground">Limit Entry ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={entryPrice || ''}
                    onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-xs bg-card/90"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground">Stop Loss ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={stopLoss || ''}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-xs bg-card/90 text-rose-300"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground">Target Exit ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={targetExit || ''}
                    onChange={(e) => setTargetExit(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-xs bg-card/90 text-emerald-300"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetAlert}
                className="w-full sm:w-auto text-xs gap-1.5 border-border/70 hover:text-amber-400"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Set Price Alert at Entry (${entryPrice.toFixed(2)})</span>
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyToTrade}
                  disabled={updateMutation.isPending || entryPrice <= 0}
                  className="text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-md hover:bg-primary/90"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {updateMutation.isPending ? 'Updating...' : 'Apply to Planned Trade'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No proposal available. Click Re-Analyze to trigger the agent.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
