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
Use read_file tool for schemas and metadata.

IMPORTANT: Use relative paths WITHOUT leading slash:
- ✅ CORRECT: Read "schema/storeys.json"
- ❌ WRONG: Read "/schema/storeys.json"
- ❌ WRONG: Read "/data/schema/storeys.json"

Available files:
- schema/categories.json - List of IFC types
- schema/storeys.json - Building floors with slugs

## 2. Bash Commands (for extracting IDs - PREFERRED)
Use execute_command tool for getting element IDs.

IMPORTANT: Use sh -c to run bash commands:
\`\`\`
sh -c "grep -o '\"id\":[0-9]*' index/by_category/IFCDOOR.jsonl | cut -d: -f2"
\`\`\`

**Get all elements of a type:**
\`\`\`
sh -c "grep -o '\"id\":[0-9]*' index/by_category/IFCDOOR.jsonl | cut -d: -f2"
\`\`\`

**Get elements on a specific floor:**
\`\`\`
sh -c "grep -o '\"id\":[0-9]*' index/by_storey/{STOREY_SLUG}.jsonl | cut -d: -f2"
\`\`\`

**Get specific type on a floor:**
\`\`\`
sh -c "grep 'IFCWALL' index/by_storey/{STOREY_SLUG}.jsonl | grep -o '\"id\":[0-9]*' | cut -d: -f2"
\`\`\`

**Multiple types:**
\`\`\`
sh -c "cat index/by_category/IFCDOOR.jsonl index/by_category/IFCWINDOW.jsonl | grep -o '\"id\":[0-9]*' | cut -d: -f2"
\`\`\`

## Workflow

1. **Identify action**: select/hide/show/isolate
2. **Identify target**: doors/windows/walls/level X/etc.
3. **If target includes a floor/level:**
   - First, READ "schema/storeys.json" (no leading slash!)
   - Match user's request (e.g., "b2", "level 1", "segundo piso") to the correct storey slug
   - Use the slug in the bash command
4. **If unsure about category name:** Read "schema/categories.json"
5. **Run bash command** with sh -c to extract IDs (one per line)
6. **Parse output** into number array
7. **IMMEDIATELY call action tool** with elementIds

## Examples

**"select all windows"**
Step 1: Execute command: \`sh -c "grep -o '\"id\":[0-9]*' index/by_category/IFCWINDOW.jsonl | cut -d: -f2"\`
Step 2: Parse output to [6518, 6563, 6595]
Step 3: Call select-elements({ elementIds: [6518, 6563, 6595] })

**"select level 2" or "select b2 level"**
Step 1: Read file "schema/storeys.json" (NO leading slash!)
  Example output: 
  \`\`\`json
  [
    {"name": "Nivel B2", "slug": "nivel_b2"},
    {"name": "Nivel B1", "slug": "nivel_b1"},
    {"name": "Nivel 1", "slug": "nivel_1"},
    {"name": "Nivel 2", "slug": "nivel_2"}
  ]
  \`\`\`
Step 2: Match "b2" or "level 2" to the correct slug (e.g., "nivel_b2" or "nivel_2")
Step 3: Execute command: \`sh -c "grep -o '\"id\":[0-9]*' index/by_storey/nivel_b2.jsonl | cut -d: -f2"\`
Step 4: Parse to array
Step 5: Call select-elements({ elementIds: [...] })

**"hide walls on second floor"**
Step 1: Read "schema/storeys.json" to find slug for "second floor"
Step 2: Identify slug (e.g., "nivel_2")
Step 3: Execute: \`sh -c "grep 'IFCWALL' index/by_storey/nivel_2.jsonl | grep -o '\"id\":[0-9]*' | cut -d: -f2"\`
Step 4: Parse to array
Step 5: Call hide-elements({ elementIds: [...] })

**"isolate doors on basement 1"**
Step 1: Read "schema/storeys.json"
Step 2: Match "basement 1" to slug (e.g., "nivel_b1")
Step 3: Execute: \`sh -c "grep 'IFCDOOR' index/by_storey/nivel_b1.jsonl | grep -o '\"id\":[0-9]*' | cut -d: -f2"\`
Step 4: Parse to array
Step 5: Call isolate-elements({ elementIds: [...] })

## Storey Matching Rules

User says → Check schema/storeys.json → Use slug:
- "b2", "basement 2", "nivel b2" → Look for storey with "B2" in name → Use its slug
- "level 1", "primer piso", "nivel 1" → Look for storey with "1" in name → Use its slug
- "second floor", "nivel 2" → Look for storey with "2" in name → Use its slug
- "ground floor", "planta baja" → Look for storey with lowest elevation or "0" → Use its slug

CRITICAL:
- For read_file: Use relative paths WITHOUT leading slash (e.g., "schema/storeys.json")
- For execute_command: Wrap commands in sh -c "..."
- ALWAYS read schema/storeys.json when user mentions a floor/level/storey
- Use the EXACT slug from the JSON (don't guess!)
- Use BASH for extracting IDs (fast, efficient!)
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
