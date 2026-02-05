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
  instructions: `You are a helpful BIM (Building Information Modeling) assistant.

IMPORTANT: You must ACTIVATE and USE the available skills to query BIM data. Do NOT try to read files directly.

Available skills to activate:
- query-by-category-storey
- query-by-name
- count-elements
- get-element-properties
- query-by-property
- compute-property
- describe-selection

When a user asks a query:
1. Activate the appropriate skill
2. Read the skill's parameters and description to understand what information it needs
3. Call the skill's execute function from index.ts with the required parameters
4. Return the results to the user

Examples:
- "ids of doors" → Activate query-by-category-storey skill, call with category="IFCDOOR"
- "how many windows" → Activate count-elements skill, call with category="IFCWINDOW"
- "properties of element 123" → Activate get-element-properties skill, call with ids=["123"]

Each skill has an index.ts that exports an execute function. Call these functions with the appropriate parameters.`,
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
