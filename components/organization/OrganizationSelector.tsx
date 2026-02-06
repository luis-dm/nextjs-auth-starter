"use client";

import { useState } from "react";
import { Users, ChevronDown, Info } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface OrganizationSelectorProps {
  organizations: Organization[];
  currentOrganization: Organization | null;
  onOrganizationChange: (org: Organization) => void;
  onInfoClick: () => void;
}

export default function OrganizationSelector({
  organizations,
  currentOrganization,
  onOrganizationChange,
  onInfoClick,
}: OrganizationSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* Organization Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Users className="w-4 h-4 text-gray-600" />
          <span className="text-gray-900 font-medium text-sm">
            {currentOrganization?.name || "Loading..."}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>

        {/* Dropdown Menu */}
        {showDropdown && organizations.length > 0 && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20">
              <div className="py-1">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      onOrganizationChange(org);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      org.id === currentOrganization?.id
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{org.name}</span>
                      {org.id === currentOrganization?.id && (
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

      {/* Info Button */}
      <button
        onClick={onInfoClick}
        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        title="View organization details"
      >
        <Info className="w-4 h-4" />
      </button>
    </div>
  );
}
