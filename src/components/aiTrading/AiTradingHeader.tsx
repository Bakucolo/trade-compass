import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  TrendingUp, 
  DollarSign, 
  Wallet, 
  Activity,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  useAlpacaAccount, 
  useAlpacaStatus, 
  useAiTradingSettings, 
  useUpdateAiTradingSettings,
  useLiquidateAll,
  useScanStrategies
} from '@/services/aiTradingService';

interface AiTradingHeaderProps {
  onRefresh?: () => void;
}

export const AiTradingHeader: React.FC<AiTradingHeaderProps> = ({ onRefresh }) => {
  const { toast } = useToast();
  const { data: account, isLoading: isAccountLoading, refetch: refetchAccount } = useAlpacaAccount();
  const { data: status } = useAlpacaStatus();
  const { data: settings } = useAiTradingSettings();
  const updateSettings = useUpdateAiTradingSettings();
  const liquidateAllMutation = useLiquidateAll();
  const scanMutation = useScanStrategies();

  const [isKillSwitchConfirmOpen, setIsKillSwitchConfirmOpen] = useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
    try { return localStorage.getItem('ai-trading-hide-balance') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('ai-trading-hide-balance', String(isBalanceHidden)); } catch {}
  }, [isBalanceHidden]);

  const masked = (value: string) => isBalanceHidden ? '••••••' : value;
  const formatDollar = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isLive = settings?.accountMode === 'LIVE';
  const isKillSwitchActive = Boolean(settings?.masterKillSwitch);

  const portfolioValue = account ? parseFloat(account.portfolio_value) : 0;
  const buyingPower = account ? parseFloat(account.buying_power) : 0;
  const cash = account ? parseFloat(account.cash) : 0;
  const lastEquity = account ? parseFloat(account.last_equity) : portfolioValue;
  const dayPnL = portfolioValue - lastEquity;
  const dayPnLPct = lastEquity > 0 ? (dayPnL / lastEquity) * 100 : 0;

  const handleToggleKillSwitch = async () => {
    try {
      const nextState = !isKillSwitchActive;
      await updateSettings.mutateAsync({ masterKillSwitch: nextState });
      toast({
        title: nextState ? 'Master Kill Switch ENGAGED' : 'Trading Engine RESUMED',
        description: nextState 
          ? 'All autonomous trading and new order executions are halted.' 
          : 'AI strategy scanning and authorized trading have resumed.',
        variant: nextState ? 'destructive' : 'default',
      });
    } catch (err: any) {
      toast({ title: 'Error toggling Kill Switch', description: err.message, variant: 'destructive' });
    }
  };

  const handleLiquidateAll = async () => {
    try {
      await liquidateAllMutation.mutateAsync();
      toast({
        title: 'Emergency Liquidation Complete',
        description: 'All open paper positions closed and active orders canceled.',
        variant: 'destructive',
      });
      refetchAccount();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: 'Liquidation Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleManualScan = async () => {
    try {
      const res = await scanMutation.mutateAsync();
      toast({
        title: 'Strategy Scan Completed',
        description: `Evaluated ${res.evaluatedCount} active strategies. Generated ${res.signalsGenerated?.length || 0} signal(s).`,
      });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: 'Scan Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Strip */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">AI Autonomous Trading</h1>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsBalanceHidden(prev => !prev)}
                title={isBalanceHidden ? 'Show balances' : 'Hide balances'}
              >
                {isBalanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              {isLive ? (
                <Badge variant="destructive" className="font-semibold uppercase tracking-wider text-xs">
                  LIVE TRADING ACTIVE
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold uppercase tracking-wider text-xs">
                  ALPACA PAPER TRADING
                </Badge>
              )}
              {status?.connected ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  API Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                  API Offline
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Alpaca Paper Account • Strict User Position Sizing: <span className="text-foreground font-medium">
                {settings?.sizingMode === 'FIXED_DOLLAR' && `$${settings.fixedDollarAmount} Fixed`}
                {settings?.sizingMode === 'PERCENT_OF_PORTFOLIO' && `${settings.portfolioPercent}% of Portfolio`}
                {settings?.sizingMode === 'FIXED_SHARES' && `${settings.fixedShares} Shares`}
              </span> • Mode: <span className="text-foreground font-medium">{settings?.executionMode === 'AUTOMATED' ? 'Auto-Execute' : 'Manual Approval Required'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Scan Now Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleManualScan} 
            disabled={scanMutation.isPending || isKillSwitchActive}
            className="text-xs h-9 border-border"
          >
            <Zap className={`w-3.5 h-3.5 mr-1.5 text-amber-400 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
            {scanMutation.isPending ? 'Scanning...' : 'Scan Strategies'}
          </Button>

          {/* Master Kill Switch */}
          <Button
            variant={isKillSwitchActive ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleKillSwitch}
            disabled={updateSettings.isPending}
            className={`text-xs h-9 font-medium transition-colors ${
              isKillSwitchActive 
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700' 
                : 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10'
            }`}
          >
            {isKillSwitchActive ? (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Resume Trading
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 mr-1.5" />
                Pause Trading Engine
              </>
            )}
          </Button>

          {/* Emergency Liquidation Dialog */}
          <AlertDialog open={isKillSwitchConfirmOpen} onOpenChange={setIsKillSwitchConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="text-xs h-9 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Liquidate All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-rose-500 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" />
                  Emergency Liquidate All Paper Positions?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action will immediately cancel all pending orders and submit market sell orders to close all open positions in your Alpaca {isLive ? 'LIVE' : 'PAPER'} account.
                  Are you sure you want to proceed?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleLiquidateAll} 
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Yes, Liquidate All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Kill Switch Warning Banner if Active */}
      {isKillSwitchActive && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <div className="flex-1">
            <span className="font-semibold">Master Kill Switch is Engaged.</span> All autonomous trade executions and new entries are currently blocked. Click &quot;Resume Trading&quot; to restore active scanning.
          </div>
        </div>
      )}

      {/* Account Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Portfolio Value */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Portfolio Value</span>
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {isAccountLoading ? '...' : masked(formatDollar(portfolioValue))}
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs">
            <span className={dayPnL >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {masked(`${dayPnL >= 0 ? '+' : ''}$${dayPnL.toFixed(2)} (${dayPnLPct >= 0 ? '+' : ''}${dayPnLPct.toFixed(2)}%)`)}
            </span>
            <span className="text-muted-foreground text-[11px]">Today</span>
          </div>
        </div>

        {/* Buying Power */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Buying Power</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {isAccountLoading ? '...' : masked(formatDollar(buyingPower))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Alpaca 4x Daytrading / 2x Overnight
          </div>
        </div>

        {/* Cash Balance */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Settled Cash</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {isAccountLoading ? '...' : masked(formatDollar(cash))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Currency: {account?.currency || 'USD'}
          </div>
        </div>

        {/* Guardrail Safety Status */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>User Position Guardrail</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-foreground mt-1 truncate">
            {settings?.sizingMode === 'FIXED_DOLLAR' && masked(`$${settings.fixedDollarAmount} / trade`)}
            {settings?.sizingMode === 'PERCENT_OF_PORTFOLIO' && masked(`${settings.portfolioPercent}% portfolio`)}
            {settings?.sizingMode === 'FIXED_SHARES' && masked(`${settings.fixedShares} shares / trade`)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Max Pos: {masked(`$${settings?.maxSinglePositionDollar}`)} • Max Open: {settings?.maxOpenPositions}
          </div>
        </div>
      </div>
    </div>
  );
};
