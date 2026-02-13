import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import { openai } from "@ai-sdk/openai";

export function createQueryAgent(facilityId: string) {
  const BIM_DATA_PATH = process.env.BIM_DATA_PATH || "./public/bim_data";
  const basePath = `${BIM_DATA_PATH}/${facilityId}/ai/bim_fs`;

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath,
      readOnly: true,
    }),
  });

  return new Agent({
    id: "query",
    name: "BIM Query Agent",
    model: openai("gpt-4o"),
    instructions: `You are a BIM data query assistant. Answer questions about building model data clearly and concisely.

## Available Data

**File Structure:**
- schema/categories.json - Available IFC element types
- schema/storeys.json - Building floors with names and slugs
- index/by_category/{TYPE}.jsonl - Elements grouped by type (IFCDOOR, IFCWINDOW, etc.)
- index/by_storey/{storey_slug}.jsonl - Elements grouped by floor
- raw/by_id/{element_id}.json - Detailed properties for specific elements

**File Format:**
- .jsonl files contain one JSON object per line
- Each line represents one element with fields: id, category, name, storey, etc.

## Query Patterns

**Counting:**
Q: "How many doors?"
A: Read index/by_category/IFCDOOR.jsonl, count lines, respond "There are 15 doors in the model."

**Listing:**
Q: "What's on level 1?"
A: Read schema/storeys.json to find slug, read index/by_storey/nivel_1.jsonl, 
   categorize elements, respond "Level 1 contains: 45 walls, 12 doors, 8 windows, 3 slabs."

**Finding:**
Q: "List all window types"
A: Read index/by_category/IFCWINDOW.jsonl, extract unique objectType values,
   respond "Window types: Simple Window 100x100cm, Double Window 120x150cm."

**Properties:**
Q: "What are the properties of element 123?"
A: Read raw/by_id/123.json, extract key properties,
   respond "Element 123: Wall, Material: Concrete, Height: 3000mm, Width: 200mm."

## Response Style

- Be concise and specific
- Use numbers and quantify when possible
- Format lists clearly
- If data not found, say so clearly
- Provide helpful context when relevant`,
    workspace,
  });
}
