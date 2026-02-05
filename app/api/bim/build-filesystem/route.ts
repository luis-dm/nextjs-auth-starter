import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { buildFilesystem } from "@/utils/build_bim_fs";
import os from "os";

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

    console.log("Structure received, preparing to build filesystem");

    // Get the base path from environment or use default
    const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";

    // Ensure base directory exists
    if (!fs.existsSync(basePath)) {
      console.log("Creating base directory:", basePath);
      fs.mkdirSync(basePath, { recursive: true });
    }

    // Write the enhanced structure to a temporary file
    const tempFile = path.join(
      os.tmpdir(),
      `enhanced_structure_${Date.now()}.json`,
    );
    fs.writeFileSync(tempFile, JSON.stringify(structure, null, 2));
    console.log("Temporary structure file written:", tempFile);

    // Build the filesystem using the build_bim_fs utility
    await buildFilesystem({
      inputFile: tempFile,
      outputDir: basePath,
      force: true,
      pretty: true,
    });

    // Clean up temp file
    fs.unlinkSync(tempFile);
    console.log("BIM filesystem built successfully at:", basePath);

    return NextResponse.json({
      success: true,
      message: "BIM filesystem built successfully",
      path: basePath,
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
