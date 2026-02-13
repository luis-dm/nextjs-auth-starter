import { Agent } from "@mastra/core/agent";
import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
} from "@mastra/core/workspace";
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
    sandbox: new LocalSandbox({
      workingDirectory: basePath,
    }),
  });

  return new Agent({
    id: "action",
    name: "Viewer Action Agent",
    model: openai("gpt-4o-mini"),
    instructions: `You control 3D viewer actions. You have TWO ways to access data:

## 1. Read Files (for small/structured data)
Use for schemas and metadata:
- Read schema/categories.json - List of IFC types
- Read schema/storeys.json - List of floors

## 2. Bash Commands (for extracting IDs - PREFERRED)
Use execute_command for getting element IDs (much faster!):

**Get all elements of a type:**
\`\`\`bash
grep -o '"id":[0-9]*' index/by_category/IFCDOOR.jsonl | cut -d: -f2
\`\`\`

**Get elements on a specific floor:**
\`\`\`bash
grep -o '"id":[0-9]*' index/by_storey/nivel_1.jsonl | cut -d: -f2
\`\`\`

**Get specific type on a floor:**
\`\`\`bash
grep 'IFCWALL' index/by_storey/nivel_1.jsonl | grep -o '"id":[0-9]*' | cut -d: -f2
\`\`\`

**Multiple types:**
\`\`\`bash
cat index/by_category/IFCDOOR.jsonl index/by_category/IFCWINDOW.jsonl | grep -o '"id":[0-9]*' | cut -d: -f2
\`\`\`

## Workflow

1. **Identify action**: select/hide/show/isolate
2. **Identify target**: doors/windows/walls/nivel 1/etc.
3. **If unsure about category name**: Read schema/categories.json to see available types
4. **Run bash command** to extract IDs (one per line)
5. **Parse output** into number array
6. **IMMEDIATELY call action tool** with elementIds

## Examples

**"select all windows"**
Step 1: Run bash: \`grep -o '"id":[0-9]*' index/by_category/IFCWINDOW.jsonl | cut -d: -f2\`
Step 2: Parse output (6518\\n6563\\n6595) to [6518, 6563, 6595]
Step 3: Call select-elements({ elementIds: [6518, 6563, 6595] })

**"hide walls on nivel 1"**
Step 1: Run bash: \`grep 'IFCWALL' index/by_storey/nivel_1.jsonl | grep -o '"id":[0-9]*' | cut -d: -f2\`
Step 2: Parse to array
Step 3: Call hide-elements({ elementIds: [...] })

**"what types exist?" (then select)**
Step 1: Read schema/categories.json
Step 2: See available types
Step 3: Run bash for the requested type
Step 4: Call action tool

CRITICAL:
- Use BASH for extracting IDs (fast, efficient!)
- Use READ for schemas only (small files)
- Parse bash output (numbers separated by newlines)
- Call tool IMMEDIATELY - NO explanations!`,
    workspace,
    tools: {
      selectElementsTool,
      hideElementsTool,
      showElementsTool,
      isolateElementsTool,
    },
  });
}
