
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

// ==========================================
// STEP 1: Configure the SDK
// ==========================================

const config = loadConfig({
  modules: "market",
  readOnly: true
});

const client = new BitgetRestClient(config);

const tools = buildTools(config);

const context = {
  config,
  client
};

// ==========================================
// STEP 2: Get the required tools
// ==========================================

const market = tools.find(
  (tool) => tool.name === "market"
);

const discover = tools.find(
  (tool) => tool.name === "discover"
);

if (!market || !discover) {
  throw new Error("Required SDK tools unavailable");
}

// ==========================================
// STEP 3: Inspect historical-data support
// ==========================================

console.log("\nHISTORICAL DATA TOOL:");

const schema = await safeInvoke(
  discover,
  {
    tool: "market",
    action: "candlesHistory"
  },
  context
);

console.log(
  JSON.stringify(schema.data ?? schema.error, null, 2)
);

// ==========================================
// STEP 4: Select the historical date range
// ==========================================

const startTime = Date.parse(
  "2026-06-01T00:00:00Z"
).toString();

const endTime = Date.parse(
  "2026-06-15T00:00:00Z"
).toString();

// ==========================================
// STEP 5: Request historical BTC prices
// ==========================================

console.log("\nFETCHING HISTORICAL CANDLES...");

const result = await safeInvoke(
  market,
  {
    action: "candlesHistory",
    category: "SPOT",
    symbol: "BTCUSDT",
    interval: "1D",
    startTime,
    endTime,
    limit: "10"
  },
  context
);

// ==========================================
// STEP 6: Display the result
// ==========================================

if (result.ok) {
  console.log("\nSUCCESS!");

  console.log(
    JSON.stringify(result.data, null, 2)
  );
} else {
  console.error("\nREQUEST FAILED:");

  console.error(
    JSON.stringify(result.error, null, 2)
  );
}
