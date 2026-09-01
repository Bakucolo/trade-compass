import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell,
  BellOff,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Zap,
  Plus,
  Trash2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAlerts,
  useMuteAlert,
  useUnmuteAlert,
  useDeleteAlert,
  useDeleteMutedAlerts,
  useBulkMuteAlerts,
  PriceAlert,
} from '@/services/alertService';
import { PriceAlertModal } from '../PriceAlertModal';
import { useToast } from '@/components/ui/use-toast';

interface DashboardAlertsCardProps {
  onNavigateToAlerts?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function DashboardAlertsCard({
  onNavigateToAlerts,
  onNavigateToResearch,
}: DashboardAlertsCardProps) {
  const { toast } = useToast();
  const { data: alerts = [], isLoading } = useAlerts({ sortBy: 'triggeredAt', sortDir: 'desc' });
  const muteAlertMutation = useMuteAlert();
  const unmuteAlertMutation = useUnmuteAlert();
  const deleteAlertMutation = useDeleteAlert();
  const deleteMutedMutation = useDeleteMutedAlerts();
  const bulkMuteMutation = useBulkMuteAlerts();

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [selectedStockForAlert, setSelectedStockForAlert] = useState<{
    symbol: string;
    price: number;
    name: string;
    condition?: 'ABOVE' | 'BELOW';
    notes?: string;
  } | null>(null);

  const unmutedTriggered = alerts.filter((a) => a.status === 'TRIGGERED' && !a.isMuted);
  const mutedTriggered = alerts.filter((a) => a.status === 'TRIGGERED' && a.isMuted);
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');

  // Display prioritized: unmuted triggered alerts first, then active targets
  const displayAlerts = unmutedTriggered.length > 0
    ? [...unmutedTriggered, ...activeAlerts].slice(0, 4)
    : [...activeAlerts, ...mutedTriggered].slice(0, 4);

  const handleSetAlertClick = (e: React.MouseEvent, alert: PriceAlert) => {
    e.stopPropagation();
    setSelectedStockForAlert({
      symbol: alert.symbol,
      price: alert.currentPrice || alert.triggeredPrice || alert.targetPrice || 0,
      name: alert.stockName || `${alert.symbol} Equity`,
      condition: alert.condition === 'ABOVE' ? 'ABOVE' : 'BELOW',
      notes: `Follow-up alert after alert hit at $${(alert.triggeredPrice || alert.targetPrice).toFixed(2)}`,
    });
    setIsAlertModalOpen(true);
  };

  const handleMuteClick = async (e: React.MouseEvent, alertId: string, symbol: string) => {
    e.stopPropagation();
    try {
      await muteAlertMutation.mutateAsync(alertId);
      toast({
        title: "Alert Muted",
        description: `Alert for ${symbol} has been muted and acknowledged.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to mute alert",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleUnmuteClick = async (e: React.MouseEvent, alertId: string, symbol: string) => {
    e.stopPropagation();
    try {
      await unmuteAlertMutation.mutateAsync(alertId);
      toast({
        title: "Alert Unmuted",
        description: `Alert for ${symbol} is now active.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to unmute alert",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, alertId: string, symbol: string) => {
    e.stopPropagation();
    try {
      await deleteAlertMutation.mutateAsync(alertId);
      toast({
        title: "Alert Deleted",
        description: `Price alert for ${symbol} was removed.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to delete alert",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleBulkMuteFired = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await bulkMuteMutation.mutateAsync();
      toast({
        title: "All Fired Alerts Muted",
        description: `Muted ${res.count} triggered alert(s).`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to mute alerts",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleClearMuted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await deleteMutedMutation.mutateAsync();
      toast({
        title: "Muted Alerts Cleared",
        description: `Deleted ${res.count} muted alert(s).`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to delete muted alerts",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center border',
            unmutedTriggered.length > 0
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          )}>
            {unmutedTriggered.length > 0 ? <Bell className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-foreground">
                Triggered & Active Alerts
              </CardTitle>
              {unmutedTriggered.length > 0 ? (
                <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[9px] px-1.5 py-0 h-4 font-mono font-bold uppercase animate-pulse">
                  {unmutedTriggered.length} New Fired
                </Badge>
              ) : mutedTriggered.length > 0 ? (
                <Badge variant="outline" className="bg-slate-800 text-muted-foreground border-border/50 text-[9px] px-1.5 py-0 h-4 font-mono">
                  {mutedTriggered.length} Muted
                </Badge>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Price targets, breakout levels & triggered alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 1-Click Bulk Action for Fired Alerts */}
          {unmutedTriggered.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkMuteFired}
              disabled={bulkMuteMutation.isPending}
              className="h-7 text-[10px] border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 gap-1 px-2 font-semibold"
              title="Mute all fired alerts"
            >
              <BellOff className="w-3 h-3" />
              <span>Mute All</span>
            </Button>
          )}

          {/* 1-Click Clear Muted Alerts */}
          {mutedTriggered.length > 0 && unmutedTriggered.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearMuted}
              disabled={deleteMutedMutation.isPending}
              className="h-7 text-[10px] border-slate-700 bg-slate-800/80 hover:bg-rose-950/30 hover:border-rose-500/40 text-muted-foreground hover:text-rose-300 gap-1 px-2 font-semibold"
              title="Delete all muted alerts"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Muted ({mutedTriggered.length})</span>
            </Button>
          )}

          {/* Button to go to full Alerts Center */}
          {onNavigateToAlerts && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToAlerts}
              className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 font-semibold"
              title="Open full Alerts Center"
            >
              <span className="hidden sm:inline">Alerts Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-2.5">
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-xs">Checking live alerts...</p>
          </div>
        ) : displayAlerts.length === 0 ? (
          <div className="py-8 text-center space-y-2 text-xs text-muted-foreground">
            <p>No active or triggered price alerts.</p>
            {onNavigateToAlerts && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToAlerts}
                className="text-xs h-7 gap-1"
              >
                <Zap className="w-3 h-3 text-amber-400" /> Set Price Alert
              </Button>
            )}
          </div>
        ) : (
          displayAlerts.map((alert) => {
            const isTriggered = alert.status === 'TRIGGERED';
            const isMuted = Boolean(alert.isMuted);
            const isAbove = alert.condition === 'ABOVE';

            return (
              <div
                key={alert.id}
                onClick={() => onNavigateToResearch && onNavigateToResearch(alert.symbol)}
                className={cn(
                  'p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group',
                  isTriggered && !isMuted
                    ? 'bg-rose-950/20 hover:bg-rose-950/30 border-rose-800/50 hover:border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.1)]'
                    : isMuted
                    ? 'bg-slate-900/40 hover:bg-slate-900/60 border-border/40 opacity-75'
                    : 'bg-accent/20 hover:bg-accent/40 border-border/50 hover:border-primary/30'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs border shrink-0',
                      isTriggered && !isMuted
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : isMuted
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-primary/10 text-primary border-primary/30'
                    )}
                  >
                    {isMuted ? <BellOff className="w-4 h-4" /> : alert.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors">
                        {alert.symbol}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {isAbove ? '≥' : '≤'} ${alert.targetPrice.toFixed(2)}
                      </span>
                      {isTriggered && !isMuted && (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono font-bold px-1.5 py-0 h-4 uppercase bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                        >
                          FIRED
                        </Badge>
                      )}
                      {isMuted && (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono font-medium px-1.5 py-0 h-4 uppercase bg-slate-800 text-slate-400 border-slate-700"
                        >
                          MUTED
                        </Badge>
                      )}
                      {!isTriggered && (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono font-bold px-1.5 py-0 h-4 uppercase bg-accent text-muted-foreground border-border/60"
                        >
                          ACTIVE
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                      {alert.notes || (isTriggered ? `Fired at $${alert.triggeredPrice?.toFixed(2) || alert.targetPrice.toFixed(2)}` : `Target: ${isAbove ? 'Breakout above' : 'Drop below'} $${alert.targetPrice.toFixed(2)}`)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="text-right font-mono shrink-0 mr-1">
                    {alert.currentPrice && (
                      <span className="text-xs font-bold text-foreground block">
                        ${alert.currentPrice.toFixed(2)}
                      </span>
                    )}
                    {alert.triggeredAt ? (
                      <span className={cn("text-[10px] font-mono flex items-center justify-end gap-1", isMuted ? "text-muted-foreground" : "text-rose-400")}>
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(alert.triggeredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    ) : alert.distancePercent !== undefined && alert.distancePercent !== null ? (
                      <span className="text-[10px] text-muted-foreground">
                        {alert.distancePercent > 0 ? '+' : ''}{alert.distancePercent.toFixed(1)}% away
                      </span>
                    ) : null}
                  </div>

                  {/* Set Alert Button directly from the alert */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleSetAlertClick(e, alert)}
                    className={cn(
                      "h-7 px-2 text-[10px] font-bold gap-1 shrink-0 transition-all",
                      isTriggered && !isMuted
                        ? "border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary shadow-sm"
                        : "border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground"
                    )}
                    title={`Set a new price alert for ${alert.symbol}`}
                  >
                    <Plus className="w-3 h-3 text-primary" />
                    <span className="hidden sm:inline">Set Alert</span>
                  </Button>

                  {/* 1-Click Mute / Unmute Button */}
                  {isMuted ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleUnmuteClick(e, alert.id, alert.symbol)}
                      className="h-7 px-2 text-[10px] border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold gap-1 shrink-0"
                      title="Unmute Alert"
                    >
                      <Bell className="w-3 h-3 text-amber-400" />
                      <span className="hidden sm:inline">Unmute</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleMuteClick(e, alert.id, alert.symbol)}
                      className={cn(
                        "h-7 px-2 text-[10px] font-semibold gap-1 shrink-0",
                        isTriggered
                          ? "border-rose-500/30 hover:bg-rose-500/20 text-rose-300"
                          : "border-border/60 hover:bg-accent/50 text-muted-foreground"
                      )}
                      title="Mute Alert"
                    >
                      <BellOff className="w-3 h-3" />
                      <span className="hidden sm:inline">Mute</span>
                    </Button>
                  )}

                  {/* 1-Click Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteClick(e, alert.id, alert.symbol)}
                    className="h-7 w-7 text-muted-foreground hover:text-rose-400 hover:bg-rose-950/30 shrink-0"
                    title={`Delete alert for ${alert.symbol}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Price Alert Modal for 1-Click Setup */}
      <PriceAlertModal
        open={isAlertModalOpen}
        onOpenChange={setIsAlertModalOpen}
        initialSymbol={selectedStockForAlert?.symbol || ''}
        initialPrice={selectedStockForAlert?.price || 0}
        initialStockName={selectedStockForAlert?.name || ''}
        initialCondition={selectedStockForAlert?.condition}
        initialNotes={selectedStockForAlert?.notes}
      />
    </Card>
  );
}
