import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

// Update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: facilityId } = await params;
    const { memberId, role } = await req.json();

    if (!memberId || !role) {
      return NextResponse.json(
        { error: "Member ID and role are required" },
        { status: 400 },
      );
    }

    if (role !== "MANAGER" && role !== "MEMBER") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        facilityMembers: {
          where: { facilityId },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if current user is a manager of this facility
    const currentUserMembership = currentUser.facilityMembers[0];
    if (!currentUserMembership || currentUserMembership.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Only managers can update member roles" },
        { status: 403 },
      );
    }

    // Get the member being updated to check their current role
    const memberToUpdate = await prisma.facilityMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 },
      );
    }

    // Prevent removing the last manager
    if (memberToUpdate.role === "MANAGER" && role === "MEMBER") {
      const managerCount = await prisma.facilityMember.count({
        where: {
          facilityId,
          role: "MANAGER",
        },
      });

      if (managerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last manager. There must be at least one manager." },
          { status: 400 },
        );
      }
    }

    // Update member role
    const updatedMember = await prisma.facilityMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error("Error updating member role:", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 },
    );
  }
}
