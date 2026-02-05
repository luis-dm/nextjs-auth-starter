import { execSync } from 'child_process';
import path from 'path';

export const skill = {
  name: 'query-by-name',
  description: 'Search for BIM elements by name pattern (case-insensitive)',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Name pattern to search for (e.g., "door", "Chair", "window")',
      },
      category: {
        type: 'string',
        description: 'Optional: limit search to specific IFC category',
      },
    },
    required: ['pattern'],
  },
  execute: async (params: { pattern: string; category?: string }) => {
    const scriptPath = path.join(__dirname, 'scripts/search_by_name.sh');
    const basePath = process.env.BIM_DATA_PATH || './public/bim_data';
    
    let cmd = `BIM_FS="${basePath}" bash "${scriptPath}" --pattern "${params.pattern}"`;
    if (params.category) cmd += ` --category "${params.category}"`;
    
    try {
      const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      return result.trim().split('\n').filter(line => line).map(line => JSON.parse(line));
    } catch (error: any) {
      throw new Error(`Name search failed: ${error.message}`);
    }
  },
};
