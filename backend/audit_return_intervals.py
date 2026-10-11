
from pathlib import Path
import json

import pandas as pd
import pandas_market_calendars as mcal

from engine import load_prices


# ==========================================
# 1. CONFIGURE FILE PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

DATA_FILE = (
    BASE_DIR / "data" / "five_asset_history.csv"
)

OUTPUT_FILE = (
    BASE_DIR / "data" / "return_interval_audit.json"
)


# ==========================================
# 2. LOAD DATA AND EXCHANGE CALENDAR
# ==========================================

prices = load_prices(DATA_FILE)

nyse = mcal.get_calendar("NYSE")


# ==========================================
# 3. DEFINE RESEARCH COMPARISONS
# ==========================================

PAIRS = [
    ("rNVDA", "BTC", "daily"),
    ("rTSLA", "BTC", "daily"),
    ("rNVDA", "NVDA", "nyse"),
    ("rTSLA", "TSLA", "nyse"),
]


# ==========================================
# 4. IDENTIFY EXPECTED DATES
# ==========================================

def get_expected_dates(paired, calendar):

    start = paired.index.min()
    end = paired.index.max()

    if calendar == "daily":

        # Crypto-linked data: every calendar day.
        return pd.date_range(
            start=start,
            end=end,
            freq="D"
        )

    # Ordinary US stock comparisons:
    # only actual NYSE trading sessions.
    schedule = nyse.schedule(
        start_date=start,
        end_date=end
    )

    return schedule.index.normalize()


# ==========================================
# 5. ANALYZE A SELECTED PAIR
# ==========================================

def analyze_pair(asset_a, asset_b, calendar):

    paired = prices[
        [asset_a, asset_b]
    ].dropna().sort_index()

    expected = get_expected_dates(
        paired,
        calendar
    )

    # Dates where an observation should exist
    # under the selected market calendar.
    missing = expected.difference(
        paired.index
    )

    # Elapsed calendar days between observations.
    intervals = (
        paired.index.to_series()
        .diff()
        .dt.days
    )

    # Return between successive observed closes.
    # A multi-day return is NOT a daily return.
    returns = (
        paired[asset_a]
        .pct_change(fill_method=None)
        * 100
    )

    gap_records = []

    for i in range(1, len(paired)):

        elapsed = int(intervals.iloc[i])

        if elapsed <= 1:
            continue

        gap_records.append({
            "previousDate": (
                paired.index[i - 1].strftime(
                    "%Y-%m-%d"
                )
            ),
            "currentDate": (
                paired.index[i].strftime(
                    "%Y-%m-%d"
                )
            ),
            "elapsedCalendarDays": elapsed,
            "primaryReturnPct": round(
                float(returns.iloc[i]),
                4
            )
        })

    result = {
        "pair": f"{asset_a}_vs_{asset_b}",
        "calendar": calendar,
        "observations": len(paired),
        "expectedDates": len(expected),
        "missingExpectedDates": [
            d.strftime("%Y-%m-%d")
            for d in missing
        ],
        "multiDayIntervals": len(gap_records),
        "gapDetails": gap_records
    }

    return result


# ==========================================
# 6. RUN THE AUDIT
# ==========================================

def main():

    print("\nNEXUS ALPHA - RETURN INTERVAL AUDIT")
    print("==================================")

    reports = {}

    for asset_a, asset_b, calendar in PAIRS:

        result = analyze_pair(
            asset_a,
            asset_b,
            calendar
        )

        reports[result["pair"]] = result

        print("\n------------------------------")
        print(result["pair"])

        print(
            "Observations:",
            result["observations"]
        )

        print(
            "Expected market dates:",
            result["expectedDates"]
        )

        print(
            "Missing expected dates:",
            result["missingExpectedDates"]
        )

        print(
            "Intervals longer than one calendar day:",
            result["multiDayIntervals"]
        )

        # Print only the first five examples.
        for gap in result["gapDetails"][:5]:

            print(
                f"  {gap['previousDate']} -> "
                f"{gap['currentDate']} "
                f"({gap['elapsedCalendarDays']} days)"
            )

    # ======================================
    # 7. SAVE REPRODUCIBLE RESULTS
    # ======================================

    report = {
        "project": "NEXUS ALPHA",
        "analysis": "Historical return interval audit",
        "comparisons": reports,
        "limitations": [
            "Multi-day returns must not be labeled as single-day returns",
            "NYSE weekends and holidays are normal market closures",
            "Crypto-linked prices may have missing calendar dates",
            "No missing observations were filled",
            "This audit does not establish predictive performance"
        ]
    }

    OUTPUT_FILE.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8"
    )

    print("\nAUDIT COMPLETE")
    print("Report:", OUTPUT_FILE)


if __name__ == "__main__":
    main()
