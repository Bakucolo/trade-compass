import React, { useState, useEffect } from 'react';
import { 
  useAiTradingSettings, 
  useUpdateAiTradingSettings,
  AiTradingSettings 
} from '@/services/aiTradingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  ShieldCheck, 
  ShieldAlert, 
  DollarSign, 
  Percent, 
  Sliders, 
  Save, 
  Key, 
  AlertTriangle,
  Lock,
  Unlock
} from 'lucide-react';

export const AiSettingsGuardrails: React.FC = () => {
  const { toast } = useToast();
  const { data: settings, isLoading } = useAiTradingSettings();
  const updateSettingsMutation = useUpdateAiTradingSettings();

  const [formData, setFormData] = useState<Partial<AiTradingSettings>>({});
  const [isLiveConfirmOpen, setIsLiveConfirmOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (field: keyof AiTradingSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await updateSettingsMutation.mutateAsync(formData);
      toast({
        title: 'Safety Guardrails Saved',
        description: 'Position sizing rules and execution safety parameters updated.',
      });
    } catch (err: any) {
      toast({
        title: 'Save Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleModeChange = (newMode: 'PAPER' | 'LIVE') => {
    if (newMode === 'LIVE') {
      setIsLiveConfirmOpen(true);
    } else {
      handleChange('accountMode', 'PAPER');
    }
  };

  const confirmLiveMode = () => {
    handleChange('accountMode', 'LIVE');
    setIsLiveConfirmOpen(false);
    toast({
      title: 'Switched to LIVE Trading Mode',
      description: 'Real money trading is now enabled. Please ensure ALPACA_LIVE_API_KEY is configured.',
      variant: 'destructive',
    });
  };

  if (isLoading || !formData) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading guardrail settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Position Sizing Master Section */}
      <div className="p-6 rounded-xl bg-card border border-border space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Strict User-Controlled Position Sizing
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI agents and strategies will <strong className="text-foreground">never</strong> choose their own position size. Every order execution is strictly clamped to your formula.
            </p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs">
            Hard Safety Enforcement
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Sizing Mode */}
          <div>
            <Label className="text-xs text-muted-foreground">Position Sizing Method</Label>
            <Select
              value={formData.sizingMode || 'FIXED_DOLLAR'}
              onValueChange={(val: any) => handleChange('sizingMode', val)}
            >
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue placeholder="Sizing Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED_DOLLAR">Fixed Dollar ($) per Position</SelectItem>
                <SelectItem value="PERCENT_OF_PORTFOLIO">% of Portfolio Value</SelectItem>
                <SelectItem value="FIXED_SHARES">Fixed Share Count per Trade</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              How the system sizes every trade entered by AI strategies.
            </p>
          </div>

          {/* Mode-Specific Value Input */}
          {formData.sizingMode === 'FIXED_DOLLAR' && (
            <div>
              <Label className="text-xs text-muted-foreground">Fixed Dollar Amount ($)</Label>
              <div className="relative mt-1">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <Input
                  type="number"
                  value={formData.fixedDollarAmount || 1000}
                  onChange={(e) => handleChange('fixedDollarAmount', parseFloat(e.target.value))}
                  className="pl-8 text-sm font-semibold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                e.g. $1,000 per position (buys ~5 shares of a $200 stock).
              </p>
            </div>
          )}

          {formData.sizingMode === 'PERCENT_OF_PORTFOLIO' && (
            <div>
              <Label className="text-xs text-muted-foreground">Portfolio Allocation (%)</Label>
              <div className="relative mt-1">
                <Percent className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <Input
                  type="number"
                  value={formData.portfolioPercent || 5.0}
                  step="0.5"
                  onChange={(e) => handleChange('portfolioPercent', parseFloat(e.target.value))}
                  className="pl-8 text-sm font-semibold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                e.g. 5.0% of your total account value per trade.
              </p>
            </div>
          )}

          {formData.sizingMode === 'FIXED_SHARES' && (
            <div>
              <Label className="text-xs text-muted-foreground">Fixed Number of Shares</Label>
              <Input
                type="number"
                value={formData.fixedShares || 10}
                onChange={(e) => handleChange('fixedShares', parseInt(e.target.value, 10))}
                className="mt-1 text-sm font-semibold"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                e.g. Exactly 10 shares per trade regardless of price.
              </p>
            </div>
          )}

          {/* Hard Ceiling Maximum Allocation */}
          <div>
            <Label className="text-xs text-muted-foreground">Max Capital Ceiling ($)</Label>
            <div className="relative mt-1">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              <Input
                type="number"
                value={formData.maxSinglePositionDollar || 5000}
                onChange={(e) => handleChange('maxSinglePositionDollar', parseFloat(e.target.value))}
                className="pl-8 text-sm font-semibold"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Absolute max dollars allowed in any single position.
            </p>
          </div>
        </div>

        {/* Secondary Safety Ceilings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border/50">
          <div>
            <Label className="text-xs text-muted-foreground">Max Open Positions</Label>
            <Input
              type="number"
              value={formData.maxOpenPositions || 5}
              onChange={(e) => handleChange('maxOpenPositions', parseInt(e.target.value, 10))}
              className="mt-1 text-sm font-medium"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Prevents the engine from opening more than X positions simultaneously.
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Default Stop Loss (%)</Label>
            <Input
              type="number"
              step="0.5"
              value={formData.defaultStopLossPercent || 3.5}
              onChange={(e) => handleChange('defaultStopLossPercent', parseFloat(e.target.value))}
              className="mt-1 text-sm font-medium"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Automatic bracket order stop loss protection.
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Default Take Profit (%)</Label>
            <Input
              type="number"
              step="0.5"
              value={formData.defaultTakeProfitPercent || 7.0}
              onChange={(e) => handleChange('defaultTakeProfitPercent', parseFloat(e.target.value))}
              className="mt-1 text-sm font-medium"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Automatic bracket order profit target.
            </p>
          </div>
        </div>
      </div>

      {/* Execution Behavior & Mode Control */}
      <div className="p-6 rounded-xl bg-card border border-border space-y-5">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            Execution Mode & Live Trading Preparedness
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure how trade recommendations are executed and prepare for future Live account rollout.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Order Execution Authorization */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
            <Label className="text-xs font-semibold text-foreground">Order Execution Flow</Label>
            <Select
              value={formData.executionMode || 'MANUAL_APPROVAL'}
              onValueChange={(val: any) => handleChange('executionMode', val)}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Execution Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL_APPROVAL">
                  Manual Approval Required (Safe / Recommended)
                </SelectItem>
                <SelectItem value="AUTOMATED">
                  Autonomous Execution (Auto-submits to Alpaca)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {formData.executionMode === 'MANUAL_APPROVAL'
                ? 'AI Agent generates trade signals with pre-calculated sizes. You click "Approve" before orders are sent to Alpaca.'
                : 'AI Agent automatically submits paper orders as soon as strategy criteria trigger, strictly constrained to your position size.'}
            </p>
          </div>

          {/* Paper vs Live Mode Switcher */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">Broker Account Environment</Label>
              {formData.accountMode === 'LIVE' ? (
                <Badge variant="destructive" className="text-[10px]">LIVE ACTIVE</Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">PAPER ACTIVE</Badge>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.accountMode === 'PAPER' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('PAPER')}
                className={`flex-1 text-xs ${formData.accountMode === 'PAPER' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              >
                Paper Trading (Simulated)
              </Button>
              <Button
                type="button"
                variant={formData.accountMode === 'LIVE' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('LIVE')}
                className="flex-1 text-xs"
              >
                Live Trading (Real Money)
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formData.accountMode === 'PAPER'
                ? 'Using Alpaca Paper Sandbox (https://paper-api.alpaca.markets). Safe for testing strategies.'
                : 'Using Alpaca Live API. Ensure ALPACA_LIVE_API_KEY and ALPACA_LIVE_SECRET_KEY are in .env.local.'}
            </p>
          </div>
        </div>
      </div>

      {/* Save Settings Button */}
      <div className="flex items-center justify-end">
        <Button
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-5 font-semibold"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Safety Guardrails'}
        </Button>
      </div>

      {/* Live Trading Warning Modal */}
      <AlertDialog open={isLiveConfirmOpen} onOpenChange={setIsLiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Switch to Alpaca LIVE Account?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to switch the trading engine to <strong>LIVE REAL-MONEY TRADING</strong>.
              </p>
              <p className="text-xs bg-rose-500/10 text-rose-300 p-2.5 rounded border border-rose-500/20">
                Live trading carries substantial financial risk of loss. All orders will be placed using real capital. The system will continue to enforce your position size limits, but market slippage and volatility can occur.
              </p>
              <p className="text-xs text-muted-foreground">
                Ensure you have set <code>ALPACA_LIVE_API_KEY</code> and <code>ALPACA_LIVE_SECRET_KEY</code> in your <code>.env.local</code> file before activating.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in Paper Mode</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLiveMode}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              I Understand the Risks, Activate Live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
