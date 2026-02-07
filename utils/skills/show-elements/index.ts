export const skill = {
  name: "show-elements",
  description:
    "Show previously hidden BIM elements in the 3D viewer by their IDs.",
  parameters: {
    type: "object",
    properties: {
      elementIds: {
        type: "array",
        items: { type: "number" },
        description:
          "Array of element IDs to show (localIds from query results)",
      },
    },
    required: ["elementIds"],
  },
  execute: async (params: { elementIds: number[] }) => {
    // This skill will be intercepted by the client-side chatbot
    // and executed using the components instance
    return {
      action: "show",
      elementIds: params.elementIds,
      message: `Ready to show ${params.elementIds.length} element(s)`,
    };
  },
};
