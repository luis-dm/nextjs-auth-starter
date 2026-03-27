import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

type FacilityMarkersDelegate = {
  findUnique: (args: {
    where: { id: string };
    select: { bcfTopicMarkers: true };
  }) => Promise<{ bcfTopicMarkers?: unknown } | null>;
  update: (args: {
    where: { id: string };
    data: { bcfTopicMarkers: unknown[] };
  }) => Promise<unknown>;
};

const facilityDelegate = prisma.facility as unknown as FacilityMarkersDelegate;

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

    const facility = await facilityDelegate.findUnique({
      where: { id },
      select: { bcfTopicMarkers: true },
    });

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 },
      );
    }

    const markers = Array.isArray(facility?.bcfTopicMarkers)
      ? facility.bcfTopicMarkers
      : [];

    return NextResponse.json({ markers });
  } catch (error) {
    console.error("Error loading BCF topic markers:", error);
    return NextResponse.json(
      { error: "Failed to load BCF topic markers" },
      { status: 500 },
    );
  }
}

export async function PUT(
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
    const markers = Array.isArray(body?.markers) ? body.markers : null;

    if (markers === null) {
      return NextResponse.json(
        { error: "markers array is required" },
        { status: 400 },
      );
    }

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

    await facilityDelegate.update({
      where: { id },
      data: { bcfTopicMarkers: markers },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving BCF topic markers:", error);
    return NextResponse.json(
      { error: "Failed to save BCF topic markers" },
      { status: 500 },
    );
  }
}
