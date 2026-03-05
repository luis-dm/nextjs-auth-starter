import { Agent } from "@mastra/core/agent";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const createDelegateSearchTool = (searchAgent: Agent) => ({
  id: "search-elements",
  description:
    "Search for BIM elements by name/type and format action in ONE step. Use when query mentions specific object names (not generic IFC categories). Automatically extracts action verb and formats output - NO need to call format-action after!",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Full user query including action (e.g., 'select HC_コンクリート梁', 'hide gate valves')",
      ),
    action: z
      .enum(["select", "hide", "show", "isolate"])
      .optional()
      .describe(
        "Action to perform (auto-extracted from query if not provided)",
      ),
  }),
  outputSchema: z.object({
    action: z.enum(["select", "hide", "show", "isolate"]),
    elementIds: z.array(z.number()),
    count: z.number(),
    message: z.string(),
  }),
  execute: async (params: any) => {
    const query = params.inputData?.query || params.query;
    let action = params.inputData?.action || params.action;

    // Auto-extract action verb from query if not provided
    if (!action) {
      const actionMatch = query.match(/^(select|hide|show|isolate)\s+/i);
      action = actionMatch ? actionMatch[1].toLowerCase() : "select";
    }

    // Extract search term (remove action verb)
    const searchTerm = query
      .replace(/^(select|hide|show|isolate)\s+/i, "")
      .trim();

    console.log(`[Action Agent] Search: "${searchTerm}", Action: ${action}`);

    // Delegate to search agent
    const result = await searchAgent.generate(searchTerm);

    // Parse the response - search agent returns tool output
    if (result.steps && result.steps.length > 0) {
      for (const step of result.steps) {
        if (step.toolResults && step.toolResults.length > 0) {
          const toolResult = step.toolResults[0];
          const data =
            toolResult.payload?.result || toolResult.payload || toolResult;

          // Format and return immediately - no LLM needed!
          if ((data as any).totalIds > 0 || (data as any).allIds?.length > 0) {
            const searchData = data as {
              matches: any[];
              totalIds: number;
              allIds: number[];
              query: string;
            };
            return {
              action: action as "select" | "hide" | "show" | "isolate",
              elementIds: searchData.allIds,
              count: searchData.allIds.length,
              message: `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${searchData.allIds.length} elements`,
            };
          }
        }
      }
    }

    // No results found
    return {
      action: action as "select" | "hide" | "show" | "isolate",
      elementIds: [],
      count: 0,
      message: `No matches found for "${searchTerm}"`,
    };
  },
});

const createFormatActionTool = (workspace: Workspace) => ({
  id: "format-action",
  description:
    "Format extracted IDs into viewer action JSON. Use this after extracting IDs with scripts. Handles thousands of IDs efficiently without LLM processing.",
  inputSchema: z.object({
    action: z.enum(["select", "hide", "show", "isolate"]),
    scriptOutput: z
      .string()
      .describe("Raw output from ID extraction script (one ID per line)"),
    message: z.string().optional().describe("Optional custom message"),
  }),
  outputSchema: z.object({
    action: z.enum(["select", "hide", "show", "isolate"]),
    elementIds: z.array(z.number()),
    count: z.number(),
    message: z.string(),
  }),
  execute: async (params: any) => {
    const action = params.inputData?.action || params.action;
    const scriptOutput = params.inputData?.scriptOutput || params.scriptOutput;
    const customMessage = params.inputData?.message || params.message;

    const ids = scriptOutput
      .trim()
      .split("\n")
      .filter((line: string) => line.length > 0)
      .map((line: string) => parseInt(line.trim(), 10))
      .filter((id: number) => !isNaN(id));

    const message =
      customMessage ||
      `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${ids.length} elements`;

    return {
      action,
      elementIds: ids,
      count: ids.length,
      message,
    };
  },
});

const createListAvailableTool = (workspace: Workspace) => ({
  id: "list-available",
  description:
    "List available IFC categories and storeys from the current BIM model. Use this FIRST before quick-action if you're unsure whether a category or storey exists, or to map user terms (like 'ground floor') to actual slugs.",
  inputSchema: z.object({
    type: z
      .enum(["categories", "storeys", "both"])
      .optional()
      .default("both")
      .describe("What to list"),
  }),
  outputSchema: z.object({
    categories: z
      .array(
        z.object({
          category: z.string(),
          count: z.number(),
        }),
      )
      .optional(),
    storeys: z
      .array(
        z.object({
          name: z.string(),
          slug: z.string(),
          type: z.string(),
        }),
      )
      .optional(),
  }),
  execute: async (params: any) => {
    const type = params.inputData?.type || params.type || "both";
    const result: any = {};

    if (!workspace.filesystem) {
      throw new Error("Filesystem not available");
    }

    if (type === "categories" || type === "both") {
      const catFile = await workspace.filesystem.readFile(
        "schema/categories.json",
      );
      const catContent =
        typeof catFile === "string" ? catFile : catFile.toString();
      result.categories = JSON.parse(catContent);
    }

    if (type === "storeys" || type === "both") {
      const storeyFile = await workspace.filesystem.readFile(
        "schema/storeys.json",
      );
      const storeyContent =
        typeof storeyFile === "string" ? storeyFile : storeyFile.toString();
      result.storeys = JSON.parse(storeyContent);
    }

    return result;
  },
});

