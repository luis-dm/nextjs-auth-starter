import { NextRequest, NextResponse } from "next/server";
import { createBIMWorkflow } from "@/utils/workflows/bim-workflow";

export async function POST(req: NextRequest) {
  try {
    const { message, facilityId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    if (!facilityId) {
      return NextResponse.json(
        { error: "Facility ID required" },
        { status: 400 },
      );
    }

    console.log("🚀 Processing message:", message, "for facility:", facilityId);

    // Create workflow
    const workflow = createBIMWorkflow(facilityId);

    // Create a run
    const run = await workflow.createRun();

    // Execute the workflow
    const workflowResult = await run.start({
      inputData: { message, facilityId },
    });

    console.log("✅ Workflow completed:", workflowResult.status);

    // Check if workflow failed
    if (workflowResult.status === "failed") {
      console.error("❌ Workflow failed:", workflowResult.error);
      return NextResponse.json(
        {
          error: workflowResult.error?.message || "Workflow execution failed",
        },
        { status: 500 },
      );
    }

    // Extract action from steps if present (only for successful results)
    if (workflowResult.status === "success") {
      // Check result.steps for agent steps with tool results
      if (
        workflowResult.result?.steps &&
        Array.isArray(workflowResult.result.steps)
      ) {
        for (const step of workflowResult.result.steps) {
          if (step.toolResults) {
            for (const toolResult of step.toolResults) {
              let resultData = toolResult as any;

              // Unwrap payload.result if needed
              if (resultData.payload?.result) {
                resultData = resultData.payload.result;
              }

              // Check if it's an action
              if (resultData.action && resultData.elementIds) {
                console.log("✅ Action found:", resultData);
                return NextResponse.json({
                  response: resultData.message,
                  action: resultData.action,
                  elementIds: resultData.elementIds,
                });
              }
            }
          }
        }
      }

      // Return text response
      return NextResponse.json({
        response: workflowResult.result?.text || "No response generated",
      });
    }

    // Fallback (shouldn't reach here)
    return NextResponse.json({
      response: "Workflow completed with unknown status",
    });
  } catch (error) {
    console.error("❌ Workflow error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process",
      },
      { status: 500 },
    );
  }
}
