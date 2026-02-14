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
    "Fast ID extraction from JSONL files using grep. Supports multiple files (returns UNION). Use for category/storey queries. Cannot filter by properties or do intersections.",
  inputSchema: z.object({
    filePaths: z
      .array(z.string())
      .min(1)
      .describe("JSONL file paths to combine"),
    action: z.enum(["select", "hide", "show", "isolate"]),
  }),
  outputSchema: z.object({
    action: z.enum(["select", "hide", "show", "isolate"]),
    elementIds: z.array(z.number()),
    count: z.number(),
    message: z.string(),
  }),
  execute: async (params: any) => {
    const startTime = Date.now();
    const filePaths = params.inputData?.filePaths || params.filePaths;
    const action = params.inputData?.action || params.action;

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error("filePaths must be a non-empty array");
    }

    const sandbox = workspace.sandbox as LocalSandbox;
    const allIds = new Set<number>();

    console.log(`⚡ Quick action: ${action} from ${filePaths.length} file(s)`);

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
            .map((line) => parseInt(line.trim(), 10))
            .filter((id) => !isNaN(id));

          ids.forEach((id) => allIds.add(id));
          console.log(`  ✓ ${filePath}: ${ids.length} elements`);
        } else {
          console.log(`  ⚠ ${filePath}: empty`);
        }
      } catch (error: any) {
        console.warn(`  ✗ ${filePath}: ${error.message}`);
      }
    }

    const elementIds = Array.from(allIds);

    if (elementIds.length === 0) {
      throw new Error(
        `No elements found in ${filePaths.length} file(s). Use read_file for filtering.`,
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ Completed in ${duration}ms - ${elementIds.length} total elements`,
    );

    return {
      action: action as "select" | "hide" | "show" | "isolate",
      elementIds,
      count: elementIds.length,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)}ed ${elementIds.length} elements`,
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
    instructions: `You control a 3D BIM viewer. Perform actions efficiently.

## Data Structure

- **schema/storeys.json** - Floor definitions (name, slug, elevation)
- **schema/categories.json** - IFC element types
- **index/by_category/{TYPE}.jsonl** - Elements by type
- **index/by_storey/{SLUG}.jsonl** - Elements by floor

## Tools

**quick-action** - Fast grep extraction. Supports multiple files (returns UNION of IDs).
**read_file** - Manual parsing for filtering or intersections.

## Strategy

**Use quick-action for unions:**
- "all doors" → quick-action(["index/by_category/IFCDOOR.jsonl"])
- "doors and windows" → quick-action(["IFCDOOR.jsonl", "IFCWINDOW.jsonl"])
- "level 1 and 2" → Read storeys.json for slugs, then quick-action([slugs])

**Use read_file for filtering/intersections:**
- "red doors" → read_file IFCDOOR.jsonl, filter by color, extract IDs
- "first floor doors" → read_file both files, find ID intersection
- "furniture" → read_file categories.json, identify types, filter files

## Output Format

Always return:
{
  "action": "select|hide|show|isolate",
  "elementIds": [123, 456],
  "count": 2,
  "message": "Selected 2 elements"
}

## Rules

- For floors: ALWAYS read schema/storeys.json first to get correct slugs
- quick-action returns UNION (combines all IDs)
- For intersections, use read_file + manual filtering`,
    workspace,
    tools: {
      "quick-action": createQuickActionTool(workspace),
    },
  });
}
