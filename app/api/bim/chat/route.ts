import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/utils/mastra";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 },
      );
    }

    // Get the BIM agent from Mastra
    const agent = mastra.getAgent("bimAgent");

    if (!agent) {
      return NextResponse.json(
        { error: "BIM agent not found" },
        { status: 500 },
      );
    }

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
