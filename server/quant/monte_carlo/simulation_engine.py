"""
Layer 2: Stochastic Factor Simulation Module
Implements multi-factor Monte Carlo simulation over a 5-year horizon for 10,000 paths.
Simulates underlying valuation drivers:
- Interest rates: Vasicek mean-reverting stochastic model
- Inflation: Mean-reverting central bank anchor model
- Revenue growth rates: Historical baseline & standard deviation with long-run mean reversion
- Operating margins: Historical baseline & standard deviation
- Correlation: Cholesky decomposition of cross-asset covariance matrix
"""

from dataclasses import dataclass
from typing import Optional, Tuple
import numpy as np

from .data_ingestion import MacroeconomicBaselines, CompanyBaselines


@dataclass
class SimulationConfig:
    num_paths: int = 10_000
    horizon_years: int = 5
    dt: float = 1.0
    seed: Optional[int] = None
    # Default 4x4 correlation matrix for [r, pi, g, m]
    # 0: Risk-free rate (r)
    # 1: Implied inflation (pi)
    # 2: Revenue growth (g)
    # 3: Operating margin (m)
    correlation_matrix: Optional[np.ndarray] = None

    def get_correlation_matrix(self) -> np.ndarray:
        if self.correlation_matrix is not None:
            return np.array(self.correlation_matrix, dtype=np.float64)
        
        # Standard institutional macroeconomic-microeconomic correlation matrix:
        # [r, pi] = +0.55 (monetary tightening in response to inflation)
        # [r, g]  = -0.25 (higher rates slow economic demand and sales)
        # [r, m]  = -0.20 (higher interest burdens and capital costs)
        # [pi, g] = -0.15 (stagflationary demand erosion)
        # [pi, m] = -0.30 (cost-push inflation compresses margins)
        # [g, m]  = +0.40 (operating leverage: higher sales increase margin efficiency)
        return np.array([
            [ 1.00,  0.55, -0.25, -0.20],
            [ 0.55,  1.00, -0.15, -0.30],
            [-0.25, -0.15,  1.00,  0.40],
            [-0.20, -0.30,  0.40,  1.00],
        ], dtype=np.float64)


@dataclass
class FactorPaths:
    """
    Simulated 5-year trajectory across 10,000 trial paths.
    All arrays have shape (num_paths, horizon_years).
    """
    interest_rates: np.ndarray        # Path-dependent risk-free rates r_t
    inflation_rates: np.ndarray       # Path-dependent implied inflation pi_t
    revenue_growth_rates: np.ndarray  # Path-dependent revenue growth g_t
    operating_margins: np.ndarray     # Path-dependent operating margins m_t
    num_paths: int
    horizon_years: int

    def summary_stats(self) -> dict:
        """Returns mean and standard deviation snapshots for verification."""
        return {
            "interest_rates": {
                "year_1_mean": float(np.mean(self.interest_rates[:, 0])),
                "year_5_mean": float(np.mean(self.interest_rates[:, -1])),
                "year_5_std": float(np.std(self.interest_rates[:, -1])),
            },
            "inflation_rates": {
                "year_1_mean": float(np.mean(self.inflation_rates[:, 0])),
                "year_5_mean": float(np.mean(self.inflation_rates[:, -1])),
            },
            "revenue_growth": {
                "year_1_mean": float(np.mean(self.revenue_growth_rates[:, 0])),
                "year_5_mean": float(np.mean(self.revenue_growth_rates[:, -1])),
            },
            "operating_margins": {
                "year_1_mean": float(np.mean(self.operating_margins[:, 0])),
                "year_5_mean": float(np.mean(self.operating_margins[:, -1])),
            }
        }


