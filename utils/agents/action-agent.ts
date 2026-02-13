import { Agent } from "@mastra/core/agent";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  selectElementsTool,
  hideElementsTool,
  showElementsTool,
  isolateElementsTool,
} from "@/utils/mastra";

// Helper tool: Extract IDs from JSONL file without LLM parsing
const createExtractIdsFromFileTool = (workspace: Workspace) => ({
  id: "extract-ids-from-file",
  description:
    "Extract element IDs from a JSONL file using grep. Returns an array of numbers ready to use. Much faster than parsing manually.",
  inputSchema: z.object({
    filePath: z
      .string()
      .describe(
        'Path to JSONL file (e.g., "index/by_category/IFCDOOR.jsonl" or "index/by_storey/gl.jsonl")',
      ),
  }),
  outputSchema: z.object({
    elementIds: z.array(z.number()),
    count: z.number(),
  }),
  execute: async ({ inputData }: any) => {
    const { filePath } = inputData;

    try {
      const sandbox = workspace.sandbox as LocalSandbox;

      // Run grep command to extract IDs
      const result = await sandbox.executeCommand(
        "grep",
        ["-oP", '"id":\\K[0-9]+', filePath],
        {},
      );

      if (!result?.stdout) {
        return { elementIds: [], count: 0 };
      }

      // Parse output in JavaScript (not by LLM!)
      const ids = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => parseInt(line.trim(), 10))
        .filter((id) => !isNaN(id));

      return {
        elementIds: ids,
        count: ids.length,
      };
    } catch (error) {
      console.error("Failed to extract IDs:", error);
      return { elementIds: [], count: 0 };
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
    instructions: `You control 3D viewer actions. Execute user commands IMMEDIATELY.

## Available Tools

1. **read_file** - Read small files (schemas only!)
2. **extract-ids-from-file** - Get element IDs from JSONL (USE THIS!)
3. **select-elements** - Highlight elements in viewer
4. **hide-elements** - Make elements invisible
5. **show-elements** - Make elements visible
6. **isolate-elements** - Show only these elements

## Data Structure

- schema/storeys.json - Available floors (read for any floor query!)
- schema/categories.json - Available IFC types
- index/by_category/{TYPE}.jsonl - All elements of a type
- index/by_storey/{SLUG}.jsonl - All elements on a floor

## Critical Workflow

### For ANY query mentioning a floor/level/storey:

1. **ALWAYS read schema/storeys.json FIRST**
2. **Match user's floor to the slug** (case-insensitive, flexible)
3. **Use extract-ids-from-file** with the correct path
4. **Call action tool** with the returned elementIds

### For element type queries:

1. If unsure about IFC type, read schema/categories.json first
2. Use extract-ids-from-file to get IDs
3. Call action tool immediately

## Tool Usage

**Extract IDs from a file:**
\`\`\`
extract-ids-from-file({ 
  filePath: "index/by_category/IFCWINDOW.jsonl" 
})
→ Returns: { elementIds: [6518, 6563, 6595], count: 3 }
\`\`\`

**Get all elements on a floor:**
\`\`\`
extract-ids-from-file({ 
  filePath: "index/by_storey/gl.jsonl" 
})
→ Returns: { elementIds: [...], count: 537 }
\`\`\`

## Example Workflows

**User: "select all windows"**
\`\`\`
Step 1: extract-ids-from-file({ filePath: "index/by_category/IFCWINDOW.jsonl" })
Step 2: Receive { elementIds: [6518, 6563, 6595], count: 3 }
Step 3: select-elements({ elementIds: [6518, 6563, 6595] })
\`\`\`

**User: "select gl level"**
\`\`\`
Step 1: Read "schema/storeys.json"
Step 2: Find storey matching "gl" → slug is "gl"
Step 3: extract-ids-from-file({ filePath: "index/by_storey/gl.jsonl" })
Step 4: Receive { elementIds: [...], count: 537 }
Step 5: select-elements({ elementIds: [...] })
\`\`\`

**User: "hide walls on floor 2"**
\`\`\`
Step 1: Read "schema/storeys.json" to get slug
Step 2: Read "index/by_storey/{slug}.jsonl"
Step 3: Parse JSONL manually, filter for IFCWALL
Step 4: Extract IDs from filtered lines
Step 5: hide-elements({ elementIds: [...] })
\`\`\`

## Rules

1. ✅ For floors: ALWAYS read schema/storeys.json FIRST
2. ✅ Use extract-ids-from-file for simple queries (entire file)
3. ✅ For filtered queries (type on floor): read + parse manually
4. ✅ Never parse grep output yourself - use extract-ids-from-file
5. ✅ Call action tool IMMEDIATELY with elementIds

## Storey Matching

When user mentions a floor:
1. Read schema/storeys.json
2. Match flexibly (case-insensitive, ignore prefixes)
3. Use the exact slug from the schema

Examples:
- "gl", "ground level", "planta baja" → Match storey with "GL" or "Ground"
- "b2", "basement 2" → Match storey with "B2"
- "1", "level 1", "first floor" → Match storey with "1"

DO NOT guess slugs - always read the schema!`,
    workspace,
    tools: {
      extractIdsFromFileTool: createExtractIdsFromFileTool(workspace),
      selectElementsTool,
      hideElementsTool,
      showElementsTool,
      isolateElementsTool,
    },
  });
}
