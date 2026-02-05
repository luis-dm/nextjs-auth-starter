import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/utils/mastra";

export async function POST(req: NextRequest) {
  try {
    const { message, structure } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 },
      );
    }

    if (!structure) {
      return NextResponse.json(
        { error: "No BIM structure provided" },
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

    // Create context with the structure data
    const contextMessage = `Here is the BIM structure data:
${JSON.stringify(structure, null, 2)}

User question: ${message}`;

    // Generate response from the agent
    const result = await agent.generate(contextMessage, {
      maxSteps: 10,
    });

    return NextResponse.json({
      response: result.text || "I couldn't generate a response.",
    });
  } catch (error) {
    console.error("Error processing chat message:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 },
    );
  }
}
