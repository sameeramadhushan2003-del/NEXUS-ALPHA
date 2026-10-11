"""NEXUS ALPHA research API. Public financial data uploads only, no account access."""
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from fastapi import HTTPException

from typing import Literal

from run_timestamped_strategy import (
    INPUT_FILE as VERIFIED_HISTORY_FILE,
    load_timestamped_prices,
    longest_contiguous_period,
)


from google import genai
from google.genai import types
from hashlib import sha256
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from engine import load_prices, evaluate
from generate_demo import generate
import httpx
import csv
import math
import json
import os
from pathlib import Path
HERE=Path(__file__).resolve().parent
DEMO=HERE/'data'/'demo_prices.csv'
IMPORTED=HERE/'data'/'user_prices.csv'
if not DEMO.exists():
    generate(DEMO)

app=FastAPI(title='NEXUS ALPHA — Research API', version='0.1.0',description='Historical analytics and synthetic demonstration; no live trading')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'],allow_methods=['GET','POST'],allow_headers=['*'])


def active_path():
    return IMPORTED if IMPORTED.exists() else DEMO

@app.get('/api/health')
def health():
    return {'status':'ok','mode':'USER UPLOAD — VERIFY SOURCE' if IMPORTED.exists() else 'SYNTHETIC DEMONSTRATION','tradeExecution':False}


@app.get("/api/dashboard")
def dashboard(
    primary: str = "rNVDA",
    reference: str = "BTC",

    lookback: int = Query(
        25, ge=15, le=70
    ),

    threshold: float = Query(
        1.25, ge=0.5, le=3.5
    ),

    oos_days: int = Query(
        45, ge=30, le=140
    ),

    fee_bps: float = Query(
        5, ge=0, le=100
    ),

    slippage_bps: float = Query(
        8, ge=0, le=100
    ),

    dataset: Literal["active", "verified"] = "active"
):

    try:

        # =====================================
        # 1. SELECT HISTORICAL DATASET
        # =====================================

        if dataset == "verified":

            # Load prices indexed by the time
            # their daily candles finished.
            timestamped_prices = (
                load_timestamped_prices()
            )

            # Use the longest period without
            # missing daily observations.
            prices = longest_contiguous_period(
                timestamped_prices
            )

            source_path = VERIFIED_HISTORY_FILE

            data_mode = (
                "BITGET HISTORICAL DATA / "
                "TIMESTAMP-VALIDATED RESEARCH"
            )

            # Only these three assets exist
            # in the verified dataset.
            if (
                primary not in prices.columns
                or reference not in prices.columns
            ):
                raise ValueError(
                    "Verified history supports only "
                    "rNVDA, rTSLA and BTC."
                )

        else:

            # Preserve the original behavior:
            # uploaded historical data or demo.
            source_path = active_path()

            prices = load_prices(
                source_path
            )

            data_mode = (
                "USER UPLOAD — SOURCE UNVERIFIED"
                if IMPORTED.exists()
                else "SYNTHETIC / ILLUSTRATIVE"
            )

        # =====================================
        # 2. RUN THE EXISTING RESEARCH ENGINE
        # =====================================

        result = evaluate(
            prices,
            primary,
            reference,
            lookback,
            threshold,
            oos_days,
            fee_bps,
            slippage_bps
        )

        # =====================================
        # 3. ATTACH DATASET INFORMATION
        # =====================================

        result["meta"]["dataMode"] = data_mode

        result["meta"]["dataset"] = dataset

        result["meta"]["dataSHA256"] = (
            sha256(
                source_path.read_bytes()
            ).hexdigest()
        )

        result["meta"]["sourceFilename"] = (
            source_path.name
        )

        # =====================================
        # 4. PROVIDE VERIFICATION DETAILS
        # =====================================

        if dataset == "verified":

            result["meta"][
                "originalMatchedObservations"
            ] = len(timestamped_prices)

            result["meta"][
                "continuousObservations"
            ] = len(prices)

            result["meta"][
                "excludedObservations"
            ] = (
                len(timestamped_prices) - len(prices)
            )

            result["meta"]["timestampNote"] = (
                "Bitget daily candles start at "
                "16:00 UTC. Closing prices are "
                "indexed 24 hours later."
            )

            result["meta"]["researchWarning"] = (
                "Historical simulation only. "
                "No predictive performance or "
                "real execution is established."
            )

        # =====================================
        # 5. SEND RESPONSE TO REACT
        # =====================================

        return result

    except (ValueError, FileNotFoundError) as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc)
        )


