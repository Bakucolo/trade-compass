"""
CLI Runner for Multi-Factor Monte Carlo Equity Valuation Engine
Enables command-line execution, automated scripting, and backend subprocess piping.
"""

import sys
import json
import argparse
from typing import Optional

# Windows console encoding fix
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .engine import MonteCarloValuationEngine


def print_ascii_histogram(raw_distribution: list, median_val: float, current_price: float):
    print("\n  [ INTRINSIC VALUE PROBABILITY DENSITY ]")
    max_count = max((b["count"] for b in raw_distribution), default=1)
    bar_width = 36

    for b in raw_distribution:
        start = b["bin_start"]
        end = b["bin_end"]
        count = b["count"]
        density_pct = b["density"] * 100.0
        
        filled = int((count / max_count) * bar_width) if max_count > 0 else 0
        bar = "#" * filled + "-" * (bar_width - filled)
        
        marker = ""
        if start <= current_price <= end:
            marker += " <-- [MARKET PRICE]"
        if start <= median_val <= end:
            marker += " * [MEDIAN IV]"

        print(f"  ${start:6.1f} - ${end:6.1f} | {bar} | {density_pct:4.1f}% {marker}")


def run_cli():
    parser = argparse.ArgumentParser(
        description="Multi-Factor Monte Carlo Equity Valuation Engine (Vasicek + Cholesky)"
    )
    parser.add_argument("ticker", type=str, help="Stock ticker symbol (e.g., AAPL, NVDA, MSFT)")
    parser.add_argument("--trials", "--paths", type=int, default=10_000, help="Number of Monte Carlo paths (default: 10,000)")
    parser.add_argument("--horizon", type=int, default=5, help="Simulation horizon in years (default: 5)")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for deterministic output")
    parser.add_argument("--no-cache", action="store_true", help="Bypass disk cache and re-fetch fresh data")
    parser.add_argument("--json", action="store_true", help="Output pure JSON to stdout")

    args = parser.parse_args()

    engine = MonteCarloValuationEngine()
    result = engine.run_simulation(
        ticker=args.ticker,
        num_paths=args.trials,
        horizon_years=args.horizon,
        seed=args.seed,
        use_cache=not args.no_cache,
    )

    if args.json:
        print(json.dumps(result, indent=2))
        return

    # Institutional Rich Terminal Output
    ticker = result["ticker"]
    cur_price = result["current_market_price"]
    med_iv = result["median_intrinsic_value"]
    mean_iv = result["mean_intrinsic_value"]
    p05 = result["confidence_interval_90"]["p05"]
    p95 = result["confidence_interval_90"]["p95"]
    prob_undervalued = result["prob_undervalued"] * 100.0
    mos = result["expected_margin_of_safety_pct"]
    dur = result["execution_duration_ms"]

    macro = result["macro_baselines"]
    company = result["company_baselines"]
    scenarios = result["scenarios"]

    print("=" * 72)
    print(f"  MULTI-FACTOR MONTE CARLO VALUATION REPORT: {ticker}")
    print(f"  Stochastic Engine: 10,000 Paths | 5-Year Horizon | Vasicek + Cholesky")
    print(f"  Execution Time: {dur} ms")
    print("=" * 72)

    print("\n[ 1. BASELINE MACRO & MICRO INPUTS ]")
    print(f"  Current Stock Price:        ${cur_price:.2f}")
    print(f"  10Y Treasury Yield (RFR):   {macro['risk_free_rate'] * 100:.2f}% (Neutral Anchor: {macro['long_term_rfr_mean'] * 100:.2f}%)")
    print(f"  Implied 10Y Inflation:      {macro['implied_inflation'] * 100:.2f}% (Central Target: {macro['long_term_inflation_mean'] * 100:.2f}%)")
    print(f"  TTM Free Cash Flow:         ${company['free_cash_flow'] / 1e9:.2f} Billion")
    print(f"  TTM Revenue:                ${company['revenue'] / 1e9:.2f} Billion")
    print(f"  Operating Margin:           {company['operating_margin'] * 100:.1f}% (Volatility: {company['operating_margin_std'] * 100:.1f}%)")
    print(f"  Historical Revenue CAGR:    {company['historical_rev_growth_cagr'] * 100:.1f}% (Volatility: {company['rev_growth_std'] * 100:.1f}%)")
    print(f"  Net Debt:                   ${company['net_debt'] / 1e9:.2f} Billion (Beta: {company['beta']:.2f})")

    print("\n[ 2. INTRINSIC VALUE PROBABILITY METRICS ]")
    print(f"  * MEDIAN INTRINSIC VALUE:   ${med_iv:.2f} per share")
    print(f"  Mean Intrinsic Value:       ${mean_iv:.2f} per share (Std Dev: ${result['std_intrinsic_value']:.2f})")
    print(f"  90% Confidence Interval:    ${p05:.2f} to ${p95:.2f} per share")
    print(f"  Probability Undervalued:    {prob_undervalued:.1f}% (P[Intrinsic Value > Market Price])")
    print(f"  Expected Margin of Safety:  {mos:+.1f}%")

    print("\n[ 3. SCENARIO ANALYSIS ]")
    for key, sc in scenarios.items():
        val = sc["intrinsic_value"]
        prob = sc["probability"] * 100.0
        diff = sc["upside_downside_pct"]
        print(f"  * {sc['name']} [P={prob:.0f}%]:")
        print(f"    Value: ${val:.2f} ({diff:+.1f}%) | {sc['description']}")

    print("\n[ 4. MACRO-MICRO FACTOR SENSITIVITY ]")
    sens = result["factor_sensitivities"]
    print(f"  Correlation with Revenue Growth:  {sens['sensitivity_to_revenue_growth']:+.3f}")
    print(f"  Correlation with Operating Margin:{sens['sensitivity_to_operating_margin']:+.3f}")
    print(f"  Correlation with Interest Rates:  {sens['sensitivity_to_interest_rates']:+.3f}")
    print(f"  Correlation with Inflation:       {sens['sensitivity_to_inflation']:+.3f}")

    print_ascii_histogram(result["raw_distribution"], med_iv, cur_price)
    print("\n" + "=" * 72)


if __name__ == "__main__":
    run_cli()
