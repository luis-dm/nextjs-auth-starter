import Link from "next/link";
import { Building2, Trash2, Pencil, Info } from "lucide-react";
import { useState } from "react";

interface FacilityCardProps {
  id: string;
  name: string;
  ifcFileName?: string | null;
  createdAt: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, name: string) => void;
  onDetails?: (id: string, name: string) => void;
}

export default function FacilityCard({
  id,
  name,
  ifcFileName,
  createdAt,
  onDelete,
  onEdit,
  onDetails,
}: FacilityCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Format the date
  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/facilities/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onDelete?.(id);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete facility");
      }
    } catch (error) {
      console.error("Error deleting facility:", error);
      alert("Error deleting facility");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(id, name);
  };

  const handleDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDetails?.(id, name);
  };

  return (
    <Link href={`/org/facility/${id}/viewer`} className="group block">
      <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all duration-200">
        {/* Icon/Thumbnail */}
        <div className="shrink-0 w-10 h-10 bg-linear-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center">
          <Building2 className="w-6 h-6 text-gray-700" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-gray-900 group-hover:text-gray-700 transition-colors truncate">
            {name}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {ifcFileName || "No IFC File Yet"}
          </p>
        </div>

        {/* Date */}
        <div className="shrink-0 text-xs text-gray-500">{formattedDate}</div>

        {/* Info Button */}
        {onDetails && (
          <button
            onClick={handleDetails}
            className="shrink-0 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="View details"
          >
            <Info className="w-4 h-4" />
          </button>
        )}

        {/* Edit Button */}
        {onEdit && (
          <button
            onClick={handleEdit}
            className="shrink-0 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Edit facility"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* Delete Button */}
        {onDelete && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Delete facility"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </Link>
  );
}
