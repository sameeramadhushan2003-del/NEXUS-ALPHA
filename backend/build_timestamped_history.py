
import csv
import json
import math

from pathlib import Path
from datetime import datetime, timedelta, timezone


# ==========================================
# 1. DEFINE FILE PATHS
# ==========================================

BACKEND = Path(__file__).resolve().parent
PROJECT = BACKEND.parent

INPUT_FILE = (
    PROJECT
    / "agent-bridge"
    / "data"
    / "cross_market_history_repaired.csv"
)

OUTPUT_FILE = (
    BACKEND
    / "data"
    / "timestamp_aware_history.csv"
)

REPORT_FILE = (
    BACKEND
    / "data"
    / "timestamp_aware_history_report.json"
)

ASSETS = {"rNVDA", "rTSLA", "BTC"}


# ==========================================
# 2. READ AND VALIDATE ORIGINAL PRICES
# ==========================================

def load_data():

    records = []
    seen = set()

    with INPUT_FILE.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        if reader.fieldnames != [
            "date", "asset", "close"
        ]:
            raise ValueError(
                "Unexpected CSV columns"
            )

        for row in reader:

            date_text = row["date"].strip()
            asset = row["asset"].strip()
            close_text = row["close"].strip()

            date = datetime.strptime(
                date_text,
                "%Y-%m-%d"
            ).date()

            if date.isoformat() != date_text:
                raise ValueError("Invalid date format")

            close = float(close_text)

            if (
                asset not in ASSETS
                or not math.isfinite(close)
                or close <= 0
            ):
                raise ValueError(
                    "Invalid asset or closing price"
                )

            key = (date_text, asset)

            if key in seen:
                raise ValueError(
                    f"Duplicate observation: {key}"
                )

            seen.add(key)

            records.append({
                "date": date,
                "asset": asset,
                "close": close_text
            })

    return sorted(
        records,
        key=lambda x: (x["date"], x["asset"])
    )


# ==========================================
# 3. VALIDATE MATCHED ASSET DATES
# ==========================================

def validate_dates(records):

    dates = {}

    for row in records:

        dates.setdefault(
            row["date"], set()
        ).add(row["asset"])

    for date, assets in dates.items():

        if assets != ASSETS:
            raise ValueError(
                f"Incomplete asset coverage: {date}"
            )

    if len(dates) != 130 or len(records) != 390:
        raise ValueError(
            "Unexpected repaired dataset size"
        )

    return sorted(dates)


# ==========================================
# 4. FORMAT UTC TIMESTAMPS
# ==========================================

def utc_text(value):

    return value.isoformat().replace(
        "+00:00", "Z"
    )


# ==========================================
# 5. BUILD TIMESTAMP-AWARE RECORDS
# ==========================================

def main():

    print("\nNEXUS ALPHA - TIMESTAMP-AWARE DATA")
    print("=================================")

    records = load_data()

    dates = validate_dates(records)

    previous_dates = {}

    output_rows = []
    gaps = []

    for row in records:

        date = row["date"]
        asset = row["asset"]

        # Daily candle opens at 16:00 UTC.
        candle_start = datetime(
            date.year,
            date.month,
            date.day,
            16,
            0,
            tzinfo=timezone.utc
        )

        # The closing price becomes available
        # when the 24-hour candle finishes.
        candle_end = (
            candle_start + timedelta(days=1)
        )

        if candle_end > datetime.now(timezone.utc):
            raise ValueError(
                "An unfinished candle was detected"
            )

        # Check distance from the previous
        # observed candle for this asset.
        previous = previous_dates.get(asset)

        elapsed_days = None

        if previous is not None:

            elapsed_days = (
                date - previous
            ).days

            if elapsed_days > 1:

                gaps.append({
                    "asset": asset,
                    "previousDate": previous.isoformat(),
                    "currentDate": date.isoformat(),
                    "elapsedDays": elapsed_days,
                    "missingDays": elapsed_days - 1
                })

        previous_dates[asset] = date

        output_rows.append({
            "candle_start_date": date.isoformat(),
            "asset": asset,
            "close": row["close"],
            "candle_start_utc": utc_text(
                candle_start
            ),
            "candle_end_utc": utc_text(
                candle_end
            ),
            "elapsed_days_since_previous": (
                elapsed_days
                if elapsed_days is not None
                else ""
            )
        })


    # ======================================
    # 6. FIND MISSING CALENDAR DATES
    # ======================================

    observed_dates = set(dates)

    missing_dates = []

    day = dates[0]

    while day <= dates[-1]:

        if day not in observed_dates:
            missing_dates.append(day.isoformat())

        day += timedelta(days=1)


    # ======================================
    # 7. SAVE TIMESTAMP-AWARE CSV
    # ======================================

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with OUTPUT_FILE.open(
        "w",
        encoding="utf-8",
        newline=""
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=list(
                output_rows[0].keys()
            )
        )

        writer.writeheader()
        writer.writerows(output_rows)


    # ======================================
    # 8. SAVE THE RESEARCH AUDIT REPORT
    # ======================================

    report = {
        "project": "NEXUS ALPHA",
        "source": "Bitget Agent Hub",
        "inputFile": INPUT_FILE.name,
        "outputFile": OUTPUT_FILE.name,
        "timestampConvention": (
            "Each 1D candle starts at 16:00 UTC "
            "and its close is available 24 hours later"
        ),
        "timestampEvidence": (
            "Historical API timestamp audit and "
            "daily-versus-hourly candle comparison"
        ),
        "records": len(output_rows),
        "matchedDates": len(dates),
        "missingDates": missing_dates,
        "gapDetails": gaps,
        "limitations": [
            "Candle close is not available at candle start",
            "Reconstructed timestamps follow the verified API convention",
            "Missing calendar dates are not filled",
            "Multi-day returns require special treatment",
            "This file is not yet validated for backtesting"
        ]
    }

    REPORT_FILE.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8"
    )


    # ======================================
    # 9. DISPLAY FINAL RESULTS
    # ======================================

    print("Historical records:", len(output_rows))
    print("Matched dates:", len(dates))
    print("Missing calendar dates:", missing_dates)
    print("Gap records:", len(gaps))

    print("\nFirst candle closes at:")
    print(output_rows[0]["candle_end_utc"])

    print("\nLast candle closes at:")
    print(output_rows[-1]["candle_end_utc"])

    print("\nTIMESTAMP DATASET CREATED")
    print("CSV:", OUTPUT_FILE)
    print("Report:", REPORT_FILE)


if __name__ == "__main__":
    main()
