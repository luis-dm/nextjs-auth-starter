import { execSync } from "child_process";
import path from "path";

export const skill = {
  name: "get-element-properties",
  description: "Get complete properties of specific BIM elements by their IDs",
  parameters: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        items: { type: "string" },
        description: "Array of element IDs to retrieve properties for",
      },
    },
    required: ["ids"],
  },
  execute: async (params: { ids: string[] }) => {
    const scriptPath = path.join(__dirname, "scripts/get_properties.sh");
    const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";

    const idsArg = params.ids.join(",");
    const cmd = `BIM_FS="${basePath}" bash "${scriptPath}" --ids "${idsArg}"`;

    try {
      const result = execSync(cmd, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      return result
        .trim()
        .split("\n")
        .filter((line) => line)
        .map((line) => JSON.parse(line));
    } catch (error: any) {
      throw new Error(`Property fetch failed: ${error.message}`);
    }
  },
};
