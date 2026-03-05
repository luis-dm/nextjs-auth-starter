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

// Fast counting tool using wc -l
const createCountTool = (workspace: Workspace) => ({
  id: "count-elements",
  description:
    "Fast counting of elements in JSONL files using wc -l. Much faster than reading entire files.",
  inputSchema: z.object({
    filePaths: z.array(z.string()).describe("JSONL files to count"),
  }),
  outputSchema: z.object({
    counts: z.record(z.number()),
    total: z.number(),
  }),
  execute: async (params: any) => {
    const filePaths = params.inputData?.filePaths || params.filePaths;
    const sandbox = workspace.sandbox as LocalSandbox;

    const counts: Record<string, number> = {};
    let total = 0;

    for (const filePath of filePaths) {
      try {
        const result = await sandbox.executeCommand("wc", ["-l", filePath], {});
        const count = parseInt(result.stdout.trim().split(/\s+/)[0], 10);

        counts[filePath] = count;
        total += count;
        console.log(`  ✓ ${filePath}: ${count} elements`);
      } catch (error) {
        console.warn(`  ✗ ${filePath}: count failed`);
        counts[filePath] = 0;
      }
    }

    return { counts, total };
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
    sandbox: new LocalSandbox({
      workingDirectory: basePath,
    }),
  });

  return new Agent({
    id: "query",
    name: "BIM Query Agent",
    model: openai("gpt-5-nano"),
    instructions: `You are a BIM data query assistant. Answer questions about building model data clearly and concisely.

## Query Strategy
For generic terms (bim terms):
1. Call list-available to check what categories/storeys exist
2. Fuzzy match user term to available names (e.g., "doors" → IFCDOOR)
3. If match found → use ./skills/bim-query/scripts/count_category.sh {CATEGORY} or count_storey.sh {STOREY} to get count and IDs
4. If no match → fallback to search-elements

For specific names :
- Skip list-available, go straight to search-elements

### Counting Example

"how many doors?" 
→ list-available 
→ find IFCDOOR in categories 
→ ./skills/bim-query/scripts/count_category.sh IFCDOOR

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
    },
  });
}
