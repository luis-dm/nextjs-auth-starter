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

    // Get organization ID and pagination params from query params
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "7");

    // Get the user's organizations
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

    if (!user?.organizationMembers.length) {
      return NextResponse.json({
        facilities: [],
        organization: null,
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      });
    }

    // If organizationId is provided, use that; otherwise use the first one
    let organization;
    if (organizationId) {
      const orgMember = user.organizationMembers.find(
        (m) => m.organizationId === organizationId,
      );
      organization = orgMember?.organization;

      if (!organization) {
        return NextResponse.json(
          { error: "Organization not found or access denied" },
          { status: 404 },
        );
      }
    } else {
      organization = user.organizationMembers[0].organization;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const totalCount = await prisma.facility.count({
      where: {
        organizationId: organization.id,
      },
    });

    // Fetch facilities for the selected organization with pagination
    const facilities = await prisma.facility.findMany({
      where: {
        organizationId: organization.id,
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      facilities,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      totalCount,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching facilities:", error);
    return NextResponse.json(
      { error: "Failed to fetch facilities" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, fragmentData, ifcFileName, ifcFileSize, organizationId } =
      body;

    if (!name) {
      return NextResponse.json(
        { error: "Facility name is required" },
        { status: 400 },
      );
    }

    // Get user and check/create organization
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

    // For now, create a default organization if none exists
    let orgId = organizationId;
    if (!orgId) {
      if (user.organizationMembers.length) {
        // Use the first organization
        orgId = user.organizationMembers[0].organizationId;
      } else {
        // Create a default organization for the user
        const newOrg = await prisma.organization.create({
          data: {
            name: `${user.name || "User"}'s Organization`,
            members: {
              create: {
                userId: user.id,
                role: "MANAGER",
              },
            },
          },
        });
        orgId = newOrg.id;
      }
    }

    // Convert fragmentData array back to Buffer if it exists
    const fragmentBuffer = fragmentData ? Buffer.from(fragmentData) : null;

    // Get all organization members to add them to the facility
    const orgMembers = await prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
      },
      select: {
        userId: true,
      },
    });

    // Create facility members array: creator as MANAGER, others as MEMBER
    const facilityMembers = orgMembers.map((member) => ({
      userId: member.userId,
      role: (member.userId === user.id ? "MANAGER" : "MEMBER") as
        | "MANAGER"
        | "MEMBER",
    }));

    const facility = await prisma.facility.create({
      data: {
        name,
        fragmentData: fragmentBuffer,
        ifcFileName,
        ifcFileSize,
        organizationId: orgId,
        members: {
          create: facilityMembers,
        },
      },
      include: {
        organization: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json(facility);
  } catch (error) {
    console.error("Error creating facility:", error);
    return NextResponse.json(
      { error: "Failed to create facility" },
      { status: 500 },
    );
  }
}
