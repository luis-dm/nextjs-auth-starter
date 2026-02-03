import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

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

    // Get BCF data
    const facility = await prisma.facility.findUnique({
      where: { id },
      select: { bcfData: true },
    });

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 },
      );
    }

    console.log(
      "GET BCF - Facility found, bcfData exists:",
      !!facility.bcfData,
      "size:",
      facility.bcfData?.length,
    );

    // Return BCF data as array (or null if not exists)
    return NextResponse.json({
      bcfData: facility.bcfData ? Array.from(facility.bcfData) : null,
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

    // Update facility with BCF data
    await prisma.facility.update({
      where: { id },
      data: { bcfData: bcfBuffer },
    });

    console.log("POST BCF - Data saved successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving BCF data:", error);
    return NextResponse.json(
      { error: "Failed to save BCF data" },
      { status: 500 },
    );
  }
}