@app.post('/api/import')
async def import_prices(file:UploadFile=File(...)):
    if not file.filename or not file.filename.lower().endswith('.csv'):
        raise HTTPException(400,'Select a CSV file')
    content=await file.read(5_000_001)
    if len(content)>5_000_000:
        raise HTTPException(413,'CSV must be smaller than 5 MB')
    temp=HERE/'data'/'pending_upload.csv'
    temp.write_bytes(content)
    try:
        prices=load_prices(temp)
        temp.replace(IMPORTED)
    except Exception as exc:
        temp.unlink(missing_ok=True)
        raise HTTPException(422,f'CSV rejected: {exc}')
    return {'ok':True,'assets':list(prices.columns),'dates':len(prices),'dataMode':'USER UPLOAD — SOURCE UNVERIFIED'}

@app.post('/api/use-demo')
def use_demo():
    IMPORTED.unlink(missing_ok=True)
    return {'ok':True,'dataMode':'SYNTHETIC / ILLUSTRATIVE'}

@app.get('/api/sample-template')
def sample_template():
    return Response('date,asset,close\n2026-01-02,rNVDA,100.25\n2026-01-02,BTC,80000.00\n2026-01-05,rNVDA,101.10\n2026-01-05,BTC,81000.00\n',media_type='text/csv',headers={'Content-Disposition':'attachment; filename=historical_data_template.csv'})


# -----------------------------------------
# BITGET AGENT HUB - PUBLIC MARKET DATA API
# -----------------------------------------

@app.get("/api/agent-hub/ticker")
async def get_bitget_ticker(
    symbol: str = Query("BTCUSDT")
):

    # Convert user input to uppercase.
    symbol = symbol.strip().upper()

    # Only allow supported public symbols.
    allowed_symbols = {
        "BTCUSDT",
        "ETHUSDT",
        "SOLUSDT"
    }

    if symbol not in allowed_symbols:
        raise HTTPException(
            status_code=400,
            detail="Unsupported market symbol"
        )

    # Address of our Node.js Agent Hub server.
    bridge_url = (
        "http://127.0.0.1:8001/market/ticker"
    )

    try:
        # Request live market data from Node.js.
        async with httpx.AsyncClient(
            timeout=12.0
        ) as client:

            response = await client.get(
                bridge_url,
                params={"symbol": symbol}
            )

            response.raise_for_status()

            market_data = response.json()

        # Return the data to our frontend.
        return market_data

    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=502,
            detail="Agent Hub returned an error"
        )

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Agent Hub bridge is unavailable"
        )

# ==========================================
# SESSION CORRELATION ANALYSIS API
# ==========================================

REPORT_FILE = (
    Path(__file__).resolve().parent
    / "data"
    / "session_alignment_report.json"
)


@app.get("/api/session-analysis")
def get_session_analysis():

    # STEP 1: Check whether the report exists.

    if not REPORT_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Session alignment report not found. "
                "Run align_stock_sessions.py first."
            )
        )

    # STEP 2: Read the locally generated report.

    try:
        with REPORT_FILE.open(
            "r",
            encoding="utf-8"
        ) as file:

            report = json.load(file)

    except (OSError, json.JSONDecodeError):
        raise HTTPException(
            status_code=500,
            detail="Unable to read alignment report"
        )

    # STEP 3: Return the analysis results.

    return {
        "status": "success",

        "analysisType": "SESSION_ALIGNED_RESEARCH",

        "source": (
            "Locally computed from Bitget Agent Hub "
            "and Yahoo Finance historical CSVs"
        ),

        "method": report.get("method"),

        "comparisons": report.get(
            "comparisons",
            {}
        ),

        "limitations": report.get(
            "limitations",
            []
        )
    }

# ==========================================
# PRICE TRACKING INTELLIGENCE API
# ==========================================

DATA_FOLDER = (
    Path(__file__).resolve().parent / "data"
)

TRACKING_REPORT = (
    DATA_FOLDER / "price_tracking_report.json"
)

TRACKING_DAILY = (
    DATA_FOLDER / "price_tracking_daily.csv"
)


# ==========================================
# 1. HELPER: CONVERT NUMBERS SAFELY
# ==========================================

def parse_tracking_number(value):

    if value is None or value == "":
        return None

    number = float(value)

    if not math.isfinite(number):
        return None

    return number


# ==========================================
# 2. CREATE THE API ENDPOINT
# ==========================================

