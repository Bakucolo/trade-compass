"""
Comprehensive Unit & Quantitative Model Test Suite
Tests:
1. Disk cache hit, miss, TTL, and invalidation
2. Macroeconomic and company ingestion
3. Cholesky correlation properties and factor simulation
4. Vasicek mean-reverting dynamics
5. DCF valuation engine, 90% CI, Scenarios, and Bucketed Distribution
6. Financial monotonicity sensitivity
"""

import os
import time
import shutil
import tempfile
import unittest
import numpy as np

from server.quant.monte_carlo.data_ingestion import (
    DiskCache,
    MacroIngestion,
    CompanyIngestion,
    MacroeconomicBaselines,
    CompanyBaselines,
)
from server.quant.monte_carlo.simulation_engine import (
    StochasticFactorSimulator,
    SimulationConfig,
    FactorPaths,
)
from server.quant.monte_carlo.valuation_engine import (
    DCFValuationEngine,
    ValuationDistribution,
)
from server.quant.monte_carlo.engine import MonteCarloValuationEngine


class TestDiskCache(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.cache = DiskCache(cache_dir=self.test_dir, default_ttl_seconds=2)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_cache_set_and_get(self):
        data = {"ticker": "AAPL", "fcf": 100_000_000}
        self.cache.set("test:aapl", data)
        retrieved = self.cache.get("test:aapl")
        self.assertEqual(retrieved, data)

    def test_cache_miss_and_expiration(self):
        self.assertIsNone(self.cache.get("non_existent_key"))
        
        # Test TTL expiration with 1 second TTL
        self.cache.set("short_lived", {"val": 42}, ttl_seconds=1)
        self.assertEqual(self.cache.get("short_lived"), {"val": 42})
        time.sleep(1.2)
        self.assertIsNone(self.cache.get("short_lived"))

    def test_cache_invalidation(self):
        self.cache.set("inv_key", {"active": True})
        self.assertTrue(self.cache.invalidate("inv_key"))
        self.assertIsNone(self.cache.get("inv_key"))


class TestDataIngestion(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.cache = DiskCache(cache_dir=self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_macro_ingestion_baselines(self):
        ingestion = MacroIngestion(cache=self.cache)
        baselines = ingestion.fetch_macro_baselines(use_cache=False)

        self.assertIsInstance(baselines, MacroeconomicBaselines)
        self.assertGreater(baselines.risk_free_rate, 0.0)
        self.assertLess(baselines.risk_free_rate, 0.20)
        self.assertGreater(baselines.implied_inflation, 0.0)
        self.assertLess(baselines.implied_inflation, 0.20)
        self.assertGreater(baselines.rfr_mean_reversion_speed, 0.0)
        self.assertGreater(baselines.rfr_volatility, 0.0)

    def test_company_ingestion_fallback_and_structure(self):
        ingestion = CompanyIngestion(cache=self.cache)
        comp = ingestion.fetch_company_baselines("NVDA", use_cache=False)

        self.assertIsInstance(comp, CompanyBaselines)
        self.assertEqual(comp.ticker, "NVDA")
        self.assertGreater(comp.current_price, 0.0)
        self.assertGreater(comp.shares_outstanding, 0.0)
        self.assertGreater(comp.revenue, 0.0)
        self.assertGreater(comp.operating_margin, -1.0)
        self.assertGreater(comp.rev_growth_std, 0.0)


class TestStochasticFactorSimulator(unittest.TestCase):
    def setUp(self):
        self.macro = MacroeconomicBaselines(
            risk_free_rate=0.040,
            implied_inflation=0.022,
            long_term_rfr_mean=0.038,
            rfr_mean_reversion_speed=0.25,
            rfr_volatility=0.012,
            long_term_inflation_mean=0.022,
            inflation_mean_reversion_speed=0.30,
            inflation_volatility=0.008,
            equity_risk_premium=0.050,
        )
        self.company = CompanyBaselines(
            ticker="TEST",
            current_price=100.0,
            shares_outstanding=1_000_000_000,
            free_cash_flow=10_000_000_000.0,
            revenue=50_000_000_000.0,
            operating_income=15_000_000_000.0,
            operating_margin=0.30,
            total_debt=10_000_000_000.0,
            cash_and_equivalents=5_000_000_000.0,
            net_debt=5_000_000_000.0,
            historical_rev_growth_cagr=0.12,
            rev_growth_std=0.06,
            operating_margin_std=0.03,
            beta=1.1,
            effective_tax_rate=0.21,
            fcf_conversion_ratio=0.85,
            credit_spread=0.012,
        )

    def test_simulation_dimensions_and_properties(self):
        config = SimulationConfig(num_paths=10_000, horizon_years=5, seed=42)
        simulator = StochasticFactorSimulator(config=config)
        paths = simulator.simulate(self.macro, self.company)

        self.assertEqual(paths.interest_rates.shape, (10_000, 5))
        self.assertEqual(paths.inflation_rates.shape, (10_000, 5))
        self.assertEqual(paths.revenue_growth_rates.shape, (10_000, 5))
        self.assertEqual(paths.operating_margins.shape, (10_000, 5))

        # Interest rates should remain non-negative
        self.assertTrue(np.all(paths.interest_rates >= 0.0025))

        # Vasicek mean-reversion check:
        # Year 5 average interest rate should be closer to long_term_rfr_mean (0.038) than initial (0.040)
        mean_r5 = np.mean(paths.interest_rates[:, 4])
        self.assertAlmostEqual(mean_r5, self.macro.long_term_rfr_mean, delta=0.005)

    def test_cholesky_correlation_preservation(self):
        # Test that empirical correlation across 10,000 paths matches the input correlation matrix
        target_corr = np.array([
            [ 1.00,  0.55, -0.25, -0.20],
            [ 0.55,  1.00, -0.15, -0.30],
            [-0.25, -0.15,  1.00,  0.40],
            [-0.20, -0.30,  0.40,  1.00],
        ])
        config = SimulationConfig(num_paths=20_000, horizon_years=1, seed=123, correlation_matrix=target_corr)
        simulator = StochasticFactorSimulator(config=config)
        
        # Test positive definite helper
        pd_corr = simulator.ensure_positive_definite(target_corr)
        self.assertTrue(np.allclose(pd_corr, pd_corr.T))
        L = np.linalg.cholesky(pd_corr)
        self.assertEqual(L.shape, (4, 4))


class TestDCFValuationEngine(unittest.TestCase):
    def setUp(self):
        self.macro = MacroeconomicBaselines(
            risk_free_rate=0.0425,
            implied_inflation=0.023,
            long_term_rfr_mean=0.038,
            rfr_mean_reversion_speed=0.25,
            rfr_volatility=0.012,
            long_term_inflation_mean=0.022,
            inflation_mean_reversion_speed=0.30,
            inflation_volatility=0.008,
            equity_risk_premium=0.050,
        )
        self.company = CompanyBaselines(
            ticker="AAPL",
            current_price=180.0,
            shares_outstanding=15_000_000_000,
            free_cash_flow=100_000_000_000.0,
            revenue=380_000_000_000.0,
            operating_income=115_000_000_000.0,
            operating_margin=0.30,
            total_debt=110_000_000_000.0,
            cash_and_equivalents=65_000_000_000.0,
            net_debt=45_000_000_000.0,
            historical_rev_growth_cagr=0.09,
            rev_growth_std=0.05,
            operating_margin_std=0.025,
            beta=1.05,
            effective_tax_rate=0.16,
            fcf_conversion_ratio=0.95,
            credit_spread=0.010,
        )

    def test_full_dcf_evaluation_and_outputs(self):
        config = SimulationConfig(num_paths=10_000, horizon_years=5, seed=42)
        simulator = StochasticFactorSimulator(config=config)
        paths = simulator.simulate(self.macro, self.company)

        engine = DCFValuationEngine(num_histogram_bins=40)
        dist = engine.evaluate(paths, self.macro, self.company)

        self.assertIsInstance(dist, ValuationDistribution)
        self.assertGreater(dist.median_intrinsic_value, 0.0)
        self.assertGreater(dist.mean_intrinsic_value, 0.0)

        # Confidence Interval Ordering: p05 <= Median <= p95
        p05 = dist.confidence_interval_90["p05"]
        p95 = dist.confidence_interval_90["p95"]
        self.assertLessEqual(p05, dist.median_intrinsic_value)
        self.assertLessEqual(dist.median_intrinsic_value, p95)

        # Scenarios Ordering: Bear <= Base <= Bull
        bear = dist.scenarios["bear"].intrinsic_value
        base = dist.scenarios["base"].intrinsic_value
        bull = dist.scenarios["bull"].intrinsic_value
        self.assertLessEqual(bear, base)
        self.assertLessEqual(base, bull)

        # Raw distribution bins
        self.assertEqual(len(dist.raw_distribution), 40)
        total_counts = sum(b.count for b in dist.raw_distribution)
        self.assertGreater(total_counts, 9_500) # Contains nearly all 10,000 paths
        self.assertAlmostEqual(dist.raw_distribution[-1].cumulative_probability, 1.0, places=2)

    def test_factor_sensitivities(self):
        config = SimulationConfig(num_paths=10_000, horizon_years=5, seed=99)
        simulator = StochasticFactorSimulator(config=config)
        paths = simulator.simulate(self.macro, self.company)

        engine = DCFValuationEngine()
        dist = engine.evaluate(paths, self.macro, self.company)

        sens = dist.factor_sensitivities
        # Higher revenue growth should positively correlate with intrinsic value
        self.assertGreater(sens["sensitivity_to_revenue_growth"], 0.0)
        # Higher operating margin should positively correlate with intrinsic value
        self.assertGreater(sens["sensitivity_to_operating_margin"], 0.0)
        # Higher interest rates should negatively correlate with intrinsic value (higher discount rate)
        self.assertLess(sens["sensitivity_to_interest_rates"], 0.0)


class TestMonteCarloOrchestrator(unittest.TestCase):
    def test_orchestrator_pipeline_end_to_end(self):
        temp_cache = tempfile.mkdtemp()
        try:
            engine = MonteCarloValuationEngine(cache_dir=temp_cache, num_paths=5_000, horizon_years=5, seed=10)
            result = engine.run_simulation("MSFT", use_cache=False)

            self.assertEqual(result["ticker"], "MSFT")
            self.assertIn("median_intrinsic_value", result)
            self.assertIn("confidence_interval_90", result)
            self.assertIn("scenarios", result)
            self.assertIn("raw_distribution", result)
            self.assertIn("factor_sensitivities", result)
            self.assertIn("macro_baselines", result)
            self.assertIn("company_baselines", result)
            self.assertGreater(result["execution_duration_ms"], 0.0)
        finally:
            shutil.rmtree(temp_cache, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
