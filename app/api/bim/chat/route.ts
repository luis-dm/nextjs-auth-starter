import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const { message, facilityId } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 },
      );
    }

    if (!facilityId) {
      return NextResponse.json(
        { error: "Facility ID is required" },
        { status: 400 },
      );
    }

    console.log("Chat API: Processing message for facility:", facilityId);

    // Create facility-specific workspace
    const BIM_DATA_PATH = process.env.BIM_DATA_PATH || "./public/bim_data";
    const basePath = `${BIM_DATA_PATH}/${facilityId}/ai/bim_fs`;
    console.log("Creating workspace with basePath:", basePath);

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({
        basePath,
        readOnly: true,
      }),
      sandbox: new LocalSandbox({
        workingDirectory: basePath,
      }),
    });

    // Create agent with facility-specific workspace
    const agent = new Agent({
      id: "bimAgent",
      name: "BIM Agent",
      model: openai("gpt-4o"),
      instructions: `You are a BIM assistant with access to IFC model data and 3D viewer controls.

## Data Access (via bash commands)

You have access to bash commands via the execute_command tool. Use them to query BIM data:

**Directory Structure:**
- schema/categories.json - Available IFC types
- schema/storeys.json - Building floors with slugs and aliases
- index/by_category/{CATEGORY}.jsonl - Elements by type
- index/by_storey/{storey_slug}.jsonl - Elements by floor
- raw/by_id/{element_id}.json - Detailed element properties

**Useful Bash Commands:**
- \`cat schema/categories.json\` - List all available element types
- \`cat schema/storeys.json\` - List all storeys/floors with their slugs
- \`cat index/by_category/IFCDOOR.jsonl\` - Get all door elements
- \`grep '"localId"' index/by_category/IFCDOOR.jsonl | head -5\` - Preview door IDs
- \`cat index/by_storey/level_1.jsonl\` - Get all elements on a specific floor
- \`ls index/by_category/\` - List available element types
- \`ls index/by_storey/\` - List available floors
- \`wc -l index/by_category/IFCDOOR.jsonl\` - Count number of doors

**Important Notes:**
- All index files use .jsonl format (JSON Lines) - each line is a separate JSON object
- Use \`cat\` to read entire files
- Use \`grep\`, \`awk\`, \`jq\` for parsing JSON
- Working directory is already set to the BIM filesystem root

## Actions (via tools)

You have these action tools:
- select-elements: Highlight elements
- hide-elements: Hide elements
- show-elements: Show hidden elements
- isolate-elements: Focus on specific elements

## CRITICAL Workflow for Actions

When user wants to SELECT, HIDE, SHOW, or ISOLATE:

1. Use bash commands to query the data and find elements
2. Parse the output to extract **localId** values
3. IMMEDIATELY call the action tool with those IDs
4. DO NOT generate explanatory text

**Example 1: "select all doors"**
Step 1: Run \`cat index/by_category/IFCDOOR.jsonl\`
Step 2: Parse each line to extract localId field: [123, 456, 789]
Step 3: Call select-elements({ elementIds: [123, 456, 789] })

**Example 2: "select all elements on level 1"**
Step 1: Run \`cat schema/storeys.json\` to find slug for "level 1" (e.g., "level_1")
Step 2: Run \`cat index/by_storey/level_1.jsonl\`
Step 3: Parse each line to extract localId field
Step 4: Call select-elements({ elementIds: [...] })

**Example 3: "hide all slabs"**
Step 1: Run \`cat index/by_category/IFCSLAB.jsonl\`
Step 2: Parse localId values
Step 3: Call hide-elements({ elementIds: [...] })

DO NOT say "I found X elements" - just call the tool immediately after querying.`,
      workspace,
      tools: {
        selectElementsTool,
        hideElementsTool,
        showElementsTool,
        isolateElementsTool,
      },
    });

    // Use streaming to get tool results
    console.log("Generating response for message:", message);
    const result = await agent.generate(message, {
      maxSteps: 10,
    });

    console.log("Agent result:", {
      text: result.text,
      stepsCount: result.steps?.length,
    });

    let responseText = result.text || "";
    let lastAction: any = null;

    // Check if any of the tool results contain actions
    if (result.steps && Array.isArray(result.steps)) {
      console.log("Checking steps for actions...");
      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];
        console.log(`Step ${i}:`, {
          hasToolResults: "toolResults" in step,
          toolResultsLength:
            "toolResults" in step ? (step as any).toolResults?.length : 0,
        });

        // Check if this step has toolResults
        if ("toolResults" in step && Array.isArray(step.toolResults)) {
          for (let j = 0; j < step.toolResults.length; j++) {
            const toolResult = step.toolResults[j];
            console.log(`  Tool result ${j}:`, {
              type: typeof toolResult,
              hasAction: toolResult && "action" in toolResult,
              hasElementIds: toolResult && "elementIds" in toolResult,
              result: toolResult,
            });

            if (toolResult && typeof toolResult === "object") {
              // The actual result might be nested in payload.result
              let resultData = toolResult as any;

              // Check if it's wrapped in the Mastra tool result structure
              if (resultData.payload && resultData.payload.result) {
                resultData = resultData.payload.result;
                console.log(`  Unwrapped payload.result:`, resultData);
              }

              if (resultData.action && resultData.elementIds) {
                lastAction = resultData;
                responseText =
                  resultData.message ||
                  `Performing ${resultData.action} on ${resultData.elementIds.length} elements`;
                console.log("✅ Action found:", lastAction);
              }
            }
          }
        }
      }
    }

    // If we have an action to perform, return it with the response
    if (lastAction) {
      console.log("Returning action response:", {
        action: lastAction.action,
        elementIdsCount: lastAction.elementIds.length,
        elementIds: lastAction.elementIds,
      });
      return NextResponse.json({
        response: responseText || lastAction.message,
        action: lastAction.action,
        elementIds: lastAction.elementIds,
      });
    }

    console.log("No action found, returning text response");
    return NextResponse.json({
      response: responseText || "I couldn't generate a response.",
    });
  } catch (error) {
    console.error("Error processing chat message:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 },
    );
  }
}
