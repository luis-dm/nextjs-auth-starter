export const skill = {
  name: "select-elements",
  description:
    "Select BIM elements in the 3D viewer by their IDs. Use this after querying elements to highlight them visually.",
  parameters: {
    type: "object",
    properties: {
      elementIds: {
        type: "array",
        items: { type: "number" },
        description:
          "Array of element IDs to select (localIds from query results)",
      },
    },
    required: ["elementIds"],
  },
  execute: async (params: { elementIds: number[] }) => {
    // This skill will be intercepted by the client-side chatbot
    // and executed using the components instance
    return {
      action: "select",
      elementIds: params.elementIds,
      message: `Ready to select ${params.elementIds.length} element(s)`,
    };
  },
};
