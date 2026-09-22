// src/components/aiTrading/FullWindowOptionsTradeStationModal.tsx
// Comprehensive Full-Window Sleek Options Trade Station for AI Trading
// Features: Interactive Option Chain, Strategy & Multi-Leg Draft Builder, Greeks & Payoff Chart,
// Side-by-Side Tastytrade vs. IBKR Buying Power Comparison, and Live Broker Buying Power Ribbon.

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Zap,
  Layers,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Scale,
  ArrowRight,
  Check,
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  Copy,
  Sparkles,
  Info,
  DollarSign,
  Activity,
  AlertTriangle,
  ChevronRight,
  Sliders,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  Search,
  Plus,
  Trash2
} from 'lucide-react';
import {
  useOptionsChain,
  OptionsChainData,
  OptionContractRow,
  StrikeMatrixRow,
  ExpirationMeta
} from '@/services/optionsChainService';
import { usePortfolioBalances } from '@/services/portfolioBalanceService';
import {
  analyzeBuyingPower,
  BuyingPowerComparisonResult,
  createDraftOrder,
  StagedDraftOrder
} from '@/services/tastytrade';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine
} from 'recharts';

export interface OptionDraftLeg {
  id: string;
  action: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  quantity: number;
  price: number;
  delta?: number;
  theta?: number;
  gamma?: number;
  vega?: number;
  impliedVolatility?: number;
  contractSymbol?: string;
}

export type StrategyPreset =
  | 'SINGLE_CALL'
  | 'SINGLE_PUT'
  | 'COVERED_CALL'
  | 'CASH_SECURED_PUT'
  | 'BULL_CALL_SPREAD'
  | 'BEAR_PUT_SPREAD'
  | 'CREDIT_PUT_SPREAD'
  | 'IRON_CONDOR'
  | 'LONG_STRADDLE'
  | 'CUSTOM';

interface FullWindowOptionsTradeStationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSymbol?: string;
  defaultBroker?: 'tastytrade' | 'ibkr' | 'alpaca';
  defaultTab?: 'comparison' | 'metrics';
  onOrderStaged?: (draft: StagedDraftOrder) => void;
}

const POPULAR_TICKERS = ['AAPL', 'NVDA', 'SPY', 'QQQ', 'TSLA', 'MSFT', 'AMD', 'AMZN'];

const formatVol = (num?: number) => {
  if (num === undefined || num === null || num <= 0) return '-';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return `${num}`;
};

const formatStrike = (st: number) => {
  return Number.isInteger(st) ? st.toString() : st.toFixed(1);
};

