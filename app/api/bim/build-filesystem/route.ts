import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { buildFilesystem } from "@/utils/build_bim_fs";
import os from "os";

export async function POST(req: NextRequest) {
  try {
    console.log("Received build-filesystem request");

    const body = await req.json();
    const { structure, facilityId } = body;

    if (!structure) {
      console.error("No structure provided in request");
      return NextResponse.json(
        { error: "No structure provided" },
        { status: 400 },
      );
    }

    if (!facilityId) {
      console.error("No facilityId provided in request");
      return NextResponse.json(
        { error: "No facilityId provided" },
        { status: 400 },
      );
    }

    console.log(
      `Structure received for facility ${facilityId}, preparing to build filesystem`,
    );

    // Get the base path from environment or use default
    const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";

    // Create facility-specific path
    const facilityDir = path.join(basePath, facilityId);
    const aiDir = path.join(facilityDir, "ai");
    const facilityBasePath = path.join(aiDir, "bim_fs");

    // Ensure AI directory exists
    if (!fs.existsSync(aiDir)) {
      console.log("Creating AI directory:", aiDir);
      fs.mkdirSync(aiDir, { recursive: true });
    }

    // Write the enhanced structure to a temporary file
    const tempFile = path.join(
      os.tmpdir(),
      `enhanced_structure_${facilityId}_${Date.now()}.json`,
    );
    fs.writeFileSync(tempFile, JSON.stringify(structure, null, 2));
    console.log("Temporary structure file written:", tempFile);

    // Build the filesystem using the build_bim_fs utility
    await buildFilesystem({
      inputFile: tempFile,
      outputDir: facilityBasePath,
      force: true,
      pretty: false,
    });

    // Clean up temp file
    fs.unlinkSync(tempFile);
    console.log("BIM filesystem built successfully at:", facilityBasePath);

    return NextResponse.json({
      success: true,
      message: "BIM filesystem built successfully",
      path: facilityBasePath,
      facilityId,
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
