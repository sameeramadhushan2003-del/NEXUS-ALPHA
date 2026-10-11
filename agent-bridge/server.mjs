
import { createServer } from "node:http";

import {
  loadConfig,
  buildTools,
  BitgetRestClient,
  safeInvoke
} from "@bitget-ai/bitget-agent-sdk";

// Configure Bitget in read-only mode.
const config = loadConfig({
  modules: "market",
  readOnly: true
});

const client = new BitgetRestClient(config);
const tools = buildTools(config);

const market = tools.find(tool => tool.name === "market");

if (!market) {
  throw new Error("Bitget market tool not found");
}

// Public research symbols for our initial test.
const allowedSymbols = new Set([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT"
]);

// Send JSON responses to the client.
function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

// Create our local API server.
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method !== "GET") {
    return sendJSON(res, 405, {
      error: "Only GET requests are supported"
    });
  }

  // API health check.
  if (url.pathname === "/health") {
    return sendJSON(res, 200, {
      status: "ok",
      service: "NEXUS ALPHA Agent Hub",
      readOnly: true
    });
  }

  // Public market ticker endpoint.
  if (url.pathname === "/market/ticker") {
    const symbol = (
      url.searchParams.get("symbol") || "BTCUSDT"
    ).toUpperCase();

    if (!allowedSymbols.has(symbol)) {
      return sendJSON(res, 400, {
        error: "Unsupported market symbol"
      });
    }

    try {
      const result = await safeInvoke(
        market,
        {
          action: "tickers",
          category: "SPOT",
          symbol
        },
        { config, client }
      );

      if (!result.ok) {
        return sendJSON(res, 502, {
          error: "Bitget market request failed"
        });
      }

      return sendJSON(res, 200, {
        source: "Bitget Agent Hub",
        category: "SPOT",
        symbol,
        fetchedAt: new Date().toISOString(),
        data: result.data
      });

    } catch (error) {
      console.error(error);

      return sendJSON(res, 502, {
        error: "Unable to retrieve market data"
      });
    }
  }

  sendJSON(res, 404, {
    error: "Endpoint not found"
  });
});

// Start the server on port 8001.
server.listen(8001, "127.0.0.1", () => {
  console.log("NEXUS ALPHA Agent Hub API running");
  console.log("http://127.0.0.1:8001");
});
