import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  createRouterAgent,
  createQueryAgent,
  createActionAgent,
  createChatAgent,
} from "@/utils/agents";

export function createBIMWorkflow(facilityId: string) {
  // Create agents
  const routerAgent = createRouterAgent();
  const queryAgent = createQueryAgent(facilityId);
  const actionAgent = createActionAgent(facilityId);
  const chatAgent = createChatAgent();

  // Step 1: Route the request
  const routeStep = createStep({
    id: "route-intent",
    inputSchema: z.object({
      message: z.string(),
      facilityId: z.string(),
    }),
    outputSchema: z.object({
      intent: z.string(),
      message: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log("🔀 Routing intent for:", inputData.message);
      const result = await routerAgent.generate(inputData.message);
      const intent = result.text?.trim().toUpperCase() || "CHAT";
      console.log("📍 Intent:", intent);
      return { intent, message: inputData.message };
    },
  });

  // Step 2A: Query agent
  const queryStep = createStep({
    id: "query-data",
    inputSchema: z.object({
      intent: z.string(),
      message: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
      steps: z.any().optional(),
    }),
    execute: async ({ inputData }) => {
      console.log("📊 Executing query agent");
      const result = await queryAgent.generate(inputData.message);
      console.log("📊 Query result:", result.text);
      return {
        text: result.text || "No response",
        steps: result.steps,
      };
    },
  });

  // Step 2B: Action agent
  const actionStep = createStep({
    id: "perform-action",
    inputSchema: z.object({
      intent: z.string(),
      message: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
      steps: z.any().optional(),
    }),
    execute: async ({ inputData }) => {
      console.log("🎬 Executing action agent");
      const result = await actionAgent.generate(inputData.message);
      console.log("🎬 Action result:", result.text);
      return {
        text: result.text || "Action completed",
        steps: result.steps,
      };
    },
  });

  // Step 2C: Chat response
  const chatStep = createStep({
    id: "general-chat",
    inputSchema: z.object({
      intent: z.string(),
      message: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log("💬 General chat response for:", inputData.message);
      const result = await chatAgent.generate(inputData.message);
      console.log("💬 Chat result:", result.text);
      return {
        text: result.text || "Hi! How can I help you?",
      };
    },
  });

  // Create workflow with branching
  return createWorkflow({
    id: "bim-chat-workflow",
    inputSchema: z.object({
      message: z.string(),
      facilityId: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
      steps: z.any().optional(),
    }),
  })
    .then(routeStep)
    .branch([
      [
        // Check the inputData which should have intent from routeStep output
        async ({ inputData }) => {
          console.log("🔍 Branch checking QUERY, inputData:", inputData);
          return (inputData as any).intent?.includes("QUERY");
        },
        queryStep,
      ],
      [
        async ({ inputData }) => {
          console.log("🔍 Branch checking ACTION, inputData:", inputData);
          return (inputData as any).intent?.includes("ACTION");
        },
        actionStep,
      ],
      [
        async ({ inputData }) => {
          console.log("🔍 Branch checking CHAT, inputData:", inputData);
          return (
            (inputData as any).intent?.includes("CHAT") ||
            !(inputData as any).intent
          );
        },
        chatStep,
      ],
    ])
    .commit();
}
