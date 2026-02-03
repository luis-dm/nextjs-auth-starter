import Link from "next/link";
import { Building2 } from "lucide-react";

interface FacilityCardProps {
  id: string;
  name: string;
  ifcFileName?: string | null;
  createdAt: string;
}

export default function FacilityCard({
  id,
  name,
  ifcFileName,
  createdAt,
}: FacilityCardProps) {
  // Format the date
  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/org/facility/${id}/viewer`} className="group block">
      <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all duration-200">
        {/* Icon/Thumbnail */}
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center">
          <Building2 className="w-6 h-6 text-blue-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {name}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {ifcFileName || "No IFC File Yet"}
          </p>
        </div>

        {/* Date */}
        <div className="flex-shrink-0 text-xs text-gray-500">
          {formattedDate}
        </div>
      </div>
    </Link>
  );
}
