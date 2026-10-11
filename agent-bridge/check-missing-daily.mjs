
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

const tools = buildTools(config);

const market = tools.find(
  (tool) => tool.name === "market"
);

if (!market) {
  throw new Error("Market tool not found");
}


// ==========================================
// 2. DEFINE MISSING DATES AND ASSETS
// ==========================================

const missingDates = [
  "2026-06-06",
  "2026-07-30",
  "2026-09-28"
];

const assets = [
  {
    name: "rNVDA",
    symbol: "RNVDAUSDT"
  },
  {
    name: "rTSLA",
    symbol: "RTSLAUSDT"
  }
];

const DAY_MS = 24 * 60 * 60 * 1000;


// ==========================================
// 3. REQUEST HISTORICAL DAILY CANDLES
// ==========================================

async function checkDate(asset, date) {

  const target = Date.parse(
    `${date}T00:00:00Z`
  );

  // Include one neighboring day on each side.
  const start = target - DAY_MS;
  const end = target + 2 * DAY_MS;

  const result = await safeInvoke(
    market,
    {
      action: "candlesHistory",
      category: "SPOT",
      symbol: asset.symbol,
      interval: "1D",
      startTime: String(start - DAY_MS),
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
      JSON.stringify(result.error)
    );
  }

  if (!Array.isArray(result.data)) {
    throw new Error(
      "Invalid Bitget API response"
    );
  }

  const candles = new Map();

  for (const row of result.data) {

    if (!Array.isArray(row) || row.length < 7) {
      continue;
    }

    const timestamp = Number(row[0]);
    const close = Number(row[4]);
    const volume = Number(row[5]);

    if (
      !Number.isSafeInteger(timestamp) ||
      !Number.isFinite(close) ||
      close <= 0 ||
      !Number.isFinite(volume) ||
      volume < 0
    ) {
      continue;
    }

    if (
      timestamp < start ||
      timestamp >= end
    ) {
      continue;
    }

    const candleDate = new Date(timestamp)
      .toISOString()
      .slice(0, 10);

    candles.set(candleDate, {
      close,
      volume
    });
  }

  // Show the date before, target date,
  // and following date.
  const rows = [-1, 0, 1].map((offset) => {

    const day = new Date(
      target + offset * DAY_MS
    ).toISOString().slice(0, 10);

    const candle = candles.get(day);

    return {
      date: day,
      status: candle ? "PRESENT" : "MISSING",
      close: candle?.close ?? null,
      volume: candle?.volume ?? null
    };
  });

  console.log(
    `\n${asset.name} — Checking ${date}`
  );

  console.log(
    "Raw API rows:",
    result.data.length
  );

  console.table(rows);

  return candles.has(date);
}


// ==========================================
// 4. RUN ALL SOURCE CHECKS
// ==========================================

async function main() {

  console.log(
    "\nNEXUS ALPHA — BITGET DAILY CANDLE AUDIT"
  );

  const summary = [];

  for (const asset of assets) {

    for (const date of missingDates) {

      const found = await checkDate(
        asset,
        date
      );

      summary.push({
        asset: asset.name,
        date,
        dailyCandle: (
          found ? "PRESENT" : "MISSING"
        )
      });
    }
  }

  console.log("\nFINAL SUMMARY");
  console.log("=============");

  console.table(summary);

  console.log(
    "\nNo historical files were modified."
  );
}

main().catch((error) => {
  console.error(
    "Audit failed:",
    error.message
  );

  process.exitCode = 1;
});
