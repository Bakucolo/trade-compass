import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Layers,
  Bot,
  Target,
  ShieldAlert,
  DollarSign,
  Calendar,
  CheckCircle2,
  Bell,
  SlidersHorizontal,
  Zap,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TradeIdea,
  StructuredTradeApproach,
  TradeStructureResult,
  useStructureTrade,
  useSaveIdeaApproaches,
  useCreateTradeIdea,
} from '@/services/ideaService';
import { useCreateTrade, UnifiedTrade } from '@/services/tradeService';
import { createAlert } from '@/services/alertService';
import { toast } from 'sonner';

/**
 * Builds unified trade records from an AI structured trade approach
 */
export function buildTradesFromApproach(
  approach: StructuredTradeApproach,
  symbol: string,
  sourceTitle?: string
): Partial<UnifiedTrade>[] {
  const cleanSymbol = symbol.toUpperCase().trim();
  const opt = approach.optionDetails;
  const isBullish = approach.sentiment === 'BULLISH';
  const trades: Partial<UnifiedTrade>[] = [];
  const baseDesc = `Structured Trade: ${approach.title} [Target: $${approach.targetPrice}, Stop: $${approach.stopLoss}]${sourceTitle ? ` • (${sourceTitle})` : ''}`;

  // Expiration calculation
  const dteDays = opt?.recommendedDte || 45;
  const expDateObj = new Date(Date.now() + dteDays * 24 * 60 * 60 * 1000);
  const expiryDate = expDateObj.toISOString().slice(0, 10);
  const expDateOcc = `${String(expDateObj.getFullYear()).slice(2)}${String(expDateObj.getMonth() + 1).padStart(2, '0')}${String(expDateObj.getDate()).padStart(2, '0')}`;

  switch (approach.category) {
    case 'STOCK': {
      const price = approach.primaryEntry || 100;
      trades.push({
        broker: 'Manual',
        symbol: cleanSymbol,
        underlyingSymbol: cleanSymbol,
        assetType: 'EQUITY',
        side: isBullish ? 'BUY' : 'SELL',
        action: isBullish ? 'BUY' : 'SELL',
        positionEffect: isBullish ? 'LONG' : 'SHORT',
        quantity: 100,
        price,
        totalValue: price * 100,
        valueEffect: isBullish ? 'DEBIT' : 'CREDIT',
        description: baseDesc,
        executedAt: new Date().toISOString(),
      });
      break;
    }

    case 'OPTIONS_LONG': {
      const optType = isBullish ? 'CALL' : 'PUT';
      const strike = opt?.longStrike || (isBullish ? opt?.callStrike : opt?.putStrike) || approach.primaryEntry;
      const strikeFormatted = String(Math.round(strike * 1000)).padStart(8, '0');
      const occSymbol = `${cleanSymbol.padEnd(6, ' ')}${expDateOcc}${optType === 'CALL' ? 'C' : 'P'}${strikeFormatted}`;
      const estPrice = opt?.estimatedCost || Math.max(1, Number((approach.primaryEntry * 0.04).toFixed(2)));

      trades.push({
        broker: 'Manual',
        symbol: occSymbol,
        underlyingSymbol: cleanSymbol,
        assetType: 'OPTION',
        optionType: optType,
        strikePrice: strike,
        expiryDate,
        side: 'BUY',
        action: 'BUY_TO_OPEN',
        positionEffect: 'LONG',
        quantity: 1,
        price: estPrice,
        totalValue: estPrice * 100,
        valueEffect: 'DEBIT',
        description: `${baseDesc} - Long ${optType} $${strike}`,
        executedAt: new Date().toISOString(),
      });
      break;
    }

    case 'SHORT_PUT': {
      const strike = opt?.putStrike || opt?.shortStrike || Number((approach.primaryEntry * 0.95).toFixed(2));
      const strikeFormatted = String(Math.round(strike * 1000)).padStart(8, '0');
      const occSymbol = `${cleanSymbol.padEnd(6, ' ')}${expDateOcc}P${strikeFormatted}`;
      const estPrice = opt?.estimatedCost || Math.max(1, Number((approach.primaryEntry * 0.025).toFixed(2)));

      trades.push({
        broker: 'Manual',
        symbol: occSymbol,
        underlyingSymbol: cleanSymbol,
        assetType: 'OPTION',
        optionType: 'PUT',
        strikePrice: strike,
        expiryDate,
        side: 'SELL',
        action: 'SELL_TO_OPEN',
        positionEffect: 'SHORT',
        quantity: -1,
        price: estPrice,
        totalValue: estPrice * 100,
        valueEffect: 'CREDIT',
        description: `${baseDesc} - Cash-Secured Short Put $${strike}`,
        executedAt: new Date().toISOString(),
      });
      break;
    }

    case 'COVERED_CALL': {
      const stockPrice = approach.primaryEntry || 100;
      // Stock Leg
      trades.push({
        broker: 'Manual',
        symbol: cleanSymbol,
        underlyingSymbol: cleanSymbol,
        assetType: 'EQUITY',
        side: 'BUY',
        action: 'BUY',
        positionEffect: 'LONG',
        quantity: 100,
        price: stockPrice,
        totalValue: stockPrice * 100,
        valueEffect: 'DEBIT',
        description: `${baseDesc} (Covered Call: Stock Leg 100 shares)`,
        executedAt: new Date().toISOString(),
      });

      // Short Call Leg
      const callStrike = opt?.callStrike || opt?.shortStrike || Number((stockPrice * 1.05).toFixed(2));
      const strikeFormatted = String(Math.round(callStrike * 1000)).padStart(8, '0');
      const occSymbol = `${cleanSymbol.padEnd(6, ' ')}${expDateOcc}C${strikeFormatted}`;
      const callPrice = opt?.estimatedCost || Math.max(1, Number((stockPrice * 0.025).toFixed(2)));

      trades.push({
        broker: 'Manual',
        symbol: occSymbol,
        underlyingSymbol: cleanSymbol,
        assetType: 'OPTION',
        optionType: 'CALL',
        strikePrice: callStrike,
        expiryDate,
        side: 'SELL',
        action: 'SELL_TO_OPEN',
        positionEffect: 'SHORT',
        quantity: -1,
        price: callPrice,
        totalValue: callPrice * 100,
        valueEffect: 'CREDIT',
        description: `${baseDesc} (Covered Call: Short Call $${callStrike} Leg)`,
        executedAt: new Date().toISOString(),
      });
      break;
    }

    case 'COLLAR': {
      const stockPrice = approach.primaryEntry || 100;
      // Stock Leg
      trades.push({
        broker: 'Manual',
        symbol: cleanSymbol,
        underlyingSymbol: cleanSymbol,
        assetType: 'EQUITY',
        side: 'BUY',
        action: 'BUY',
        positionEffect: 'LONG',
        quantity: 100,
        price: stockPrice,
        totalValue: stockPrice * 100,
        valueEffect: 'DEBIT',
        description: `${baseDesc} (Collar: Stock Leg)`,
        executedAt: new Date().toISOString(),
      });

      // Long Put Floor Leg
      const putStrike = opt?.putStrike || Number((stockPrice * 0.92).toFixed(2));
      const putFormatted = String(Math.round(putStrike * 1000)).padStart(8, '0');
      trades.push({
        broker: 'Manual',
        symbol: `${cleanSymbol.padEnd(6, ' ')}${expDateOcc}P${putFormatted}`,
        underlyingSymbol: cleanSymbol,
        assetType: 'OPTION',
        optionType: 'PUT',
        strikePrice: putStrike,
        expiryDate,
        side: 'BUY',
        action: 'BUY_TO_OPEN',
        positionEffect: 'LONG',
        quantity: 1,
        price: Number((stockPrice * 0.02).toFixed(2)),
        totalValue: Number((stockPrice * 0.02 * 100).toFixed(2)),
        valueEffect: 'DEBIT',
        description: `${baseDesc} (Collar: Protective Put Floor $${putStrike})`,
        executedAt: new Date().toISOString(),
      });

      // Short Call Ceiling Leg
      const callStrike = opt?.callStrike || Number((stockPrice * 1.08).toFixed(2));
      const callFormatted = String(Math.round(callStrike * 1000)).padStart(8, '0');
      trades.push({
        broker: 'Manual',
        symbol: `${cleanSymbol.padEnd(6, ' ')}${expDateOcc}C${callFormatted}`,
        underlyingSymbol: cleanSymbol,
        assetType: 'OPTION',
        optionType: 'CALL',
        strikePrice: callStrike,
        expiryDate,
        side: 'SELL',
        action: 'SELL_TO_OPEN',
        positionEffect: 'SHORT',
        quantity: -1,
        price: Number((stockPrice * 0.02).toFixed(2)),
        totalValue: Number((stockPrice * 0.02 * 100).toFixed(2)),
        valueEffect: 'CREDIT',
        description: `${baseDesc} (Collar: Financing Call Ceiling $${callStrike})`,
        executedAt: new Date().toISOString(),
      });
      break;
    }

    case 'SPREAD': {
      const longStrike = opt?.longStrike || approach.primaryEntry;
      const shortStrike = opt?.shortStrike || (isBullish ? Number((approach.primaryEntry * 1.08).toFixed(2)) : Number((approach.primaryEntry * 0.92).toFixed(2)));
      const optType = isBullish ? 'CALL' : 'PUT';

      // Long Leg
      const longFormatted = String(Math.round(longStrike * 1000)).padStart(8, '0');
      trades.push({
        broker: 'Manual',
        symbol: `${cleanSymbol.padEnd(6, ' ')}${expDateOcc}${optType === 'CALL' ? 'C' : 'P'}${longFormatted}`,
        underlyingSymbol: cleanSymbol,
        assetType: 'OPTION',
        optionType: optType,
        strikePrice: longStrike,
        expiryDate,
        side: 'BUY',
        action: 'BUY_TO_OPEN',
        positionEffect: 'LONG',
        quantity: 1,
        price: Number((opt?.estimatedCost || 3.5).toFixed(2)),
        totalValue: Number(((opt?.estimatedCost || 3.5) * 100).toFixed(2)),
        valueEffect: 'DEBIT',
        description: `${baseDesc} (Spread Long Leg $${longStrike})`,
        executedAt: new Date().toISOString(),
      });

      // Short Leg
      const shortFormatted = String(Math.round(shortStrike * 1000)).padStart(8, '0');
      trades.push({
        broker: 'Manual',
        symbol: `${cleanSymbol.padEnd(6, ' ')}${expDateOcc}${optType === 'CALL' ? 'C' : 'P'}${shortFormatted}`,
        underlyingSymbol: cleanSymbol,
        assetType: 'OPTION',
        optionType: optType,
        strikePrice: shortStrike,
        expiryDate,
        side: 'SELL',
        action: 'SELL_TO_OPEN',
        positionEffect: 'SHORT',
        quantity: -1,
        price: Number((Math.max(0.5, (opt?.estimatedCost || 3.5) * 0.4)).toFixed(2)),
        totalValue: Number((Math.max(0.5, (opt?.estimatedCost || 3.5) * 0.4) * 100).toFixed(2)),
        valueEffect: 'CREDIT',
        description: `${baseDesc} (Spread Short Leg $${shortStrike})`,
        executedAt: new Date().toISOString(),
      });
      break;
    }

    default: {
      const optType = isBullish ? 'CALL' : 'PUT';
      const strike = opt?.longStrike || opt?.callStrike || opt?.putStrike || approach.primaryEntry;
      const strikeFormatted = String(Math.round(strike * 1000)).padStart(8, '0');
      trades.push({
        broker: 'Manual',
        symbol: `${cleanSymbol.padEnd(6, ' ')}${expDateOcc}${optType === 'CALL' ? 'C' : 'P'}${strikeFormatted}`,
        underlyingSymbol: cleanSymbol,
        assetType: 'OPTION',
        optionType: optType,
        strikePrice: strike,
        expiryDate,
        side: 'BUY',
        action: 'BUY_TO_OPEN',
        positionEffect: 'LONG',
        quantity: 1,
        price: opt?.estimatedCost || 4.0,
        totalValue: (opt?.estimatedCost || 4.0) * 100,
        valueEffect: 'DEBIT',
        description: baseDesc,
        executedAt: new Date().toISOString(),
      });
      break;
    }
  }

  return trades;
}

