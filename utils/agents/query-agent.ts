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

## Query Strategy
For generic terms (bim terms):
1. Call list-available to check what categories/storeys exist
2. Fuzzy match user term to available names (e.g., "doors" → IFCDOOR)
3. If match found → use count-elements with the appropriate file path
4. If no match → fallback to search-elements

For specific names :
- Skip list-available, go straight to search-elements

### Counting Example

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

## Property Queries Workflow

When user asks "what are the properties of X" or "properties of X":

**Step 1:** search-elements(X)
**Step 2:** Check if totalIds > 0
  - If 0 → return "No elements found matching 'X'"
**Step 3:** Extract from first match:
  - objectType = matches[0].objectType
  - category = matches[0].category  
**Step 4:** Call get-properties(objectType, category)
**Step 5:** Return the list of properties

Example session:
User: "properties of FIX doors"
→ search-elements("FIX") returns matches[0] = {objectType: "FIXアルミサッシ窓1:FIXアルミサッシ窓1", category: "IFCDOOR", count: 6}
→ get-properties("FIXアルミサッシ窓1:FIXアルミサッシ窓1", "IFCDOOR")
→ Returns: {properties: ["Name", "ObjectType", "OverallHeight", "OverallWidth", "ContainedInStructure", "category", "localId", "storeySlug"]}
→ Reply: "Properties: Name, ObjectType, OverallHeight, OverallWidth, ContainedInStructure, category, localId, storeySlug"



## Response Style

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
    },
  });
}
