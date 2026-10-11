
from pathlib import Path
import json

import numpy as np
import pandas as pd

from engine import evaluate


# ==========================================
# 1. CONFIGURE FILE PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

INPUT_FILE = (
    BASE_DIR
    / "data"
    / "timestamp_aware_history.csv"
)

OUTPUT_FILE = (
    BASE_DIR
    / "data"
    / "timestamp_strategy_report.json"
)

EXPECTED_ASSETS = {
    "rNVDA",
    "rTSLA",
    "BTC"
}


# ==========================================
# 2. LOAD AND VALIDATE THE CSV
# ==========================================

def load_timestamped_prices():

    df = pd.read_csv(INPUT_FILE)

    required = {
        "candle_start_date",
        "asset",
        "close",
        "candle_start_utc",
        "candle_end_utc"
    }

    if not required.issubset(df.columns):
        raise ValueError(
            "Required timestamp columns are missing"
        )

    df["asset"] = df["asset"].str.strip()

    if set(df["asset"]) != EXPECTED_ASSETS:
        raise ValueError(
            "Unexpected or missing asset symbols"
        )

    df["close"] = pd.to_numeric(
        df["close"],
        errors="raise"
    )

    if (
        not np.isfinite(df["close"]).all()
        or (df["close"] <= 0).any()
    ):
        raise ValueError("Invalid closing prices")

    # Convert timestamps into actual UTC datetimes.
    start = pd.to_datetime(
        df["candle_start_utc"],
        utc=True,
        errors="raise"
    )

    end = pd.to_datetime(
        df["candle_end_utc"],
        utc=True,
        errors="raise"
    )

    # Verify the recorded start dates.
    if not (
        start.dt.strftime("%Y-%m-%d")
        == df["candle_start_date"]
    ).all():
        raise ValueError(
            "Candle dates do not match timestamps"
        )

    # Verify that candles begin at 16:00 UTC.
    if not (
        start.dt.strftime("%H:%M:%S")
        == "16:00:00"
    ).all():
        raise ValueError(
            "Unexpected daily candle start time"
        )

    # Each observed candle must span 24 hours.
    
# Calculate the duration in seconds.
# One complete daily candle = 86,400 seconds.


    # ======================================
    # VERIFY CANDLE DURATION
    # ======================================

    duration_seconds = (
        (end - start).dt.total_seconds()
    )

    if not (duration_seconds == 86400).all():
        raise ValueError(
            "Incorrect candle duration"
        )

    # ======================================
    # CHECK DUPLICATE TIMESTAMPS
    # ======================================

    df["available_at"] = end

    if df.duplicated(
        ["available_at", "asset"]
    ).any():
        raise ValueError(
            "Duplicate asset and candle timestamp"
        )

    # ======================================
    # ORGANIZE PRICES BY CLOSING TIME
    # ======================================

    prices = df.pivot(
        index="available_at",
        columns="asset",
        values="close"
    ).sort_index()

    if prices.isna().any().any():
        raise ValueError(
            "Some dates are missing one or more assets"
        )

    return prices



# ==========================================
# 3. FIND THE LONGEST CONTIGUOUS PERIOD
# ==========================================


def longest_contiguous_period(prices):

    # Calculate elapsed seconds between
    # consecutive candle-closing timestamps.
    elapsed_seconds = (
        prices.index.to_series()
        .diff()
        .dt.total_seconds()
    )

    # Start a new group whenever
    # the gap is not exactly 24 hours.
    new_group = (
        elapsed_seconds != 86400
    ).cumsum()

    groups = [
        group
        for _, group in prices.groupby(new_group)
    ]

    if not groups:
        raise ValueError(
            "No historical observations available"
        )

    # Select the longest uninterrupted period.
    longest = max(
        groups,
        key=len
    )

    return longest.copy()



# ==========================================
# 4. IDENTIFY MISSING CANDLE CLOSES
# ==========================================

def find_missing_closes(prices):

    expected = pd.date_range(
        start=prices.index.min(),
        end=prices.index.max(),
        freq="D"
    )

    missing = expected.difference(
        prices.index
    )

    return [
        item.isoformat().replace(
            "+00:00", "Z"
        )
        for item in missing
    ]


# ==========================================
# 5. FORMAT UTC TIMESTAMPS
# ==========================================

def format_utc(timestamp):

    return timestamp.isoformat().replace(
        "+00:00", "Z"
    )


# ==========================================
# 6. RUN THE HISTORICAL EVALUATION
# ==========================================

def main():

    print("\nNEXUS ALPHA - TIMESTAMP STRATEGY TEST")
    print("====================================")

    # Load all timestamp-validated observations.
    prices = load_timestamped_prices()

    print("Original matched candles:", len(prices))

    missing = find_missing_closes(prices)

    print("Missing candle closes:", missing)

    # Remove the short, disconnected segment
    # rather than silently spanning the gap.
    clean = longest_contiguous_period(prices)

    excluded = len(prices) - len(clean)

    print(
        "Longest continuous period:",
        len(clean)
    )

    print("Excluded observations:", excluded)

    print(
        "First available close:",
        format_utc(clean.index[0])
    )

    print(
        "Last available close:",
        format_utc(clean.index[-1])
    )

    # ======================================
    # 7. RUN THE EXISTING ENGINE
    # ======================================

    result = evaluate(
        clean,
        primary="rNVDA",
        reference="BTC",
        lookback=25,
        threshold=1.25,
        oos_days=45,
        fee_bps=5,
        slippage_bps=8
    )

    stats = result["stats"]

    # ======================================
    # 8. DISPLAY THE VALIDATION SPLIT
    # ======================================

    print("\nHISTORICAL EVALUATION")
    print("=====================")

    print(
        "Training observations:",
        stats["trainDays"]
    )

    print(
        "Out-of-sample observations:",
        stats["testDays"]
    )

    print(
        "First test close:",
        format_utc(clean.index[-stats["testDays"]])
    )

    print(
        "Periods per year:",
        stats["periodsPerYear"]
    )

    print(
        "Illustrative OOS Sharpe:",
        stats["outOfSample"]["sharpe"]
    )

    print(
        "Illustrative OOS return (%):",
        stats["outOfSample"]["returnPct"]
    )

    # ======================================
    # 9. SAVE REPRODUCIBLE RESEARCH REPORT
    # ======================================

    report = {
        "project": "NEXUS ALPHA",
        "analysis": "Timestamp-aware historical validation",
        "sourceFile": INPUT_FILE.name,
        "originalObservations": len(prices),
        "missingCandleClosesUtc": missing,
        "continuousObservations": len(clean),
        "excludedObservations": excluded,
        "firstAvailableCloseUtc": format_utc(
            clean.index[0]
        ),
        "lastAvailableCloseUtc": format_utc(
            clean.index[-1]
        ),
        "stats": stats,
        "limitations": [
            "Only completed daily candles are used",
            "A disconnected segment was excluded",
            "Signals are delayed by one observation",
            "Simulated fills and costs are assumptions",
            "Results do not establish predictive ability",
            "No real trades or orders are executed"
        ]
    }

    OUTPUT_FILE.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8"
    )

    print("\nTIMESTAMP VALIDATION COMPLETE")
    print("Report:", OUTPUT_FILE)


# ==========================================
# 10. START
# ==========================================

if __name__ == "__main__":
    main()
