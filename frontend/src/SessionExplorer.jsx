
import React, { useEffect, useState } from "react";

import {
  Activity,
  Clock3,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import "./SessionExplorer.css";


// ==========================================
// 1. AVAILABLE STOCK COMPARISONS
// ==========================================

const PAIRS = [
  {
    key: "rNVDA_vs_NVDA",
    label: "rNVDA vs NVDA"
  },
  {
    key: "rTSLA_vs_TSLA",
    label: "rTSLA vs TSLA"
  }
];


// ==========================================
// 2. FORMAT CORRELATION VALUES
// ==========================================

function formatCorrelation(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toFixed(4);
}


// ==========================================
// 3. MAIN REACT COMPONENT
// ==========================================

export default function SessionExplorer() {
  const [report, setReport] = useState(null);

  const [selectedPair, setSelectedPair] = useState(
    "rNVDA_vs_NVDA"
  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [refreshCount, setRefreshCount] = useState(0);


  // ========================================
  // 4. FETCH SESSION ANALYSIS FROM FASTAPI
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadAnalysis() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/session-analysis",
          {
            signal: controller.signal
          }
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json.detail || "Unable to load analysis"
          );
        }

        if (!json.comparisons) {
          throw new Error("Invalid analysis response");
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

    loadAnalysis();

    return () => controller.abort();

  }, [refreshCount]);


  // ========================================
  // 5. SELECT THE CURRENT COMPARISON
  // ========================================

  const comparison = report?.comparisons?.[selectedPair];

  const daily = comparison?.utcDailyCorrelation;

  const aligned = comparison?.sessionAlignedCorrelation;


  // ========================================
  // 6. PREPARE CHART DATA
  // ========================================

  const chartData = [
    {
      method: "UTC Daily",
      correlation: daily
    },
    {
      method: "Session Aligned",
      correlation: aligned
    }
  ].filter((row) => {
    return (
      typeof row.correlation === "number" &&
      Number.isFinite(row.correlation)
    );
  });


  // ========================================
  // 7. RENDER THE DASHBOARD PANEL
  // ========================================

  return (
    <section
      id="session-explorer"
      className="session-explorer"
    >

      {/* HEADER */}

      <div className="session-header">
        <div>
          <div className="session-eyebrow">
            <Activity size={15} />
            SESSION INTELLIGENCE
          </div>

          <h2>Session Correlation Explorer</h2>

          <p>
            Compare UTC daily prices against
            NYSE closing-time-aligned observations.
          </p>
        </div>

        <div className="session-actions">
          <select
            value={selectedPair}
            onChange={(event) => {
              setSelectedPair(event.target.value);
            }}
            aria-label="Choose asset comparison"
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
            disabled={loading}
            onClick={() => {
              setRefreshCount((count) => count + 1);
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>


      {/* LOADING AND ERROR MESSAGES */}

      {loading && !report && (
        <p className="session-message">
          Loading session analysis...
        </p>
      )}

      {error && (
        <p className="session-error" role="alert">
          {error}
        </p>
      )}


      {/* CORRELATION RESULTS */}

      {comparison && (
        <>

          <div className="session-stat-grid">

            <div className="session-stat">
              <span>UTC DAILY CORRELATION</span>

              <strong>
                {formatCorrelation(daily)}
              </strong>

              <small>
                Midnight-UTC candle comparison
              </small>
            </div>

            <div className="session-stat highlight">
              <span>SESSION-ALIGNED CORRELATION</span>

              <strong>
                {formatCorrelation(aligned)}
              </strong>

              <small>
                Matched to regular NYSE close
              </small>
            </div>

            <div className="session-stat">
              <span>MATCHED SESSIONS</span>

              <strong>
                {comparison.matchedSessions ?? "—"}
              </strong>

              <small>
                Matching timestamps
              </small>
            </div>

            <div className="session-stat">
              <span>COMPARABLE RETURNS</span>

              <strong>
                {comparison.pairedReturnCount ?? "—"}
              </strong>

              <small>
                Observations used in correlations
              </small>
            </div>

          </div>


          {/* COMPARISON CHART */}

          <div className="session-chart-card">

            <h3>Historical Correlation Comparison</h3>

            <p>
              Pearson correlation of daily returns.
              Scale: -1 to +1.
            </p>

            <div className="session-chart-area">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={chartData}
                  margin={{
                    top: 15,
                    right: 15,
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
                    dataKey="method"
                    stroke="#96a5c0"
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    domain={[-1, 1]}
                    ticks={[-1, -0.5, 0, 0.5, 1]}
                    stroke="#96a5c0"
                    tickLine={false}
                    axisLine={false}
                  />

                  <ReferenceLine
                    y={0}
                    stroke="#7888a3"
                  />

                  <Tooltip
                    formatter={(value) => [
                      formatCorrelation(value),
                      "Pearson correlation"
                    ]}
                  />

                  <Bar
                    dataKey="correlation"
                    radius={[7, 7, 0, 0]}
                    maxBarSize={100}
                  >
                    {chartData.map((item, index) => (
                      <Cell
                        key={item.method}
                        fill={
                          index === 0
                            ? "#a68aff"
                            : "#5ce4ce"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>


          {/* DATA QUALITY */}

          <div className="session-quality">

            <div>
              <ShieldCheck size={18} />
              <span>
                Missing token dates:{" "}
                <strong>
                  {comparison.missingTokenDates?.length ?? "—"}
                </strong>
              </span>
            </div>

            <div>
              <Clock3 size={18} />
              <span>
                Timestamp mismatches:{" "}
                <strong>
                  {comparison.timestampMismatches?.length ?? "—"}
                </strong>
              </span>
            </div>

          </div>

        </>
      )}


      {/* RESEARCH LIMITATIONS */}

      {report && (
        <div className="session-disclaimer">

          <strong>Research limitations</strong>

          <ul>
            {(report.limitations ?? []).map(
              (item, index) => (
                <li key={index}>
                  {item}
                </li>
              )
            )}
          </ul>

          <p>
            Historical relationships are descriptive,
            not predictions. No real orders are executed.
          </p>

        </div>
      )}

    </section>
  );
}
