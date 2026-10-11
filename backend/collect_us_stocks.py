
import csv
import json

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf


# ==========================================
# 1. CONFIGURATION
# ==========================================

START_DATE = "2026-06-01"

# End date is exclusive.
END_DATE = "2026-10-11"

SYMBOLS = [
    "NVDA",
    "TSLA"
]

OUTPUT_FOLDER = (
    Path(__file__).resolve().parent / "data"
)


# ==========================================
# 2. DOWNLOAD ONE STOCK
# ==========================================

def download_stock(symbol):
    print(f"\nDownloading {symbol}...")

    stock = yf.Ticker(symbol)

    history = stock.history(
        start=START_DATE,
        end=END_DATE,
        interval="1d",
        auto_adjust=False,
        actions=False,
        timeout=20
    )

    if history.empty:
        raise RuntimeError(
            f"No historical data returned for {symbol}"
        )

    # Keep only valid closing prices.
    history = history[["Close"]].copy()

    history["Close"] = pd.to_numeric(
        history["Close"],
        errors="coerce"
    )

    history = history.dropna(
        subset=["Close"]
    )

    history = history[
        history["Close"] > 0
    ]

    if history.empty:
        raise RuntimeError(
            f"No valid closing prices for {symbol}"
        )

    # Convert into our research engine's format.
    records = []

    for timestamp, row in history.iterrows():
        records.append({
            "date": timestamp.date().isoformat(),
            "asset": symbol,
            "close": float(row["Close"])
        })

    print("Valid records:", len(records))
    print("First date:", records[0]["date"])
    print("Last date:", records[-1]["date"])

    return records


# ==========================================
# 3. COLLECT BOTH STOCKS
# ==========================================

def main():
    all_records = []
    counts = {}

    for symbol in SYMBOLS:
        records = download_stock(symbol)

        all_records.extend(records)

        counts[symbol] = len(records)

    # Sort observations chronologically.
    all_records.sort(
        key=lambda row: (
            row["date"],
            row["asset"]
        )
    )

    # Check for duplicate date/asset pairs.
    keys = [
        (row["date"], row["asset"])
        for row in all_records
    ]

    if len(keys) != len(set(keys)):
        raise RuntimeError(
            "Duplicate stock observations detected."
        )

    # ======================================
    # 4. SAVE HISTORICAL CSV
    # ======================================

    OUTPUT_FOLDER.mkdir(
        parents=True,
        exist_ok=True
    )

    csv_path = (
        OUTPUT_FOLDER / "us_equity_history.csv"
    )

    with csv_path.open(
        "w",
        newline="",
        encoding="utf-8"
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=[
                "date",
                "asset",
                "close"
            ]
        )

        writer.writeheader()

        writer.writerows(all_records)

    # ======================================
    # 5. SAVE SOURCE METADATA
    # ======================================

    metadata = {
        "source": "Yahoo Finance via yfinance",
        "symbols": SYMBOLS,
        "startDate": START_DATE,
        "endDateExclusive": END_DATE,
        "interval": "1d",
        "priceField": "Unadjusted Close",
        "observationsByAsset": counts,
        "downloadedAt": datetime.now(
            timezone.utc
        ).isoformat(),
        "note": (
            "Daily US equity trading-session data. "
            "Not yet synchronized with Bitget "
            "UTC daily candles. Source accuracy "
            "requires independent verification."
        )
    }

    metadata_path = (
        OUTPUT_FOLDER / "us_equity_metadata.json"
    )

    metadata_path.write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8"
    )

    # ======================================
    # 6. DISPLAY RESULTS
    # ======================================

    print("\nUS STOCK DATA COLLECTION COMPLETE")

    print("Total records:", len(all_records))

    print("NVDA observations:", counts["NVDA"])
    print("TSLA observations:", counts["TSLA"])

    print("\nCSV saved to:")
    print(csv_path)


# ==========================================
# 7. EXECUTE PROGRAM
# ==========================================

if __name__ == "__main__":
    main()
