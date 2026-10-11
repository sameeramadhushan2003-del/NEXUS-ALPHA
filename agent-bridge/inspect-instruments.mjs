
import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

// STEP 1: Configure public market access.
const config = loadConfig({
  modules: "market",
  readOnly: true
});

// STEP 2: Create the SDK client.
const client = new BitgetRestClient(config);

// STEP 3: Load SDK tools.
const tools = buildTools(config);

// STEP 4: Find the discovery tool.
const discover = tools.find(
  (tool) => tool.name === "discover"
);

if (!discover) {
  throw new Error("Discovery tool unavailable");
}

// STEP 5: Inspect the instruments operation.
const result = await safeInvoke(
  discover,
  {
    tool: "market",
    action: "instruments"
  },
  {
    config,
    client
  }
);

// STEP 6: Display the supported parameters.
if (result.ok) {
  console.log("\nINSTRUMENTS API DETAILS:");

  console.log(
    JSON.stringify(result.data, null, 2)
  );
} else {
  console.error(
    JSON.stringify(result.error, null, 2)
  );
}
