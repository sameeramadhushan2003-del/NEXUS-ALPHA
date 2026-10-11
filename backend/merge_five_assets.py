
import csv
import json

from pathlib import Path
from datetime import date
from decimal import Decimal, InvalidOperation
from collections import defaultdict


# ==========================================
# 1. PROJECT PATHS
# ==========================================

BACKEND = Path(__file__).resolve().parent

PROJECT = BACKEND.parent

BITGET_FILE = (
    PROJECT
    / "agent-bridge"
    / "data"
    / "cross_market_history.csv"
)

STOCK_FILE = (
    BACKEND
    / "data"
    / "us_equity_history.csv"
)

OUTPUT_FOLDER = BACKEND / "data"


# ==========================================
# 2. EXPECTED ASSETS
# ==========================================

SOURCES = [
    {
        "file": BITGET_FILE,
        "assets": {"rNVDA", "rTSLA", "BTC"},
        "source": "Bitget Agent Hub"
    },
    {
        "file": STOCK_FILE,
        "assets": {"NVDA", "TSLA"},
        "source": "Yahoo Finance"
    }
]


# ==========================================
# 3. READ AND VALIDATE CSV
# ==========================================

def read_csv(source):
    file_path = source["file"]

    if not file_path.exists():
        raise FileNotFoundError(
            f"File not found: {file_path}"
        )

    records = []

    with file_path.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        required = {"date", "asset", "close"}

        if set(reader.fieldnames or []) != required:
            raise ValueError(
                f"Invalid CSV columns: {file_path}"
            )

        for row in reader:
            asset = row["asset"]

            if asset not in source["assets"]:
                raise ValueError(
                    f"Unexpected asset: {asset}"
                )

            # Validate the calendar date.
            record_date = date.fromisoformat(
                row["date"]
            )

            # Validate the closing price.
            try:
                close = Decimal(row["close"])
            except InvalidOperation:
                raise ValueError(
                    f"Invalid price for {asset}"
                )

            if not close.is_finite() or close <= 0:
                raise ValueError(
                    f"Invalid price for {asset}"
                )

            records.append({
                "date": record_date.isoformat(),
                "asset": asset,
                "close": str(close)
            })

    return records


# ==========================================
# 4. COMBINE AND CHECK DUPLICATES
# ==========================================

def main():
    all_records = []

    for source in SOURCES:
        records = read_csv(source)

        print(
            source["source"],
            "- Records:",
            len(records)
        )

        all_records.extend(records)

    seen = set()

    for row in all_records:
        key = (row["date"], row["asset"])

        if key in seen:
            raise ValueError(
                f"Duplicate observation: {key}"
            )

        seen.add(key)

    all_records.sort(
        key=lambda row: (
            row["date"],
            row["asset"]
        )
    )

    # ======================================
    # 5. FIND AVAILABLE DATES
    # ======================================

    dates_by_asset = defaultdict(set)

    for row in all_records:
        dates_by_asset[row["asset"]].add(
            row["date"]
        )

    def overlap(*assets):
        common = set(
            dates_by_asset[assets[0]]
        )

        for asset in assets[1:]:
            common &= dates_by_asset[asset]

        return len(common)

    comparisons = {
        "rNVDA_vs_NVDA": overlap(
            "rNVDA", "NVDA"
        ),
        "rTSLA_vs_TSLA": overlap(
            "rTSLA", "TSLA"
        ),
        "rNVDA_vs_BTC": overlap(
            "rNVDA", "BTC"
        ),
        "All_five_assets": overlap(
            "rNVDA",
            "rTSLA",
            "BTC",
            "NVDA",
            "TSLA"
        )
    }

    # ======================================
    # 6. SAVE COMBINED DATA
    # ======================================

    OUTPUT_FOLDER.mkdir(
        parents=True,
        exist_ok=True
    )

    csv_path = (
        OUTPUT_FOLDER
        / "five_asset_history.csv"
    )

    with csv_path.open(
        "w",
        encoding="utf-8",
        newline=""
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
    # 7. SAVE DATA QUALITY REPORT
    # ======================================

    audit = {
        "assets": {
            asset: {
                "count": len(dates),
                "firstDate": min(dates),
                "lastDate": max(dates)
            }
            for asset, dates in dates_by_asset.items()
        },
        "calendarOverlap": comparisons,
        "sources": {
            "rNVDA": "Bitget Agent Hub",
            "rTSLA": "Bitget Agent Hub",
            "BTC": "Bitget Agent Hub",
            "NVDA": "Yahoo Finance",
            "TSLA": "Yahoo Finance"
        },
        "warning": (
            "Matching calendar dates does not "
            "mean matching exact market close times. "
            "Session-aware alignment is still required."
        )
    }

    audit_path = (
        OUTPUT_FOLDER
        / "five_asset_audit.json"
    )

    audit_path.write_text(
        json.dumps(audit, indent=2),
        encoding="utf-8"
    )

    # ======================================
    # 8. DISPLAY RESULTS
    # ======================================

    print("\nFIVE-ASSET DATASET CREATED")
    print("==========================")

    print("Total records:", len(all_records))

    for asset, dates in sorted(
        dates_by_asset.items()
    ):
        print(
            f"{asset}: {len(dates)} observations"
        )

    print("\nCALENDAR OVERLAP")

    for name, count in comparisons.items():
        print(f"{name}: {count} dates")

    print("\nCSV:", csv_path)
    print("Audit:", audit_path)


# ==========================================
# 9. RUN
# ==========================================

if __name__ == "__main__":
    main()
