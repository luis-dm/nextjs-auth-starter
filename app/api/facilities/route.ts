import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Facilities API] Auth check: ${Date.now() - startTime}ms`);

    // Get organization ID and pagination params from query params
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "7");
    const skip = (page - 1) * limit;

    // Get the user's organizations with selective fields
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        organizationMembers: {
          select: {
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    console.log(`[Facilities API] User query: ${Date.now() - startTime}ms`);

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
    const currentOrgId =
      organizationId || user.organizationMembers[0]?.organizationId;

    if (!currentOrgId) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 404 },
      );
    }

    // Parallel queries for count and facilities
    const [totalCount, facilities] = await Promise.all([
      prisma.facility.count({
        where: { organizationId: currentOrgId },
      }),
      prisma.facility.findMany({
        where: { organizationId: currentOrgId },
        select: {
          id: true,
          name: true,
          ifcFileName: true,
          ifcFileSize: true,
          createdAt: true,
          organizationId: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    console.log(`[Facilities API] Data queries: ${Date.now() - startTime}ms`);

    const organization = user.organizationMembers.find(
      (m) => m.organizationId === currentOrgId,
    )?.organization;

    const totalPages = Math.ceil(totalCount / limit);

    console.log(`[Facilities API] Total time: ${Date.now() - startTime}ms`);

    return NextResponse.json({
      facilities,
      organization,
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
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Facility POST] Auth check: ${Date.now() - startTime}ms`);

    const body = await req.json();
    const { name, fragmentData, ifcFileName, ifcFileSize, organizationId } =
      body;

    console.log(
      `[Facility POST] Body parsed: ${Date.now() - startTime}ms, fragmentData size: ${fragmentData ? fragmentData.length : 0} bytes (base64)`,
    );

    if (!name) {
      return NextResponse.json(
        { error: "Facility name is required" },
        { status: 400 },
      );
    }

    // Get user with selective fields
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        organizationMembers: {
          select: {
            organizationId: true,
            userId: true,
          },
        },
      },
    });

    console.log(`[Facility POST] User query: ${Date.now() - startTime}ms`);

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

    console.log(`[Facility POST] Org setup: ${Date.now() - startTime}ms`);

    // Generate unique facility ID
    const facilityId = randomUUID();

    // Save fragment to volume if provided
    let fragmentPath: string | null = null;
    if (fragmentData) {
      const fragmentsDir = path.join(
        process.env.BIM_DATA_PATH || "./public/bim_data",
        "fragments",
      );

      // Create fragments directory if it doesn't exist
      if (!fs.existsSync(fragmentsDir)) {
        fs.mkdirSync(fragmentsDir, { recursive: true });
      }

      const fragmentFilePath = path.join(fragmentsDir, `${facilityId}.frag`);

      // Convert base64 string back to buffer
      const fragmentBuffer = Buffer.from(fragmentData, "base64");
      console.log(
        `[Facility POST] Writing ${fragmentBuffer.length} bytes to disk`,
      );

      fs.writeFileSync(fragmentFilePath, fragmentBuffer);
      fragmentPath = `/fragments/${facilityId}.frag`;

      console.log(
        `[Facility POST] Fragment saved to disk: ${Date.now() - startTime}ms`,
      );
    }

    // Get all organization members to add them to the facility
    const orgMembers = await prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
      },
      select: {
        userId: true,
      },
    });

    console.log(
      `[Facility POST] Org members query: ${Date.now() - startTime}ms`,
    );

    // Create facility members array: creator as MANAGER, others as MEMBER
    const facilityMembers = orgMembers.map((member) => ({
      userId: member.userId,
      role: (member.userId === user.id ? "MANAGER" : "MEMBER") as
        | "MANAGER"
        | "MEMBER",
    }));

    const facility = await prisma.facility.create({
      data: {
        id: facilityId,
        name,
        fragmentPath,
        ifcFileName,
        ifcFileSize,
        organizationId: orgId,
        members: {
          create: facilityMembers,
        },
      },
      select: {
        id: true,
        name: true,
        ifcFileName: true,
        ifcFileSize: true,
        createdAt: true,
        organizationId: true,
      },
    });

    console.log(
      `[Facility POST] Facility created: ${Date.now() - startTime}ms`,
    );
    console.log(`[Facility POST] Total time: ${Date.now() - startTime}ms`);

    return NextResponse.json(facility);
  } catch (error) {
    console.error("Error creating facility:", error);
    return NextResponse.json(
      { error: "Failed to create facility" },
      { status: 500 },
    );
  }
}
