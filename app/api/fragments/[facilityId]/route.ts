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
      select: { fragmentPath: true },
    });

    if (!facility?.fragmentPath) {
      return NextResponse.json(
        { error: "No fragment file found for this facility" },
        { status: 404 },
      );
    }

    // Read the fragment file from volume
    const fragmentsDir = path.join(
      process.env.BIM_DATA_PATH || "./public/bim_data",
      "fragments",
    );
    const fragmentFilePath = path.join(fragmentsDir, `${facilityId}.frag`);

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
