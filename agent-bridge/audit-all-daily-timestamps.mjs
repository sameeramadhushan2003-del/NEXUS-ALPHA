
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";


// ==========================================
// 1. CONFIGURE BITGET AGENT HUB
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
  throw new Error("Market tool not found");
}


// ==========================================
// 2. DEFINE ASSETS
// ==========================================

const ASSETS = [
  {
    name: "rNVDA",
    symbol: "RNVDAUSDT"
  },
  {
    name: "rTSLA",
    symbol: "RTSLAUSDT"
  },
  {
    name: "BTC",
    symbol: "BTCUSDT"
  }
];

const DAY_MS = 24 * 60 * 60 * 1000;


// ==========================================
// 3. DEFINE HISTORICAL REQUEST WINDOWS
// ==========================================

const WINDOWS = [
  [
    "2026-06-01T00:00:00Z",
    "2026-08-05T00:00:00Z"
  ],
  [
    "2026-08-05T00:00:00Z",
    "2026-10-10T00:00:00Z"
  ]
];


// ==========================================
// 4. DOWNLOAD DAILY CANDLES
// ==========================================

async function fetchDailyCandles(asset) {

  const candles = new Map();

  for (const [startText, endText] of WINDOWS) {

    const start = Date.parse(startText);
    const end = Date.parse(endText);

    const result = await safeInvoke(
      market,
      {
        action: "candlesHistory",
        category: "SPOT",
        symbol: asset.symbol,
        interval: "1D",
        startTime: String(start),
        endTime: String(end),
        limit: "100"
      },
      {
        config,
        client
      }
    );

    if (!result.ok) {
      throw new Error(
        `${asset.name}: ${JSON.stringify(result.error)}`
      );
    }

    if (!Array.isArray(result.data)) {
      throw new Error(
        `${asset.name}: Invalid API response`
      );
    }

    for (const row of result.data) {

      if (!Array.isArray(row) || row.length < 5) {
        continue;
      }

      const timestamp = Number(row[0]);
      const close = Number(row[4]);

      if (
        !Number.isSafeInteger(timestamp) ||
        !Number.isFinite(close) ||
        close <= 0
      ) {
        continue;
      }

      if (timestamp < start || timestamp >= end) {
        continue;
      }

      // A 1D candle spans 24 hours.
      const candleEnd = timestamp + DAY_MS;

      // Never include an unfinished candle.
      if (candleEnd > Date.now()) {
        continue;
      }

      const date = new Date(timestamp)
        .toISOString()
        .slice(0, 10);

      const record = {
        date,
        startUtc: new Date(timestamp).toISOString(),
        endUtc: new Date(candleEnd).toISOString(),
        close
      };

      if (candles.has(date)) {
        throw new Error(
          `${asset.name}: Duplicate date ${date}`
        );
      }

      candles.set(date, record);
    }
  }

  return [...candles.values()].sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}


// ==========================================
// 5. ANALYZE TIMESTAMP CONSISTENCY
// ==========================================

async function analyzeAsset(asset) {

  console.log(`\nChecking ${asset.name}...`);

  const rows = await fetchDailyCandles(asset);

  const times = {};

  for (const row of rows) {

    const utcTime = row.startUtc.slice(11, 16);

    times[utcTime] = (times[utcTime] || 0) + 1;
  }

  console.log("Total daily candles:", rows.length);

  console.log(
    "First date:",
    rows[0]?.date ?? "Unavailable"
  );

  console.log(
    "Last date:",
    rows.at(-1)?.date ?? "Unavailable"
  );

  console.log("UTC candle start-time counts:");
  console.table(times);

  const checkDates = [
    "2026-06-06",
    "2026-07-30",
    "2026-09-28"
  ];

  const records = new Map(
    rows.map((row) => [row.date, row])
  );

  const checks = checkDates.map((date) => {

    const record = records.get(date);

    return {
      date,
      status: record ? "PRESENT" : "MISSING",
      startUtc: record?.startUtc ?? null,
      endUtc: record?.endUtc ?? null
    };
  });

  console.log("\nImportant date checks:");
  console.table(checks);

  return {
    asset: asset.name,
    total: rows.length,
    uniqueStartTimes: Object.keys(times)
  };
}


// ==========================================
// 6. RUN THE AUDIT
// ==========================================

async function main() {

  console.log(
    "\nNEXUS ALPHA - FULL DAILY TIMESTAMP AUDIT"
  );

  const summary = [];

  for (const asset of ASSETS) {

    const result = await analyzeAsset(asset);

    summary.push(result);
  }

  console.log("\nFINAL SUMMARY");
  console.log("=============");

  console.table(
    summary.map((item) => ({
      asset: item.asset,
      total: item.total,
      startTimes: item.uniqueStartTimes.join(", ")
    }))
  );

  console.log(
    "\nAudit completed. No files modified."
  );
}

main().catch((error) => {

  console.error(
    "Audit failed:",
    error.message
  );

  process.exitCode = 1;
});
