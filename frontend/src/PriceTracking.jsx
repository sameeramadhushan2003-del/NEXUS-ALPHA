
import React, { useEffect, useMemo, useState } from "react";

import {
  Activity,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import "./PriceTracking.css";


// ==========================================
// 1. AVAILABLE COMPARISONS
// ==========================================

const PAIRS = [
  {
    key: "rNVDA_vs_NVDA",
    token: "rNVDA",
    label: "rNVDA vs NVIDIA"
  },
  {
    key: "rTSLA_vs_TSLA",
    token: "rTSLA",
    label: "rTSLA vs Tesla"
  }
];


// ==========================================
// 2. NUMBER FORMATTING
// ==========================================

function formatNumber(value, decimals = 4) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toFixed(decimals);
}


// ==========================================
// 3. MAIN COMPONENT
// ==========================================

export default function PriceTracking() {
  const [report, setReport] = useState(null);

  const [selectedPair, setSelectedPair] = useState(
    "rNVDA_vs_NVDA"
  );

  const [chartMode, setChartMode] = useState(
    "priceGapPct"
  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [refreshCount, setRefreshCount] = useState(0);


  // ========================================
  // 4. FETCH DATA FROM FASTAPI
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadTrackingData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/price-tracking",
          {
            signal: controller.signal
          }
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json.detail || "Unable to load tracking data"
          );
        }

        if (
          !json.comparisons ||
          !Array.isArray(json.dailyRecords)
        ) {
          throw new Error(
            "Unexpected price tracking API response"
          );
        }

        setReport(json);

      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }

      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadTrackingData();

    return () => controller.abort();

  }, [refreshCount]);


  // ========================================
  // 5. FIND SELECTED ASSET
  // ========================================

  const selected = PAIRS.find(
    (pair) => pair.key === selectedPair
  );

  const metrics = report?.comparisons?.[
    selectedPair
  ];


  // ========================================
  // 6. FILTER HISTORICAL RECORDS
  // ========================================

  const chartData = useMemo(() => {
    if (!report?.dailyRecords || !selected) {
      return [];
    }

    return report.dailyRecords
      .filter((row) => {
        return row.tokenAsset === selected.token;
      })
      .sort((a, b) => {
        return a.date.localeCompare(b.date);
      })
      .map((row) => ({
        date: row.date,
        priceGapPct: row.priceGapPct,
        returnGapPp: row.returnGapPp
      }));

  }, [report, selectedPair]);


  // ========================================
  // 7. CONFIGURE THE CHART
  // ========================================

  const isPriceGap = chartMode === "priceGapPct";

  const chartTitle = isPriceGap
    ? "Historical Price Gap"
    : "Daily Return Difference";

  const chartUnit = isPriceGap
    ? "%"
    : "percentage points";


  // ========================================
  // 8. RENDER COMPONENT
  // ========================================

  return (
    <section
      id="price-tracking"
      className="pt-container"
    >

      {/* HEADER */}

      <div className="pt-header">

        <div>
          <div className="pt-eyebrow">
            <Activity size={15} />
            CROSS-MARKET RESEARCH
          </div>

          <h2>Price Tracking Intelligence</h2>

          <p>
            Explore historical stock-linked token
            prices aligned to NYSE sessions.
          </p>
        </div>

        <div className="pt-controls">

          <select
            value={selectedPair}
            onChange={(event) => {
              setSelectedPair(event.target.value);
            }}
            aria-label="Select stock comparison"
          >
            {PAIRS.map((pair) => (
              <option
                key={pair.key}
                value={pair.key}
              >
                {pair.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setRefreshCount((value) => value + 1);
            }}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Refresh
          </button>

        </div>

      </div>


      {/* LOADING AND ERRORS */}

      {loading && !report && (
        <p className="pt-message">
          Loading historical tracking data...
        </p>
      )}

      {error && (
        <p className="pt-error" role="alert">
          {error}
        </p>
      )}


      {/* SUMMARY CARDS */}

      {metrics && (
        <>

          <div className="pt-stats">

            <div className="pt-stat">
              <span>RETURN CORRELATION</span>

              <strong>
                {formatNumber(
                  metrics.returnCorrelation,
                  6
                )}
              </strong>

              <small>Session-aligned returns</small>
            </div>

            <div className="pt-stat pt-featured">
              <span>MEAN ABSOLUTE PRICE GAP</span>

              <strong>
                {formatNumber(
                  metrics.meanAbsolutePriceGapPct
                )}%
              </strong>

              <small>Historical average</small>
            </div>

            <div className="pt-stat">
              <span>MAXIMUM PRICE GAP</span>

              <strong>
                {formatNumber(
                  metrics.maxAbsolutePriceGapPct
                )}%
              </strong>

              <small>
                {metrics.maxGapDate || "No date"}
              </small>
            </div>

            <div className="pt-stat">
              <span>RETURN DIFFERENCE RMSE</span>

              <strong>
                {formatNumber(
                  metrics.returnDifferenceRmsePp
                )}
              </strong>

              <small>Percentage points</small>
            </div>

          </div>


          {/* HISTORICAL CHART */}

          <div className="pt-chart-card">

            <div className="pt-chart-header">

              <div>
                <h3>{chartTitle}</h3>

                <p>
                  {selected.label} ·
                  {" "}{chartData.length} matched dates
                </p>
              </div>

              <div className="pt-chart-switch">

                <button
                  type="button"
                  className={
                    isPriceGap ? "active" : ""
                  }
                  aria-pressed={isPriceGap}
                  onClick={() => {
                    setChartMode("priceGapPct");
                  }}
                >
                  Price Gap
                </button>

                <button
                  type="button"
                  className={
                    !isPriceGap ? "active" : ""
                  }
                  aria-pressed={!isPriceGap}
                  onClick={() => {
                    setChartMode("returnGapPp");
                  }}
                >
                  Return Difference
                </button>

              </div>

            </div>


            <div className="pt-chart">

              {chartData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 15,
                      right: 20,
                      bottom: 5,
                      left: 0
                    }}
                  >

                    <CartesianGrid
                      stroke="#29354d"
                      strokeDasharray="3 5"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="date"
                      stroke="#93a4c0"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={30}
                      tickFormatter={(date) => {
                        return date.slice(5);
                      }}
                    />

                    <YAxis
                      stroke="#93a4c0"
                      tickLine={false}
                      axisLine={false}
                      width={65}
                      domain={["auto", "auto"]}
                      tickFormatter={(value) => {
                        return Number(value).toFixed(3);
                      }}
                    />

                    <Tooltip
                      formatter={(value) => [
                        `${formatNumber(value)} ${chartUnit}`,
                        chartTitle
                      ]}
                      labelFormatter={(date) => {
                        return `Date: ${date}`;
                      }}
                    />

                    <ReferenceLine
                      y={0}
                      stroke="#667a98"
                      strokeDasharray="4 4"
                    />

                    <Line
                      type="monotone"
                      dataKey={chartMode}
                      stroke="#5ce4ce"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />

                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="pt-message">
                  No historical observations available.
                </p>
              )}

            </div>

          </div>


          {/* DATA QUALITY SUMMARY */}

          <div className="pt-quality">

            <div className="pt-quality-item">
              <ShieldCheck size={18} />

              <div>
                <span>Matched sessions</span>
                <strong>
                  {metrics.matchedSessions}
                </strong>
              </div>
            </div>

            <div className="pt-quality-item">
              <Activity size={18} />

              <div>
                <span>Return observations</span>
                <strong>
                  {metrics.returnObservations}
                </strong>
              </div>
            </div>

            <div className="pt-quality-item">
              <ShieldCheck size={18} />

              <div>
                <span>
                  Price gaps above{" "}
                  {metrics.reviewThresholdPct}%
                </span>
                <strong>
                  {metrics.reviewDateCount}
                </strong>
              </div>
            </div>

          </div>

        </>
      )}


      {/* RESEARCH LIMITATIONS */}

      {report && (
        <div className="pt-notes">

          <h4>Research Notes & Limitations</h4>

          <ul>
            {(report.limitations || []).map(
              (item, index) => (
                <li key={index}>
                  {item}
                </li>
              )
            )}
          </ul>

          <p>
            Historical descriptive analysis only.
            This panel does not generate trade
            recommendations or execute orders.
          </p>

        </div>
      )}

    </section>
  );
}
