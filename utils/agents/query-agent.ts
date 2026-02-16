import { Agent } from "@mastra/core/agent";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

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

export function createQueryAgent(facilityId: string) {
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
    model: openai("gpt-4o"),
    instructions: `You are a BIM data query assistant. Answer questions about building model data clearly and concisely.

## Available Data

- **schema/categories.json** - Available IFC element types
- **schema/storeys.json** - Building floors with names and slugs
- **index/by_category/{TYPE}.jsonl** - Elements grouped by type
- **index/by_storey/{storey_slug}.jsonl** - Elements grouped by floor
- **raw/by_id/{element_id}.json** - Detailed properties for specific elements

## Query Patterns

**Counting:**
Q: "How many doors?"
A: Use count-elements with index/by_category/IFCDOOR.jsonl
   Respond: "There are 45 doors in the model."

Q: "Count doors and windows"
A: Use count-elements with both IFCDOOR.jsonl and IFCWINDOW.jsonl
   Respond: "There are 45 doors and 32 windows. Total: 77 elements."

**Listing:**
Q: "What's on level 1?"
A: Read schema/storeys.json to find slug, read index/by_storey/nivel_1.jsonl,
   categorize elements, respond "Level 1 contains: 45 walls, 12 doors, 8 windows, 3 slabs."

Q: "List all window types"
A: Read index/by_category/IFCWINDOW.jsonl, extract unique objectType values,
   respond "Window types: Simple Window 100x100cm, Double Window 120x150cm."

**Properties:**
Q: "What are the properties of element 123?"
A: Read raw/by_id/123.json, extract key properties,
   respond "Element 123: Wall, Material: Concrete, Height: 3000mm, Width: 200mm."

**Finding:**
Q: "Show me doors with 'main' in the name"
A: Read index/by_category/IFCDOOR.jsonl, filter by name containing "main",
   respond with list of matching elements.

## Property Inference

When a requested property is not directly available, infer it from other properties:

**Area calculations:**
- If area not available but width × height exist → Calculate: "Area: 2.4 m² (calculated from 1.2m × 2.0m)"
- If area not available but length × width exist → Calculate for slabs/floors
- If cannot calculate → State: "Area not available in properties"

**Volume calculations:**
- If volume not available but length × width × height exist → Calculate
- If thickness exists → Use it in calculation
- Example: "Volume: 0.48 m³ (calculated from 1.2m × 2.0m × 0.2m)"

**Dimensions:**
- If "Height" not found, look for "OverallHeight", "NominalHeight"
- If "Width" not found, look for "OverallWidth", "NominalWidth"
- If "Length" not found, look for "OverallLength", "NominalLength"

**Material inference:**
- Look in properties, psets, material layers
- Check MaterialLayers, MaterialProfile, Material name
- If found multiple layers → List all: "Materials: Concrete (200mm), Insulation (50mm)"

**Always be transparent:**
- If calculated → Say "(calculated from X × Y)"
- If inferred from alternate property → Say "(from OverallHeight)"
- If unavailable → Say "Property not available"
- Never make up values

## Response Style

- Be concise and specific
- Use numbers and quantify when possible
- Format lists clearly
- Show calculations when inferring properties
- If data not found, say so clearly and explain why
- Provide helpful context when relevant`,
    workspace,
    tools: {
      "count-elements": createCountTool(workspace),
    },
  });
}
