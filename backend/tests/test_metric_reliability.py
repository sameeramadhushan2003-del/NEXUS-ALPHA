
from pathlib import Path
import sys

import pandas as pd


sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from engine import metrics, rolling_sharpe


# ==========================================
# TEST 1: SINGLE ACTIVE OBSERVATION
# ==========================================

def test_single_active_day_suppresses_sharpe():

    dates = pd.date_range(
        "2026-01-01",
        periods=45,
        freq="D"
    )

    returns = pd.Series(
        [0.0] * 44 + [0.004],
        index=dates
    )

    positions = pd.Series(
        [0.0] * 44 + [1.0],
        index=dates
    )

    result = metrics(
        returns,
        positions,
        periods_per_year=365
    )

    assert result["activeObservations"] == 1

    assert result["sharpe"] is None
    assert result["sortino"] is None

    assert (
        result["ratioStatus"]
        == "INSUFFICIENT_ACTIVITY"
    )

    rolling = rolling_sharpe(
        returns,
        periods_per_year=365
    )

    assert rolling.dropna().empty


# ==========================================
# TEST 2: SUFFICIENT ACTIVITY
# ==========================================

def test_sufficient_activity_allows_sharpe():

    dates = pd.date_range(
        "2026-01-01",
        periods=40,
        freq="D"
    )

    returns = pd.Series(
        [0.02, -0.01] * 20,
        index=dates
    )

    positions = pd.Series(
        [1.0] * 40,
        index=dates
    )

    result = metrics(
        returns,
        positions,
        periods_per_year=365
    )

    assert result["activeObservations"] == 40

    assert result["sharpe"] is not None

    assert result["ratioStatus"] == "AVAILABLE"
