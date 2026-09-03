import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PlannedTrade,
  CreatePlannedTradeInput,
  UpdatePlannedTradeInput,
  useCreatePlannedTrade,
  useUpdatePlannedTrade,
} from '@/services/plannedTradeService';
import { useCreateAlert } from '@/services/alertService';
import { useCreateTrade } from '@/services/tradeService';
import {
  Target,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  DollarSign,
  Layers,
  Calendar,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PlannedTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeToEdit?: PlannedTrade | null;
}

export function PlannedTradeModal({ isOpen, onClose, tradeToEdit }: PlannedTradeModalProps) {
  const isEditing = Boolean(tradeToEdit);
  const createMutation = useCreatePlannedTrade();
  const updateMutation = useUpdatePlannedTrade();
  const createAlertMutation = useCreateAlert();
  const createTradeMutation = useCreateTrade();

  const [symbol, setSymbol] = useState('');
  const [action, setAction] = useState('BUY');
  const [assetType, setAssetType] = useState('STOCK');
  const [timeframe, setTimeframe] = useState('DAY');
  const [orderType, setOrderType] = useState('LIMIT');
  const [quantity, setQuantity] = useState('100');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [targetExit, setTargetExit] = useState('');
  const [conviction, setConviction] = useState('HIGH');
  const [status, setStatus] = useState('PENDING');
  const [notes, setNotes] = useState('');

  // Integrated Price Alert Setup
  const [createAlert, setCreateAlert] = useState(false);
  const [alertCondition, setAlertCondition] = useState<'ABOVE' | 'BELOW'>('BELOW');
  const [alertTriggerPrice, setAlertTriggerPrice] = useState('');

  // Reset or populate fields when modal opens or tradeToEdit changes
  useEffect(() => {
    if (tradeToEdit) {
      setSymbol(tradeToEdit.symbol || '');
      setAction(tradeToEdit.action || 'BUY');
      setAssetType(tradeToEdit.assetType || 'STOCK');
      setTimeframe(tradeToEdit.timeframe || 'DAY');
      setOrderType(tradeToEdit.orderType || 'LIMIT');
      setQuantity(String(tradeToEdit.quantity || 100));
      setTargetPrice(tradeToEdit.targetPrice !== undefined && tradeToEdit.targetPrice !== null ? String(tradeToEdit.targetPrice) : '');
      setStopLoss(tradeToEdit.stopLoss !== undefined && tradeToEdit.stopLoss !== null ? String(tradeToEdit.stopLoss) : '');
      setTargetExit(tradeToEdit.targetExit !== undefined && tradeToEdit.targetExit !== null ? String(tradeToEdit.targetExit) : '');
      setConviction(tradeToEdit.conviction || 'HIGH');
      setStatus(tradeToEdit.status || 'PENDING');
      setNotes(tradeToEdit.notes || '');
      setCreateAlert(false);
      setAlertCondition(tradeToEdit.action === 'BUY' || tradeToEdit.action === 'BTO' ? 'BELOW' : 'ABOVE');
      setAlertTriggerPrice(tradeToEdit.targetPrice ? String(tradeToEdit.targetPrice) : '');
    } else {
      setSymbol('');
      setAction('BUY');
      setAssetType('STOCK');
      setTimeframe('DAY');
      setOrderType('LIMIT');
      setQuantity('100');
      setTargetPrice('');
      setStopLoss('');
      setTargetExit('');
      setConviction('HIGH');
      setStatus('PENDING');
      setNotes('');
      setCreateAlert(false);
      setAlertCondition('BELOW');
      setAlertTriggerPrice('');
    }
  }, [tradeToEdit, isOpen]);

  // Derived calculations (Capital, Risk, Reward, R:R)
  const stats = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(targetPrice) || 0;
    const sl = parseFloat(stopLoss) || 0;
    const tp = parseFloat(targetExit) || 0;

    const capital = qty * price;
    let riskPerUnit = 0;
    let rewardPerUnit = 0;
    let rrRatio = 0;

    const isLong = action === 'BUY' || action === 'BTO';
    const isShort = action === 'SHORT' || action === 'SELL' || action === 'STO';

    if (price > 0) {
      if (isLong) {
        if (sl > 0 && sl < price) riskPerUnit = price - sl;
        if (tp > 0 && tp > price) rewardPerUnit = tp - price;
      } else if (isShort) {
        if (sl > 0 && sl > price) riskPerUnit = sl - price;
        if (tp > 0 && tp < price) rewardPerUnit = price - tp;
      }

      if (riskPerUnit > 0 && rewardPerUnit > 0) {
        rrRatio = rewardPerUnit / riskPerUnit;
      }
    }

    return {
      capital,
      riskDollar: riskPerUnit * qty,
      rewardDollar: rewardPerUnit * qty,
      rrRatio: rrRatio > 0 ? rrRatio.toFixed(2) : null,
      riskPct: price > 0 && riskPerUnit > 0 ? ((riskPerUnit / price) * 100).toFixed(1) : null,
      rewardPct: price > 0 && rewardPerUnit > 0 ? ((rewardPerUnit / price) * 100).toFixed(1) : null,
    };
  }, [quantity, targetPrice, stopLoss, targetExit, action]);

  // Execute directly from modal
  const handleExecuteFromModal = async () => {
    if (!tradeToEdit) return;
    try {
      await updateMutation.mutateAsync({
        id: tradeToEdit.id,
        data: { status: 'EXECUTED' },
      });

      // Also record in Trade history
      try {
        await createTradeMutation.mutateAsync({
          broker: 'Manual',
          symbol: tradeToEdit.symbol,
          underlyingSymbol: tradeToEdit.underlyingSymbol || tradeToEdit.symbol,
          assetType: tradeToEdit.assetType === 'OPTION' ? 'OPTION' : 'EQUITY',
          action: tradeToEdit.action,
          side: tradeToEdit.action.startsWith('SELL') || tradeToEdit.action === 'SHORT' ? 'SELL' : 'BUY',
          positionEffect: tradeToEdit.action.startsWith('SELL') || tradeToEdit.action === 'SHORT' ? 'SHORT' : 'LONG',
          quantity: tradeToEdit.quantity,
          price: tradeToEdit.targetPrice || tradeToEdit.currentPrice || 0,
          totalValue: (tradeToEdit.targetPrice || tradeToEdit.currentPrice || 0) * tradeToEdit.quantity,
          executedAt: new Date().toISOString(),
          description: tradeToEdit.notes ? `Execution queue: ${tradeToEdit.notes}` : `Execution queue order for ${tradeToEdit.symbol}`,
        });
      } catch (e) {
        // Logging is supplementary
      }

      toast.success(`${tradeToEdit.symbol} (${tradeToEdit.action}) submitted as EXECUTED!`);
      onClose();
    } catch (err: any) {
      toast.error('Failed to submit trade as executed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      toast.error('Please enter a valid stock or option symbol');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }

    const parsedTarget = targetPrice ? parseFloat(targetPrice) : undefined;
    const parsedSL = stopLoss ? parseFloat(stopLoss) : undefined;
    const parsedTP = targetExit ? parseFloat(targetExit) : undefined;

    try {
      if (isEditing && tradeToEdit) {
        await updateMutation.mutateAsync({
          id: tradeToEdit.id,
          data: {
            symbol: cleanSymbol,
            action,
            assetType,
            timeframe,
            orderType,
            quantity: qty,
            targetPrice: parsedTarget,
            stopLoss: parsedSL,
            targetExit: parsedTP,
            conviction,
            status,
            notes,
          },
        });
        toast.success(`Updated planned trade for ${cleanSymbol}`);
      } else {
        await createMutation.mutateAsync({
          symbol: cleanSymbol,
          action,
          assetType,
          timeframe,
          orderType,
          quantity: qty,
          targetPrice: parsedTarget,
          stopLoss: parsedSL,
          targetExit: parsedTP,
          conviction,
          notes,
        });
        toast.success(`Planned ${action} ${cleanSymbol} added to execution queue`);
      }

      // Automatically create Price Alert if requested
      if (createAlert && alertTriggerPrice) {
        const triggerVal = parseFloat(alertTriggerPrice);
        if (!isNaN(triggerVal) && triggerVal > 0) {
          try {
            await createAlertMutation.mutateAsync({
              symbol: cleanSymbol,
              targetPrice: triggerVal,
              condition: alertCondition,
              notes: `Execution queue alert for ${action} ${cleanSymbol} @ $${triggerVal}`,
            });
            toast.success(`Price alert set for ${cleanSymbol} at $${triggerVal.toFixed(2)} (${alertCondition})`);
          } catch (alertErr: any) {
            toast.error(`Price alert creation failed: ${alertErr.message}`);
          }
        }
      }

      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error saving planned trade');
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto bg-card border-border/80 text-foreground p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {isEditing ? 'Edit Planned Trade' : 'Plan New Execution Order'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Queue tactical orders for day or weekly execution with ranked priority and risk parameters.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Action & Timeframe Selector Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Execution Horizon
              </Label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setTimeframe('DAY')}
                  className={cn(
                    'py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                    timeframe === 'DAY'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Today / Day</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('WEEK')}
                  className={cn(
                    'py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                    timeframe === 'WEEK'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>This Week</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Order Action
              </Label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 rounded-xl border border-border/50">
                {[
                  { id: 'BUY', label: 'BUY', color: 'bg-emerald-600 text-white' },
                  { id: 'SELL', label: 'SELL', color: 'bg-rose-600 text-white' },
                  { id: 'SHORT', label: 'SHORT', color: 'bg-amber-600 text-white' },
                  { id: 'BTO', label: 'BTO', color: 'bg-purple-600 text-white' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setAction(act.id)}
                    className={cn(
                      'py-1.5 rounded-lg text-xs font-bold transition-all text-center',
                      action === act.id
                        ? act.color
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Symbol & Asset Type */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="symbol" className="text-xs font-semibold text-foreground">
                Symbol / Contract <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="symbol"
                placeholder="e.g. NVDA, AAPL, SPY 241018C00550000"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="font-mono uppercase font-bold text-sm bg-background border-border/70"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Asset Class</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger className="bg-background border-border/70 text-xs">
                  <SelectValue placeholder="Asset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STOCK">Stock / Equity</SelectItem>
                  <SelectItem value="OPTION">Option Contract</SelectItem>
                  <SelectItem value="ETF">ETF</SelectItem>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Order Type, Quantity, and Limit Entry Price */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Order Type</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger className="bg-background border-border/70 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIMIT">Limit Order</SelectItem>
                  <SelectItem value="MARKET">Market Order</SelectItem>
                  <SelectItem value="STOP_LIMIT">Stop Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-semibold text-foreground">
                Quantity <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0.001"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono text-sm bg-background border-border/70"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetPrice" className="text-xs font-semibold text-foreground">
                Target Limit Price ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">$</span>
                <Input
                  id="targetPrice"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="pl-6 font-mono text-sm bg-background border-border/70"
                />
              </div>
            </div>
          </div>

          {/* Risk Management: Stop Loss & Profit Target */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/60">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="stopLoss" className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Stop Loss (Invalidation)
                </Label>
                {stats.riskPct && (
                  <span className="text-[10px] font-mono font-bold text-rose-400">
                    -{stats.riskPct}%
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-rose-400 font-mono">$</span>
                <Input
                  id="stopLoss"
                  type="number"
                  step="any"
                  placeholder="Exit if below..."
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="pl-6 font-mono text-sm bg-background border-rose-500/30 text-rose-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="targetExit" className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Profit Target (Take Profit)
                </Label>
                {stats.rewardPct && (
                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                    +{stats.rewardPct}%
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-emerald-400 font-mono">$</span>
                <Input
                  id="targetExit"
                  type="number"
                  step="any"
                  placeholder="Take profit at..."
                  value={targetExit}
                  onChange={(e) => setTargetExit(e.target.value)}
                  className="pl-6 font-mono text-sm bg-background border-emerald-500/30 text-emerald-300"
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics Calculation Strip */}
          <div className="grid grid-cols-3 gap-2 px-3 py-2 rounded-xl bg-card border border-border/50 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Est. Capital</span>
              <p className="font-mono font-bold text-foreground">
                ${stats.capital > 0 ? stats.capital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Max Risk ($)</span>
              <p className="font-mono font-bold text-rose-400">
                {stats.riskDollar > 0 ? `-$${stats.riskDollar.toFixed(2)}` : 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">R:R Ratio</span>
              <p className="font-mono font-bold text-emerald-400">
                {stats.rrRatio ? `1 : ${stats.rrRatio}` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Conviction & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Conviction Tier</Label>
              <Select value={conviction} onValueChange={setConviction}>
                <SelectTrigger className="bg-background border-border/70 text-xs">
                  <SelectValue placeholder="Conviction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">★★★ High Conviction</SelectItem>
                  <SelectItem value="MEDIUM">★★☆ Medium Conviction</SelectItem>
                  <SelectItem value="SPECULATIVE">★☆☆ Speculative / Tactical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isEditing ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Execution Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-background border-border/70 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending Execution</SelectItem>
                    <SelectItem value="TRIGGERED">Triggered / Filled</SelectItem>
                    <SelectItem value="EXECUTED">Executed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {/* Tactical Notes / Thesis */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-foreground">
              Tactical Thesis &amp; Execution Conditions
            </Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="e.g. Wait for 10:00 AM dip test of VWAP, enter 50% size, add remainder if breaks $125 with volume..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs bg-background border-border/70 resize-none"
            />
          </div>

          {/* Integrated Price Alert Setup */}
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-xs font-bold text-foreground block">Set Price Alert for this Trade</span>
                  <span className="text-[10px] text-muted-foreground">Receive instant alert when stock hits your target execution level</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextState = !createAlert;
                  setCreateAlert(nextState);
                  if (nextState && !alertTriggerPrice) {
                    setAlertTriggerPrice(targetPrice || stopLoss || '');
                  }
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 shrink-0',
                  createAlert
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                    : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', createAlert ? 'bg-amber-400' : 'bg-muted-foreground')} />
                {createAlert ? 'Alert Enabled' : 'Enable Alert'}
              </button>
            </div>

            {createAlert && (
              <div className="pt-2 border-t border-amber-500/20 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Alert Condition</Label>
                    <Select value={alertCondition} onValueChange={(v: 'ABOVE' | 'BELOW') => setAlertCondition(v)}>
                      <SelectTrigger className="h-8 bg-background border-border/70 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BELOW">Price Drops Below (≤ Target)</SelectItem>
                        <SelectItem value="ABOVE">Price Rises Above (≥ Target)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Trigger Price ($)</Label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">$</span>
                      <Input
                        type="number"
                        step="any"
                        value={alertTriggerPrice}
                        onChange={(e) => setAlertTriggerPrice(e.target.value)}
                        placeholder={targetPrice || '0.00'}
                        className="h-8 pl-5 font-mono text-xs bg-background border-border/70"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick selection presets */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="text-muted-foreground">Quick Target:</span>
                  {targetPrice && (
                    <button
                      type="button"
                      onClick={() => {
                        setAlertTriggerPrice(targetPrice);
                        setAlertCondition(action === 'BUY' || action === 'BTO' ? 'BELOW' : 'ABOVE');
                      }}
                      className="px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 font-mono font-bold"
                    >
                      Target (${targetPrice})
                    </button>
                  )}
                  {stopLoss && (
                    <button
                      type="button"
                      onClick={() => {
                        setAlertTriggerPrice(stopLoss);
                        setAlertCondition('BELOW');
                      }}
                      className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 font-mono font-bold"
                    >
                      Stop Loss (${stopLoss})
                    </button>
                  )}
                  {targetExit && (
                    <button
                      type="button"
                      onClick={() => {
                        setAlertTriggerPrice(targetExit);
                        setAlertCondition('ABOVE');
                      }}
                      className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 font-mono font-bold"
                    >
                      Take Profit (${targetExit})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs w-full sm:w-auto"
              >
                Cancel
              </Button>
              {isEditing && tradeToEdit && status !== 'EXECUTED' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExecuteFromModal}
                  className="text-xs font-bold text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/30 gap-1.5 w-full sm:w-auto"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Submit as Executed
                </Button>
              )}
            </div>

            <Button
              type="submit"
              disabled={isPending}
              size="sm"
              className="text-xs font-bold bg-primary text-primary-foreground gap-1.5 w-full sm:w-auto"
            >
              {isPending ? 'Saving...' : isEditing ? 'Update Planned Trade' : 'Add to Execution Queue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
