"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  role: string;
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchOrganizations();
    }
  }, [session]);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/organizations");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteClick = (orgId: string, orgName: string) => {
    setSelectedOrgId(orgId);
    setSelectedOrgName(orgName);
    setShowInviteModal(true);
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Account</h1>

        {/* User Information */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            User Information
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Name</label>
              <p className="text-base font-medium text-gray-900">
                {session.user?.name || "User"}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Email</label>
              <p className="text-base font-medium text-gray-900">
                {session.user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Organizations */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Organizations
            </h2>
            <button
              onClick={() => setShowCreateOrgModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Organization
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : organizations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">
              No organizations yet
            </p>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{org.name}</p>
                    <p className="text-sm text-gray-500">
                      Role:{" "}
                      <span
                        className={`font-medium ${
                          org.role === "MANAGER"
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}
                      >
                        {org.role === "MANAGER" ? "Manager" : "Member"}
                      </span>
                    </p>
                  </div>
                  {org.role === "MANAGER" && (
                    <button
                      onClick={() => handleInviteClick(org.id, org.name)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      Invite
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <CreateOrganizationModal
          isOpen={showCreateOrgModal}
          onClose={() => {
            setShowCreateOrgModal(false);
            fetchOrganizations();
          }}
        />
      )}

      {/* Invite Members Modal */}
      {showInviteModal && selectedOrgId && (
        <InviteMembersModal
          isOpen={showInviteModal}
          onClose={() => {
            setShowInviteModal(false);
            setSelectedOrgId(null);
            setSelectedOrgName("");
          }}
          organizationId={selectedOrgId}
          organizationName={selectedOrgName}
        />
      )}
    </div>
  );
}

// Create Organization Modal Component
function CreateOrganizationModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [organizationName, setOrganizationName] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addEmailField = () => {
    setMemberEmails([...memberEmails, ""]);
  };

  const removeEmailField = (index: number) => {
    if (memberEmails.length > 1) {
      setMemberEmails(memberEmails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...memberEmails];
    updated[index] = value;
    setMemberEmails(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const validEmails = memberEmails.filter((email) => email.trim() !== "");

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organizationName,
          inviteEmails: validEmails,
        }),
      });

      if (response.ok) {
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create organization");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">
            Create Organization
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Your Company"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Team Members (Optional)
            </label>
            <div className="space-y-2">
              {memberEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="teammate@company.com"
                  />
                  {memberEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <span className="text-xl">&times;</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addEmailField}
              className="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
            >
              <Plus className="w-4 h-4" />
              Add another member
            </button>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Invite Members Modal Component
function InviteMembersModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
}: {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
}) {
  const [memberEmails, setMemberEmails] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addEmailField = () => {
    setMemberEmails([...memberEmails, ""]);
  };

  const removeEmailField = (index: number) => {
    if (memberEmails.length > 1) {
      setMemberEmails(memberEmails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...memberEmails];
    updated[index] = value;
    setMemberEmails(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const validEmails = memberEmails.filter((email) => email.trim() !== "");

      if (validEmails.length === 0) {
        setError("Please enter at least one email address");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/organizations/${organizationId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: validEmails }),
      });

      if (response.ok) {
        setSuccess(true);
        setMemberEmails([""]);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to send invitations");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Invite Members</h3>
            <p className="text-sm text-gray-500 mt-1">{organizationName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Addresses
            </label>
            <div className="space-y-2">
              {memberEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="teammate@company.com"
                  />
                  {memberEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <span className="text-xl">&times;</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addEmailField}
              className="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
            >
              <Plus className="w-4 h-4" />
              Add another email
            </button>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          {success && (
            <div className="text-green-600 text-sm text-center">
              Invitations sent successfully!
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send Invites"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
