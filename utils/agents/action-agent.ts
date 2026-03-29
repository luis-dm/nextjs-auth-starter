import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { mastra } from "@/utils/mastra-instance";

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

const createGetSchemaKeysTool = (workspace: Workspace) => ({
  id: "get-schema-keys",
  description:
    "Return all property keys available for an IFC category from the schema index (with occurrence counts). " +
    "Call this before filter-elements to discover the actual property key names in this model for a given category.",
  inputSchema: z.object({
    category: z.string().describe("IFC category (e.g., IFCWINDOW, IFCDOOR)"),
  }),
  outputSchema: z.object({
    category: z.string(),
    keys: z.array(
      z.object({
        key: z.string(),
        count: z.number().describe("Number of elements that have this key"),
      }),
    ),
    source: z.enum(["by_category", "global"]),
  }),
  execute: async (params: any) => {
    const category = params.inputData?.category || params.category;
    if (!workspace.filesystem) throw new Error("Filesystem not available");

    let schemaObject: Record<string, number>;
    let source: "by_category" | "global" = "by_category";

    try {
      const raw = await workspace.filesystem.readFile(
        `schema/keys_by_category/${category}.json`,
      );
      schemaObject = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    } catch {
      try {
        const raw = await workspace.filesystem.readFile(
          "schema/keys_global.json",
        );
        schemaObject = JSON.parse(
          typeof raw === "string" ? raw : raw.toString(),
        );
        source = "global";
      } catch {
        return { category, keys: [], source: "by_category" as const };
      }
    }

    const keys = Object.entries(schemaObject)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, count]) => ({ key, count: count as number }))
      .sort((a, b) => b.count - a.count);

    return { category, keys, source };
  },
});

