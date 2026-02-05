import { execSync } from 'child_process';
import path from 'path';

export const skill = {
  name: 'describe-selection',
  description: 'Generate a comprehensive summary of BIM elements including counts, categories, storeys, and key statistics',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Optional: limit description to specific IFC category',
      },
      storey: {
        type: 'string',
        description: 'Optional: limit description to specific storey',
      },
      pattern: {
        type: 'string',
        description: 'Optional: limit description to elements matching name pattern',
      },
    },
  },
  execute: async (params: { category?: string; storey?: string; pattern?: string }) => {
    const scriptPath = path.join(__dirname, 'scripts/describe_selection.sh');
    const basePath = process.env.BIM_DATA_PATH || './public/bim_data';
    
    let cmd = `BIM_FS="${basePath}" bash "${scriptPath}"`;
    if (params.category) cmd += ` --category "${params.category}"`;
    if (params.storey) cmd += ` --storey "${params.storey}"`;
    if (params.pattern) cmd += ` --pattern "${params.pattern}"`;
    
    try {
      const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      return JSON.parse(result.trim());
    } catch (error: any) {
      throw new Error(`Description failed: ${error.message}`);
    }
  },
};
