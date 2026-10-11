
from pathlib import Path

import numpy as np
import pandas as pd


# ==========================================
# 1. LOCATE HISTORICAL DATA
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

CSV_FILE = (
    BASE_DIR
    / "data"
    / "five_asset_history.csv"
)


# ==========================================
# 2. LOAD THE FIVE-ASSET DATASET
# ==========================================

print("\nLOADING HISTORICAL DATA...")

df = pd.read_csv(CSV_FILE)

required_columns = {
    "date",
    "asset",
    "close"
}

if not required_columns.issubset(df.columns):
    raise ValueError("Required CSV columns are missing")

df["date"] = pd.to_datetime(
    df["date"],
    errors="raise"
)

df["close"] = pd.to_numeric(
    df["close"],
    errors="raise"
)

if (
    not np.isfinite(df["close"]).all()
    or (df["close"] <= 0).any()
):
    raise ValueError("Invalid historical prices found")

if df.duplicated(["date", "asset"]).any():
    raise ValueError("Duplicate asset/date records found")


# ==========================================
# 3. CONVERT DATA INTO COLUMNS
# ==========================================

prices = df.pivot(
    index="date",
    columns="asset",
    values="close"
)

prices = prices.sort_index()

print("Available assets:", list(prices.columns))
print("Total calendar dates:", len(prices))


# ==========================================
# 4. DEFINE RESEARCH COMPARISONS
# ==========================================

comparisons = {
    "rNVDA vs NVDA": ("rNVDA", "NVDA"),
    "rTSLA vs TSLA": ("rTSLA", "TSLA"),
    "rNVDA vs BTC": ("rNVDA", "BTC")
}


# ==========================================
# 5. ANALYZE EACH PAIR
# ==========================================

for name, (asset_a, asset_b) in comparisons.items():

    print("\n================================")
    print(name)
    print("================================")

    # Use only dates where both prices exist.
    paired = prices[
        [asset_a, asset_b]
    ].dropna()

    print("Paired dates:", len(paired))

    if len(paired) < 3:
        print("Insufficient observations")
        continue

    print(
        "First date:",
        paired.index.min().date()
    )

    print(
        "Last date:",
        paired.index.max().date()
    )

    # Calculate returns between paired dates.
    # Missing dates are not filled.
    returns = paired.pct_change(
        fill_method=None
    ).dropna()

    print("Valid paired returns:", len(returns))

    # Pearson correlation of historical returns.
    correlation = returns[
        asset_a
    ].corr(
        returns[asset_b]
    )

    if pd.notna(correlation):
        print(
            "Historical return correlation:",
            round(correlation, 4)
        )
    else:
        print("Correlation unavailable")

    # Check unusually large daily return changes.
    unusual = (
        returns.abs() > 0.20
    ).any(axis=1)

    print(
        "Dates with absolute returns above 20%:",
        int(unusual.sum())
    )

    if len(paired) < 100:
        print(
            "NOTE: Below current engine's "
            "100-paired-date minimum."
        )

    print(
        "WARNING: Closing times are not "
        "yet precisely synchronized."
    )


# ==========================================
# 6. FINISH
# ==========================================

print("\nRESEARCH AUDIT COMPLETED")
print("Descriptive analysis only.")
print("No predictive or trading claims.")
