import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import { Mastra } from "@mastra/core";
import { createOpenAI } from "@ai-sdk/openai";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as readline from "readline";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";
console.log("Mastra workspace basePath:", basePath);

// Workspace for filesystem queries (your existing skills)
const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath,
    readOnly: true,
  }),
});

// Action tools for 3D viewer manipulation
const selectElementsTool = createTool({
  id: "select-elements",
  description:
    "Select/highlight elements in the 3D viewer. Use the localId field from query results.",
  inputSchema: z.object({
    elementIds: z
      .array(z.number())
      .describe("Array of element IDs (localId field) to select"),
  }),
  outputSchema: z.object({
    action: z.literal("select"),
    elementIds: z.array(z.number()),
    message: z.string(),
  }),
  execute: async ({ elementIds }) => {
    return {
      action: "select" as const,
      elementIds,
      message: `Selected ${elementIds.length} elements`,
    };
  },
});

const hideElementsTool = createTool({
  id: "hide-elements",
  description:
    "Hide elements from the 3D viewer. Use the localId field from query results.",
  inputSchema: z.object({
    elementIds: z
      .array(z.number())
      .describe("Array of element IDs (localId field) to hide"),
  }),
  outputSchema: z.object({
    action: z.literal("hide"),
    elementIds: z.array(z.number()),
    message: z.string(),
  }),
  execute: async ({ elementIds }) => {
    return {
      action: "hide" as const,
      elementIds,
      message: `Hidden ${elementIds.length} elements`,
    };
  },
});

const showElementsTool = createTool({
  id: "show-elements",
  description:
    "Show previously hidden elements. Use the localId field from query results.",
  inputSchema: z.object({
    elementIds: z
      .array(z.number())
      .describe("Array of element IDs (localId field) to show"),
  }),
  outputSchema: z.object({
    action: z.literal("show"),
    elementIds: z.array(z.number()),
    message: z.string(),
  }),
  execute: async ({ elementIds }) => {
    return {
      action: "show" as const,
      elementIds,
      message: `Shown ${elementIds.length} elements`,
    };
  },
});

const isolateElementsTool = createTool({
  id: "isolate-elements",
  description:
    "Hide all elements except the specified ones (focus mode). Use the localId field from query results.",
  inputSchema: z.object({
    elementIds: z
      .array(z.number())
      .describe("Array of element IDs (localId field) to keep visible"),
  }),
  outputSchema: z.object({
    action: z.literal("isolate"),
    elementIds: z.array(z.number()),
    message: z.string(),
  }),
  execute: async ({ elementIds }) => {
    return {
      action: "isolate" as const,
      elementIds,
      message: `Isolated ${elementIds.length} elements`,
    };
  },
});

// Export the action tools so they can be reused
export {
  selectElementsTool,
  hideElementsTool,
  showElementsTool,
  isolateElementsTool,
};

const bimAgent = new Agent({
  id: "bimAgent",
  name: "BIM Query Assistant",
  model: openai("gpt-5-nano"),
  instructions: `You are a BIM assistant with access to IFC model data and 3D viewer controls.

## Data Access (via workspace skills)

Use the filesystem to query BIM data:
- schema/categories.json - Available IFC types
- schema/storeys.json - Building floors with slugs
- index/by_category/{CATEGORY}.jsonl - Elements by type
- index/by_storey/{storey_slug}.jsonl - Elements by floor
- raw/by_id/{element_id}.json - Detailed element properties

## Actions (via tools)

You have these action tools:
- select-elements: Highlight elements
- hide-elements: Hide elements
- show-elements: Show hidden elements
- isolate-elements: Focus on specific elements

## CRITICAL Workflow for Actions

When user wants to SELECT, HIDE, SHOW, or ISOLATE:

1. Query the data to find elements (use workspace filesystem)
2. Extract the **localId** field from each result
3. IMMEDIATELY call the action tool with those IDs
4. DO NOT generate explanatory text

Example: "select all slabs"
Step 1: Read index/by_category/IFCSLAB.jsonl
Step 2: Extract localId values: [166729, 166811]
Step 3: Call select-elements with elementIds: [166729, 166811]

DO NOT say "I found 2 slabs, selecting them now" - just call the tool.`,
  workspace,
  tools: {
    selectElementsTool,
    hideElementsTool,
    showElementsTool,
    isolateElementsTool,
  },
});

export const mastra = new Mastra({
  agents: { bimAgent },
});

async function main() {
  console.log("\n🏗️  BIM Chatbot");
  console.log("Type 'exit' to quit\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  while (true) {
    const userInput = await askQuestion("You: ");

    if (!userInput.trim() || userInput.toLowerCase() === "exit") {
      console.log("\nGoodbye!\n");
      rl.close();
      break;
    }

    try {
      const result = await bimAgent.generate(userInput);

      console.log(`\nAssistant: ${result.text}\n`);
    } catch (error) {
      console.error(
        "\n❌ Error:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
