
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";


// ==========================================
// 1. CONNECT TO BITGET AGENT HUB
// ==========================================

const config = loadConfig({
  modules: "market",
  readOnly: true
});

const client = new BitgetRestClient(config);

const market = buildTools(config).find(
  (tool) => tool.name === "market"
);

if (!market) {
  throw new Error("Market tool not available");
}


// ==========================================
// 2. DEFINE TEST SETTINGS
// ==========================================

const HOUR_MS = 60 * 60 * 1000;

const ASSETS = [
  {
    name: "rNVDA",
    symbol: "RNVDAUSDT"
  },
  {
    name: "BTC",
    symbol: "BTCUSDT"
  }
];

const DAILY_START = Date.parse(
  "2026-07-28T00:00:00Z"
);

const HOURLY_START = Date.parse(
  "2026-07-29T00:00:00Z"
);

const END = Date.parse(
  "2026-08-01T00:00:00Z"
);

const CHECK_DATES = [
  "2026-07-29",
  "2026-07-30"
];


// ==========================================
// 3. FETCH HISTORICAL CANDLES
// ==========================================

async function fetchHistory(symbol, interval, start) {

  const result = await safeInvoke(
    market,
    {
      action: "candlesHistory",
      category: "SPOT",
      symbol,
      interval,
      startTime: String(start),
      endTime: String(END),
      limit: "100"
    },
    {
      config,
      client
    }
  );

  if (!result.ok) {
    throw new Error(
      `${symbol}: ${JSON.stringify(result.error)}`
    );
  }

  if (!Array.isArray(result.data)) {
    throw new Error(
      `${symbol}: Unexpected response format`
    );
  }

  return result.data
    .filter((row) => {
      return Array.isArray(row) && row.length >= 5;
    })
    .map((row) => ({
      timestamp: Number(row[0]),
      open: Number(row[1]),
      close: Number(row[4])
    }))
    .filter((row) => {
      return (
        Number.isSafeInteger(row.timestamp) &&
        Number.isFinite(row.open) &&
        Number.isFinite(row.close) &&
        row.open > 0 &&
        row.close > 0
      );
    });
}


// ==========================================
// 4. COMPARE PRICES SAFELY
// ==========================================

function matches(a, b) {

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) {
    return false;
  }

  return Math.abs(a - b) <= (
    Math.max(1, Math.abs(a)) * 0.000001
  );
}


// ==========================================
// 5. CHECK CANDLE TIMING
// ==========================================

async function analyzeAsset(asset) {

  console.log(
    `\nAnalyzing ${asset.name}...`
  );

  const daily = await fetchHistory(
    asset.symbol,
    "1D",
    DAILY_START
  );

  const hourly = await fetchHistory(
    asset.symbol,
    "1H",
    HOURLY_START
  );

  const hourlyMap = new Map(
    hourly.map((candle) => [
      candle.timestamp,
      candle
    ])
  );

  const results = [];

  for (const date of CHECK_DATES) {

    const dailyRow = daily.find((row) => {
      return (
        new Date(row.timestamp)
          .toISOString()
          .slice(0, 10) === date
      );
    });

    if (!dailyRow) {
      console.log(
        `${date}: No daily candle available`
      );

      continue;
    }

    const t = dailyRow.timestamp;

    // Hour ending at the daily timestamp.
    const previousHour = hourlyMap.get(
      t - HOUR_MS
    );

    // Hour beginning at the daily timestamp.
    const firstHour = hourlyMap.get(t);

    // Last hour of a hypothetical
    // 24-hour candle starting at t.
    const lastHour = hourlyMap.get(
      t + 23 * HOUR_MS
    );

    results.push({
      date,

      dailyTimestamp: (
        new Date(t).toISOString()
      ),

      dailyOpen: dailyRow.open,
      dailyClose: dailyRow.close,

      hourlyOpenAtTimestamp: (
        firstHour?.open ?? null
      ),

      hourlyCloseAtTimestamp: (
        previousHour?.close ?? null
      ),

      hourlyClose24HoursLater: (
        lastHour?.close ?? null
      ),

      openMatchesHourly: (
        firstHour
          ? matches(dailyRow.open, firstHour.open)
          : false
      ),

      closeMatchesAtTimestamp: (
        previousHour
          ? matches(dailyRow.close, previousHour.close)
          : false
      ),

      closeMatches24HoursLater: (
        lastHour
          ? matches(dailyRow.close, lastHour.close)
          : false
      )
    });
  }

  console.table(results);

  return results;
}


// ==========================================
// 6. RUN THE VERIFICATION
// ==========================================

async function main() {

  console.log(
    "\nNEXUS ALPHA - DAILY CANDLE TIMING AUDIT"
  );

  for (const asset of ASSETS) {
    await analyzeAsset(asset);
  }

  console.log("\nTIMING AUDIT COMPLETED");

  console.log(
    "Compare daily OHLC prices against hourly "
    + "observations before assigning candle "
    + "availability times."
  );
}

main().catch((error) => {

  console.error(
    "Verification failed:",
    error.message
  );

  process.exitCode = 1;
});
