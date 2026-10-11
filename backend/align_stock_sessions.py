
from pathlib import Path
import json

import numpy as np
import pandas as pd
import pandas_market_calendars as mcal


# ==========================================
# 1. FILE PATHS
# ==========================================

BACKEND = Path(__file__).resolve().parent
PROJECT = BACKEND.parent

STOCK_FILE = (
    BACKEND / "data" / "us_equity_history.csv"
)

TOKEN_FILE = (
    PROJECT
    / "agent-bridge"
    / "data"
    / "session_close_history.csv"
)

DAILY_FILE = (
    PROJECT
    / "agent-bridge"
    / "data"
    / "cross_market_history.csv"
)

OUTPUT_FOLDER = BACKEND / "data"


# ==========================================
# 2. LOAD AND VALIDATE PRICE DATA
# ==========================================

def load_prices(file_path, expected_assets):

    df = pd.read_csv(file_path)

    required = {"date", "asset", "close"}

    if not required.issubset(df.columns):
        raise ValueError(
            f"Missing CSV columns in {file_path}"
        )

    if not set(df["asset"]).issubset(expected_assets):
        raise ValueError(
            f"Unexpected asset in {file_path}"
        )

    df["date"] = pd.to_datetime(
        df["date"],
        format="%Y-%m-%d",
        errors="raise"
    ).dt.strftime("%Y-%m-%d")

    df["close"] = pd.to_numeric(
        df["close"],
        errors="raise"
    )

    if (
        not np.isfinite(df["close"]).all()
        or (df["close"] <= 0).any()
    ):
        raise ValueError("Invalid price detected")

    if df.duplicated(["date", "asset"]).any():
        raise ValueError(
            "Duplicate asset/date observation"
        )

    return df


stocks = load_prices(
    STOCK_FILE,
    {"NVDA", "TSLA"}
)

tokens = load_prices(
    TOKEN_FILE,
    {"rNVDA", "rTSLA"}
)

daily_tokens = load_prices(
    DAILY_FILE,
    {"rNVDA", "rTSLA", "BTC"}
)


# ==========================================
# 3. VALIDATE HOURLY CANDLE END TIMES
# ==========================================

tokens["candle_end_utc"] = pd.to_datetime(
    tokens["candle_end_utc"],
    utc=True,
    errors="raise"
)

new_york_time = (
    tokens["candle_end_utc"]
    .dt.tz_convert("America/New_York")
)

valid_clock = (
    (new_york_time.dt.hour == 16)
    & (new_york_time.dt.minute == 0)
)

valid_date = (
    new_york_time.dt.strftime("%Y-%m-%d")
    == tokens["date"]
)

if not (valid_clock & valid_date).all():
    raise ValueError(
        "Token candle timestamp or date is incorrect"
    )


# ==========================================
# 4. GET THE NYSE TRADING CALENDAR
# ==========================================

nyse = mcal.get_calendar("NYSE")

schedule = nyse.schedule(
    start_date=stocks["date"].min(),
    end_date=stocks["date"].max()
)

regular_sessions = {}
early_sessions = []

for session_date, session in schedule.iterrows():

    date_text = session_date.strftime("%Y-%m-%d")

    expected_close = session["market_close"]

    local_close = expected_close.tz_convert(
        "America/New_York"
    )

    # Our collector only recorded 4 PM prices.
    if (
        local_close.hour == 16
        and local_close.minute == 0
    ):
        regular_sessions[date_text] = expected_close

    else:
        early_sessions.append(date_text)

print("\nNYSE MARKET CALENDAR")
print("====================")

print("All NYSE sessions:", len(schedule))

print(
    "Regular closing sessions:",
    len(regular_sessions)
)

print("Early closing dates:", early_sessions)


# ==========================================
# 5. DEFINE STOCK-TOKEN PAIRS
# ==========================================

pairs = [
    ("NVDA", "rNVDA"),
    ("TSLA", "rTSLA")
]

all_aligned_rows = []
reports = {}


# ==========================================
# 6. MATCH SESSION CLOSE TIMESTAMPS
# ==========================================

