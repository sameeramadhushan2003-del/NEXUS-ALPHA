
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

import {
  mkdir,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";


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
// 2. HISTORICAL DATA SETTINGS
// ==========================================

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const START = Date.parse(
  "2026-06-01T00:00:00Z"
);

const END = Date.parse(
  "2026-10-11T00:00:00Z"
);

// Request three days at a time.
// Three days = 72 hourly candles.
const WINDOW_DAYS = 3;

const assets = [
  {
    symbol: "RNVDAUSDT",
    asset: "rNVDA"
  },
  {
    symbol: "RTSLAUSDT",
    asset: "rTSLA"
  }
];


// ==========================================
// 3. CONFIGURE NEW YORK TIMEZONE
// ==========================================

const nyFormatter = new Intl.DateTimeFormat(
  "en-US",
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
// 4. CONVERT UTC TO NEW YORK TIME
// ==========================================

function getNewYorkTime(timestamp) {
  const parts = nyFormatter.formatToParts(
    new Date(timestamp)
  );

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return {
    date: [
      values.year,
      values.month,
      values.day
    ].join("-"),

    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}


// ==========================================
// 5. DOWNLOAD ONE ASSET
// ==========================================

async function collectAsset(item) {
  console.log(
    `\nCollecting ${item.asset} session closes...`
  );

  const observations = new Map();

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
        symbol: item.symbol,
        interval: "1H",
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
        `${item.asset}: ${JSON.stringify(result.error)}`
      );
    }

    if (!Array.isArray(result.data)) {
      throw new Error(
        `${item.asset}: Invalid API response`
      );
    }

    for (const candle of result.data) {
      if (!Array.isArray(candle) || candle.length < 6) {
        continue;
      }

      const timestamp = Number(candle[0]);
      const close = Number(candle[4]);
      const volume = Number(candle[5]);

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

      // An hourly candle timestamp represents
      // the start of that candle.
      const candleEnd = timestamp + HOUR_MS;

      const nyTime = getNewYorkTime(candleEnd);

      // Keep candles ending at exactly
      // 4:00 PM New York time.
      if (
        nyTime.hour !== 16 ||
        nyTime.minute !== 0
      ) {
        continue;
      }

      if (observations.has(nyTime.date)) {
        throw new Error(
          `Duplicate ${item.asset} date: ${nyTime.date}`
        );
      }

      observations.set(nyTime.date, {
        date: nyTime.date,
        asset: item.asset,
        close,
        volume,
        candleEndUtc: new Date(
          candleEnd
        ).toISOString()
      });
    }

    console.log(
      `${item.asset}: processed through ${
        new Date(end).toISOString().slice(0, 10)
      }`
    );

    // Space out public API requests.
    await new Promise(
      (resolve) => setTimeout(resolve, 300)
    );
  }

  const rows = [...observations.values()]
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log(
    `${item.asset}: ${rows.length} session-close observations`
  );

  return rows;
}


// ==========================================
// 6. COLLECT BOTH STOCK-LINKED ASSETS
// ==========================================

async function main() {
  const allRecords = [];
  const counts = {};

  for (const item of assets) {
    const records = await collectAsset(item);

    allRecords.push(...records);

    counts[item.asset] = records.length;
  }

  if (allRecords.length === 0) {
    throw new Error(
      "No session-close observations found"
    );
  }

  allRecords.sort((a, b) => {
    return (
      a.date.localeCompare(b.date) ||
      a.asset.localeCompare(b.asset)
    );
  });


  // ========================================
  // 7. CREATE THE CSV FILE
  // ========================================

  const lines = [
    "date,asset,close,candle_end_utc,volume"
  ];

  for (const row of allRecords) {
    lines.push(
      [
        row.date,
        row.asset,
        row.close,
        row.candleEndUtc,
        row.volume
      ].join(",")
    );
  }


  // ========================================
  // 8. SAVE THE DATASET
  // ========================================

  const currentFolder = path.dirname(
    fileURLToPath(import.meta.url)
  );

  const outputFolder = path.join(
    currentFolder,
    "data"
  );

  await mkdir(outputFolder, {
    recursive: true
  });

  const outputPath = path.join(
    outputFolder,
    "session_close_history.csv"
  );

  await writeFile(
    outputPath,
    lines.join("\n") + "\n",
    "utf8"
  );


  // ========================================
  // 9. SAVE THE METADATA
  // ========================================

  const metadata = {
    source: "Bitget Agent Hub",
    action: "candlesHistory",
    interval: "1H",
    marketTimezone: "America/New_York",
    selectionRule: (
      "Hourly candle ending at 16:00 " +
      "New York local time"
    ),
    startUtc: new Date(START).toISOString(),
    endUtcExclusive: new Date(END).toISOString(),
    assets,
    observationsByAsset: counts,
    downloadedAt: new Date().toISOString(),
    limitations: [
      "Not all dates are stock trading sessions",
      "Early stock-market closes are not handled yet",
      "Source prices and volume require validation",
      "An hourly close is only an approximation to the equity close"
    ]
  };

  await writeFile(
    path.join(
      outputFolder,
      "session_close_metadata.json"
    ),
    JSON.stringify(metadata, null, 2),
    "utf8"
  );


  // ========================================
  // 10. DISPLAY RESULTS
  // ========================================

  console.log("\nSESSION-AWARE DATA COLLECTION COMPLETE");

  console.log("rNVDA:", counts.rNVDA);
  console.log("rTSLA:", counts.rTSLA);

  console.log("Total records:", allRecords.length);

  console.log("CSV:", outputPath);
}


// ==========================================
// 11. RUN THE COLLECTOR
// ==========================================

main().catch((error) => {
  console.error(
    "Collection failed:",
    error.message
  );

  process.exitCode = 1;
});
