import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { mastra } from "@/utils/mastra-instance";

const createDelegateSearchTool = (searchAgent: Agent) => ({
  id: "search-elements",
  description:
    "Search for BIM elements by name/type/description. Returns structured results with IDs and counts. Use for name-based queries like 'Breuer chairs', 'gate valves', 'HC_コンクリート梁'.",
  inputSchema: z.object({
    query: z.string().describe("Search term (e.g., 'breuer', 'gate', 'pump')"),
  }),
  outputSchema: z.object({
    matches: z.array(
      z.object({
        objectType: z.string(),
        category: z.string(),
        count: z.number(),
      }),
    ),
    totalIds: z.number(),
    allIds: z.array(z.number()),
    query: z.string(),
  }),
  execute: async (params: any) => {
    const query = params.inputData?.query || params.query;
    const result = await searchAgent.generate(query);

    // Extract search results from agent response
    if (result.steps && result.steps.length > 0) {
      for (const step of result.steps) {
        if (step.toolResults && step.toolResults.length > 0) {
          const toolResult = step.toolResults[0];
          const data =
            toolResult.payload?.result || toolResult.payload || toolResult;
          if (data && (data as any).allIds) return data;
        }
      }
    }

    return { matches: [], totalIds: 0, allIds: [], query };
  },
});

