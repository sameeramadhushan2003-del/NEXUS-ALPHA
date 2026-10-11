
"""Read-only historical research engine. No live order execution."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


REQUIRED = {"date", "asset", "close"}


# ==========================================
# 1. LOAD HISTORICAL PRICES
# ==========================================

def load_prices(path: Path) -> pd.DataFrame:

    source = pd.read_csv(path)

    if not REQUIRED.issubset(source.columns):
        raise ValueError(
            "CSV must contain date, asset, close columns"
        )

    source = source[["date", "asset", "close"]].copy()

    source["date"] = pd.to_datetime(
        source["date"],
        errors="coerce",
        utc=True
    )

    source["close"] = pd.to_numeric(
        source["close"],
        errors="coerce"
    )

    source["asset"] = (
        source["asset"].astype(str).str.strip()
    )

    if (
        source["date"].isna().any()
        or source["close"].isna().any()
    ):
        raise ValueError(
            "Invalid date or nonnumeric close in CSV"
        )

    if (source["close"] <= 0).any():
        raise ValueError(
            "Every close must be a positive number"
        )

    if (source["asset"] == "").any():
        raise ValueError("Empty asset symbol found")

    source["date"] = (
        source["date"].dt.tz_convert(None).dt.normalize()
    )

    if source.duplicated(["date", "asset"]).any():
        raise ValueError(
            "Duplicate asset/date values found; "
            "resolve before importing"
        )

    prices = source.pivot(
        index="date",
        columns="asset",
        values="close"
    ).sort_index()

    if prices.shape[1] < 2:
        raise ValueError("Provide at least two assets")

    if len(prices) < 100:
        raise ValueError(
            "Provide at least 100 dates to support "
            "a meaningful validation split"
        )

    return prices


# ==========================================
# 2. FORMAT FINITE NUMBERS
# ==========================================

def finite(value, decimals=4):

    if value is None or not np.isfinite(value):
        return None

    return round(float(value), decimals)


# ==========================================
# 3. CALCULATE PERFORMANCE METRICS
# ==========================================


# Minimum sample activity required before
# displaying annualized risk-adjusted ratios.
MIN_ACTIVE_OBSERVATIONS = 10


def metrics(
    returns: pd.Series,
    positions: pd.Series,
    periods_per_year: int = 252
) -> dict:

    rets = returns.fillna(0).astype(float)

    if rets.empty:
        return {
            "returnPct": None,
            "sharpe": None,
            "sortino": None,
            "maxDrawdownPct": None,
            "positiveActiveDayPct": None,
            "turnoverPct": None,
            "volatilityPct": None,
            "activeObservations": 0,
            "nonzeroReturnObservations": 0,
            "ratioStatus": "INSUFFICIENT_ACTIVITY"
        }

    # Align positions to the return dates.
    held = (
        positions.reindex(rets.index)
        .fillna(0)
        .astype(float)
    )

    # Count observations with a held position.
    active_mask = held.abs() > 0

    active_count = int(active_mask.sum())

    # Count realized nonzero returns.
    nonzero_count = int(
        (rets.abs() > 1e-12).sum()
    )

    enough_activity = (
        active_count >= MIN_ACTIVE_OBSERVATIONS
        and nonzero_count >= MIN_ACTIVE_OBSERVATIONS
    )

    # Calculate cumulative historical return.
    equity = (
        1 + rets.clip(lower=-0.999)
    ).cumprod()

    drawdown = (
        equity / equity.cummax() - 1
    )

    mu = rets.mean()

    std = rets.std(ddof=1)

    downside_std = np.sqrt(
        np.mean(
            np.square(
                np.minimum(rets.to_numpy(), 0)
            )
        )
    )

    active_returns = rets[active_mask]

    transitions = (
        held.diff()
        .abs()
        .fillna(0)
    )

    # Do not report a seemingly impressive
    # Sharpe based on just one active day.
    sharpe = None
    sortino = None

    if enough_activity:

        if std > 1e-12:
            sharpe = finite(
                (mu / std)
                * np.sqrt(periods_per_year),
                2
            )

        if downside_std > 1e-12:
            sortino = finite(
                (mu / downside_std)
                * np.sqrt(periods_per_year),
                2
            )

    return {
        "returnPct": finite(
            (equity.iloc[-1] - 1) * 100,
            2
        ),

        "sharpe": sharpe,

        "sortino": sortino,

        "maxDrawdownPct": finite(
            drawdown.min() * 100,
            2
        ),

        "positiveActiveDayPct": (
            finite(
                (active_returns > 0).mean() * 100,
                1
            )
            if active_count > 0 else None
        ),

        "turnoverPct": finite(
            transitions.sum() * 100 / len(rets),
            1
        ),

        "volatilityPct": (
            finite(
                std * np.sqrt(periods_per_year) * 100,
                2
            )
            if np.isfinite(std) else None
        ),

        "activeObservations": active_count,

        "nonzeroReturnObservations": nonzero_count,

        "ratioStatus": (
            "AVAILABLE"
            if enough_activity
            else "INSUFFICIENT_ACTIVITY"
        )
    }


# ==========================================
# 4. CALCULATE ROLLING SHARPE
# ==========================================


def rolling_sharpe(
    r: pd.Series,
    window=30,
    periods_per_year=252
) -> pd.Series:

    min_periods = max(
        20,
        window // 2
    )

    mean = r.rolling(
        window,
        min_periods=min_periods
    ).mean()

    std = r.rolling(
        window,
        min_periods=min_periods
    ).std()

    # Count nonzero return observations
    # within each rolling window.
    nonzero_count = (
        (r.fillna(0).abs() > 1e-12)
        .astype(int)
        .rolling(
            window,
            min_periods=min_periods
        )
        .sum()
    )

    ratio = (
        mean / std.replace(0, np.nan)
    ) * np.sqrt(periods_per_year)

    # Hide rolling ratios from samples
    # containing too little return activity.
    return ratio.where(
        nonzero_count >= MIN_ACTIVE_OBSERVATIONS
    )



# ==========================================
# 5. HISTORICAL STRATEGY EVALUATION
# ==========================================

def evaluate(
    prices: pd.DataFrame,
    primary="rNVDA",
    reference="BTC",
    lookback=25,
    threshold=1.25,
    oos_days=45,
    fee_bps=5,
    slippage_bps=8
):

    # Validate selected assets
    if (
        primary == reference
        or primary not in prices.columns
        or reference not in prices.columns
    ):
        raise ValueError(
            "Choose two different assets that exist "
            "in the dataset"
        )

    if not 15 <= lookback <= 70 or not 0.5 <= threshold <= 3.5:
        raise ValueError(
            "Lookback must be 15–70 and "
            "threshold must be 0.5–3.5"
        )

    if oos_days < 30:
        raise ValueError(
            "Out-of-sample period must be at least "
            "30 observations"
        )

    if not (
        0 <= fee_bps <= 100
        and 0 <= slippage_bps <= 100
    ):
        raise ValueError(
            "Costs must be between 0 and 100 basis points"
        )

    # ======================================
    # 6. ALIGN THE TWO SELECTED ASSETS
    # ======================================

    paired = prices[
        [primary, reference]
    ].dropna()

    # Calendar-aware annualization approximation.
    # Weekend-inclusive observations: 365
    # Weekday-only observations: 252
    has_weekends = bool(
        (paired.index.dayofweek >= 5).any()
    )

    periods_per_year = (
        365 if has_weekends else 252
    )

    if len(paired) < max(
        100,
        lookback + oos_days + 20
    ):
        raise ValueError(
            "Insufficient overlapping history "
            "for the chosen evaluation settings"
        )

    # ======================================
    # 7. CALCULATE HISTORICAL RETURNS
    # ======================================

    ret = (
        paired.pct_change(fill_method=None)
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0)
    )

    a = ret[primary]
    b = ret[reference]

    # ======================================
    # 8. ROLLING CORRELATION AND RESIDUALS
    # ======================================

    correlation = a.rolling(
        lookback,
        min_periods=lookback
    ).corr(b)

    beta = (
        a.rolling(
            lookback,
            min_periods=lookback
        ).cov(b)
        /
        b.rolling(
            lookback,
            min_periods=lookback
        ).var().replace(0, np.nan)
    )

    residual = a - beta * b

    rmean = residual.rolling(
        lookback,
        min_periods=lookback
    ).mean()

    rstd = residual.rolling(
        lookback,
        min_periods=lookback
    ).std()

    z = (
        residual
        - rmean
    ) / rstd.replace(0, np.nan)

    # ======================================
    # 9. ILLUSTRATIVE HISTORICAL SIMULATION
    # ======================================

    # Signal at close t affects holdings only
    # after that observation.
    raw_signal = (
        (correlation > 0.15)
        & (z < -threshold)
    ).astype(float)

    position = (
        raw_signal.shift(1).fillna(0)
    )

    turnover = (
        position.diff()
        .abs()
        .fillna(position.abs())
    )

    cost = (
        fee_bps + slippage_bps
    ) / 10000

    strategy_ret = position * a - turnover * cost

    benchmark_ret = a.copy()

    # ======================================
    # 10. CHRONOLOGICAL DATA SPLIT
    # ======================================

    split = len(paired) - oos_days

    ins = metrics(
        strategy_ret.iloc[:split],
        position.iloc[:split],
        periods_per_year
    )

    out = metrics(
        strategy_ret.iloc[split:],
        position.iloc[split:],
        periods_per_year
    )

    all_metrics = metrics(
        strategy_ret,
        position,
        periods_per_year
    )

    # ======================================
    # 11. EQUITY CURVES AND ROLLING SHARPE
    # ======================================

    total_curve = (
        1 + strategy_ret.clip(lower=-0.999)
    ).cumprod()

    baseline_curve = (
        1 + benchmark_ret.clip(lower=-0.999)
    ).cumprod()

    roll30 = rolling_sharpe(
        strategy_ret,
        periods_per_year=periods_per_year
    )

    # ======================================
    # 12. CROSS-ASSET CORRELATION HEATMAP
    # ======================================

    all_ret = prices.pct_change(
        fill_method=None
    ).tail(60)

    corr_matrix = (
        all_ret.corr(min_periods=25)
        .replace([np.inf, -np.inf], np.nan)
    )

    heatmap = []
    names = list(prices.columns)

    for sym in names:
        heatmap.append({
            "asset": sym,
            "values": [
                finite(
                    corr_matrix.loc[sym, other],
                    2
                )
                for other in names
            ]
        })

    # ======================================
    # 13. PREPARE CHART OBSERVATIONS
    # ======================================

    norm = (
        paired.div(paired.iloc[0]).mul(100)
    )

    start_date = paired.index[0]

    chart = []

    for i, idx in enumerate(paired.index):
        chart.append({
            "date": idx.strftime("%Y-%m-%d"),
            "primary": finite(
                norm[primary].iloc[i], 2
            ),
            "reference": finite(
                norm[reference].iloc[i], 2
            ),
            "correlation": finite(
                correlation.iloc[i], 3
            ),
            "residualZ": finite(
                z.iloc[i], 2
            ),
            "strategyEquity": finite(
                (total_curve.iloc[i] - 1) * 100,
                3
            ),
            "benchmarkEquity": finite(
                (baseline_curve.iloc[i] - 1) * 100,
                3
            ),
            "rollingSharpe": finite(
                roll30.iloc[i], 2
            ),
            "position": int(
                position.iloc[i]
            ),
            "phase": (
                "TEST" if i >= split else "TRAIN"
            )
        })

    # ======================================
    # 14. PREPARE SIMULATED EVENT LOG
    # ======================================

    changes = np.where(
        position.diff().fillna(position) != 0
    )[0]

    trades = []

    for i in changes[-18:][::-1]:
        trades.append({
            "date": paired.index[i].strftime(
                "%Y-%m-%d"
            ),
            "action": (
                "ENTER SIMULATION"
                if position.iloc[i] > 0
                else "EXIT SIMULATION"
            ),
            "z": finite(
                z.iloc[max(i - 1, 0)], 2
            ),
            "correlation": finite(
                correlation.iloc[max(i - 1, 0)], 2
            )
        })

    # ======================================
    # 15. PREPARE DASHBOARD STATISTICS
    # ======================================

    breakdown = {
        "all": all_metrics,
        "inSample": ins,
        "outOfSample": out,
        "trainDays": split,
        "testDays": oos_days,
        "splitDate": paired.index[split].strftime(
            "%Y-%m-%d"
        ),
        "activeDays": int(
            (position > 0).sum()
        ),
        "lastCorr": finite(
            correlation.iloc[-1], 3
        ),
        "lastZ": finite(
            z.iloc[-1], 2
        ),
        "costBps": fee_bps + slippage_bps,

        # NEW: expose annualization assumption
        "periodsPerYear": periods_per_year,

        "sharpeDecayFlag": bool(
            ins["sharpe"] is not None
            and ins["sharpe"] > 0
            and out["sharpe"] is not None
            and out["sharpe"] < 0.5 * ins["sharpe"]
        ),
    }

    # ======================================
    # 16. RESEARCH WARNINGS
    # ======================================

    diagnostics = [
        (
            "Signals use historical information through "
            "close t; simulated holdings begin after "
            "that observation (one-bar lag)."
        ),
        (
            "Transaction costs include per-entry/exit "
            "fee and slippage assumptions, but no "
            "borrow, impact or financing costs."
        ),
        (
            "Sample uses daily matched observations. "
            "It does not measure intraday, weekend "
            "or cash-market-closure effects."
        ),
        (
            "This is a deliberately simple "
            "predeclared rule, not a validated "
            "predictive trading edge."
        )
    ]

    if len(paired) != len(prices):
        diagnostics.append(
            "Missing observations reduced the number "
            "of dates used in the paired evaluation."
        )

    # ======================================
    # 17. RETURN RESULTS TO FASTAPI
    # ======================================

    return {
        "pairs": {
            "primary": primary,
            "reference": reference
        },

        "meta": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": paired.index[-1].strftime("%Y-%m-%d"),
            "observations": len(paired),
            "assets": names,
            "lastUpdated": "Local research data"
        },

        "settings": {
            "lookback": lookback,
            "threshold": threshold,
            "oosDays": oos_days,
            "feeBps": fee_bps,
            "slippageBps": slippage_bps
        },

        "stats": breakdown,

        "chart": chart,

        "heatmap": {
            "assets": names,
            "rows": heatmap
        },

        "trades": trades,

        "diagnostics": diagnostics
    }
