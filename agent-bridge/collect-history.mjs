
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
// 1. CONFIGURATION
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

const START = Date.parse(
  "2026-03-01T00:00:00Z"
);

// Exclusive end: avoids the unfinished
// daily candle on October 11.
const END = Date.parse(
  "2026-10-11T00:00:00Z"
);

const WINDOW_DAYS = 60;

const symbols = [
  {
    symbol: "BTCUSDT",
    asset: "BTC"
  },
  {
    symbol: "ETHUSDT",
    asset: "ETH"
  }
];

// ==========================================
// 3. DOWNLOAD ONE ASSET'S HISTORY
// ==========================================

async function downloadAsset(symbol) {
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

    console.log(
      `Fetching ${symbol}:`,
      new Date(start).toISOString().slice(0, 10),
      "to",
      new Date(end).toISOString().slice(0, 10)
    );

    const result = await safeInvoke(
      market,
      {
        action: "candlesHistory",
        category: "SPOT",
        symbol,
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

    // Keep only valid candles within
    // the requested window.
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

      if (
        timestamp < start ||
        timestamp >= end
      ) {
        continue;
      }

      candles.set(timestamp, {
        date: new Date(timestamp)
          .toISOString()
          .slice(0, 10),

        close: String(row[4])
      });
    }
  }

  console.log(
    `${symbol}: ${candles.size} unique candles`
  );

  return candles;
}

// ==========================================
// 4. DOWNLOAD BTC AND ETH
// ==========================================

async function main() {
  const datasets = new Map();

  for (const item of symbols) {
    const candles = await downloadAsset(
      item.symbol
    );

    datasets.set(
      item.asset,
      candles
    );
  }

  const btc = datasets.get("BTC");
  const eth = datasets.get("ETH");

  // Keep only timestamps shared by both.
  const commonTimes = [...btc.keys()]
    .filter((time) => eth.has(time))
    .sort((a, b) => a - b);

  // ========================================
  // 5. CONVERT INTO CSV
  // ========================================

  const lines = [
    "date,asset,close"
  ];

  for (const time of commonTimes) {
    const btcRow = btc.get(time);
    const ethRow = eth.get(time);

    lines.push(
      `${btcRow.date},BTC,${btcRow.close}`
    );

    lines.push(
      `${ethRow.date},ETH,${ethRow.close}`
    );
  }

  // ========================================
  // 6. SAVE FILES
  // ========================================

  const folder = path.dirname(
    fileURLToPath(import.meta.url)
  );

  const dataFolder = path.join(
    folder,
    "data"
  );

  await mkdir(dataFolder, {
    recursive: true
  });

  const csvPath = path.join(
    dataFolder,
    "market_history.csv"
  );

  await writeFile(
    csvPath,
    lines.join("\n") + "\n",
    "utf8"
  );

  // Save source information for research.
  const metadata = {
    source: "Bitget Agent Hub",
    endpoint: "/api/v3/market/history-candles",
    action: "candlesHistory",
    category: "SPOT",
    interval: "1D",
    symbols,
    startDate: "2026-03-01",
    endDate: "2026-10-10",
    downloadedAt: new Date().toISOString(),
    pairedObservations: commonTimes.length,
    note: "Public historical API data, not independently verified"
  };

  await writeFile(
    path.join(
      dataFolder,
      "market_history_metadata.json"
    ),
    JSON.stringify(metadata, null, 2),
    "utf8"
  );

  // ========================================
  // 7. SHOW RESULTS
  // ========================================

  console.log("\nDOWNLOAD FINISHED");
  console.log("Matched dates:", commonTimes.length);
  console.log("CSV saved:", csvPath);

  if (commonTimes.length < 100) {
    console.warn(
      "WARNING: Fewer than 100 paired dates. " +
      "The current Python engine will reject this CSV."
    );
  } else {
    console.log(
      "Dataset meets the engine's basic date-count requirement."
    );
  }
}

main().catch((error) => {
  console.error("Collection failed:", error.message);
  process.exitCode = 1;
});
