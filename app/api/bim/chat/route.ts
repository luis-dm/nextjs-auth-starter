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

    // console.log("🚀 Processing message:", message, "for facility:", facilityId);

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

    // Check for other non-success statuses
    if (workflowResult.status !== "success") {
      console.warn("⚠️ Workflow status:", workflowResult.status);
      return NextResponse.json(
        {
          error: `Workflow ended with status: ${workflowResult.status}`,
        },
        { status: 500 },
      );
    }

    // NOW TypeScript knows it's a success result
    const result = workflowResult.result;

    // console.log("📦 Full result object:", JSON.stringify(result, null, 2));

    // The result is an object with step IDs as keys
    // We need to find the last executed step
    const stepResults = Object.values(result);
    const lastStepResult = stepResults[stepResults.length - 1] as any;

    console.log("📝 Last step result:", lastStepResult);

    // Check if there are steps with tool results (for actions or quick-action)
    if (lastStepResult?.steps && Array.isArray(lastStepResult.steps)) {
      console.log("🔍 Checking steps for actions...");
      for (const step of lastStepResult.steps) {
        if (step.toolResults) {
          for (const toolResult of step.toolResults) {
            let resultData = toolResult as any;

            // Unwrap payload.result if needed
            if (resultData.payload?.result) {
              resultData = resultData.payload.result;
            }

            // Check if it's a quick-action result
            if (
              resultData.action &&
              resultData.elementIds &&
              resultData.message
            ) {
              console.log("✅ Quick action found:", resultData);
              return NextResponse.json({
                response: resultData.message,
                action: resultData.action,
                elementIds: resultData.elementIds,
              });
            }

            // Check if it's an action (legacy)
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

    // Return text response from the last step
    return NextResponse.json({
      response: lastStepResult?.text || "No response generated",
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
