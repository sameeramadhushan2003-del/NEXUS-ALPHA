
from pathlib import Path

import pandas as pd

from engine import load_prices


# ==========================================
# 1. LOAD HISTORICAL DATA
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

CSV_FILE = (
    BASE_DIR / "data" / "five_asset_history.csv"
)

prices = load_prices(CSV_FILE)

print("\nNEXUS ALPHA - CALENDAR AUDIT")
print("===========================")

print("Dataset dates:", len(prices))


# ==========================================
# 2. DEFINE PAIRS TO TEST
# ==========================================

pairs = [
    ("rNVDA", "BTC"),
    ("rTSLA", "BTC"),
    ("rNVDA", "NVDA"),
    ("rTSLA", "TSLA")
]

lookback = 25
oos_days = 45

minimum_required = max(
    100,
    lookback + oos_days + 20
)


# ==========================================
# 3. AUDIT EACH PAIR
# ==========================================

for asset_a, asset_b in pairs:

    paired = prices[
        [asset_a, asset_b]
    ].dropna()

    paired = paired.sort_index()

    weekend_count = sum(
        paired.index.dayofweek >= 5
    )

    gaps = (
        paired.index.to_series()
        .diff()
        .dt.days
        .dropna()
    )

    large_gaps = int(
        (gaps > 1).sum()
    )

    max_gap = (
        int(gaps.max())
        if not gaps.empty
        else 0
    )

    enough_data = (
        len(paired) >= minimum_required
    )

    print("\n---------------------------")
    print(f"{asset_a} vs {asset_b}")

    print("Paired observations:", len(paired))
    print("Weekend observations:", weekend_count)
    print("Gaps above one day:", large_gaps)
    print("Maximum calendar gap:", max_gap)

    print(
        "Current engine minimum:",
        minimum_required
    )

    print(
        "Current engine eligibility:",
        "PASS" if enough_data else "FAIL"
    )

    if weekend_count > 0:
        print(
            "WARNING: Weekend observations "
            "require calendar-aware "
            "annualization."
        )

    if large_gaps > 0:
        print(
            "NOTE: Some consecutive returns "
            "span multiple calendar days."
        )


print("\nCALENDAR AUDIT COMPLETE")
