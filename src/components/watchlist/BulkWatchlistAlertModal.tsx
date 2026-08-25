import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Sparkles,
  Layers,
  Bell,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Trash2,
  Plus,
  Loader2,
  ArrowRight,
  FolderPlus,
  Zap,
  HelpCircle,
  RefreshCw,
  Sliders,
  Check,
  AlertCircle,
  Copy,
  ChevronDown
} from 'lucide-react';
import {
  useWatchlists,
  useResolveBulkEntries,
  useBulkAddSymbolsToWatchlist,
  useBulkCreateWatchlist,
  ResolvedBulkEntry,
  WatchlistSummary,
} from '@/services/watchlistService';
import { useBulkCreateAlerts } from '@/services/alertService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkWatchlistAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultWatchlistId?: string | null;
  onSuccess?: (watchlistId: string, addedCount: number, alertsCount: number) => void;
}

interface StagedEntry extends ResolvedBulkEntry {
  id: string;
  enableAlert: boolean;
}

const PRESET_TEMPLATES = [
  {
    name: 'Top Mega-Caps',
    icon: '🚀',
    text: 'AAPL 240 Breakout\nNVDA below 115 Dip buy\nMSFT 460 Support\nAMZN 195\nGOOGL 175\nMETA 550 Key level',
  },
  {
    name: 'AI & Semis',
    icon: '🤖',
    text: 'NVDA 115 Dip\nTSM 165 Value\nAMD 140\nAVGO 160\nASML 820\nARM 125',
  },
  {
    name: 'Cybersecurity',
    icon: '🛡️',
    text: 'CRWD 280 Long support\nPANW 340 Breakout\nFTNT 75 Dip\nZS 190\nNET 85',
  },
  {
    name: 'High Growth SaaS',
    icon: '📈',
    text: 'Palantir 35\nDDOG 120\nSNOW 130 Dip\nMDB 280\nPLTR 38 Breakout',
  },
];

