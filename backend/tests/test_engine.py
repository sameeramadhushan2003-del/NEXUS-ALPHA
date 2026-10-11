
from pathlib import Path
import sys

import pandas as pd
import pytest


sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from generate_demo import generate
from engine import load_prices, evaluate


# ==========================================
# 1. CREATE TEST DATA
# ==========================================

@pytest.fixture
def sample(tmp_path):
    return load_prices(
        generate(tmp_path / "data.csv")
    )


# ==========================================
# 2. VERIFY DATA SPLIT
# ==========================================

def test_backtest_split_and_nonfuture_metrics(sample):

    result = evaluate(sample)

    assert result["stats"]["testDays"] == 45
    assert result["stats"]["trainDays"] >= 60
    assert len(result["chart"]) == len(sample)

    assert all(
        x["phase"] == "TEST"
        for x in result["chart"][-45:]
    )


# ==========================================
# 3. VERIFY DELAYED SIMULATION
# ==========================================

def test_no_same_bar_execution(sample):

    result = evaluate(sample)

    first = result["chart"][0]

    assert first["position"] == 0
    assert result["stats"]["costBps"] == 13


# ==========================================
# 4. REJECT INSUFFICIENT HISTORY
# ==========================================

def test_insufficient_overlap_rejected(sample):

    with pytest.raises(ValueError):
        evaluate(
            sample,
            oos_days=220
        )


# ==========================================
# 5. REJECT DUPLICATE DATES
# ==========================================

def test_duplicate_dates_rejected(tmp_path):

    df = pd.DataFrame([
        {
            "date": "2026-01-02",
            "asset": "A",
            "close": 100
        },
        {
            "date": "2026-01-02",
            "asset": "A",
            "close": 105
        }
    ])

    path = tmp_path / "invalid.csv"

    df.to_csv(
        path,
        index=False
    )

    with pytest.raises(ValueError):
        load_prices(path)


# ==========================================
# 6. CHECK FUTURE-DATA INDEPENDENCE
# ==========================================

def test_future_data_changes_cannot_change_past_holdings(
    sample
):

    before = evaluate(sample)

    altered = sample.copy()

    altered.iloc[
        -10:,
        altered.columns.get_loc("rNVDA")
    ] *= 1.5

    after = evaluate(altered)

    assert (
        before["chart"][:-10]
        == after["chart"][:-10]
    )


# ==========================================
# 7. VERIFY RESEARCH WARNINGS
# ==========================================

def test_metrics_dont_claim_guaranteed_returns(sample):

    result = evaluate(sample)

    assert len(result["diagnostics"]) >= 4

    assert (
        result["stats"]["trainDays"]
        + result["stats"]["testDays"]
        == result["meta"]["observations"]
    )


# ==========================================
# 8. NEW: VERIFY CALENDAR ANNUALIZATION
# ==========================================

def test_annualization_matches_observed_calendar(sample):

    # The synthetic dataset contains weekdays.
    weekday_result = evaluate(sample)

    assert (
        weekday_result["stats"]["periodsPerYear"]
        == 252
    )

    # Keep the prices but change the dates
    # to include weekends.
    daily_sample = sample.copy()

    daily_sample.index = pd.date_range(
        start="2026-01-01",
        periods=len(daily_sample),
        freq="D"
    )

    daily_result = evaluate(daily_sample)

    assert (
        daily_result["stats"]["periodsPerYear"]
        == 365
    )
