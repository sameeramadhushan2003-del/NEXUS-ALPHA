
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

import {
  readFile,
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
  throw new Error("Bitget market tool not found");
}


// ==========================================
// 2. DEFINE FILE PATHS
// ==========================================

const FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "data"
);

const ORIGINAL_FILE = path.join(
  FOLDER,
  "cross_market_history.csv"
);

const REPAIRED_FILE = path.join(
  FOLDER,
  "cross_market_history_repaired.csv"
);

const REPORT_FILE = path.join(
  FOLDER,
  "cross_market_repair_report.json"
);


// ==========================================
// 3. DEFINE DATES AND ASSETS
// ==========================================

const DATES = [
  "2026-07-30",
  "2026-09-28"
];

const ASSETS = [
  { asset: "rNVDA", symbol: "RNVDAUSDT" },
  { asset: "rTSLA", symbol: "RTSLAUSDT" },
  { asset: "BTC", symbol: "BTCUSDT" }
];

const DAY_MS = 24 * 60 * 60 * 1000;


// ==========================================
// 4. READ ORIGINAL HISTORICAL CSV
// ==========================================

async function loadOriginalData() {

  const content = await readFile(
    ORIGINAL_FILE,
    "utf8"
  );

  const lines = content
    .trim()
    .split(/\r?\n/);

  const header = lines
    .shift()
    .replace(/^\uFEFF/, "")
    .trim();

  if (header !== "date,asset,close") {
    throw new Error(
      "Unexpected CSV header: " + header
    );
  }

  const records = new Map();

  for (const line of lines) {

    const fields = line.split(",");

    if (fields.length !== 3) {
      throw new Error("Invalid CSV record");
    }

    const [date, asset, rawClose] =
      fields.map((value) => value.trim());

    const close = Number(rawClose);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !ASSETS.some((item) => item.asset === asset) ||
      !Number.isFinite(close) ||
      close <= 0
    ) {
      throw new Error(
        "Invalid historical record: " + line
      );
    }

    const key = `${date}|${asset}`;

    if (records.has(key)) {
      throw new Error(
        "Duplicate original record: " + key
      );
    }

    records.set(key, {
      date,
      asset,
      close
    });
  }

  return records;
}


// ==========================================
// 5. FETCH A VERIFIED DAILY CANDLE
// ==========================================

async function fetchDailyCandle(item, date) {

  const target = Date.parse(
    `${date}T00:00:00Z`
  );

  const result = await safeInvoke(
    market,
    {
      action: "candlesHistory",
      category: "SPOT",
      symbol: item.symbol,
      interval: "1D",
      startTime: String(target - 2 * DAY_MS),
      endTime: String(target + 2 * DAY_MS),
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
  
  // ========================================
  // DEBUG: INSPECT RETURNED DAILY CANDLES
  // ========================================

  console.log(
    `\nChecking ${item.asset} on ${date}`
  );

  console.log(
    "Expected UTC timestamp:",
    new Date(target).toISOString()
  );

  const returnedCandles = result.data
    .filter((row) => {
      return Array.isArray(row) &&
        Number.isFinite(Number(row[0]));
    })
    .map((row) => ({
      utcTime: new Date(
        Number(row[0])
      ).toISOString(),

      close: Number(row[4])
    }));

  console.table(returnedCandles);


  
const matching = result.data.filter((row) => {

  if (!Array.isArray(row) || row.length < 6) {
    return false;
  }

  const timestamp = Number(row[0]);

  if (!Number.isSafeInteger(timestamp)) {
    return false;
  }

  // Match the UTC calendar date instead of
  // requiring the candle timestamp to be midnight.
  return (
    timestamp >= target &&
    timestamp < target + DAY_MS
  );
});


  if (matching.length !== 1) {
    throw new Error(
      `${item.asset} ${date}: Expected exactly ` +
      `one UTC daily candle; found ${matching.length}`
    );
  }

  const candle = matching[0];

  const close = Number(candle[4]);

  if (
    !Number.isFinite(close) ||
    close <= 0
  ) {
    throw new Error(
      `${item.asset} ${date}: Invalid close`
    );
  }

  return {
  date,
  asset: item.asset,
  close,

  // Keep original timestamp for auditing.
  candleTimestampUtc: new Date(
    Number(candle[0])
  ).toISOString()
};
}


// ==========================================
// 6. BUILD THE REPAIRED DATASET
// ==========================================

async function main() {

  console.log("\nNEXUS ALPHA - DATA REPAIR");
  console.log("=========================");

  const records = await loadOriginalData();

  const originalCount = records.size;

  const recovered = [];

  for (const date of DATES) {

    for (const item of ASSETS) {

      const key = `${date}|${item.asset}`;

      if (records.has(key)) {
        throw new Error(
          "Date already exists in original CSV: " +
          key
        );
      }

      const observation = await fetchDailyCandle(
        item,
        date
      );

      records.set(key, observation);

      recovered.push(observation);

      console.log(
        `Recovered ${observation.asset} ` +
        `${date}: ${observation.close}`
      );
    }
  }


  // ========================================
  // 7. VALIDATE COMPLETE MATCHED DATES
  // ========================================

  const dates = [
    ...new Set(
      [...records.values()].map(
        (row) => row.date
      )
    )
  ];

  for (const date of dates) {

    for (const item of ASSETS) {

      if (!records.has(`${date}|${item.asset}`)) {
        throw new Error(
          `Incomplete date: ${date}`
        );
      }
    }
  }


  // ========================================
  // 8. SORT THE DATASET
  // ========================================

  const sorted = [...records.values()].sort(
    (a, b) => {
      return (
        a.date.localeCompare(b.date) ||
        a.asset.localeCompare(b.asset)
      );
    }
  );


  // ========================================
  // 9. SAVE NEW CSV
  // ========================================

  const csvLines = [
    "date,asset,close",
    ...sorted.map((row) => {
      return [
        row.date,
        row.asset,
        row.close
      ].join(",");
    })
  ];

  await writeFile(
    REPAIRED_FILE,
    csvLines.join("\n") + "\n",
    "utf8"
  );


  // ========================================
  // 10. SAVE REPAIR REPORT
  // ========================================

  const report = {
    project: "NEXUS ALPHA",
    source: "Bitget Agent Hub",
    interval: "1D",
    originalRecords: originalCount,
    recoveredRecords: recovered.length,
    totalRecords: sorted.length,
    matchedDates: dates.length,
    recovered,
    unresolvedDate: "2026-06-06",
    note: (
      "Only verified Bitget daily closes were used. " +
      "No prices were estimated or forward-filled."
    )
  };

  await writeFile(
    REPORT_FILE,
    JSON.stringify(report, null, 2),
    "utf8"
  );


  // ========================================
  // 11. DISPLAY RESULTS
  // ========================================

  console.log("\nREPAIR COMPLETE");
  console.log("======================");

  console.log("Original records:", originalCount);
  console.log("Recovered records:", recovered.length);
  console.log("Total records:", sorted.length);
  console.log("Matched dates:", dates.length);

  console.log("\nCSV:", REPAIRED_FILE);
  console.log("Report:", REPORT_FILE);

  console.log(
    "\nOriginal historical CSV was not modified."
  );
}


// ==========================================
// 12. RUN
// ==========================================

main().catch((error) => {
  console.error(
    "\nRepair failed:",
    error.message
  );

  process.exitCode = 1;
});
