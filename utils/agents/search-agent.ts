import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const createSemanticSearchTool = (workspace: Workspace) => ({
  id: "semantic-search",
  description:
    "Search for BIM elements by name, type, or description. Pass query and keywords array. Tool tries each keyword until match found.",
  inputSchema: z.object({
    query: z.string().describe("Original user query for context"),
    keywords: z
      .array(z.string())
      .describe(
        "Array of 2-4 keywords to try (element names like 'door', 'pump', 'beam', not descriptions like 'opened' or 'vertical')",
      ),
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
    keywordUsed: z.string().optional(),
  }),
  execute: async (params: any) => {
    const query = params.inputData?.query || params.query;
    const keywords = params.inputData?.keywords || params.keywords;

    console.log(
      `[Search Agent] Searching "${query}" with keywords: [${keywords.join(", ")}]`,
    );

    if (!workspace.filesystem) {
      throw new Error("Filesystem not available");
    }

    // Read object_types.json
    const objectTypesFile = await workspace.filesystem.readFile(
      "schema/object_types.json",
    );
    const objectTypesContent =
      typeof objectTypesFile === "string"
        ? objectTypesFile
        : objectTypesFile.toString();
    const objectTypes = JSON.parse(objectTypesContent);

    let matchingTypes: any[] = [];
    let usedKeyword = "";

    // Try each keyword until we get a hit
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      matchingTypes = objectTypes.filter((ot: any) =>
        ot.objectType.toLowerCase().includes(keywordLower),
      );

      if (matchingTypes.length > 0) {
        usedKeyword = keyword;
        console.log(
          `[Search Agent] Found ${matchingTypes.length} object type(s) using: "${keyword}"`,
        );
        break;
      }
    }

    if (matchingTypes.length === 0) {
      console.log(`[Search Agent] No matches found for any keywords`);
      return {
        matches: [],
        totalIds: 0,
        allIds: [],
        query,
        keywordUsed: undefined,
      };
    }

    const matches = [];
    const allIds: number[] = [];

    // Get IDs for each matching ObjectType by reading flat/all_elements.jsonl
    const allElementsFile = await workspace.filesystem.readFile(
      "flat/all_elements.jsonl",
    );
    const allElementsContent =
      typeof allElementsFile === "string"
        ? allElementsFile
        : allElementsFile.toString();

    const lines = allElementsContent.trim().split("\n");

    for (const matchingType of matchingTypes) {
      const typeIds: number[] = [];

      for (const line of lines) {
        if (line.trim().length === 0) continue;
        try {
          const element = JSON.parse(line);
          if (
            element.type === matchingType.objectType &&
            element._localId !== undefined
          ) {
            typeIds.push(element._localId);
          }
        } catch (e) {
          // Skip invalid lines
        }
      }

      if (typeIds.length > 0) {
        allIds.push(...typeIds);
        matches.push({
          objectType: matchingType.objectType,
          category: matchingType.category,
          count: typeIds.length,
        });
      }
    }

    console.log(
      `[Search Agent] Total: ${allIds.length} elements from ${matches.length} object types`,
    );

    return {
      matches,
      totalIds: allIds.length,
      allIds,
      query,
      keywordUsed: usedKeyword,
    };
  },
});

export function createSearchAgent(facilityId?: string) {
  const BIM_DATA_PATH = process.env.BIM_DATA_PATH || "./public/bim_data";
  const basePath = facilityId
    ? `${BIM_DATA_PATH}/${facilityId}/ai/bim_fs`
    : "./bim_fs";

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath,
      readOnly: true,
    }),
  });

  return new Agent({
    id: "search",
    name: "Semantic Search Agent",
    model: openai("gpt-4o-mini"),
    instructions: `Extract relevant keywords from user queries and search for BIM elements.

**Your job:**
1. Analyze the query semantically
2. Extract 2-4 element-type keywords (nouns like "door", "pump", "beam" - NOT adjectives like "vertical", "opened")
3. Call semantic-search(query, keywords)

**Examples:**
- "elements with knobs" → keywords: ["door", "window"]
- "vertical turbine pumps" → keywords: ["pump", "turbine"]
- "elements i can sit on" → keywords: ["chair", "bench", "sofa"]
- "HC_コンクリート梁" → keywords: ["HC_コンクリート梁", "beam", "梁"]`,
    workspace,
    tools: {
      semanticSearch: createSemanticSearchTool(workspace),
    },
  });
}
