import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  createRouterAgent,
  createQueryAgent,
  createActionAgent,
  createChatAgent,
  createSearchAgent,
} from "@/utils/agents";

export function createBIMWorkflow(facilityId: string) {
  // Create agents
  const routerAgent = createRouterAgent();
  const searchAgent = createSearchAgent(facilityId);
  const queryAgent = createQueryAgent(facilityId, searchAgent);
  const actionAgent = createActionAgent(facilityId, searchAgent);
  const chatAgent = createChatAgent();

  // Step 1: Route the request
  const routeStep = createStep({
    id: "route-intent",
    inputSchema: z.object({
      message: z.string(),
      facilityId: z.string(),
      userId: z.string().optional(),
      threadId: z.string().optional(),
    }),
    outputSchema: z.object({
      intent: z.string(),
      message: z.string(),
      userId: z.string().optional(),
      threadId: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
      console.log("Routing intent for:", inputData.message);

      // Router doesn't need memory - quick classification only
      const result = await routerAgent.generate(inputData.message);

      const intent = result.text?.trim().toUpperCase() || "CHAT";
      console.log("Intent:", intent);
      if (result.usage) {
        console.log("Router tokens:", JSON.stringify(result.usage));
      }
      return {
        intent,
        message: inputData.message,
        userId: inputData.userId,
        threadId: inputData.threadId,
      };
    },
  });

  // Step 2A: Query agent
  const queryStep = createStep({
    id: "query-data",
    inputSchema: z.object({
      intent: z.string(),
      message: z.string(),
      userId: z.string().optional(),
      threadId: z.string().optional(),
    }),
    outputSchema: z.object({
      text: z.string(),
      steps: z.any().optional(),
    }),
    execute: async ({ inputData }) => {
      console.log("Executing query agent");

      const memoryConfig =
        inputData.userId && inputData.threadId
          ? {
              memory: {
                resource: inputData.userId,
                thread: inputData.threadId,
              },
            }
          : {};

      const result = await queryAgent.generate(inputData.message, {
        ...memoryConfig,
        providerOptions: {
          openai: {
            reasoningEffort: "low",
          },
        },
      });

      console.log("Query result:", result.text);
      console.log("Steps:", result.steps?.length || 0);

      if (result.usage) {
        console.log("Query tokens:", JSON.stringify(result.usage));
      }

      if (!result.text) {
        console.warn("Empty response from query agent");
      }
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
      userId: z.string().optional(),
      threadId: z.string().optional(),
    }),
    outputSchema: z.object({
      text: z.string(),
      steps: z.any().optional(),
    }),
    execute: async ({ inputData }) => {
      console.log("Executing action agent");

      const memoryConfig =
        inputData.userId && inputData.threadId
          ? {
              memory: {
                resource: inputData.userId,
                thread: inputData.threadId,
              },
            }
          : {};

      const result = await actionAgent.generate(inputData.message, {
        ...memoryConfig,
      });

      console.log("Action result:", result.text);
      if (result.usage) {
        console.log("Action tokens:", JSON.stringify(result.usage));
      }
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
      userId: z.string().optional(),
      threadId: z.string().optional(),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      console.log("General chat response for:", inputData.message);

      const memoryConfig =
        inputData.userId && inputData.threadId
          ? {
              memory: {
                resource: inputData.userId,
                thread: inputData.threadId,
              },
            }
          : {};

      const result = await chatAgent.generate(inputData.message, {
        ...memoryConfig,
      });

      console.log("Chat result:", result.text);
      if (result.usage) {
        console.log("Chat tokens:", JSON.stringify(result.usage));
      }
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
      userId: z.string().optional(),
      threadId: z.string().optional(),
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
          console.log("Branch checking QUERY, inputData:", inputData);
          return (inputData as any).intent?.includes("QUERY");
        },
        queryStep,
      ],
      [
        async ({ inputData }) => {
          console.log("Branch checking ACTION, inputData:", inputData);
          return (inputData as any).intent?.includes("ACTION");
        },
        actionStep,
      ],
      [
        async ({ inputData }) => {
          console.log("Branch checking CHAT, inputData:", inputData);
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