interface TradeStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  idea?: TradeIdea | null;
  initialSymbol?: string;
  initialPrice?: number;
  initialThesis?: string;
  initialSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  onSavedSuccess?: () => void;
  onNavigateToTrades?: () => void;
  onNavigateToIdeas?: () => void;
}

export function TradeStructureModal({
  isOpen,
  onClose,
  idea,
  initialSymbol,
  initialPrice,
  initialThesis,
  initialSentiment = 'BULLISH',
  onSavedSuccess,
  onNavigateToTrades,
  onNavigateToIdeas,
}: TradeStructureModalProps) {
  const structureTradeMutation = useStructureTrade();
  const saveApproachesMutation = useSaveIdeaApproaches();
  const createIdeaMutation = useCreateTradeIdea();
  const createTradeMutation = useCreateTrade();

  const [structureResult, setStructureResult] = useState<TradeStructureResult | null>(null);
  const [selectedApproachIds, setSelectedApproachIds] = useState<Set<string>>(new Set());
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);
  const [isSavingTrades, setIsSavingTrades] = useState(false);

  const activeSymbol = idea?.symbol || initialSymbol || '';
  const activeSentiment = idea?.type || initialSentiment || 'BULLISH';
  const activePrice = idea?.entryPrice || initialPrice;

  // Auto-fetch structure when opened for a given idea or direct symbol
  useEffect(() => {
    if (isOpen && (idea || initialSymbol)) {
      setStructureResult(null);
      setSelectedApproachIds(new Set());

      structureTradeMutation.mutate(
        {
          ideaId: idea?.id,
          symbol: activeSymbol.toUpperCase(),
          title: idea?.title || `${activeSymbol.toUpperCase()} Quantitative Trade Structure`,
          content: idea?.content || initialThesis,
          type: activeSentiment,
          entryPrice: activePrice,
          targetPrice: idea?.targetPrice,
          stopLoss: idea?.stopLoss,
          timeframe: idea?.timeframe || 'SWING',
        },
        {
          onSuccess: (data) => {
            setStructureResult(data);
            // Default select the top 2 approaches (e.g. Stock & Options or Collar)
            if (data.approaches && data.approaches.length > 0) {
              const defaultSelected = new Set<string>();
              defaultSelected.add(data.approaches[0].id);
              if (data.approaches.length > 1) {
                defaultSelected.add(data.approaches[1].id);
              }
              setSelectedApproachIds(defaultSelected);
            }
          },
          onError: (err) => {
            toast.error(`Trade Structuring failed: ${err.message}`);
          },
        }
      );
    }
  }, [isOpen, idea?.id, initialSymbol]);

  if (!idea && !initialSymbol) return null;

  const isBullish = activeSentiment === 'BULLISH';
  const isBearish = activeSentiment === 'BEARISH';

  const toggleApproachSelect = (id: string) => {
    setSelectedApproachIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!structureResult?.approaches) return;
    setSelectedApproachIds(new Set(structureResult.approaches.map((a) => a.id)));
  };

  const clearAll = () => {
    setSelectedApproachIds(new Set());
  };

  // 1-Click: Save Single Option/Stock Structure Directly to Trades Section
  const handleSaveApproachToTrades = async (approach: StructuredTradeApproach, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSavingTrades(true);

    try {
      const trades = buildTradesFromApproach(approach, activeSymbol, idea?.title || initialThesis);
      for (const t of trades) {
        await createTradeMutation.mutateAsync(t);
      }

      toast.success(`Saved "${approach.title}" to Trades!`, {
        description: `Logged ${trades.length} trade leg(s) in your Trades tab to track execution and live P&L.`,
        action: onNavigateToTrades ? {
          label: 'View in Trades',
          onClick: () => {
            onClose();
            onNavigateToTrades();
          }
        } : undefined,
      });

      onSavedSuccess?.();
    } catch (err: any) {
      toast.error(`Failed to save to Trades: ${err.message}`);
    } finally {
      setIsSavingTrades(false);
    }
  };

  // Bulk Save Selected Approaches to Trades Section
  const handleBulkSaveToTrades = async () => {
    if (!structureResult || selectedApproachIds.size === 0) {
      toast.warning('Please select at least one trade approach.');
      return;
    }

    setIsSavingTrades(true);
    const selectedList = structureResult.approaches.filter((a) => selectedApproachIds.has(a.id));
    let totalLegs = 0;

    try {
      for (const app of selectedList) {
        const trades = buildTradesFromApproach(app, activeSymbol, idea?.title || initialThesis);
        for (const t of trades) {
          await createTradeMutation.mutateAsync(t);
          totalLegs++;
        }
      }

      toast.success(`Saved ${selectedList.length} trade structure(s) (${totalLegs} legs) to Trades!`, {
        description: 'You can now follow and track them in the Trades section.',
        action: onNavigateToTrades ? {
          label: 'View in Trades',
          onClick: () => {
            onClose();
            onNavigateToTrades();
          }
        } : undefined,
      });

      onSavedSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(`Failed to save to Trades: ${err.message}`);
    } finally {
      setIsSavingTrades(false);
    }
  };

  // 1-Click: Save Selected Approaches into Idea
  const handleSaveToIdea = async () => {
    if (!structureResult || selectedApproachIds.size === 0) {
      toast.warning('Please select at least one trade approach to save.');
      return;
    }

    const selectedList = structureResult.approaches.filter((a) => selectedApproachIds.has(a.id));

    try {
      if (idea?.id) {
        // Update existing idea
        await saveApproachesMutation.mutateAsync({
          ideaId: idea.id,
          approaches: selectedList,
        });

        toast.success(`Successfully attached ${selectedList.length} trade execution structure(s) to ${idea.symbol}!`, {
          description: 'The execution playbooks and entry rules have been updated in your trade idea.',
        });
      } else {
        // Create new Idea from Research
        const primaryApproach = selectedList[0];
        const formattedTitle = `${activeSymbol.toUpperCase()} ${primaryApproach.approachName || primaryApproach.title} (${primaryApproach.category})`;
        
        const contentMarkdown = `### 🎯 Thesis: ${primaryApproach.title}
${primaryApproach.subtitle || ''}

---

### 📋 Selected Execution Structures (${selectedList.length})
${selectedList.map((app, i) => `
#### ${i + 1}. ${app.title} (${app.category})
- **Sentiment**: ${app.sentiment} | **Suitability**: ${app.suitability}
- **Capital Required**: ${app.capitalRequiredEstimate}
- **Max Profit**: ${app.maxProfit} | **Max Risk**: ${app.maxRisk}
- **Win Probability**: ~${app.winProbabilityEstimate}% | **R:R**: ${app.riskRewardRatio}
- **Primary Entry**: $${app.primaryEntry} | **Target**: $${app.targetPrice} | **Stop**: $${app.stopLoss}

${app.optionDetails ? `**Option Details**: ${app.optionDetails.strategyName} (${app.optionDetails.expiryDescription}) - Break-Even: $${app.optionDetails.breakEvenPrice}` : ''}

- 🛑 **Invalidation**: ${app.invalidationTrigger || 'Stop loss breach'}
- 🎯 **Profit Target**: ${app.profitTakingPlan || 'Take profit at target'}
`).join('\n---\n')}
`;

        await createIdeaMutation.mutateAsync({
          symbol: activeSymbol.toUpperCase(),
          title: formattedTitle,
          type: activeSentiment,
          timeframe: 'SWING',
          entryPrice: activePrice || null,
          content: contentMarkdown,
          tags: `${activeSymbol.toUpperCase()}, ${primaryApproach.category}, StructuredTrade`,
          status: 'ACTIVE',
          confidenceScore: primaryApproach.winProbabilityEstimate || 75,
        });

        toast.success(`Successfully created new Trade Idea for ${activeSymbol.toUpperCase()}!`, {
          description: `Attached ${selectedList.length} structured execution playbook(s) to your Ideas section.`,
        });
      }

      onSavedSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(`Failed to save approaches: ${err.message}`);
    }
  };

  // 1-Click: Create Price Alerts for Entry Levels & Target
  const handleCreateAlertsForApproach = async (approach: StructuredTradeApproach) => {
    setIsAlertsLoading(true);
    let createdCount = 0;

    try {
      // 1. Primary Entry Alert
      if (approach.primaryEntry && approach.primaryEntry > 0) {
        await createAlert({
          symbol: activeSymbol,
          targetPrice: approach.primaryEntry,
          condition: isBullish ? 'BELOW' : 'ABOVE',
          notes: `[Entry Trigger] ${approach.title} on ${activeSymbol} at $${approach.primaryEntry.toFixed(2)}`,
        });
        createdCount++;
      }

      // 2. Scaled / Dip Support Entry Alert
      if (approach.scaledEntryMin && approach.scaledEntryMin !== approach.primaryEntry) {
        await createAlert({
          symbol: activeSymbol,
          targetPrice: approach.scaledEntryMin,
          condition: isBullish ? 'BELOW' : 'ABOVE',
          notes: `[Scaled Dip Entry] Secondary support entry for ${approach.title} at $${approach.scaledEntryMin.toFixed(2)}`,
        });
        createdCount++;
      }

      // 3. Target Alert
      if (approach.targetPrice && approach.targetPrice > 0) {
        await createAlert({
          symbol: activeSymbol,
          targetPrice: approach.targetPrice,
          condition: isBullish ? 'ABOVE' : 'BELOW',
          notes: `[Profit Target 1] Take profit on ${approach.title} at $${approach.targetPrice.toFixed(2)}`,
        });
        createdCount++;
      }

      // 4. Invalidation Stop Alert
      if (approach.stopLoss && approach.stopLoss > 0) {
        await createAlert({
          symbol: activeSymbol,
          targetPrice: approach.stopLoss,
          condition: isBullish ? 'BELOW' : 'ABOVE',
          notes: `[Stop Invalidation] Stop Loss trigger on ${approach.title} at $${approach.stopLoss.toFixed(2)}`,
        });
        createdCount++;
      }

      toast.success(`Created ${createdCount} price alerts for ${activeSymbol}!`, {
        description: `Alerts set for Entry ($${approach.primaryEntry}), Target ($${approach.targetPrice}), and Stop ($${approach.stopLoss}).`,
      });
    } catch (err: any) {
      toast.error(`Alert creation failed: ${err.message}`);
    } finally {
      setIsAlertsLoading(false);
    }
  };

  // Bulk Create Alerts for ALL selected approaches
  const handleBulkCreateSelectedAlerts = async () => {
    if (!structureResult || selectedApproachIds.size === 0) {
      toast.warning('Please select at least one trade approach.');
      return;
    }

    setIsAlertsLoading(true);
    const selectedList = structureResult.approaches.filter((a) => selectedApproachIds.has(a.id));
    let totalCreated = 0;

    try {
      for (const app of selectedList) {
        if (app.primaryEntry && app.primaryEntry > 0) {
          await createAlert({
            symbol: activeSymbol,
            targetPrice: app.primaryEntry,
            condition: isBullish ? 'BELOW' : 'ABOVE',
            notes: `[Entry Trigger] ${app.title} at $${app.primaryEntry.toFixed(2)}`,
          });
          totalCreated++;
        }
        if (app.targetPrice && app.targetPrice > 0) {
          await createAlert({
            symbol: activeSymbol,
            targetPrice: app.targetPrice,
            condition: isBullish ? 'ABOVE' : 'BELOW',
            notes: `[Target 1] ${app.title} at $${app.targetPrice.toFixed(2)}`,
          });
          totalCreated++;
        }
      }

      toast.success(`Created ${totalCreated} price alerts across ${selectedList.length} selected trade approach(es)!`, {
        description: 'Tracked in your active Price Alerts station.',
      });
    } catch (err: any) {
      toast.error(`Failed to create bulk alerts: ${err.message}`);
    } finally {
      setIsAlertsLoading(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'STOCK':
        return <Badge variant="outline" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 text-[10px] font-mono">📈 Outright Stock</Badge>;
      case 'OPTIONS_LONG':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[10px] font-mono">⚡ Long Options / LEAPS</Badge>;
      case 'COVERED_CALL':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">💵 Covered Call / Buy-Write</Badge>;
      case 'COLLAR':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px] font-mono">🛡️ Collared Position</Badge>;
      case 'SHORT_PUT':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/30 text-[10px] font-mono">💰 Cash-Secured Short Put</Badge>;
      case 'SYNTHETIC':
        return <Badge variant="outline" className="bg-pink-500/10 text-pink-300 border-pink-500/30 text-[10px] font-mono">🔄 Synthetic Long/Short</Badge>;
      case 'SPREAD':
        return <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 text-[10px] font-mono">📊 Vertical Spread</Badge>;
      case 'HYBRID_STOCK_CALL':
        return <Badge variant="outline" className="bg-teal-500/10 text-teal-300 border-teal-500/30 text-[10px] font-mono">🚀 Core Stock + Call Overlay</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] font-mono">{category}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-accent/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-primary/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-black shadow-lg">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                    AI Trade Structuring Agent
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      isBullish
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : isBearish
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-primary/10 text-primary border-primary/30'
                    )}
                  >
                    {isBullish ? <TrendingUp className="w-3 h-3 mr-1 inline" /> : isBearish ? <TrendingDown className="w-3 h-3 mr-1 inline" /> : <Minus className="w-3 h-3 mr-1 inline" />}
                    {activeSymbol} • {activeSentiment}
                  </Badge>
                  {activePrice && (
                    <Badge variant="outline" className="font-mono text-xs font-bold text-foreground bg-slate-900 border-border/60">
                      Market: ${activePrice.toFixed(2)}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Select and save execution approaches (Stocks, Options, Collars, Covered Calls, Short Puts, Synthetics) or deploy entry alerts.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  structureTradeMutation.mutate({
                    ideaId: idea?.id,
                    symbol: activeSymbol.toUpperCase(),
                    title: idea?.title || `${activeSymbol.toUpperCase()} Quantitative Trade Structure`,
                    content: idea?.content || initialThesis,
                    type: activeSentiment,
                    entryPrice: activePrice,
                    targetPrice: idea?.targetPrice,
                    stopLoss: idea?.stopLoss,
                    timeframe: idea?.timeframe || 'SWING',
                  });
                }}
                disabled={structureTradeMutation.isPending}
                className="text-xs gap-1.5 h-8 font-semibold"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", structureTradeMutation.isPending && "animate-spin text-primary")} />
                <span>Re-Structure</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: List of Structured Approaches */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          {structureTradeMutation.isPending ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-sm font-bold text-foreground">
                AI Derivatives Strategist is structuring multi-approach execution plans for {activeSymbol}...
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                Computing optimal strikes, DTE expiration cycles, entry limit zones, covered call yields, collar floors, and risk-reward ratios.
              </p>
            </div>
          ) : structureResult?.approaches && structureResult.approaches.length > 0 ? (
            <div className="space-y-4">
              {/* Toolbar: Select All / Count / Bulk Alert Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card/60 border border-border/60">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-foreground">
                    {structureResult.approaches.length} Structured Approaches Available
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-primary hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkCreateSelectedAlerts}
                    disabled={isAlertsLoading || selectedApproachIds.size === 0}
                    className="h-7 text-[11px] gap-1.5 bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 font-bold"
                    title="Set Entry and Target price alerts for all selected approaches"
                  >
                    <Bell className="w-3 h-3 text-amber-400" />
                    <span>Set Entry Alerts ({selectedApproachIds.size})</span>
                  </Button>
                </div>
              </div>

              {/* Approaches Cards Grid */}
              <div className="space-y-3.5">
                {structureResult.approaches.map((app) => {
                  const isSelected = selectedApproachIds.has(app.id);

                  return (
                    <div
                      key={app.id}
                      onClick={() => toggleApproachSelect(app.id)}
                      className={cn(
                        'p-4.5 rounded-2xl border transition-all cursor-pointer relative space-y-3',
                        isSelected
                          ? 'bg-card border-primary/60 shadow-lg ring-1 ring-primary/30'
                          : 'bg-card/40 border-border/60 hover:bg-card/70 hover:border-border/90'
                      )}
                    >
                      {/* Top Row: Checkbox, Title, Badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleApproachSelect(app.id)}
                            className="mt-1"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-foreground">
                                {app.title}
                              </span>
                              {getCategoryBadge(app.category)}
                              <Badge variant="secondary" className="text-[10px] font-semibold bg-accent/80 text-muted-foreground">
                                {app.suitability}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                              {app.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleSaveApproachToTrades(app, e)}
                            disabled={isSavingTrades}
                            className="h-7 text-[11px] gap-1 bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 font-bold px-2 rounded-lg"
                            title="Save this option/stock structure directly to Trades section to follow"
                          >
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            <span>Follow in Trades</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCreateAlertsForApproach(app)}
                            disabled={isAlertsLoading}
                            className="h-7 text-[11px] gap-1 text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 font-bold px-2 rounded-lg"
                            title="Set Entry & Target Alerts for this specific structure"
                          >
                            <Bell className="w-3 h-3 text-amber-400" />
                            <span>Set Alert</span>
                          </Button>
                        </div>
                      </div>

                      {/* Middle Row: Entry, Targets, Stops & Option Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono pt-1">
                        {/* Primary Entry */}
                        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-border/40">
                          <span className="text-[10px] text-muted-foreground block font-sans">Primary Entry</span>
                          <span className="font-black text-cyan-300">${app.primaryEntry.toFixed(2)}</span>
                          {app.scaledEntryMin && app.scaledEntryMin !== app.primaryEntry && (
                            <span className="text-[9.5px] text-muted-foreground block truncate">
                              Zone: ${app.scaledEntryMin.toFixed(2)} - ${app.scaledEntryMax.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Profit Target */}
                        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-border/40">
                          <span className="text-[10px] text-muted-foreground block font-sans">Profit Target 1</span>
                          <span className="font-black text-emerald-400">${app.targetPrice.toFixed(2)}</span>
                          {app.target2Price && (
                            <span className="text-[9.5px] text-emerald-300/80 block">
                              Target 2: ${app.target2Price.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Invalidation Stop */}
                        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-border/40">
                          <span className="text-[10px] text-muted-foreground block font-sans">Stop Loss</span>
                          <span className="font-black text-rose-400">${app.stopLoss.toFixed(2)}</span>
                          <span className="text-[9.5px] text-muted-foreground block truncate font-sans">
                            Hard Invalidation
                          </span>
                        </div>

                        {/* R:R Ratio & Win Probability */}
                        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-border/40">
                          <span className="text-[10px] text-muted-foreground block font-sans">Risk / Reward</span>
                          <span className="font-black text-purple-300">{app.riskRewardRatio}</span>
                          <span className="text-[9.5px] text-muted-foreground block">
                            Win Prob: ~{app.winProbabilityEstimate}%
                          </span>
                        </div>
                      </div>

                      {/* Option Specific Legs Display if present */}
                      {app.optionDetails && (
                        <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-purple-300 font-bold">Strategy:</span>
                            <span className="text-foreground">{app.optionDetails.strategyName}</span>
                            <Badge variant="outline" className="text-[9px] bg-purple-500/20 text-purple-200 border-purple-500/40">
                              {app.optionDetails.expiryDescription}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            {app.optionDetails.longStrike && <span>Long: <strong className="text-foreground">${app.optionDetails.longStrike}</strong></span>}
                            {app.optionDetails.shortStrike && <span>Short: <strong className="text-foreground">${app.optionDetails.shortStrike}</strong></span>}
                            {app.optionDetails.putStrike && <span>Put: <strong className="text-foreground">${app.optionDetails.putStrike}</strong></span>}
                            {app.optionDetails.callStrike && <span>Call: <strong className="text-foreground">${app.optionDetails.callStrike}</strong></span>}
                            <span>Break-Even: <strong className="text-cyan-300">${app.optionDetails.breakEvenPrice}</strong></span>
                          </div>
                        </div>
                      )}

                      {/* Financial Payoff & Execution Rules */}
                      <div className="pt-1 space-y-1.5 text-xs text-muted-foreground border-t border-border/30">
                        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-muted-foreground">
                          <span>Capital Req: <strong className="text-foreground">{app.capitalRequiredEstimate}</strong></span>
                          <span>Max Profit: <strong className="text-emerald-400">{app.maxProfit}</strong></span>
                          <span>Max Risk: <strong className="text-rose-400">{app.maxRisk}</strong></span>
                        </div>

                        {app.executionRules && app.executionRules.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">
                              Execution Playbook
                            </span>
                            <ul className="list-disc list-inside text-[11px] text-foreground/80 space-y-0.5 mt-0.5">
                              {app.executionRules.map((rule, idx) => (
                                <li key={idx}>{rule}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm font-bold text-muted-foreground">No structured approaches generated yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  structureTradeMutation.mutate({
                    ideaId: idea?.id,
                    symbol: idea?.symbol || activeSymbol,
                    title: idea?.title || `${activeSymbol} Trade Structure`,
                    content: idea?.content || initialThesis,
                    type: idea?.type || activeSentiment,
                    entryPrice: idea?.entryPrice || activePrice,
                    targetPrice: idea?.targetPrice,
                    stopLoss: idea?.stopLoss,
                    timeframe: idea?.timeframe || 'SWING',
                  });
                }}
                className="text-xs font-bold gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Generate Execution Approaches
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/50 bg-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground font-mono">
            {selectedApproachIds.size > 0 ? (
              <span className="text-primary font-bold">{selectedApproachIds.size} approach(es) selected</span>
            ) : (
              <span>Select approaches to save to Trades or Ideas</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkSaveToTrades}
              disabled={isSavingTrades || selectedApproachIds.size === 0}
              className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 font-bold text-xs shadow-sm gap-1.5 px-3.5 h-9"
              title="Save all selected structured approaches to the Trades section"
            >
              {isSavingTrades ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> Saving to Trades...</>
              ) : (
                <><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Follow Selected ({selectedApproachIds.size}) in Trades</>
              )}
            </Button>

            <Button
              size="sm"
              onClick={handleSaveToIdea}
              disabled={saveApproachesMutation.isPending || selectedApproachIds.size === 0}
              className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md gap-1.5 px-3.5 h-9"
              title="Save all selected approaches to Trade Ideas"
            >
              {saveApproachesMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving to Idea...</>
              ) : (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Save Selected ({selectedApproachIds.size}) to Idea</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
