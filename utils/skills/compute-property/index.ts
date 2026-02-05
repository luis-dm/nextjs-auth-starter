import { execSync } from "child_process";
import path from "path";

export const skill = {
  name: "compute-property",
  description:
    "Calculate or aggregate property values (sum, avg, min, max) from BIM elements. Can compute area from width/height if missing.",
  parameters: {
    type: "object",
    properties: {
      property: {
        type: "string",
        description:
          'Property name to compute (e.g., "Area", "Height", "Volume")',
      },
      operation: {
        type: "string",
        enum: ["list", "sum", "avg", "min", "max", "count"],
        description:
          "Operation to perform: list (get all values), sum, avg, min, max, or count",
      },
      ids: {
        type: "array",
        items: { type: "string" },
        description: "Array of element IDs to compute values for",
      },
    },
    required: ["property", "operation", "ids"],
  },
  execute: async (params: {
    property: string;
    operation: string;
    ids: string[];
  }) => {
    const scriptPath = path.join(__dirname, "scripts/compute_property.sh");
    const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";

    const idsArg = params.ids.join(",");
    const cmd = `BIM_FS="${basePath}" bash "${scriptPath}" --property "${params.property}" --operation "${params.operation}" --ids "${idsArg}"`;

    try {
      const result = execSync(cmd, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      if (params.operation === "list") {
        return result
          .trim()
          .split("\n")
          .filter((line) => line)
          .map((line) => JSON.parse(line));
      }
      return JSON.parse(result.trim());
    } catch (error: any) {
      throw new Error(`Computation failed: ${error.message}`);
    }
  },
};
