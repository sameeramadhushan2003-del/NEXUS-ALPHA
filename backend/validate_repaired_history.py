
from pathlib import Path
import json

import numpy as np
import pandas as pd


# ==========================================
# 1. FILE PATHS
# ==========================================

BACKEND = Path(__file__).resolve().parent
DATA_DIR = BACKEND.parent / "agent-bridge" / "data"

ORIGINAL = DATA_DIR / "cross_market_history.csv"

REPAIRED = (
    DATA_DIR / "cross_market_history_repaired.csv"
)

REPORT = DATA_DIR / "cross_market_repair_report.json"

ASSETS = {"BTC", "rNVDA", "rTSLA"}

EXPECTED_NEW_DATES = {
    "2026-07-30",
    "2026-09-28"
}


# ==========================================
# 2. READ AND VALIDATE CSV
# ==========================================

def read_prices(path):

    df = pd.read_csv(path)

    if not {"date", "asset", "close"}.issubset(
        df.columns
    ):
        raise ValueError("Missing CSV columns")

    df["date"] = pd.to_datetime(
        df["date"],
        format="%Y-%m-%d"
    ).dt.strftime("%Y-%m-%d")

    df["close"] = pd.to_numeric(
        df["close"],
        errors="raise"
    )

    if not set(df["asset"]).issubset(ASSETS):
        raise ValueError("Unexpected asset detected")

    if (
        not np.isfinite(df["close"]).all()
        or (df["close"] <= 0).any()
    ):
        raise ValueError("Invalid price detected")

    if df.duplicated(["date", "asset"]).any():
        raise ValueError("Duplicate records detected")

    return df


# ==========================================
# 3. VERIFY ORIGINAL DATA IS PRESERVED
# ==========================================

def main():

    original = read_prices(ORIGINAL)
    repaired = read_prices(REPAIRED)

    print("\nNEXUS ALPHA - REPAIR VALIDATION")
    print("===============================")

    original_index = original.set_index(
        ["date", "asset"]
    )

    repaired_index = repaired.set_index(
        ["date", "asset"]
    )

    missing_original = (
        original_index.index.difference(
            repaired_index.index
        )
    )

    if len(missing_original) > 0:
        raise ValueError(
            "Some original records were removed"
        )

    preserved = repaired_index.loc[
        original_index.index, "close"
    ]

    if not np.allclose(
        preserved.to_numpy(),
        original_index["close"].to_numpy(),
        rtol=0,
        atol=0
    ):
        raise ValueError(
            "Original prices were modified"
        )

    print("Original prices preserved: YES")


    # ======================================
    # 4. CHECK RECOVERED RECORDS
    # ======================================

    new_index = repaired_index.index.difference(
        original_index.index
    )

    recovered = repaired_index.loc[
        new_index
    ].reset_index()

    if len(recovered) != 6:
        raise ValueError(
            "Expected exactly six new records"
        )

    if set(recovered["date"]) != EXPECTED_NEW_DATES:
        raise ValueError(
            "Unexpected recovered dates"
        )

    print("New records:", len(recovered))


    # ======================================
    # 5. CHECK ALL MATCHED DATES
    # ======================================

    counts = repaired.groupby("date")[
        "asset"
    ].nunique()

    if not (counts == 3).all():
        raise ValueError(
            "Some dates do not contain all assets"
        )

    print("Total records:", len(repaired))
    print("Matched dates:", len(counts))

    if "2026-06-06" in set(repaired["date"]):
        raise ValueError(
            "Unexpected June 6 record found"
        )

    print("June 6 left missing: YES")


    # ======================================
    # 6. VERIFY RECOVERED TIMESTAMPS
    # ======================================

    report = json.loads(
        REPORT.read_text(encoding="utf-8")
    )

    timestamp_rows = report["recovered"]

    if len(timestamp_rows) != 6:
        raise ValueError(
            "Repair report has incorrect row count"
        )

    for date in EXPECTED_NEW_DATES:

        rows = [
            row for row in timestamp_rows
            if row["date"] == date
        ]

        if {row["asset"] for row in rows} != ASSETS:
            raise ValueError(
                f"Incomplete timestamp data: {date}"
            )

        timestamps = {
            row["candleTimestampUtc"]
            for row in rows
        }

        if len(timestamps) != 1:
            raise ValueError(
                f"Different candle timestamps: {date}"
            )

        timestamp = next(iter(timestamps))

        if not timestamp.startswith(date):
            raise ValueError(
                f"Unexpected candle date: {date}"
            )

        print(
            f"{date}: all three assets use "
            f"{timestamp}"
        )


    # ======================================
    # 7. FINISH
    # ======================================

    print("\nVALIDATION PASSED")
    print("Original records:", len(original))
    print("Recovered records:", len(recovered))
    print("Total matched dates:", len(counts))

    print(
        "\nTimestamp consistency checked. "
        "Candle closing-time semantics still "
        "require separate verification."
    )


if __name__ == "__main__":
    main()
