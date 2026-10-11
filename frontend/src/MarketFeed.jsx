
import React, { useEffect, useState } from "react";
import {
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Clock3
} from "lucide-react";

import "./MarketFeed.css";

const pairs = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits
  });
}

export default function MarketFeed() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [ticker, setTicker] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Retrieve public market data through FastAPI.
  async function loadTicker(selectedSymbol, signal) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/agent-hub/ticker?symbol=${selectedSymbol}`,
        { signal }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to fetch market data"
        );
      }

      const item = Array.isArray(result.data)
        ? result.data[0]
        : result.data;

      if (!item || !item.lastPrice) {
        throw new Error("Invalid market-data response");
      }

      setTicker(item);
      setFetchedAt(result.fetchedAt);

    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  // Retrieve data when the selected asset changes.
  useEffect(() => {
    const controller = new AbortController();

    setTicker(null);
    setFetchedAt(null);

    loadTicker(symbol, controller.signal);

    return () => controller.abort();
  }, [symbol]);

  const price = ticker ? Number(ticker.lastPrice) : null;

  const changePercent =
    ticker?.price24hPcnt != null
      ? Number(ticker.price24hPcnt) * 100
      : null;

  const positive = changePercent != null && changePercent >= 0;

  const bid = ticker ? Number(ticker.bidPrice) : null;
  const ask = ticker ? Number(ticker.askPrice) : null;

  const spread =
    Number.isFinite(bid) && Number.isFinite(ask) && ask >= bid
      ? ((ask - bid) / ((ask + bid) / 2)) * 10000
      : null;

  return (
    <section id="market-feed" className="market-terminal">

      <div className="market-terminal-header">
        <div>
          <div className="market-eyebrow">
            <Activity size={14} />
            BITGET AGENT HUB / PUBLIC MARKET DATA
          </div>
          <h2>Market Intelligence</h2>
          <p>On-demand market snapshots from Bitget.</p>
        </div>

        <div className="market-actions">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            {pairs.map((pair) => (
              <option value={pair} key={pair}>
                {pair}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadTicker(symbol)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "market-spinning" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="market-error" role="alert">
          {error}
        </div>
      )}

      {loading && !ticker && (
        <div className="market-loading">
          Loading market data...
        </div>
      )}

      {ticker && (
        <>
          <div className="market-price-area">

            <div>
              <div className="market-symbol">
                {symbol.replace("USDT", "")} / USDT
                <span>SPOT</span>
              </div>

              <div className="market-main-price">
                ${formatNumber(price)}
              </div>

              <div className={
                positive ? "market-change positive" : "market-change negative"
              }>
                {positive
                  ? <TrendingUp size={17} />
                  : <TrendingDown size={17} />
                }

                {changePercent == null
                  ? "—"
                  : `${changePercent >= 0 ? "+" : ""}${formatNumber(changePercent)}%`
                }

                <span>24h change</span>
              </div>
            </div>

            <div className="market-highlow">
              <div>
                <span>24H HIGH</span>
                <strong>{formatNumber(ticker.highPrice24h)}</strong>
              </div>

              <div>
                <span>24H LOW</span>
                <strong>{formatNumber(ticker.lowPrice24h)}</strong>
              </div>
            </div>

          </div>

          <div className="market-stats-grid">
            <div>
              <span>BEST BID</span>
              <strong>{formatNumber(ticker.bidPrice)}</strong>
            </div>

            <div>
              <span>BEST ASK</span>
              <strong>{formatNumber(ticker.askPrice)}</strong>
            </div>

            <div>
              <span>SPREAD</span>
              <strong>
                {spread == null
                  ? "—"
                  : `${formatNumber(spread)} bps`
                }
              </strong>
            </div>

            <div>
              <span>24H VOLUME</span>
              <strong>{formatNumber(ticker.volume24h)} </strong>
            </div>

            <div>
              <span>24H TURNOVER (USDT)</span>
              <strong>{formatNumber(ticker.turnover24h)}</strong>
            </div>
          </div>
        </>
      )}

      <div className="market-terminal-footer">
        <span>
          <ShieldCheck size={14} />
          READ-ONLY / NO TRADING
        </span>

        <span>
          <Clock3 size={14} />
          {fetchedAt
            ? `Fetched: ${new Date(fetchedAt).toLocaleTimeString()}`
            : "Awaiting data"}
        </span>
      </div>

      <p className="market-data-note">
        Public spot quotes. These snapshots are not used as
        historical backtesting data.
      </p>

    </section>
  );
}
