"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";

interface Facility {
  id: string;
  name: string;
  ifcFileName?: string | null;
  createdAt: string;
}

interface ClashDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string | undefined;
}

export default function ClashDetectionModal({
  isOpen,
  onClose,
  organizationId,
}: ClashDetectionModalProps) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilities, setSelectedFacilities] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && organizationId) {
      fetchFacilities();
    }
  }, [isOpen, organizationId]);

  const fetchFacilities = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/facilities?organizationId=${organizationId}&page=1&limit=1000`,
      );
      if (response.ok) {
        const data = await response.json();
        setFacilities(data.facilities || []);
      }
    } catch (error) {
      console.error("Error fetching facilities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFacility = (facilityId: string) => {
    setSelectedFacilities((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(facilityId)) {
        newSet.delete(facilityId);
      } else {
        newSet.add(facilityId);
      }
      return newSet;
    });
  };

  const handleViewModels = () => {
    // TODO: Implement clash detection view
    console.log("Selected facilities:", Array.from(selectedFacilities));
    onClose();
  };

  const handleCancel = () => {
    setSelectedFacilities(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const canProceed = selectedFacilities.size >= 2;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Clash Detection
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-600 mb-4">
            Select at least 2 facilities to check for clashes between models.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="ml-3 text-gray-600">Loading facilities...</p>
            </div>
          ) : facilities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No facilities available in this organization.
            </p>
          ) : (
            <div className="space-y-2">
              {facilities.map((facility) => (
                <div
                  key={facility.id}
                  onClick={() => handleToggleFacility(facility.id)}
                  className={`
                    flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${
                      selectedFacilities.has(facility.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }
                  `}
                >
                  {/* Checkbox */}
                  <div
                    className={`
                      w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors
                      ${
                        selectedFacilities.has(facility.id)
                          ? "bg-blue-500"
                          : "bg-white border-2 border-gray-300"
                      }
                    `}
                  >
                    {selectedFacilities.has(facility.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>

                  {/* Facility Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {facility.name}
                    </h3>
                    {facility.ifcFileName && (
                      <p className="text-sm text-gray-500 truncate">
                        {facility.ifcFileName}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-xs text-gray-400 shrink-0">
                    {new Date(facility.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            {selectedFacilities.size}{" "}
            {selectedFacilities.size === 1 ? "facility" : "facilities"} selected
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleViewModels}
              disabled={!canProceed}
              className={`
                px-4 py-2 rounded-md font-medium transition-colors
                ${
                  canProceed
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }
              `}
            >
              View Models
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
