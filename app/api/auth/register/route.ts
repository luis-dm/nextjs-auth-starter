import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Resend } from "resend";
import bcrypt from "bcryptjs";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(
  email: string,
  name: string | null,
  token: string,
) {
  const verifyLink = `${process.env.NEXTAUTH_URL}/verify-email/${token}`;

  console.log(`\n📧 Attempting to send verification email to: ${email}`);
  console.log(`🔗 Verify link: ${verifyLink}`);

  try {
    const result = await resend.emails.send({
      from: "SYMBIM <noreply@SYMBIM.app>",
      to: [email],
      subject: "Verify your email address",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background-color: #1f2937; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .button:hover { background-color: #374151; }
              a { color: inherit; text-decoration: none; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to SYMBIM!</h1>
              </div>
              <div class="content">
                <p>Hello ${name || "there"},</p>
                <p>Thanks for signing up! Please verify your email address to get started:</p>
                <center>
                  <a href="${verifyLink}" class="button">Verify Email</a>
                </center>
                <p style="font-size: 14px; color: #6b7280;">Or copy this link: ${verifyLink}</p>
                <p style="font-size: 14px; color: #6b7280;">This link will expire in 24 hours.</p>
              </div>
              <div class="footer">
                <p>If you didn't create an account, you can safely ignore this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send verification email to ${email}:`, error);
    throw error;
  }
}

async function sendInviteEmail(
  email: string,
  organizationName: string,
  token: string,
) {
  const inviteLink = `${process.env.NEXTAUTH_URL}/join/${token}`;

  console.log(`\n📧 Attempting to send email to: ${email}`);
  console.log(`🔑 API Key exists: ${!!process.env.RESEND_API_KEY}`);
  console.log(`🔗 Invite link: ${inviteLink}`);

  try {
    const result = await resend.emails.send({
      from: "SYMBIM <noreply@SYMBIM.app>",
      to: [email],
      subject: `You've been invited to join ${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background-color: #1f2937; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .button:hover { background-color: #374151; }
              a { color: inherit; text-decoration: none; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>You're Invited!</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>You've been invited to join <strong>${organizationName}</strong> on our BIM platform.</p>
                <p>Click the button below to accept the invitation and set up your account:</p>
                <center>
                  <a href="${inviteLink}" class="button">Accept Invitation</a>
                </center>
                <p style="font-size: 14px; color: #6b7280;">Or copy this link: ${inviteLink}</p>
                <p style="font-size: 14px; color: #6b7280;">This invitation will expire in 7 days.</p>
              </div>
              <div class="footer">
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`✅ Resend API Response:`, JSON.stringify(result, null, 2));
    console.log(`✓ Invite email sent to ${email}`);
  } catch (error) {
    console.error(`❌ DETAILED ERROR for ${email}:`);
    console.error("Error type:", error?.constructor?.name);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : error,
    );
    console.error("Full error:", JSON.stringify(error, null, 2));
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, organizationName, inviteEmails } = body;

    // Validate required fields
    if (!name || !email || !password || !organizationName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 },
      );
    }

    // Create user, organization, and organization member in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user (emailVerified is null - needs verification)
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          emailVerified: null,
        },
      });

      // Create email verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpiresAt = new Date();
      verificationExpiresAt.setHours(verificationExpiresAt.getHours() + 24); // 24 hour expiry

      await tx.verificationToken.create({
        data: {
          userId: user.id,
          token: verificationToken,
          type: "EMAIL_VERIFICATION",
          expiresAt: verificationExpiresAt,
        },
      });

      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
        },
      });

      // Add user as organization manager
      await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "MANAGER",
        },
      });

      // Create invites for team members
      const invites = [];
      if (inviteEmails && Array.isArray(inviteEmails)) {
        for (const inviteEmail of inviteEmails) {
          if (inviteEmail && inviteEmail.trim() !== "") {
            const token = crypto.randomBytes(32).toString("hex");
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

            const invite = await tx.organizationInvite.create({
              data: {
                email: inviteEmail.trim(),
                organizationId: organization.id,
                token,
                role: "MEMBER",
                expiresAt,
              },
            });

            invites.push(invite);
          }
        }
      }

      return { user, organization, invites, verificationToken };
    });

    // Send verification email to new user
    try {
      await sendVerificationEmail(
        result.user.email,
        result.user.name,
        result.verificationToken,
      );
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // Continue even if email fails
    }

    // Send invite emails
    const inviteLinks = [];
    for (const invite of result.invites) {
      try {
        await sendInviteEmail(
          invite.email,
          result.organization.name,
          invite.token,
        );
        inviteLinks.push({
          email: invite.email,
          link: `${process.env.NEXTAUTH_URL}/join/${invite.token}`,
          token: invite.token,
          sent: true,
        });
      } catch (error) {
        console.error(`Failed to send email to ${invite.email}:`, error);
        // Still include the link even if email failed
        inviteLinks.push({
          email: invite.email,
          link: `${process.env.NEXTAUTH_URL}/join/${invite.token}`,
          token: invite.token,
          sent: false,
        });
      }
    }

    console.log(
      `📧 Sent ${inviteLinks.filter((l) => l.sent).length} of ${result.invites.length} invite emails`,
    );

    return NextResponse.json({
      message: "Registration successful",
      userId: result.user.id,
      organizationId: result.organization.id,
      inviteLinks,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 },
    );
  }
}
