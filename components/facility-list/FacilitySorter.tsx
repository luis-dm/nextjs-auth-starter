"use client";

import { ArrowUpDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export type SortOption = "name-asc" | "name-desc" | "date-asc" | "date-desc";

interface FacilitySorterProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export default function FacilitySorter({
  currentSort,
  onSortChange,
}: FacilitySorterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "name-asc", label: "Name (A-Z)" },
    { value: "name-desc", label: "Name (Z-A)" },
    { value: "date-desc", label: "Newest First" },
    { value: "date-asc", label: "Oldest First" },
  ];

  const currentLabel =
    sortOptions.find((opt) => opt.value === currentSort)?.label || "Sort";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        <ArrowUpDown className="w-4 h-4 text-gray-600" />
        <span className="text-sm text-gray-700 font-medium">
          {currentLabel}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSortChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <span>{option.label}</span>
                {currentSort === option.value && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
