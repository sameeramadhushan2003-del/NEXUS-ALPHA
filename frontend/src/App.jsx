import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Bot,
  Clock3,
  Database,
  Download,
  FileUp,
  FlaskConical,
  Github,
  Grid2X2,
  Info,
  Layers3,
  LineChart as LineIcon,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sigma,
  Terminal,
  UploadCloud,
  Waves,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MarketFeed from "./MarketFeed.jsx";
import ResearchAssistant from "./ResearchAssistant.jsx";
import SessionExplorer from "./SessionExplorer.jsx";
import PriceTracking from "./PriceTracking.jsx";

const API = "/api";
const fmt = (val, d = 2) =>
  val == null || !Number.isFinite(Number(val)) ? "—" : Number(val).toFixed(d);
const signed = (val, d = 2) =>
  val == null ? "—" : `${val >= 0 ? "+" : ""}${fmt(val, d)}`;
const shortDate = (x) => x?.slice(5) || "";
const cn = (...v) => v.filter(Boolean).join(" ");
function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <span className="brand-mark-angle">〈</span>
        <span className="brand-mark-core">◆</span>
        <span className="brand-mark-angle">〉</span>
      </div>
      <div>
        <div className="brand-name">
          NEXUS <b>ALPHA</b>
        </div>
        <div className="brand-sub">MARKET INTELLIGENCE SYSTEM</div>
      </div>
    </div>
  );
}
function SectionTitle({ kicker, title, subtitle, right, id }) {
  return (
    <div className="sectionhead" id={id}>
      <div>
        <div className="section-kicker">{kicker}</div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="section-head-right">{right}</div>}
    </div>
  );
}
function Card({ children, className = "", title, eyebrow, right }) {
  return (
    <section className={cn("panel", className)}>
      {(title || eyebrow) && (
        <div className="panel-head">
          <div>
            {eyebrow && <div className="panel-eyebrow">{eyebrow}</div>}
            {title && <h3>{title}</h3>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
function Stat({
  label,
  value,
  suffix,
  detail,
  icon: Icon,
  accent = "teal",
  isNegative,
}) {
  return (
    <div className={cn("stat-card", accent)}>
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon">{Icon && <Icon size={18} />}</div>
      </div>
      <div className="stat-value">
        {value}
        <small>{suffix}</small>
      </div>
      <div className="stat-foot">{detail}</div>
    </div>
  );
}
const tooltipStyle = {
  contentStyle: {
    background: "#111a30",
    border: "1px solid #28314b",
    borderRadius: 12,
    color: "#e7ecff",
    fontSize: 12,
    boxShadow: "0 18px 40px rgba(0,0,0,.35)",
  },
  labelStyle: { color: "#b6c0d7" },
};
function ChartEmpty() {
  return (
    <div className="empty-chart">No data available for this selection.</div>
  );
}
function heatBg(v) {
  if (v === null) return "#1b2334";
  const mag = Math.min(1, Math.abs(v));
  return v >= 0
    ? `rgba(46,213,189,${0.13 + 0.7 * mag})`
    : `rgba(248,112,134,${0.12 + 0.65 * mag})`;
}
function Insight({ data }) {
  const c = data?.stats?.lastCorr,
    z = data?.stats?.lastZ;
  const label =
    c == null
      ? "Insufficient data"
      : Math.abs(c) > 0.65
        ? "Strong historical relationship"
        : Math.abs(c) > 0.35
          ? "Moderate historical relationship"
          : "Weak historical relationship";
  const note =
    c == null
      ? "Increase overlapping history for a valid estimate."
      : c >= 0
        ? "The two return series have recently tended to move in the same direction."
        : "The two return series have recently tended to move in opposite directions.";
  return (
    <div className="insight-content">
      <div className="insight-orb">
        <BrainCircuit size={23} />
      </div>
      <div className="insight-label">
        RULE-BASED DIAGNOSTICS <span>• NOT AN LLM</span>
      </div>
      <h3>{label}</h3>
      <p>
        {note} This observation alone cannot establish causation or future
        performance.
      </p>
      <div className="insight-points">
        <div>
          <span>Last residual z-score</span>
          <b>{fmt(z)}</b>
        </div>
        <div>
          <span>OOS Sharpe deterioration flag</span>
          <b>{data?.stats?.sharpeDecayFlag ? "YES" : "NO"}</b>
        </div>
        <div>
          <span>Data quality</span>
          <b>CHECK SOURCE</b>
        </div>
      </div>
      <div className="insight-bottom">
        <ShieldCheck size={15} />
        <span>Evidence-limited. Does not recommend transactions.</span>
      </div>
    </div>
  );
}
function LabelRow({ value, label, color }) {
  return (
    <div className="legend-item">
      <span style={{ background: color }}></span>
      {label}
      {value && <b>{value}</b>}
    </div>
  );
}
function exportReport(data) {
  const bundle = {
    application: "NEXUS ALPHA",
    reportType: "LOCAL HISTORICAL RESEARCH",
    disclaimer:
      "Educational simulation only, no actual market validation claimed",
    createdAt: new Date().toISOString(),
    ...data,
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nexus-alpha-research-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function App() {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [primary, setPrimary] = useState("rNVDA");
  const [reference, setReference] = useState("BTC");
  const [lookback, setLookback] = useState(25);
  const [threshold, setThreshold] = useState(1.25);
  const [oos, setOos] = useState(45);
  const [fee, setFee] = useState(5);
  const [slippage, setSlippage] = useState(8);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [chartMode, setChartMode] = useState("NORMALIZED");
  const [sidebar, setSidebar] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const fetchDashboard = useCallback(
    async (
      p = primary,
      r = reference,
      lb = lookback,
      th = threshold,
      os = oos,
      f = fee,
      sl = slippage,
    ) => {
      setBusy(true);
      setError("");
      try {
        const qs = new URLSearchParams({
          primary: p,
          reference: r,
          lookback: lb,
          threshold: th,
          oos_days: os,
          fee_bps: f,
          slippage_bps: sl,
        });
        const res = await fetch(`${API}/dashboard?${qs}`);
        const json = await res.json();
        if (!res.ok) throw Error(json.detail || `API error ${res.status}`);
        setResult(json);
      } catch (e) {
        setError(e.message || "Connection failed");
      } finally {
        setBusy(false);
      }
    },
    [primary, reference, lookback, threshold, oos, fee, slippage],
  );
  
useEffect(() => {
  fetchDashboard(
    "rNVDA",
    "BTC",
    25,
    1.25,
    45,
    5,
    8
  );
}, []);

  const assets = result?.meta?.assets || [
    "rNVDA",
    "NVDA",
    "BTC",
    "rTSLA",
    "TSLA",
    "ETH",
  ];
  const rows = result?.chart || [];
  const dataMode = result?.meta?.dataMode || "LOADING";
  const isDemo = dataMode.includes("SYNTHETIC");
  const metrics = result?.stats || {};
  const currentCorr = metrics.lastCorr;
  const recentData = rows.slice(-150);
  const correlationLast = recentData.filter((x) => x.correlation != null);
  const heatmap = result?.heatmap;
  const settingsApply = () => fetchDashboard();
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/import`, { method: "POST", body: form });
      const obj = await res.json();
      if (!res.ok) throw Error(obj.detail || "Import rejected");
      const next = obj.assets;
      const p = next.includes("rNVDA") ? "rNVDA" : next[0];
      const r =
        next.includes("BTC") && p !== "BTC" ? "BTC" : next.find((x) => x !== p);
      setPrimary(p);
      setReference(r);
      await fetchDashboard(p, r, 25, 1.25, 45, 5, 8);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const restore = async () => {
    try {
      const res = await fetch(`${API}/use-demo`, { method: "POST" });
      if (!res.ok) throw Error("Cannot restore demo");
      setPrimary("rNVDA");
      setReference("BTC");
      await fetchDashboard("rNVDA", "BTC", 25, 1.25, 45, 5, 8);
    } catch (e) {
      setError(e.message);
    }
  };
  
const menu = [
  
  {
    name: "Overview",
    icon: Grid2X2,
    href: "#overview",
  },

  {
    name: "Live Market",
    icon: Activity,
    href: "#market-feed",
  },

  {
    name: "Correlation Explorer",
    icon: Waves,
    href: "#correlation",
  },
  {
  name: "Session Explorer",
  icon: Clock3,
  href: "#session-explorer",
},
{
  name: "Price Tracking",
  icon: Activity,
  href: "#price-tracking",
},
{
  name: "AI Research",
  icon: Bot,
  href: "#ai-research",
},

  {
    name: "Strategy Lab",
    icon: FlaskConical,
    href: "#backtesting",
  },

  {
    name: "Data Studio",
    icon: Database,
    href: "#data-studio",
  },
];

  return (
    <div className="shell">
      <aside className={cn("sidebar", sidebar && "open")}>
        <div className="sidebar-top">
          <Logo />
          <button
            className="mobile-close"
            aria-label="Close navigation"
            onClick={() => setSidebar(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="navigation">
          {menu.map(({ name, icon: Icon, href }) => (
            <a
              key={name}
              href={href}
              className={cn("nav-item", activeNav === name && "active")}
              onClick={() => {
                setActiveNav(name);
                setSidebar(false);
              }}
            >
              <Icon size={18} />
              <span>{name}</span>
              {activeNav === name && <span className="nav-active-indicator" />}
            </a>
          ))}
        </nav>
        <div className="nav-label bottom-spaced">SYSTEM</div>
        <div className="sidenav-note">
          <div className="sidebar-note-icon">
            <Sigma size={18} />
          </div>
          <b>Quant Engine v0.1</b>
          <span>Research only</span>
        </div>
        <div className="sidebar-spacer" />
        <div className="sandbox-card">
          <div className="sandbox-row">
            <span className="ping" /> DATA INTEGRITY
          </div>
          <b>Honest by design.</b>
          <p>
            Every chart and result is labeled by its dataset source. No orders
            are executed.
          </p>
        </div>
        <div className="sidebar-footer">
          <div className="avatar">NA</div>
          <div>
            <strong>Local Workspace</strong>
            <small>Research Terminal</small>
          </div>
          <span className="avatar-extra">•••</span>
        </div>
      </aside>
      <main className="main" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-mobile"
              onClick={() => setSidebar(true)}
              aria-label="Open navigation"
            >
              <Layers3 size={20} />
            </button>
            <span>WORKSPACE</span>
            <span className="slash">/</span>
            <strong>OVERVIEW</strong>
          </div>
          <div className="topbar-right">
            <span className="system-pill">
              <span /> LOCAL API
            </span>
            <span className="utc">HISTORICAL MODE</span>
            <div className="top-avatar">NA</div>
          </div>
        </header>
        <div className="content">
          <div className="hero">
            <div className="hero-left">
              <div className="mini-eyebrow">
                <span className="hero-laser" /> INTELLIGENCE TERMINAL{" "}
                <span className="hero-split">/</span> STRATEGY RESEARCH
              </div>
              <h1>
                Decode the <em>relationship.</em>
                <br />
                Discover the <span>divergence.</span>
              </h1>
              <p>
                Observe changing cross-market correlations, study historical
                regimes, and test hypotheses with transparent, reproducible
                analytics.
              </p>
              <div className="hero-actions">
                <a
                  href="#correlation"
                  className="btn primary"
                  onClick={() => setActiveNav("Correlation Explorer")}
                >
                  <LineIcon size={16} /> Explore Correlations{" "}
                  <ArrowRight size={15} />
                </a>
                <a
                  href="#backtesting"
                  className="btn subtle"
                  onClick={() => setActiveNav("Strategy Lab")}
                >
                  <FlaskConical size={16} /> Strategy Lab
                </a>
              </div>
            </div>
            <div className="hero-deco" aria-hidden="true">
              <div className="ring r1" />
              <div className="ring r2" />
              <div className="ring r3" />
              <div className="orbit-center">
                <span>N</span>
              </div>
              <span className="d1" />
              <span className="d2" />
              <span className="d3" />
            </div>
          </div>
          <div className={cn("data-alert", isDemo ? "warn" : "user-data")}>
            <div className="alert-left">
              <Info size={18} />
              <span>
                <b>{dataMode}</b> —{" "}
                {isDemo
                  ? "All prices and performance values are invented for software testing. They do not represent historical market performance."
                  : "Uploaded prices are user supplied; verify timestamps, provenance, missing observations and consistency before drawing conclusions."}
              </span>
            </div>
            <button
              onClick={() =>
                document
                  .getElementById("data-studio")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              DATA SOURCES <ArrowRight size={14} />
            </button>
          </div>
          {error && (
            <div className="error-box">
              <Info size={16} />
              <span>
                {error}. Make sure the Python API is running on port 8000.
              </span>
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <MarketFeed />
          <div className="section-toolbar">
            <div>
              <div className="tiny-label">CURRENT EXPERIMENT</div>
              <div className="experiment-name">
                <span className="exp-mark">
                  <Activity size={18} />
                </span>
                {primary} <span>vs</span> {reference}
                <span className="experiment-badge">PAIRED OBSERVATIONS</span>
              </div>
            </div>
            <div className="toolbar-actions">
              <button
                className="btn outline"
                disabled={!result}
                onClick={() => exportReport(result)}
              >
                <Download size={16} /> Export Report
              </button>
              <button
                className="btn primary small"
                onClick={settingsApply}
                disabled={busy}
              >
                <RefreshCw size={16} className={busy ? "spinning" : ""} />
                {busy ? "Running..." : "Run Analysis"}
              </button>
            </div>
          </div>
          <div className="stat-grid">
            <Stat
              label="ROLLING CORRELATION"
              value={fmt(currentCorr, 3)}
              detail={`${lookback}-observation Pearson coefficient`}
              icon={Waves}
              accent="teal"
            />
            <Stat
              label="OUT-OF-SAMPLE SHARPE"
              value={fmt(metrics.outOfSample?.sharpe)}
              detail={`Test-only • ${metrics.testDays || "—"} observations`}
              icon={Activity}
              accent="violet"
            />
            <Stat
              label="MAX. SIMULATED DRAWDOWN"
              value={fmt(metrics.all?.maxDrawdownPct)}
              suffix="%"
              detail="After assumed fee and slippage"
              icon={ArrowDownRight}
              accent="pink"
            />
            <Stat
              label="VALIDATION WINDOW"
              value={`${metrics.trainDays || "—"} / ${metrics.testDays || "—"}`}
              detail="Training observations / test observations"
              icon={ShieldCheck}
              accent="amber"
            />
          </div>
          <div className="layout-2-1" id="correlation">
            <Card
              title="Comparative Market Performance"
              eyebrow="01 / CROSS-ASSET OVERVIEW"
              className="large-chart"
              right={
                <div className="time-range">
                  <span className="selected">FULL HISTORY</span>
                </div>
              }
            >
              <div className="panel-subtitle">
                Normalized values (first paired close = 100) ·{" "}
                {result?.meta?.observations || "—"} paired dates
              </div>
              <div className="legend-line">
                <LabelRow label={primary} color="#5ce4ce" />
                <LabelRow label={reference} color="#aa8efa" />
              </div>
              <div className="chart-wrap performance">
                {rows.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={recentData}
                      margin={{ top: 14, right: 5, bottom: 0, left: -10 }}
                    >
                      <defs>
                        <linearGradient
                          id="tealGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#36dfc2"
                            stopOpacity={0.17}
                          />
                          <stop
                            offset="100%"
                            stopColor="#36dfc2"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 6"
                        vertical={false}
                        stroke="#252f49"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDate}
                        stroke="#64728c"
                        axisLine={false}
                        tickLine={false}
                        minTickGap={45}
                        fontSize={10}
                      />
                      <YAxis
                        tickFormatter={(n) => n.toFixed(0)}
                        stroke="#64728c"
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v, n) => [
                          `${fmt(v, 2)} index pts`,
                          n === "primary" ? primary : reference,
                        ]}
                        labelFormatter={(x) => `Observation: ${x}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="primary"
                        stroke="#5ce4ce"
                        strokeWidth={2.4}
                        fill="url(#tealGrad)"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="reference"
                        stroke="#aa8efa"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty />
                )}
              </div>
              <div className="chart-footer">
                <span>
                  <span className="tiny-dot" /> Paired daily observations only
                </span>
                <span>Not forward-looking</span>
              </div>
            </Card>
            <Card
              title="Research Diagnostics"
              eyebrow="AUTOMATED EXPLANATION"
              className="insight-card"
            >
              <Insight data={result} />
            </Card>
          </div>
          <div className="layout-2-1">
            <Card
              title="Rolling Correlation"
              eyebrow="02 / RELATIONSHIP STRENGTH"
              right={<div className="tag">LOOKBACK {lookback}</div>}
            >
              <div className="panel-subtitle">
                Trailing Pearson correlation calculated only from observed
                returns
              </div>
              <div className="chart-wrap medium">
                {correlationLast.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={recentData}
                      margin={{ top: 10, right: 8, bottom: 0, left: -22 }}
                    >
                      <defs>
                        <linearGradient
                          id="corrGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#aa8efa"
                            stopOpacity={0.32}
                          />
                          <stop
                            offset="100%"
                            stopColor="#aa8efa"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="#252f49"
                        vertical={false}
                        strokeDasharray="3 6"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDate}
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        stroke="#64728c"
                        minTickGap={50}
                      />
                      <YAxis
                        domain={[-1, 1]}
                        ticks={[-1, -0.5, 0, 0.5, 1]}
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        stroke="#64728c"
                      />
                      <ReferenceLine
                        y={0}
                        stroke="#65738e"
                        strokeDasharray="4 5"
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v) => [fmt(v, 3), "Pearson ρ"]}
                      />
                      <Area
                        dataKey="correlation"
                        stroke="#a58dff"
                        strokeWidth={2}
                        fill="url(#corrGrad)"
                        dot={false}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty />
                )}
              </div>
              <div className="chart-footer">
                <span>+1 = same-direction linear relationship</span>
                <span>−1 = opposite-direction</span>
              </div>
            </Card>
            <Card
              title="Correlation Matrix"
              eyebrow="03 / CROSS-ASSET HEATMAP"
              right={<div className="tag">LAST 60 DATES</div>}
            >
              <div className="heatmap-scroll">
                <div
                  className="matrix"
                  style={{
                    gridTemplateColumns: `72px repeat(${heatmap?.assets.length || 1}, minmax(33px,1fr))`,
                  }}
                >
                  <div />
                  {heatmap?.assets.map((a) => (
                    <div className="matrix-heading" key={a}>
                      {a.replace("r", "ᵣ")}
                    </div>
                  ))}
                  {heatmap?.rows.map((row) => (
                    <React.Fragment key={row.asset}>
                      <div className="matrix-side">{row.asset}</div>
                      {row.values.map((v, i) => (
                        <div
                          className="matrix-cell"
                          title={`${row.asset} / ${heatmap.assets[i]}: ${v ?? "N/A"}`}
                          style={{ background: heatBg(v) }}
                          key={i}
                        >
                          {v == null ? "–" : fmt(v, 2)}
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="heat-legend">
                <span>NEGATIVE</span>
                <div className="heatbar" />
                <span>POSITIVE</span>
              </div>
            </Card>
          </div>
          {/* Session-aware stock correlation */}

<SessionExplorer />
{/* Historical Price Tracking Intelligence */}
<PriceTracking />
{/* Gemini AI Research Assistant */}
<ResearchAssistant />
          <SectionTitle
            id="backtesting"
            kicker="04 / STRATEGY VALIDATION"
            title="The Strategy Lab"
            subtitle="Predeclared hypothesis, delayed signals, and chronological out-of-sample evaluation."
            right={
              <span className="research-badge">
                <ShieldCheck size={14} /> SIMULATION ONLY
              </span>
            }
          />
          <div className="layout-2-1 strategy-area">
            <Card
              title="Cost-Aware Backtest"
              eyebrow="EQUITY CURVE VS BASELINE"
              right={
                <div className="tag">
                  {metrics.splitDate || "—"} TEST BEGINS
                </div>
              }
            >
              <div className="legend-line">
                <LabelRow label="Simulated strategy" color="#5ce4ce" />
                <LabelRow
                  label={`Passive ${primary} baseline`}
                  color="#aa8efa"
                />
              </div>
              <div className="chart-wrap backtest">
                {rows.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={rows}
                      margin={{ top: 15, right: 12, bottom: 0, left: -5 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="#252f49"
                        strokeDasharray="3 6"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDate}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={55}
                        fontSize={10}
                        stroke="#64728c"
                      />
                      <YAxis
                        tickFormatter={(x) => `${x.toFixed(0)}%`}
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        stroke="#64728c"
                      />
                      <ReferenceLine
                        y={0}
                        stroke="#65738e"
                        strokeDasharray="4 4"
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v, key) => [
                          `${fmt(v, 2)}%`,
                          key === "strategyEquity"
                            ? "Cumulative simulated return"
                            : "Passive baseline",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="strategyEquity"
                        stroke="#5ce4ce"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="benchmarkEquity"
                        stroke="#aa8efa"
                        strokeWidth={1.8}
                        strokeDasharray="5 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty />
                )}
              </div>
              <div className="chart-footer">
                <span>Includes simulated transaction fees and slippage</span>
                <span>Not a prediction</span>
              </div>
            </Card>
            <Card
              title="Experiment Controls"
              eyebrow="CONFIGURE / REPRODUCE"
              className="control-panel"
            >
              <label>
                PRIMARY ASSET
                <select
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                >
                  {assets.map((a) => (
                    <option key={a} disabled={a === reference}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                REFERENCE ASSET
                <select
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                >
                  {assets.map((a) => (
                    <option key={a} disabled={a === primary}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <div className="control-pair">
                <label>
                  LOOKBACK (OBS.)
                  <input
                    type="number"
                    min="15"
                    max="70"
                    value={lookback}
                    onChange={(e) => setLookback(+e.target.value)}
                  />
                </label>
                <label>
                  RESIDUAL THRESHOLD
                  <input
                    type="number"
                    min="0.5"
                    max="3.5"
                    step="0.25"
                    value={threshold}
                    onChange={(e) => setThreshold(+e.target.value)}
                  />
                </label>
              </div>
              <div className="control-pair">
                <label>
                  TEST OBSERVATIONS
                  <input
                    type="number"
                    min="30"
                    max="140"
                    value={oos}
                    onChange={(e) => setOos(+e.target.value)}
                  />
                </label>
                <label>
                  FEE / SLIPPAGE (BPS)
                  <div className="two-small">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={fee}
                      onChange={(e) => setFee(+e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={slippage}
                      onChange={(e) => setSlippage(+e.target.value)}
                    />
                  </div>
                </label>
              </div>
              <button
                className="btn primary run-btn"
                disabled={busy}
                onClick={settingsApply}
              >
                <Play size={16} fill="currentColor" />
                {busy
                  ? "RUNNING RESEARCH..."
                  : "RUN REPRODUCIBLE BACKTEST"}{" "}
                <ArrowRight size={16} />
              </button>
              <div className="control-note">
                <Info size={15} />
                <span>
                  Changing parameters after viewing results introduces selection
                  bias. Freeze them before judging out-of-sample performance.
                </span>
              </div>
            </Card>
          </div>
          <div className="layout-2-1 compact-panels">
            <Card
              title="Validation Scorecard"
              eyebrow="TRAIN / HOLDOUT COMPARISON"
            >
              <div className="score-table">
                <div className="score-row score-head">
                  <span>METRIC</span>
                  <span>IN SAMPLE</span>
                  <span>OUT OF SAMPLE</span>
                </div>
                {[
                  ["Cumulative return", "returnPct", "%"],
                  ["Annualized Sharpe", "sharpe", ""],
                  ["Sortino ratio", "sortino", ""],
                  ["Max drawdown", "maxDrawdownPct", "%"],
                  ["Positive active days", "positiveActiveDayPct", "%"],
                  ["Ann. volatility", "volatilityPct", "%"],
                ].map(([lab, key, suf]) => (
                  <div className="score-row" key={key}>
                    <span>{lab}</span>
                    <b>
                      {signed(metrics.inSample?.[key])}
                      {metrics.inSample?.[key] == null ? "" : suf}
                    </b>
                    <b>
                      {signed(metrics.outOfSample?.[key])}
                      {metrics.outOfSample?.[key] == null ? "" : suf}
                    </b>
                  </div>
                ))}
              </div>
              <div className="score-foot">
                Train: {metrics.trainDays ?? "—"} dates · Holdout:{" "}
                {metrics.testDays ?? "—"} dates · Total turnover avg:{" "}
                {fmt(metrics.all?.turnoverPct, 1)}%
              </div>
            </Card>
            <Card
              title="Simulated Activity"
              eyebrow="MOST RECENT POSITION TRANSITIONS"
            >
              <div className="activity-list">
                {(result?.trades || []).length ? (
                  result.trades.slice(0, 5).map((t, i) => (
                    <div className="activity-row" key={t.date + i}>
                      <div
                        className={cn(
                          "activity-badge",
                          t.action.startsWith("ENTER") ? "enter" : "exit",
                        )}
                      >
                        {t.action.startsWith("ENTER") ? (
                          <ArrowUpRight size={18} />
                        ) : (
                          <ArrowDownRight size={18} />
                        )}
                      </div>
                      <div>
                        <b>{t.action}</b>
                        <small>
                          {t.date} · residual z {fmt(t.z)}
                        </small>
                      </div>
                      <span>{primary}</span>
                    </div>
                  ))
                ) : (
                  <div className="no-trades">
                    No simulated position changes at these settings.
                  </div>
                )}
              </div>
              <div className="chart-footer">
                <span>Historical simulation</span>
                <span>No real orders</span>
              </div>
            </Card>
          </div>
          <SectionTitle
            id="data-studio"
            kicker="05 / EVIDENCE & PROVENANCE"
            title="Data Studio"
            subtitle="Import your own matched historical observations or restore the labeled demo."
          />
          <div className="data-grid">
            <div className="data-card">
              <div className="data-symbol">
                <FileUp size={22} />
              </div>
              <div>
                <h3>Import historical prices</h3>
                <p>
                  CSV columns: <code>date,asset,close</code>. At least two
                  assets and 100 dates; more overlapping history recommended.
                </p>
                <div className="data-buttons">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    onChange={handleUpload}
                  />
                  <button
                    className="btn primary"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <UploadCloud size={16} />
                    {uploading ? "VALIDATING..." : "IMPORT CSV"}
                  </button>
                  <a
                    className="btn outline"
                    href="/api/sample-template"
                    download
                  >
                    <Download size={15} /> CSV Template
                  </a>
                </div>
              </div>
            </div>
            <div className="data-card">
              <div className="data-symbol purple">
                <Database size={22} />
              </div>
              <div>
                <h3>Reproducible sample dataset</h3>
                <p>
                  Generated with a fixed random seed. Useful for developing the
                  interface but never acceptable as genuine
                  historical-performance evidence.
                </p>
                <div className="data-buttons">
                  <button className="btn outline" onClick={restore}>
                    <RefreshCw size={16} /> Restore synthetic demo
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="disclosure">
            <div>
              <ShieldCheck size={18} />
              <b>Research integrity comes first.</b>
            </div>
            <p>
              Market statistics depend on data accuracy and synchronized
              observations. This software does not establish profitable
              strategies or provide personalized financial advice. Do not
              connect an exchange account or real funds to this educational
              project.
            </p>
          </div>
          <footer className="footer">
            <span>
              NEXUS ALPHA <i>/</i> QUANTITATIVE RESEARCH TERMINAL
            </span>
            <span>Built for learning · v0.1.0 · LOCAL ONLY</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
export default App;