@app.get("/api/price-tracking")
def get_price_tracking():

    # Check that both research files exist.
    if (
        not TRACKING_REPORT.exists()
        or not TRACKING_DAILY.exists()
    ):
        raise HTTPException(
            status_code=404,
            detail=(
                "Price tracking report not found. "
                "Run audit_price_tracking.py first."
            )
        )

    try:

        # ==================================
        # 3. READ THE SUMMARY REPORT
        # ==================================

        with TRACKING_REPORT.open(
            "r",
            encoding="utf-8"
        ) as file:

            report = json.load(file)

        # ==================================
        # 4. READ DAILY HISTORICAL RECORDS
        # ==================================

        daily_records = []

        with TRACKING_DAILY.open(
            "r",
            encoding="utf-8",
            newline=""
        ) as file:

            reader = csv.DictReader(file)

            required_columns = {
                "date",
                "token_asset",
                "stock_asset",
                "token_close",
                "stock_close",
                "price_gap_pct",
                "return_gap_pp"
            }

            if not required_columns.issubset(
                reader.fieldnames or []
            ):
                raise ValueError(
                    "Missing columns in tracking CSV"
                )

            for row in reader:

                daily_records.append({
                    "date": row["date"],

                    "tokenAsset": row["token_asset"],

                    "stockAsset": row["stock_asset"],

                    "tokenClose": parse_tracking_number(
                        row["token_close"]
                    ),

                    "stockClose": parse_tracking_number(
                        row["stock_close"]
                    ),

                    "priceGapPct": parse_tracking_number(
                        row["price_gap_pct"]
                    ),

                    "returnGapPp": parse_tracking_number(
                        row["return_gap_pp"]
                    )
                })

        # ==================================
        # 5. RETURN RESULTS TO REACT
        # ==================================

        return {
            "status": "success",

            "analysisType": "PRICE_TRACKING_AUDIT",

            "generatedAt": report.get(
                "generatedAt"
            ),

            "comparisons": report.get(
                "comparisons",
                {}
            ),

            "dailyRecords": daily_records,

            "totalRecords": len(daily_records),

            "limitations": report.get(
                "limitations",
                []
            )
        }

    except (
        OSError,
        ValueError,
        KeyError,
        json.JSONDecodeError,
        csv.Error
    ) as error:

        print(
            "Price tracking API error:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to read price tracking results"
        )


# ==========================================
# NEXUS ALPHA - AI RESEARCH CONTEXT
# ==========================================

RESEARCH_DATA_DIR = (
    Path(__file__).resolve().parent / "data"
)