for stock_name, token_name in pairs:

    print("\n================================")
    print(f"{token_name} vs {stock_name}")
    print("================================")

    stock_data = (
        stocks[stocks["asset"] == stock_name]
        .set_index("date")
    )

    token_data = (
        tokens[tokens["asset"] == token_name]
        .set_index("date")
    )

    daily_data = (
        daily_tokens[
            daily_tokens["asset"] == token_name
        ]
        .set_index("date")
    )

    regular_stock_dates = sorted(
        set(stock_data.index)
        & set(regular_sessions)
    )

    missing_token_dates = []
    timestamp_mismatches = []
    matched_rows = []

    for day in regular_stock_dates:

        if day not in token_data.index:
            missing_token_dates.append(day)
            continue

        token_row = token_data.loc[day]

        expected_close = regular_sessions[day]

        actual_close = token_row["candle_end_utc"]

        if actual_close != expected_close:
            timestamp_mismatches.append(day)
            continue

        daily_close = (
            daily_data.loc[day, "close"]
            if day in daily_data.index
            else float("nan")
        )

        matched_rows.append({
            "date": day,
            "stock_asset": stock_name,
            "token_asset": token_name,
            "stock_close": float(
                stock_data.loc[day, "close"]
            ),
            "token_close": float(
                token_row["close"]
            ),
            "utc_daily_token_close": daily_close,
            "expected_close_utc": (
                expected_close.isoformat()
            ),
            "token_candle_end_utc": (
                actual_close.isoformat()
            )
        })

    comparison = pd.DataFrame(matched_rows)

    all_aligned_rows.extend(matched_rows)

    print(
        "Regular stock sessions:",
        len(regular_stock_dates)
    )

    print(
        "Matched session closes:",
        len(matched_rows)
    )

    print(
        "Missing token dates:",
        missing_token_dates
    )

    print(
        "Timestamp mismatches:",
        timestamp_mismatches
    )

    # ======================================
    # 7. COMPARE CORRELATIONS
    # ======================================

    aligned_correlation = None
    daily_correlation = None
    return_count = 0

    if not comparison.empty:

        # Compare using exactly the same
        # dates for both token-price methods.
        common = comparison.dropna(
            subset=["utc_daily_token_close"]
        ).copy()

        returns = common[
            [
                "stock_close",
                "token_close",
                "utc_daily_token_close"
            ]
        ].pct_change(
            fill_method=None
        ).dropna()

        return_count = len(returns)

        if return_count >= 3:

            aligned_correlation = float(
                returns["stock_close"].corr(
                    returns["token_close"]
                )
            )

            daily_correlation = float(
                returns["stock_close"].corr(
                    returns["utc_daily_token_close"]
                )
            )

            print(
                "Session-aligned correlation:",
                round(aligned_correlation, 4)
            )

            print(
                "UTC-daily correlation:",
                round(daily_correlation, 4)
            )

    reports[f"{token_name}_vs_{stock_name}"] = {
        "regularStockSessions": len(
            regular_stock_dates
        ),
        "matchedSessions": len(matched_rows),
        "missingTokenDates": missing_token_dates,
        "timestampMismatches": timestamp_mismatches,
        "pairedReturnCount": return_count,
        "sessionAlignedCorrelation": (
            aligned_correlation
        ),
        "utcDailyCorrelation": daily_correlation
    }


# ==========================================
# 8. SAVE RESULTS
# ==========================================

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True
)

aligned_path = (
    OUTPUT_FOLDER / "session_aligned_pairs.csv"
)

report_path = (
    OUTPUT_FOLDER / "session_alignment_report.json"
)

pd.DataFrame(all_aligned_rows).to_csv(
    aligned_path,
    index=False
)

report = {
    "method": (
        "NYSE regular-session close matched "
        "to Bitget hourly candle end"
    ),
    "excludedEarlyCloses": early_sessions,
    "comparisons": reports,
    "limitations": [
        "Hourly token closes approximate the equity close",
        "Yahoo historical prices are not independently verified",
        "No missing prices were fabricated",
        "Correlation does not establish causation",
        "Results are exploratory, not predictive"
    ]
}

report_path.write_text(
    json.dumps(report, indent=2),
    encoding="utf-8"
)

print("\nSESSION ALIGNMENT COMPLETED")
print("===========================")

print("Aligned records:", len(all_aligned_rows))

print("CSV:", aligned_path)
print("Report:", report_path)
