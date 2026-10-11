
import { Client } from
  "@modelcontextprotocol/sdk/client/index.js";

import { StreamableHTTPClientTransport } from
  "@modelcontextprotocol/sdk/client/streamableHttp.js";

// ==========================================
// 1. CONFIGURE MCP CLIENT
// ==========================================

const MCP_URL = "https://agent.bitget.com/mcp";

const client = new Client(
  {
    name: "nexus-alpha-stock-research",
    version: "1.0.0"
  },
  {
    capabilities: {}
  }
);

// ==========================================
// 2. DEFINE DATE RANGE
// ==========================================

const startDate = Date.parse(
  "2026-09-01T00:00:00Z"
);

const endDate = Date.parse(
  "2026-10-01T00:00:00Z"
);

// ==========================================
// 3. DEFINE HISTORICAL DATA TESTS
// ==========================================

const tests = [
  {
    name: "Test 1: Multiple symbols, no dates",

    entry_id: "equity_price_historical",

    params: {
      symbols: "NVDA,TSLA"
    }
  },

  {
    name: "Test 2: NVDA history using seconds",

    entry_id: "equity_price_historical",

    params: {
      symbol: "NVDA",
      start_time: Math.floor(startDate / 1000),
      end_time: Math.floor(endDate / 1000)
    }
  },

  {
    name: "Test 3: NVDA history using milliseconds",

    entry_id: "equity_price_historical",

    params: {
      symbol: "NVDA",
      start_time: startDate,
      end_time: endDate
    }
  }
];

// ==========================================
// 4. CONNECT TO BITGET MCP
// ==========================================

async function main() {
  try {
    const transport =
      new StreamableHTTPClientTransport(
        new URL(MCP_URL)
      );

    console.log("Connecting to Stock MCP...");

    await client.connect(transport);

    console.log("MCP connected successfully!");

    // ======================================
    // 5. EXECUTE EACH TEST
    // ======================================

    for (const test of tests) {
      console.log("\n============================");
      console.log(test.name);
      console.log("============================");

      try {
        const response = await client.callTool({
          name: "do_query",

          arguments: {
            entry_id: test.entry_id,
            params: test.params
          }
        });

        const output =
          response.structuredContent ??
          response.content;

        console.log(
          "MCP error:",
          response.isError ?? false
        );

        console.log(
          JSON.stringify(output, null, 2).slice(0, 3000)
        );

      } catch (error) {
        console.error(
          "Test failed:",
          error.message
        );
      }
    }

  } catch (error) {
    console.error(
      "Connection error:",
      error.message
    );

  } finally {
    await client.close();

    console.log("\nTesting completed.");
  }
}

// ==========================================
// 6. RUN THE PROGRAM
// ==========================================

await main();
