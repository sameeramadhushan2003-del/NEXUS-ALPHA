
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
// 2. SET HISTORICAL DATA PARAMETERS
// ==========================================

const DAY_MS = 24 * 60 * 60 * 1000;

const START = Date.parse(
  "2026-06-01T00:00:00Z"
);

const END = Date.parse(
  "2026-10-11T00:00:00Z"
);

const WINDOW_DAYS = 60;

const assets = [
  {
    symbol: "RNVDAUSDT",
    asset: "rNVDA"
  },
  {
    symbol: "RTSLAUSDT",
    asset: "rTSLA"
  },
  {
    symbol: "BTCUSDT",
    asset: "BTC"
  }
];

// ==========================================
// 3. DOWNLOAD HISTORICAL DATA
// ==========================================

async function downloadHistory(symbol) {
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
        `${symbol}: Invalid candle response`
      );
    }

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

  return candles;
}

// ==========================================
// 4. COLLECT ALL THREE ASSETS
// ==========================================

async function main() {
  const datasets = new Map();

  for (const item of assets) {
    const records = await downloadHistory(
      item.symbol
    );

    datasets.set(item.asset, records);

    console.log(
      `${item.asset}: ${records.size} candles`
    );
  }

  // ========================================
  // 5. MATCH COMMON UTC CANDLE DATES
  // ========================================

  const firstAsset = assets[0].asset;

  const firstDataset = datasets.get(firstAsset);

  const commonTimes = [...firstDataset.keys()]
    .filter((time) => {
      return assets.every((item) => {
        return datasets.get(item.asset).has(time);
      });
    })
    .sort((a, b) => a - b);

  // ========================================
  // 6. CREATE CSV DATA
  // ========================================

  const csvRows = [
    "date,asset,close"
  ];

  for (const time of commonTimes) {
    for (const item of assets) {
      const candle = datasets
        .get(item.asset)
        .get(time);

      csvRows.push(
        `${candle.date},${item.asset},${candle.close}`
      );
    }
  }

  // ========================================
  // 7. SAVE DATASET
  // ========================================

  const currentDirectory = path.dirname(
    fileURLToPath(import.meta.url)
  );

  const outputFolder = path.join(
    currentDirectory,
    "data"
  );

  await mkdir(outputFolder, {
    recursive: true
  });

  const csvPath = path.join(
    outputFolder,
    "cross_market_history.csv"
  );

  await writeFile(
    csvPath,
    csvRows.join("\n") + "\n",
    "utf8"
  );

  // ========================================
  // 8. SAVE SOURCE INFORMATION
  // ========================================

  const metadata = {
    source: "Bitget Agent Hub",
    action: "candlesHistory",
    category: "SPOT",
    interval: "1D",
    candleTimezone: "UTC",
    assets,
    startDate: "2026-06-01",
    endDateExclusive: "2026-10-11",
    downloadedAt: new Date().toISOString(),
    observationsByAsset: Object.fromEntries(
      assets.map((item) => [
        item.asset,
        datasets.get(item.asset).size
      ])
    ),
    matchedObservations: commonTimes.length,
    alignment: "Matching UTC daily candle timestamps",
    warning: (
      "Not aligned to US equity closing times. " +
      "Source and volume quality require further audit."
    )
  };

  await writeFile(
    path.join(
      outputFolder,
      "cross_market_metadata.json"
    ),
    JSON.stringify(metadata, null, 2),
    "utf8"
  );

  // ========================================
  // 9. DISPLAY RESULTS
  // ========================================

  console.log("\nCROSS-MARKET DATASET READY");

  console.log(
    "Matched observations:",
    commonTimes.length
  );

  console.log(
    "Assets:",
    assets.map((item) => item.asset).join(", ")
  );

  console.log("Saved:", csvPath);

  if (commonTimes.length < 100) {
    console.warn(
      "WARNING: Fewer than 100 matched dates."
    );
  }
}

main().catch((error) => {
  console.error(
    "Collection error:",
    error.message
  );

  process.exitCode = 1;
});
