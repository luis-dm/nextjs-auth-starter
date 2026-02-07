export const skill = {
  name: "hide-elements",
  description:
    "Hide BIM elements in the 3D viewer by their IDs. Use this after querying elements to hide them from view.",
  parameters: {
    type: "object",
    properties: {
      elementIds: {
        type: "array",
        items: { type: "number" },
        description:
          "Array of element IDs to hide (localIds from query results)",
      },
    },
    required: ["elementIds"],
  },
  execute: async (params: { elementIds: number[] }) => {
    // This skill will be intercepted by the client-side chatbot
    // and executed using the components instance
    return {
      action: "hide",
      elementIds: params.elementIds,
      message: `Ready to hide ${params.elementIds.length} element(s)`,
    };
  },
};
