import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken || verificationToken.type !== "EMAIL_VERIFICATION") {
    notFound();
  }

  // Check if expired
  if (new Date() > verificationToken.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Link Expired
            </h1>
            <p className="text-gray-600 mb-6">
              This verification link has expired. Please request a new one.
            </p>
            <Link
              href="/resend-verification"
              className="inline-block bg-gray-900 text-white px-6 py-2 rounded-md hover:bg-gray-800"
            >
              Resend Verification Email
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if already verified
  if (verificationToken.user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Already Verified!
            </h1>
            <p className="text-gray-600 mb-6">
              Your email has already been verified. You can sign in to your
              account.
            </p>
            <Link
              href="/login"
              className="inline-block bg-gray-900 text-white px-6 py-2 rounded-md hover:bg-gray-800"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Verify the email
  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: { id: verificationToken.id },
    }),
  ]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Email Verified!
          </h1>
          <p className="text-gray-600 mb-6">
            Your email has been successfully verified. You can now sign in and
            access all features.
          </p>
          <Link
            href="/login"
            className="inline-block bg-gray-900 text-white px-6 py-2 rounded-md hover:bg-gray-800"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
