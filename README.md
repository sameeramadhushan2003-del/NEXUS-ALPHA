# NEXUS ALPHA — Cross-Market Intelligence Lab

A full-stack **read-only educational research prototype** for the Cross-Market Correlation Strategies theme. Dark terminal UI, rolling correlation, return heatmap, evidence-grounded diagnostics, historical strategy simulation, and chronological holdout evaluation.

> **CRITICAL:** The included dataset is wholly synthetic. No charts, returns or Sharpe ratios produced from it demonstrate real market performance. The app is not connected to an exchange, has no trading permissions, and does not place orders.

## Quick start — Windows 10/11, VS Code

### Terminal A — Python backend

Open a terminal in `NEXUS_ALPHA/backend` and run:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python generate_demo.py
uvicorn main:app --reload --port 8000
```

If PowerShell blocks activation, use this **without activation** instead:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe generate_demo.py
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Health check: http://127.0.0.1:8000/api/health

### Terminal B — React dashboard

Open a second terminal in `NEXUS_ALPHA/frontend` and run:

```powershell
npm install
npm run dev
```

Visit: http://127.0.0.1:5173

Do not open `index.html` directly; both development servers should run.

## What works

- Responsive financial-terminal dashboard with four KPI cards
- Comparative 100-point indexed close charts
- Rolling correlation and cross-asset Pearson matrix
- Configurable historical long-only signal demonstration
- Lagged signal formation to avoid using same-bar future returns
- Fee and slippage assumptions (basis points)
- Train / test split with at least 30 test observations
- In/out-of-sample Sharpe, Sortino, drawdown, returns, positive active-session day rate, volatility and average turnover
- Repeatable metrics from locally stored data
- Historical CSV upload, template and reset to synthetic data
- JSON report download
- Four automated Python engine tests

## Limitations — must be resolved before genuine quantitative claims

- **Synthetic sample is not historical evidence.** Import independently sourced, verifiable real history for real evaluation.
- Daily matched samples do not capture **weekend**, **pre-market** or **closed-cash-session** correlation shifts; intraday event-time alignment is future work.
- The demo rule is a deliberately simple historical learning experiment, not a validated profitable edge.
- Correlation is not causation. The demonstration computes rolling Pearson correlation between returns, not price levels.
- The data parser normalizes dates in UTC. Real sources must first be adjusted for consistent sampling cutoffs, instrument identity, corporate actions, price and currency conventions.
- No hyperparameter optimization. If you adjust settings after inspecting the holdout window, it is no longer an untouched out-of-sample test.
- Actual financing, borrow fees, funding costs, spread impact, liquidity limits, dividend treatment and capacity analysis not yet implemented.
- The research diagnostics currently use deterministic rules. A live LLM service is **not integrated**; this should be stated truthfully in any report.

## CSV schema

Long format, one row per day and asset:

```csv
date,asset,close
2026-01-02,rNVDA,100.25
2026-01-02,BTC,80000.00
2026-01-05,rNVDA,101.10
2026-01-05,BTC,81000.00
```

For a meaningful experiment use at least ~100 matched dates (preferably substantially more), plus contemporaneous prices, clear provenance, and appropriate currency/time-zone adjustment.

## Strategy demonstration specification

For asset A and reference B, calculate daily percentage returns, rolling correlation rho(A,B), beta(A,B), and residual return e(t)=rA(t)-beta(t)*rB(t). Compute the rolling z-score of residual e(t). If rho > 0.15 and z < -threshold at the close of day t, flag a **simulated long-only position for the next session**. Subtract fee and slippage when the simulated position changes. Compare to a passive same-asset baseline.

This is a **toy rule**, deliberately disclosed. The output is educational, not investment guidance.

## Re-run tests

```powershell
cd backend
pytest -q
```

## Folder structure

```
NEXUS_ALPHA/
  backend/
    main.py                  # FastAPI app, upload, dashboard
    engine.py                # metrics + backtest calculations
    generate_demo.py         # fixed-seed synthetic data generator
    data/demo_prices.csv     # synthetic (NOT genuine historical data)
    tests/test_engine.py     # automated tests
    requirements.txt
  frontend/
    src/App.jsx              # React dashboard and controls
    src/styles.css           # exchange-terminal inspired theme
    src/main.jsx
    index.html
    vite.config.js
    package.json
  docs/
    RESEARCH_PLAN.md
    EVIDENCE_CHECKLIST.md
```

## Research ethics

No trading accounts, exchange accounts or financial credentials required. No orders are placed. Use only appropriately licensed, non-personal historical market data. Do not submit synthetic backtests as if they were real validation.