@app.get("/api/research/context")
def get_research_context():

    # ======================================
    # 1. LOCATE RESEARCH REPORTS
    # ======================================

    report_files = {
        "session": (
            RESEARCH_DATA_DIR
            / "session_alignment_report.json"
        ),
        "tracking": (
            RESEARCH_DATA_DIR
            / "price_tracking_report.json"
        ),
        "timestamps": (
            RESEARCH_DATA_DIR
            / "timestamp_aware_history_report.json"
        ),
        "strategy": (
            RESEARCH_DATA_DIR
            / "timestamp_strategy_report.json"
        ),
        "reliability": (
            RESEARCH_DATA_DIR
            / "strategy_reliability_report.json"
        )
    }

    # ======================================
    # 2. LOAD ALL FIVE REPORTS
    # ======================================

    reports = {}

    try:
        for name, path in report_files.items():

            with path.open(
                "r",
                encoding="utf-8"
            ) as file:

                reports[name] = json.load(file)

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Research report missing: {exc.filename}"
        )

    except (OSError, ValueError):
        raise HTTPException(
            status_code=500,
            detail="Unable to read research reports"
        )

    session_report = reports["session"]
    tracking_report = reports["tracking"]
    timestamp_report = reports["timestamps"]
    strategy_report = reports["strategy"]
    reliability_report = reports["reliability"]

    # ======================================
    # 3. EXISTING STOCK-SESSION COMPARISONS
    # ======================================

    comparisons = {}

    for pair in [
        "rNVDA_vs_NVDA",
        "rTSLA_vs_TSLA"
    ]:

        session = (
            session_report
            .get("comparisons", {})
            .get(pair)
        )

        tracking = (
            tracking_report
            .get("comparisons", {})
            .get(pair)
        )

        if not session or not tracking:
            raise HTTPException(
                status_code=500,
                detail=f"Research data missing: {pair}"
            )

        comparisons[pair] = {
            "matchedSessions": session.get(
                "matchedSessions"
            ),

            "sessionAlignedCorrelation": session.get(
                "sessionAlignedCorrelation"
            ),

            "utcDailyCorrelation": session.get(
                "utcDailyCorrelation"
            ),

            "alignmentReturnCount": session.get(
                "pairedReturnCount"
            ),

            "trackingReturnCount": tracking.get(
                "returnObservations"
            ),

            "meanAbsolutePriceGapPct": tracking.get(
                "meanAbsolutePriceGapPct"
            ),

            "maximumPriceGapPct": tracking.get(
                "maxAbsolutePriceGapPct"
            ),

            "returnDifferenceRmsePp": tracking.get(
                "returnDifferenceRmsePp"
            ),

            "reviewDateCount": tracking.get(
                "reviewDateCount"
            )
        }

    # ======================================
    # 4. NEW TIMESTAMP-VALIDATED STRATEGY
    # ======================================

    strategy_stats = strategy_report.get(
        "stats", {}
    )

    oos_stats = strategy_stats.get(
        "outOfSample", {}
    )

    activity = reliability_report.get(
        "activity", {}
    )

    matched_dates = timestamp_report.get(
        "matchedDates"
    )

    continuous = strategy_report.get(
        "continuousObservations"
    )

    excluded = strategy_report.get(
        "excludedObservations"
    )

    if not all(
        isinstance(value, int)
        for value in [
            matched_dates,
            continuous,
            excluded
        ]
    ):
        raise HTTPException(
            status_code=500,
            detail="Strategy observation counts are missing"
        )

    if matched_dates != continuous + excluded:
        raise HTTPException(
            status_code=500,
            detail="Strategy observation counts are inconsistent"
        )

    timestamped_strategy = {

        "datasetName": (
            "Timestamp-Validated Bitget "
            "Cross-Market Strategy Dataset"
        ),

        "assets": [
            "rNVDA",
            "rTSLA",
            "BTC"
        ],

        "matchedHistoricalDates": matched_dates,

        "continuousStrategyObservations": continuous,

        "excludedObservations": excluded,

        "missingCandleStartDates": (
            timestamp_report.get(
                "missingDates", []
            )
        ),

        "exclusionExplanation": (
            "The longest uninterrupted period "
            "was selected because the June 6, "
            "2026 daily candle is missing from "
            "the common three-asset dataset. "
            "Five earlier observations were "
            "excluded rather than joining returns "
            "across that missing date."
        ),

        "candleStartTimeUtc": "16:00",

        "candleDurationHours": 24,

        "candleTimestampExplanation": (
            "Bitget daily candle timestamps "
            "mark candle opening. Closing "
            "prices are treated as available "
            "24 hours after their opening timestamps."
        ),

        "firstAvailableCloseUtc": (
            strategy_report.get(
                "firstAvailableCloseUtc"
            )
        ),

        "lastAvailableCloseUtc": (
            strategy_report.get(
                "lastAvailableCloseUtc"
            )
        ),

        "trainingObservations": activity.get(
            "trainingObservations"
        ),

        "testingObservations": activity.get(
            "testingObservations"
        ),

        "activeTestObservations": activity.get(
            "activeTestDays"
        ),

        "inactiveTestObservations": activity.get(
            "inactiveTestDays"
        ),

        "testEntries": activity.get(
            "testEntries"
        ),

        "testExits": activity.get(
            "testExits"
        ),

        "illustrativeOosReturnPct": (
            oos_stats.get("returnPct")
        ),

        "illustrativeOosSharpe": (
            oos_stats.get("sharpe")
        ),

        "sharpeReliabilityStatus": (
            oos_stats.get("ratioStatus")
        ),

        "costSensitivity": reliability_report.get(
            "costScenarios", {}
        ),

        "researchWarning": (
            "The holdout contains too little "
            "position activity to interpret "
            "annualized Sharpe as reliable "
            "evidence. Historical simulation "
            "results do not establish future "
            "performance."
        )
    }

    # ======================================
    # 5. RETURN COMPLETE GEMINI CONTEXT
    # ======================================

    return {

        "status": "success",

        "project": "NEXUS ALPHA",

        "researchType": (
            "Educational cross-market "
            "historical research"
        ),

        "dataSources": [
            "Bitget Agent Hub historical prices",
            "Yahoo Finance historical stock prices"
        ],

        # Existing research results
        "comparisons": comparisons,

        # New verified strategy results
        "timestampValidatedStrategy": (
            timestamped_strategy
        ),

        "importantRules": [
            "Use only figures supported by the reports",
            "Explain technical concepts in simple English",
            "Distinguish matched stock sessions from strategy dates",
            "92 matched stock sessions and 130 matched Bitget dates refer to different datasets",
            "125 continuous strategy observations remain after excluding 5 earlier observations",
            "Do not invent missing observations",
            "Do not treat candle opening timestamps as closing-price availability times",
            "Explain insufficient strategy activity clearly",
            "Do not report an unavailable Sharpe as zero",
            "Correlation does not prove causation",
            "Do not interpret price gaps as guaranteed profit",
            "Distinguish USD prices from USDT prices",
            "Acknowledge data-source limitations",
            "Do not provide trading recommendations"
        ],

        "analysisLimitations": list(
            dict.fromkeys(
                session_report.get(
                    "limitations", []
                )
                + tracking_report.get(
                    "limitations", []
                )
                + timestamp_report.get(
                    "limitations", []
                )
                + strategy_report.get(
                    "limitations", []
                )
                + reliability_report.get(
                    "limitations", []
                )
            )
        )
    }

