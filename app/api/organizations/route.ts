import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user with all their organizations
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        organizationMembers: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const organizations = user.organizationMembers.map((member) => ({
      id: member.organization.id,
      name: member.organization.name,
      role: member.role,
    }));

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 },
    );
  }
}
