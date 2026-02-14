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
    "Extract element IDs from a JSONL file and immediately perform an action (select/hide/show/isolate). ONE TOOL CALL instead of two - much faster!",
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
      console.error("Missing filePath or action:", params);
      return {
        action: action || "select",
        elementIds: [],
        count: 0,
        message: "Error: Missing parameters",
      };
    }

    try {
      const sandbox = workspace.sandbox as LocalSandbox;
      const filesystem = workspace.filesystem;

      console.log(`⚡ Quick action: ${action} from ${filePath}`);

      // Extract element IDs using grep
      const result = await sandbox.executeCommand(
        "grep",
        ["-oP", '"id":\\K[0-9]+', filePath],
        {},
      );

      const ids = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => parseInt(line.trim(), 10))
        .filter((id) => !isNaN(id));

      if (ids.length === 0) {
        return {
          action: action as "select" | "hide" | "show" | "isolate",
          elementIds: [],
          count: 0,
          message: "No elements found",
        };
      }

      console.log(`✅ ${action} ${ids.length} elements from ${filePath}`);

      // Return with action ready for frontend
      return {
        action: action as "select" | "hide" | "show" | "isolate",
        elementIds: ids,
        count: ids.length,
        message: `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${ids.length} elements`,
      };
    } catch (error) {
      console.error("Failed quick action:", error);
      return {
        action: action as "select" | "hide" | "show" | "isolate",
        elementIds: [],
        count: 0,
        message: "Error performing action",
      };
    }
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
    instructions: `You control 3D viewer actions. Execute commands in ONE TOOL CALL.

## Available Tools

1. **quick-action** - Extract IDs + perform action in ONE STEP (ALWAYS USE THIS!)
2. **read_file** - Read schemas only

## Data Structure

- schema/storeys.json - Available floors (read for any floor query!)
- schema/categories.json - Available IFC types
- index/by_category/{TYPE}.jsonl - All elements of a type
- index/by_storey/{SLUG}.jsonl - All elements on a floor

## Critical Workflow - ONE TOOL CALL!

### For ANY action (select/hide/show/isolate):

1. **If floor mentioned**: Read schema/storeys.json to get slug
2. **Call quick-action({ filePath, action })** - ONE CALL, DONE!

That's it! No second tool call needed.

## Examples

**User: "select all windows"**
\`\`\`
quick-action({ 
  filePath: "index/by_category/IFCWINDOW.jsonl",
  action: "select"
})
→ DONE!
\`\`\`

**User: "hide gl level"**
\`\`\`
Step 1: Read "schema/storeys.json" → Find slug "gl"
Step 2: quick-action({ 
  filePath: "index/by_storey/gl.jsonl",
  action: "hide"
})
→ DONE!
\`\`\`

**User: "isolate doors"**
\`\`\`
quick-action({ 
  filePath: "index/by_category/IFCDOOR.jsonl",
  action: "isolate"
})
→ DONE!
\`\`\`

**User: "show walls on floor 2"**
\`\`\`
Step 1: Read "schema/storeys.json" → Get slug (e.g., "nivel_2")
Step 2: Read "index/by_storey/nivel_2.jsonl"
Step 3: Parse JSONL, filter for IFCWALL
Step 4: Create custom response with filtered IDs
(Complex filtered queries need manual handling)
\`\`\`

## Rules

1. ✅ ALWAYS use quick-action for simple queries (entire file)
2. ✅ ONE tool call instead of two = 2-3x faster!
3. ✅ For floors: Read schema first, THEN quick-action
4. ✅ For filtered queries (type on floor): Read + parse manually
5. ⚠️ If quick-action fails due to grep/bash errors or has no results: Use read_file to extract IDs from the filesystem based on the query, then return the result in the same format quick-action would return
5. ✅ quick-action returns ready-to-use result - no formatting needed!

## Storey Matching

When user mentions a floor:
1. Read schema/storeys.json
2. Match flexibly (case-insensitive, ignore "nivel"/"level" prefixes)
3. Use the exact slug from the schema

Examples:
- "gl", "ground", "planta baja" → Match storey with "GL"
- "b2", "basement 2" → Match storey with "B2"
- "1", "level 1", "first floor" → Match storey with "1" (not B1!)

DO NOT guess slugs - always read the schema!`,
    workspace,
    tools: {
      quickActionTool: createQuickActionTool(workspace),
    },
  });
}
