import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";

// POST /api/organizations/[id]/invite - Invite members to organization
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: organizationId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { emails } = await request.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "At least one email is required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is a manager of the organization
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organizationId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership || membership.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Only managers can invite members" },
        { status: 403 },
      );
    }

    // Send invitations
    const { Resend } = require("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const crypto = require("crypto");

    for (const email of emails) {
      if (email && typeof email === "string" && email.trim() !== "") {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        await prisma.organizationInvite.create({
          data: {
            email: email.trim(),
            token,
            organizationId: organizationId,
            expiresAt,
          },
        });

        const inviteLink = `${process.env.NEXTAUTH_URL}/join/${token}`;

        await resend.emails.send({
          from: "OpenBIM  noreply@openbim.app",
          to: email.trim(),
          subject: `${user.name || "Someone"} invited you to join ${membership.organization.name}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #1f2937 !important; color: white !important; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background-color: #1f2937 !important; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>You're Invited!</h1>
                </div>
                <div class="content">
                  <p>Hi there,</p>
                  <p><strong>${user.name || "Someone"}</strong> has invited you to join the organization <strong>${membership.organization.name}</strong> on OpenBIM.</p>
                  <p>Click the button below to accept the invitation and get started:</p>
                  <div style="text-align: center;">
                    <a href="${inviteLink}" class="button">Accept Invitation</a>
                  </div>
                  <p style="color: #6b7280; font-size: 14px;">This invitation will expire in 7 days.</p>
                  <p style="color: #6b7280; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} OpenBIM. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error sending invitations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
