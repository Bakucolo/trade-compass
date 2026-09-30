import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Scale,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Coins,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Activity,
  Flame,
  Landmark,
  DollarSign
} from 'lucide-react';

interface GoldMethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GoldMethodologyModal({ isOpen, onClose }: GoldMethodologyModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-3xl p-6 sm:p-8">
        <DialogHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                Institutional Gold Macro Regime Methodology
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-bold uppercase tracking-widest">
                  100% Deterministic
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Complete transparency into indicator selection, normalization, weightings, and regime classification formulas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4 text-xs sm:text-sm">
          {/* Core Formula & Philosophy */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm sm:text-base">
              <Coins className="w-4 h-4" />
              Core Analytical Philosophy
            </div>
            <p className="text-muted-foreground leading-relaxed">
              This system rejects the simplistic retail premise that <em className="text-foreground">"inflation or debt is automatically bullish for gold."</em> 
              Instead, gold functions as an unencumbered sovereign currency that competes directly with the real return of U.S. Treasuries and the purchasing power of the U.S. Dollar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-background/50 border border-border/60">
                <span className="font-semibold text-rose-400">Tactical Headwind Loop:</span>
                <p className="text-muted-foreground mt-1">
                  Inflation Shock → Aggressive Fed Rate Hikes → Real Yields Surge → USD Strengthens → <strong>Gold faces downward tactical pressure</strong>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/60">
                <span className="font-semibold text-emerald-400">Structural Sovereign Loop:</span>
                <p className="text-muted-foreground mt-1">
                  Fiscal Deficits → Heavy Treasury Issuance → Rising Term Premium → Weakening Auction Demand → Fiscal Dominance → <strong>Gold surges as unencumbered sovereign reserve</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Mathematical Formulation */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Mathematical Scoring Engine
            </h3>
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 font-mono text-xs space-y-2">
              <div className="text-foreground font-semibold">
                Gold Macro Score = round( ( Σ [ w_i × S_i ] + 100 ) / 2 )
              </div>
              <p className="text-muted-foreground font-sans">
                Where each analytical pillar score <code className="text-primary font-mono">S_i ∈ [-100, +100]</code> is normalized from rolling percentiles and momentum, and <code className="text-primary font-mono">w_i</code> represents pillar weight.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 font-sans text-xs">
                <div className="p-2 rounded-lg bg-background/60 border border-border/40">
                  <div className="text-rose-400 font-bold">0 – 25</div>
                  <div className="text-[11px] text-muted-foreground">Strongly Hostile</div>
                </div>
                <div className="p-2 rounded-lg bg-background/60 border border-border/40">
                  <div className="text-amber-400 font-bold">26 – 45</div>
                  <div className="text-[11px] text-muted-foreground">Bearish / Unfavorable</div>
                </div>
                <div className="p-2 rounded-lg bg-background/60 border border-border/40">
                  <div className="text-blue-400 font-bold">46 – 55</div>
                  <div className="text-[11px] text-muted-foreground">Neutral / Transitional</div>
                </div>
                <div className="p-2 rounded-lg bg-background/60 border border-border/40">
                  <div className="text-emerald-400 font-bold">56 – 100</div>
                  <div className="text-[11px] text-muted-foreground">Bullish / Strongly Favorable</div>
                </div>
              </div>
            </div>
          </div>

          {/* 5 Pillars Breakdown Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              Analytical Pillar Weights & Series Registry
            </h3>

            <div className="border border-border/60 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border/60 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Pillar</th>
                    <th className="p-3">Weight</th>
                    <th className="p-3">Primary Data Series</th>
                    <th className="p-3">Calculation Logic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  <tr>
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      A. Real Rates
                    </td>
                    <td className="p-3 font-mono font-bold text-primary">25%</td>
                    <td className="p-3 text-muted-foreground">
                      FRED: <span className="font-mono text-foreground">DFII10</span> (10Y TIPS), DFII5, DFII30
                    </td>
                    <td className="p-3 text-muted-foreground">
                      Highest single factor weight. (50 - 10Y Percentile) × 60% + (-3M change in bps) × 40%.
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <Landmark className="w-3.5 h-3.5 text-amber-400" />
                      B. Fiscal & Treasury
                    </td>
                    <td className="p-3 font-mono font-bold text-primary">25%</td>
                    <td className="p-3 text-muted-foreground">
                      NY Fed ACM Term Premium (<span className="font-mono text-foreground">TERMYld</span>), Treasury Fiscal Data auctions & debt
                    </td>
                    <td className="p-3 text-muted-foreground">
                      Computes 0-100 Fiscal Pressure Score. Rising term premium + softening auction demand is strongly bullish.
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      C. Inflation / Stagflation
                    </td>
                    <td className="p-3 font-mono font-bold text-primary">20%</td>
                    <td className="p-3 text-muted-foreground">
                      FRED: <span className="font-mono text-foreground">T10YIE</span>, T5YIFR, Brent (<span className="font-mono text-foreground">DCOILBRENTEU</span>)
                    </td>
                    <td className="p-3 text-muted-foreground">
                      Distinguishes monetary response. Inflation shock with falling real yields = +80. Inflation shock with hiking Fed = -40 initially.
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      D. U.S. Dollar
                    </td>
                    <td className="p-3 font-mono font-bold text-primary">15%</td>
                    <td className="p-3 text-muted-foreground">
                      FRED: <span className="font-mono text-foreground">DTWEXBGS</span> (Broad Trade-Weighted Dollar)
                    </td>
                    <td className="p-3 text-muted-foreground">
                      5Y percentile + 3M momentum. Rapid dollar appreciation creates purchasing power headwinds.
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      E. Liquidity & Conditions
                    </td>
                    <td className="p-3 font-mono font-bold text-primary">15%</td>
                    <td className="p-3 text-muted-foreground">
                      Chicago Fed <span className="font-mono text-foreground">NFCI</span>, VIX (<span className="font-mono text-foreground">VIXCLS</span>), HY Spread, Fed Assets (<span className="font-mono text-foreground">WALCL</span>)
                    </td>
                    <td className="p-3 text-muted-foreground">
                      Loose conditions and balance sheet expansion support gold; acute liquidity squeezes cause brief margin-call drawdowns.
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 font-semibold text-muted-foreground flex items-center gap-2">
                      <Coins className="w-3.5 h-3.5 text-purple-400" />
                      Positioning (Optional)
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">≤ 5%</td>
                    <td className="p-3 text-muted-foreground">
                      CFTC Disaggregated Commitments of Traders (COT)
                    </td>
                    <td className="p-3 text-muted-foreground">
                      Managed money speculative net length. Extreme net length (&gt;85th percentile) warns of crowded trade vulnerability.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Missing Data & Point-in-Time Assurance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Missing Data & Confidence Score
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Missing or holiday-delayed series are never treated as zero. Instead, weights are proportionally reallocated across active pillars, and a dynamic <strong>Confidence Score</strong> (0–100%) reflects observation completeness and freshness.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Strict Point-in-Time Backtesting
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Every historical backtest observation calculates rolling percentiles and momentum strictly using data that was available at that exact historical date. Zero lookahead bias or future data leakage.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
