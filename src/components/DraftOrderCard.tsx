// src/components/DraftOrderCard.tsx
// Interactive Human-in-the-Loop Trade Approval Card for AI Copilot Chat

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  TrendingUp,
  AlertTriangle,
  FileCheck2,
  Server,
  Scale,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { StagedDraftOrder, approveDraftOrder, cancelDraftOrder } from '@/services/tastytrade';
import { BuyingPowerComparisonCard } from './aiTrading/BuyingPowerComparisonCard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface DraftOrderCardProps {
  initialDraft?: StagedDraftOrder;
  draft?: StagedDraftOrder;
  onStatusChange?: (updated: StagedDraftOrder) => void;
  onExecuted?: () => void;
}

export function DraftOrderCard(props: DraftOrderCardProps) {
  const currentDraft = props.initialDraft || props.draft;
  if (!currentDraft) return null;

  const [draft, setDraft] = useState<StagedDraftOrder>(currentDraft);
  const [limitPrice, setLimitPrice] = useState<number | undefined>(currentDraft.price);
  const [quantity, setQuantity] = useState<number>(currentDraft.quantity || 1);
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showBpAnalyser, setShowBpAnalyser] = useState(true);

  React.useEffect(() => {
    const next = props.initialDraft || props.draft;
    if (next) {
      setDraft(next);
      setLimitPrice(next.price);
      setQuantity(next.quantity || 1);
    }
  }, [props.initialDraft, props.draft]);

  const isBuy = draft.action.toUpperCase().includes('BUY');
  const isPending = draft.status === 'PENDING_APPROVAL';
  const isExecuted = draft.status === 'EXECUTED';
  const isCancelled = draft.status === 'CANCELLED';

  const brokerLabel = draft.broker === 'alpaca'
    ? 'Alpaca Paper'
    : draft.broker === 'ibkr'
    ? 'Interactive Brokers'
    : 'Tastytrade Sandbox';

  const brokerEndpoint = draft.broker === 'alpaca'
    ? 'paper-api.alpaca.markets'
    : draft.broker === 'ibkr'
    ? 'localhost:5000/v1/api (Paper)'
    : 'api.cert.tastyworks.com';

  const handleApprove = async () => {
    if (!isPending || isApproving) return;
    setIsApproving(true);

    try {
      const hasOverrides = (limitPrice !== undefined && limitPrice !== currentDraft.price) || (quantity !== currentDraft.quantity);
      const res = hasOverrides
        ? await approveDraftOrder(draft.draftId, { price: limitPrice, quantity })
        : await approveDraftOrder(draft.draftId);

      setDraft(res.draft);
      props.onStatusChange?.(res.draft);
      props.onExecuted?.();
      toast.success('Trade Approved & Executed!', {
        description: `Submitted order for ${res.draft.quantity || quantity} ${draft.symbol} to ${brokerLabel}. Order ID: #${res.orderId || 'SUCCESS'}`
      });
    } catch (err: any) {
      console.error('Approval failed:', err);
      toast.error('Trade Execution Failed', {
        description: err.message || `Could not execute trade on ${brokerLabel}.`
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleCancel = async () => {
    if (!isPending || isCancelling) return;
    setIsCancelling(true);

    try {
      const res = await cancelDraftOrder(draft.draftId);
      setDraft(res.draft);
      onStatusChange?.(res.draft);
      toast.info('Trade Draft Discarded', {
        description: `Order draft ${draft.draftId} was cancelled without routing.`
      });
    } catch (err: any) {
      toast.error('Cancel Failed', { description: err.message });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Card className="my-3 border border-slate-700/80 bg-slate-950/95 text-slate-100 rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
      {/* Top Banner: Broker Environment & Hard-Stop Notice */}
      <div className="bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-purple-500/15 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1 py-0.5 px-2"
          >
            <Server className="w-3 h-3 text-amber-400" />
            <span>{brokerLabel}</span>
          </Badge>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            {brokerEndpoint}
          </span>
        </div>

        {/* Dynamic Status Badge */}
        <div>
          {isPending && (
            <Badge className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>Awaiting Trade Approval</span>
            </Badge>
          )}
          {isExecuted && (
            <Badge className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Executed in Sandbox</span>
            </Badge>
          )}
          {isCancelled && (
            <Badge className="text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-slate-400" />
              <span>Draft Cancelled</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Main Order Details Grid */}
      <div className="p-4 space-y-3.5 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">Action & Side</span>
            <span
              className={cn(
                "inline-block font-mono font-bold text-xs px-2 py-0.5 rounded",
                isBuy
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              )}
            >
              {draft.action}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">Symbol</span>
            <span className="font-mono font-bold text-sm text-white tracking-wide">
              {draft.symbol}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {draft.instrumentType}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">Quantity</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-slate-100">
                {quantity} {draft.instrumentType === 'Equity Option' ? 'Contracts' : 'Shares'}
              </span>
              {isPending && (
                <input
                  type="number"
                  min={1}
                  max={10000}
                  aria-label="Quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 h-6 px-1.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none text-center"
                  title="Change order quantity"
                />
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">Order Type</span>
            <div className="font-mono font-semibold text-slate-200 flex flex-wrap items-center gap-1.5">
              <span>{draft.orderType}</span>
              {isPending && draft.orderType === 'Limit' ? (
                <div className="inline-flex items-center gap-0.5 bg-slate-800/90 border border-emerald-500/40 px-2 py-0.5 rounded shadow-xs">
                  <span className="text-slate-400 text-xs font-mono">$</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    aria-label="Limit Price"
                    value={limitPrice !== undefined ? limitPrice : ''}
                    onChange={(e) => setLimitPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="w-20 bg-transparent text-emerald-300 font-bold font-mono text-xs focus:outline-none"
                    placeholder="1.50"
                  />
                </div>
              ) : (
                <span>{draft.price ? ` @ $${draft.price.toFixed(2)}` : ' (Market)'}</span>
              )}
            </div>
            {isPending && draft.orderType === 'Limit' && (
              <span className="text-[9px] text-slate-400 block font-mono mt-0.5">
                Original: ${draft.price?.toFixed(2)} &bull; Editable
              </span>
            )}
            <span className="text-[10px] text-slate-400 block font-mono">
              TIF: {draft.timeInForce}
            </span>
          </div>
        </div>

        {/* Option Leg Specifics (if Option) */}
        {draft.optionDetails && (
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono">
            <span className="text-purple-300 font-medium">
              Strike: ${draft.optionDetails.strikePrice} {draft.optionDetails.optionType}
            </span>
            <span className="text-slate-400">
              Expiry: {draft.optionDetails.expirationDate}
            </span>
          </div>
        )}

        {/* Dry-run Preflight Telemetry */}
        {draft.dryRunResult && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60">
            <div>
              <span className="text-slate-400 block text-[10px]">Estimated Notional / BP</span>
              <span className="text-slate-200 font-semibold">
                ${((limitPrice !== undefined ? limitPrice : (draft.price || 0)) * quantity * (draft.instrumentType === 'Equity Option' ? 100 : 1)).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Est. Commission & Fees</span>
              <span className="text-slate-200">
                ${((draft.dryRunResult.estimatedCommission || 0) + (draft.dryRunResult.estimatedFees || 0)).toFixed(2)}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-400 block text-[10px]">Draft ID</span>
              <span className="text-slate-400 truncate block text-[10px]" title={draft.draftId}>
                {draft.draftId}
              </span>
            </div>
          </div>
        )}

        {/* Strategic Reasoning */}
        {draft.notes && (
          <p className="text-[11px] text-slate-300 italic border-l-2 border-primary/50 pl-2.5 py-0.5">
            <span className="font-semibold text-slate-200 not-italic">Thesis: </span>
            {draft.notes}
          </p>
        )}

        {/* Buying Power Analyser Section & Routing Switch */}
        <div className="pt-1.5 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowBpAnalyser(!showBpAnalyser)}
              className="flex items-center gap-1.5 text-xs font-mono font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Buying Power Analyser (Tastytrade vs. IBKR)</span>
              {showBpAnalyser ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {draft.buyingPowerComparison?.verdict && (
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/10">
                Recommended: {draft.buyingPowerComparison.verdict.recommendedBroker.toUpperCase()}
              </Badge>
            )}
          </div>

          {showBpAnalyser && (
            <BuyingPowerComparisonCard
              draft={draft}
              comparison={draft.buyingPowerComparison}
              onBrokerSwitched={(updatedDraft) => {
                setDraft(updatedDraft);
                props.onStatusChange?.(updatedDraft);
              }}
            />
          )}
        </div>

        {/* Post-execution info */}
        {isExecuted && draft.executionResult && (
          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-lg p-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs space-y-0.5">
              <p className="font-semibold text-emerald-300">
                Order Live on {brokerLabel}
              </p>
              <p className="font-mono text-[11px] text-slate-300">
                Order ID: <span className="text-white font-bold">#{draft.executionResult.orderId}</span>
                {draft.executionResult.executedAt && (
                  <span className="text-slate-400 ml-2">
                    ({new Date(draft.executionResult.executedAt).toLocaleTimeString()})
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Human-in-the-Loop Action Bar */}
        {isPending && (
          <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Requires physical approval. You can adjust price & qty above before executing.</span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling || isApproving}
                className="h-8 text-xs border-slate-700 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30 text-slate-300 font-mono"
              >
                {isCancelling ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                Cancel Draft
              </Button>

              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isApproving || isCancelling}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold font-mono shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 px-3.5"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting to {brokerLabel}...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Trade</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
