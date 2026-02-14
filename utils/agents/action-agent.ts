import { Agent } from "@mastra/core/agent";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Fast semantic search tool using grep with patterns
const createSemanticSearchTool = (workspace: Workspace) => ({
  id: "semantic-search",
  description:
    "Search for elements by keywords in their names using grep patterns. Use this when users describe elements by function, appearance, or semantic meaning rather than exact IFC types.",
  inputSchema: z.object({
    category: z
      .string()
      .optional()
      .describe(
        'IFC category to narrow search (e.g., "IFCFURNITURE"), or omit to search all',
      ),
    keywords: z
      .array(z.string())
      .describe(
        "Keywords that might appear in element names. Think about synonyms, variations, and related terms.",
      ),
    action: z
      .enum(["select", "hide", "show", "isolate"])
      .describe("Action to perform on matching elements"),
  }),
  outputSchema: z.object({
    action: z.enum(["select", "hide", "show", "isolate"]),
    elementIds: z.array(z.number()),
    count: z.number(),
    message: z.string(),
  }),
  execute: async (params: any) => {
    const category = params.inputData?.category || params.category;
    const keywords = params.inputData?.keywords || params.keywords;
    const action = params.inputData?.action || params.action;

    if (!keywords || keywords.length === 0 || !action) {
      throw new Error("Missing keywords or action parameters");
    }

    const sandbox = workspace.sandbox as LocalSandbox;

    console.log(
      `🔍 Semantic search: ${keywords.join(", ")} in ${category || "all categories"}`,
    );

    try {
      // Build grep pattern: case-insensitive OR of all keywords
      const pattern = keywords.map((k: string) => k.toLowerCase()).join("|");

      // Determine which files to search
      let filesToSearch: string[] = [];
      if (category) {
        filesToSearch = [`index/by_category/${category}.jsonl`];
      }
      const allIds: number[] = [];

      // Search each file
      for (const file of filesToSearch) {
        try {
          const grepResult = await sandbox.executeCommand(
            "grep",
            ["-iE", pattern, file],
            {},
          );

          if (grepResult?.stdout && grepResult.stdout.trim().length > 0) {
            const lines = grepResult.stdout.trim().split("\n");
            for (const line of lines) {
              try {
                const obj = JSON.parse(line);
                if (obj.id && typeof obj.id === "number") {
                  allIds.push(obj.id);
                }
              } catch (e) {
                continue;
              }
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (allIds.length === 0) {
        throw new Error(
          `No elements found matching keywords: ${keywords.join(", ")}`,
        );
      }

      console.log(
        `✅ Found ${allIds.length} elements matching: ${keywords.join(", ")}`,
      );

      return {
        action: action as "select" | "hide" | "show" | "isolate",
        elementIds: allIds,
        count: allIds.length,
        message: `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${allIds.length} elements matching: ${keywords.join(", ")}`,
      };
    } catch (error) {
      console.error("Semantic search failed:", error);
      throw error;
    }
  },
});

// Quick action tool
const createQuickActionTool = (workspace: Workspace) => ({
  id: "quick-action",
  description:
    "Extract all element IDs from a JSONL file and perform an action. Fast for simple queries that target entire categories or floors.",
  inputSchema: z.object({
    filePath: z
      .string()
      .describe(
        'Path to JSONL file (e.g., "index/by_category/IFCDOOR.jsonl" or "index/by_storey/gl.jsonl")',
      ),
    action: z
      .enum(["select", "hide", "show", "isolate"])
      .describe("Action to perform on the elements"),
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

    if (!filePath || !action) {
      throw new Error("Missing filePath or action parameters");
    }

    const sandbox = workspace.sandbox as LocalSandbox;

    console.log(`⚡ Quick action: ${action} from ${filePath}`);

    const result = await sandbox.executeCommand(
      "grep",
      ["-oP", '"id":\\K[0-9]+', filePath],
      {},
    );

    if (!result?.stdout || result.stdout.trim().length === 0) {
      throw new Error(`No elements found in ${filePath}`);
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

    console.log(`✅ ${action} ${ids.length} elements from ${filePath}`);

    return {
      action: action as "select" | "hide" | "show" | "isolate",
      elementIds: ids,
      count: ids.length,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${ids.length} elements`,
    };
  },
});

export function createActionAgent(facilityId: string) {
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
    model: openai("gpt-4o-mini"),
    instructions: `You control 3D viewer actions. Choose the right tool based on query complexity.

## Available Tools

1. **quick-action** - When targeting entire categories or floors
2. **semantic-search** - When filtering by semantic meaning or keywords
3. **read_file** - Last resort for multi-criteria filtering

## Data Sources

- schema/storeys.json - Building floors with slugs
- schema/categories.json - Available IFC element types
- index/by_category/{TYPE}.jsonl - All elements of a specific type
- index/by_storey/{SLUG}.jsonl - All elements on a specific floor

## Decision Framework

Ask yourself: **What is the user targeting?**

### Use quick-action when:
- Target is an **entire IFC category** (all windows, all doors, all furniture)
- Target is an **entire floor/level** (level 1, basement 2, ground floor)
- User says "all X" where X is a category or floor
- No filtering or semantic interpretation needed

### Use semantic-search when:
- User describes elements by **function** (things I can sit on, walkable surfaces)
- User describes by **appearance** (red elements, glass items)
- User describes by **purpose** (structural elements, decorative items)
- User uses **natural language** instead of technical terms
- You need to **match keywords** in element names

### Use read_file when:
- Need to combine **multiple criteria** (doors on floor 2, red furniture in room A)
- Need to filter by **properties not in the name** (elements over certain size)
- semantic-search returns too many/few results and needs refinement

## Keyword Generation Strategy

When using semantic-search, think broadly about what terms might appear in element names:

**Process:**
1. **Identify the core concept** from user's query
2. **List synonyms and variations** (sit → chair, bench, sofa, seat, stool)
3. **Consider related terms** (kitchen → sink, counter, cabinet, refrigerator)
4. **Think about technical terms** (structural → beam, column, foundation, truss)
5. **Include common abbreviations** (AC → air conditioner, HVAC)

**Generate 3-8 keywords** that maximize coverage while staying relevant.

## Workflow Patterns

### Pattern 1: Simple Category/Floor
\`\`\`
User: "select all windows"
→ quick-action({ filePath: "index/by_category/IFCWINDOW.jsonl", action: "select" })
\`\`\`

### Pattern 2: Semantic Description
\`\`\`
User: "select elements I can sit on"
→ Think: What keywords? chair, bench, sofa, seat, stool, couch
→ semantic-search({ keywords: ["chair", "bench", "sofa", "seat", "stool", "couch"], action: "select" })
\`\`\`

### Pattern 3: Floor Query
\`\`\`
User: "hide level 2"
→ Read "schema/storeys.json" to get slug
→ quick-action({ filePath: "index/by_storey/{slug}.jsonl", action: "hide" })
\`\`\`

### Pattern 4: Multi-Criteria (Complex)
\`\`\`
User: "show furniture on floor 2"
→ Read "schema/storeys.json" to get slug
→ Read "index/by_storey/{slug}.jsonl"
→ Parse JSONL, filter for IFCFURNITURE category
→ Extract IDs, return formatted result
\`\`\`

## Error Handling

If quick-action fails:
- Try semantic-search if query might need keyword matching
- Fall back to read_file for manual parsing

If semantic-search returns 0 results:
- Try broader/different keywords
- Consider using read_file to inspect what's actually in the files

## Output Format

Always return:
\`\`\`json
{
  "action": "select" | "hide" | "show" | "isolate",
  "elementIds": [123, 456, 789],
  "count": 3,
  "message": "Selected 3 elements"
}
\`\`\`

## Storey Handling

For any floor/level query:
1. **Always read schema/storeys.json first**
2. Match user's term flexibly (case-insensitive, ignore prefixes like "nivel"/"level")
3. Use the exact slug from the schema
4. Never hardcode or guess storey slugs`,
    workspace,
    tools: {
      quickActionTool: createQuickActionTool(workspace),
      semanticSearchTool: createSemanticSearchTool(workspace),
    },
  });
}
