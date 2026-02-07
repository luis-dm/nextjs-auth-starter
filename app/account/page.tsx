"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import OrganizationCard from "@/components/organization/OrganizationCard";
import CreateOrganizationModal from "@/components/organization/CreateOrganizationModal";
import InviteMembersModal from "@/components/organization/InviteMembersModal";
import OrganizationMembersModal from "@/components/organization/OrganizationMembersModal";

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
  const [showMembersModal, setShowMembersModal] = useState(false);
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

  const handleViewMembers = (orgId: string, orgName: string) => {
    setSelectedOrgId(orgId);
    setSelectedOrgName(orgName);
    setShowMembersModal(true);
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
                <OrganizationCard
                  key={org.id}
                  id={org.id}
                  name={org.name}
                  role={org.role}
                  onInvite={handleInviteClick}
                  onViewMembers={handleViewMembers}
                />
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

      {/* Organization Members Modal */}
      {showMembersModal && selectedOrgId && (
        <OrganizationMembersModal
          isOpen={showMembersModal}
          onClose={() => {
            setShowMembersModal(false);
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
