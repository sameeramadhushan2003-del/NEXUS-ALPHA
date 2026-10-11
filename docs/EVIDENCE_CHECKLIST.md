# Evidence and product-completeness checklist

- [x] Runnable Python research engine
- [x] Exportable JSON report
- [x] React UI + polished responsive graphics
- [x] Configurable rolling Pearson correlation on RETURNS
- [x] Cross-asset correlation heatmap
- [x] Chronological train/test separation
- [x] One-bar delayed simulation signals
- [x] Transaction fee and slippage assumptions
- [x] Sharpe, Sortino, max drawdown, turnover, positive active-session day rate, volatility
- [x] Passive baseline and recent activity log
- [x] Synthetic demonstration clearly marked
- [x] Source CSV upload with schema checks
- [x] Unit tests
- [ ] Genuine independently verifiable price history
- [ ] Source-provenance ledger and SHA-256 dataset digest
- [ ] Intraday time alignment and market-session classification
- [ ] Native stock vs token comparison at aligned times
- [ ] Full costs (funding, market impact, etc.) and realistic fill model
- [ ] Baseline significance / block-bootstrap intervals
- [ ] Freeze parameters before the first untouched holdout run
- [ ] Walk-forward validation and OOS 30-day rolling Sharpe charts
- [ ] Optional LLM analysis bounded to observed facts
- [ ] User acceptance and accessibility tests
- [ ] Deployment (no synthetic results mistaken for evidence)

## Note
The 60-day/30-day requirement in a hackathon does not mean one day of simulated data can be falsely described as 60 or 30 days of genuine market history. The requirement is about the period covered by **real validation records**.
