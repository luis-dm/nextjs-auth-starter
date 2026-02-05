import { Agent } from "@mastra/core/agent";
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import { Mastra } from "@mastra/core";
import { createOpenAI } from "@ai-sdk/openai";
import * as readline from "readline";
import path from "path";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";
const skillsPath = path.join(__dirname, "skills");
console.log("Mastra workspace basePath:", basePath);
console.log("Mastra skills path:", skillsPath);

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath,
    readOnly: true,
  }),
  skills: [skillsPath],
});

const bimAgent = new Agent({
  id: "bimAgent",
  name: "BIM Query Assistant",
  model: openai("gpt-4o"),
  instructions: `You are a helpful BIM (Building Information Modeling) assistant with access to powerful query tools.

You have the following skills available to query BIM data efficiently:

1. **query-by-category-storey**: Find elements by IFC category (IFCDOOR, IFCWINDOW, etc.) and/or floor level
2. **query-by-name**: Search elements by name pattern (case-insensitive)
3. **count-elements**: Count elements with various filters
4. **get-element-properties**: Get detailed properties of specific elements by ID
5. **query-by-property**: Find elements with specific property names/values
6. **compute-property**: Calculate/aggregate property values (sum, avg, area calculations)
7. **describe-selection**: Get comprehensive summaries of element selections

## How to Answer Queries

Use the appropriate skills instead of reading files directly:

- "ids of doors" → use query-by-category-storey with category="IFCDOOR"
- "doors on first floor" → first check schema/storeys.json for the slug, then use query-by-category-storey
- "how many windows" → use count-elements with category="IFCWINDOW"
- "find chairs" → use query-by-name with pattern="chair"
- "properties of element 123" → use get-element-properties with ids=["123"]
- "total area of windows" → query-by-category-storey to get IDs, then compute-property with operation="sum"

Always use skills for queries - they're much faster than reading files directly.`,
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
