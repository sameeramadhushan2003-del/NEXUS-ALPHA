
import { Client } from
  "@modelcontextprotocol/sdk/client/index.js";

import { StreamableHTTPClientTransport } from
  "@modelcontextprotocol/sdk/client/streamableHttp.js";

// ==========================================
// STEP 1: CONFIGURE THE STOCK DATA SERVICE
// ==========================================

const MCP_URL = "https://agent.bitget.com/mcp";

// Create an MCP client for research only.
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
// STEP 2: CONNECT TO THE REMOTE SERVICE
// ==========================================

async function main() {
  try {
    console.log("Connecting to Bitget Stock MCP...");

    const transport =
      new StreamableHTTPClientTransport(
        new URL(MCP_URL)
      );

    await client.connect(transport);

    console.log("MCP connection successful!");

    // ======================================
    // STEP 3: DISCOVER AVAILABLE TOOLS
    // ======================================

    const response = await client.listTools();

    const tools = response.tools ?? [];
    
    // ======================================
    // INSPECT ALL AVAILABLE MCP TOOLS
    // ======================================

    console.log("\nMCP TOOL DETAILS");
    console.log("======================");

    for (const tool of tools) {
      console.log("\nTool name:", tool.name);

      console.log(
        "Description:",
        tool.description ?? "No description available"
      );

      console.log(
        "Required parameters and schema:"
      );

      console.log(
        JSON.stringify(
          tool.inputSchema,
          null,
          2
        )
      );
    }


    console.log(
      "\nTotal available tools:",
      tools.length
    );

    // ======================================
    // STEP 4: FIND HISTORICAL PRICE TOOLS
    // ======================================

    const keywords =
      /stock|histor|price|candle|quote|market|chart|daily/i;

    const matches = tools.filter((tool) => {
      const description = tool.description ?? "";

      return keywords.test(
        `${tool.name} ${description}`
      );
    });

    console.log("\nRELEVANT RESEARCH TOOLS");
    console.log("=======================");

    for (const tool of matches.slice(0, 15)) {
      console.log("\nTool:", tool.name);

      console.log(
        "Description:",
        tool.description ?? "Not provided"
      );

      console.log(
        "Input schema:",
        JSON.stringify(
          tool.inputSchema,
          null,
          2
        )
      );
    }

    if (matches.length === 0) {
      console.log(
        "No matching names found."
      );

      console.log(
        "Available tool names:",
        tools.map((tool) => tool.name)
      );
    }

  } catch (error) {
    console.error(
      "\nMCP connection failed:",
      error.message
    );
  } finally {
    await client.close();
  }
}

// ==========================================
// STEP 5: RUN
// ==========================================

await main();
