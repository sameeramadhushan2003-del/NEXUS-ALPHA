# Research plan — NEXUS ALPHA

## Research question
Do relationships between tokenized stock prices, related ordinary equities and crypto reference assets change materially across market regimes, and can a predeclared relationship-based signal withstand unseen historical data after transaction-cost assumptions?

## Proposed testable hypotheses
- H0: There is no stable predictive relationship in the chosen synchronized return data.
- H1: A predeclared lagged residual signal displays positive after-cost out-of-sample risk-adjusted performance in specific historical regimes.
- Dataset names, intervals, time zones and observation cutoffs must be documented prior to evaluation.

## Research protocol
1. Identify instruments (tokenized instrument and genuine cash equity must have a clear relationship, not merely similar symbols).
2. Collect timestamped historical prices from licensed, reproducible sources; document URLs, downloaded time and adjustment conventions.
3. Choose a timestamp grid where all return observations are genuinely known at signal formation; no filling future stock closes into overnight observations.
4. Freeze the rule and model parameters on a training set, then evaluate a last, untouched chronological holdout ≥30 days.
5. Cover ≥60 days total, preferably much more, with regime variety.
6. Deduct fees and slippage; estimate financing, liquidity/market impact and data gaps separately.
7. Report Sharpe, Sortino, max drawdown, turnover, trade-level win rate (future work), 30-day rolling Sharpe and IS→OOS Sharpe decay.
8. Compare with passive baseline and zero-exposure baseline.
9. Run robustness scenarios and describe limitations/negative results.
10. Export report with code version, parameter settings and data-source provenance.

## Honest MVP position
Version 0.1 is a local research prototype. Its synthetic fixtures test the correctness of the software, NOT the strategy's performance. Add genuine point-in-time market records before making empirical financial claims. Closed-market analysis requires hourly or finer data with session flags; the present version does not provide that.

## AI integration roadmap
Current 'Research Diagnostics' section uses deterministic template logic and deliberately identifies itself as NOT an LLM. Future optional model integration may summarize verified metrics, detect data-quality flags and write natural-language reports with no permission to fabricate numerical values. External account connections and live execution are out of scope.
