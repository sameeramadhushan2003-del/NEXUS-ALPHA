
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

// =====================================
// 1. CONFIGURE BITGET AGENT HUB
// =====================================

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
  throw new Error("Market tool unavailable");
}

// =====================================
// 2. SELECT ASSETS AND DATE RANGE
// =====================================

const symbols = [
  "RNVDAUSDT",
  "RTSLAUSDT"
];

const DAY_MS = 24 * 60 * 60 * 1000;

const START = Date.parse(
  "2026-06-01T00:00:00Z"
);

// Exclude today's incomplete candle.
const END = Date.parse(
  "2026-10-11T00:00:00Z"
);

// Each API request covers 60 days.
const WINDOW_DAYS = 60;

// =====================================
// 3. FETCH HISTORICAL CANDLES
// =====================================

async function checkHistory(symbol) {
  console.log(`\nChecking ${symbol}...`);

  const candles = new Map();

  for (
    let start = START;
    start < END;
    start += WINDOW_DAYS * DAY_MS
  ) {
    const end = Math.min(
      start + WINDOW_DAYS * DAY_MS,
      END
    );

    const result = await safeInvoke(
      market,
      {
        action: "candlesHistory",
        category: "SPOT",
        symbol: symbol,
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
        `${symbol}: ${JSON.stringify(result.error)}`
      );
    }

    if (!Array.isArray(result.data)) {
      throw new Error(
        `${symbol}: Unexpected API response`
      );
    }

    for (const candle of result.data) {
      if (!Array.isArray(candle)) {
        continue;
      }

      const timestamp = Number(candle[0]);
      const close = Number(candle[4]);
      const volume = Number(candle[5]);

      if (
        !Number.isSafeInteger(timestamp) ||
        !Number.isFinite(close) ||
        close <= 0
      ) {
        continue;
      }

      if (
        timestamp < start ||
        timestamp >= end
      ) {
        continue;
      }

      candles.set(timestamp, {
        timestamp,
        date: new Date(timestamp)
          .toISOString()
          .slice(0, 10),
        close,
        volume
      });
    }
  }

  // ===================================
  // 4. CHECK DATA QUALITY
  // ===================================

  const records = [...candles.values()]
    .sort((a, b) => a.timestamp - b.timestamp);

  if (records.length === 0) {
    console.log("No historical candles found.");
    return;
  }

  const first = records[0];
  const last = records[records.length - 1];

  let missingDays = 0;

  for (
    let time = first.timestamp;
    time <= last.timestamp;
    time += DAY_MS
  ) {
    if (!candles.has(time)) {
      missingDays++;
    }
  }

  const zeroVolumeDays = records.filter(
    (row) => row.volume === 0
  ).length;

  // ===================================
  // 5. DISPLAY FINDINGS
  // ===================================

  console.log("Total candles:", records.length);
  console.log("First date:", first.date);
  console.log("Last date:", last.date);
  console.log("Missing days within span:", missingDays);
  console.log("Zero-volume candles:", zeroVolumeDays);

  console.log("\nFIRST 3 OBSERVATIONS:");

  console.table(records.slice(0, 3).map(
    ({ date, close, volume }) => ({
      date,
      close,
      volume
    })
  ));

  console.log("\nLATEST 3 OBSERVATIONS:");

  console.table(records.slice(-3).map(
    ({ date, close, volume }) => ({
      date,
      close,
      volume
    })
  ));

  if (records.length >= 100) {
    console.log(
      "Enough dates for the engine's basic minimum."
    );
  } else {
    console.log(
      "Fewer than 100 dates. More historical " +
      "coverage or an adjusted research design is needed."
    );
  }
}

// =====================================
// 6. EXECUTE THE RESEARCH CHECK
// =====================================

for (const symbol of symbols) {
  try {
    await checkHistory(symbol);
  } catch (error) {
    console.error(
      `Failed for ${symbol}:`,
      error.message
    );
  }
}