class StochasticFactorSimulator:
    """
    High-performance NumPy vectorized multi-factor simulator using Cholesky
    decomposition and Vasicek mean-reverting dynamics.
    """
    def __init__(self, config: Optional[SimulationConfig] = None):
        self.config = config or SimulationConfig()

    @staticmethod
    def ensure_positive_definite(matrix: np.ndarray) -> np.ndarray:
        """
        Guarantees that the correlation matrix is symmetric positive-definite
        for stable Cholesky factorization.
        """
        sym_matrix = (matrix + matrix.T) / 2.0
        try:
            np.linalg.cholesky(sym_matrix)
            return sym_matrix
        except np.linalg.LinAlgError:
            # Eigenvalue clipping regularization
            eigenvalues, eigenvectors = np.linalg.eigh(sym_matrix)
            clipped_eigenvalues = np.maximum(eigenvalues, 1e-6)
            reconstructed = eigenvectors @ np.diag(clipped_eigenvalues) @ eigenvectors.T
            # Re-normalize diagonal to exactly 1.0
            inv_sqrt_diag = 1.0 / np.sqrt(np.diag(reconstructed))
            corr = reconstructed * np.outer(inv_sqrt_diag, inv_sqrt_diag)
            return (corr + corr.T) / 2.0

    def simulate(self, macro: MacroeconomicBaselines, company: CompanyBaselines) -> FactorPaths:
        """
        Executes the Monte Carlo factor simulation for N=10,000 paths over 5 years.
        """
        num_paths = self.config.num_paths
        horizon = self.config.horizon_years
        dt = self.config.dt

        if self.config.seed is not None:
            rng = np.random.default_rng(self.config.seed)
        else:
            rng = np.random.default_rng()

        # 1. Cholesky Factorization of Correlation Matrix
        corr_matrix = self.ensure_positive_definite(self.config.get_correlation_matrix())
        L = np.linalg.cholesky(corr_matrix) # L @ L.T = corr_matrix

        # 2. Draw Uncorrelated Standard Normal Variates
        # Shape: (num_paths, horizon, 4)
        uncorrelated_shocks = rng.standard_normal(size=(num_paths, horizon, 4))

        # 3. Transform into Correlated Shocks via Cholesky Factor L
        # Z = U @ L.T
        correlated_shocks = np.einsum('pth,kh->ptk', uncorrelated_shocks, L)

        Z_r  = correlated_shocks[:, :, 0] # Shocks for risk-free rate
        Z_pi = correlated_shocks[:, :, 1] # Shocks for inflation
        Z_g  = correlated_shocks[:, :, 2] # Shocks for revenue growth
        Z_m  = correlated_shocks[:, :, 3] # Shocks for operating margin

        # ========================================================
        # Factor 1: Risk-Free Rate (Vasicek Mean-Reverting Model)
        # dr_t = kappa_r * (theta_r - r_t) dt + sigma_r * dW_t
        # ========================================================
        interest_rates = np.zeros((num_paths, horizon), dtype=np.float64)
        kappa_r = macro.rfr_mean_reversion_speed
        theta_r = macro.long_term_rfr_mean
        sigma_r = macro.rfr_volatility

        exp_k_r = np.exp(-kappa_r * dt)
        std_r = sigma_r * np.sqrt((1.0 - np.exp(-2.0 * kappa_r * dt)) / (2.0 * kappa_r))

        prev_r = np.full(num_paths, macro.risk_free_rate, dtype=np.float64)
        for t in range(horizon):
            next_r = prev_r * exp_k_r + theta_r * (1.0 - exp_k_r) + std_r * Z_r[:, t]
            # Realistic floor: interest rates cannot drop below 0.25% in normal dollar regime
            next_r = np.maximum(next_r, 0.0025)
            interest_rates[:, t] = next_r
            prev_r = next_r

        # ========================================================
        # Factor 2: Implied Inflation (Vasicek Anchor Model)
        # dpi_t = kappa_pi * (theta_pi - pi_t) dt + sigma_pi * dW_t
        # ========================================================
        inflation_rates = np.zeros((num_paths, horizon), dtype=np.float64)
        kappa_pi = macro.inflation_mean_reversion_speed
        theta_pi = macro.long_term_inflation_mean
        sigma_pi = macro.inflation_volatility

        exp_k_pi = np.exp(-kappa_pi * dt)
        std_pi = sigma_pi * np.sqrt((1.0 - np.exp(-2.0 * kappa_pi * dt)) / (2.0 * kappa_pi))

        prev_pi = np.full(num_paths, macro.implied_inflation, dtype=np.float64)
        for t in range(horizon):
            next_pi = prev_pi * exp_k_pi + theta_pi * (1.0 - exp_k_pi) + std_pi * Z_pi[:, t]
            # Inflation floor: minimum 0.0%
            next_pi = np.maximum(next_pi, 0.0)
            inflation_rates[:, t] = next_pi
            prev_pi = next_pi

        # ========================================================
        # Factor 3: Micro Factor - Revenue Growth Rates (g_t)
        # Fundamental growth decaying toward long-run nominal economic expansion
        # (Long-term real GDP growth ~2.0% + simulated inflation rate)
        # ========================================================
        revenue_growth_rates = np.zeros((num_paths, horizon), dtype=np.float64)
        base_growth = company.historical_rev_growth_cagr
        growth_std = company.rev_growth_std
        decay_speed = 0.10 # 10% decay of excess growth per year (half-life ~ 6.5 years)

        for t in range(horizon):
            # Long-run nominal sustainable anchor: simulated inflation + 2.0% real growth
            nominal_anchor = np.maximum(0.038, inflation_rates[:, t] + 0.018)
            decay_factor = (1.0 - decay_speed) ** (t + 1)
            mean_g_t = base_growth * decay_factor + nominal_anchor * (1.0 - decay_factor)
            
            # Simulated growth shock with cross-factor correlation
            g_sim = mean_g_t + growth_std * Z_g[:, t]
            # Bounded to plausible corporate expansion range
            revenue_growth_rates[:, t] = np.clip(g_sim, -0.30, 0.75)

        # ========================================================
        # Factor 4: Micro Factor - Operating Margins (m_t)
        # Margin mean-reversion around historical median operating margin
        # ========================================================
        operating_margins = np.zeros((num_paths, horizon), dtype=np.float64)
        base_margin = company.operating_margin
        margin_std = company.operating_margin_std
        margin_mean_reversion = 0.20 # 20% annual mean reversion

        prev_m = np.full(num_paths, base_margin, dtype=np.float64)
        for t in range(horizon):
            # Mean-reverting margin with shock
            m_sim = prev_m + margin_mean_reversion * (base_margin - prev_m) * dt + margin_std * Z_m[:, t]
            
            # Clip margins to realistic boundaries
            lower_bound = max(-0.35, base_margin - 3.5 * margin_std)
            upper_bound = min(0.75, base_margin + 3.5 * margin_std)
            m_sim = np.clip(m_sim, lower_bound, upper_bound)
            
            operating_margins[:, t] = m_sim
            prev_m = m_sim

        return FactorPaths(
            interest_rates=interest_rates,
            inflation_rates=inflation_rates,
            revenue_growth_rates=revenue_growth_rates,
            operating_margins=operating_margins,
            num_paths=num_paths,
            horizon_years=horizon,
        )
