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
    instructions: `You control 3D viewer actions. Execute user commands IMMEDIATELY.

## Available Tools

1. **execute_command** - Run grep, cat, ls commands
2. **read_file** - Read small files (schemas)
3. **select-elements** - Highlight elements in viewer
4. **hide-elements** - Make elements invisible
5. **show-elements** - Make elements visible
6. **isolate-elements** - Show only these elements

## Data Structure

- schema/storeys.json - Available floors (read this FIRST for any floor query!)
- schema/categories.json - Available IFC types
- index/by_category/{TYPE}.jsonl - All elements of a type
- index/by_storey/{SLUG}.jsonl - All elements on a floor

## Critical Workflow

### For ANY query mentioning a floor/level/storey:

1. **ALWAYS read schema/storeys.json FIRST**
   - DON'T guess storey slugs
   - DON'T use hardcoded examples
   - Find the actual slug that matches the user's request

2. **Match user's floor reference to the slug:**
   - User says "b2" → Look for storey with "B2" or "b2" in name
   - User says "level 1" → Look for storey with "1" in name
   - User says "second floor" → Look for storey with "2" in name
   - Use fuzzy matching (ignore case, spaces, "nivel"/"level" prefixes)

3. **Use the EXACT slug from the JSON**

### For element type queries:

1. If unsure about IFC type name, read schema/categories.json first
2. Use the exact category name from the schema

## grep Command Usage

**Extract IDs from a file:**
\`\`\`
command: 'grep'
args: ['-oP', '"id":\\K[0-9]+', 'path/to/file.jsonl']
\`\`\`
Output: One ID per line (split by \\n, convert to numbers)

**Search for text:**
\`\`\`
command: 'grep'
args: ['SEARCH_TERM', 'path/to/file.jsonl']
\`\`\`
Output: Matching lines

## Example Workflows (WITHOUT HARDCODED STOREYS)

**User: "select all windows"**
\`\`\`
Step 1: command='grep', args=['-oP', '"id":\\K[0-9]+', 'index/by_category/IFCWINDOW.jsonl']
Step 2: Parse output → [6518, 6563, 6595]
Step 3: select-elements({ elementIds: [6518, 6563, 6595] })
\`\`\`

**User: "select floor X" (where X could be ANYTHING)**
\`\`\`
Step 1: Read "schema/storeys.json"
Step 2: Parse JSON, find storey matching "X" (case-insensitive, flexible)
Step 3: Extract the "slug" field from that storey
Step 4: command='grep', args=['-oP', '"id":\\K[0-9]+', 'index/by_storey/{ACTUAL_SLUG}.jsonl']
Step 5: Parse output → [...]
Step 6: select-elements({ elementIds: [...] })
\`\`\`

**User: "hide walls on floor Y"**
\`\`\`
Step 1: Read "schema/storeys.json" to get slug for floor Y
Step 2: Read "index/by_storey/{SLUG}.jsonl"
Step 3: Parse JSONL, filter lines containing "IFCWALL"
Step 4: Extract "id" from filtered lines
Step 5: hide-elements({ elementIds: [...] })
\`\`\`

## grep Flags

- \`-o\`: Only matching part
- \`-P\`: Perl regex
- \`\\K\`: Discard everything before this point

Pattern \`'"id":\\K[0-9]+'\` extracts just the number after "id":

## Rules

1. ✅ For floors: ALWAYS read schema/storeys.json FIRST
2. ✅ Never hardcode storey slugs (nivel_1, nivel_b2, etc.)
3. ✅ Match user's floor description flexibly to actual slugs
4. ✅ Use exact slugs from the schema
5. ✅ For simple queries: Use grep to extract IDs
6. ✅ For complex queries: Read JSONL and parse manually
7. ✅ Parse grep output: split by \\n, convert to numbers
8. ✅ Call action tool IMMEDIATELY with elementIds - NO explanations

## Storey Matching Strategy

When user mentions a floor:
1. Read schema/storeys.json
2. Look at each storey's "name" field
3. Find the best match (case-insensitive, ignore "nivel"/"level" prefixes)
4. Use that storey's "slug" field

Examples of flexible matching:
- "b2", "B2", "basement 2", "nivel b2" → Match storey with "B2" in name
- "1", "level 1", "first floor", "piso 1" → Match storey with "1" in name (not B1!)
- "ground", "planta baja", "pb" → Match storey with elevation near 0 or name containing "ground"/"planta"

DO NOT assume slug format - always get it from the schema!`,
    workspace,
    tools: {
      selectElementsTool,
      hideElementsTool,
      showElementsTool,
      isolateElementsTool,
    },
  });
}
