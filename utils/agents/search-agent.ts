import { Agent } from "@mastra/core/agent";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
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
    const sandbox = workspace.sandbox as LocalSandbox;

    console.log(
      `[Search Agent] Searching "${query}" with keywords: [${keywords.join(", ")}]`,
    );

    let searchResult = null;
    let usedKeyword = "";

    // Try each keyword until we get a hit
    for (const keyword of keywords) {
      searchResult = await sandbox.executeCommand(
        "./skills/bim-query/scripts/search_by_name.sh",
        [keyword],
        {},
      );

      if (searchResult?.stdout?.trim()) {
        usedKeyword = keyword;
        console.log(`[Search Agent] Found matches using: "${keyword}"`);
        break;
      }
    }

    if (!searchResult?.stdout?.trim()) {
      console.log(`[Search Agent] No matches found for any keywords`);
      return {
        matches: [],
        totalIds: 0,
        allIds: [],
        query,
        keywordUsed: undefined,
      };
    }

    // 2. Parse matches (format: "CATEGORY|ObjectType|Count")
    const matchLines = searchResult.stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    console.log(
      `[Search Agent] Found ${matchLines.length} object type(s) using "${usedKeyword}"`,
    );

    const matches = [];
    const allIds: number[] = [];

    // 3. Get IDs for each matching ObjectType
    for (const line of matchLines) {
      const [category, objectType, count] = line.split("|");

      if (!objectType || !category) {
        console.log(`Skipping malformed line: "${line}"`);
        continue;
      }

      //   console.log(`Getting IDs for: ${objectType} (${category})`);

      const idsResult = await sandbox.executeCommand(
        "./skills/bim-query/scripts/get_ids_by_object_type.sh",
        [objectType], // Only pass objectType, script looks up category itself
        {},
      );

      //   console.log(`Script result:`, {
      //     hasStdout: !!idsResult?.stdout,
      //     stdoutLength: idsResult?.stdout?.length || 0,
      //     stderr: idsResult?.stderr?.substring(0, 100),
      //   });

      if (idsResult?.stdout?.trim()) {
        const ids = idsResult.stdout
          .trim()
          .split("\n")
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id));

        allIds.push(...ids);
        matches.push({
          objectType,
          category,
          count: ids.length,
        });
        // console.log(`${objectType} (${category}): ${ids.length} elements`);
      } else {
        console.log(`No IDs found for ${objectType} (${category})`);
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

export function createSearchAgent() {
  const basePath = "./bim_fs";

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath,
      readOnly: true,
    }),
    sandbox: new LocalSandbox({
      workingDirectory: basePath,
    }),
    skills: ["/skills"],
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
