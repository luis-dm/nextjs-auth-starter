import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password, name } = body;

    // Validate required fields
    if (!token || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Find the invite
    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 404 },
      );
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 },
      );
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    // Use transaction to handle user creation and membership
    await prisma.$transaction(async (tx) => {
      // Create user if they don't exist
      if (!user) {
        if (!name) {
          throw new Error("Name is required for new users");
        }
        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await tx.user.create({
          data: {
            email: invite.email,
            name,
            password: hashedPassword,
            emailVerified: new Date(), // Auto-verify invited users (they clicked email link)
          },
        });
      }

      // Check if already a member
      const existingMember = await tx.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: user!.id,
            organizationId: invite.organizationId,
          },
        },
      });

      if (existingMember) {
        throw new Error("User is already a member of this organization");
      }

      // Add user as organization member
      await tx.organizationMember.create({
        data: {
          userId: user!.id,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      });

      // Delete the used invite
      await tx.organizationInvite.delete({
        where: { token },
      });
    });

    return NextResponse.json({
      message: "Successfully joined organization",
      userId: user!.id,
      organizationId: invite.organizationId,
    });
  } catch (error) {
    console.error("Join error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to join organization",
      },
      { status: 500 },
    );
  }
}
