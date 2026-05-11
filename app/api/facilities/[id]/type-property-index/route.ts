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
      where: { id },
      select: { typePropertyIndex: true },
    });

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 },
      );
    }

    if (!facility.typePropertyIndex) {
      return NextResponse.json(
        { error: "No type property index available for this facility" },
        { status: 404 },
      );
    }

    const json = JSON.stringify(facility.typePropertyIndex, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="type-property-index-${id}.json"`,
      },
    });
  } catch (error) {
    console.error("Error fetching type property index:", error);
    return NextResponse.json(
      { error: "Failed to fetch type property index" },
      { status: 500 },
    );
  }
}
