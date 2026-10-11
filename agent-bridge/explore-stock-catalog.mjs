
import { Client } from
  "@modelcontextprotocol/sdk/client/index.js";

import { StreamableHTTPClientTransport } from
  "@modelcontextprotocol/sdk/client/streamableHttp.js";

// ==========================================
// STEP 1: CONFIGURE MCP CONNECTION
// ==========================================

const MCP_URL = "https://agent.bitget.com/mcp";

const client = new Client(
  {
    name: "nexus-alpha-research",
    version: "1.0.0"
  },
  {
    capabilities: {}
  }
);

// ==========================================
// STEP 2: CONNECT TO BITGET MCP
// ==========================================

async function main() {
  try {
    const transport =
      new StreamableHTTPClientTransport(
        new URL(MCP_URL)
      );

    console.log("Connecting to Bitget MCP...");

    await client.connect(transport);

    console.log("Connected successfully!");

    // ======================================
    // STEP 3: CALL THE GUIDE TOOL
    // ======================================

    console.log("\nDISCOVERING DATA CATEGORIES");
    console.log("==========================");

    
const response = await client.callTool({
  name: "guide",

  arguments: {
    category: "equity"
  }
});


    // ======================================
    // STEP 4: DISPLAY THE RESPONSE
    // ======================================

    if (response.isError) {
      console.error("Guide tool returned an error.");
    }

    
if (response.structuredContent) {
  // Print structured JSON when available.
  console.log(
    JSON.stringify(
      response.structuredContent,
      null,
      2
    )
  );
} else {
  // Otherwise, print the text response.
  for (const item of response.content ?? []) {
    if (item.type === "text") {
      console.log(item.text);
    }
  }
}


  } catch (error) {
    console.error(
      "MCP request failed:",
      error.message
    );
  } finally {
    await client.close();
  }
}

// ==========================================
// STEP 5: EXECUTE
// ==========================================

await main();
