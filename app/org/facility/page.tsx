"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import FacilityCard from "@/components/facility-list/FacilityCard";
import RegisterFacilityModal from "@/components/facility-list/RegisterFacilityModal";
import FacilitySorter, {
  SortOption,
} from "@/components/facility-list/FacilitySorter";
import { Users, Plus, ChevronDown } from "lucide-react";

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
  const itemsPerPage = 8;

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");

  // Fetch user's organizations
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations");
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      }
    };

    fetchOrganizations();
  }, []);

  // Fetch facilities from the database
  useEffect(() => {
    const fetchFacilities = async () => {
      setIsLoading(true);
      try {
        const url = organization?.id
          ? `/api/facilities?organizationId=${organization.id}`
          : "/api/facilities";
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setFacilities(data.facilities || []);
          setOrganization(data.organization || null);
          setTotalPages(
            Math.ceil((data.facilities?.length || 0) / itemsPerPage),
          );
        } else {
          console.error("Failed to fetch facilities");
        }
      } catch (error) {
        console.error("Error fetching facilities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFacilities();
  }, [itemsPerPage, organization?.id]);

  // Sort facilities based on the selected option
  const sortedFacilities = [...facilities].sort((a, b) => {
    switch (sortOption) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "date-asc":
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "date-desc":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      default:
        return 0;
    }
  });

  // Calculate paginated facilities
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFacilities = sortedFacilities.slice(startIndex, endIndex);

  const handleRegisterFacility = async (
    name: string,
    fragmentData: ArrayBuffer | null,
    ifcFileName: string | null,
    ifcFileSize: number | null,
  ) => {
    try {
      const response = await fetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          fragmentData: fragmentData
            ? Array.from(new Uint8Array(fragmentData))
            : null,
          ifcFileName,
          ifcFileSize,
        }),
      });

      if (response.ok) {
        const newFacility = await response.json();
        console.log("Facility registered:", newFacility);

        // Add the new facility to the list
        setFacilities((prev) => [newFacility, ...prev]);
        setTotalPages(Math.ceil((facilities.length + 1) / itemsPerPage));
      } else {
        const error = await response.json();
        console.error("Failed to register facility:", error);
        alert("Failed to register facility: " + error.error);
      }
    } catch (error) {
      console.error("Error registering facility:", error);
      alert("Error registering facility");
    }

    setIsModalOpen(false);
  };

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center space-x-2 min-h-[200px]">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="w-full max-w-7xl mb-6 flex items-center justify-between flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">Facilities</h1>

            {/* Org Selector - Centered */}
            <div className="relative">
              <button
                onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Users className="w-4 h-4 text-gray-600" />
                <span className="text-gray-900 font-medium text-sm">
                  {organization?.name || "Loading..."}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {/* Dropdown */}
              {showOrgDropdown && organizations.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowOrgDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                    <div className="py-1">
                      {organizations.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => {
                            setOrganization(org);
                            setShowOrgDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                            org.id === organization?.id
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{org.name}</span>
                            {org.id === organization?.id && (
                              <span className="text-blue-600">✓</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <FacilitySorter
                currentSort={sortOption}
                onSortChange={setSortOption}
              />
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4 text-gray-600" />
                Register Facility
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
                />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex justify-center items-center gap-4 mt-6 flex-shrink-0">
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

      {/* Register Facility Modal */}
      <RegisterFacilityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleRegisterFacility}
      />
    </>
  );
}

export default function FacilityPage() {
  return (
    <div className="h-full bg-gray-50 flex flex-col items-center justify-start py-8 px-8 overflow-hidden">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="ml-3 text-gray-600">Loading page...</p>
          </div>
        }
      >
        <FacilityList />
      </Suspense>
    </div>
  );
}
