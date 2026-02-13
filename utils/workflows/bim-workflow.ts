import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  createRouterAgent,
  createQueryAgent,
  createActionAgent,
} from "@/utils/agents";

export function createBIMWorkflow(facilityId: string) {
  // Create agents
  const routerAgent = createRouterAgent();
  const queryAgent = createQueryAgent(facilityId);
  const actionAgent = createActionAgent(facilityId);

  // Step 1: Route the request
  const routeStep = createStep({
    id: "route-intent",
    inputSchema: z.object({
      message: z.string(),
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
    execute: async () => {
      console.log("💬 General chat response");
      return {
        text: "¡Hola! Soy tu asistente BIM. Puedo ayudarte a consultar datos del modelo o manipular el visor 3D. Por ejemplo: 'selecciona todas las puertas' o '¿cuántas ventanas hay?'",
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
      [async ({ inputData }) => inputData.intent?.includes("QUERY"), queryStep],
      [
        async ({ inputData }) => inputData.intent?.includes("ACTION"),
        actionStep,
      ],
      [
        async ({ inputData }) =>
          inputData.intent?.includes("CHAT") || !inputData.intent,
        chatStep,
      ],
    ])
    .commit();
}
