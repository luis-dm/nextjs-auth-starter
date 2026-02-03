import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

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

    const facility = await prisma.facility.findUnique({
      where: {
        id: id,
      },
      include: {
        organization: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 },
      );
    }

    // Convert fragmentData Buffer to array for JSON serialization
    const facilityWithFragments = {
      ...facility,
      fragmentData: facility.fragmentData
        ? Array.from(facility.fragmentData)
        : null,
      editHistory: facility.editHistory
        ? Array.from(facility.editHistory)
        : null,
    };

    return NextResponse.json(facilityWithFragments);
  } catch (error) {
    console.error("Error fetching facility:", error);
    return NextResponse.json(
      { error: "Failed to fetch facility" },
      { status: 500 },
    );
  }
}

export async function PATCH(
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

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is a member of this facility
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
        { error: "You must be a facility member to update it" },
        { status: 403 },
      );
    }

    // Update fragment data if provided
    if (body.fragmentData || body.editHistory) {
      const updateData: any = {};

      if (body.fragmentData) {
        updateData.fragmentData = Buffer.from(body.fragmentData);
      }

      if (body.editHistory) {
        updateData.editHistory = Buffer.from(body.editHistory);
      }

      await prisma.facility.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({
        message: "Facility data updated successfully",
        fragmentSize: updateData.fragmentData?.length,
        historySize: updateData.editHistory?.length,
      });
    }

    return NextResponse.json(
      { error: "No data provided to update" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error updating facility:", error);
    return NextResponse.json(
      { error: "Failed to update facility" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is a MANAGER of this facility
    const facilityMember = await prisma.facilityMember.findUnique({
      where: {
        userId_facilityId: {
          userId: user.id,
          facilityId: id,
        },
      },
    });

    if (!facilityMember || facilityMember.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Only facility managers can delete facilities" },
        { status: 403 },
      );
    }

    // Delete the facility (cascade will delete facility members)
    await prisma.facility.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Facility deleted successfully" });
  } catch (error) {
    console.error("Error deleting facility:", error);
    return NextResponse.json(
      { error: "Failed to delete facility" },
      { status: 500 },
    );
  }
}
