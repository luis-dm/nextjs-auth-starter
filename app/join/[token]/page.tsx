import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import JoinForm from "./JoinForm";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Fetch the invite
  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: {
      organization: true,
    },
  });

  // Check if invite exists
  if (!invite) {
    notFound();
  }

  // Check if invite has expired
  if (new Date() > invite.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="bg-white p-8 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Invitation Expired
            </h2>
            <p className="text-gray-600">
              This invitation link has expired. Please contact the organization
              administrator for a new invitation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  // If user exists, check if they're already a member
  if (existingUser) {
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: invite.organizationId,
        },
      },
    });

    if (existingMember) {
      // Already a member, redirect to facility list
      redirect("/org/facility");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Join {invite.organization.name}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You've been invited to join as a {invite.role.toLowerCase()}
          </p>
        </div>
        <JoinForm
          token={token}
          email={invite.email}
          organizationName={invite.organization.name}
          existingUser={!!existingUser}
        />
      </div>
    </div>
  );
}
