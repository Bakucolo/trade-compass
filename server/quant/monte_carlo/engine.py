"""
Monte Carlo Valuation Engine Orchestrator
Coordinates Layers 1, 2, and 3 into an institutional multi-factor equity valuation pipeline.
"""

from typing import Optional, Dict, Any
import time

from .data_ingestion import (
    DiskCache,
    MacroIngestion,
    CompanyIngestion,
    MacroeconomicBaselines,
    CompanyBaselines,
)
from .simulation_engine import (
    StochasticFactorSimulator,
    SimulationConfig,
    FactorPaths,
)
from .valuation_engine import (
    DCFValuationEngine,
    ValuationDistribution,
)


class MonteCarloValuationEngine:
    """
    End-to-end multi-factor Monte Carlo simulation engine.
    Ingests macro and company baselines, simulates correlated stochastic factor paths,
    and runs a 5-year path-dependent DCF valuation to produce probability distributions.
    """
    def __init__(
        self,
        cache_dir: Optional[str] = None,
        default_ttl: int = 86400,
        num_paths: int = 10_000,
        horizon_years: int = 5,
        seed: Optional[int] = None,
    ):
        self.cache = DiskCache(cache_dir=cache_dir, default_ttl_seconds=default_ttl)
        self.macro_ingestion = MacroIngestion(cache=self.cache)
        self.company_ingestion = CompanyIngestion(cache=self.cache)
        self.num_paths = num_paths
        self.horizon_years = horizon_years
        self.seed = seed

    def run_simulation(
        self,
        ticker: str,
        num_paths: Optional[int] = None,
        horizon_years: Optional[int] = None,
        seed: Optional[int] = None,
        use_cache: bool = True,
        custom_macro_overrides: Optional[Dict[str, Any]] = None,
        custom_company_overrides: Optional[Dict[str, Any]] = None,
        custom_correlation_matrix: Optional[list] = None,
    ) -> Dict[str, Any]:
        """
        Runs the full 3-layer Monte Carlo equity valuation pipeline.
        Returns a rich JSON-serializable dictionary matching expected institutional output.
        """
        start_time = time.time()
        n_paths = num_paths or self.num_paths
        h_years = horizon_years or self.horizon_years
        s_seed = seed if seed is not None else self.seed

        # ----------------------------------------------------
        # Layer 1: Data Ingestion
        # ----------------------------------------------------
        macro_baselines = self.macro_ingestion.fetch_macro_baselines(use_cache=use_cache)
        if custom_macro_overrides:
            for k, v in custom_macro_overrides.items():
                if hasattr(macro_baselines, k) and v is not None:
                    setattr(macro_baselines, k, float(v))

        company_baselines = self.company_ingestion.fetch_company_baselines(ticker=ticker, use_cache=use_cache)
        if custom_company_overrides:
            for k, v in custom_company_overrides.items():
                if hasattr(company_baselines, k) and v is not None:
                    setattr(company_baselines, k, float(v))

        # ----------------------------------------------------
        # Layer 2: Stochastic Factor Simulation
        # ----------------------------------------------------
        sim_config = SimulationConfig(
            num_paths=n_paths,
            horizon_years=h_years,
            seed=s_seed,
            correlation_matrix=custom_correlation_matrix,
        )
        simulator = StochasticFactorSimulator(config=sim_config)
        factor_paths: FactorPaths = simulator.simulate(macro=macro_baselines, company=company_baselines)

        # ----------------------------------------------------
        # Layer 3: DCF Valuation & Distribution Generation
        # ----------------------------------------------------
        dcf_engine = DCFValuationEngine(num_histogram_bins=40)
        distribution: ValuationDistribution = dcf_engine.evaluate(
            paths=factor_paths,
            macro=macro_baselines,
            company=company_baselines,
        )

        execution_duration_ms = round((time.time() - start_time) * 1000, 2)

        # Format Final Result
        result = distribution.to_dict()
        result["execution_duration_ms"] = execution_duration_ms
        result["macro_baselines"] = macro_baselines.to_dict()
        result["company_baselines"] = company_baselines.to_dict()
        result["simulation_parameters"] = {
            "num_paths": n_paths,
            "horizon_years": h_years,
            "seed": s_seed,
            "stochastic_model": "Multi-Factor Vasicek + Cholesky Decomposition",
        }
        result["factor_summary"] = factor_paths.summary_stats()

        return result
