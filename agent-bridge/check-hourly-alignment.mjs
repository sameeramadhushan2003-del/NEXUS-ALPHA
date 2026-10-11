
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
// 2. CONFIGURE HOURLY DATA REQUEST
// ==========================================

const SYMBOL = "RNVDAUSDT";


const START = Date.parse(
  "2026-06-01T00:00:00Z"
);

const END = Date.parse(
  "2026-06-04T00:00:00Z"
);


const HOUR_MS = 60 * 60 * 1000;

// ==========================================
// 3. NEW YORK TIME FORMAT
// ==========================================

const newYorkFormatter = new Intl.DateTimeFormat(
  "en-GB",
  {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }
);

// ==========================================
// 4. FETCH HOURLY CANDLES
// ==========================================

async function main() {
  console.log("Fetching rNVDA hourly candles...");

  const result = await safeInvoke(
    market,
    {
      action: "candlesHistory",
      category: "SPOT",
      symbol: SYMBOL,
      interval: "1H",
      startTime: String(START),
      endTime: String(END),
      limit: "100"
    },
    {
      config,
      client
    }
  );

  if (!result.ok) {
    console.error(
      "API error:",
      JSON.stringify(result.error, null, 2)
    );

    return;
  }

  if (!Array.isArray(result.data)) {
    console.error("Unexpected API response");
    return;
  }

  // ========================================
  // 5. CONVERT RAW CANDLES
  // ========================================

  const candles = result.data
    .map((row) => {
      if (!Array.isArray(row) || row.length < 6) {
        return null;
      }

      const timestamp = Number(row[0]);
      const close = Number(row[4]);
      const volume = Number(row[5]);

      if (
        !Number.isSafeInteger(timestamp) ||
        !Number.isFinite(close) ||
        close <= 0
      ) {
        return null;
      }

      return {
        timestamp,
        close,
        volume
      };
    })
    .filter((item) => item !== null)
    .filter((item) => {
      return (
        item.timestamp >= START &&
        item.timestamp < END
      );
    })
    .sort((a, b) => {
      return a.timestamp - b.timestamp;
    });

  console.log(
    "\nTotal hourly candles:",
    candles.length
  );

  // ========================================
  // 6. SHOW CANDLES NEAR STOCK MARKET CLOSE
  // ========================================

  const nearClose = candles.filter((item) => {
    const hour = new Date(
      item.timestamp
    ).getUTCHours();

    return hour >= 18 && hour <= 20;
  });

  const output = nearClose.map((item) => {
    const start = new Date(item.timestamp);

    const end = new Date(
      item.timestamp + HOUR_MS
    );

    return {
      utcStart: start.toISOString(),
      utcEnd: end.toISOString(),
      newYorkEnd: newYorkFormatter.format(end),
      close: item.close,
      volume: item.volume
    };
  });

  console.log("\nCANDLES NEAR US MARKET CLOSE");
  console.log("============================");

  console.table(output);

  // ========================================
  // 7. DISPLAY DATA QUALITY INFORMATION
  // ========================================

  if (candles.length === 0) {
    console.warn(
      "No hourly candles were returned."
    );
  }

  console.log("\nHourly data inspection completed.");
}

main().catch((error) => {
  console.error(
    "Inspection failed:",
    error.message
  );

  process.exitCode = 1;
});
