// src/components/OptionChainCard.tsx
// Interactive, high-tech Options Chain Matrix Card for AI Copilot Chat

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Layers,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import { FormattedOptionChain, FormattedOptionExpiration } from '@/services/tastytrade';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface OptionChainCardProps {
  initialChain?: FormattedOptionChain;
  chain?: FormattedOptionChain;
  onSelectContract?: (
    action: 'BUY' | 'SELL',
    type: 'CALL' | 'PUT',
    strike: number,
    expiration: string,
    contractSymbol?: string,
    price?: number
  ) => void;
  onSelectStrike?: (
    strike: number,
    type: 'Call' | 'Put',
    symbol: string,
    expiration?: string,
    price?: number,
    action?: 'BUY' | 'SELL'
  ) => void;
  onNavigateToResearch?: (symbol: string) => void;
  defaultAction?: 'BUY' | 'SELL' | 'BOTH';
}

export function OptionChainCard({
  initialChain,
  chain: chainProp,
  onSelectContract,
  onSelectStrike,
  onNavigateToResearch,
  defaultAction = 'BUY'
}: OptionChainCardProps) {
  const [selectedExpIdx, setSelectedExpIdx] = useState<number>(0);
  const [showAllStrikes, setShowAllStrikes] = useState<boolean>(false);
  const [copiedContract, setCopiedContract] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'BUY' | 'SELL' | 'BOTH'>(defaultAction);

  // Sync defaultAction if prop changes
  React.useEffect(() => {
    if (defaultAction) {
      setActionMode(defaultAction);
    }
  }, [defaultAction]);

  const chain = chainProp || initialChain;
  const expirations = chain?.expirations || [];
  const currentExp: FormattedOptionExpiration | undefined = expirations[selectedExpIdx] || expirations[0];

  // Strikes list filtered or full
  const displayedStrikes = useMemo(() => {
    if (!currentExp || !currentExp.strikes) return [];
    const all = currentExp.strikes;
    if (showAllStrikes || all.length <= 10) return all;

    // Find ATM index or middle
    const atmIdx = all.findIndex((s) => s.isAtm);
    const centerIdx = atmIdx >= 0 ? atmIdx : Math.floor(all.length / 2);

    const start = Math.max(0, centerIdx - 4);
    const end = Math.min(all.length, centerIdx + 5);
    return all.slice(start, end);
  }, [currentExp, showAllStrikes]);

  const handleCopySymbol = (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sym) return;
    navigator.clipboard.writeText(sym);
    setCopiedContract(sym);
    toast.success(`Copied ${sym} to clipboard`);
    setTimeout(() => setCopiedContract(null), 2000);
  };

  const handleContractClick = (
    action: 'BUY' | 'SELL',
    type: 'CALL' | 'PUT',
    strike: number,
    contractSymbol?: string,
    price?: number
  ) => {
    if (!currentExp || !chain) return;
    if (onSelectContract) {
      if (price !== undefined) {
        onSelectContract(action, type, strike, currentExp.expirationDate, contractSymbol, price);
      } else {
        onSelectContract(action, type, strike, currentExp.expirationDate, contractSymbol);
      }
    } else if (onSelectStrike) {
      onSelectStrike(strike, type === 'CALL' ? 'Call' : 'Put', chain.symbol, currentExp.expirationDate, price, action);
    } else {
      const actionLabel = action === 'SELL' ? 'Short (Sell to Open)' : 'Long (Buy to Open)';
      toast.info(`Selected ${actionLabel} ${chain.symbol} $${strike.toFixed(2)} ${type}`, {
        description: `Exp: ${currentExp.expirationDate} (${currentExp.dte} DTE)`
      });
    }
  };

  if (!currentExp || !expirations.length) {
    return null;
  }

  return (
    <Card className="my-3 border border-purple-500/30 bg-slate-950/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden animate-fade-in text-slate-100">
      {/* ================= CARD HEADER ================= */}
      <div className="p-3 sm:p-4 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-indigo-950/40 border-b border-border/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-mono font-bold text-xs shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm sm:text-base tracking-wide text-white">
                {chain.symbol} Options Chain
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-purple-500/15 text-purple-300 border-purple-500/30">
                <ShieldCheck className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                Tastytrade Sandbox
              </Badge>
            </div>
            {chain.underlyingPrice && (
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Spot Price: <strong className="text-white">${chain.underlyingPrice.toFixed(2)}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Right side controls: Action Mode Switcher & Deep Research */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action Mode Switcher */}
          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-purple-500/30 shadow-inner">
            <button
              type="button"
              onClick={() => setActionMode('BUY')}
              className={cn(
                "px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                actionMode === 'BUY'
                  ? "bg-emerald-600 text-white shadow-xs font-bold ring-1 ring-emerald-400/40"
                  : "text-slate-400 hover:text-slate-200"
              )}
              title="Set default action to Buy (Long / BTO)"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Buy (Long)</span>
            </button>
            <button
              type="button"
              onClick={() => setActionMode('SELL')}
              className={cn(
                "px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                actionMode === 'SELL'
                  ? "bg-amber-600 text-white shadow-xs font-bold ring-1 ring-amber-400/40"
                  : "text-slate-400 hover:text-slate-200"
              )}
              title="Set default action to Sell (Short / STO)"
            >
              <TrendingDown className="w-3 h-3" />
              <span>Sell (Short)</span>
            </button>
          </div>

          {/* Research Link Shortcut */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateToResearch) {
                onNavigateToResearch(chain.symbol);
              } else {
                window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: chain.symbol }));
              }
            }}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 flex items-center gap-1 transition-all cursor-pointer"
            title={`Deep-dive ${chain.symbol} in Research Options Chain`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Deep Research</span>
            <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
          </button>
        </div>
      </div>

      {/* ================= EXPIRATION SELECTOR TABS ================= */}
      <div className="px-3 sm:px-4 pt-3 pb-2 border-b border-border/40 bg-slate-900/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-indigo-400" /> Expiration Cycles:
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {expirations.length} available
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {expirations.map((exp, idx) => {
            const isSelected = idx === selectedExpIdx;
            return (
              <button
                key={exp.expirationDate}
                type="button"
                onClick={() => {
                  setSelectedExpIdx(idx);
                  setShowAllStrikes(false);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer",
                  isSelected
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold border-purple-400/50 shadow-md ring-1 ring-purple-400/40"
                    : "bg-slate-900/80 hover:bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700"
                )}
              >
                <span>{exp.expirationDate}</span>
                <span className={cn(
                  "text-[10px] px-1 py-0.2 rounded-md font-sans",
                  isSelected ? "bg-black/30 text-white" : "text-slate-400"
                )}>
                  {exp.dte}d
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= OPTIONS STRIKE MATRIX ================= */}
      <div className="p-3 sm:p-4">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 text-[11px] uppercase font-bold tracking-wider pb-2 border-b border-border/40 text-slate-400">
          <div className="col-span-5 text-left flex items-center gap-1 text-emerald-400 pl-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Calls (Bullish)</span>
            {actionMode === 'SELL' && (
              <Badge className="ml-1 text-[9px] px-1 py-0 bg-amber-500/20 text-amber-300 border-amber-500/40">
                Short (STO)
              </Badge>
            )}
          </div>
          <div className="col-span-2 text-center text-amber-300 font-mono">
            <span>Strike</span>
          </div>
          <div className="col-span-5 text-right flex items-center justify-end gap-1 text-rose-400 pr-1">
            {actionMode === 'SELL' && (
              <Badge className="mr-1 text-[9px] px-1 py-0 bg-amber-500/20 text-amber-300 border-amber-500/40">
                Short (STO)
              </Badge>
            )}
            <span>Puts (Bearish)</span>
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Strike Rows */}
        <div className="divide-y divide-border/30 pt-1">
          {displayedStrikes.map((row) => {
            return (
              <div
                key={row.strike}
                className={cn(
                  "grid grid-cols-12 gap-2 py-2 px-1 items-center transition-colors rounded-xl",
                  row.isAtm
                    ? "bg-amber-500/10 border border-amber-500/30 my-1 shadow-xs"
                    : "hover:bg-slate-900/60"
                )}
              >
                {/* CALLS (LEFT) */}
                <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                  {actionMode === 'SELL' ? (
                    <button
                      type="button"
                      onClick={() => handleContractClick('SELL', 'CALL', row.strike, row.callSymbol, row.callPrice)}
                      className="group/call flex-1 py-1 px-2 rounded-lg bg-amber-950/40 hover:bg-amber-600 border border-amber-500/30 hover:border-amber-400 text-left transition-all flex items-center justify-between cursor-pointer"
                      title={`Click to draft Short Order for ${chain.symbol} $${row.strike.toFixed(2)} Call${row.callPrice !== undefined ? ` at $${row.callPrice.toFixed(2)}` : ''}`}
                    >
                      <span className="font-mono text-xs font-semibold text-amber-300 group-hover/call:text-white truncate flex items-center gap-1">
                        <span>{row.callName}</span>
                        {row.callPrice !== undefined && (
                          <span className="text-[10px] text-amber-400 font-mono font-normal opacity-90 group-hover/call:text-amber-100">
                            ${row.callPrice.toFixed(2)}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 group-hover/call:bg-amber-700 text-amber-300 group-hover/call:text-white shrink-0 flex items-center gap-0.5">
                        Draft Short {row.callPrice !== undefined ? `$${row.callPrice.toFixed(2)}` : ''} <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleContractClick('BUY', 'CALL', row.strike, row.callSymbol, row.callPrice)}
                      className="group/call flex-1 py-1 px-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-400 text-left transition-all flex items-center justify-between cursor-pointer"
                      title={`Click to draft Buy Order for ${chain.symbol} $${row.strike.toFixed(2)} Call${row.callPrice !== undefined ? ` at $${row.callPrice.toFixed(2)}` : ''}`}
                    >
                      <span className="font-mono text-xs font-semibold text-emerald-300 group-hover/call:text-white truncate flex items-center gap-1">
                        <span>{row.callName}</span>
                        {row.callPrice !== undefined && (
                          <span className="text-[10px] text-emerald-400 font-mono font-normal opacity-90 group-hover/call:text-emerald-100">
                            ${row.callPrice.toFixed(2)}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 group-hover/call:bg-emerald-700 text-emerald-300 group-hover/call:text-white shrink-0 flex items-center gap-0.5">
                        Draft {row.callPrice !== undefined ? `$${row.callPrice.toFixed(2)}` : ''} <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </button>
                  )}

                  {/* Quick Alternate Action Button */}
                  {actionMode === 'SELL' ? (
                    <button
                      type="button"
                      onClick={() => handleContractClick('BUY', 'CALL', row.strike, row.callSymbol, row.callPrice)}
                      className="px-1.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 transition-all shrink-0 cursor-pointer"
                      title={`Click to draft Buy Order for ${chain.symbol} $${row.strike.toFixed(2)} Call${row.callPrice !== undefined ? ` at $${row.callPrice.toFixed(2)}` : ''}`}
                    >
                      Buy
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleContractClick('SELL', 'CALL', row.strike, row.callSymbol, row.callPrice)}
                      className="px-1.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 hover:border-amber-400 transition-all shrink-0 cursor-pointer"
                      title={`Click to draft Short (Sell to Open) Order for ${chain.symbol} $${row.strike.toFixed(2)} Call${row.callPrice !== undefined ? ` at $${row.callPrice.toFixed(2)}` : ''}`}
                    >
                      Short
                    </button>
                  )}

                  {row.callSymbol && (
                    <button
                      type="button"
                      onClick={(e) => handleCopySymbol(row.callSymbol, e)}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
                      title={`Copy OCC symbol: ${row.callSymbol}`}
                    >
                      {copiedContract === row.callSymbol ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <span className="text-[9px] font-mono opacity-60">OCC</span>
                      )}
                    </button>
                  )}
                </div>

                {/* STRIKE (CENTER) */}
                <div className="col-span-2 text-center flex flex-col items-center justify-center">
                  <span className={cn(
                    "font-mono font-bold text-xs sm:text-sm",
                    row.isAtm ? "text-amber-300 font-black" : "text-white"
                  )}>
                    {row.formattedStrike}
                  </span>
                  {row.isAtm && (
                    <Badge className="mt-0.5 text-[8.5px] px-1 py-0 font-bold bg-amber-500/25 text-amber-300 border-amber-500/40">
                      ★ ATM
                    </Badge>
                  )}
                </div>

                {/* PUTS (RIGHT) */}
                <div className="col-span-5 flex items-center justify-end gap-1.5 min-w-0">
                  {row.putSymbol && (
                    <button
                      type="button"
                      onClick={(e) => handleCopySymbol(row.putSymbol, e)}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
                      title={`Copy OCC symbol: ${row.putSymbol}`}
                    >
                      {copiedContract === row.putSymbol ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <span className="text-[9px] font-mono opacity-60">OCC</span>
                      )}
                    </button>
                  )}

                  {/* Quick Alternate Action Button */}
                  {actionMode === 'SELL' ? (
                    <button
                      type="button"
                      onClick={() => handleContractClick('BUY', 'PUT', row.strike, row.putSymbol, row.putPrice)}
                      className="px-1.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 hover:border-rose-400 transition-all shrink-0 cursor-pointer"
                      title={`Click to draft Buy Order for ${chain.symbol} $${row.strike.toFixed(2)} Put${row.putPrice !== undefined ? ` at $${row.putPrice.toFixed(2)}` : ''}`}
                    >
                      Buy
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleContractClick('SELL', 'PUT', row.strike, row.putSymbol, row.putPrice)}
                      className="px-1.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 hover:border-amber-400 transition-all shrink-0 cursor-pointer"
                      title={`Click to draft Short (Sell to Open) Order for ${chain.symbol} $${row.strike.toFixed(2)} Put${row.putPrice !== undefined ? ` at $${row.putPrice.toFixed(2)}` : ''}`}
                    >
                      Short
                    </button>
                  )}

                  {actionMode === 'SELL' ? (
                    <button
                      type="button"
                      onClick={() => handleContractClick('SELL', 'PUT', row.strike, row.putSymbol, row.putPrice)}
                      className="group/put flex-1 py-1 px-2 rounded-lg bg-amber-950/40 hover:bg-amber-600 border border-amber-500/30 hover:border-amber-400 text-right transition-all flex items-center justify-between cursor-pointer"
                      title={`Click to draft Short Order for ${chain.symbol} $${row.strike.toFixed(2)} Put${row.putPrice !== undefined ? ` at $${row.putPrice.toFixed(2)}` : ''}`}
                    >
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 group-hover/put:bg-amber-700 text-amber-300 group-hover/put:text-white shrink-0 flex items-center gap-0.5">
                        <ArrowRight className="w-2.5 h-2.5 rotate-180" /> Draft Short {row.putPrice !== undefined ? `$${row.putPrice.toFixed(2)}` : ''}
                      </span>
                      <span className="font-mono text-xs font-semibold text-amber-300 group-hover/put:text-white truncate flex items-center justify-end gap-1">
                        {row.putPrice !== undefined && (
                          <span className="text-[10px] text-amber-400 font-mono font-normal opacity-90 group-hover/put:text-amber-100">
                            ${row.putPrice.toFixed(2)}
                          </span>
                        )}
                        <span>{row.putName}</span>
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleContractClick('BUY', 'PUT', row.strike, row.putSymbol, row.putPrice)}
                      className="group/put flex-1 py-1 px-2 rounded-lg bg-rose-950/40 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-400 text-right transition-all flex items-center justify-between cursor-pointer"
                      title={`Click to draft Buy Order for ${chain.symbol} $${row.strike.toFixed(2)} Put${row.putPrice !== undefined ? ` at $${row.putPrice.toFixed(2)}` : ''}`}
                    >
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/20 group-hover/put:bg-rose-700 text-rose-300 group-hover/put:text-white shrink-0 flex items-center gap-0.5">
                        <ArrowRight className="w-2.5 h-2.5 rotate-180" /> Draft {row.putPrice !== undefined ? `$${row.putPrice.toFixed(2)}` : ''}
                      </span>
                      <span className="font-mono text-xs font-semibold text-rose-300 group-hover/put:text-white truncate flex items-center justify-end gap-1">
                        {row.putPrice !== undefined && (
                          <span className="text-[10px] text-rose-400 font-mono font-normal opacity-90 group-hover/put:text-rose-100">
                            ${row.putPrice.toFixed(2)}
                          </span>
                        )}
                        <span>{row.putName}</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ================= FOOTER CONTROLS ================= */}
        <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            {currentExp.strikes.length > 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllStrikes(!showAllStrikes)}
                className="h-7 text-xs border-slate-700 hover:bg-slate-800 gap-1 text-slate-200"
              >
                {showAllStrikes ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Focus Near-the-Money
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> View All ({currentExp.strikes.length}) Strikes
                  </>
                )}
              </Button>
            )}
            <span>Showing {displayedStrikes.length} of {currentExp.strikes.length} strikes</span>
          </div>

          <span className="text-[10px] text-slate-500 italic">
            Click <strong>Draft</strong> on any contract to stage an order in chat
          </span>
        </div>
      </div>
    </Card>
  );
}
