import { execSync } from 'child_process';
import path from 'path';

export const skill = {
  name: 'query-by-property',
  description: 'Find BIM elements based on specific property names or values',
  parameters: {
    type: 'object',
    properties: {
      property: {
        type: 'string',
        description: 'Property name to search for (e.g., "FireRating", "Material", "Area")',
      },
      value: {
        type: 'string',
        description: 'Optional: specific value to match (case-insensitive substring match)',
      },
      category: {
        type: 'string',
        description: 'Optional: limit search to specific IFC category',
      },
      storey: {
        type: 'string',
        description: 'Optional: limit search to specific storey',
      },
    },
    required: ['property'],
  },
  execute: async (params: { property: string; value?: string; category?: string; storey?: string }) => {
    const scriptPath = path.join(__dirname, 'scripts/search_by_property.sh');
    const basePath = process.env.BIM_DATA_PATH || './public/bim_data';
    
    let cmd = `BIM_FS="${basePath}" bash "${scriptPath}" --property "${params.property}"`;
    if (params.value) cmd += ` --value "${params.value}"`;
    if (params.category) cmd += ` --category "${params.category}"`;
    if (params.storey) cmd += ` --storey "${params.storey}"`;
    
    try {
      const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      return result.trim().split('\n').filter(line => line).map(line => JSON.parse(line));
    } catch (error: any) {
      throw new Error(`Property search failed: ${error.message}`);
    }
  },
};
