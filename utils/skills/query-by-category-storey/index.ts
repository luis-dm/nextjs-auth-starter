import { execSync } from "child_process";
import path from "path";

export const skill = {
  name: "query-by-category-storey",
  description:
    "Query BIM elements by IFC category (e.g., IFCDOOR, IFCWINDOW) and/or building storey/floor",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "IFC element category like IFCDOOR, IFCWINDOW, IFCWALL, IFCFURNISHINGELEMENT, etc.",
      },
      storey: {
        type: "string",
        description:
          'Floor level slug like "nivel_1", "nivel_2", or use match_schema first to find the correct slug',
      },
    },
  },
  execute: async (params: { category?: string; storey?: string }) => {
    const scriptPath = path.join(
      __dirname,
      "scripts/query_by_category_storey.sh",
    );
    const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";

    let cmd = `BIM_FS="${basePath}" bash "${scriptPath}"`;
    if (params.category) cmd += ` --category "${params.category}"`;
    if (params.storey) cmd += ` --storey "${params.storey}"`;

    try {
      const result = execSync(cmd, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      // Parse JSONL to array
      return result
        .trim()
        .split("\n")
        .filter((line) => line)
        .map((line) => JSON.parse(line));
    } catch (error: any) {
      throw new Error(`Query failed: ${error.message}`);
    }
  },
};
