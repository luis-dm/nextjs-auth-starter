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

    let responseText = result.text || "";
    let lastAction: any = null;

    // Check if any of the tool results contain actions
    if (result.steps && Array.isArray(result.steps)) {
      for (const step of result.steps) {
        // Check if this step has toolResults
        if ('toolResults' in step && Array.isArray(step.toolResults)) {
          for (const toolResult of step.toolResults) {
            if (toolResult && typeof toolResult === 'object') {
              const resultData = toolResult as any;
              if (resultData.action && resultData.elementIds) {
                lastAction = resultData;
                responseText = resultData.message || `Performing ${resultData.action} on ${resultData.elementIds.length} elements`;
              }
            }
          }
        }
      }
    }

    // If we have an action to perform, return it with the response
    if (lastAction) {
      return NextResponse.json({
        response: responseText || lastAction.message,
        action: lastAction.action,
        elementIds: lastAction.elementIds,
      });
    }

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
