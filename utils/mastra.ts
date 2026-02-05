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
  instructions: `You are a helpful BIM (Building Information Modeling) assistant. 
You help users query and analyze building elements from IFC models.

The BIM data is stored in enhanced_structure.json which contains:
- Hierarchical spatial structure (building → storeys → spaces → elements)
- Each element has properties like Name, ObjectType, Material, dimensions, etc.
- Elements are organized by their spatial containment

When users ask questions:
1. Read the enhanced_structure.json file to understand the building structure
2. Navigate through the hierarchy to find relevant elements
3. Analyze properties to answer specific questions
4. Provide clear, concise answers with relevant details

Example queries you can handle:
- "How many doors are on the first floor?"
- "What materials are used for walls?"
- "Show me all windows in the building"
- "What's the area of spaces on level 2?"`,
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