export function BulkWatchlistAlertModal({
  isOpen,
  onClose,
  defaultWatchlistId,
  onSuccess,
}: BulkWatchlistAlertModalProps) {
  const { data: watchlists = [] } = useWatchlists();
  const resolveBulkMutation = useResolveBulkEntries();
  const bulkAddSymbolsMutation = useBulkAddSymbolsToWatchlist();
  const bulkCreateWatchlistMutation = useBulkCreateWatchlist();
  const bulkCreateAlertsMutation = useBulkCreateAlerts();

  // Mode & Destination State
  const [destinationMode, setDestinationMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [targetWatchlistId, setTargetWatchlistId] = useState<string>('');
  const [newWatchlistName, setNewWatchlistName] = useState<string>('');

  // Input & Staged Data
  const [rawText, setRawText] = useState<string>('');
  const [stagedItems, setStagedItems] = useState<StagedEntry[]>([]);
  const [hasParsed, setHasParsed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize selected watchlist
  useEffect(() => {
    if (defaultWatchlistId) {
      setTargetWatchlistId(defaultWatchlistId);
    } else if (watchlists.length > 0 && !targetWatchlistId) {
      const defaultW = watchlists.find((w) => w.isDefault) || watchlists[0];
      setTargetWatchlistId(defaultW.id);
    }
  }, [defaultWatchlistId, watchlists, targetWatchlistId]);

  // Reset modal on open
  useEffect(() => {
    if (isOpen) {
      if (!hasParsed && !rawText) {
        setRawText('AAPL 240 Breakout\nNVDA below 115 Dip buy\nAmazon 185\nPalantir\nMSFT 460');
      }
    }
  }, [isOpen]);

  // Parse Raw Text to Enriched Candidates
  const handleParseText = async (customText?: string) => {
    const textToParse = (customText ?? rawText).trim();
    if (!textToParse) {
      toast.error('Please enter at least one ticker or company name.');
      return;
    }

    try {
      const response = await resolveBulkMutation.mutateAsync(textToParse);
      if (!response.results || response.results.length === 0) {
        toast.warning('Could not parse any valid tickers or companies from the text.');
        return;
      }

      const staged: StagedEntry[] = response.results.map((res, index) => ({
        ...res,
        id: `${res.symbol}-${index}-${Date.now()}`,
        enableAlert: Boolean(res.targetPrice && res.targetPrice > 0),
      }));

      setStagedItems(staged);
      setHasParsed(true);
      toast.success(`Successfully staged ${staged.length} symbols (${staged.filter(s => s.enableAlert).length} with alerts)`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse entries.');
    }
  };

  // Modify Staged Item
  const handleUpdateItem = (id: string, updates: Partial<StagedEntry>) => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...updates };

        // If target price changed and no explicit condition set, auto adjust
        if (updates.targetPrice !== undefined && updates.targetPrice !== null && next.currentPrice) {
          if (!updates.condition) {
            next.condition = next.targetPrice >= next.currentPrice ? 'ABOVE' : 'BELOW';
          }
        }
        return next;
      })
    );
  };

  // Quick price target offset (-5%, -10%, +5%, +10%)
  const handleApplyOffset = (id: string, percentDelta: number) => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const basePrice = item.currentPrice || item.targetPrice || 100;
        const newTarget = parseFloat((basePrice * (1 + percentDelta / 100)).toFixed(2));
        const condition = percentDelta >= 0 ? 'ABOVE' : 'BELOW';
        return {
          ...item,
          targetPrice: newTarget,
          condition,
          enableAlert: true,
        };
      })
    );
  };

  // Apply offset to all staged items
  const handleApplyAllOffset = (percentDelta: number) => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (!item.currentPrice) return item;
        const newTarget = parseFloat((item.currentPrice * (1 + percentDelta / 100)).toFixed(2));
        const condition = percentDelta >= 0 ? 'ABOVE' : 'BELOW';
        return {
          ...item,
          targetPrice: newTarget,
          condition,
          enableAlert: true,
        };
      })
    );
    toast.info(`Set all alert targets to ${percentDelta >= 0 ? '+' : ''}${percentDelta}% from current prices.`);
  };

  // Remove Item from stage
  const handleRemoveItem = (id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Toggle All Alerts
  const handleToggleAllAlerts = (enable: boolean) => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (enable && (!item.targetPrice || item.targetPrice <= 0) && item.currentPrice) {
          // Default to -5% dip alert if no price specified
          return {
            ...item,
            enableAlert: true,
            targetPrice: parseFloat((item.currentPrice * 0.95).toFixed(2)),
            condition: 'BELOW',
          };
        }
        return { ...item, enableAlert: enable };
      })
    );
  };

  // Submit Final Import
  const handleExecuteImport = async () => {
    const validItems = stagedItems.filter((item) => item.isValid && item.symbol);
    if (validItems.length === 0) {
      toast.error('No valid stock symbols to import.');
      return;
    }

    setIsSubmitting(true);
    try {
      let activeWId = targetWatchlistId;
      let activeWName = '';

      // 1. Destination Watchlist (Existing or New)
      if (destinationMode === 'NEW') {
        const name = newWatchlistName.trim() || `Watchlist ${new Date().toLocaleDateString()}`;
        const symbolsList = validItems.map((i) => i.symbol);
        const createdWatchlist = await bulkCreateWatchlistMutation.mutateAsync({
          name,
          symbols: symbolsList,
        });
        activeWId = createdWatchlist.id;
        activeWName = createdWatchlist.name;
      } else {
        const found = watchlists.find((w) => w.id === targetWatchlistId) || watchlists[0];
        if (!found) {
          toast.error('Please select a valid destination watchlist.');
          setIsSubmitting(false);
          return;
        }
        activeWId = found.id;
        activeWName = found.name;

        const symbolsList = validItems.map((i) => i.symbol);
        await bulkAddSymbolsMutation.mutateAsync({
          watchlistId: activeWId,
          symbols: symbolsList,
        });
      }

      // 2. Create Alerts in Bulk
      const alertsToCreate = validItems
        .filter((item) => item.enableAlert && item.targetPrice && item.targetPrice > 0)
        .map((item) => ({
          symbol: item.symbol,
          targetPrice: Number(item.targetPrice),
          condition: item.condition,
          notes: item.notes ? item.notes.trim() : undefined,
        }));

      if (alertsToCreate.length > 0) {
        await bulkCreateAlertsMutation.mutateAsync(alertsToCreate);
      }

      toast.success(`Import Complete!`, {
        description: `Added ${validItems.length} stocks to "${activeWName}" and configured ${alertsToCreate.length} active price alerts.`,
      });

      if (onSuccess) {
        onSuccess(activeWId, validItems.length, alertsToCreate.length);
      }

      // Reset and Close
      setStagedItems([]);
      setHasParsed(false);
      setRawText('');
      setNewWatchlistName('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete bulk import.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = stagedItems.filter((i) => i.isValid).length;
  const activeAlertsCount = stagedItems.filter((i) => i.enableAlert && i.targetPrice && i.targetPrice > 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col bg-card border-border p-0 shadow-2xl">
        {/* ================= MODAL HEADER ================= */}
        <div className="p-6 border-b border-border/80 bg-gradient-to-r from-card via-card/95 to-primary/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-sm font-bold">
                <Zap className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Bulk Watchlist & Alert Studio</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary uppercase">
                    Smart Parser
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Paste or type tickers and company names with optional price targets. Resolves live market quotes and sets price alerts in batch.
                </DialogDescription>
              </div>
            </div>

            {hasParsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHasParsed(false)}
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Edit Text</span>
              </Button>
            )}
          </div>
        </div>

        {/* ================= MODAL BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Destination Watchlist Picker */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Destination Watchlist
              </span>
              <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border/60">
                <Button
                  type="button"
                  size="sm"
                  variant={destinationMode === 'EXISTING' ? 'secondary' : 'ghost'}
                  onClick={() => setDestinationMode('EXISTING')}
                  className="h-6 text-xs px-2.5"
                >
                  Existing Watchlist
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={destinationMode === 'NEW' ? 'secondary' : 'ghost'}
                  onClick={() => setDestinationMode('NEW')}
                  className="h-6 text-xs px-2.5 gap-1"
                >
                  <Plus className="w-3 h-3 text-primary" />
                  New Watchlist
                </Button>
              </div>
            </div>

            {destinationMode === 'EXISTING' ? (
              <div className="flex items-center gap-3">
                <select
                  value={targetWatchlistId}
                  onChange={(e) => setTargetWatchlistId(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-border bg-background px-3 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {watchlists.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.isDefault ? '(Default)' : ''} ({w.items?.length || 0} symbols)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Enter New Watchlist Name (e.g., Tech Breakouts, High Dividend, Dip Radar)"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* 2. Freeform Input Mode or Staged Table Mode */}
          {!hasParsed ? (
            <div className="space-y-4">
              {/* Presets Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Quick Presets:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <Button
                      key={tmpl.name}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRawText(tmpl.text);
                        handleParseText(tmpl.text);
                      }}
                      className="h-7 text-xs px-2.5 gap-1.5 bg-background/50 hover:bg-primary/10 border-border/80"
                    >
                      <span>{tmpl.icon}</span>
                      <span>{tmpl.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Monospaced Smart Text Area */}
              <div className="relative rounded-xl border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden transition-all bg-background/60">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Paste or type tickers with prices & notes:\n\nAAPL 240 Breakout\nNVDA below 115 Dip buy\nAmazon 185\nTSLA < 200, MSFT > 490\nPalantir\nCrowdStrike 280 Support`}
                  rows={8}
                  className="w-full bg-transparent p-4 font-mono text-sm text-foreground focus:outline-none resize-none placeholder:text-muted-foreground/60 leading-relaxed"
                />
                <div className="p-2.5 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Supports: <code>TICKER [PRICE] [NOTE]</code> or Company Names (e.g. <code>Palantir 35</code>)</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleParseText()}
                    disabled={resolveBulkMutation.isPending || !rawText.trim()}
                    className="h-7 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                  >
                    {resolveBulkMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Resolving Quotes...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Parse & Stage Tickers</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* 3. Staged Tickers Customization Table */
            <div className="space-y-4">
              {/* Batch Customization Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
                    {validCount} Symbols Staged
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-400 bg-amber-500/5">
                    {activeAlertsCount} Alerts Active
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleAllAlerts(true)}
                    className="h-7 text-xs px-2"
                  >
                    <Bell className="w-3 h-3 mr-1 text-amber-400" /> Enable All Alerts
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleAllAlerts(false)}
                    className="h-7 text-xs px-2"
                  >
                    Mute All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyAllOffset(-5)}
                    className="h-7 text-xs px-2 text-purple-300 hover:text-purple-200"
                  >
                    -5% Dip Targets
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyAllOffset(5)}
                    className="h-7 text-xs px-2 text-emerald-300 hover:text-emerald-200"
                  >
                    +5% Breakout Targets
                  </Button>
                </div>
              </div>

              {/* Table of Staged Items */}
              <div className="rounded-xl border border-border/80 overflow-hidden bg-card/60 divide-y divide-border/60">
                <div className="grid grid-cols-12 gap-3 p-3 bg-muted/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-3">Stock / Company</div>
                  <div className="col-span-2 text-right">Market Price</div>
                  <div className="col-span-3">Alert Trigger ($)</div>
                  <div className="col-span-3">Alert Notes</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>

                <div className="divide-y divide-border/40 max-h-[340px] overflow-y-auto">
                  {stagedItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'grid grid-cols-12 gap-3 p-3 items-center hover:bg-muted/20 transition-colors',
                        !item.isValid && 'bg-rose-500/5 opacity-70'
                      )}
                    >
                      {/* Stock / Company */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-foreground">
                            {item.symbol}
                          </span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-border text-muted-foreground truncate max-w-[80px]">
                            {item.sector || 'Stock'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate" title={item.name}>
                          {item.name}
                        </div>
                        {!item.isValid && (
                          <span className="text-[10px] text-rose-400 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3" /> {item.error || 'Quote Error'}
                          </span>
                        )}
                      </div>

                      {/* Market Price */}
                      <div className="col-span-2 text-right">
                        {item.currentPrice !== null ? (
                          <>
                            <div className="font-mono font-bold text-sm text-foreground">
                              ${item.currentPrice.toFixed(2)}
                            </div>
                            <div
                              className={cn(
                                'text-[11px] font-mono font-medium',
                                (item.dayChangePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              )}
                            >
                              {(item.dayChangePercent ?? 0) >= 0 ? '+' : ''}
                              {item.dayChangePercent?.toFixed(2)}%
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Alert Trigger Controls */}
                      <div className="col-span-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.enableAlert}
                            onCheckedChange={(checked) => handleUpdateItem(item.id, { enableAlert: checked })}
                          />
                          {item.enableAlert ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="any"
                                placeholder="Target $"
                                value={item.targetPrice ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                  handleUpdateItem(item.id, { targetPrice: val });
                                }}
                                className="h-7 text-xs font-mono w-24 px-2"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleUpdateItem(item.id, {
                                    condition: item.condition === 'ABOVE' ? 'BELOW' : 'ABOVE',
                                  })
                                }
                                className={cn(
                                  'h-7 text-[10px] px-1.5 font-bold',
                                  item.condition === 'ABOVE'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                                    : 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25'
                                )}
                                title="Toggle Above vs Below trigger condition"
                              >
                                {item.condition === 'ABOVE' ? '≥ ABOVE' : '≤ BELOW'}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Alert Off</span>
                          )}
                        </div>

                        {item.enableAlert && item.currentPrice && (
                          <div className="flex items-center gap-1 pl-8">
                            <button
                              type="button"
                              onClick={() => handleApplyOffset(item.id, -5)}
                              className="text-[10px] text-muted-foreground hover:text-purple-300 px-1 py-0.5 rounded bg-muted/40"
                            >
                              -5%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyOffset(item.id, -10)}
                              className="text-[10px] text-muted-foreground hover:text-purple-300 px-1 py-0.5 rounded bg-muted/40"
                            >
                              -10%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyOffset(item.id, 5)}
                              className="text-[10px] text-muted-foreground hover:text-emerald-300 px-1 py-0.5 rounded bg-muted/40"
                            >
                              +5%
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Notes / Thesis */}
                      <div className="col-span-3">
                        <Input
                          placeholder="Note / Thesis (optional)"
                          value={item.notes}
                          onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Remove Action */}
                      <div className="col-span-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="p-4 border-t border-border/80 bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            {hasParsed ? (
              <Button
                onClick={handleExecuteImport}
                disabled={isSubmitting || validCount === 0}
                className="gap-2 bg-gradient-to-r from-primary via-indigo-500 to-purple-600 hover:opacity-95 text-primary-foreground font-bold shadow-lg shadow-primary/20 h-9 text-xs px-5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing & Setting Alerts...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      Import {validCount} {validCount === 1 ? 'Stock' : 'Stocks'}
                      {activeAlertsCount > 0 ? ` & Set ${activeAlertsCount} Alerts` : ''}
                    </span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => handleParseText()}
                disabled={resolveBulkMutation.isPending || !rawText.trim()}
                className="gap-2 bg-primary text-primary-foreground font-bold h-9 text-xs px-5"
              >
                {resolveBulkMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resolving Symbols...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Next: Review & Customise</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
