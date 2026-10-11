
from pathlib import Path
import json

from engine import evaluate

from run_timestamped_strategy import (
    load_timestamped_prices,
    longest_contiguous_period
)


# ==========================================
# 1. CONFIGURE OUTPUT FILE
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

OUTPUT_FILE = (
    BASE_DIR
    / "data"
    / "strategy_reliability_report.json"
)


# ==========================================
# 2. DEFINE TRANSACTION COST SCENARIOS
# ==========================================

SCENARIOS = [
    {
        "name": "No assumed costs",
        "fee": 0,
        "slippage": 0
    },
    {
        "name": "Current costs",
        "fee": 5,
        "slippage": 8
    },
    {
        "name": "Double costs",
        "fee": 10,
        "slippage": 16
    }
]


# ==========================================
# 3. RUN THE HISTORICAL STRATEGY
# ==========================================

def run_scenario(
    prices,
    fee,
    slippage
):

    return evaluate(
        prices,
        primary="rNVDA",
        reference="BTC",
        lookback=25,
        threshold=1.25,
        oos_days=45,
        fee_bps=fee,
        slippage_bps=slippage
    )


# ==========================================
# 4. COUNT SIMULATED POSITION CHANGES
# ==========================================

def analyze_positions(result):

    chart = result["chart"]

    train = [
        row for row in chart
        if row["phase"] == "TRAIN"
    ]

    test = [
        row for row in chart
        if row["phase"] == "TEST"
    ]

    active_days = sum(
        row["position"] == 1
        for row in test
    )

    inactive_days = len(test) - active_days

    entries = 0
    exits = 0

    # Start with the position held at the
    # end of the training period.
    previous_position = (
        train[-1]["position"]
        if train
        else 0
    )

    for row in test:

        current_position = row["position"]

        if (
            previous_position == 0
            and current_position == 1
        ):
            entries += 1

        elif (
            previous_position == 1
            and current_position == 0
        ):
            exits += 1

        previous_position = current_position

    return {
        "trainingObservations": len(train),
        "testingObservations": len(test),
        "activeTestDays": active_days,
        "inactiveTestDays": inactive_days,
        "activeTestPct": round(
            active_days / len(test) * 100,
            2
        ) if test else 0,
        "testEntries": entries,
        "testExits": exits,
        "totalPositionChanges": entries + exits
    }


# ==========================================
# 5. RUN ALL COST SCENARIOS
# ==========================================

def main():

    print("\nNEXUS ALPHA - RELIABILITY AUDIT")
    print("==============================")

    prices = load_timestamped_prices()

    clean = longest_contiguous_period(
        prices
    )

    print(
        "Validated observations:",
        len(clean)
    )

    results = {}

    baseline_positions = None

    for scenario in SCENARIOS:

        result = run_scenario(
            clean,
            scenario["fee"],
            scenario["slippage"]
        )

        # Transaction costs should not
        # change our historical signal.
        positions = [
            row["position"]
            for row in result["chart"]
        ]

        if baseline_positions is None:
            baseline_positions = positions

        elif positions != baseline_positions:
            raise ValueError(
                "Positions changed between cost scenarios"
            )

        metrics = result["stats"]["outOfSample"]

        results[scenario["name"]] = {
            "costBps": (
                scenario["fee"]
                + scenario["slippage"]
            ),
            "oosReturnPct": metrics["returnPct"],
            "oosSharpe": metrics["sharpe"],
            "oosMaxDrawdownPct": (
                metrics["maxDrawdownPct"]
            ),
            "oosVolatilityPct": (
                metrics["volatilityPct"]
            )
        }

    # ======================================
    # 6. EXAMINE SIMULATED ACTIVITY
    # ======================================

    reference_result = run_scenario(
        clean,
        fee=5,
        slippage=8
    )

    activity = analyze_positions(
        reference_result
    )

    print("\nOUT-OF-SAMPLE ACTIVITY")
    print("======================")

    for key, value in activity.items():
        print(f"{key}: {value}")

    # ======================================
    # 7. COMPARE TRANSACTION COSTS
    # ======================================

    print("\nCOST SENSITIVITY")
    print("================")

    for name, metrics in results.items():

        print(f"\n{name}")

        print(
            "Total assumed cost:",
            metrics["costBps"],
            "bps per position change"
        )

        print(
            "OOS return:",
            metrics["oosReturnPct"],
            "%"
        )

        print(
            "OOS Sharpe:",
            metrics["oosSharpe"]
        )

        print(
            "OOS maximum drawdown:",
            metrics["oosMaxDrawdownPct"],
            "%"
        )

    # ======================================
    # 8. SAVE THE AUDIT REPORT
    # ======================================

    report = {
        "project": "NEXUS ALPHA",
        "analysis": (
            "Historical strategy reliability audit"
        ),
        "dataSource": (
            "Timestamp-aware historical prices"
        ),
        "pair": "rNVDA vs BTC",
        "validatedObservations": len(clean),
        "periodsPerYear": (
            reference_result["stats"][
                "periodsPerYear"
            ]
        ),
        "activity": activity,
        "costScenarios": results,
        "limitations": [
            "Historical simulation only",
            "Sharpe uses a limited test period",
            "Transaction costs are assumptions",
            "Signal construction is unchanged",
            "No real orders are executed",
            "Results are not predictive evidence"
        ]
    }

    OUTPUT_FILE.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8"
    )

    print("\nRELIABILITY AUDIT COMPLETED")
    print("Report:", OUTPUT_FILE)


# ==========================================
# 9. START
# ==========================================

if __name__ == "__main__":
    main()
