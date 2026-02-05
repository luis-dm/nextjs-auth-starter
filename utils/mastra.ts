import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import { Mastra } from "@mastra/core";
import { createOpenAI } from "@ai-sdk/openai";
import * as readline from "readline";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";
console.log("Mastra workspace basePath:", basePath);

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath,
    readOnly: true,
  }),
  skills: ["./skills"],
});

const bimAgent = new Agent({
  id: "bimAgent",
  name: "BIM Query Assistant",
  model: openai("gpt-4o"),
  instructions: `You are a helpful BIM (Building Information Modeling) assistant with access to organized IFC model data.

## Available Data Structure

The BIM filesystem is organized as follows:

### Schema Files (metadata about the building)
- schema/categories.json - List of all IFC element types (IFCDOOR, IFCWINDOW, IFCWALL, etc.)
- schema/storeys.json - Building levels with names, slugs, and aliases (e.g., "Nivel 1" = "nivel_1")

### Index Files (quick lookup)
- index/by_category/{CATEGORY}.jsonl - All elements of a specific type
  Examples: index/by_category/IFCDOOR.jsonl, index/by_category/IFCWINDOW.jsonl
- index/by_storey/{storey_slug}.jsonl - All elements on a specific floor
  Examples: index/by_storey/nivel_1.jsonl, index/by_storey/nivel_2.jsonl

### Raw Element Data
- raw/by_id/{element_id}.json - Complete properties for individual elements

## How to Answer Queries

1. **Find all doors**: Read index/by_category/IFCDOOR.jsonl
2. **Find first floor elements**: 
   - First read schema/storeys.json to find the slug for "first floor"
   - Then read index/by_storey/{slug}.jsonl
3. **Find doors on first floor**:
   - Read schema/storeys.json to get floor slug
   - Read index/by_category/IFCDOOR.jsonl
   - Filter results where storeySlug matches the floor slug
4. **Get element details**: Read raw/by_id/{id}.json

## Response Format

- Provide specific counts and IDs when available
- Reference actual element properties from the files
- If you can't find data, explain which file you checked

Example: "I found 15 doors on Nivel 1. The IDs are: [list IDs from the JSONL file]"`,
  workspace,
});

export const mastra = new Mastra({
  agents: { bimAgent },
});

async function main() {
  console.log("\n🏗️  BIM Chatbot");
  console.log("Type 'exit' to quit\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  while (true) {
    const userInput = await askQuestion("You: ");

    if (!userInput.trim() || userInput.toLowerCase() === "exit") {
      console.log("\nGoodbye!\n");
      rl.close();
      break;
    }

    try {
      const result = await bimAgent.generate(userInput);

      console.log(`\nAssistant: ${result.text}\n`);
    } catch (error) {
      console.error(
        "\n❌ Error:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
