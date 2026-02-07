import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { X, User, Crown } from "lucide-react";
import toast from "react-hot-toast";

interface FacilityMember {
  id: string;
  role: "MANAGER" | "MEMBER";
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface FacilityDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilityId: string;
  facilityName: string;
}

export default function FacilityDetailsModal({
  isOpen,
  onClose,
  facilityId,
  facilityName,
}: FacilityDetailsModalProps) {
  const { data: session } = useSession();
  const [facility, setFacility] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<
    "MANAGER" | "MEMBER" | null
  >(null);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchFacilityDetails();
    }
  }, [isOpen, facilityId]);

  const fetchFacilityDetails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/facilities/${facilityId}`);
      if (response.ok) {
        const data = await response.json();
        setFacility(data);

        // Determine current user's role
        const currentUserEmail = session?.user?.email;
        if (currentUserEmail && data.members) {
          const currentMember = data.members.find(
            (m: FacilityMember) => m.user.email === currentUserEmail,
          );
          setCurrentUserRole(currentMember?.role || null);
        }
      }
    } catch (error) {
      console.error("Error fetching facility details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleToggle = async (
    memberId: string,
    currentRole: "MANAGER" | "MEMBER",
  ) => {
    if (currentUserRole !== "MANAGER") return;

    const newRole = currentRole === "MANAGER" ? "MEMBER" : "MANAGER";

    setUpdatingMember(memberId);
    try {
      const response = await fetch(`/api/facilities/${facilityId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      if (response.ok) {
        // Refresh facility details
        await fetchFacilityDetails();
        toast.success(`Member role updated to ${newRole}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update member role");
      }
    } catch (error) {
      console.error("Error updating member role:", error);
      toast.error("Error updating member role");
    } finally {
      setUpdatingMember(null);
    }
  };

  if (!isOpen) return null;

  const formattedDate = facility?.createdAt
    ? new Date(facility.createdAt).toLocaleDateString("en-US", {
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
            Facility Details
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
              <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : facility ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Facility Name
                  </label>
                  <p className="text-base text-gray-900 mt-1">
                    {facility.name}
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

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    IFC File
                  </label>
                  <p className="text-base text-gray-900 mt-1">
                    {facility.ifcFileName || "No IFC file uploaded"}
                  </p>
                  {facility.ifcFileSize && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      Size: {(facility.ifcFileSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Organization
                  </label>
                  <p className="text-base text-gray-900 mt-1">
                    {facility.organization?.name}
                  </p>
                </div>
              </div>

              {/* Members Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-500">
                    Members ({facility.members?.length || 0})
                  </label>
                  {currentUserRole === "MANAGER" && (
                    <span className="text-xs text-gray-500">
                      Click to toggle manager status
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {facility.members && facility.members.length > 0 ? (
                    facility.members.map((member: FacilityMember) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            {member.role === "MANAGER" ? (
                              <Crown className="w-5 h-5 text-gray-600" />
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

                        {currentUserRole === "MANAGER" ? (
                          <button
                            onClick={() =>
                              handleRoleToggle(member.id, member.role)
                            }
                            disabled={updatingMember === member.id}
                            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                              member.role === "MANAGER"
                                ? "bg-gray-800 text-gray-100 hover:bg-gray-500"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            } disabled:opacity-50`}
                          >
                            {updatingMember === member.id ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : member.role === "MANAGER" ? (
                              "Manager"
                            ) : (
                              "Member"
                            )}
                          </button>
                        ) : (
                          <span
                            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded ${
                              member.role === "MANAGER"
                                ? "bg-gray-800 text-gray-100"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {member.role === "MANAGER" ? "Manager" : "Member"}
                          </span>
                        )}
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
              Failed to load facility details
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
