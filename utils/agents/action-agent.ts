import { Agent } from "@mastra/core/agent";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const createQuickActionTool = (workspace: Workspace) => ({
  id: "quick-action",
  description:
    "FAST extraction of element IDs from one or multiple JSONL files using grep. Use for queries involving categories and/or storeys. Supports combinations like 'first floor doors', 'doors and windows', 'level 1 and 2', etc.",
  inputSchema: z.object({
    filePaths: z
      .array(z.string())
      .describe(
        'Array of JSONL file paths to combine (e.g., ["index/by_category/IFCDOOR.jsonl", "index/by_category/IFCWINDOW.jsonl"])',
      ),
    action: z.enum(["select", "hide", "show", "isolate"]),
  }),
  outputSchema: z.object({
    action: z.enum(["select", "hide", "show", "isolate"]),
    elementIds: z.array(z.number()),
    count: z.number(),
    message: z.string(),
  }),
  execute: async (params: any) => {
    const filePaths = params.inputData?.filePaths || params.filePaths;
    const action = params.inputData?.action || params.action;

    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error("Missing or empty filePaths array");
    }
    if (!action) {
      throw new Error("Missing action parameter");
    }

    const sandbox = workspace.sandbox as LocalSandbox;
    console.log(`⚡ Quick action: ${action} from ${filePaths.length} file(s)`);

    const allIds = new Set<number>();

    // Extract IDs from each file using grep
    for (const filePath of filePaths) {
      try {
        const result = await sandbox.executeCommand(
          "grep",
          ["-oP", '"id":\\K[0-9]+', filePath],
          {},
        );

        if (result?.stdout && result.stdout.trim().length > 0) {
          const ids = result.stdout
            .trim()
            .split("\n")
            .filter((line) => line.length > 0)
            .map((line) => parseInt(line.trim(), 10))
            .filter((id) => !isNaN(id));

          ids.forEach((id) => allIds.add(id));
          console.log(`  ✓ ${filePath}: ${ids.length} elements`);
        } else {
          console.log(`  ⚠ ${filePath}: no elements found`);
        }
      } catch (error) {
        console.warn(`  ✗ ${filePath}: grep failed`, error);
        // Continue with other files even if one fails
      }
    }

    const elementIds = Array.from(allIds);

    if (elementIds.length === 0) {
      throw new Error(
        `No elements found in any of the ${filePaths.length} file(s). Files may be empty or need property-based filtering. Use read_file for complex queries.`,
      );
    }

    console.log(`✅ ${action} ${elementIds.length} elements total`);

    return {
      action: action as "select" | "hide" | "show" | "isolate",
      elementIds,
      count: elementIds.length,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${elementIds.length} elements from ${filePaths.length} source(s)`,
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
    instructions: `You control 3D viewer actions. Execute commands efficiently using categories and storeys.

## Available Data

- **schema/storeys.json** - Floor definitions (name, slug, elevation)
- **schema/categories.json** - IFC element types
- **index/by_category/{TYPE}.jsonl** - Elements by type (IFCDOOR, IFCWINDOW, etc.)
- **index/by_storey/{SLUG}.jsonl** - Elements by floor (gl, nivel_1, nivel_2, etc.)

## Tools

**quick-action** - FAST grep extraction. Supports multiple files for combined queries.
**read_file** - Read schema files or parse when you need property-based filtering.
**list_directory** - Explore available files.

## Strategy

### Simple Queries (Use quick-action)

**Single category:**
- "select all doors" → quick-action with ["index/by_category/IFCDOOR.jsonl"]

**Single floor:**
- "hide level 1" → First read storeys.json to get slug, then quick-action with ["index/by_storey/nivel_1.jsonl"]

**Multiple categories:**
- "select doors and windows" → quick-action with ["index/by_category/IFCDOOR.jsonl", "index/by_category/IFCWINDOW.jsonl"]

**Multiple floors:**
- "hide level 1 and 2" → Get slugs from storeys.json, then quick-action with ["index/by_storey/nivel_1.jsonl", "index/by_storey/nivel_2.jsonl"]

**Category + Floor (intersection):**
- "select first floor doors" → 
  1. Get level 1 elements: read index/by_storey/nivel_1.jsonl
  2. Get all doors: read index/by_category/IFCDOOR.jsonl
  3. Find intersection of IDs (doors that are on level 1)
  4. Return { action: "select", elementIds: [...], count: X, message: "..." }

**Complex combinations:**
- "walls on third floor" → Intersection of IFCWALL + nivel_3
- "doors and windows on ground floor" → (IFCDOOR + IFCWINDOW) ∩ ground_floor

### Complex Queries (Use read_file)

**Property-based filtering:**
- "select doors with X property" → read_file IFCDOOR.jsonl, filter based on that property
- "hide load-bearing walls" → read_file IFCWALL.jsonl, filter by properties

**Name-based filtering:**
- "select chairs" → since chairs are not a category, find closest match in categories (in this case it is IFCFURNISHING) and filter by name containing 'chair'

## Examples

**"select all doors"**
quick-action({ 
  filePaths: ["index/by_category/IFCDOOR.jsonl"],
  action: "select"
})

**"hide doors and windows"**
quick-action({ 
  filePaths: [
    "index/by_category/IFCDOOR.jsonl",
    "index/by_category/IFCWINDOW.jsonl"
  ],
  action: "hide"
})

**"select first floor doors"**
1. read_file("schema/storeys.json") → get slug for level 1
2. read_file("index/by_storey/nivel_1.jsonl") → parse, get IDs
3. read_file("index/by_category/IFCDOOR.jsonl") → parse, get IDs
4. Find intersection of both ID sets
5. Return { action: "select", elementIds: [intersection], count: X, message: "..." }

## Output Format

ALWAYS return:
{
  "action": "select|hide|show|isolate",
  "elementIds": [123, 456, 789],
  "count": 3,
  "message": "Selected 3 doors from level 1"
}`,
    workspace,
    tools: {
      quickAction: createQuickActionTool(workspace),
    },
  });
}
