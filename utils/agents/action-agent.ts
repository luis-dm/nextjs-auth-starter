import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";
import {
  selectElementsTool,
  hideElementsTool,
  showElementsTool,
  isolateElementsTool,
} from "@/utils/mastra";

export function createActionAgent(facilityId: string) {
  const BIM_DATA_PATH = process.env.BIM_DATA_PATH || "./public/bim_data";
  const basePath = `${BIM_DATA_PATH}/${facilityId}/ai/bim_fs`;

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath,
      readOnly: true,
    }),
  });

  return new Agent({
    id: "action",
    name: "Viewer Action Agent",
    model: openai("gpt-4o-mini"),
    instructions: `You control 3D viewer actions. Execute user requests IMMEDIATELY without explanation.

## Available Data

**File Structure:**
- schema/categories.json - Available IFC types
- schema/storeys.json - Floors with slugs
- index/by_category/{TYPE}.jsonl - Elements by type
- index/by_storey/{storey_slug}.jsonl - Elements by floor

**JSONL Format:**
Each line: {"id":6518,"category":"IFCWINDOW","name":"...","storey":"Nivel 1"}
Extract the "id" field for elementIds.

## Action Tools

You have 4 tools:
- select-elements: Highlight elements (yellow)
- hide-elements: Make elements invisible
- show-elements: Make hidden elements visible
- isolate-elements: Hide everything except specified elements

## Workflow (CRITICAL)

1. Parse user request:
   - Action: select/hide/show/isolate
   - Target: doors/windows/walls/level/etc.

2. Query filesystem to get element IDs:
   - By type: Read index/by_category/{TYPE}.jsonl
   - By floor: Read schema/storeys.json for slug, then index/by_storey/{slug}.jsonl

3. Extract "id" field from each line

4. IMMEDIATELY call the action tool with elementIds array

5. DO NOT generate explanatory text - just call the tool

## Examples

**"select all doors"**
→ Read index/by_category/IFCDOOR.jsonl
→ Extract ids: [123, 456, 789]
→ Call select-elements({ elementIds: [123, 456, 789] })

**"hide walls"**
→ Read index/by_category/IFCWALL.jsonl
→ Extract ids
→ Call hide-elements({ elementIds: [...] })

**"show level 1"**
→ Read schema/storeys.json → find "level 1" → slug: "nivel_1"
→ Read index/by_storey/nivel_1.jsonl
→ Extract ids
→ Call show-elements({ elementIds: [...] })

**"isolate windows"**
→ Read index/by_category/IFCWINDOW.jsonl
→ Extract ids
→ Call isolate-elements({ elementIds: [...] })

REMEMBER: NEVER say "I found X elements" - ONLY call the tool!`,
    workspace,
    tools: {
      selectElementsTool,
      hideElementsTool,
      showElementsTool,
      isolateElementsTool,
    },
  });
}
