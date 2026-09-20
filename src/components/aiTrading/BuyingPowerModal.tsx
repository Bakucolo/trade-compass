// src/components/aiTrading/BuyingPowerModal.tsx
// Quick-launch Dialog for comparing Tastytrade vs. IBKR Buying Power & Margin

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scale, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { BuyingPowerComparisonCard } from './BuyingPowerComparisonCard';
import { BuyingPowerComparisonResult, analyzeBuyingPower } from '@/services/tastytrade';
import { toast } from 'sonner';

interface BuyingPowerModalProps {
  initialSymbol?: string;
  triggerButton?: React.ReactNode;
}

export const BuyingPowerModal: React.FC<BuyingPowerModalProps> = ({
  initialSymbol = 'AAPL',
  triggerButton,
}) => {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [action, setAction] = useState<'BUY' | 'SELL' | 'BUY_TO_OPEN' | 'SELL_TO_CLOSE'>('BUY');
  const [instrumentType, setInstrumentType] = useState<'Equity' | 'Equity Option'>('Equity');
  const [quantity, setQuantity] = useState<number>(50);
  const [price, setPrice] = useState<number | undefined>(220.0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<BuyingPowerComparisonResult | undefined>(undefined);

  const handleCalculate = async () => {
    if (!symbol.trim()) {
      toast.error('Symbol Required', { description: 'Please enter a valid ticker symbol.' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await analyzeBuyingPower({
        symbol: symbol.trim().toUpperCase(),
        action,
        instrumentType,
        quantity: Math.max(1, quantity),
        price: price && price > 0 ? price : undefined,
        orderType: price ? 'Limit' : 'Market',
      });
      setResult(res.comparison);
      toast.success('Buying Power Analyzed', {
        description: `Compared ${quantity} ${symbol.toUpperCase()} requirements between Tastytrade and IBKR.`
      });
    } catch (err: any) {
      console.error('Analysis failed:', err);
      toast.error('Analysis Failed', { description: err.message || 'Could not analyze buying power.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyPreset = (preset: {
    sym: string;
    act: 'BUY' | 'SELL' | 'BUY_TO_OPEN';
    type: 'Equity' | 'Equity Option';
    qty: number;
    prc: number;
  }) => {
    setSymbol(preset.sym);
    setAction(preset.act);
    setInstrumentType(preset.type);
    setQuantity(preset.qty);
    setPrice(preset.prc);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs text-foreground border-border bg-secondary/50 hover:bg-secondary flex items-center gap-1.5"
          >
            <Scale className="w-3.5 h-3.5 text-primary" />
            <span>BP Analyser</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 text-slate-100 border-slate-800">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Buying Power & Margin Analyser
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Compare capital requirements, Reg-T margin, and commissions between Tastytrade and Interactive Brokers.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <span className="text-slate-400">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset({ sym: 'AAPL', act: 'BUY', type: 'Equity', qty: 50, prc: 220 })}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
          >
            50 AAPL Stock
          </button>
          <button
            type="button"
            onClick={() => applyPreset({ sym: 'SPY', act: 'BUY', type: 'Equity', qty: 100, prc: 560 })}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
          >
            100 SPY Stock
          </button>
          <button
            type="button"
            onClick={() => applyPreset({ sym: 'NVDA', act: 'BUY_TO_OPEN', type: 'Equity Option', qty: 5, prc: 3.50 })}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
          >
            5 NVDA Options ($3.50)
          </button>
          <button
            type="button"
            onClick={() => applyPreset({ sym: 'TSLA', act: 'BUY_TO_OPEN', type: 'Equity Option', qty: 15, prc: 2.20 })}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
          >
            15 TSLA Options (Cap test)
          </button>
        </div>

        {/* Trade Configuration Form */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs font-mono">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-bold focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Asset</label>
            <select
              value={instrumentType}
              onChange={(e) => {
                const val = e.target.value as any;
                setInstrumentType(val);
                if (val === 'Equity Option' && action === 'BUY') setAction('BUY_TO_OPEN');
                if (val === 'Equity' && action === 'BUY_TO_OPEN') setAction('BUY');
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="Equity">Equity</option>
              <option value="Equity Option">Option</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
            >
              {instrumentType === 'Equity' ? (
                <>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </>
              ) : (
                <>
                  <option value="BUY_TO_OPEN">BUY TO OPEN</option>
                  <option value="SELL_TO_CLOSE">SELL TO CLOSE</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Price ($)</label>
            <input
              type="number"
              step="0.05"
              min="0.01"
              value={price !== undefined ? price : ''}
              onChange={(e) => setPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="MKT"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-emerald-300 font-bold focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleCalculate}
            disabled={isAnalyzing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs font-semibold h-8 px-4 flex items-center gap-1.5"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating Balances...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Calculate Buying Power Impact</span>
              </>
            )}
          </Button>
        </div>

        {/* Results Card */}
        {result && (
          <div className="mt-2">
            <BuyingPowerComparisonCard comparison={result} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
