
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";


// ==========================================
// 1. CONFIGURE BITGET CONNECTION
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
// 2. DEFINE RESEARCH SETTINGS
// ==========================================

const DAY_MS = 24 * 60 * 60 * 1000;

const START = Date.parse(
  "2026-06-01T00:00:00Z"
);

const END = Date.parse(
  "2026-10-10T00:00:00Z"
);

const WINDOW_DAYS = 10;

const ASSETS = [
  {
    asset: "rNVDA",
    symbol: "RNVDAUSDT"
  },
  {
    asset: "rTSLA",
    symbol: "RTSLAUSDT"
  },
  {
    asset: "BTC",
    symbol: "BTCUSDT"
  }
];


// ==========================================
// 3. LOCATE THE REPAIRED CSV
// ==========================================

const DIR = path.dirname(
  fileURLToPath(import.meta.url)
);

const CSV_FILE = path.join(
  DIR,
  "data",
  "cross_market_history_repaired.csv"
);


// ==========================================
// 4. LOAD THE REPAIRED DATASET
// ==========================================

async function loadRepaired() {

  const text = await readFile(
    CSV_FILE,
    "utf8"
  );

  const lines = text.trim().split(/\r?\n/);

  const header = lines.shift().replace(
    /^\uFEFF/,
    ""
  );

  if (header.trim() !== "date,asset,close") {
    throw new Error("Unexpected CSV header");
  }

  const data = new Map();

  for (const line of lines) {

    const [date, asset, closeText] =
      line.split(",").map((x) => x.trim());

    const close = Number(closeText);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !ASSETS.some((a) => a.asset === asset) ||
      !Number.isFinite(close) ||
      close <= 0
    ) {
      throw new Error("Invalid CSV row");
    }

    const key = `${asset}|${date}`;

    if (data.has(key)) {
      throw new Error("Duplicate row: " + key);
    }

    data.set(key, close);
  }

  return data;
}


// ==========================================
// 5. DOWNLOAD ONE ASSET IN SHORT WINDOWS
// ==========================================

async function collectAsset(item) {

  const data = new Map();

  for (
    let start = START;
    start < END;
    start += WINDOW_DAYS * DAY_MS
  ) {

    const end = Math.min(
      start + WINDOW_DAYS * DAY_MS,
      END
    );

    // Request neighboring dates too, but
    // accept only timestamps inside the
    // current non-overlapping window.
    const result = await safeInvoke(
      market,
      {
        action: "candlesHistory",
        category: "SPOT",
        symbol: item.symbol,
        interval: "1D",
        startTime: String(start - DAY_MS),
        endTime: String(end + DAY_MS),
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

      const iso = new Date(timestamp)
        .toISOString();

      const date = iso.slice(0, 10);

      if (data.has(date)) {
        throw new Error(
          `${item.asset}: Duplicate ${date}`
        );
      }

      data.set(date, {
        close,
        startUtc: iso
      });
    }

    // Small delay between public requests.
    await new Promise(
      (resolve) => setTimeout(resolve, 200)
    );
  }

  return data;
}


// ==========================================
// 6. COMPARE REPAIRED AND FRESH DATA
// ==========================================

function compareAsset(item, repaired, fresh) {

  const expected = new Map();

  for (const [key, close] of repaired) {

    const [asset, date] = key.split("|");

    if (asset === item.asset) {
      expected.set(date, close);
    }
  }

  const missing = [];
  const mismatchedPrices = [];
  const unexpectedTimes = [];

  for (const [date, expectedClose] of expected) {

    const actual = fresh.get(date);

    if (!actual) {
      missing.push(date);
      continue;
    }

    const tolerance = Math.max(
      0.000001,
      Math.abs(expectedClose) * 1e-8
    );

    if (
      Math.abs(actual.close - expectedClose)
      > tolerance
    ) {
      mismatchedPrices.push({
        date,
        csvClose: expectedClose,
        apiClose: actual.close
      });
    }

    if (
      !actual.startUtc.startsWith(`${date}T16:00:00`)
    ) {
      unexpectedTimes.push({
        date,
        startUtc: actual.startUtc
      });
    }
  }

  const additional = [...fresh.keys()]
    .filter((date) => !expected.has(date));

  console.log(`\n${item.asset}`);
  console.log("-------------------------");
  console.log("Repaired CSV dates:", expected.size);
  console.log("Fresh API dates:", fresh.size);
  console.log("Missing from API:", missing);
  console.log("Price mismatches:", mismatchedPrices);
  console.log("Unexpected timestamps:", unexpectedTimes);
  console.log("API-only dates:", additional);

  return {
    asset: item.asset,
    expected: expected.size,
    fresh: fresh.size,
    missing: missing.length,
    mismatches: mismatchedPrices.length,
    unexpectedTimes: unexpectedTimes.length
  };
}


// ==========================================
// 7. RUN COVERAGE VERIFICATION
// ==========================================

async function main() {

  console.log(
    "\nNEXUS ALPHA - REPAIRED COVERAGE AUDIT"
  );

  const repaired = await loadRepaired();

  console.log(
    "Repaired records:",
    repaired.size
  );

  const summary = [];

  for (const item of ASSETS) {

    console.log(
      `\nDownloading ${item.asset} history...`
    );

    const fresh = await collectAsset(item);

    summary.push(
      compareAsset(item, repaired, fresh)
    );
  }

  console.log("\nFINAL SUMMARY");
  console.log("=============");

  console.table(summary);

  console.log(
    "\nVerification completed. No files changed."
  );
}

main().catch((error) => {

  console.error(
    "Coverage audit failed:",
    error.message
  );

  process.exitCode = 1;
});
