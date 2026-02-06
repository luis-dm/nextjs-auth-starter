"use client";

import { useEffect, useState } from "react";
import { X, User, Crown } from "lucide-react";

interface OrganizationMember {
  id: string;
  role: "MANAGER" | "MEMBER";
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface OrganizationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
}

export default function OrganizationDetailsModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
}: OrganizationDetailsModalProps) {
  const [organization, setOrganization] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchOrganizationDetails();
    }
  }, [isOpen, organizationId]);

  const fetchOrganizationDetails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
      }
    } catch (error) {
      console.error("Error fetching organization details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const formattedDate = organization?.createdAt
    ? new Date(organization.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Organization Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : organization ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Organization Name
                  </label>
                  <p className="text-base text-gray-900 mt-1">
                    {organization.name}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Created
                  </label>
                  <p className="text-base text-gray-900 mt-1">
                    {formattedDate}
                  </p>
                </div>
              </div>

              {/* Members Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-500">
                    Members ({organization.members?.length || 0})
                  </label>
                </div>

                <div className="space-y-2">
                  {organization.members && organization.members.length > 0 ? (
                    organization.members.map((member: OrganizationMember) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            {member.role === "MANAGER" ? (
                              <Crown className="w-5 h-5 text-blue-600" />
                            ) : (
                              <User className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.user.name || member.user.email}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {member.user.email}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded ${
                            member.role === "MANAGER"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {member.role === "MANAGER" ? "Manager" : "Member"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No members found
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              Failed to load organization details
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
