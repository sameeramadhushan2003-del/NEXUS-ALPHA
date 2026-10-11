
from pathlib import Path

import pandas as pd


# ==========================================
# 1. DEFINE PROJECT LOCATIONS
# ==========================================

BACKEND = Path(__file__).resolve().parent
PROJECT = BACKEND.parent

BITGET_DATA = PROJECT / "agent-bridge" / "data"
STOCK_DATA = BACKEND / "data"


# ==========================================
# 2. IDENTIFY DATES TO INVESTIGATE
# ==========================================

MISSING_DATES = [
    "2026-06-06",
    "2026-07-30",
    "2026-09-28"
]


# ==========================================
# 3. DEFINE HISTORICAL SOURCES
# ==========================================

SOURCES = {
    "cross": (
        BITGET_DATA / "cross_market_history.csv"
    ),
    "btc": (
        BITGET_DATA / "market_history.csv"
    ),
    "hourly": (
        BITGET_DATA / "session_close_history.csv"
    ),
    "stocks": (
        STOCK_DATA / "us_equity_history.csv"
    )
}


# ==========================================
# 4. LOAD SOURCE FILES
# ==========================================

datasets = {}

for name, path in SOURCES.items():

    if not path.exists():
        raise FileNotFoundError(
            f"Missing source file: {path}"
        )

    datasets[name] = pd.read_csv(
        path,
        usecols=["date", "asset"],
        dtype=str
    )

    print(f"Loaded {name}: {len(datasets[name])} rows")


# ==========================================
# 5. CHECK FOR AN ASSET ON A DATE
# ==========================================

def has_observation(source, asset, date):

    df = datasets[source]

    match = (
        (df["date"] == date)
        & (df["asset"] == asset)
    )

    return bool(match.any())


# ==========================================
# 6. COMPARE ORIGINAL DATA SOURCES
# ==========================================

CHECKS = [
    ("BTC cross-market", "cross", "BTC"),
    ("rNVDA cross-market", "cross", "rNVDA"),
    ("rTSLA cross-market", "cross", "rTSLA"),
    ("BTC independent", "btc", "BTC"),
    ("rNVDA hourly", "hourly", "rNVDA"),
    ("rTSLA hourly", "hourly", "rTSLA"),
    ("NVDA stock", "stocks", "NVDA"),
    ("TSLA stock", "stocks", "TSLA")
]


def main():

    print("\nNEXUS ALPHA - SOURCE AVAILABILITY")
    print("=================================")

    results = []

    for label, source, asset in CHECKS:

        row = {"Source / Asset": label}

        for date in MISSING_DATES:

            found = has_observation(
                source,
                asset,
                date
            )

            row[date] = (
                "PRESENT" if found else "MISSING"
            )

        results.append(row)

    table = pd.DataFrame(results)

    print("\n", table.to_string(index=False))

    print("\nIMPORTANT:")
    print(
        "The cross-market CSV contains only "
        "dates shared by its selected assets."
    )
    print(
        "Missing rows in that CSV do not prove "
        "that every original API source was missing."
    )

    print("\nSOURCE AUDIT COMPLETE")


if __name__ == "__main__":
    main()