const createListAvailableTool = (workspace: Workspace) => ({
  id: "list-available",
  description:
    "List available IFC categories and storeys from the current BIM model. Use this to check if a generic term (doors, windows, floors) exists as a category/storey before using scripts.",
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

const createGetPropertiesTool = (workspace: Workspace) => ({
  id: "get-properties",
  description:
    "Get property keys for a specific ObjectType from the JSONL index. Returns list of non-underscore property names.",
  inputSchema: z.object({
    objectType: z.string().describe("The ObjectType to get properties for"),
    category: z
      .string()
      .describe("The IFC category (e.g., IFCDOOR, IFCWINDOW)"),
  }),
  outputSchema: z.object({
    properties: z.array(z.string()),
    sampleElement: z.record(z.any()).optional(),
  }),
  execute: async (params: any) => {
    const objectType = params.inputData?.objectType || params.objectType;
    const category = params.inputData?.category || params.category;

    if (!workspace.filesystem) {
      throw new Error("Filesystem not available");
    }

    // Read the JSONL file for this category
    const filePath = `index/by_category/${category}.jsonl`;
    const fileContent = await workspace.filesystem.readFile(filePath);
    const content =
      typeof fileContent === "string" ? fileContent : fileContent.toString();

    // Find the first line matching this ObjectType
    const lines = content.split("\n").filter((line) => line.trim());
    const matchingLine = lines.find((line) => {
      try {
        const obj = JSON.parse(line);
        return obj.ObjectType === objectType;
      } catch {
        return false;
      }
    });

    if (!matchingLine) {
      return {
        properties: [],
        error: `No element found with ObjectType: ${objectType}`,
      };
    }

    const element = JSON.parse(matchingLine);

    // Extract non-underscore keys
    const properties = Object.keys(element).filter(
      (key) => !key.startsWith("_"),
    );

    return {
      properties,
      sampleElement: element,
    };
  },
});

// Fast counting tool using filesystem (no shell dependencies)
const createCountTool = (workspace: Workspace) => ({
  id: "count-elements",
  description:
    "Count elements in JSONL files. Use for queries like 'how many doors' or 'count of elements on floor 2'.",
  inputSchema: z.object({
    filePath: z
      .string()
      .describe(
        "JSONL file path (e.g., 'index/by_category/IFCDOOR.jsonl' or 'index/by_storey/2fl.jsonl')",
      ),
  }),
  outputSchema: z.object({
    count: z.number(),
    filePath: z.string(),
  }),
  execute: async (params: any) => {
    const filePath = params.inputData?.filePath || params.filePath;

    if (!workspace.filesystem) {
      throw new Error("Filesystem not available");
    }

    try {
      const fileContent = await workspace.filesystem.readFile(filePath);
      const content =
        typeof fileContent === "string" ? fileContent : fileContent.toString();

      // Count non-empty lines
      const count = content
        .split("\n")
        .filter((line) => line.trim().length > 0).length;

      console.log(`[Count] ${filePath}: ${count} elements`);

      return { count, filePath };
    } catch (error) {
      console.warn(
        `[Count] Could not read ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
      return { count: 0, filePath };
    }
  },
});

// Returns the list of property keys present in a category's schema (with occurrence counts).
// The agent uses this to discover what properties are actually available before aggregating.
const createGetSchemaKeysTool = (workspace: Workspace) => ({
  id: "get-schema-keys",
  description:
    "Return all property keys available for an IFC category from the schema index (with occurrence counts). " +
    "Use this BEFORE aggregate-property to discover what property names exist in this model so you can pick the right key(s) for the user's query.",
  inputSchema: z.object({
    category: z.string().describe("IFC category (e.g., IFCWINDOW, IFCDOOR)"),
  }),
  outputSchema: z.object({
    category: z.string(),
    keys: z.array(
      z.object({
        key: z.string(),
        count: z
          .number()
          .describe("How many elements in this category have this key"),
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

// Generic aggregation tool — works for any numeric property or derived
// expression of two properties (multiply, add, subtract, divide).
// The agent is responsible for choosing the right property key(s) after
// inspecting schema keys so this tool never assumes fixed names.
const createAggregatePropertyTool = (workspace: Workspace) => ({
  id: "aggregate-property",
  description:
    "Aggregate numeric values of one or more element properties across a category. " +
    "Call get-schema-keys first to identify the correct property name(s) for this model. " +
    "Supports any numeric property (dimensions, ratings, areas, prices, counts, etc.) " +
    "and derived values computed from two properties (e.g. height × width for area).",
  inputSchema: z.object({
    category: z.string().describe("IFC category to read from"),
    properties: z
      .array(z.string())
      .min(1)
      .max(2)
      .describe(
        "One or two property key names to use, exactly as they appear in get-schema-keys output. " +
          "Single key for direct aggregation. Two keys when a combiner is needed (e.g. multiply for area).",
      ),
    combiner: z
      .enum(["single", "multiply", "add", "subtract", "divide"])
      .default("single")
      .describe(
        "How to combine two properties per element before aggregating. " +
          "'single' when properties has exactly one key. " +
          "'multiply' for area (height × width). " +
          "'add' / 'subtract' / 'divide' for other derived values.",
      ),
    aggregation: z
      .enum(["sum", "average", "min", "max"])
      .default("average")
      .describe(
        "Statistical aggregation to apply across all matching elements",
      ),
    objectType: z
      .string()
      .optional()
      .describe("Narrow to a specific ObjectType within the category"),
    storeySlug: z
      .string()
      .optional()
      .describe("Narrow to elements on a specific storey slug (e.g. '2fl')"),
  }),
  outputSchema: z.object({
    category: z.string(),
    properties: z.array(z.string()),
    combiner: z.string(),
    aggregation: z.string(),
    objectType: z.string().optional(),
    storeySlug: z.string().optional(),
    elementCount: z.number(),
    result: z.number().optional(),
    sum: z.number().optional(),
    average: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    skippedCount: z
      .number()
      .describe(
        "Elements with non-numeric or missing values that were excluded",
      ),
    error: z.string().optional(),
  }),
  execute: async (params: any) => {
    const category = params.inputData?.category || params.category;
    const properties: string[] =
      params.inputData?.properties || params.properties || [];
    const combiner = params.inputData?.combiner || params.combiner || "single";
    const aggregation =
      params.inputData?.aggregation || params.aggregation || "average";
    const objectType = params.inputData?.objectType || params.objectType;
    const storeySlug = params.inputData?.storeySlug || params.storeySlug;

    if (!workspace.filesystem) throw new Error("Filesystem not available");

    if (properties.length === 0) {
      return {
        category,
        properties,
        combiner,
        aggregation,
        objectType,
        storeySlug,
        elementCount: 0,
        skippedCount: 0,
        error: "No properties specified",
      };
    }
    if (combiner !== "single" && properties.length < 2) {
      return {
        category,
        properties,
        combiner,
        aggregation,
        objectType,
        storeySlug,
        elementCount: 0,
        skippedCount: 0,
        error: `Combiner '${combiner}' requires two property keys`,
      };
    }

    let fileContent: string;
    try {
      const raw = await workspace.filesystem.readFile(
        `index/by_category/${category}.jsonl`,
      );
      fileContent = typeof raw === "string" ? raw : raw.toString();
    } catch (err) {
      return {
        category,
        properties,
        combiner,
        aggregation,
        objectType,
        storeySlug,
        elementCount: 0,
        skippedCount: 0,
        error: `Could not read index for ${category}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const values: number[] = [];
    let skippedCount = 0;

    for (const line of fileContent.split("\n")) {
      if (!line.trim()) continue;

      let element: Record<string, any>;
      try {
        element = JSON.parse(line);
      } catch {
        continue;
      }

      if (objectType && element.ObjectType !== objectType) continue;
      if (storeySlug && element.storeySlug !== storeySlug) continue;

      // Extract numeric values for each requested property
      const nums = properties.map((key) => Number(element[key]));

      if (nums.some((n) => !Number.isFinite(n))) {
        skippedCount++;
        continue;
      }

      let elementValue: number;
      if (combiner === "single" || properties.length === 1) {
        elementValue = nums[0];
      } else if (combiner === "multiply") {
        elementValue = nums[0] * nums[1];
      } else if (combiner === "add") {
        elementValue = nums[0] + nums[1];
      } else if (combiner === "subtract") {
        elementValue = nums[0] - nums[1];
      } else if (combiner === "divide") {
        if (nums[1] === 0) {
          skippedCount++;
          continue;
        }
        elementValue = nums[0] / nums[1];
      } else {
        elementValue = nums[0];
      }

      values.push(elementValue);
    }

    if (values.length === 0) {
      return {
        category,
        properties,
        combiner,
        aggregation,
        objectType,
        storeySlug,
        elementCount: 0,
        skippedCount,
        error:
          "No elements with valid numeric values for the requested properties",
      };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const result =
      aggregation === "sum"
        ? sum
        : aggregation === "min"
          ? min
          : aggregation === "max"
            ? max
            : average;

    return {
      category,
      properties,
      combiner,
      aggregation,
      objectType,
      storeySlug,
      elementCount: values.length,
      result,
      sum,
      average,
      min,
      max,
      skippedCount,
    };
  },
});

// Aggregates a numeric property across a specific set of element IDs.
// Use when elements were identified by name/search (allIds from search-elements)
// rather than by category, since those IDs may span multiple categories.
const createAggregatePropertyByIdsTool = (workspace: Workspace) => ({
  id: "aggregate-property-by-ids",
  description:
    "Aggregate a numeric property across a specific list of element IDs by reading raw/by_id/{id}.json for each. " +
    "Use this when you already have IDs from search-elements (e.g. 'total area of W_2c windows'). " +
    "Call get-schema-keys with the category of the first element first to discover correct property key names.",
  inputSchema: z.object({
    ids: z
      .array(z.number())
      .min(1)
      .describe("Element IDs from search-elements allIds"),
    properties: z
      .array(z.string())
      .min(1)
      .max(2)
      .describe(
        "One or two property key names, exactly as they appear in get-schema-keys output",
      ),
    combiner: z
      .enum(["single", "multiply", "add", "subtract", "divide"])
      .default("single")
      .describe(
        "How to combine two properties per element. 'single' for one key, 'multiply' for area, etc.",
      ),
    aggregation: z
      .enum(["sum", "average", "min", "max"])
      .default("average")
      .describe("Statistical aggregation to apply across all elements"),
  }),
  outputSchema: z.object({
    ids: z.array(z.number()),
    properties: z.array(z.string()),
    combiner: z.string(),
    aggregation: z.string(),
    elementCount: z.number(),
    result: z.number().optional(),
    sum: z.number().optional(),
    average: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    skippedCount: z
      .number()
      .describe("Elements with missing/non-numeric values that were excluded"),
    skippedIds: z
      .array(z.number())
      .describe("IDs that could not be read or had no valid value"),
    error: z.string().optional(),
  }),
  execute: async (params: any) => {
    const ids: number[] = params.inputData?.ids || params.ids || [];
    const properties: string[] =
      params.inputData?.properties || params.properties || [];
    const combiner = params.inputData?.combiner || params.combiner || "single";
    const aggregation =
      params.inputData?.aggregation || params.aggregation || "average";

    if (!workspace.filesystem) throw new Error("Filesystem not available");

    if (properties.length === 0) {
      return {
        ids,
        properties,
        combiner,
        aggregation,
        elementCount: 0,
        skippedCount: 0,
        skippedIds: [],
        error: "No properties specified",
      };
    }
    if (combiner !== "single" && properties.length < 2) {
      return {
        ids,
        properties,
        combiner,
        aggregation,
        elementCount: 0,
        skippedCount: 0,
        skippedIds: [],
        error: `Combiner '${combiner}' requires two property keys`,
      };
    }

    const values: number[] = [];
    const skippedIds: number[] = [];

    for (const id of ids) {
      let element: Record<string, any>;
      try {
        const raw = await workspace.filesystem.readFile(`raw/by_id/${id}.json`);
        element = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        skippedIds.push(id);
        continue;
      }

      const nums = properties.map((key) => Number(element[key]));

      if (nums.some((n) => !Number.isFinite(n))) {
        skippedIds.push(id);
        continue;
      }

      let elementValue: number;
      if (combiner === "single" || properties.length === 1) {
        elementValue = nums[0];
      } else if (combiner === "multiply") {
        elementValue = nums[0] * nums[1];
      } else if (combiner === "add") {
        elementValue = nums[0] + nums[1];
      } else if (combiner === "subtract") {
        elementValue = nums[0] - nums[1];
      } else if (combiner === "divide") {
        if (nums[1] === 0) {
          skippedIds.push(id);
          continue;
        }
        elementValue = nums[0] / nums[1];
      } else {
        elementValue = nums[0];
      }

      values.push(elementValue);
    }

    const skippedCount = skippedIds.length;

    if (values.length === 0) {
      return {
        ids,
        properties,
        combiner,
        aggregation,
        elementCount: 0,
        skippedCount,
        skippedIds,
        error:
          "No elements with valid numeric values for the requested properties",
      };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const result =
      aggregation === "sum"
        ? sum
        : aggregation === "min"
          ? min
          : aggregation === "max"
            ? max
            : average;

    return {
      ids,
      properties,
      combiner,
      aggregation,
      elementCount: values.length,
      result,
      sum,
      average,
      min,
      max,
      skippedCount,
      skippedIds,
    };
  },
});

export function createQueryAgent(facilityId: string, searchAgent: Agent) {
  const BIM_DATA_PATH = process.env.BIM_DATA_PATH || "./public/bim_data";
  const basePath = `${BIM_DATA_PATH}/${facilityId}/ai/bim_fs`;

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath,
      readOnly: true,
    }),
  });

  return new Agent({
    id: "query",
    name: "BIM Query Agent",
    model: openai("gpt-5-nano"),
    mastra,
    memory: new Memory(),
    instructions: `You are a BIM data query assistant. Answer questions about building model data clearly and concisely.

Query Strategy
For generic terms (bim terms):
1. Call list-available to check what categories/storeys exist
2. Fuzzy match user term to available names (e.g., "doors" → IFCDOOR)
3. If match found → use count-elements with the appropriate file path
4. If no match → fallback to search-elements

For specific names :
- Skip list-available, go straight to search-elements

Counting Example

"how many doors?" 
→ list-available 
→ find IFCDOOR in categories 
→ count-elements("index/by_category/IFCDOOR.jsonl")
→ return count

"how many elements on second floor?"
→ list-available
→ find "2fl" slug in storeys
→ count-elements("index/by_storey/2fl.jsonl")
→ return count

"how many Breuer chairs?"
→ search-elements("breuer")
→ return totalIds

Property Queries Workflow

When user asks "what are the properties of X" or "properties of X":

Step 1: search-elements(X)
Step 2: Check if totalIds > 0
  - If 0 → return "No elements found matching 'X'"
Step 3: Extract from first match:
  - objectType = matches[0].objectType
  - category = matches[0].category  
Step 4: Call get-properties(objectType, category)
Step 5: Return the list of properties

Derived / Aggregation Queries Workflow

Use this for any question involving measuring, averaging, totalling, or comparing a numeric property across elements — including (but not limited to) area, perimeter, height, width, fire rating, cost, weight, thermal transmittance, count-per-storey, etc.

Two paths depending on how the target elements are identified:

Path A — Category-based (generic BIM terms like "windows", "doors", "slabs"):
Step 1: list-available → match term to IFC category
Step 2: get-schema-keys(category) → discover actual property names in this model
Step 3: Pick key(s) with highest count that semantically match the query
Step 4: aggregate-property(category, properties, combiner, aggregation, objectType?)
Step 5: Present results

Path B — Name/search-based (specific element names like "W_2c windows", "HC_コンクリート梁", "Breuer chairs"):
Step 1: search-elements(query) → get allIds
Step 2: get-schema-keys using category from matches[0].category
Step 3: Pick key(s) as in Path A
Step 4: aggregate-property-by-ids(allIds, properties, combiner, aggregation)
Step 5: Present results

Key selection rules (both paths):
  - Pick key(s) from schema output that semantically match the query
  - Prefer the key with highest count when multiple candidates exist
  - area-like → height-like key × width-like key → combiner="multiply"
  - direct property (fire rating, cost, weight, etc.) → single key, combiner="single"
  - If NO suitable key exists, tell the user which keys ARE available

Example — "total area of windows" (Path A):
→ list-available → IFCWINDOW
→ get-schema-keys(IFCWINDOW) → [{key:"OverallHeight",count:16},{key:"OverallWidth",count:16},...]
→ aggregate-property("IFCWINDOW", ["OverallHeight","OverallWidth"], "multiply", "sum")
→ "Total area: X model-units² across 16 windows"

Example — "total area of W_2c windows" (Path B):
→ search-elements("W_2c") → {allIds:[294758,294859,...], matches:[{objectType:"W_2c:W_2c",category:"IFCWINDOW",...}]}
→ get-schema-keys("IFCWINDOW") → [{key:"OverallHeight",...},{key:"OverallWidth",...},...]
→ aggregate-property-by-ids([294758,294859,...], ["OverallHeight","OverallWidth"], "multiply", "sum")
→ "Total area of W_2c windows: X model-units² across N elements"

Example — "average fire rating of doors" (Path A):
→ list-available → IFCDOOR
→ get-schema-keys(IFCDOOR) → [..., {key:"FireRating",count:22}, ...]
→ aggregate-property("IFCDOOR", ["FireRating"], "single", "average")
→ "Average fire rating: X across 22 doors"

Example session:
User: "properties of FIX doors"
→ search-elements("FIX") returns matches[0] = {objectType: "FIXアルミサッシ窓1:FIXアルミサッシ窓1", category: "IFCDOOR", count: 6}
→ get-properties("FIXアルミサッシ窓1:FIXアルミサッシ窓1", "IFCDOOR")
→ Returns: {properties: ["Name", "ObjectType", "OverallHeight", "OverallWidth", "ContainedInStructure", "category", "localId", "storeySlug"]}
→ Reply: "Properties: Name, ObjectType, OverallHeight, OverallWidth, ContainedInStructure, category, localId, storeySlug"

Response Style

- Be concise and specific
- Use numbers and quantify when possible
- Format lists clearly
- Show calculations when inferring properties
- If data not found, say so clearly and explain why
- Provide helpful context when relevant`,
    workspace,
    tools: {
      listAvailable: createListAvailableTool(workspace),
      searchElements: createDelegateSearchTool(searchAgent),
      getProperties: createGetPropertiesTool(workspace),
      countElements: createCountTool(workspace),
      getSchemaKeys: createGetSchemaKeysTool(workspace),
      aggregateProperty: createAggregatePropertyTool(workspace),
      aggregatePropertyByIds: createAggregatePropertyByIdsTool(workspace),
    },
  });
}
