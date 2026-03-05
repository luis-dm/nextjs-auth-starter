import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { buildFilesystem } from "@/utils/build_bim_fs";
import os from "os";
import archiver from "archiver";

export async function POST(req: NextRequest) {
  try {
    console.log("Received build-filesystem request");

    const body = await req.json();
    const { structure, facilityId, download } = body;

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

    const tempFile = path.join(
      os.tmpdir(),
      `enhanced_structure_${facilityId}_${Date.now()}.json`,
    );
    fs.writeFileSync(tempFile, JSON.stringify(structure, null, 2));

    // Build the filesystem using the build_bim_fs utility
    await buildFilesystem({
      inputFile: tempFile,
      outputDir: facilityBasePath,
      force: true,
      pretty: false,
    });

    fs.unlinkSync(tempFile);
    console.log("BIM filesystem built successfully at:", facilityBasePath);

    // Copy skills folder from utils to the built filesystem
    const sourceSkillsPath = path.join(process.cwd(), "utils", "skills");
    const destSkillsPath = path.join(facilityBasePath, "skills");

    if (fs.existsSync(sourceSkillsPath)) {
      console.log("Copying skills folder to filesystem...");

      // Copy directory recursively
      fs.cpSync(sourceSkillsPath, destSkillsPath, { recursive: true });

      // Make all script files executable (chmod +x)
      const scriptsDir = path.join(destSkillsPath, "bim-query", "scripts");
      if (fs.existsSync(scriptsDir)) {
        const scriptFiles = fs.readdirSync(scriptsDir);
        for (const file of scriptFiles) {
          if (file.endsWith(".sh")) {
            const scriptPath = path.join(scriptsDir, file);
            fs.chmodSync(scriptPath, 0o755); // rwxr-xr-x
            console.log(`Made executable: ${file}`);
          }
        }
      }

      console.log("Skills folder copied and scripts made executable");
    } else {
      console.warn("Skills folder not found at:", sourceSkillsPath);
    }

    // Check if download is requested (from body or query params)
    const shouldDownload =
      download === true || req.nextUrl.searchParams.get("download") === "true";

    console.log("Download requested:", shouldDownload);

    if (shouldDownload) {
      console.log("Creating zip archive for download...");

      // Create a zip archive
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Maximum compression
      });

      // Set up response headers for file download
      const headers = new Headers();
      headers.set("Content-Type", "application/zip");
      headers.set(
        "Content-Disposition",
        `attachment; filename="bim_fs_${facilityId}_${Date.now()}.zip"`,
      );

      // Create a readable stream from the archive
      const { readable, writable } = new TransformStream();
      archive.pipe(writable as any);

      // Add the bim_fs directory to the archive
      archive.directory(facilityBasePath, "bim_fs");

      // Finalize the archive
      archive.finalize();

      console.log("Zip archive created, sending response...");
      return new NextResponse(readable, { headers });
    }

    return NextResponse.json({
      success: true,
      message: "BIM filesystem built successfully",
      path: facilityBasePath,
      facilityId,
    });
  } catch (error) {
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
