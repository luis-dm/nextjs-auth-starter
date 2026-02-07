"use client";

import { useState, useEffect } from "react";
import { Crown, User as UserIcon } from "lucide-react";

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface OrganizationMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
}

export default function OrganizationMembersModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
}: OrganizationMembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && organizationId) {
      fetchMembers();
    }
  }, [isOpen, organizationId]);

  const fetchMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      } else {
        setError("Failed to load members");
      }
    } catch (error) {
      console.error("Error fetching members:", error);
      setError("An error occurred while loading members");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Organization Members</h3>
            <p className="text-sm text-gray-500 mt-1">{organizationName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-sm text-center py-8">{error}</div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No members found
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                      <UserIcon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.name || "Unknown"}
                      </p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {member.role === "MANAGER" ? (
                      <>
                        <Crown className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-gray-800">
                          Manager
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">Member</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
