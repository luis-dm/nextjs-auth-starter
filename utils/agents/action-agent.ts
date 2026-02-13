import { Agent } from "@mastra/core/agent";
import { Workspace, LocalSandbox } from "@mastra/core/workspace";
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
    sandbox: new LocalSandbox({
      workingDirectory: basePath,
    }),
  });

  return new Agent({
    id: "action",
    name: "Viewer Action Agent",
    model: openai("gpt-4o-mini"),
    instructions: `You control 3D viewer actions using bash commands.

## Bash Commands for Getting IDs

Use execute_command tool with these bash commands:

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

**List available categories:**
\`\`\`bash
cat schema/categories.json
\`\`\`

**List available floors:**
\`\`\`bash
cat schema/storeys.json
\`\`\`

## Workflow

1. **Identify action**: select/hide/show/isolate
2. **Identify target**: doors/windows/walls/level X/etc.
3. **Run bash command** to extract IDs (output is one ID per line)
4. **Parse output** into array: split by newline, convert to numbers
5. **IMMEDIATELY call action tool** with elementIds

## Examples

**"select all windows"**
Step 1: Run \`grep -o '"id":[0-9]*' index/by_category/IFCWINDOW.jsonl | cut -d: -f2\`
Step 2: Output is:
\`\`\`
6518
6563
6595
\`\`\`
Step 3: Parse to array: [6518, 6563, 6595]
Step 4: Call select-elements({ elementIds: [6518, 6563, 6595] })

**"hide walls on level 1"**
Step 1: Run \`grep 'IFCWALL' index/by_storey/nivel_1.jsonl | grep -o '"id":[0-9]*' | cut -d: -f2\`
Step 2: Parse output
Step 3: Call hide-elements({ elementIds: [...] })

**"isolate doors"**
Step 1: Run \`grep -o '"id":[0-9]*' index/by_category/IFCDOOR.jsonl | cut -d: -f2\`
Step 2: Parse output
Step 3: Call isolate-elements({ elementIds: [...] })

CRITICAL:
- Use bash to extract IDs (fast!)
- Parse the number-per-line output into array
- Call tool immediately - NO explanations!`,
    workspace,
    tools: {
      selectElementsTool,
      hideElementsTool,
      showElementsTool,
      isolateElementsTool,
    },
  });
}
