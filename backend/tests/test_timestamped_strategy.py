
from pathlib import Path
import sys

import pandas as pd


# ==========================================
# 1. IMPORT OUR TIMESTAMP-AWARE FUNCTIONS
# ==========================================

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from run_timestamped_strategy import (
    load_timestamped_prices,
    longest_contiguous_period,
    find_missing_closes
)


# ==========================================
# 2. VERIFY CLOSING-PRICE AVAILABILITY
# ==========================================

def test_prices_use_candle_close_timestamps():

    prices = load_timestamped_prices()

    assert len(prices) == 130

    assert set(prices.columns) == {
        "BTC",
        "rNVDA",
        "rTSLA"
    }

    # First candle closes on June 2,
    # rather than its June 1 start date.
    assert prices.index[0] == pd.Timestamp(
        "2026-06-02T16:00:00Z"
    )

    assert prices.index[-1] == pd.Timestamp(
        "2026-10-10T16:00:00Z"
    )

    assert not prices.isna().any().any()


# ==========================================
# 3. VERIFY MISSING DATE IS NOT FILLED
# ==========================================

def test_missing_candle_is_preserved():

    prices = load_timestamped_prices()

    missing = find_missing_closes(prices)

    assert missing == [
        "2026-06-07T16:00:00Z"
    ]

    # One two-day interval exists.
    elapsed_seconds = (
        prices.index.to_series()
        .diff()
        .dt.total_seconds()
    )

    assert (
        elapsed_seconds == 172800
    ).sum() == 1


# ==========================================
# 4. VERIFY THE CONTINUOUS DATA SEGMENT
# ==========================================

def test_strategy_data_contains_no_date_gaps():

    prices = load_timestamped_prices()

    clean = longest_contiguous_period(prices)

    assert len(clean) == 125

    assert clean.index[0] == pd.Timestamp(
        "2026-06-08T16:00:00Z"
    )

    elapsed_seconds = (
        clean.index.to_series()
        .diff()
        .dropna()
        .dt.total_seconds()
    )

    # Every consecutive observation must
    # be exactly 24 hours apart.
    assert (
        elapsed_seconds == 86400
    ).all()
