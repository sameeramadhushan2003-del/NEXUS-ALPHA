
from pathlib import Path
from datetime import datetime, timezone

import json
import numpy as np
import pandas as pd


# ==========================================
# 1. CONFIGURE FILE PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

INPUT_FILE = (
    DATA_DIR / "session_aligned_pairs.csv"
)

OUTPUT_CSV = (
    DATA_DIR / "price_tracking_daily.csv"
)

OUTPUT_JSON = (
    DATA_DIR / "price_tracking_report.json"
)


# ==========================================
# 2. DEFINE RESEARCH COMPARISONS
# ==========================================

PAIRS = {
    "rNVDA_vs_NVDA": ("rNVDA", "NVDA"),
    "rTSLA_vs_TSLA": ("rTSLA", "TSLA")
}

# A review flag, not proof of incorrect data.
REVIEW_THRESHOLD_PCT = 1.0


# ==========================================
# 3. LOAD AND VALIDATE DATA
# ==========================================

def load_data():

    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Missing file: {INPUT_FILE}"
        )

    df = pd.read_csv(INPUT_FILE)

    required_columns = {
        "date",
        "token_asset",
        "stock_asset",
        "token_close",
        "stock_close",
        "expected_close_utc",
        "token_candle_end_utc"
    }

    if not required_columns.issubset(df.columns):
        raise ValueError(
            "Required columns are missing"
        )

    df["date"] = pd.to_datetime(
        df["date"],
        format="%Y-%m-%d",
        errors="raise"
    )

    for column in ["token_close", "stock_close"]:
        df[column] = pd.to_numeric(
            df[column],
            errors="raise"
        )

        if (
            not np.isfinite(df[column]).all()
            or (df[column] <= 0).any()
        ):
            raise ValueError(
                f"Invalid prices in {column}"
            )

    for column in [
        "expected_close_utc",
        "token_candle_end_utc"
    ]:
        df[column] = pd.to_datetime(
            df[column],
            utc=True,
            errors="raise"
        )

    if (
        df["expected_close_utc"]
        != df["token_candle_end_utc"]
    ).any():
        raise ValueError(
            "Session timestamps do not match"
        )

    if df.duplicated(
        ["date", "token_asset", "stock_asset"]
    ).any():
        raise ValueError(
            "Duplicate pair/date records"
        )

    return df


# ==========================================
# 4. ANALYZE A STOCK-TOKEN PAIR
# ==========================================

def analyze_pair(df, token_name, stock_name):

    selected = df[
        (df["token_asset"] == token_name)
        & (df["stock_asset"] == stock_name)
    ].copy()

    selected = selected.sort_values("date")

    if len(selected) < 3:
        raise ValueError(
            f"Insufficient data for {token_name}"
        )

    # Nominal price gap, measured as percent
    # of the ordinary stock price.
    selected["price_gap_pct"] = (
        (
            selected["token_close"]
            / selected["stock_close"]
        ) - 1
    ) * 100

    # Returns between matched trading sessions.
    selected["stock_return_pct"] = (
        selected["stock_close"]
        .pct_change(fill_method=None)
        * 100
    )

    selected["token_return_pct"] = (
        selected["token_close"]
        .pct_change(fill_method=None)
        * 100
    )

    # Difference in daily returns,
    # measured in percentage points.
    selected["return_gap_pp"] = (
        selected["token_return_pct"]
        - selected["stock_return_pct"]
    )

    # ======================================
    # 5. CALCULATE QUALITY METRICS
    # ======================================

    absolute_gap = (
        selected["price_gap_pct"].abs()
    )

    return_gaps = (
        selected["return_gap_pp"].dropna()
    )

    valid_returns = selected.dropna(
        subset=[
            "stock_return_pct",
            "token_return_pct"
        ]
    )

    correlation = (
        valid_returns["stock_return_pct"]
        .corr(valid_returns["token_return_pct"])
    )

    rmse_returns = np.sqrt(
        np.mean(return_gaps ** 2)
    )

    review_dates = selected[
        absolute_gap > REVIEW_THRESHOLD_PCT
    ]["date"].dt.strftime("%Y-%m-%d").tolist()

    max_gap_index = absolute_gap.idxmax()

    metrics = {
        "matchedSessions": len(selected),
        "returnObservations": len(valid_returns),
        "returnCorrelation": float(correlation),
        "meanSignedPriceGapPct": float(
            selected["price_gap_pct"].mean()
        ),
        "meanAbsolutePriceGapPct": float(
            absolute_gap.mean()
        ),
        "medianAbsolutePriceGapPct": float(
            absolute_gap.median()
        ),
        "maxAbsolutePriceGapPct": float(
            absolute_gap.max()
        ),
        "maxGapDate": selected.loc[
            max_gap_index, "date"
        ].strftime("%Y-%m-%d"),
        "returnDifferenceRmsePp": float(
            rmse_returns
        ),
        "reviewThresholdPct": REVIEW_THRESHOLD_PCT,
        "reviewDateCount": len(review_dates),
        "reviewDates": review_dates
    }

    return metrics, selected


# ==========================================
# 6. ANALYZE ALL PAIRS
# ==========================================

def main():

    print("\nNEXUS ALPHA - PRICE TRACKING AUDIT")
    print("=================================")

    df = load_data()

    reports = {}
    daily_frames = []

    for name, (token, stock) in PAIRS.items():

        metrics, daily = analyze_pair(
            df,
            token,
            stock
        )

        reports[name] = metrics

        daily_frames.append(daily)

        print(f"\n{name}")
        print("-----------------------------")

        print(
            "Matched sessions:",
            metrics["matchedSessions"]
        )

        print(
            "Return observations:",
            metrics["returnObservations"]
        )

        print(
            "Return correlation:",
            round(metrics["returnCorrelation"], 6)
        )

        print(
            "Mean absolute price gap:",
            round(
                metrics["meanAbsolutePriceGapPct"],
                4
            ),
            "%"
        )

        print(
            "Maximum absolute price gap:",
            round(
                metrics["maxAbsolutePriceGapPct"],
                4
            ),
            "%"
        )

        print(
            "Daily return difference RMSE:",
            round(
                metrics["returnDifferenceRmsePp"],
                4
            ),
            "percentage points"
        )

        print(
            "Dates flagged for review:",
            metrics["reviewDateCount"]
        )

    # ======================================
    # 7. SAVE DAILY OBSERVATIONS
    # ======================================

    combined = pd.concat(
        daily_frames,
        ignore_index=True
    )

    combined.to_csv(
        OUTPUT_CSV,
        index=False,
        date_format="%Y-%m-%d"
    )

    # ======================================
    # 8. SAVE THE JSON RESEARCH REPORT
    # ======================================

    report = {
        "analysisType": "PRICE_TRACKING_AUDIT",
        "generatedAt": datetime.now(
            timezone.utc
        ).isoformat(),
        "sourceFile": INPUT_FILE.name,
        "comparisons": reports,
        "limitations": [
            "Stock prices are quoted in USD",
            "Token prices are quoted in USDT",
            "Equivalent economic units require verification",
            "Hourly token closes approximate stock closes",
            "Price gaps do not imply arbitrage opportunities",
            "Historical correlation is not predictive"
        ]
    }

    OUTPUT_JSON.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8"
    )

    print("\nAUDIT COMPLETED")
    print("Daily CSV:", OUTPUT_CSV)
    print("JSON report:", OUTPUT_JSON)


# ==========================================
# 9. RUN
# ==========================================

if __name__ == "__main__":
    main()
