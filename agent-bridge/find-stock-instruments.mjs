
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

// ==========================================
// STEP 1: Configure Bitget Agent Hub
// ==========================================

const config = loadConfig({
  modules: "market",
  readOnly: true
});

const client = new BitgetRestClient(config);

const tools = buildTools(config);

// ==========================================
// STEP 2: Get the market tool
// ==========================================

const market = tools.find(
  (tool) => tool.name === "market"
);

if (!market) {
  throw new Error("Market tool not found");
}

// ==========================================
// STEP 3: Request available spot instruments
// ==========================================

console.log("Fetching Bitget spot instruments...");

const result = await safeInvoke(
  market,
  {
    action: "instruments",
    category: "SPOT"
  },
  {
    config,
    client
  }
);

if (!result.ok) {
  console.error(
    "Request failed:",
    JSON.stringify(result.error, null, 2)
  );

  process.exit(1);
}

// ==========================================
// STEP 4: Extract the instrument list
// ==========================================

const payload = result.data;

let instruments = [];

if (Array.isArray(payload)) {
  instruments = payload;
} else if (Array.isArray(payload?.list)) {
  instruments = payload.list;
} else if (Array.isArray(payload?.data)) {
  instruments = payload.data;
} else {
  console.log("Unexpected response structure:");
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(
  "\nTotal instruments returned:",
  instruments.length
);

// ==========================================
// STEP 5: Search for stock-related names
// ==========================================

const keywords = [
  "NVDA",
  "TSLA",
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "SPY",
  "QQQ",
  "MSTR",
  "XSTOCK",
  "STOCK"
];

const matches = instruments.filter((item) => {
  const name = String(
    item.symbol ?? item.symbolName ?? ""
  ).toUpperCase();

  return keywords.some(
    (keyword) => name.includes(keyword)
  );
});

// ==========================================
// STEP 6: Display possible candidates
// ==========================================

console.log("\nSTOCK-RELATED CANDIDATES:");
console.log("=========================");

if (matches.length === 0) {
  console.log(
    "No matching symbols found in this spot list."
  );
} else {
  for (const item of matches.slice(0, 50)) {
    console.log({
      symbol: item.symbol,
      baseCoin: item.baseCoin,
      quoteCoin: item.quoteCoin,
      status: item.status
    });
  }
}

console.log("\nSearch completed.");
