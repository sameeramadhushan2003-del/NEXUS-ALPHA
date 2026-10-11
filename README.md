# NEXUS ALPHA — Cross-Market Intelligence Lab

**A read-only educational research dashboard for exploring relationships between tokenized stocks, conventional equities, and cryptocurrency market data.**

NEXUS ALPHA combines a React research terminal, a FastAPI analytics backend, a Bitget Agent Hub read-only market-data bridge, and a Gemini-powered research assistant. It supports timestamp-aware historical analysis, session-aligned stock comparisons, CSV imports, and reproducible *simulated* strategy experiments.

> **Research-only project.** NEXUS ALPHA does not place orders or connect to trading accounts. Historical correlations and simulations are not predictions, investment advice, or evidence of a profitable strategy. The synthetic demonstration dataset must not be presented as genuine historical evidence.

## Why NEXUS ALPHA?

Cross-market comparisons can be misleading if two prices are sampled at different times. For example, a tokenized stock may update while its conventional stock market is closed. NEXUS ALPHA makes **data provenance, sampling timestamps, and research limitations** visible alongside charts and statistical results.

## Features

- **Research dashboard:** Indexed price comparisons, rolling Pearson correlations, asset correlation matrix, performance summaries, and visual exploration.
- **Live public market feed:** BTC, ETH, and SOL spot tickers obtained via a local read-only Bitget Agent Hub bridge.
- **Session Explorer:** Historical comparisons of `rNVDA` with `NVDA`, and `rTSLA` with `TSLA`, using stock-session-aligned data. These are separate from the three-asset strategy dataset.
- **Price Tracking Intelligence:** Price-gap and return-alignment diagnostics for tokenized and conventional shares, with data-source caveats.
- **Timestamp-validated historical dataset:** Matched Bitget `rNVDA`, `rTSLA`, and `BTC` daily candles indexed by when each candle's close became available.
- **Historical Strategy Lab:** Adjustable lookback, signal threshold, holdout length, fee, and slippage assumptions, with explicit train/test separation.
- **Research reliability checks:** Reports active test observations, position changes, and suppresses unsupported Sharpe/Sortino interpretations when activity is insufficient.
- **Gemini Research Assistant:** Explains the locally supplied research reports in approachable language; uses report-derived context and acknowledges unavailable information.
- **CSV upload and report export:** Analyze a user-supplied long-format price CSV or the included synthetic demonstration; uploaded-source provenance is explicitly unverified.
- **Automated Python tests:** 12 locally verified passing tests covering the core engine and timestamp/reliability functionality.

## Technology stack

| Layer | Technologies | Purpose |
|---|---|---|
| Frontend | React, Vite, Recharts, Lucide | Dashboard and interactive research controls |
| Research API | Python, FastAPI, Pandas, NumPy | Validation, statistics, historical simulation, AI endpoint |
| Market-data bridge | Node.js, Bitget Agent SDK | Read-only public spot ticker requests |
| AI assistant | Google Gemini (`google-genai`) | Natural-language explanations of provided research context |
| Testing | Pytest | Backend regression tests |

## System architecture

```text
Browser / React + Vite (http://127.0.0.1:5173)
          |
          | /api requests via Vite proxy
          v
FastAPI research backend (http://127.0.0.1:8000)
   |            |                |
   |            |                +--> Gemini API (optional, requires GEMINI_API_KEY)
   |            +--> Local historical CSV files and generated JSON reports
   |
   +--> Read-only Agent Hub bridge (http://127.0.0.1:8001)
                |
                +--> Bitget public market data
```

All three local services should be running to use the complete research dashboard and live market feed. The Gemini assistant additionally requires an API key.

## Quick start — Windows / PowerShell

**Requirements:** Python with `venv`, Node.js with npm, Git, and three VS Code terminals. Run each terminal's commands from the indicated project subfolder.

### Terminal 1 — Bitget Agent Hub bridge

```powershell
cd agent-bridge
npm install
node server.mjs
```

Health check: <http://127.0.0.1:8001/health>

### Terminal 2 — FastAPI backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

If the virtual environment has already been created, skip `py -m venv .venv`. Health check: <http://127.0.0.1:8000/api/health>

**Optional: Enable Gemini.** Create `backend/.env` locally and set:

```dotenv
GEMINI_API_KEY=your_own_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

The model name must be one available to your Gemini API account. **Never commit `.env` or paste your API key into the README or source code.** Without a configured API key, the analytics dashboard can still run, but the AI chat endpoint will be unavailable.

### Terminal 3 — React frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Do not open `index.html` directly. Vite proxies frontend `/api` requests to FastAPI on port 8000.

> Tip: In three separate VS Code terminals, `cd` into `agent-bridge`, `backend`, and `frontend`, respectively. Do not run all three `cd` commands in the same terminal.

## Data sources and research modes

| Mode | Data | Interpretation |
|---|---|---|
| **Verified Bitget History** | Timestamp-checked historical daily data for `rNVDA`, `rTSLA`, `BTC` | Bitget-source historical analysis; *not independently verified market truth or predictive validation* |
| **Uploaded CSV** | User-provided `date,asset,close` observations | Source, timestamps, asset identity, and sampling must be independently checked |
| **Synthetic Demo** | Generated example observations | Software demonstrations only; not real historical evidence |

**Separate dataset:** Session Explorer and Price Tracking compare tokenized and conventional stock observations over **92 matched stock sessions**. This is *not* the same population as the **130 matched Bitget historical dates** used for the strategy dataset.

### Timestamp-validated strategy dataset

- **130** matched dates for `rNVDA`, `rTSLA`, and `BTC`.
- **125** consecutive usable observations in the longest uninterrupted segment.
- **5** earlier observations excluded to avoid calculating across the missing daily candle that starts on **June 6, 2026**.
- Bitget's observed 1-day candle boundaries start at **16:00 UTC**; a daily close is treated as available **24 hours after its candle start**.
- Default illustration: **80 training observations** followed chronologically by **45 testing observations**, with the test period beginning at the **August 27, 2026** close.

### A crucial reliability finding

For the default `rNVDA`-versus-`BTC` historical simulation, the 45-observation test window included **only one active strategy observation**, one entry, and no exit. Reported illustrative out-of-sample returns vary with assumed costs (e.g., **0.36%** for 13 basis points total assumed fee/slippage), but **the annualized Sharpe ratio is intentionally unavailable** because there is too little activity for meaningful interpretation. These are not realized trading results. An open position may also mean eventual exit costs are not represented.

## CSV upload format

Use one observation per asset and date, with these exact column names:

```csv
date,asset,close
2026-01-02,rNVDA,100.25
2026-01-02,BTC,80000.00
2026-01-03,rNVDA,101.10
2026-01-03,BTC,81000.00
```

The backend requires at least **two assets**, **100 dates**, positive numeric closing prices, valid dates, and no duplicate date/asset pairs. Files larger than **5 MB** are rejected. Uploaded prices are **source-unverified** and can replace an earlier imported CSV; back up any important import before testing a new upload.

## Useful endpoints

| URL | Purpose |
|---|---|
| `/api/health` | FastAPI health status |
| `/api/dashboard?dataset=verified` | Timestamp-validated historical research output |
| `/api/dashboard?dataset=active` | Uploaded prices, or synthetic demo if no upload exists |
| `/api/research/context` | Research reports and contextual facts supplied to Gemini |
| `/api/ai/chat` | Gemini research chat (POST, requires API key) |
| `/api/agent-hub/ticker?symbol=BTCUSDT` | Bitget public ticker through local bridge |
| `/api/session-analysis` | Stock-session correlation research |
| `/api/price-tracking` | Price-tracking report |

Endpoints listed with relative paths are served by FastAPI at `http://127.0.0.1:8000`.

## Testing

From the `backend` folder (with your virtual environment active), run:

```powershell
python -m pytest -q
```

The latest local verification returned **12 passed**. The repository configures Pytest to use `backend/tests`, so an unrelated optional `test_huggingface.py` diagnostic script is not collected by the default test command. This statement describes a local test run, not a hosted CI workflow.

For a frontend production-bundle check, run:

```powershell
cd frontend
npm run build
```

## Repository layout

```text
NEXUS_ALPHA/
  agent-bridge/                 # Bitget Agent SDK bridge, market tools, audits
    server.mjs
    data/                      # Historical source and repair reports
  backend/
    main.py                    # Research API, CSV import, Gemini endpoint
    engine.py                  # Analysis and historical simulation
    run_timestamped_strategy.py
    build_timestamped_history.py
    audit_strategy_reliability.py
    data/                      # Derived price history and research reports
    tests/                     # Automated tests
    requirements.txt
    pytest.ini
  frontend/
    src/                       # React pages and research panels
    package.json
    vite.config.js
  docs/                        # Research plans and supporting notes
  README.md
```

## Limitations and responsible interpretation

1. **No execution:** The project is read-only and does not place orders or provide a live execution system.
2. **Historical ≠ predictive:** Correlations and small-sample simulated backtests cannot establish future results.
3. **Timestamp consistency:** Incorrectly mixing 24-hour token markets with limited-hour equity sessions can produce misleading statistics.
4. **Data provenance:** Bitget-source timestamp checks do not independently certify every market value. Yahoo Finance and tokenized equity prices can have different conventions.
5. **Low strategy activity:** With only one active test observation, annualized performance ratios would be misleading and are withheld.
6. **Simplifying assumptions:** Trading friction is modeled using user-set basis points; the simulation does not capture every real-market cost, liquidity constraint, funding effect, or corporate action.
7. **AI explanations:** Gemini answers depend on the supplied local report context. Verify its claims against the underlying report rather than treating generated text as a primary source.
8. **User uploads:** User-uploaded files are not automatically independent, accurate, licensed, or comparable across timestamps/currencies.

## Project status

- Working React interface, FastAPI backend, and read-only Bitget Agent Hub bridge.
- Verified historical-data option and dataset provenance labels integrated into the dashboard.
- Gemini explanations connected to session, tracking, timestamp, and reliability reports.
- 12 backend automated tests passed locally.
- Intended as a **hackathon research demonstration**, not a production trading or investment system.

## Repository

<https://github.com/sameeramadhushan2003-del/NEXUS-ALPHA>