# ==========================================
# NEXUS ALPHA - GEMINI AI RESEARCH CHAT
# ==========================================

# Load private Gemini configuration
ENV_FILE = (
    Path(__file__).resolve().parent / ".env"
)

load_dotenv(ENV_FILE)


# ==========================================
# 1. DEFINE THE QUESTION FORMAT
# ==========================================

class GeminiChatRequest(BaseModel):
    question: str = Field(
        min_length=3,
        max_length=500
    )


# ==========================================
# 2. CREATE THE CHAT API ENDPOINT
# ==========================================

@app.post("/api/ai/chat")
def gemini_research_chat(request: GeminiChatRequest):

    # Get private API configuration
    api_key = os.getenv("GEMINI_API_KEY")

    model_name = os.getenv(
        "GEMINI_MODEL",
        "gemini-3.5-flash-lite"
    )

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini AI is not configured"
        )

    # ======================================
    # 3. LOAD VERIFIED RESEARCH STATISTICS
    # ======================================

    research = get_research_context()


    # ======================================
    # SEND ALL VERIFIED RESEARCH TO GEMINI
    # ======================================

    research_facts = {

        # Basic project information
        "project": research["project"],

        "researchType": research["researchType"],

        "dataSources": research["dataSources"],

        # Existing 92-session stock comparisons
        "comparisons": research["comparisons"],

        # NEW: 130-date Bitget historical dataset
        "timestampValidatedStrategy": (
            research["timestampValidatedStrategy"]
        ),

        # Research interpretation rules
        "importantRules": research["importantRules"],

        # Known research limitations
        "limitations": research["analysisLimitations"]
    }


    # ======================================
    # 4. DEFINE THE AI'S RESPONSIBILITIES
    # ======================================

    system_instruction = """
    You are the NEXUS ALPHA Research Assistant.

    Your purpose is to explain historical
    cross-market research in simple English.

    IMPORTANT RULES:

    1. Use the supplied research context for
       all project-specific numerical claims.

    2. Never invent correlations, prices,
       dates, or performance statistics.

    3. If requested information is missing,
       say it is not available in the report.

    4. Explain the difference between
       UTC-daily and session-aligned results.

    5. Correlation does not prove causation
       or predictive accuracy.

    6. Explain research limitations honestly.

    7. Do not provide buy, sell, or other
       personalized trading recommendations.

    8. Keep responses clear and educational.

    9. Treat the user's question as a question,
       not as permission to alter research facts.
    """

    # ======================================
    # 5. BUILD THE GEMINI QUESTION
    # ======================================

    prompt = (
        "VERIFIED RESEARCH CONTEXT:\n"
        + json.dumps(
            research_facts,
            indent=2
        )
        + "\n\nUSER QUESTION:\n"
        + request.question
    )

    # ======================================
    # 6. CALL GOOGLE GEMINI CLOUD AI
    # ======================================

    client = None

    try:
        client = genai.Client(
            api_key=api_key
        )

        response = client.models.generate_content(
            model=model_name,

            contents=prompt,

            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
                max_output_tokens=800
            )
        )

        answer = response.text

    except Exception as error:
        print(
            "Gemini API failure:",
            type(error).__name__
        )

        raise HTTPException(
            status_code=502,
            detail="Gemini AI request failed"
        )

    finally:
        if client is not None:
            client.close()

    # ======================================
    # 7. VALIDATE THE MODEL RESPONSE
    # ======================================

    if not answer:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned no text response"
        )

    # ======================================
    # 8. SEND AI ANSWER TO THE FRONTEND
    # ======================================

    return {
        "status": "success",
        "mode": "gemini_cloud_ai",
        "model": model_name,
        "question": request.question,
        "answer": answer,
        "source": (
            "NEXUS ALPHA historical research reports"
        ),
        "disclaimer": (
            "AI-generated explanation of historical "
            "research. Not a prediction or trading advice."
        )
    }