// Filter elements by any combination of: storey, objectType, and numeric property
// conditions (including derived values like area = height × width).
// Source is either a category JSONL (for generic terms) or a list of IDs from
// search-elements (for name-based queries). All filters are ANDed together.
const createFilterElementsTool = (workspace: Workspace) => ({
  id: "filter-elements",
  description:
    "Filter BIM elements by multiple criteria: storey, objectType, and/or numeric property conditions. " +
    "Always call get-schema-keys first to discover the actual property key names for the category. " +
    "Values must be in model units (typically mm or mm²). The LLM must convert real-world units before passing. " +
    "Returns matching element IDs ready for a viewer action.",
  inputSchema: z.object({
    category: z
      .string()
      .optional()
      .describe("IFC category to read from. Provide this OR ids, not both."),
    ids: z
      .array(z.number())
      .optional()
      .describe(
        "Specific element IDs to filter (from search-elements). Provide this OR category.",
      ),
    storeySlug: z
      .string()
      .optional()
      .describe("Only include elements on this storey slug (e.g. '1fl', 'gl')"),
    objectType: z
      .string()
      .optional()
      .describe("Only include elements with this exact ObjectType"),
    filters: z
      .array(
        z.object({
          properties: z
            .array(z.string())
            .min(1)
            .max(2)
            .describe(
              "One or two property key names exactly as returned by get-schema-keys",
            ),
          combiner: z
            .enum(["single", "multiply", "add", "subtract", "divide"])
            .default("single")
            .describe(
              "How to combine two properties into a single value. 'multiply' for area.",
            ),
          operator: z
            .enum(["gt", "gte", "lt", "lte", "eq", "neq"])
            .describe(
              "Comparison operator: gt >, gte >=, lt <, lte <=, eq ==, neq !=",
            ),
          value: z
            .number()
            .describe(
              "Threshold in model units. Convert real-world units (e.g. 5㎡ → 5000000 mm²).",
            ),
        }),
      )
      .min(1)
      .describe(
        "One or more numeric filter conditions — all must be satisfied (AND logic)",
      ),
  }),
  outputSchema: z.object({
    action: z.literal("filter"),
    elementIds: z.array(z.number()),
    count: z.number(),
    skippedCount: z.number(),
    appliedFilters: z.array(
      z.object({
        properties: z.array(z.string()),
        combiner: z.string(),
        operator: z.string(),
        value: z.number(),
      }),
    ),
    error: z.string().optional(),
  }),
  execute: async (params: any) => {
    const category: string | undefined =
      params.inputData?.category || params.category;
    const ids: number[] | undefined = params.inputData?.ids || params.ids;
    const storeySlug: string | undefined =
      params.inputData?.storeySlug || params.storeySlug;
    const objectType: string | undefined =
      params.inputData?.objectType || params.objectType;
    const filters: Array<{
      properties: string[];
      combiner: string;
      operator: string;
      value: number;
    }> = params.inputData?.filters || params.filters || [];

    if (!workspace.filesystem) throw new Error("Filesystem not available");
    if (!category && (!ids || ids.length === 0)) {
      return {
        action: "filter" as const,
        elementIds: [],
        count: 0,
        skippedCount: 0,
        appliedFilters: filters,
        error: "Provide either category or ids",
      };
    }

    const compare = (
      actual: number,
      operator: string,
      threshold: number,
    ): boolean => {
      switch (operator) {
        case "gt":
          return actual > threshold;
        case "gte":
          return actual >= threshold;
        case "lt":
          return actual < threshold;
        case "lte":
          return actual <= threshold;
        case "eq":
          return actual === threshold;
        case "neq":
          return actual !== threshold;
        default:
          return false;
      }
    };

    const computeValue = (
      element: Record<string, any>,
      properties: string[],
      combiner: string,
    ): number | null => {
      const nums = properties.map((key) => Number(element[key]));
      if (nums.some((n) => !Number.isFinite(n))) return null;
      if (combiner === "single" || properties.length === 1) return nums[0];
      if (combiner === "multiply") return nums[0] * nums[1];
      if (combiner === "add") return nums[0] + nums[1];
      if (combiner === "subtract") return nums[0] - nums[1];
      if (combiner === "divide")
        return nums[1] === 0 ? null : nums[0] / nums[1];
      return nums[0];
    };

    const matchesElement = (element: Record<string, any>): boolean => {
      if (storeySlug && element.storeySlug !== storeySlug) return false;
      if (objectType && element.ObjectType !== objectType) return false;
      for (const f of filters) {
        const val = computeValue(element, f.properties, f.combiner);
        if (val === null || !compare(val, f.operator, f.value)) return false;
      }
      return true;
    };

    const matchedIds: number[] = [];
    let skippedCount = 0;

    if (category) {
      let fileContent: string;
      try {
        const raw = await workspace.filesystem.readFile(
          `index/by_category/${category}.jsonl`,
        );
        fileContent = typeof raw === "string" ? raw : raw.toString();
      } catch (err) {
        return {
          action: "filter" as const,
          elementIds: [],
          count: 0,
          skippedCount: 0,
          appliedFilters: filters,
          error: `Could not read index for ${category}: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      for (const line of fileContent.split("\n")) {
        if (!line.trim()) continue;
        try {
          const element = JSON.parse(line);
          if (matchesElement(element))
            matchedIds.push(element._localId ?? element.localId);
          else skippedCount++;
        } catch {
          skippedCount++;
        }
      }
    } else {
      for (const id of ids!) {
        try {
          const raw = await workspace.filesystem.readFile(
            `raw/by_id/${id}.json`,
          );
          const element = JSON.parse(
            typeof raw === "string" ? raw : raw.toString(),
          );
          if (matchesElement(element)) matchedIds.push(id);
          else skippedCount++;
        } catch {
          skippedCount++;
        }
      }
    }

    return {
      action: "filter" as const,
      elementIds: matchedIds,
      count: matchedIds.length,
      skippedCount,
      appliedFilters: filters,
    };
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

    console.log(`[Quick Action] Action: ${action}, File: ${filePath}`);

    // Read and parse JSONL file using filesystem (no external tools needed)
    if (!workspace.filesystem) {
      throw new Error("Filesystem not available");
    }

    const fileContent = await workspace.filesystem.readFile(filePath);
    const content =
      typeof fileContent === "string" ? fileContent : fileContent.toString();

    if (!content || content.trim().length === 0) {
      throw new Error(`File ${filePath} is empty`);
    }

    // Parse JSONL and extract _localId from each line
    const ids: number[] = [];
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (line.trim().length === 0) continue;
      try {
        const obj = JSON.parse(line);
        if (obj._localId !== undefined) {
          ids.push(obj._localId);
        }
      } catch (e) {
        console.warn(
          `[Quick Action] Failed to parse line in ${filePath}:`,
          line.substring(0, 100),
        );
      }
    }

    if (ids.length === 0) {
      throw new Error(`No valid elements with _localId found in ${filePath}`);
    }

    console.log(
      `[Quick Action] Extracted ${ids.length} element IDs from ${filePath}`,
    );

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

  console.log(`[Action Agent] Creating agent for facility: ${facilityId}`);
  console.log(`[Action Agent] BIM_DATA_PATH: ${BIM_DATA_PATH}`);
  console.log(`[Action Agent] Full basePath: ${basePath}`);

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
    model: openai("gpt-4o-mini"),
    mastra,
    memory: new Memory(),
    instructions: `You control 3D viewer actions. Execute commands efficiently.

Strategy: Try quick path first, fallback to search

0. Ultra-fast common generic term mapping (skip list-available for these)
If the user query uses common generic BIM terms, map directly to IFC category and run quick-action immediately:
- windows/window -> IFCWINDOW
- doors/door -> IFCDOOR
- slabs/slab/floors/floor -> IFCSLAB
- walls/wall -> IFCWALL
- columns/column -> IFCCOLUMN
- beams/beam -> IFCBEAM
- roofs/roof -> IFCROOF
- stairs/stair -> IFCSTAIR
- railings/railing -> IFCRAILING
- spaces/space/rooms/room -> IFCSPACE
- furniture/furnishings -> IFCFURNISHINGELEMENT
- pipes/pipe -> IFCPIPESEGMENT
- ducts/duct -> IFCDUCTSEGMENT
- valves/valve -> IFCVALVE
- equipment/mechanical equipment -> IFCMECHANICALEQUIPMENT

When one of these clear mappings matches, do NOT call list-available first.
Go straight to quick-action with index/by_category/<IFC_TYPE>.jsonl.

If quick-action fails (file missing/empty), then fallback to list-available, then search-elements.

For generic terms:
1. Call list-available to check if it's a category/storey
2. If found → use quick-action
3. If NOT found → automatically try search-elements (don't ask user!)

For specific names:
- Skip list-available, go straight to search-elements

1. list-available → quick-action (Fast path for categories)
Examples:
- "select windows" → list-available → find IFCWINDOW → quick-action("index/by_category/IFCWINDOW.jsonl")
- "hide second floor" → list-available → find "2fl" slug → quick-action("index/by_storey/2fl.jsonl")

2. search-elements (Fallback for everything else)
If list-available doesn't find a match, automatically try search-elements - no need to ask user!

Examples:
- "select tanks" → list-available (not found) → search-elements("select tanks") → Done!
- "hide pumps" → list-available (not found) → search-elements("hide pumps") → Done!
- "select HC_コンクリート梁" → search-elements("select HC_コンクリート梁") → Done!

Never ask user for clarification! Just try search-elements if list-available fails.

3. Multi-criteria filtering (storey + property conditions)

Use filter-elements when the query has ANY of: a storey constraint, a numeric threshold, or a computed property condition (area, height, etc.).

Always call get-schema-keys FIRST to discover the actual property key names for that model — they vary ("Height", "height", "OverallHeight", etc.).

Model units are typically mm, so convert real-world values:
  5㎡  → 5_000_000 mm²   (area = height_mm × width_mm)
  3m   → 3_000 mm
  10cm → 100 mm

Path A — generic category term:
  1. list-available → map term to IFC category + find storey slug
  2. get-schema-keys(category) → pick property key(s)
  3. filter-elements(category, storeySlug?, filters, ...)
  4. Return elementIds with the requested action

Path B — specific element name:
  1. search-elements(name) → allIds + matches[0].category
  2. get-schema-keys(category) → pick property key(s)
  3. filter-elements(ids=allIds, storeySlug?, filters, ...)
  4. Return elementIds with the requested action

Example — "show furniture on 1st floor with area > 5㎡":
  → list-available → IFCFURNISHINGELEMENT, slug "1fl"
  → get-schema-keys(IFCFURNISHINGELEMENT) → finds "Length", "Width" keys
  → filter-elements(category="IFCFURNISHINGELEMENT", storeySlug="1fl",
      filters=[{properties:["Length","Width"], combiner:"multiply", operator:"gt", value:5000000}])
  → return {action:"show", elementIds:[...]}

Example — "isolate HC_コンクリート梁 taller than 500mm":
  → search-elements("HC_コンクリート梁") → allIds, category="IFCBEAM"
  → get-schema-keys(IFCBEAM) → finds "Height" key
  → filter-elements(ids=allIds, filters=[{properties:["Height"], combiner:"single", operator:"gt", value:500}])
  → return {action:"isolate", elementIds:[...]}

IF ALL ELSE FAILS:
- Try reading through the filesystem to find relevant files and extract IDs.
- If that did not work, return an empty result with a message "No matches found for [query]".

Return Format

After quick-action or search-elements, return ONLY the tool's JSON output. No explanation or formatting
    `,
    workspace,
    tools: {
      listAvailable: createListAvailableTool(workspace),
      searchElements: createDelegateSearchTool(searchAgent),
      quickAction: createQuickActionTool(workspace),
      formatAction: createFormatActionTool(workspace),
      getSchemaKeys: createGetSchemaKeysTool(workspace),
      filterElements: createFilterElementsTool(workspace),
    },
  });
}
