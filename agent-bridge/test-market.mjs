
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

// 1. Configure the SDK for public market data only.
const config = loadConfig({
  modules: "market",
  readOnly: true
});

// 2. Create the API client.
const client = new BitgetRestClient(config);

// 3. Load available research tools.
const tools = buildTools(config);

// 4. Find the market-data tool.
const market = tools.find(tool => tool.name === "market");

if (!market) {
  console.error("Market-data tool not found.");
  process.exit(1);
}

// 5. Request a public BTCUSDT market snapshot.
try {
  const result = await safeInvoke(
    market,
    {
      action: "tickers",
      category: "SPOT",
      symbol: "BTCUSDT"
    },
    { config, client }
  );

  if (result.ok) {
    console.log("Bitget Agent Hub connection successful!");
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.error("Bitget API error:", result.error);
  }
} catch (error) {
  console.error("Connection failed:", error.message);
}
