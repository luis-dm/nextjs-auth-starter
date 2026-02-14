import { Agent } from "@mastra/core/agent";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// NEW: All-in-one tool that extracts AND performs action
const createQuickActionTool = (workspace: Workspace) => ({
  id: "quick-action",
  description:
    "Extract element IDs from a JSONL file and immediately perform an action (select/hide/show/isolate). ONE TOOL CALL instead of two - much faster! Only works for simple queries (entire file). For complex queries that need filtering or semantic search, this will fail and you should use read_file instead.",
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

    // Extract element IDs using grep
    const result = await sandbox.executeCommand(
      "grep",
      ["-oP", '"id":\\K[0-9]+', filePath],
      {},
    );

    if (!result?.stdout || result.stdout.trim().length === 0) {
      throw new Error(
        `No elements found in ${filePath} - this may require semantic search or filtering. Use read_file fallback.`,
      );
    }

    const ids = result.stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => parseInt(line.trim(), 10))
      .filter((id) => !isNaN(id));

    if (ids.length === 0) {
      throw new Error(
        `Could not extract valid IDs from ${filePath} - may need manual parsing`,
      );
    }

    console.log(`✅ ${action} ${ids.length} elements from ${filePath}`);

    // Return with action ready for frontend
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
    instructions: `You control 3D viewer actions. Execute commands efficiently.

## Available Tools

1. **quick-action** - Extract IDs + perform action in ONE STEP (for simple queries)
2. **read_file** - Read and parse files manually (for complex queries)

## Data Structure

- schema/storeys.json - Available floors
- schema/categories.json - Available IFC types
- index/by_category/{TYPE}.jsonl - All elements of a type
- index/by_storey/{SLUG}.jsonl - All elements on a floor

## Strategy

### Simple Queries (use quick-action):
- "select all windows" → quick-action with IFCWINDOW.jsonl
- "hide level 1" → quick-action with nivel_1.jsonl
- "isolate doors" → quick-action with IFCDOOR.jsonl

### Complex Queries (use read_file fallback):
- "select elements I can sit on" → Need to read files and filter by name/category
- "hide structural elements" → Need semantic understanding
- "show furniture on floor 2" → Need to filter by category AND floor

## Workflow

1. **Determine query type**: Simple (entire file) or Complex (needs filtering)?

2. **For simple queries**:
   - Try quick-action first
   - If it fails, fall back to read_file

3. **For complex queries** (semantic/filtering):
   - Skip quick-action entirely
   - Read relevant files with read_file
   - Parse JSONL line by line
   - Filter based on semantic meaning (names, categories, properties)
   - Extract matching IDs
   - Return result in same format as quick-action:
     \`\`\`json
     {
       "action": "select",
       "elementIds": [...],
       "count": 123,
       "message": "Selected 123 elements matching: sit on"
     }
     \`\`\`

## Examples

**Simple: "select all windows"**
\`\`\`
quick-action({ 
  filePath: "index/by_category/IFCWINDOW.jsonl",
  action: "select"
})
\`\`\`

**Complex queries:"**
\`\`\`
Step 1: Identify semantic meaning
Step 2: Read "schema/categories.json" → Find relevant types
Step 3: Read "index/by_category/[catname].jsonl"
Step 4: Parse JSONL, filter by name containing inferred keywords
Step 5: Extract IDs from matching elements
Step 6: Return formatted result:
{
  "action": "select",
  "elementIds": [456, 789, ...],
  "count": 15,
  "message": "Selected 15 elements"
}
\`\`\`

**Simple with fallback: "hide gl level"**
\`\`\`
Step 1: Read "schema/storeys.json" → Find slug "gl"
Step 2: Try quick-action({ filePath: "index/by_storey/gl.jsonl", action: "hide" })
Step 3: If it fails → Read file manually and extract IDs
\`\`\`

## Quick-Action Failure Handling

When quick-action fails (throws error):
1. The error message tells you WHY it failed
2. Use read_file to manually parse the JSONL
3. Extract IDs based on the query context
4. Return result in the same format as quick-action

## Rules

1. ✅ Try quick-action for simple queries (fastest)
2. ✅ If quick-action throws error → Use read_file fallback
3. ✅ For complex semantic queries → Skip quick-action, use read_file directly
4. ✅ Always return consistent format: { action, elementIds, count, message }
5. ✅ For floors: Read schema/storeys.json first to get correct slug

## Storey Matching

When user mentions a floor:
1. Read schema/storeys.json
2. Match flexibly (case-insensitive)
3. Use the exact slug from the schema

DO NOT guess slugs - always read the schema!`,
    workspace,
    tools: {
      quickActionTool: createQuickActionTool(workspace),
    },
  });
}
