import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { facilityId } = await params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "rendered"; // Default to rendered for viewer

    // Get the facility and verify user has access
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        facilityMembers: {
          where: { facilityId },
          select: { facilityId: true },
        },
      },
    });

    if (!user?.facilityMembers.length) {
      return NextResponse.json(
        { error: "Access denied to this facility" },
        { status: 403 },
      );
    }

    // Get the facility to find the fragment path
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { fragmentPath: true, renderedFragmentPath: true },
    });

    const fragmentPath =
      type === "original"
        ? facility?.fragmentPath
        : facility?.renderedFragmentPath;

    // Fall back to original if rendered doesn't exist (backward compatibility)
    const usedPath = fragmentPath || facility?.fragmentPath;

    if (!usedPath) {
      return NextResponse.json(
        { error: "No fragment file found for this facility" },
        { status: 404 },
      );
    }

    // Read the fragment file from facility-specific directory
    const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";
    const fragmentsDir = path.join(basePath, facilityId, "fragments");
    const filename =
      type === "original" ? "original.frag" : "rendered.frag";

    // Try to get the requested type
    let fragmentFilePath = path.join(fragmentsDir, filename);
    
    // Fall back to original if rendered doesn't exist
    if (!fs.existsSync(fragmentFilePath) && type === "rendered") {
      fragmentFilePath = path.join(fragmentsDir, "original.frag");
    }

    if (!fs.existsSync(fragmentFilePath)) {
      return NextResponse.json(
        { error: "Fragment file not found on disk" },
        { status: 404 },
      );
    }

    const fragmentData = fs.readFileSync(fragmentFilePath);

    // Return the fragment data as a binary response with no-cache headers
    return new NextResponse(fragmentData, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${facilityId}.frag"`,
        "Content-Length": fragmentData.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error serving fragment:", error);
    return NextResponse.json(
      { error: "Failed to serve fragment" },
      { status: 500 },
    );
  }
}
