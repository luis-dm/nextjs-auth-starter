export const skill = {
  name: "isolate-elements",
  description:
    "Isolate BIM elements in the 3D viewer (hide everything except the specified elements). Use this to focus on specific elements.",
  parameters: {
    type: "object",
    properties: {
      elementIds: {
        type: "array",
        items: { type: "number" },
        description:
          "Array of element IDs to isolate (localIds from query results)",
      },
    },
    required: ["elementIds"],
  },
  execute: async (params: { elementIds: number[] }) => {
    // This skill will be intercepted by the client-side chatbot
    // and executed using the components instance
    return {
      action: "isolate",
      elementIds: params.elementIds,
      message: `Ready to isolate ${params.elementIds.length} element(s)`,
    };
  },
};
