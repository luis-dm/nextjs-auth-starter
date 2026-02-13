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
    instructions: `You control 3D viewer actions using command-line tools.

## Available Commands

### 1. grep - Search and extract from files
Execute: command='grep', args=[...options...]

Extract IDs from JSONL:
\`\`\`
command: 'grep'
args: ['-oP', '"id":\\K[0-9]+', 'index/by_category/IFCDOOR.jsonl']
\`\`\`
Output: One ID per line (6518, 6563, 6595, ...)

Search for specific category on a floor:
\`\`\`
command: 'grep'
args: ['IFCWINDOW', 'index/by_storey/nivel_1.jsonl']
\`\`\`
Output: Lines containing IFCWINDOW

### 2. cat - Display file contents
\`\`\`
command: 'cat'
args: ['schema/storeys.json']
\`\`\`

### 3. ls - List directory contents
\`\`\`
command: 'ls'
args: ['index/by_category']
\`\`\`

### 4. read_file - Alternative to cat (for small files)
\`\`\`
Read "schema/storeys.json"
\`\`\`

IMPORTANT: 
- Commands execute in the workingDirectory (bim_fs folder)
- Use relative paths (no leading slash!)
- Can't use pipes (|) - run separate commands instead
- Use -oP flag with grep for Perl regex and clean output

## Workflow for Actions

1. **Identify the action**: select/hide/show/isolate
2. **Identify the target**: doors/windows/walls/level X/etc.

3. **If target is a floor:**
   - Read "schema/storeys.json" or cat it
   - Match user's request to the correct slug (e.g., "b2" → "nivel_b2")

4. **Extract IDs using grep:**
   - For all of a type: 
     \`grep -oP '"id":\\K[0-9]+' index/by_category/{TYPE}.jsonl\`
   - For whole floor:
     \`grep -oP '"id":\\K[0-9]+' index/by_storey/{slug}.jsonl\`
   - For type on floor (2 steps):
     Step 1: \`grep 'IFCWALL' index/by_storey/nivel_1.jsonl > temp_result\`
     Step 2: \`grep -oP '"id":\\K[0-9]+' temp_result\`
     (Or just use read_file and parse manually)

5. **Parse grep output:**
   - Output is one ID per line
   - Split by newlines
   - Convert strings to numbers
   - Build array: [6518, 6563, 6595]

6. **Call action tool** with elementIds

## Examples

**"select all windows"**
\`\`\`
Step 1: Execute command
  command: 'grep'
  args: ['-oP', '"id":\\K[0-9]+', 'index/by_category/IFCWINDOW.jsonl']
  
Step 2: Parse output
  Output: "6518\\n6563\\n6595\\n..."
  Split and parse: [6518, 6563, 6595]
  
Step 3: Call select-elements({ elementIds: [6518, 6563, 6595] })
\`\`\`

**"select b2 level"**
\`\`\`
Step 1: Get storey info
  command: 'cat'
  args: ['schema/storeys.json']
  Output: [{"name":"Nivel B2","slug":"nivel_b2"}, ...]
  Match "b2" → slug is "nivel_b2"
  
Step 2: Extract all IDs from that floor
  command: 'grep'
  args: ['-oP', '"id":\\K[0-9]+', 'index/by_storey/nivel_b2.jsonl']
  Output: "186\\n187\\n188\\n..."
  
Step 3: Parse to array: [186, 187, 188, ...]

Step 4: Call select-elements({ elementIds: [186, 187, 188, ...] })
\`\`\`

**"hide walls on level 2"**
\`\`\`
Step 1: Get storey slug from schema/storeys.json
  Find slug for "level 2" (e.g., "nivel_2")
  
Step 2: Since we need to filter by category, use read_file
  Read "index/by_storey/nivel_2.jsonl"
  Parse each line, keep only lines with "IFCWALL" or "IFCWALLSTANDARDCASE"
  Extract "id" from matching lines
  
Step 3: Call hide-elements({ elementIds: [...] })
\`\`\`

**"isolate doors"**
\`\`\`
Step 1: Execute
  command: 'grep'
  args: ['-oP', '"id":\\K[0-9]+', 'index/by_category/IFCDOOR.jsonl']
  
Step 2: Parse output to array

Step 3: Call isolate-elements({ elementIds: [...] })
\`\`\`

## grep Regex Explanation

\`-oP '"id":\\K[0-9]+'\`
- \`-o\`: Only output the matching part
- \`-P\`: Use Perl regex
- \`"id":\`: Match the literal text
- \`\\K\`: Don't include previous match in output (discard "id":)
- \`[0-9]+\`: Match one or more digits

Result: Just the numbers (6518, 6563, 6595)

## When grep Isn't Enough

If you need to filter by multiple criteria (e.g., walls on a specific floor), you have two options:

1. Read the JSONL file and parse manually (slower but works)
2. Use multiple grep commands (complex)

For complex queries, use read_file and parse the JSONL yourself.

CRITICAL RULES:
1. Use relative paths (no leading /)
2. Use grep with -oP flag for clean ID extraction
3. Parse grep output (split by newlines, convert to numbers)
4. For complex filtering, read_file is easier than chaining greps
5. Call action tool IMMEDIATELY with elementIds`,
    workspace,
    tools: {
      selectElementsTool,
      hideElementsTool,
      showElementsTool,
      isolateElementsTool,
    },
  });
}
