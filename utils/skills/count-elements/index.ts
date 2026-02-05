import { execSync } from 'child_process';
import path from 'path';

export const skill = {
  name: 'count-elements',
  description: 'Count BIM elements with optional filters by category, storey, or name pattern',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Optional IFC category filter (e.g., IFCDOOR)',
      },
      storey: {
        type: 'string',
        description: 'Optional storey/floor slug filter (e.g., nivel_1)',
      },
      pattern: {
        type: 'string',
        description: 'Optional name pattern filter',
      },
      breakdown: {
        type: 'string',
        enum: ['category', 'storey', 'both'],
        description: 'Optional: get breakdown by category, storey, or both',
      },
    },
  },
  execute: async (params: { category?: string; storey?: string; pattern?: string; breakdown?: string }) => {
    const scriptPath = path.join(__dirname, 'scripts/count_elements.sh');
    const basePath = process.env.BIM_DATA_PATH || './public/bim_data';
    
    let cmd = `BIM_FS="${basePath}" bash "${scriptPath}"`;
    if (params.category) cmd += ` --category "${params.category}"`;
    if (params.storey) cmd += ` --storey "${params.storey}"`;
    if (params.pattern) cmd += ` --pattern "${params.pattern}"`;
    if (params.breakdown) cmd += ` --breakdown "${params.breakdown}"`;
    
    try {
      const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      return result.trim().split('\n').filter(line => line).map(line => JSON.parse(line));
    } catch (error: any) {
      throw new Error(`Count failed: ${error.message}`);
    }
  },
};
