"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import FacilityCard from "@/components/facility-list/FacilityCard";
import RegisterFacilityModal from "@/components/facility-list/RegisterFacilityModal";
import FacilityDetailsModal from "@/components/facility-list/FacilityDetailsModal";
import ClashDetectionModal from "@/components/facility-list/ClashDetectionModal";
import OrganizationSelector from "@/components/organization/OrganizationSelector";
import { TypePropertyIndex } from "@/utils/ifcTypeIndex";
import OrganizationDetailsModal from "@/components/organization/OrganizationDetailsModal";
import FacilitySorter, {
  SortOption,
} from "@/components/facility-list/FacilitySorter";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { Users, Plus, ChevronDown, Shield } from "lucide-react";
import toast from "react-hot-toast";

interface Facility {
  id: string;
  name: string;
  ifcFileName?: string | null;
  ifcFileSize?: number | null;
  createdAt: string;
  organizationId: string;
}

interface Organization {
  id: string;
  name: string;
}

// Disable static generation
export const dynamic = "force-dynamic";

function FacilityList() {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const itemsPerPage = 7;

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isOrgDetailsModalOpen, setIsOrgDetailsModalOpen] = useState(false);
  const [isClashDetectionModalOpen, setIsClashDetectionModalOpen] =
    useState(false);
  const [selectedFacility, setSelectedFacility] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");

  // Fetch user's organizations and initial facilities
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch organizations and facilities in parallel
        const [orgsResponse, facilitiesResponse] = await Promise.all([
          fetch("/api/organizations"),
          fetch(
            `/api/facilities?page=${page}&limit=${itemsPerPage}&sort=${sortOption}`,
          ),
        ]);

        if (orgsResponse.ok) {
          const orgsData = await orgsResponse.json();
          setOrganizations(orgsData.organizations || []);
        }

        if (facilitiesResponse.ok) {
          const facilitiesData = await facilitiesResponse.json();
          setFacilities(facilitiesData.facilities || []);
          setOrganization(facilitiesData.organization || null);
          setTotalPages(facilitiesData.totalPages || 1);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page, itemsPerPage, sortOption]);

  // Fetch facilities when organization changes
  useEffect(() => {
    if (!organization?.id) return;

    const fetchFacilitiesForOrg = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/facilities?organizationId=${organization.id}&page=${page}&limit=${itemsPerPage}&sort=${sortOption}`,
        );
        if (response.ok) {
          const data = await response.json();
          setFacilities(data.facilities || []);
          setTotalPages(data.totalPages || 1);
        }
      } catch (error) {
        console.error("Error fetching facilities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFacilitiesForOrg();
  }, [organization?.id, page, itemsPerPage, sortOption]);

  // Facilities are already paginated and sorted from server
  const paginatedFacilities = facilities;

  const handleRegisterFacility = async (
    name: string,
    fragmentData: ArrayBuffer | null,
    ifcFileName: string | null,
    ifcFileSize: number | null,
    typePropertyIndex: TypePropertyIndex | null,
  ): Promise<void> => {
    try {
      // Convert ArrayBuffer to base64 string (much smaller than array of numbers)
      let fragmentBase64: string | null = null;
      if (fragmentData) {
        const uint8Array = new Uint8Array(fragmentData);
        const binaryString = uint8Array.reduce(
          (acc, byte) => acc + String.fromCharCode(byte),
          "",
        );
        fragmentBase64 = btoa(binaryString);
        console.log(
          `Uploading facility (fragment size: ${fragmentBase64.length} bytes base64)`,
        );
      }

      const response = await fetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          fragmentData: fragmentBase64,
          ifcFileName,
          ifcFileSize,
          typePropertyIndex,
          organizationId: organization?.id,
        }),
      });

      if (response.ok) {
        const newFacility = await response.json();
        console.log("Facility registered:", newFacility);

        // Refetch facilities to get correct pagination
        const refetchResponse = await fetch(
          `/api/facilities?organizationId=${organization?.id}&page=1&limit=${itemsPerPage}`,
        );
        if (refetchResponse.ok) {
          const data = await refetchResponse.json();
          setFacilities(data.facilities || []);
          setTotalPages(data.totalPages || 1);

          // Navigate to page 1 if not already there
          if (page !== 1) {
            window.location.href = `/org/facility?page=1`;
          }
        }

        // Close modal after successful upload
        setIsModalOpen(false);
        toast.success(`Facility "${name}" registered successfully`);
      } else {
        const error = await response.json();
        console.error("Failed to upload model:", error);
        toast.error("Failed to upload model: " + error.error);
        throw new Error("Failed to upload model");
      }
    } catch (error) {
      console.error("Error registering facility:", error);
      throw error;
    }
  };

  const handleDeleteFacility = async (facilityId: string) => {
    // Optimistically remove from UI
    setFacilities((prev) => prev.filter((f) => f.id !== facilityId));

    // Refetch to get accurate pagination
    try {
      const response = await fetch(
        `/api/facilities?organizationId=${organization?.id}&page=${page}&limit=${itemsPerPage}`,
      );
      if (response.ok) {
        const data = await response.json();
        setFacilities(data.facilities || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error("Error refetching facilities:", error);
    }
  };

  const handleEditFacility = (facilityId: string, facilityName: string) => {
    window.location.href = `/org/facility/${facilityId}/editor`;
  };

  const handleDetailsFacility = (facilityId: string, facilityName: string) => {
    setSelectedFacility({ id: facilityId, name: facilityName });
    setIsDetailsModalOpen(true);
  };

  return (
    <>
      <EmailVerificationBanner />
      {isLoading ? (
        <div className="flex items-center justify-center space-x-2 min-h-50">
          <div className="w-6 h-6 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="w-full max-w-7xl mb-6 flex items-center justify-between shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">Facilities</h1>

            {/* Organization Selector */}
            <OrganizationSelector
              organizations={organizations}
              currentOrganization={organization}
              onOrganizationChange={(org) => setOrganization(org)}
              onInfoClick={() => setIsOrgDetailsModalOpen(true)}
            />

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <FacilitySorter
                currentSort={sortOption}
                onSortChange={setSortOption}
              />
              <button
                onClick={() => setIsClashDetectionModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                <Shield className="w-4 h-4 text-gray-600" />
                Clash Detection
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4 text-gray-600" />
                Upload Model
              </button>
            </div>
          </div>

          {/* Facility List */}
          {paginatedFacilities.length === 0 ? (
            <p className="text-gray-600">No facilities available.</p>
          ) : (
            <div className="flex flex-col gap-2 w-full max-w-7xl overflow-y-auto flex-1">
              {paginatedFacilities.map((facility) => (
                <FacilityCard
                  key={facility.id}
                  id={facility.id}
                  name={facility.name}
                  ifcFileName={facility.ifcFileName}
                  createdAt={facility.createdAt}
                  onDelete={handleDeleteFacility}
                  onEdit={handleEditFacility}
                  onDetails={handleDetailsFacility}
                />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex justify-center items-center gap-4 mt-6 shrink-0">
            <button
              disabled={page <= 1}
              onClick={() => {
                if (page > 1) {
                  window.location.href = `/org/facility?page=${page - 1}`;
                }
              }}
              className="px-4 py-2 text-gray-600 disabled:text-gray-300 hover:text-gray-900"
            >
              &lt; Previous
            </button>
            <span className="text-gray-700">Page {page}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => {
                if (page < totalPages) {
                  window.location.href = `/org/facility?page=${page + 1}`;
                }
              }}
              className="px-4 py-2 text-gray-600 disabled:text-gray-300 hover:text-gray-900"
            >
              Next &gt;
            </button>
          </div>
        </>
      )}

      {/* Clash Detection Modal */}
      <ClashDetectionModal
        isOpen={isClashDetectionModalOpen}
        onClose={() => setIsClashDetectionModalOpen(false)}
        organizationId={organization?.id}
      />

      {/* Upload Model Modal */}
      <RegisterFacilityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleRegisterFacility}
      />

      {/* Facility Details Modal */}
      {selectedFacility && (
        <FacilityDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedFacility(null);
          }}
          facilityId={selectedFacility.id}
          facilityName={selectedFacility.name}
        />
      )}

      {/* Organization Details Modal */}
      {organization && (
        <OrganizationDetailsModal
          isOpen={isOrgDetailsModalOpen}
          onClose={() => setIsOrgDetailsModalOpen(false)}
          organizationId={organization.id}
          organizationName={organization.name}
        />
      )}
    </>
  );
}

export default function FacilityPage() {
  return (
    <div className="h-full bg-gray-50 flex flex-col items-center justify-start py-8 px-8 overflow-hidden">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="ml-3 text-gray-600">Loading page...</p>
          </div>
        }
      >
        <FacilityList />
      </Suspense>
    </div>
  );
}