const createQuickActionTool = (workspace: Workspace) => ({
  id: "quick-action",
  description:
    "FASTEST way to perform simple actions on entire categories or storeys. Extracts IDs and formats in ONE step. Use this for simple queries like 'select all windows' or 'hide second floor'. For complex queries needing filtering, use scripts + format-action instead.",
  inputSchema: z.object({
    filePath: z
      .string()
      .describe(
        'JSONL file path relative to bim_fs (e.g., "index/by_category/IFCDOOR.jsonl" or "index/by_storey/2fl.jsonl")',
      ),
    action: z
      .enum(["select", "hide", "show", "isolate"])
      .describe("Action to perform"),
  }),
  outputSchema: z.object({
    action: z.enum(["select", "hide", "show", "isolate"]),
    elementIds: z.array(z.number()),
    count: z.number(),
    message: z.string(),
  }),
  execute: async (params: any) => {
    const filePath = params.inputData?.filePath || params.filePath;
    const action = params.inputData?.action || params.action;

    const sandbox = workspace.sandbox as LocalSandbox;

    // console.log(`Quick action: ${action} from ${filePath}`);

    // Use jq to extract _localId - works on macOS/Linux
    const result = await sandbox.executeCommand(
      "jq",
      ["-r", "._localId", filePath],
      {},
    );

    if (!result?.stdout || result.stdout.trim().length === 0) {
      throw new Error(
        `No elements in ${filePath}. File may be empty or path incorrect.`,
      );
    }

    const ids = result.stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => parseInt(line.trim(), 10))
      .filter((id) => !isNaN(id));

    if (ids.length === 0) {
      throw new Error(`Could not extract valid IDs from ${filePath}`);
    }

    // console.log(`${action} ${ids.length} elements from ${filePath}`);

    return {
      action: action as "select" | "hide" | "show" | "isolate",
      elementIds: ids,
      count: ids.length,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${ids.length} elements`,
    };
  },
});
export function createActionAgent(facilityId: string, searchAgent: Agent) {
  const BIM_DATA_PATH = process.env.BIM_DATA_PATH || "./public/bim_data";
  const basePath = `${BIM_DATA_PATH}/${facilityId}/ai/bim_fs`;

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath,
      readOnly: true,
    }),
    sandbox: new LocalSandbox({
      workingDirectory: basePath,
    }),
  });

  return new Agent({
    id: "action",
    name: "Viewer Action Agent",
    model: openai("gpt-5-nano"),
    instructions: `You control 3D viewer actions. Execute commands efficiently.

    ## Tool Priority

### Strategy: Try quick path first, fallback to search

For generic terms:
1. Call list-available to check if it's a category/storey
2. If found → use quick-action
3. If NOT found → automatically try search-elements (don't ask user!)

For specific names:
- Skip list-available, go straight to search-elements

### 1. list-available → quick-action (Fast path for categories)
Examples:
- "select windows" → list-available → find IFCWINDOW → quick-action("index/by_category/IFCWINDOW.jsonl")
- "hide second floor" → list-available → find "2fl" slug → quick-action("index/by_storey/2fl.jsonl")

### 2. search-elements (Fallback for everything else)
If list-available doesn't find a match, automatically try search-elements - no need to ask user!

Examples:
- "select tanks" → list-available (not found) → search-elements("select tanks") → Done!
- "hide pumps" → list-available (not found) → search-elements("hide pumps") → Done!
- "select HC_コンクリート梁" → search-elements("select HC_コンクリート梁") → Done!

**Never ask user for clarification! Just try search-elements if list-available fails.**

### 3. Complex filtering - Intersections or property filters
For queries requiring multiple criteria:
1. Use list-available to verify categories/storeys exist
2. Run intersection.sh or custom filter scripts via skills
3. Pass results to format-action

Example: "windows on first floor"
1. list-available → verify IFCWINDOW exists and get floor slug
2. Run intersection script → get IDs
3. format-action with results

IF ALL ELSE FAILS:
- Try reading through the filesystem to find relevant files and extract IDs.
- If that did not work, return an empty result with a message "No matches found for [query]".

## Return Format

After quick-action or search-elements, return ONLY the tool's JSON output. No explanation or formatting
    `,
    workspace,
    tools: {
      quickActionTool: createQuickActionTool(workspace),
    },
  });
}
