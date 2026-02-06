import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

// GET: Load BCF data for a facility
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if user has access to this facility
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const facilityMember = await prisma.facilityMember.findUnique({
      where: {
        userId_facilityId: {
          userId: user.id,
          facilityId: id,
        },
      },
    });

    if (!facilityMember) {
      return NextResponse.json(
        { error: "Access denied to this facility" },
        { status: 403 },
      );
    }

    // Get BCF file path from database
    const facility = await prisma.facility.findUnique({
      where: { id },
      select: { bcfPath: true },
    });

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 },
      );
    }

    // Check if BCF file exists in facility-specific directory
    const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";
    const bcfFilePath = path.join(basePath, id, "bcf", "topics.bcf");

    if (!fs.existsSync(bcfFilePath)) {
      console.log("GET BCF - No BCF file found for facility:", id);
      return NextResponse.json({ bcfData: null });
    }

    // Read BCF file and return as binary stream
    const bcfBuffer = fs.readFileSync(bcfFilePath);
    console.log("GET BCF - File loaded, size:", bcfBuffer.length, "bytes");

    return new NextResponse(bcfBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": bcfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error loading BCF data:", error);
    return NextResponse.json(
      { error: "Failed to load BCF data" },
      { status: 500 },
    );
  }
}

// POST: Save BCF data for a facility
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { bcfData } = body;

    if (!bcfData) {
      return NextResponse.json(
        { error: "BCF data is required" },
        { status: 400 },
      );
    }

    // Check if user has access to this facility
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const facilityMember = await prisma.facilityMember.findUnique({
      where: {
        userId_facilityId: {
          userId: user.id,
          facilityId: id,
        },
      },
    });

    if (!facilityMember) {
      return NextResponse.json(
        { error: "Access denied to this facility" },
        { status: 403 },
      );
    }

    // Convert array to Buffer
    const bcfBuffer = Buffer.from(bcfData);
    console.log(
      "POST BCF - Received array size:",
      bcfData.length,
      "Buffer size:",
      bcfBuffer.length,
    );

    // Save to file system in facility-specific directory
    const basePath = process.env.BIM_DATA_PATH || "./public/bim_data";
    const bcfDir = path.join(basePath, id, "bcf");

    if (!fs.existsSync(bcfDir)) {
      fs.mkdirSync(bcfDir, { recursive: true });
    }

    const bcfFilePath = path.join(bcfDir, "topics.bcf");
    fs.writeFileSync(bcfFilePath, bcfBuffer);

    // Update facility with BCF path reference
    const relativePath = `/${id}/bcf/topics.bcf`;
    await prisma.facility.update({
      where: { id },
      data: { bcfPath: relativePath },
    });

    console.log("POST BCF - Data saved to file system:", bcfFilePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving BCF data:", error);
    return NextResponse.json(
      { error: "Failed to save BCF data" },
      { status: 500 },
    );
  }
}
