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

    // Generate response from the agent (it will read from the filesystem)
    console.log("Generating response for message:", message);
    const result = await agent.generate(message, {
      maxSteps: 10,
    });

    console.log("Agent result:", {
      text: result.text,
      hasText: !!result.text,
      resultKeys: Object.keys(result),
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