export const FullWindowOptionsTradeStationModal: React.FC<FullWindowOptionsTradeStationModalProps> = ({
  open,
  onOpenChange,
  defaultSymbol = 'AAPL',
  defaultBroker = 'tastytrade',
  defaultTab = 'comparison',
  onOrderStaged,
}) => {
  // Window & Layout state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'comparison' | 'metrics'>(defaultTab);

  // Underlying symbol & search
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [searchInput, setSearchInput] = useState(defaultSymbol);

  // Selected Broker
  const [selectedBroker, setSelectedBroker] = useState<'tastytrade' | 'ibkr'>(
    defaultBroker === 'ibkr' ? 'ibkr' : 'tastytrade'
  );

  // Expiration & filters
  const [selectedExpiration, setSelectedExpiration] = useState<string | undefined>(undefined);
  const [strikeRange, setStrikeRange] = useState<'10' | '20' | '30' | 'all'>('20');
  const [moneynessFilter, setMoneynessFilter] = useState<'all' | 'itm' | 'otm'>('all');

  // Trade Draft Legs
  const [legs, setLegs] = useState<OptionDraftLeg[]>([]);
  const [orderType, setOrderType] = useState<'Limit' | 'Market'>('Limit');
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [timeInForce, setTimeInForce] = useState<'Day' | 'GTC'>('Day');

  // Buying Power Analysis State
  const [bpComparison, setBpComparison] = useState<BuyingPowerComparisonResult | null>(null);
  const [isAnalyzingBp, setIsAnalyzingBp] = useState(false);
  const [isStagingOrder, setIsStagingOrder] = useState(false);

  // Live Balances & Chain Queries
  const { data: balancesData, refetch: refetchBalances, isFetching: isFetchingBalances } = usePortfolioBalances();
  const { data: chainData, isLoading: isLoadingChain, refetch: refetchChain } = useOptionsChain(
    symbol,
    selectedExpiration,
    { enabled: open }
  );

  // Auto-select first expiration if not selected
  useEffect(() => {
    if (chainData?.expirations && chainData.expirations.length > 0) {
      if (!selectedExpiration || !chainData.expirations.some(e => e.date === selectedExpiration)) {
        setSelectedExpiration(chainData.expirations[0].date);
      }
    }
  }, [chainData?.expirations, selectedExpiration]);

  // Handle symbol change from input
  const handleApplySymbol = (newSym: string) => {
    const clean = newSym.trim().toUpperCase().replace('$', '');
    if (!clean) return;
    setSymbol(clean);
    setSearchInput(clean);
    setSelectedExpiration(undefined);
    setLegs([]);
    setLimitPrice(0);
    setBpComparison(null);
  };

  // Strikes list filtered based on range
  const filteredStrikes = useMemo(() => {
    if (!chainData?.strikes) return [];
    let strikes = [...chainData.strikes];

    // Filter by moneyness
    if (moneynessFilter === 'itm') {
      strikes = strikes.filter(s => s.call?.inTheMoney || s.put?.inTheMoney);
    } else if (moneynessFilter === 'otm') {
      strikes = strikes.filter(s => !s.call?.inTheMoney || !s.put?.inTheMoney);
    }

    if (strikeRange === 'all' || strikes.length <= 12) {
      return strikes;
    }

    const count = parseInt(strikeRange, 10);
    const atmIdx = strikes.findIndex(s => s.isAtm);
    const centerIdx = atmIdx >= 0 ? atmIdx : Math.floor(strikes.length / 2);
    const half = Math.floor(count / 2);

    const start = Math.max(0, centerIdx - half);
    const end = Math.min(strikes.length, centerIdx + half);
    return strikes.slice(start, end);
  }, [chainData?.strikes, strikeRange, moneynessFilter]);

  // 1-Click add or toggle leg from option chain
  const handleToggleChainLeg = (
    action: 'BUY' | 'SELL',
    type: 'CALL' | 'PUT',
    strike: number,
    contract?: OptionContractRow
  ) => {
    if (!selectedExpiration) return;

    const existingIdx = legs.findIndex(
      l => l.strike === strike && l.type === type && l.expiration === selectedExpiration && l.action === action
    );

    if (existingIdx >= 0) {
      // Remove leg
      const next = legs.filter((_, idx) => idx !== existingIdx);
      setLegs(next);
      updateNetPrice(next);
      toast.info(`Removed ${action} ${strike} ${type}`);
    } else {
      // Add new leg
      const rawPrice = contract
        ? action === 'BUY'
          ? (contract.ask || contract.mid || 1.0)
          : (contract.bid || contract.mid || 1.0)
        : 1.0;
      const cleanPrice = Math.max(0.01, Math.round(rawPrice * 100) / 100);

      const newLeg: OptionDraftLeg = {
        id: `leg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        action,
        type,
        strike,
        expiration: selectedExpiration,
        quantity: 1,
        price: cleanPrice,
        delta: contract?.delta,
        theta: contract?.theta,
        gamma: contract?.gamma,
        vega: contract?.vega,
        impliedVolatility: contract?.impliedVolatility,
        contractSymbol: contract?.contractSymbol
      };

      const next = [...legs, newLeg];
      setLegs(next);
      updateNetPrice(next);
      toast.success(`Added ${action} ${symbol} $${strike} ${type}`, {
        description: `Exp: ${selectedExpiration} • Est: $${cleanPrice.toFixed(2)}`
      });
    }
  };

  // Update Net Price when legs change
  const updateNetPrice = (activeLegs: OptionDraftLeg[]) => {
    if (activeLegs.length === 0) {
      setLimitPrice(0);
      return;
    }
    let net = 0;
    activeLegs.forEach(l => {
      const effect = l.action === 'BUY' ? 1 : -1;
      net += effect * l.price * l.quantity;
    });
    setLimitPrice(Math.round(net * 100) / 100);
  };

  // Strategy Presets Applier
  const applyStrategyPreset = (preset: StrategyPreset) => {
    if (!chainData?.strikes || !selectedExpiration) return;
    const strikes = chainData.strikes;
    const spot = chainData.underlyingPrice || 150;
    const atmIdx = strikes.findIndex(s => s.isAtm);
    const centerIdx = atmIdx >= 0 ? atmIdx : Math.floor(strikes.length / 2);

    const atmStrike = strikes[centerIdx]?.strike || Math.round(spot);
    const otmCallStrike = strikes[Math.min(strikes.length - 1, centerIdx + 2)]?.strike || atmStrike + 5;
    const otmPutStrike = strikes[Math.max(0, centerIdx - 2)]?.strike || atmStrike - 5;
    const wingsCallStrike = strikes[Math.min(strikes.length - 1, centerIdx + 4)]?.strike || otmCallStrike + 5;
    const wingsPutStrike = strikes[Math.max(0, centerIdx - 4)]?.strike || otmPutStrike - 5;

    let newLegs: OptionDraftLeg[] = [];

    switch (preset) {
      case 'SINGLE_CALL':
        newLegs = [
          {
            id: 'leg_1',
            action: 'BUY',
            type: 'CALL',
            strike: atmStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx]?.call?.ask || strikes[centerIdx]?.call?.mid || 3.50,
            delta: strikes[centerIdx]?.call?.delta,
            theta: strikes[centerIdx]?.call?.theta
          }
        ];
        break;

      case 'SINGLE_PUT':
        newLegs = [
          {
            id: 'leg_1',
            action: 'BUY',
            type: 'PUT',
            strike: atmStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx]?.put?.ask || strikes[centerIdx]?.put?.mid || 3.50,
            delta: strikes[centerIdx]?.put?.delta,
            theta: strikes[centerIdx]?.put?.theta
          }
        ];
        break;

      case 'COVERED_CALL':
        newLegs = [
          {
            id: 'leg_1',
            action: 'SELL',
            type: 'CALL',
            strike: otmCallStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx + 2]?.call?.bid || strikes[centerIdx + 2]?.call?.mid || 1.80,
            delta: strikes[centerIdx + 2]?.call?.delta,
            theta: strikes[centerIdx + 2]?.call?.theta
          }
        ];
        break;

      case 'CASH_SECURED_PUT':
        newLegs = [
          {
            id: 'leg_1',
            action: 'SELL',
            type: 'PUT',
            strike: otmPutStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx - 2]?.put?.bid || strikes[centerIdx - 2]?.put?.mid || 1.80,
            delta: strikes[centerIdx - 2]?.put?.delta,
            theta: strikes[centerIdx - 2]?.put?.theta
          }
        ];
        break;

      case 'BULL_CALL_SPREAD':
        newLegs = [
          {
            id: 'leg_1',
            action: 'BUY',
            type: 'CALL',
            strike: atmStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx]?.call?.ask || 4.00,
            delta: strikes[centerIdx]?.call?.delta,
            theta: strikes[centerIdx]?.call?.theta
          },
          {
            id: 'leg_2',
            action: 'SELL',
            type: 'CALL',
            strike: otmCallStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx + 2]?.call?.bid || 1.50,
            delta: strikes[centerIdx + 2]?.call?.delta,
            theta: strikes[centerIdx + 2]?.call?.theta
          }
        ];
        break;

      case 'BEAR_PUT_SPREAD':
        newLegs = [
          {
            id: 'leg_1',
            action: 'BUY',
            type: 'PUT',
            strike: atmStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx]?.put?.ask || 4.00,
            delta: strikes[centerIdx]?.put?.delta,
            theta: strikes[centerIdx]?.put?.theta
          },
          {
            id: 'leg_2',
            action: 'SELL',
            type: 'PUT',
            strike: otmPutStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx - 2]?.put?.bid || 1.50,
            delta: strikes[centerIdx - 2]?.put?.delta,
            theta: strikes[centerIdx - 2]?.put?.theta
          }
        ];
        break;

      case 'CREDIT_PUT_SPREAD':
        newLegs = [
          {
            id: 'leg_1',
            action: 'SELL',
            type: 'PUT',
            strike: otmPutStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx - 2]?.put?.bid || 2.20,
            delta: strikes[centerIdx - 2]?.put?.delta,
            theta: strikes[centerIdx - 2]?.put?.theta
          },
          {
            id: 'leg_2',
            action: 'BUY',
            type: 'PUT',
            strike: wingsPutStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx - 4]?.put?.ask || 0.80,
            delta: strikes[centerIdx - 4]?.put?.delta,
            theta: strikes[centerIdx - 4]?.put?.theta
          }
        ];
        break;

      case 'IRON_CONDOR':
        newLegs = [
          {
            id: 'leg_1',
            action: 'BUY',
            type: 'PUT',
            strike: wingsPutStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: 0.60
          },
          {
            id: 'leg_2',
            action: 'SELL',
            type: 'PUT',
            strike: otmPutStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: 1.80
          },
          {
            id: 'leg_3',
            action: 'SELL',
            type: 'CALL',
            strike: otmCallStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: 1.80
          },
          {
            id: 'leg_4',
            action: 'BUY',
            type: 'CALL',
            strike: wingsCallStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: 0.60
          }
        ];
        break;

      case 'LONG_STRADDLE':
        newLegs = [
          {
            id: 'leg_1',
            action: 'BUY',
            type: 'CALL',
            strike: atmStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx]?.call?.ask || 3.50
          },
          {
            id: 'leg_2',
            action: 'BUY',
            type: 'PUT',
            strike: atmStrike,
            expiration: selectedExpiration,
            quantity: 1,
            price: strikes[centerIdx]?.put?.ask || 3.50
          }
        ];
        break;

      default:
        break;
    }

    setLegs(newLegs);
    updateNetPrice(newLegs);
    toast.success(`Loaded ${preset.replace(/_/g, ' ')} strategy preset`);
  };

  // Re-calculate Buying Power Comparison whenever trade draft parameters change
  useEffect(() => {
    if (!open || legs.length === 0) return;

    const primaryLeg = legs[0];
    const isDebit = limitPrice >= 0;
    const action = primaryLeg.action === 'BUY' ? 'BUY_TO_OPEN' : 'SELL_TO_OPEN';
    const cleanQty = primaryLeg.quantity || 1;
    const absPrice = Math.max(0.01, Math.abs(limitPrice) || primaryLeg.price || 1.0);

    // Compute exact DTE from chainData or primaryLeg expiration
    let dte = chainData?.selectedDte;
    if (!dte && primaryLeg.expiration) {
      const match = chainData?.expirations?.find(e => e.date === primaryLeg.expiration);
      if (match && match.dte) {
        dte = match.dte;
      } else {
        const diffMs = new Date(primaryLeg.expiration).getTime() - Date.now();
        dte = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }
    }
    if (!dte) dte = 25;

    // Implied Volatility: contract level, ATM chain level, or fallback
    const iv = primaryLeg.impliedVolatility || chainData?.analytics?.impliedVolatilityAtm || 45;

    let isMounted = true;
    setIsAnalyzingBp(true);

    analyzeBuyingPower({
      symbol,
      action,
      quantity: cleanQty,
      price: absPrice,
      orderType,
      instrumentType: 'Equity Option',
      optionDetails: {
        expirationDate: primaryLeg.expiration,
        strikePrice: primaryLeg.strike,
        optionType: primaryLeg.type === 'CALL' ? 'Call' : 'Put'
      },
      underlyingPrice: chainData?.underlyingPrice,
      impliedVolatility: iv,
      daysToExpiration: dte,
      delta: primaryLeg.delta,
      theta: primaryLeg.theta,
      gamma: primaryLeg.gamma,
      vega: primaryLeg.vega,
    })
      .then(res => {
        if (isMounted && res.comparison) {
          setBpComparison(res.comparison);
        }
      })
      .catch(err => {
        console.warn('[TradeStation] Buying power calculation note:', err.message);
      })
      .finally(() => {
        if (isMounted) setIsAnalyzingBp(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    open,
    symbol,
    legs,
    limitPrice,
    orderType,
    chainData?.underlyingPrice,
    chainData?.selectedDte,
    chainData?.analytics?.impliedVolatilityAtm
  ]);

  // Derived Net Greeks Rollup
  const netGreeks = useMemo(() => {
    let delta = 0;
    let gamma = 0;
    let theta = 0;
    let vega = 0;

    legs.forEach(l => {
      const mult = (l.action === 'BUY' ? 1 : -1) * l.quantity * 100;
      if (l.delta !== undefined) delta += l.delta * mult;
      if (l.gamma !== undefined) gamma += l.gamma * mult;
      if (l.theta !== undefined) theta += l.theta * mult;
      if (l.vega !== undefined) vega += l.vega * mult;
    });

    return {
      netDelta: Math.round(delta * 10) / 10,
      netGamma: Math.round(gamma * 100) / 100,
      netTheta: Math.round(theta * 100) / 100, // $/day decay
      netVega: Math.round(vega * 100) / 100,
    };
  }, [legs]);

  // Derived Risk & Payoff Metrics
  const riskMetrics = useMemo(() => {
    if (legs.length === 0) {
      return {
        netDebitOrCredit: 0,
        isDebit: true,
        maxProfit: 0,
        maxLoss: 0,
        breakevens: [] as number[],
        riskRewardRatio: 'N/A',
        popEstimate: 50,
      };
    }

    const netEffect = limitPrice;
    const isDebit = netEffect >= 0;
    const absPrice = Math.abs(netEffect);
    const contracts = legs[0]?.quantity || 1;
    const totalOutlay = Math.round(absPrice * contracts * 100 * 100) / 100;

    // Single leg analysis
    if (legs.length === 1) {
      const leg = legs[0];
      if (leg.action === 'BUY' && leg.type === 'CALL') {
        const be = leg.strike + absPrice;
        return {
          netDebitOrCredit: totalOutlay,
          isDebit: true,
          maxProfit: 'Unlimited' as any,
          maxLoss: totalOutlay,
          breakevens: [Math.round(be * 100) / 100],
          riskRewardRatio: 'Asymmetric (Bullish)',
          popEstimate: Math.max(15, Math.min(85, Math.round((leg.delta || 0.45) * 100))),
        };
      }
      if (leg.action === 'BUY' && leg.type === 'PUT') {
        const be = Math.max(0, leg.strike - absPrice);
        return {
          netDebitOrCredit: totalOutlay,
          isDebit: true,
          maxProfit: Math.round(leg.strike * contracts * 100 - totalOutlay),
          maxLoss: totalOutlay,
          breakevens: [Math.round(be * 100) / 100],
          riskRewardRatio: 'Asymmetric (Bearish)',
          popEstimate: Math.max(15, Math.min(85, Math.round(Math.abs(leg.delta || -0.45) * 100))),
        };
      }
      if (leg.action === 'SELL' && leg.type === 'CALL') {
        const be = leg.strike + absPrice;
        return {
          netDebitOrCredit: totalOutlay,
          isDebit: false,
          maxProfit: totalOutlay,
          maxLoss: 'Undefined / Unlimited' as any,
          breakevens: [Math.round(be * 100) / 100],
          riskRewardRatio: 'Defined Return (Short)',
          popEstimate: Math.max(50, Math.min(95, Math.round((1 - (leg.delta || 0.30)) * 100))),
        };
      }
      if (leg.action === 'SELL' && leg.type === 'PUT') {
        const be = Math.max(0, leg.strike - absPrice);
        return {
          netDebitOrCredit: totalOutlay,
          isDebit: false,
          maxProfit: totalOutlay,
          maxLoss: Math.round(leg.strike * contracts * 100 - totalOutlay),
          breakevens: [Math.round(be * 100) / 100],
          riskRewardRatio: 'Defined Return (Short)',
          popEstimate: Math.max(50, Math.min(95, Math.round((1 - Math.abs(leg.delta || -0.30)) * 100))),
        };
      }
    }

    // Vertical spreads
    if (legs.length === 2) {
      const sorted = [...legs].sort((a, b) => a.strike - b.strike);
      const width = Math.abs(sorted[1].strike - sorted[0].strike);
      const maxSpreadValue = width * contracts * 100;

      if (isDebit) {
        const maxProfit = Math.max(0, maxSpreadValue - totalOutlay);
        const maxLoss = totalOutlay;
        const rr = maxLoss > 0 ? (maxProfit / maxLoss).toFixed(2) : '1.0';
        const be = sorted[0].type === 'CALL' ? sorted[0].strike + absPrice : sorted[1].strike - absPrice;
        return {
          netDebitOrCredit: totalOutlay,
          isDebit: true,
          maxProfit,
          maxLoss,
          breakevens: [Math.round(be * 100) / 100],
          riskRewardRatio: `1 : ${rr}`,
          popEstimate: 52,
        };
      } else {
        const maxProfit = totalOutlay;
        const maxLoss = Math.max(0, maxSpreadValue - totalOutlay);
        const rr = maxProfit > 0 ? (maxLoss / maxProfit).toFixed(2) : '1.0';
        const be = sorted[0].type === 'PUT' ? sorted[1].strike - absPrice : sorted[0].strike + absPrice;
        return {
          netDebitOrCredit: totalOutlay,
          isDebit: false,
          maxProfit,
          maxLoss,
          breakevens: [Math.round(be * 100) / 100],
          riskRewardRatio: `${rr} : 1`,
          popEstimate: 68,
        };
      }
    }

    // Default multi-leg fallback
    return {
      netDebitOrCredit: totalOutlay,
      isDebit,
      maxProfit: totalOutlay * 1.5,
      maxLoss: totalOutlay,
      breakevens: [chainData?.underlyingPrice || 150],
      riskRewardRatio: '1 : 1.5',
      popEstimate: 55,
    };
  }, [legs, limitPrice, chainData?.underlyingPrice]);

  // Payoff Chart Curve Generator (Recharts Data)
  const payoffChartData = useMemo(() => {
    const spot = chainData?.underlyingPrice || 150;
    if (legs.length === 0) return [];

    const minPrice = Math.max(1, spot * 0.82);
    const maxPrice = spot * 1.18;
    const step = (maxPrice - minPrice) / 30;

    const data: { price: number; pnl: number; zero: number }[] = [];

    for (let p = minPrice; p <= maxPrice; p += step) {
      let totalPnl = 0;
      legs.forEach(leg => {
        const mult = (leg.action === 'BUY' ? 1 : -1) * leg.quantity * 100;
        let intrinsic = 0;
        if (leg.type === 'CALL') {
          intrinsic = Math.max(0, p - leg.strike);
        } else {
          intrinsic = Math.max(0, leg.strike - p);
        }
        // PnL = (Intrinsic value - price paid) * mult
        totalPnl += (intrinsic - leg.price) * mult;
      });

      data.push({
        price: Math.round(p * 10) / 10,
        pnl: Math.round(totalPnl),
        zero: 0
      });
    }

    return data;
  }, [legs, chainData?.underlyingPrice]);

  // Stage Trade Order into AI Trading Orders Workspace
  const handleStageOrder = async () => {
    if (legs.length === 0) {
      toast.error('Draft Empty', { description: 'Please add at least one option leg to the trade station draft.' });
      return;
    }

    setIsStagingOrder(true);
    try {
      const primaryLeg = legs[0];
      const isMultiLeg = legs.length > 1;
      const strategyName = isMultiLeg ? `Multi-Leg Options (${legs.length} legs)` : `${primaryLeg.action} $${primaryLeg.strike} ${primaryLeg.type}`;
      const action = primaryLeg.action === 'BUY' ? 'BUY_TO_OPEN' : 'SELL_TO_OPEN';
      const absPrice = Math.max(0.01, Math.abs(limitPrice) || primaryLeg.price || 1.0);

      const res = await createDraftOrder({
        symbol,
        action,
        broker: selectedBroker,
        instrumentType: 'Equity Option',
        quantity: primaryLeg.quantity || 1,
        orderType,
        price: absPrice,
        timeInForce,
        optionDetails: {
          expirationDate: primaryLeg.expiration,
          strikePrice: primaryLeg.strike,
          optionType: primaryLeg.type === 'CALL' ? 'Call' : 'Put'
        },
        notes: `Crafted in Options Trade Station: ${strategyName}. Net ${limitPrice >= 0 ? 'Debit' : 'Credit'}: $${Math.abs(limitPrice).toFixed(2)}.`
      });

      if (res.success && res.draft) {
        toast.success('Trade Draft Staged to AI Workspace!', {
          description: `Order ${res.draft.draftId} staged for ${selectedBroker.toUpperCase()}. Awaiting user execution.`
        });
        onOrderStaged?.(res.draft);
      }
    } catch (err: any) {
      console.error('Failed to stage order:', err);
      toast.error('Staging Failed', { description: err.message || 'Could not stage draft order.' });
    } finally {
      setIsStagingOrder(false);
    }
  };

  // Copy trade specifications to clipboard
  const handleCopySpecs = () => {
    if (legs.length === 0) return;
    const summary = [
      `⚡ TRADE SPECIFICATIONS: ${symbol}`,
      `Broker: ${selectedBroker.toUpperCase()}`,
      `Order Type: ${orderType} @ $${Math.abs(limitPrice).toFixed(2)} (${limitPrice >= 0 ? 'Debit' : 'Credit'})`,
      `Legs:`,
      ...legs.map(
        l => ` • ${l.action} ${l.quantity}x ${l.expiration} $${l.strike} ${l.type} @ $${l.price.toFixed(2)}`
      ),
      `Max Profit: ${riskMetrics.maxProfit === 'Unlimited' ? 'Unlimited' : `$${riskMetrics.maxProfit}`}`,
      `Max Loss: $${riskMetrics.maxLoss}`,
      `Breakevens: ${riskMetrics.breakevens.map(b => `$${b}`).join(', ')}`,
      `Est. POP: ${riskMetrics.popEstimate}%`
    ].join('\n');

    navigator.clipboard.writeText(summary);
    toast.success('Trade Specs Copied', { description: 'Pasted summary to your clipboard.' });
  };

  // Live balances helpers
  const tastyBp = balancesData?.brokers?.tastytrade?.buyingPower ?? 15738.87;
  const tastyDerivBp = balancesData?.brokers?.tastytrade?.derivativeBuyingPower ?? tastyBp;

  // Specific live IBKR GIA Margin account (U15491236)
  const ibkrGiaAccount = balancesData?.brokers?.ibkr?.accounts?.find(
    (a: any) => a.accountNumber === 'U15491236' || a.accountKey === 'ibkr_gia' || a.accountType?.toLowerCase()?.includes('margin')
  );
  const ibkrGiaBp = ibkrGiaAccount?.buyingPower ?? balancesData?.brokers?.ibkr?.buyingPower ?? 16609.08;
  const ibkrGiaAvail = ibkrGiaAccount?.availableFunds ?? balancesData?.brokers?.ibkr?.availableFunds ?? ibkrGiaBp;
  const ibkrFxRate = 1.3351;
  const ibkrGiaBpGbp = Math.round(ibkrGiaBp / ibkrFxRate);
  const ibkrGiaAvailGbp = Math.round(ibkrGiaAvail / ibkrFxRate);

  const ibkrTotalBp = balancesData?.brokers?.ibkr?.buyingPower ?? 73186.14;
  const totalBp = balancesData?.total?.buyingPower ?? (tastyBp + ibkrTotalBp);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden bg-slate-950 text-slate-100 border border-purple-500/30 shadow-2xl backdrop-blur-3xl flex flex-col transition-all duration-200",
          isFullscreen
            ? "fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none z-[100]"
            : "w-[98vw] max-w-[1720px] h-[95vh] rounded-2xl"
        )}
      >
        {/* =========================================================================
            TOP HEADER & BROKER BUYING POWER RIBBON
           ========================================================================= */}
        <DialogHeader className="sr-only">
          <DialogTitle>Options Trade Station</DialogTitle>
          <DialogDescription>
            Interactive multi-leg staging, Greeks analysis, and Tastytrade vs. IBKR margin comparison
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/70 bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-indigo-950/40 p-3 sm:px-5 flex flex-col gap-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Branding & Ticker Selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-md">
                <Zap className="w-4 h-4 text-purple-300" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base tracking-wider text-white flex items-center gap-1.5">
                    OPTIONS TRADE STATION
                  </span>
                  <Badge className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border-purple-500/40">
                    PRO TERMINAL
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400">
                  Interactive multi-leg staging • Real-time Greeks • Tastytrade vs. IBKR margin comparison
                </p>
              </div>

              {/* Ticker Search Box */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-2.5 py-1 shadow-inner ml-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleApplySymbol(searchInput);
                  }}
                  placeholder="Ticker..."
                  className="w-20 bg-transparent text-xs font-mono font-bold text-white focus:outline-none uppercase"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleApplySymbol(searchInput)}
                  className="h-5 px-1.5 text-[10px] text-purple-300 hover:text-white"
                >
                  GO
                </Button>
              </div>

              {/* Quick Chips */}
              <div className="hidden xl:flex items-center gap-1 text-[11px] font-mono">
                {POPULAR_TICKERS.map(sym => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleApplySymbol(sym)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg border transition-all cursor-pointer",
                      symbol === sym
                        ? "bg-purple-600 text-white border-purple-400 font-bold shadow-xs"
                        : "bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-white"
                    )}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Window Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchBalances()}
                disabled={isFetchingBalances}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white cursor-pointer"
                title="Refresh Buying Power & Balances"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isFetchingBalances && "animate-spin text-purple-400")} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Edge-to-Edge Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 cursor-pointer"
                title="Close Station"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ================= SECONDARY RIBBON: LIVE BROKER BUYING POWER & UNDERLYING METRICS ================= */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center pt-1">
            {/* Spot Price & Underlying Stats (col-span-5) */}
            <div className="md:col-span-4 flex items-center gap-3 bg-slate-900/60 border border-border/50 rounded-xl px-3 py-1.5">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Underlying</div>
                <div className="font-mono font-bold text-sm text-white flex items-center gap-1.5">
                  <span>{chainData?.symbol || symbol}</span>
                  <span className="text-white">
                    ${(chainData?.underlyingPrice || 0).toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      (chainData?.underlyingChange || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {(chainData?.underlyingChange || 0) >= 0 ? '+' : ''}
                    {(chainData?.underlyingChange || 0).toFixed(2)} (
                    {(chainData?.underlyingChangePercent || 0).toFixed(2)}%)
                  </span>
                </div>
              </div>

              {chainData?.analytics && (
                <div className="border-l border-border/60 pl-2.5 text-[10px] font-mono text-slate-300 space-y-0.5">
                  <div>
                    IV: <strong className="text-amber-300">{(chainData.analytics.impliedVolatilityAtm || 0).toFixed(1)}%</strong>
                  </div>
                  <div>
                    Exp Move: <strong className="text-indigo-300">±${(chainData.analytics.expectedMoveDollars || 0).toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* LIVE BROKER BUYING POWER CARDS (col-span-8) */}
            <div className="md:col-span-8 flex items-center gap-2 overflow-x-auto pb-0.5">
              {/* Tastytrade Pill */}
              <div
                onClick={() => setSelectedBroker('tastytrade')}
                className={cn(
                  "px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 shrink-0 select-none",
                  selectedBroker === 'tastytrade'
                    ? "bg-rose-950/40 border-rose-500/60 shadow-xs ring-1 ring-rose-500/40"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 opacity-80"
                )}
                title="Click to route trades via Tastytrade"
              >
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <div className="text-left">
                  <div className="text-[10px] text-rose-300 font-semibold uppercase flex items-center gap-1">
                    <span>Tastytrade</span>
                    {selectedBroker === 'tastytrade' && (
                      <Badge className="text-[8px] px-1 py-0 bg-rose-500 text-white">ACTIVE ROUTE</Badge>
                    )}
                  </div>
                  <div className="text-xs font-mono font-black text-white">
                    ${tastyBp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[9px] font-mono text-slate-400 pl-1 border-l border-slate-700/60">
                  Deriv: ${tastyDerivBp.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* IBKR Pill */}
              <div
                onClick={() => setSelectedBroker('ibkr')}
                className={cn(
                  "px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 shrink-0 select-none",
                  selectedBroker === 'ibkr'
                    ? "bg-blue-950/40 border-blue-500/60 shadow-xs ring-1 ring-blue-500/40"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 opacity-80"
                )}
                title="Click to route trades via Interactive Brokers (Live Margin Account U15491236)"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <div className="text-left">
                  <div className="text-[10px] text-blue-300 font-semibold uppercase flex items-center gap-1">
                    <span>IBKR ({ibkrGiaAccount?.accountNumber || 'U15491236'})</span>
                    <Badge className="text-[8px] px-1 py-0 bg-blue-500/30 text-blue-300 border border-blue-400/40">LIVE</Badge>
                    {selectedBroker === 'ibkr' && (
                      <Badge className="text-[8px] px-1 py-0 bg-blue-500 text-white">ACTIVE ROUTE</Badge>
                    )}
                  </div>
                  <div className="text-xs font-mono font-black text-white flex items-center gap-1.5">
                    <span>£{ibkrGiaBpGbp.toLocaleString('en-GB')}</span>
                    <span className="text-[10px] text-slate-400 font-normal">(${ibkrGiaBp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                  </div>
                </div>
                <div className="text-[9px] font-mono text-slate-400 pl-1 border-l border-slate-700/60 leading-tight">
                  <div>Avail: £{ibkrGiaAvailGbp.toLocaleString('en-GB')}</div>
                  <div className="text-[8px] text-slate-500">Margin GBP</div>
                </div>
              </div>

              {/* Total Buying Power */}
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-2 shrink-0">
                <Scale className="w-3.5 h-3.5 text-purple-400" />
                <div>
                  <div className="text-[9px] text-slate-400 uppercase font-semibold">Total Portfolio BP</div>
                  <div className="text-xs font-mono font-bold text-purple-300">
                    ${totalBp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            MAIN 3-PANEL WORKSPACE
           ========================================================================= */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* =========================================================================
              LEFT PANEL (Col 6): INTERACTIVE OPTION CHAIN MATRIX
             ========================================================================= */}
          <div className="lg:col-span-6 border-r border-border/70 flex flex-col h-full overflow-hidden bg-slate-950/60">
            {/* Expiration cycles ribbon */}
            <div className="p-2.5 bg-slate-900/60 border-b border-border/60 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-0.5">
                {chainData?.expirations?.map(exp => {
                  const isSelected = exp.date === selectedExpiration;
                  return (
                    <button
                      key={exp.date}
                      type="button"
                      onClick={() => setSelectedExpiration(exp.date)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-xs font-mono transition-all flex items-center gap-1 shrink-0 border cursor-pointer",
                        isSelected
                          ? "bg-purple-600 text-white font-bold border-purple-400 shadow-md"
                          : "bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                      )}
                    >
                      <span>{exp.formattedDate || exp.date}</span>
                      <span className="text-[10px] opacity-75">({exp.dte}d)</span>
                    </button>
                  );
                })}
              </div>

              {/* Range Filter */}
              <div className="flex items-center gap-1 text-[11px] font-mono shrink-0 pl-2">
                <span className="text-slate-500">Strikes:</span>
                {(['10', '20', 'all'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setStrikeRange(r)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer",
                      strikeRange === r
                        ? "bg-secondary text-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Matrix Table Header */}
            <div className="grid grid-cols-12 text-[10px] font-mono uppercase font-bold py-1.5 px-3 bg-slate-900/80 text-slate-400 border-b border-border/60 shrink-0">
              <div className="col-span-5 grid grid-cols-5 text-left">
                <span className="text-emerald-400">CALLS</span>
                <span>Delta</span>
                <span>IV</span>
                <span>Bid</span>
                <span className="text-emerald-400 font-bold">Ask (Buy)</span>
              </div>
              <div className="col-span-2 text-center text-amber-300 font-bold">
                STRIKE
              </div>
              <div className="col-span-5 grid grid-cols-5 text-right">
                <span className="text-rose-400 font-bold text-left">Bid (Sell)</span>
                <span className="text-rose-400">Ask</span>
                <span>IV</span>
                <span>Delta</span>
                <span className="text-rose-400">PUTS</span>
              </div>
            </div>

            {/* Matrix Scrollable Rows */}
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5 text-xs font-mono">
              {isLoadingChain ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                  <span>Loading {symbol} Options Matrix...</span>
                </div>
              ) : filteredStrikes.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No option strikes available for selected cycle.
                </div>
              ) : (
                filteredStrikes.map(row => {
                  const strike = row.strike;
                  const callLeg = legs.find(l => l.strike === strike && l.type === 'CALL');
                  const putLeg = legs.find(l => l.strike === strike && l.type === 'PUT');

                  return (
                    <div
                      key={strike}
                      className={cn(
                        "grid grid-cols-12 items-center py-1 px-2 rounded-lg transition-colors border",
                        row.isAtm
                          ? "bg-purple-950/30 border-purple-500/40"
                          : "border-transparent hover:bg-slate-900/60"
                      )}
                    >
                      {/* Calls Side (Col 5) */}
                      <div className="col-span-5 grid grid-cols-5 items-center text-left text-[11px]">
                        <span
                          className="text-slate-400 truncate cursor-default"
                          title={`Call Vol: ${(row.call?.volume || 0).toLocaleString()} | OI: ${(row.call?.openInterest || 0).toLocaleString()}`}
                        >
                          {callLeg ? (
                            <Badge className="text-[9px] px-1 py-0 bg-purple-600 text-white">
                              {callLeg.action}
                            </Badge>
                          ) : (
                            formatVol(row.call?.volume)
                          )}
                        </span>
                        <span className="text-slate-300">{row.call?.delta ? row.call.delta.toFixed(2) : '-'}</span>
                        <span className="text-slate-400">{row.call?.impliedVolatility ? `${row.call.impliedVolatility.toFixed(0)}%` : '-'}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleChainLeg('SELL', 'CALL', strike, row.call)}
                          className="hover:text-amber-300 text-slate-300 font-mono transition-colors text-left cursor-pointer"
                          title={`Sell ${strike} Call @ $${row.call?.bid?.toFixed(2) || '0.00'}`}
                        >
                          {row.call?.bid ? `$${row.call.bid.toFixed(2)}` : '-'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleChainLeg('BUY', 'CALL', strike, row.call)}
                          className="font-bold text-emerald-400 hover:text-emerald-300 transition-colors text-left cursor-pointer"
                          title={`Buy ${strike} Call @ $${row.call?.ask?.toFixed(2) || '0.00'}`}
                        >
                          {row.call?.ask ? `$${row.call.ask.toFixed(2)}` : '-'}
                        </button>
                      </div>

                      {/* Center Strike Ladder (Col 2) */}
                      <div className="col-span-2 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded font-black tracking-wider text-xs",
                            row.isAtm
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "text-white"
                          )}
                        >
                          ${strike.toFixed(1)}
                        </span>
                      </div>

                      {/* Puts Side (Col 5) */}
                      <div className="col-span-5 grid grid-cols-5 items-center text-right text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleToggleChainLeg('SELL', 'PUT', strike, row.put)}
                          className="font-bold text-rose-400 hover:text-rose-300 transition-colors text-left cursor-pointer"
                          title={`Sell ${strike} Put @ $${row.put?.bid?.toFixed(2) || '0.00'}`}
                        >
                          {row.put?.bid ? `$${row.put.bid.toFixed(2)}` : '-'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleChainLeg('BUY', 'PUT', strike, row.put)}
                          className="hover:text-amber-300 text-slate-300 font-mono transition-colors text-right cursor-pointer"
                          title={`Buy ${strike} Put @ $${row.put?.ask?.toFixed(2) || '0.00'}`}
                        >
                          {row.put?.ask ? `$${row.put.ask.toFixed(2)}` : '-'}
                        </button>
                        <span className="text-slate-400">{row.put?.impliedVolatility ? `${row.put.impliedVolatility.toFixed(0)}%` : '-'}</span>
                        <span className="text-slate-300">{row.put?.delta ? row.put.delta.toFixed(2) : '-'}</span>
                        <span
                          className="text-slate-400 truncate cursor-default"
                          title={`Put Vol: ${(row.put?.volume || 0).toLocaleString()} | OI: ${(row.put?.openInterest || 0).toLocaleString()}`}
                        >
                          {putLeg ? (
                            <Badge className="text-[9px] px-1 py-0 bg-purple-600 text-white">
                              {putLeg.action}
                            </Badge>
                          ) : (
                            formatVol(row.put?.volume)
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* =========================================================================
              CENTER PANEL (Col 3): ACTIVE TRADE DRAFT & STRATEGY BUILDER
             ========================================================================= */}
          <div className="lg:col-span-3 border-r border-border/70 flex flex-col h-full overflow-hidden bg-slate-950/80 p-3 space-y-3">
            {/* Header: Presets */}
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                Strategy Builder
              </span>

              <select
                onChange={e => applyStrategyPreset(e.target.value as StrategyPreset)}
                className="bg-slate-900 border border-slate-700 text-[11px] rounded-lg px-2 py-1 text-purple-300 focus:outline-none cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>Load Preset Strategy...</option>
                <option value="SINGLE_CALL">Long Call (Bullish)</option>
                <option value="SINGLE_PUT">Long Put (Bearish)</option>
                <option value="COVERED_CALL">Covered Call (Income)</option>
                <option value="CASH_SECURED_PUT">Cash-Secured Put</option>
                <option value="BULL_CALL_SPREAD">Bull Call Spread (Debit)</option>
                <option value="BEAR_PUT_SPREAD">Bear Put Spread (Debit)</option>
                <option value="CREDIT_PUT_SPREAD">Credit Put Spread</option>
                <option value="IRON_CONDOR">Iron Condor (Neutral)</option>
                <option value="LONG_STRADDLE">Long Straddle (Vol Breakout)</option>
              </select>
            </div>

            {/* Draft Legs List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {legs.length === 0 ? (
                <div className="p-6 border border-dashed border-slate-800 rounded-xl text-center text-slate-400 space-y-2">
                  <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-medium">No legs in draft</p>
                  <p className="text-[11px] text-slate-500">
                    Click Ask to Buy or Bid to Sell on the options chain, or select a strategy preset above.
                  </p>
                </div>
              ) : (
                legs.map((leg, idx) => (
                  <div
                    key={leg.id}
                    className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...legs];
                            next[idx].action = next[idx].action === 'BUY' ? 'SELL' : 'BUY';
                            setLegs(next);
                            updateNetPrice(next);
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors",
                            leg.action === 'BUY'
                              ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/40"
                              : "bg-rose-600/30 text-rose-400 border border-rose-500/40"
                          )}
                        >
                          {leg.action}
                        </button>

                        <span className="font-mono font-bold text-white">
                          ${leg.strike} {leg.type}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const next = legs.filter((_, i) => i !== idx);
                          setLegs(next);
                          updateNetPrice(next);
                        }}
                        className="text-slate-400 hover:text-rose-400 cursor-pointer p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500">Contracts:</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={leg.quantity}
                          onChange={e => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            const next = [...legs];
                            next[idx].quantity = val;
                            setLegs(next);
                            updateNetPrice(next);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white mt-0.5"
                        />
                      </div>

                      <div>
                        <span className="text-slate-500">Price ($):</span>
                        <input
                          type="number"
                          step={0.05}
                          min={0.01}
                          value={leg.price}
                          onChange={e => {
                            const val = Math.max(0.01, parseFloat(e.target.value) || 0.01);
                            const next = [...legs];
                            next[idx].price = val;
                            setLegs(next);
                            updateNetPrice(next);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pricing & Execution Controls */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Order Pricing:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOrderType('Limit')}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer",
                      orderType === 'Limit' ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                    )}
                  >
                    Limit
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('Market')}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer",
                      orderType === 'Market' ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                    )}
                  >
                    Market
                  </button>
                </div>
              </div>

              {orderType === 'Limit' && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-400">Limit Price:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <button
                      type="button"
                      onClick={() => setLimitPrice(prev => Math.round((prev - 0.05) * 100) / 100)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step={0.05}
                      value={Math.abs(limitPrice)}
                      onChange={e => setLimitPrice(parseFloat(e.target.value) || 0)}
                      className="w-16 text-center bg-slate-950 border border-slate-700 rounded py-0.5 text-white text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setLimitPrice(prev => Math.round((prev + 0.05) * 100) / 100)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Net Price Effect Badge */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Effect</div>
                  <Badge
                    className={cn(
                      "text-xs font-mono font-bold mt-0.5",
                      limitPrice >= 0
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    )}
                  >
                    {limitPrice >= 0 ? `DEBIT: $${Math.abs(limitPrice).toFixed(2)}` : `CREDIT: $${Math.abs(limitPrice).toFixed(2)}`}
                  </Badge>
                </div>

                <div className="text-right font-mono">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Capital</div>
                  <div className="text-sm font-black text-white">
                    ${riskMetrics.netDebitOrCredit.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Tastytrade Quantitative Metrics Ribbon (POP, EXT, P50, Delta, Theta, CVaR, Max Profit, Max Loss, BP Eff) */}
            {legs.length > 0 && bpComparison?.tastyMetrics && (
              <div className="p-3 bg-slate-900/95 border border-purple-500/30 rounded-xl space-y-2 shrink-0 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between text-[11px] uppercase font-bold tracking-wide border-b border-slate-800 pb-1.5">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    Tastytrade Quant Analytics
                  </span>
                  <Badge className="font-mono bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] px-2 py-0.5 font-black">
                    BP EFF: ${bpComparison.tastyMetrics.bpEff.toLocaleString('en-US', { minimumFractionDigits: 2 })} {bpComparison.tastyMetrics.bpEffDirection}
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors">
                    <div className="text-[9px] text-slate-400 uppercase font-semibold">POP</div>
                    <div className="font-black text-emerald-400 text-sm mt-0.5">
                      {bpComparison.tastyMetrics.pop}%
                    </div>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors">
                    <div className="text-[9px] text-slate-400 uppercase font-semibold">EXT</div>
                    <div className="font-black text-amber-300 text-sm mt-0.5">
                      ${bpComparison.tastyMetrics.ext.toFixed(0)}
                    </div>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors">
                    <div className="text-[9px] text-slate-400 uppercase font-semibold">P50</div>
                    <div className="font-black text-purple-300 text-sm mt-0.5">
                      {bpComparison.tastyMetrics.p50}%
                    </div>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors">
                    <div className="text-[9px] text-slate-400 uppercase font-semibold">CVaR (95%)</div>
                    <div className="font-black text-rose-400 text-sm mt-0.5">
                      {bpComparison.tastyMetrics.cvar < 0
                        ? `-$${Math.abs(bpComparison.tastyMetrics.cvar).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `$${bpComparison.tastyMetrics.cvar.toFixed(2)}`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
                  <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60">
                    <div className="text-[8px] text-slate-400 uppercase font-semibold">Delta</div>
                    <div className={cn("font-black text-xs mt-0.5", bpComparison.tastyMetrics.delta >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {bpComparison.tastyMetrics.delta > 0 ? `+${bpComparison.tastyMetrics.delta}` : bpComparison.tastyMetrics.delta}
                    </div>
                  </div>
                  <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60">
                    <div className="text-[8px] text-slate-400 uppercase font-semibold">Theta</div>
                    <div className={cn("font-black text-xs mt-0.5", bpComparison.tastyMetrics.theta >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {bpComparison.tastyMetrics.theta > 0 ? `+${bpComparison.tastyMetrics.theta.toFixed(2)}` : bpComparison.tastyMetrics.theta.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60">
                    <div className="text-[8px] text-slate-400 uppercase font-semibold">Max Profit</div>
                    <div className="font-black text-xs mt-0.5 text-emerald-400">
                      ${bpComparison.tastyMetrics.maxProfit}
                    </div>
                  </div>
                  <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60">
                    <div className="text-[8px] text-slate-400 uppercase font-semibold">Max Loss</div>
                    <div className="font-black text-xs mt-0.5 text-rose-400">
                      {typeof bpComparison.tastyMetrics.maxLoss === 'number'
                        ? (bpComparison.tastyMetrics.maxLoss < 0
                            ? `-$${Math.abs(bpComparison.tastyMetrics.maxLoss).toLocaleString()}`
                            : `$${bpComparison.tastyMetrics.maxLoss.toLocaleString()}`)
                        : bpComparison.tastyMetrics.maxLoss}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              RIGHT PANEL (Col 3): COMPARISON & METRICS TABS
             ========================================================================= */}
          <div className="lg:col-span-3 flex flex-col h-full overflow-hidden bg-slate-950/90 p-3 space-y-3">
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="w-full flex-1 flex flex-col">
              <TabsList className="grid grid-cols-2 bg-slate-900 border border-slate-800 rounded-xl p-0.5 shrink-0">
                <TabsTrigger
                  value="comparison"
                  onClick={() => setActiveTab('comparison')}
                  className="text-xs font-semibold py-1.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5 mr-1 text-purple-300" />
                  Broker BP Compare
                </TabsTrigger>
                <TabsTrigger
                  value="metrics"
                  onClick={() => setActiveTab('metrics')}
                  className="text-xs font-semibold py-1.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 mr-1 text-indigo-300" />
                  Risk & Payoff
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: BUYING POWER COMPARISON (TASTYTRADE VS. IBKR) */}
              <TabsContent value="comparison" className="flex-1 overflow-y-auto space-y-3 pt-2">
                {isAnalyzingBp ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                    <span>Analyzing Tastytrade vs. IBKR margin...</span>
                  </div>
                ) : bpComparison ? (
                  <div className="space-y-3">
                    {/* Recommendation Banner */}
                    <div className="p-3 bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/40 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-200">
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>AI Execution Verdict:</span>
                        <Badge className="text-[10px] bg-purple-600 text-white uppercase font-mono">
                          {bpComparison.verdict?.recommendedBroker?.toUpperCase()} RECOMMENDED
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {bpComparison.verdict?.summary || 'Comparative margin analyzed for optimal capital efficiency.'}
                      </p>
                    </div>

                    {/* Side-by-Side Cards */}
                    <div className="space-y-2.5 font-mono text-xs">
                      {/* Tastytrade Card */}
                      <div
                        onClick={() => setSelectedBroker('tastytrade')}
                        className={cn(
                          "p-3 rounded-xl border transition-all cursor-pointer",
                          selectedBroker === 'tastytrade'
                            ? "bg-rose-950/30 border-rose-500/60 ring-1 ring-rose-500/40"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                        )}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <span className="font-bold text-rose-300 flex items-center gap-1.5">
                            <span>Tastytrade</span>
                            {bpComparison.verdict?.capitalEfficiencyWinner === 'tastytrade' && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-600 text-white">Capital Winner</Badge>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400">Account 5WT67220</span>
                        </div>

                        <div className="pt-2 space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Buying Power Effect:</span>
                            <Badge className="font-mono bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs font-black">
                              ${(bpComparison.tastytrade.buyingPowerEffect ?? bpComparison.tastytrade.buyingPowerRequirement ?? 0).toFixed(2)} db
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Margin Req:</span>
                            <span className="text-slate-300 font-semibold">
                              ${(bpComparison.tastytrade.initialMarginRequirement ?? bpComparison.tastytrade.buyingPowerRequirement ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Post-Trade BP:</span>
                            <span className="text-white font-bold">
                              ${(bpComparison.tastytrade.postTradeAvailableBuyingPower ?? bpComparison.tastytrade.postTradeBuyingPower ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Est. Commission:</span>
                            <span className="text-slate-300">
                              ${(bpComparison.tastytrade.estimatedCommission ?? 0).toFixed(2)} ($0 close)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Buffer Remaining:</span>
                            <span className="text-emerald-400 font-bold">
                              {(bpComparison.tastytrade.remainingBufferPercentage ?? bpComparison.tastytrade.postTradeBufferPercent ?? 0).toFixed(1)}%
                            </span>
                          </div>
                          <div className="pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 leading-tight">
                            Rule: {bpComparison.tastytrade.marginMethod || 'Apex / FINRA 4210 Uncovered'}
                          </div>
                        </div>
                      </div>

                      {/* IBKR Card */}
                      <div
                        onClick={() => setSelectedBroker('ibkr')}
                        className={cn(
                          "p-3 rounded-xl border transition-all cursor-pointer",
                          selectedBroker === 'ibkr'
                            ? "bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/40"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                        )}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <span className="font-bold text-blue-300 flex items-center gap-1.5">
                            <span>Interactive Brokers</span>
                            {bpComparison.verdict?.feeWinner === 'ibkr' && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-600 text-white">Fee Winner</Badge>
                            )}
                          </span>
                          <span className="text-[10px] text-blue-300 font-mono font-semibold">
                            {bpComparison.ibkr.accountNumber || 'U15491236'} ({bpComparison.ibkr.environment || 'Live Margin'})
                          </span>
                        </div>

                        <div className="pt-2 space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Reg-T Initial Margin:</span>
                            <div className="text-right">
                              {bpComparison.ibkr.initialMarginRequirementBase !== undefined ? (
                                <>
                                  <span className="font-black text-white text-xs">
                                    £{bpComparison.ibkr.initialMarginRequirementBase.toLocaleString('en-GB')}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-1">
                                    (${(bpComparison.ibkr.initialMarginRequirement ?? bpComparison.ibkr.buyingPowerRequirement ?? 0).toFixed(2)})
                                  </span>
                                </>
                              ) : (
                                <span className="font-black text-white text-xs">
                                  ${(bpComparison.ibkr.initialMarginRequirement ?? bpComparison.ibkr.buyingPowerRequirement ?? 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Maintenance Margin:</span>
                            <div className="text-right">
                              {bpComparison.ibkr.maintenanceMarginRequirementBase !== undefined ? (
                                <>
                                  <span className="text-slate-300">
                                    £{bpComparison.ibkr.maintenanceMarginRequirementBase.toLocaleString('en-GB')}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-1">
                                    (${(bpComparison.ibkr.maintenanceMarginRequirement ?? 0).toFixed(2)})
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-300">
                                  ${(bpComparison.ibkr.maintenanceMarginRequirement ?? 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          {bpComparison.ibkr.portfolioMarginRequirement !== undefined && bpComparison.ibkr.portfolioMarginRequirement > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Portfolio Margin (PM):</span>
                              <span className="text-cyan-300 font-bold">
                                ${bpComparison.ibkr.portfolioMarginRequirement.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Post-Trade BP:</span>
                            <div className="text-right">
                              {bpComparison.ibkr.postTradeBuyingPowerBase !== undefined ? (
                                <>
                                  <span className="text-slate-300">
                                    £{bpComparison.ibkr.postTradeBuyingPowerBase.toLocaleString('en-GB')}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-1">
                                    (${(bpComparison.ibkr.postTradeAvailableBuyingPower ?? bpComparison.ibkr.postTradeBuyingPower ?? 0).toFixed(2)})
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-300">
                                  ${(bpComparison.ibkr.postTradeAvailableBuyingPower ?? bpComparison.ibkr.postTradeBuyingPower ?? 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Est. Commission:</span>
                            <span className="text-slate-300">
                              ${(bpComparison.ibkr.estimatedCommission ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Buffer Remaining:</span>
                            <span className="text-emerald-400 font-bold">
                              {(bpComparison.ibkr.remainingBufferPercentage ?? bpComparison.ibkr.postTradeBufferPercent ?? 0).toFixed(1)}%
                            </span>
                          </div>
                          <div className="pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 leading-tight flex justify-between items-center">
                            <span>Rule: {bpComparison.ibkr.marginMethod || 'Reg-T Initial Margin'}</span>
                            <span className="text-blue-300 font-medium font-mono">Base: {bpComparison.ibkr.baseCurrency || 'GBP'} • Live</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    Configure a trade draft on the left to see live buying power comparisons.
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: RISK & PAYOFF METRICS */}
              <TabsContent value="metrics" className="flex-1 overflow-y-auto space-y-3 pt-2">
                {/* Payoff SVG Chart */}
                <div className="p-2 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                    <span>P&L Payoff At Expiration</span>
                    <span className="text-purple-300 font-mono">Spot: ${chainData?.underlyingPrice?.toFixed(2) || '0.00'}</span>
                  </div>

                  <div className="h-28 w-full">
                    {payoffChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={payoffChartData}>
                          <defs>
                            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="price" hide />
                          <YAxis hide domain={['auto', 'auto']} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                            formatter={(value: any) => [`$${value}`, 'P&L']}
                            labelFormatter={(label: any) => `Stock: $${label}`}
                          />
                          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                          <Area
                            type="monotone"
                            dataKey="pnl"
                            stroke="#8b5cf6"
                            fill="url(#profitGrad)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500">
                        Add trade legs to view payoff profile
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics Table */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Profit:</span>
                    <span className="font-bold text-emerald-400">
                      {riskMetrics.maxProfit === 'Unlimited' ? 'Unlimited' : `$${riskMetrics.maxProfit}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Loss:</span>
                    <span className="font-bold text-rose-400">
                      ${riskMetrics.maxLoss}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Risk/Reward:</span>
                    <span className="text-purple-300 font-bold">{riskMetrics.riskRewardRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Breakeven(s):</span>
                    <span className="text-amber-300 font-bold">
                      {riskMetrics.breakevens.length > 0 ? riskMetrics.breakevens.map(b => `$${b}`).join(', ') : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Probability of Profit:</span>
                    <span className="text-emerald-400 font-bold">~{riskMetrics.popEstimate}%</span>
                  </div>
                </div>

                {/* Net Greeks Rollup */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5 font-mono text-xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400 pb-1 border-b border-slate-800">
                    Net Greeks Exposure
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net Delta:</span>
                      <span className={cn(netGreeks.netDelta >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {netGreeks.netDelta}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net Theta:</span>
                      <span className={cn(netGreeks.netTheta >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        ${netGreeks.netTheta}/d
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net Gamma:</span>
                      <span className="text-slate-300">{netGreeks.netGamma}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net Vega:</span>
                      <span className="text-slate-300">{netGreeks.netVega}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* =========================================================================
            BOTTOM EXECUTION & STAGING ACTION BAR
           ========================================================================= */}
        <div className="border-t border-border/70 bg-slate-900/90 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">Execution Venue:</span>
            <Badge className={cn("text-xs font-bold", selectedBroker === 'tastytrade' ? "bg-rose-600 text-white" : "bg-blue-600 text-white")}>
              {selectedBroker.toUpperCase()}
            </Badge>
            <span className="text-slate-400">
              Legs: <strong className="text-white">{legs.length}</strong>
            </span>
            <span className="text-slate-400">
              Net Outlay: <strong className="text-white">${riskMetrics.netDebitOrCredit.toFixed(2)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLegs([]);
                setLimitPrice(0);
                toast.info('Draft cleared');
              }}
              disabled={legs.length === 0}
              className="h-8 text-xs border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Reset Draft
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySpecs}
              disabled={legs.length === 0}
              className="h-8 text-xs border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 cursor-pointer flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Specs</span>
            </Button>

            <Button
              size="sm"
              onClick={handleStageOrder}
              disabled={legs.length === 0 || isStagingOrder}
              className="h-8 px-4 text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/50 cursor-pointer flex items-center gap-1.5"
            >
              {isStagingOrder ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>Stage to AI Trading Workspace</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullWindowOptionsTradeStationModal;
