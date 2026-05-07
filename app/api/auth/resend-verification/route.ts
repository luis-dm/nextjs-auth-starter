import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(
  email: string,
  name: string | null,
  token: string,
) {
  const verifyLink = `${process.env.NEXTAUTH_URL}/verify-email/${token}`;

  await resend.emails.send({
    from: "SYMBIM <noreply@openbim.app>",
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
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json({
        message: "If the email exists, we've sent a verification link.",
      });
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email already verified" },
        { status: 400 },
      );
    }

    // Delete old verification tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        userId: user.id,
        type: "EMAIL_VERIFICATION",
      },
    });

    // Create new token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: "EMAIL_VERIFICATION",
        expiresAt,
      },
    });

    // Send email
    try {
      await sendVerificationEmail(user.email, user.name, token);
    } catch (error) {
      console.error("Failed to send verification email:", error);
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Verification email sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 },
    );
  }
}
