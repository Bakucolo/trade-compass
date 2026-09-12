"""
Layer 3: Valuation Engine & Distribution Module
Executes vectorized Discounted Cash Flow (DCF) model across all 10,000 factor paths.
Computes:
- Path-dependent WACC and discount factors
- Dynamic revenue, EBIT, and free cash flows
- Terminal value & net debt bridge to equity value
- Intrinsic value per share distribution
- Aggregated probability distribution: Median, 90% Confidence Interval,
  Bear/Base/Bull scenarios with probabilities, and bucketed histogram bins.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional
import numpy as np

from .data_ingestion import MacroeconomicBaselines, CompanyBaselines
from .simulation_engine import FactorPaths


@dataclass
class ScenarioMetric:
    name: str
    probability: float
    intrinsic_value: float
    upside_downside_pct: float
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class HistogramBucket:
    bin_index: int
    bin_start: float
    bin_end: float
    bin_midpoint: float
    count: int
    density: float
    cumulative_probability: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ValuationDistribution:
    ticker: str
    current_market_price: float
    median_intrinsic_value: float
    mean_intrinsic_value: float
    std_intrinsic_value: float
    confidence_interval_90: Dict[str, float] # 5th and 95th percentiles
    confidence_interval_80: Dict[str, float] # 10th and 90th percentiles
    scenarios: Dict[str, ScenarioMetric]     # bear, base, bull
    prob_undervalued: float                  # Probability Intrinsic Value > Current Price
    expected_margin_of_safety_pct: float
    raw_distribution: List[HistogramBucket]
    factor_sensitivities: Dict[str, float]
    simulated_paths_count: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticker": self.ticker,
            "current_market_price": self.current_market_price,
            "median_intrinsic_value": self.median_intrinsic_value,
            "mean_intrinsic_value": self.mean_intrinsic_value,
            "std_intrinsic_value": self.std_intrinsic_value,
            "confidence_interval_90": self.confidence_interval_90,
            "confidence_interval_80": self.confidence_interval_80,
            "scenarios": {k: v.to_dict() for k, v in self.scenarios.items()},
            "prob_undervalued": self.prob_undervalued,
            "expected_margin_of_safety_pct": self.expected_margin_of_safety_pct,
            "raw_distribution": [b.to_dict() for b in self.raw_distribution],
            "factor_sensitivities": self.factor_sensitivities,
            "simulated_paths_count": self.simulated_paths_count,
        }


class DCFValuationEngine:
    """
    Vectorized DCF Valuation Engine capable of processing 10,000 multi-factor paths
    in milliseconds using NumPy broadcasting.
    """
    def __init__(self, num_histogram_bins: int = 40):
        self.num_histogram_bins = num_histogram_bins

    def evaluate(
        self,
        paths: FactorPaths,
        macro: MacroeconomicBaselines,
        company: CompanyBaselines,
    ) -> ValuationDistribution:
        """
        Executes path-dependent DCF valuation and aggregates into probability distributions.
        """
        num_paths = paths.num_paths
        horizon = paths.horizon_years

        # 1. Project Revenues Across 5 Years
        # Revenue_t = Revenue_0 * prod_{tau=0}^t (1 + g_{tau})
        growth_multiplier = np.cumprod(1.0 + paths.revenue_growth_rates, axis=1)
        projected_revenues = company.revenue * growth_multiplier # (num_paths, horizon)

        # 2. Project Operating Income (EBIT)
        projected_ebit = projected_revenues * paths.operating_margins # (num_paths, horizon)

        # 3. Project Free Cash Flow to Firm (FCFF)
        # NOPAT = EBIT * (1 - tax_rate)
        # FCFF = NOPAT * fcf_conversion_ratio
        tax_rate = company.effective_tax_rate
        fcf_conversion = company.fcf_conversion_ratio
        
        projected_nopat = projected_ebit * (1.0 - tax_rate)
        projected_fcff = projected_nopat * fcf_conversion

        # For loss-making years, cash burn is proportional to EBIT
        loss_mask = projected_ebit < 0
        projected_fcff[loss_mask] = projected_ebit[loss_mask] * 1.05

        # 4. Compute Dynamic Path-Dependent WACC for Each Year
        # Cost of Equity Ke = r_t + Beta * ERP
        # Cost of Debt Kd = (r_t + Credit Spread) * (1 - tax_rate)
        # WACC = we * Ke + wd * Kd
        beta = company.beta
        erp = macro.equity_risk_premium
        credit_spread = company.credit_spread

        cost_of_equity = paths.interest_rates + beta * erp
        cost_of_debt = (paths.interest_rates + credit_spread) * (1.0 - tax_rate)

        # Capital Structure Weights
        equity_market_val = max(1.0, company.current_price * company.shares_outstanding)
        total_debt_val = max(0.0, company.total_debt)
        total_cap = equity_market_val + total_debt_val
        we = equity_market_val / total_cap
        wd = total_debt_val / total_cap

        path_wacc = we * cost_of_equity + wd * cost_of_debt
        # Institutional safety bound: WACC for operating corporate equities bounded between 7.0% and 12.0%
        path_wacc = np.clip(path_wacc, 0.070, 0.120)

        # 5. Calculate Cumulative Discount Factors
        # DF_t = prod_{tau=0}^t 1 / (1 + WACC_{tau})
        annual_discount = 1.0 / (1.0 + path_wacc)
        cum_discount_factors = np.cumprod(annual_discount, axis=1) # (num_paths, horizon)

        # 6. Present Value of Projected Free Cash Flows (Years 1 to 5)
        pv_discrete_fcf = np.sum(projected_fcff * cum_discount_factors, axis=1) # (num_paths,)

        # 7. Institutional Dual-Method Terminal Value (Year 5)
        # Combines:
        # A. Value Driver Formula (Perpetuity with ROIC):
        #    TV_Gordon = FCFF_5 * (1 - g / ROIC) / max(0.018, WACC - g)
        # B. Exit Multiple Method:
        #    TV_Exit = FCFF_5 * Target_Exit_Multiple (calibrated from trading multiples & operating profile)
        # Blended Terminal Value: 60% Exit Multiple + 40% Value Driver Gordon Growth
        terminal_wacc = path_wacc[:, -1]
        terminal_growth = np.clip(paths.inflation_rates[:, -1] * 0.5 + 0.012, 0.015, 0.035)
        terminal_fcff = projected_fcff[:, -1] * (1.0 + terminal_growth)

        # Method A: Value Driver Formula (Damodaran & McKinsey)
        # Higher operating margins and competitive moats imply higher economic returns on capital (ROIC)
        est_roic = np.maximum(0.15, paths.operating_margins[:, -1] * 1.5)
        reinvestment_rate = np.clip(terminal_growth / est_roic, 0.05, 0.40)
        spread = np.maximum(0.018, terminal_wacc - terminal_growth)
        tv_gordon = np.where(
            terminal_fcff > 0,
            terminal_fcff * (1.0 - reinvestment_rate) / spread,
            0.0
        )

        # Method B: Exit Multiple Method
        # Calibrated from the company's current valuation multiple and operating profile
        current_fcf_base = max(1.0, company.free_cash_flow)
        current_p_fcf = (company.current_price * company.shares_outstanding) / current_fcf_base
        ev_ebitda = getattr(company, "enterprise_to_ebitda", 18.0)

        # Sustainable mature exit multiple mean-reverting toward institutional range
        multiple_floor = 14.0
        multiple_ceiling = float(np.clip(current_p_fcf * 0.70, 38.0, 75.0))
        target_exit_multiple = float(np.clip(
            0.50 * current_p_fcf + 0.50 * (ev_ebitda * 1.1),
            multiple_floor,
            multiple_ceiling
        ))
        tv_exit = np.maximum(0.0, terminal_fcff * target_exit_multiple)

        # Blended Institutional Terminal Value (65% Exit Multiple + 35% Value Driver Gordon)
        terminal_value = 0.65 * tv_exit + 0.35 * tv_gordon
        pv_terminal_value = terminal_value * cum_discount_factors[:, -1]

        # 8. Enterprise Value to Equity Value Bridge
        enterprise_value = pv_discrete_fcf + pv_terminal_value
        equity_value = enterprise_value - company.total_debt + company.cash_and_equivalents
        
        # Intrinsic Value Per Share
        shares = max(1.0, company.shares_outstanding)
        intrinsic_values = np.maximum(0.0, equity_value / shares)

        # Filter extreme statistical anomalies (e.g. top/bottom 0.1% outliers for stable histogram)
        lower_cut = np.percentile(intrinsic_values, 0.1)
        upper_cut = np.percentile(intrinsic_values, 99.9)
        clean_ivs = np.clip(intrinsic_values, lower_cut, upper_cut)

        # 9. Aggregate Distribution Statistics
        median_val = float(np.median(clean_ivs))
        mean_val = float(np.mean(clean_ivs))
        std_val = float(np.std(clean_ivs))

        p05 = float(np.percentile(clean_ivs, 5.0))
        p10 = float(np.percentile(clean_ivs, 10.0))
        p15 = float(np.percentile(clean_ivs, 15.0))
        p50 = float(np.percentile(clean_ivs, 50.0))
        p85 = float(np.percentile(clean_ivs, 85.0))
        p90 = float(np.percentile(clean_ivs, 90.0))
        p95 = float(np.percentile(clean_ivs, 95.0))

        cur_price = company.current_price
        prob_undervalued = float(np.mean(clean_ivs > cur_price))
        margin_of_safety = ((median_val - cur_price) / cur_price) * 100.0 if cur_price > 0 else 0.0

        # Scenarios Definition (Bear, Base, Bull)
        scenarios = {
            "bear": ScenarioMetric(
                name="Bear Case (Stagflation / Macro Drag)",
                probability=0.25,
                intrinsic_value=p15,
                upside_downside_pct=((p15 - cur_price) / cur_price) * 100.0,
                description="Higher inflation and interest rates combined with decelerating sales and compressed margins."
            ),
            "base": ScenarioMetric(
                name="Base Case (Consensus Equilibrium)",
                probability=0.50,
                intrinsic_value=p50,
                upside_downside_pct=((p50 - cur_price) / cur_price) * 100.0,
                description="Median path with stable mean-reverting rates, expected historical revenue CAGR, and normalized margins."
            ),
            "bull": ScenarioMetric(
                name="Bull Case (Disinflationary Expansion)",
                probability=0.25,
                intrinsic_value=p85,
                upside_downside_pct=((p85 - cur_price) / cur_price) * 100.0,
                description="Favorable macro conditions, strong top-line momentum, operating leverage margin expansion, and lower discount rates."
            )
        }

        # 10. Compute Factor Sensitivities (Correlations with Intrinsic Value)
        # How much does the final intrinsic value depend on each factor?
        cum_rev_growth = np.sum(paths.revenue_growth_rates, axis=1)
        avg_margins = np.mean(paths.operating_margins, axis=1)
        final_rates = paths.interest_rates[:, -1]
        final_inflation = paths.inflation_rates[:, -1]

        sensitivities = {
            "sensitivity_to_revenue_growth": float(np.corrcoef(clean_ivs, cum_rev_growth)[0, 1]),
            "sensitivity_to_operating_margin": float(np.corrcoef(clean_ivs, avg_margins)[0, 1]),
            "sensitivity_to_interest_rates": float(np.corrcoef(clean_ivs, final_rates)[0, 1]),
            "sensitivity_to_inflation": float(np.corrcoef(clean_ivs, final_inflation)[0, 1]),
        }

        # 11. Generate Raw Bucketed Histogram Distribution
        # 40 discrete buckets across 1st to 99th percentile for clean UI charts
        hist_min = float(np.percentile(clean_ivs, 1.0))
        hist_max = float(np.percentile(clean_ivs, 99.0))
        if hist_max <= hist_min:
            hist_max = hist_min + 10.0

        counts, bin_edges = np.histogram(clean_ivs, bins=self.num_histogram_bins, range=(hist_min, hist_max))
        total_counts = float(np.sum(counts))

        cum_count = 0
        raw_distribution: List[HistogramBucket] = []
        for i in range(len(counts)):
            b_start = float(bin_edges[i])
            b_end = float(bin_edges[i + 1])
            b_mid = float((b_start + b_end) / 2.0)
            c = int(counts[i])
            cum_count += c
            density = c / total_counts if total_counts > 0 else 0.0
            cum_prob = cum_count / total_counts if total_counts > 0 else 0.0

            raw_distribution.append(HistogramBucket(
                bin_index=i,
                bin_start=round(b_start, 2),
                bin_end=round(b_end, 2),
                bin_midpoint=round(b_mid, 2),
                count=c,
                density=round(density, 4),
                cumulative_probability=round(cum_prob, 4),
            ))

        return ValuationDistribution(
            ticker=company.ticker,
            current_market_price=cur_price,
            median_intrinsic_value=round(median_val, 2),
            mean_intrinsic_value=round(mean_val, 2),
            std_intrinsic_value=round(std_val, 2),
            confidence_interval_90={
                "p05": round(p05, 2),
                "p95": round(p95, 2),
            },
            confidence_interval_80={
                "p10": round(p10, 2),
                "p90": round(p90, 2),
            },
            scenarios=scenarios,
            prob_undervalued=round(prob_undervalued, 4),
            expected_margin_of_safety_pct=round(margin_of_safety, 2),
            raw_distribution=raw_distribution,
            factor_sensitivities={k: round(v, 4) for k, v in sensitivities.items()},
            simulated_paths_count=num_paths,
        )
