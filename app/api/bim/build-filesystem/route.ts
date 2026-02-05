import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    console.log("Received build-filesystem request");
    
    const body = await req.json();
    const { structure } = body;

    if (!structure) {
      console.error("No structure provided in request");
      return NextResponse.json(
        { error: "No structure provided" },
        { status: 400 },
      );
    }

    console.log("Structure received, size:", JSON.stringify(structure).length, "bytes");

    // Save structure to the public/bim_data directory for the workspace
    const dataDir = path.join(process.cwd(), "public", "bim_data");

    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
      console.log("Creating directory:", dataDir);
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write the enhanced structure with a custom replacer to handle circular references
    const structureFile = path.join(dataDir, "enhanced_structure.json");
    
    const jsonString = JSON.stringify(structure, (key, value) => {
      // Handle circular references and problematic objects
      if (value && typeof value === 'object') {
        // Skip certain types that can't be serialized
        if (value.constructor && value.constructor.name && 
            ['BufferGeometry', 'Mesh', 'Material', 'Texture'].includes(value.constructor.name)) {
          return undefined;
        }
      }
      return value;
    }, 2);
    
    fs.writeFileSync(structureFile, jsonString);

    console.log("BIM structure saved successfully to:", structureFile);

    return NextResponse.json({
      success: true,
      message: "BIM structure saved successfully",
      dataPath: "/bim_data/enhanced_structure.json",
    });
  } catch (error) {
    console.error("Error saving BIM structure:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("Error details:", errorMessage);
    if (errorStack) console.error("Stack:", errorStack);
    
    return NextResponse.json(
      {
        error: "Failed to save BIM structure",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
